import { INTENTS } from '../constants';
import { AppError, ExternalServiceError, FeatureDisabledError, ValidationError } from '../errors';
import { sanitizeErrorMessage } from '../errors/sanitize';
import { isFeatureEnabled } from '../features';
import { isLowConfidence } from '../integrations/ai/ai.review';
import type { AIService } from '../integrations/ai';
import {
  auditSafeRequest,
  redactSensitiveText,
  redactSensitiveValue,
  truncateJson,
  trustExplicitConfirmation,
} from '../integrations/ai/guardrails';
import { hasPermission } from '../rbac/authorize';
import { parseWithSchema } from '../schemas/parse';
import type { AppConfig } from '../types/config';
import type { AppLogger } from '../utils/logger';
import { getRequestId } from '../utils/request-context';
import type { AuditService } from '../audit/audit.service';
import { extractIntentCommand } from './intents.extractor';
import { intentRequiresConfirmation, resolveActionKind, type IntentRegistry } from './intents.registry';
import type {
  ExtractedIntentCommand,
  IntentConfirmationStore,
  IntentContext,
  IntentExecuteInput,
  IntentExecuteResult,
} from './intents.types';

export function isIntentsEnabled(config: AppConfig): boolean {
  return isFeatureEnabled(config, 'intents');
}

export interface IntentServiceOptions {
  config: AppConfig;
  logger: AppLogger;
  ai: AIService;
  registry: IntentRegistry;
  confirmations: IntentConfirmationStore;
  audit: AuditService;
}

export class IntentService {
  constructor(private readonly options: IntentServiceOptions) {}

  get enabled(): boolean {
    return isIntentsEnabled(this.options.config);
  }

  listIntents() {
    return this.options.registry.descriptors();
  }

