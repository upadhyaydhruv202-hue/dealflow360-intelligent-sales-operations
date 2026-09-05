import { ValidationError } from '../../../errors';
import type { AuditService } from '../../../audit/audit.service';
import { AI_GUARDRAILS } from '../../../constants';
import { getRequestId } from '../../../utils/request-context';
import type { AppLogger } from '../../../utils/logger';
import { AI_JSON_INSTRUCTION, AI_SAFETY_CLOSING, AI_SAFETY_PREAMBLE, stripSafetyDecorations } from '../prompts/safety';
import type { AiOperation, AiProviderContent, AiProviderGenerateInput } from '../ai.types';
import { AI_AUDIT_ACTIONS, recordAiAudit } from './audit';
import { detectPromptInjection } from './injection';
import { applyStructuredOutputPolicy } from './output';
import { redactSensitiveText } from './redaction';
import type { AiGuardrailsLimits } from './types';

export interface AiGuardrailsOptions extends Partial<AiGuardrailsLimits> {
  audit?: AuditService | null;
  logger?: AppLogger;
  provider?: string;
}

export class AiGuardrails {
  readonly limits: AiGuardrailsLimits;
  private readonly audit: AuditService | null;
  private readonly logger?: AppLogger;
  private readonly provider: string;

  constructor(options: AiGuardrailsOptions = {}) {
    this.limits = {
      maxInputChars: options.maxInputChars ?? AI_GUARDRAILS.MAX_INPUT_CHARS,
      timeoutMs: options.timeoutMs ?? 30_000,
      maxRetries: options.maxRetries ?? 2,
      parseRetries: options.parseRetries ?? 1,
    };
    this.audit = options.audit ?? null;
    this.logger = options.logger;
    this.provider = options.provider ?? 'ai';
  }

  prepareProviderInput(input: AiProviderGenerateInput): AiProviderGenerateInput {
    const contents = input.contents.map((content) => ({
      ...content,
      text: redactSensitiveText(content.text),
    }));
    const system = this.ensureSafetySystem(
      input.system ? redactSensitiveText(input.system) : undefined,
      input.json === true,
    );
    this.assertInputLimits(system, contents);

    const combined = contents.map((item) => item.text).join('\n');
    const injection = detectPromptInjection(combined);
    if (injection.suspicious) {
      this.logger?.info(
        {
          operation: input.operation,
          injectionSignals: injection.signals,
          requestId: getRequestId(),
        },
        'AI prompt-injection signals',
      );
    }

    return {
      ...input,
      system,
      contents,
      metadata: {
        ...input.metadata,
        injectionSignals: injection.signals,
      },
    };
  }

  prepareEmbedText(text: string): string {
    const redacted = redactSensitiveText(text);
    this.assertCharLimit(redacted.length, 'text');
    return redacted;
  }

  applyOutputPolicy<T>(data: T): T {
    return applyStructuredOutputPolicy(data);
  }

  remainingAttempts(attempt: number, extraRetries: number): number {
    return Math.max(0, extraRetries + 1 - attempt);
  }

  async auditGeneration(input: {
    operation: AiOperation;
    status: 'success' | 'failed';
    model: string;
    promptChars: number;
    attempt?: number;
    userId?: string;
  }): Promise<void> {
    try {
      await recordAiAudit(this.audit, {
        action: AI_AUDIT_ACTIONS.generate,
        resource: input.operation,
        status: input.status,
        userId: input.userId,
        request: {
          operation: input.operation,
          provider: this.provider,
          model: input.model,
          promptChars: input.promptChars,
          attempt: input.attempt,
          timeoutMs: this.limits.timeoutMs,
          maxRetries: this.limits.maxRetries,
        },
      });
    } catch (error) {
      this.logger?.warn({ err: error, operation: input.operation }, 'AI generation audit failed');
    }
  }

  async auditDecision(input: {
    operation: AiOperation;
    status: 'success' | 'failed';
    model: string;
    confidence?: number;
    requiresReview?: boolean;
    userId?: string;
  }): Promise<void> {
    try {
      await recordAiAudit(this.audit, {
        action: AI_AUDIT_ACTIONS.decision,
        resource: input.operation,
        status: input.status,
        userId: input.userId,
        request: {
          operation: input.operation,
          provider: this.provider,
          model: input.model,
          confidence: input.confidence,
          requiresReview: input.requiresReview,
        },
      });
    } catch (error) {
      this.logger?.warn({ err: error, operation: input.operation }, 'AI decision audit failed');
    }
  }

  private ensureSafetySystem(system: string | undefined, json: boolean): string {
    const task = stripSafetyDecorations(system);
    const parts = [AI_SAFETY_PREAMBLE];
    if (task) {
      parts.push(task);
    }
    if (json) {
      parts.push(AI_JSON_INSTRUCTION);
    }
    parts.push(AI_SAFETY_CLOSING);
    return parts.join('\n');
  }

  private assertInputLimits(system: string | undefined, contents: AiProviderContent[]): void {
    if ((system?.length ?? 0) > AI_GUARDRAILS.MAX_SYSTEM_CHARS) {
      throw new ValidationError('AI system prompt exceeds the maximum allowed size', [
        {
          path: 'system',
          message: `AI system prompt exceeds the maximum of ${AI_GUARDRAILS.MAX_SYSTEM_CHARS} characters`,
          code: 'too_big',
        },
      ]);
    }

    const chars = contents.reduce((sum, item) => sum + item.text.length, 0);
    this.assertCharLimit(chars, 'prompt');
  }

  private assertCharLimit(chars: number, path: string): void {
    if (chars <= this.limits.maxInputChars) {
      return;
    }

    throw new ValidationError('AI input exceeds the maximum allowed size', [
      {
        path,
        message: `AI input exceeds the maximum of ${this.limits.maxInputChars} characters`,
        code: 'too_big',
      },
    ]);
  }
}

export function createAiGuardrails(options: AiGuardrailsOptions = {}): AiGuardrails {
  return new AiGuardrails(options);
}
