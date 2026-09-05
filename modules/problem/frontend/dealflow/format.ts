import { ApiClientError } from '@/services/api';
import type { BadgeTone } from '@/ui';

import type {
  ApprovalRoleKey,
  ApprovalStatus,
  BillingStatus,
  DiscountDecision,
  QuoteStatus,
  QuoteView,
} from './types';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const moneyExact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export function formatMoney(value: number, exact = false): string {
  return (exact ? moneyExact : money).format(value);
}

export function formatPercent(value: number): string {
  return `${Number(value.toFixed(2))}%`;
}

export function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export function statusTone(status: QuoteStatus): BadgeTone {
  switch (status) {
    case 'approved':
    case 'confirmed':
    case 'completed':
      return 'success';
    case 'approval_required':
    case 'customer_negotiation':
      return 'warning';
    case 'rejected':
      return 'danger';
    case 'fulfillment':
    case 'billing':
      return 'info';
    default:
      return 'neutral';
  }
}

export function statusLabel(status: QuoteStatus): string {
  return status.replaceAll('_', ' ');
}

export function decisionTone(decision: DiscountDecision): BadgeTone {
  switch (decision) {
    case 'allowed':
      return 'success';
    case 'warning':
      return 'warning';
    case 'approval_required':
    case 'rejected':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function approvalTone(status: ApprovalStatus): BadgeTone {
  switch (status) {
    case 'approved':
      return 'success';
    case 'pending':
      return 'warning';
    case 'rejected':
      return 'danger';
    case 'invalidated':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function billingTone(status: BillingStatus): BadgeTone {
  if (status === 'invoiced') return 'success';
  if (status === 'cancelled') return 'neutral';
  return 'info';
}

export function riskLabel(quote: Pick<QuoteView, 'riskScore' | 'assessmentDecision'>): string {
  if (quote.assessmentDecision === 'rejected') return 'Rejected';
  if (quote.assessmentDecision === 'approval_required' || quote.riskScore >= 70) return 'High risk';
  if (quote.assessmentDecision === 'warning' || quote.riskScore >= 40) return 'Elevated';
  return 'Within policy';
}

export function roleLabel(role: ApprovalRoleKey): string {
  if (role === 'manager') return 'Sales Manager';
  if (role === 'finance') return 'Finance';
  return 'Final approval';
}

export function ownerLabel(ownerId: string | null | undefined, currentUserId?: string, currentName?: string): string {
  if (!ownerId) return 'Unassigned';
  if (currentUserId && ownerId === currentUserId) return currentName || 'You';
  return `AE ${ownerId.slice(0, 8)}`;
}

export const OPEN_STATUSES: QuoteStatus[] = [
  'draft',
  'approval_required',
  'approved',
  'customer_negotiation',
];

export function canEditLines(status: QuoteStatus): boolean {
  return status === 'draft' || status === 'rejected' || status === 'customer_negotiation';
}

export function canApplyRecommendation(status: QuoteStatus): boolean {
  return canEditLines(status) || status === 'approved';
}

export function canSubmit(status: QuoteStatus): boolean {
  return status === 'draft' || status === 'rejected';
}

export function canDecide(status: QuoteStatus): boolean {
  return status === 'approval_required';
}

export function canNegotiate(status: QuoteStatus): boolean {
  return status === 'approved';
}

export function canConfirm(status: QuoteStatus): boolean {
  return status === 'approved' || status === 'customer_negotiation';
}

export function canPlan(status: QuoteStatus): boolean {
  return status === 'approved' || status === 'customer_negotiation' || status === 'confirmed' || status === 'fulfillment';
}

export function canBill(status: QuoteStatus): boolean {
  return canPlan(status) || status === 'billing';
}

export function availableUnits(
  stock: Array<{ warehouseId: string; productId: string; quantityOnHand: number; reserved: number; incoming?: number }> | undefined,
  warehouseId: string,
  productId: string,
): number {
  const row = stock?.find((item) => item.warehouseId === warehouseId && item.productId === productId);
  if (!row) return 0;
  return Math.max(0, Number(row.quantityOnHand || 0) - Number(row.reserved || 0));
}

export function incomingUnits(
  stock: Array<{ warehouseId: string; productId: string; incoming?: number }> | undefined,
  warehouseId: string,
  productId: string,
): number {
  const row = stock?.find((item) => item.warehouseId === warehouseId && item.productId === productId);
  return Math.max(0, Number(row?.incoming || 0));
}

export function isStaleQuoteConflict(error: unknown): boolean {
  return error instanceof ApiClientError && error.statusCode === 409 && /another user/i.test(error.message);
}

export function workspaceToast(kind: string): string {
  switch (kind) {
    case 'submit':
      return 'Quote submitted for approval';
    case 'approve':
      return 'Approval completed';
    case 'reject':
      return 'Quote returned for revision';
    case 'plan':
      return 'Fulfillment plan created';
    case 'bill':
      return 'Billing generated';
    case 'confirm':
      return 'Quote confirmed';
    case 'negotiate':
      return 'Customer negotiation opened';
    case 'recommend':
      return 'Recommendation added to the quote';
    case 'assess':
      return 'Risk assessment refreshed';
    case 'line':
      return 'Quote lines updated';
    case 'vendor':
      return 'Vendor contact recorded';
    default:
      return 'Quote updated';
  }
}
