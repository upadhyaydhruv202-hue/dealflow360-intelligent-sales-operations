import { conflict } from './errors';
import type { QuoteStatus } from './types';

const TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]> = {
  draft: ['customer_negotiation', 'manager_review', 'approval_required', 'approved', 'rejected'],
  approval_required: ['approved', 'rejected', 'draft'],
  approved: ['confirmed', 'approval_required', 'rejected'],
  customer_negotiation: ['manager_review', 'finalized', 'approval_required', 'rejected', 'draft'],
  manager_review: ['customer_negotiation', 'finalized', 'rejected'],
  finalized: ['approval_required', 'approved', 'rejected'],
  confirmed: ['fulfillment', 'billing', 'completed'],
  fulfillment: ['billing', 'completed'],
  billing: ['completed'],
  completed: [],
  rejected: ['draft'],
};

export function assertTransition(from: QuoteStatus, to: QuoteStatus): void {
  if (from === to) {
    return;
  }
  if (!TRANSITIONS[from].includes(to)) {
    throw conflict(`Cannot move quote from ${from} to ${to}`, { from, to });
  }
}

export function canMutateCommercials(status: QuoteStatus): boolean {
  return status === 'draft' || status === 'rejected' || status === 'customer_negotiation' || status === 'manager_review';
}

export function isOpenForPlanning(status: QuoteStatus): boolean {
  return status === 'confirmed' || status === 'fulfillment';
}

export function isOpenForBilling(status: QuoteStatus): boolean {
  return isOpenForPlanning(status) || status === 'billing';
}

export function requiresValidApproval(status: QuoteStatus): boolean {
  return status === 'approved' || status === 'finalized' || status === 'approval_required';
}

export function isCommerciallyLocked(status: QuoteStatus, financeLockedAt?: string | null): boolean {
  return Boolean(financeLockedAt) || status === 'confirmed' || status === 'fulfillment' || status === 'billing' || status === 'completed';
}

export function canDeleteQuote(status: QuoteStatus): boolean {
  return status === 'draft' || status === 'rejected';
}

export function canVoidQuote(status: QuoteStatus): boolean {
  return (
    status === 'customer_negotiation' ||
    status === 'manager_review' ||
    status === 'approval_required' ||
    status === 'approved' ||
    status === 'finalized'
  );
}
