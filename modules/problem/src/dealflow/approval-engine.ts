import { conflict, forbidden } from './errors';
import type {
  Actor,
  ApprovalChain,
  ApprovalRoleKey,
  QuoteApproval,
  QuoteAssessment,
} from './types';
import { APPROVAL_PERMISSIONS } from './types';

export function buildApprovalSteps(quoteId: string, chain: ApprovalChain): QuoteApproval[] {
  return chain.steps
    .slice()
    .sort((left, right) => left.stepOrder - right.stepOrder)
    .map((step) => ({
      id: crypto.randomUUID(),
      quoteId,
      chainId: chain.id,
      stepOrder: step.stepOrder,
      roleKey: step.roleKey,
      label: step.label,
      status: 'pending' as const,
    }));
}

export function autoApproveIfAllowed(
  quoteId: string,
  assessment: QuoteAssessment,
  chain: ApprovalChain | undefined,
  actor: Actor,
): QuoteApproval[] {
  if (assessment.decision === 'allowed' || assessment.decision === 'warning') {
    if (!chain) {
      return [];
    }
    return chain.steps.map((step) => ({
      id: crypto.randomUUID(),
      quoteId,
      chainId: chain.id,
      stepOrder: step.stepOrder,
      roleKey: step.roleKey,
      label: step.label,
      status: 'skipped' as const,
      actorId: actor.id,
      decidedAt: new Date().toISOString(),
      decision: 'auto',
      reason: `Assessment ${assessment.decision} does not require the "${chain.name}" chain`,
    }));
  }

  if (!chain) {
    throw conflict('Approval is required but no matching approval chain is configured');
  }

  return buildApprovalSteps(quoteId, chain);
}

export function canActOnRole(actor: Actor, roleKey: ApprovalRoleKey): boolean {
  const permissions = actor.permissions ?? [];
  if (permissions.includes(APPROVAL_PERMISSIONS[roleKey])) {
    return true;
  }
  const roles = new Set([actor.role, ...(actor.roles ?? [])].filter(Boolean));
  if (roles.has('admin')) {
    return true;
  }
  if (roleKey === 'manager' && roles.has('manager')) {
    return true;
  }
  return false;
}

export function applyApprovalDecision(input: {
  approvals: QuoteApproval[];
  approvalId: string;
  actor: Actor;
  decision: 'approved' | 'rejected';
  reason: string;
  previousValues: unknown;
  newValues: unknown;
}): QuoteApproval[] {
  const current = input.approvals.find((item) => item.id === input.approvalId);
  if (!current) {
    throw conflict('Approval step not found');
  }
  if (current.status !== 'pending') {
    throw conflict(`Approval step is ${current.status}`);
  }

  const blocking = input.approvals
    .filter((item) => item.status === 'pending' && item.stepOrder < current.stepOrder)
    .sort((left, right) => left.stepOrder - right.stepOrder)[0];
  if (blocking) {
    throw conflict(`Previous step "${blocking.label}" must be decided first`);
  }

  if (!canActOnRole(input.actor, current.roleKey)) {
    throw forbidden(`This step requires ${current.label}`, { roleKey: current.roleKey });
  }

  return input.approvals.map((item) => {
    if (item.id !== current.id) {
      if (input.decision === 'rejected' && item.status === 'pending') {
        return { ...item, status: 'invalidated' as const };
      }
      return item;
    }
    return {
      ...item,
      status: input.decision,
      actorId: input.actor.id,
      decidedAt: new Date().toISOString(),
      decision: input.decision,
      reason: input.reason,
      previousValues: input.previousValues,
      newValues: input.newValues,
    };
  });
}

export function invalidateApprovals(approvals: QuoteApproval[]): QuoteApproval[] {
  return approvals.map((item) =>
    item.status === 'pending' || item.status === 'approved' || item.status === 'skipped'
      ? { ...item, status: 'invalidated' as const }
      : item,
  );
}

export function allRequiredApproved(approvals: QuoteApproval[]): boolean {
  const required = approvals.filter((item) => item.status !== 'skipped' && item.status !== 'invalidated');
  if (required.length === 0) {
    return approvals.length === 0 || approvals.every((item) => item.status === 'skipped');
  }
  return required.every((item) => item.status === 'approved');
}