  async execute(input: IntentExecuteInput): Promise<IntentExecuteResult> {
    this.assertReady();

    if (input.confirm) {
      return this.confirmPending(input);
    }

    const utterance = redactUtterance(input.utterance ?? '');
    let extracted: ExtractedIntentCommand;
    try {
      extracted = await extractIntentCommand({
        ai: this.options.ai,
        utterance,
        registry: this.options.registry,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        return this.finish({
          status: 'invalid',
          utterance,
          authorized: false,
          error: 'The model did not return a valid structured command',
          userId: input.user.id,
        });
      }

      this.options.logger.warn({ err: error }, 'Intent extraction failed');
      return this.finish({
        status: 'error',
        utterance,
        authorized: false,
        error: 'The intent engine could not parse that request. You can retry.',
        userId: input.user.id,
      });
    }

    const command = {
      intent: extracted.intent,
      input: asInputRecord(extracted.input),
    };

    if (isAmbiguous(extracted, this.options.registry.has(extracted.intent))) {
      return this.finish({
        status: 'ambiguous',
        utterance,
        command,
        confidence: extracted.confidence,
        evidence: extracted.evidence,
        clarification:
          extracted.clarification ??
          'That request is ambiguous. Name a specific action from the intent catalog.',
        candidates: extracted.candidates.length
          ? extracted.candidates
          : this.options.registry.names().slice(0, 6),
        authorized: false,
        userId: input.user.id,
      });
    }

    return this.runCommand({
      user: input.user,
      utterance,
      command,
      confidence: extracted.confidence,
      evidence: extracted.evidence,
      confirmed: false,
    });
  }

  private async confirmPending(input: IntentExecuteInput): Promise<IntentExecuteResult> {
    const token = input.confirmationToken?.trim();
    if (!token) {
      throw new ValidationError('A confirmation token is required', [
        { path: 'confirmationToken', message: 'Missing confirmation token', code: 'custom' },
      ]);
    }

    const pending = await this.options.confirmations.take(token, input.user.id);
    if (!pending) {
      throw new ValidationError('There is no pending intent to confirm', [
        {
          path: 'confirmationToken',
          message: 'No high-risk intent is waiting for confirmation',
          code: 'custom',
        },
      ]);
    }

    return this.runCommand({
      user: input.user,
      utterance: pending.utterance,
      command: { intent: pending.intent, input: pending.input },
      confidence: pending.confidence,
      evidence: pending.evidence,
      confirmed: true,
    });
  }

  private async runCommand(input: {
    user: IntentExecuteInput['user'];
    utterance: string;
    command: { intent: string; input: Record<string, unknown> };
    confidence: number;
    evidence?: string;
    confirmed: boolean;
  }): Promise<IntentExecuteResult> {
    const intent = this.options.registry.get(input.command.intent);
    if (!intent) {
      return this.finish({
        status: 'invalid',
        utterance: input.utterance,
        command: input.command,
        confidence: input.confidence,
        evidence: input.evidence,
        authorized: false,
        error: 'Intent is not in the allowlist',
        userId: input.user.id,
      });
    }

    const authorized = hasPermission(input.user, intent.requiredPermission);
    if (!authorized) {
      return this.finish({
        status: 'denied',
        utterance: input.utterance,
        command: input.command,
        confidence: input.confidence,
        evidence: input.evidence,
        riskLevel: intent.riskLevel,
        actionKind: resolveActionKind(intent),
        highRiskClass: intent.highRiskClass,
        authorized: false,
        error: 'You are not allowed to run this intent',
        userId: input.user.id,
        resource: intent.name,
      });
    }

    const parsed = intent.inputSchema.safeParse(input.command.input);
    if (!parsed.success) {
      return this.finish({
        status: 'invalid',
        utterance: input.utterance,
        command: input.command,
        confidence: input.confidence,
        evidence: input.evidence,
        riskLevel: intent.riskLevel,
        actionKind: resolveActionKind(intent),
        highRiskClass: intent.highRiskClass,
        authorized: true,
        error: 'Intent arguments failed schema validation',
        userId: input.user.id,
        resource: intent.name,
      });
    }

    const requestId = getRequestId();
    const context: IntentContext = {
      user: input.user,
      requestId,
      confirmed: input.confirmed,
      utterance: input.utterance,
    };

    try {
      if (intent.validate) {
        await intent.validate(parsed.data, context);
      }
    } catch {
      return this.finish({
        status: 'invalid',
        utterance: input.utterance,
        command: { intent: intent.name, input: asInputRecord(parsed.data) },
        confidence: input.confidence,
        evidence: input.evidence,
        riskLevel: intent.riskLevel,
        actionKind: resolveActionKind(intent),
        highRiskClass: intent.highRiskClass,
        authorized: true,
        error: 'Intent failed business-rule validation',
        userId: input.user.id,
        resource: intent.name,
      });
    }

    const required = intentRequiresConfirmation(intent, parsed.data);
    if (required && !trustExplicitConfirmation(input.confirmed)) {
      const pending = await this.options.confirmations.save({
        userId: input.user.id,
        utterance: input.utterance,
        intent: intent.name,
        input: asInputRecord(parsed.data),
        confidence: input.confidence,
        evidence: input.evidence,
      });
      return this.finish({
        status: 'pending_confirmation',
        utterance: input.utterance,
        command: { intent: intent.name, input: asInputRecord(parsed.data) },
        confidence: input.confidence,
        evidence: input.evidence,
        riskLevel: intent.riskLevel,
        actionKind: resolveActionKind(intent),
        highRiskClass: intent.highRiskClass,
        requiresConfirmation: true,
        confirmationToken: pending.token,
        authorized: true,
        result: { requiresConfirmation: true },
        userId: input.user.id,
        resource: intent.name,
      });
    }

    try {
      const raw = await intent.handler(parsed.data, context);
      const result = intent.outputSchema ? parseWithSchema(intent.outputSchema, raw) : raw;
      return this.finish({
        status: 'completed',
        utterance: input.utterance,
        command: { intent: intent.name, input: asInputRecord(parsed.data) },
        confidence: input.confidence,
        evidence: input.evidence,
        riskLevel: intent.riskLevel,
        actionKind: resolveActionKind(intent),
        highRiskClass: intent.highRiskClass,
        authorized: true,
        result: truncateJson(result),
        userId: input.user.id,
        resource: intent.name,
      });
    } catch (error) {
      this.options.logger.warn({ err: error, intent: intent.name, requestId }, 'Intent handler failed');
      return this.finish({
        status: 'error',
        utterance: input.utterance,
        command: { intent: intent.name, input: asInputRecord(parsed.data) },
        confidence: input.confidence,
        evidence: input.evidence,
        riskLevel: intent.riskLevel,
        actionKind: resolveActionKind(intent),
        highRiskClass: intent.highRiskClass,
        authorized: true,
        error: sanitizeIntentError(error),
        userId: input.user.id,
        resource: intent.name,
      });
    }
  }

  private async finish(input: {
    status: IntentExecuteResult['status'];
    utterance?: string;
    command?: IntentExecuteResult['command'];
    confidence?: number;
    evidence?: string;
    clarification?: string;
    candidates?: string[];
    riskLevel?: IntentExecuteResult['riskLevel'];
    actionKind?: IntentExecuteResult['actionKind'];
    highRiskClass?: IntentExecuteResult['highRiskClass'];
    requiresConfirmation?: boolean;
    confirmationToken?: string;
    authorized?: boolean;
    result?: unknown;
    error?: string;
    userId: string;
    resource?: string;
  }): Promise<IntentExecuteResult> {
    await this.options.audit.record({
      userId: input.userId,
      action: INTENTS.AUDIT_ACTION,
      resource: input.resource ?? input.command?.intent ?? 'intent',
      request: auditSafeRequest({
        utterance: input.utterance,
        intent: input.command?.intent,
        input: input.command?.input,
        authorized: input.authorized ?? false,
        action: input.command?.intent,
        outcome: input.status,
      }),
      status: input.status,
      requestId: getRequestId(),
    });

    return {
      status: input.status,
      utterance: input.utterance,
      command: input.command
        ? {
            intent: input.command.intent,
            input: (redactSensitiveValue(input.command.input) as Record<string, unknown>) ?? {},
          }
        : undefined,
      confidence: input.confidence,
      evidence: input.evidence,
      clarification: input.clarification,
      candidates: input.candidates,
      riskLevel: input.riskLevel,
      actionKind: input.actionKind,
      highRiskClass: input.highRiskClass,
      requiresConfirmation: input.requiresConfirmation,
      confirmationToken: input.confirmationToken,
      authorized: input.authorized,
      result: input.result,
      error: input.error,
    };
  }

  private assertReady(): void {
    if (!this.enabled) {
      throw new FeatureDisabledError('intents');
    }

    if (!this.options.ai.ready) {
      throw new ExternalServiceError('AI is not configured', { provider: 'ai' });
    }
  }
}

export function createIntentService(options: IntentServiceOptions): IntentService {
  return new IntentService(options);
}

function isAmbiguous(extracted: ExtractedIntentCommand, known: boolean): boolean {
  if (extracted.ambiguous) {
    return true;
  }
  if (extracted.intent === 'UNKNOWN') {
    return true;
  }
  if (isLowConfidence(extracted.confidence)) {
    return true;
  }
  if (!known) {
    return extracted.intent === 'UNKNOWN' || extracted.candidates.length > 1;
  }
  return false;
}

function asInputRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function redactUtterance(value: string): string {
  return redactSensitiveText(value.trim()).slice(0, INTENTS.MAX_UTTERANCE_CHARS);
}

function sanitizeIntentError(error: unknown): string {
  if (error instanceof ValidationError) {
    return 'Intent failed business-rule validation';
  }

  if (error instanceof AppError) {
    return sanitizeErrorMessage(error.message);
  }

  return 'The intent handler failed';
}
