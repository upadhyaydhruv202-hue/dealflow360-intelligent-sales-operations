import { COPILOT } from '../constants';
import { AppError, ExternalServiceError, FeatureDisabledError, ValidationError } from '../errors';
import type { AIService } from '../integrations/ai';
import { executeAiTool } from '../integrations/ai/guardrails';
import { isFeatureEnabled } from '../features';
import type { AppConfig } from '../types/config';
import type { AppLogger } from '../utils/logger';
import type { AuditService } from '../audit/audit.service';
import { planCopilotTurn } from './copilot.planner';
import { redactText } from './copilot.redact';
import type { CopilotToolRegistry } from './copilot.registry';
import {
  createMemoryCopilotConfirmations,
  type CopilotConfirmationStore,
} from './copilot.pending';
import type {
  CopilotChatInput,
  CopilotChatResult,
  CopilotConversationStore,
  CopilotPlan,
  CopilotPlannedTool,
  CopilotToolExecution,
} from './copilot.types';

export function isCopilotEnabled(config: AppConfig): boolean {
  return isFeatureEnabled(config, 'copilot');
}

export interface CopilotServiceOptions {
  config: AppConfig;
  logger: AppLogger;
  ai: AIService;
  registry: CopilotToolRegistry;
  conversations: CopilotConversationStore;
  audit: AuditService;
  confirmations?: CopilotConfirmationStore;
}

export class CopilotService {
  private readonly confirmations: CopilotConfirmationStore;

  constructor(private readonly options: CopilotServiceOptions) {
    this.confirmations = options.confirmations ?? createMemoryCopilotConfirmations();
  }

  get enabled(): boolean {
    return isCopilotEnabled(this.options.config);
  }

  listTools() {
    return this.options.registry.descriptors();
  }

  listConversations(userId: string, query?: { page?: number; pageSize?: number }) {
    this.assertReady();
    return this.options.conversations.listForUser(userId, query);
  }

  async getConversation(id: string, userId: string) {
    this.assertReady();
    const conversation = await this.options.conversations.getForUser(id, userId);
    const messages = await this.options.conversations.listMessages(id);
    return { ...conversation, messages };
  }

  async clearConversation(id: string, userId: string) {
    this.assertReady();
    await this.options.conversations.clearMessages(id, userId);
    return { id, cleared: true as const };
  }

  async deleteConversation(id: string, userId: string) {
    this.assertReady();
    await this.options.conversations.deleteForUser(id, userId);
    return { id, deleted: true as const };
  }

  async chat(input: CopilotChatInput): Promise<CopilotChatResult> {
    this.assertReady();
    const conversation = input.conversationId
      ? await this.options.conversations.getForUser(input.conversationId, input.user.id)
      : await this.options.conversations.create(input.user.id);

    if (input.confirm) {
      return this.confirmPending(conversation.id, input);
    }

    const message = redactText(input.message ?? '');
    await this.options.conversations.addMessage({
      conversationId: conversation.id,
      role: 'user',
      content: message,
    });

    const history = await this.loadHistory(conversation.id);
    let plan: CopilotPlan;
    try {
      plan = await planCopilotTurn({
        ai: this.options.ai,
        message,
        history,
        tools: this.options.registry.descriptors(),
      });
    } catch (error) {
      return this.failTurn(conversation.id, error);
    }

    const plannedTools = plan.intent === 'tool' ? plan.tools : [];
    if (plannedTools.length === 0) {
      const assistant = await this.options.conversations.addMessage({
        conversationId: conversation.id,
        role: 'assistant',
        content: redactText(plan.reply),
        confidence: plan.confidence,
        evidence: plan.evidence ?? null,
      });
      return {
        conversationId: conversation.id,
        status: 'completed',
        message: toAssistantMessage(assistant),
        tools: [],
      };
    }

    const executions = await this.executeTools(plannedTools, {
      user: input.user,
      conversationId: conversation.id,
      confirmed: false,
      plannerConfidence: plan.confidence,
    });

    return this.persistAssistantTurn(conversation.id, input.user.id, plan, executions);
  }

  private async confirmPending(
    conversationId: string,
    input: CopilotChatInput,
  ): Promise<CopilotChatResult> {
    const pending = await this.confirmations.take(conversationId, input.user.id);
    if (!pending || pending.tools.length === 0) {
      throw new ValidationError('There is no pending copilot action to confirm', [
        { path: 'confirm', message: 'No high-risk tool is waiting for confirmation', code: 'custom' },
      ]);
    }

    await this.options.conversations.addMessage({
      conversationId,
      role: 'user',
      content: redactText(input.message || 'Confirmed'),
    });

    const executions = await this.executeTools(pending.tools, {
      user: input.user,
      conversationId,
      confirmed: true,
      plannerConfidence: 1,
    });

    return this.persistAssistantTurn(
      conversationId,
      input.user.id,
      {
        intent: 'tool',
        reply: 'The confirmed action finished.',
        tools: pending.tools,
        confidence: 1,
        evidence: undefined,
      },
      executions,
    );
  }

