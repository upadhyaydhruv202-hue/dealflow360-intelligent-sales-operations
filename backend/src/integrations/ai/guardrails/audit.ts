import { AI_GUARDRAILS } from '../../../constants';
import type { AuditService } from '../../../audit/audit.service';
import { auditSafeRequest } from './redaction';

export async function recordAiAudit(
  audit: AuditService | null | undefined,
  input: {
    action: string;
    resource?: string;
    status: string;
    request: unknown;
    userId?: string;
    requestId?: string;
  },
): Promise<void> {
  if (!audit) {
    return;
  }

  await audit.record({
    userId: input.userId,
    action: input.action,
    resource: input.resource,
    status: input.status,
    request: auditSafeRequest(input.request),
    requestId: input.requestId,
  });
}

export const AI_AUDIT_ACTIONS = {
  generate: AI_GUARDRAILS.AUDIT_GENERATE,
  decision: AI_GUARDRAILS.AUDIT_DECISION,
  tool: AI_GUARDRAILS.AUDIT_TOOL,
  action: AI_GUARDRAILS.AUDIT_ACTION,
} as const;
