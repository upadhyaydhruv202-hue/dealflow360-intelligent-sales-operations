import { apiGet, apiRequest } from '@/services/api';

import type {
  AuditEvent,
  DealflowCatalog,
  QuoteView,
  Recommendation,
} from './types';

const ROOT = '/api/v1/dealflow';

export function getDealflowManifest() {
  return apiGet<{ id: string; title: string; replaceable: boolean; jobName: string }>('/api/v1/problem');
}

export function getDealflowCatalog(token: string) {
  return apiGet<DealflowCatalog>(`${ROOT}/catalog`, token);
}

export function listQuotes(token: string) {
  return apiGet<QuoteView[]>(`${ROOT}/quotes`, token);
}

export function getQuote(id: string, token: string) {
  return apiGet<QuoteView>(`${ROOT}/quotes/${id}`, token);
}

export function createQuote(input: { customerId: string; lines?: Array<{ productId: string; quantity: number; discountPercent: number }> }, token: string) {
  return apiRequest<QuoteView>(`${ROOT}/quotes`, { method: 'POST', body: input, token });
}

export function addQuoteLine(quoteId: string, input: { productId: string; quantity: number; discountPercent: number }, token: string) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/lines`, { method: 'POST', body: input, token });
}

export function updateQuoteLine(
  quoteId: string,
  lineId: string,
  input: { productId?: string; quantity?: number; discountPercent?: number },
  token: string,
) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/lines/${lineId}`, { method: 'PATCH', body: input, token });
}

export function removeQuoteLine(quoteId: string, lineId: string, token: string) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/lines/${lineId}`, { method: 'DELETE', token });
}

export function assessQuote(quoteId: string, token: string) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/assess`, { method: 'POST', token });
}

export function submitQuote(quoteId: string, token: string) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/submit`, { method: 'POST', token });
}

export function decideApproval(
  quoteId: string,
  approvalId: string,
  input: { decision: 'approved' | 'rejected'; reason: string },
  token: string,
) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/approvals/${approvalId}/decide`, {
    method: 'POST',
    body: input,
    token,
  });
}

export function startNegotiation(quoteId: string, token: string) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/negotiate`, { method: 'POST', token });
}

export function getRecommendations(quoteId: string, token: string) {
  return apiGet<Recommendation[]>(`${ROOT}/quotes/${quoteId}/recommendations`, token);
}

export function applyRecommendation(quoteId: string, relationId: string, token: string) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/recommendations`, {
    method: 'POST',
    body: { relationId },
    token,
  });
}

export function planFulfillment(
  quoteId: string,
  token: string,
  overrides?: Array<{ quoteLineId: string; warehouseId: string; quantity: number }>,
) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/fulfillment/plan`, {
    method: 'POST',
    body: { overrides },
    token,
  });
}

export function generateBilling(quoteId: string, token: string) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/billing/generate`, { method: 'POST', token });
}

export function cancelBilling(quoteId: string, scheduleId: string, token: string) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/billing/${scheduleId}/cancel`, { method: 'POST', token });
}

export function confirmQuote(quoteId: string, token: string) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/confirm`, { method: 'POST', token });
}

export function getPortalQuote(token: string) {
  return apiGet<QuoteView>(`${ROOT}/portal/${encodeURIComponent(token)}`);
}

export function applyPortalChange(
  token: string,
  lines: Array<{ lineId: string; quantity?: number; discountPercent?: number }>,
) {
  return apiRequest<QuoteView>(`${ROOT}/portal/${encodeURIComponent(token)}`, {
    method: 'PATCH',
    body: { lines },
  });
}

export async function listQuoteAudit(quoteId: string, token: string): Promise<AuditEvent[]> {
  const result = await apiGet<{ items: AuditEvent[] }>(
    `/api/v1/audit?resource=quote&resourceId=${encodeURIComponent(quoteId)}&limit=50`,
    token,
  );
  return result.items ?? [];
}