  private async executeTools(
    planned: CopilotPlannedTool[],
    context: {
      user: CopilotChatInput['user'];
      conversationId: string;
      confirmed: boolean;
      plannerConfidence?: number;
    },
  ): Promise<CopilotToolExecution[]> {
    const selected = planned.slice(0, COPILOT.MAX_TOOLS_PER_TURN);
    const executions: CopilotToolExecution[] = [];

    for (const plannedTool of selected) {
      executions.push(
        await executeAiTool({
          registry: this.options.registry,
          name: plannedTool.name,
          args: plannedTool.arguments,
          user: context.user,
          confirmed: context.confirmed,
          conversationId: context.conversationId,
          plannerConfidence: context.plannerConfidence,
          audit: this.options.audit,
          auditAction: COPILOT.AUDIT_ACTION,
          logger: this.options.logger,
        }),
      );
    }

    return executions;
  }

  private async persistAssistantTurn(
    conversationId: string,
    userId: string,
    plan: CopilotPlan,
    executions: CopilotToolExecution[],
  ): Promise<CopilotChatResult> {
    const pending = executions.some((item) => item.status === 'pending_confirmation');
    const failedHard = executions.every((item) => item.status === 'failed' || item.status === 'denied');
    const content = pending
      ? redactText(plan.reply || 'This action requires explicit confirmation before it can run.')
      : redactText(formatToolReply(plan.reply, executions));

    if (pending) {
      await this.confirmations.save({
        conversationId,
        userId,
        tools: executions
          .filter((item) => item.status === 'pending_confirmation')
          .map((item) => ({ name: item.name, arguments: item.arguments })),
      });
    } else {
      await this.confirmations.clear(conversationId);
    }

    const assistant = await this.options.conversations.addMessage({
      conversationId,
      role: 'assistant',
      content,
      toolCalls: executions,
      confidence: plan.confidence,
      evidence: plan.evidence ?? null,
      errorCode: failedHard && !pending ? 'COPILOT_TOOL_DENIED' : null,
    });

    return {
      conversationId,
      status: pending ? 'pending_confirmation' : 'completed',
      message: toAssistantMessage(assistant),
      tools: executions,
    };
  }

  private async failTurn(conversationId: string, error: unknown): Promise<CopilotChatResult> {
    this.options.logger.warn({ err: error, conversationId }, 'Copilot planner failed');
    const assistant = await this.options.conversations.addMessage({
      conversationId,
      role: 'assistant',
      content: 'The assistant could not complete this turn. You can retry your last message.',
      errorCode: error instanceof AppError ? error.code : 'EXTERNAL_SERVICE_ERROR',
    });
    return {
      conversationId,
      status: 'error',
      message: toAssistantMessage(assistant),
      tools: [],
    };
  }

  private async loadHistory(conversationId: string) {
    const messages = await this.options.conversations.listMessages(conversationId, COPILOT.MAX_HISTORY_MESSAGES);
    return messages.slice(0, -1).map((item) => ({
      role: item.role,
      content: item.content.slice(0, COPILOT.MAX_HISTORY_CHARS),
    }));
  }

  private assertReady(): void {
    if (!this.enabled) {
      throw new FeatureDisabledError('copilot');
    }

    if (!this.options.ai.ready) {
      throw new ExternalServiceError('AI is not configured', { provider: 'ai' });
    }
  }
}

export function createCopilotService(options: CopilotServiceOptions): CopilotService {
  return new CopilotService(options);
}

function formatToolReply(reply: string, executions: CopilotToolExecution[]): string {
  const lines = executions.map((item) => {
    if (item.status === 'success') {
      return `Used ${item.name}.`;
    }

    if (item.status === 'pending_confirmation') {
      return `${item.name} is waiting for confirmation.`;
    }

    if (item.status === 'denied') {
      return `${item.name} was not allowed.`;
    }

    if (item.status === 'invalid_arguments') {
      return `${item.name} received invalid arguments.`;
    }

    return `${item.name} failed.`;
  });

  return [reply, ...lines].filter(Boolean).join(' ').trim();
}

function toAssistantMessage(message: {
  id: string;
  content: string;
  confidence: number | null;
  evidence: string | null;
  errorCode: string | null;
}): CopilotChatResult['message'] {
  return {
    id: message.id,
    role: 'assistant',
    content: message.content,
    confidence: message.confidence ?? undefined,
    evidence: message.evidence ?? undefined,
    errorCode: message.errorCode ?? undefined,
  };
}
