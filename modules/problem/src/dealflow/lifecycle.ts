import { conflict } from './errors';
import type { QuoteStatus } from './types';

const TRANSITIONS: Record<QuoteStatus, readonly QuoteStatus[]> = {
  draft: ['approval_required', 'approved', 'rejected'],
  approval_required: ['approved', 'rejected', 'draft'],
  approved: ['customer_negotiation', 'confirmed', 'approval_required', 'rejected'],
  customer_negotiation: ['confirmed', 'approval_required', 'approved', 'rejected'],
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
  return status === 'draft' || status === 'rejected' || status === 'customer_negotiation';
}

export function isOpenForPlanning(status: QuoteStatus): boolean {
  return (
    status === 'approved' ||
    status === 'customer_negotiation' ||
    status === 'confirmed' ||
    status === 'fulfillment'
  );
}

export function isOpenForBilling(status: QuoteStatus): boolean {
  return isOpenForPlanning(status) || status === 'billing';
}

export function requiresValidApproval(status: QuoteStatus): boolean {
  return status === 'approved' || status === 'customer_negotiation';
}
