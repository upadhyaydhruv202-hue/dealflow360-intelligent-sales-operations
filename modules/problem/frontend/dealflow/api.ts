import { apiGet, apiRequest } from '@/services/api';

import type {
  ApprovalChain,
  AuditEvent,
  Customer,
  CustomerQuote,
  DealflowCatalog,
  DiscountPolicy,
  GovernanceSettings,
  NegotiationRequest,
  Product,
  ProductRelation,
  QuantityBreak,
  QuoteView,
  Recommendation,
  RoleAuthority,
  StockLevel,
  Warehouse,
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

export function listMyQuotes(token: string) {
  return apiGet<CustomerQuote[]>(`${ROOT}/me/quotes`, token);
}

export function getQuote(id: string, token: string) {
  return apiGet<QuoteView>(`${ROOT}/quotes/${id}`, token);
}

export function createQuote(input: { customerId: string; lines?: Array<{ productId: string; quantity: number; discountPercent: number }> }, token: string) {
  return apiRequest<QuoteView>(`${ROOT}/quotes`, { method: 'POST', body: input, token });
}

export function addQuoteLine(
  quoteId: string,
  input: { productId: string; quantity: number; discountPercent: number; expectedVersion: number },
  token: string,
) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/lines`, { method: 'POST', body: input, token });
}

export function updateQuoteLine(
  quoteId: string,
  lineId: string,
  input: { productId?: string; quantity?: number; discountPercent?: number; unitPrice?: number; expectedVersion: number },
  token: string,
) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/lines/${lineId}`, { method: 'PATCH', body: input, token });
}

export function removeQuoteLine(quoteId: string, lineId: string, expectedVersion: number, token: string) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/lines/${lineId}`, {
    method: 'DELETE',
    body: { expectedVersion },
    token,
  });
}

export function replaceQuantityBreaks(items: QuantityBreak[], token: string) {
  return apiRequest<QuantityBreak[]>(`${ROOT}/catalog/quantity-breaks`, { method: 'PUT', body: { items }, token });
}

export function replaceRoleAuthorities(items: RoleAuthority[], token: string) {
  return apiRequest<RoleAuthority[]>(`${ROOT}/catalog/role-authorities`, { method: 'PUT', body: { items }, token });
}

export function updateGovernance(input: Partial<GovernanceSettings>, token: string) {
  return apiRequest<GovernanceSettings>(`${ROOT}/catalog/governance`, { method: 'PATCH', body: input, token });
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

export function listNegotiations(quoteId: string, token: string) {
  return apiGet<NegotiationRequest[]>(`${ROOT}/quotes/${quoteId}/negotiations`, token);
}

export function createNegotiation(
  quoteId: string,
  input: {
    expectedVersion?: number;
    note: string;
    requestedDiscountPercent?: number | null;
    requestedTargetAmount?: number | null;
    requestedLines?: NegotiationRequest['requestedLines'];
  },
  token: string,
) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/negotiations`, { method: 'POST', body: input, token });
}

export function respondToNegotiation(
  quoteId: string,
  negotiationId: string,
  input: { expectedVersion: number; decision: 'accepted' | 'rejected' | 'in_review'; responseNote: string },
  token: string,
) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/negotiations/${negotiationId}/respond`, {
    method: 'POST',
    body: input,
    token,
  });
}

export function sendToManager(quoteId: string, expectedVersion: number, token: string, negotiationId?: string) {
  const path = negotiationId
    ? `${ROOT}/quotes/${quoteId}/negotiations/${negotiationId}/send-to-manager`
    : `${ROOT}/quotes/${quoteId}/send-to-manager`;
  return apiRequest<QuoteView>(path, { method: 'POST', body: { expectedVersion }, token });
}

export function reviseAsManager(
  quoteId: string,
  input: { expectedVersion: number; lines?: Array<{ lineId: string; quantity?: number; discountPercent?: number }> },
  token: string,
) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/revise`, { method: 'POST', body: input, token });
}

export function returnRevisedQuote(quoteId: string, expectedVersion: number, token: string, negotiationId?: string) {
  const path = negotiationId
    ? `${ROOT}/quotes/${quoteId}/negotiations/${negotiationId}/return`
    : `${ROOT}/quotes/${quoteId}/return`;
  return apiRequest<QuoteView>(path, { method: 'POST', body: { expectedVersion }, token });
}

export function finalizeQuote(quoteId: string, token: string, expectedVersion: number) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/finalize`, { method: 'POST', body: { expectedVersion }, token });
}

export function lockQuote(quoteId: string, token: string, expectedVersion: number) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/lock`, { method: 'POST', body: { expectedVersion }, token });
}

export function agreeToFinal(quoteId: string, token: string, expectedVersion: number) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/agree`, { method: 'POST', body: { expectedVersion }, token });
}

export function upsertProduct(
  input: Partial<Product> & {
    sku: string;
    name: string;
    category: string;
    listPrice: number;
    cost: number;
    billingType: Product['billingType'];
    stock?: Array<{ warehouseId: string; quantityOnHand: number; incoming?: number }>;
    quantityBreaks?: Array<{
      name: string;
      minQuantity: number;
      maxQuantity?: number | null;
      adjustmentKind: 'fixed' | 'percent';
      adjustmentValue: number;
      customerTier?: string | null;
      active?: boolean;
    }>;
  },
  token: string,
) {
  return apiRequest<Product>(`${ROOT}/catalog/products`, { method: input.id ? 'PATCH' : 'POST', body: input, token });
}

export async function listProductAudit(productId: string, token: string): Promise<AuditEvent[]> {
  const result = await apiGet<{ items: AuditEvent[] }>(
    `/api/v1/audit?resource=catalog&resourceId=${encodeURIComponent(productId)}&limit=50`,
    token,
  );
  return result.items ?? [];
}

export function upsertStock(input: StockLevel, token: string) {
  return apiRequest<StockLevel[]>(`${ROOT}/catalog/stock`, { method: 'PUT', body: input, token });
}

export function upsertPolicy(input: Omit<DiscountPolicy, 'id'> & { id?: string }, token: string) {
  return apiRequest<DiscountPolicy>(`${ROOT}/catalog/policies`, { method: input.id ? 'PATCH' : 'POST', body: input, token });
}

export function upsertChain(input: ApprovalChain, token: string) {
  return apiRequest<ApprovalChain>(`${ROOT}/catalog/chains`, { method: input.id ? 'PATCH' : 'POST', body: input, token });
}

export function getRecommendations(quoteId: string, token: string) {
  return apiGet<Recommendation[]>(`${ROOT}/quotes/${quoteId}/recommendations`, token);
}

export function applyRecommendation(quoteId: string, relationId: string, token: string, expectedVersion: number) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/recommendations`, {
    method: 'POST',
    body: { relationId, expectedVersion },
    token,
  });
}

export function listAnomalies(token: string) {
  return apiGet<
    Array<{
      id: string;
      type: string;
      severity: string;
      entityType: string;
      entityId: string;
      quoteId?: string | null;
      description: string;
      status: string;
      resolution?: string | null;
      detectedAt: string;
    }>
  >(`${ROOT}/anomalies`, token);
}

export function disposeAnomaly(
  id: string,
  input: { status: 'open' | 'acknowledged' | 'resolved' | 'dismissed'; resolution?: string },
  token: string,
) {
  return apiRequest<(Awaited<ReturnType<typeof listAnomalies>>)[number]>(`${ROOT}/anomalies/${id}/disposition`, {
    method: 'POST',
    body: input,
    token,
  });
}

export function decidePortalQuote(
  token: string,
  input: { expectedVersion: number; action: 'accepted' | 'declined'; comment?: string },
) {
  return apiRequest<QuoteView>(`${ROOT}/portal/${encodeURIComponent(token)}/decision`, {
    method: 'POST',
    body: input,
  });
}

export function customerQuotePdfHref(quoteId: string) {
  return `${ROOT}/quotes/${quoteId}/pdf`;
}

export async function downloadCustomerQuotePdf(quoteId: string, token: string) {
  const response = await fetch(customerQuotePdfHref(quoteId), {
    headers: { Accept: 'application/pdf', Authorization: `Bearer ${token}` },
    credentials: 'include',
  });
  if (!response.ok) {
    throw new Error('The quotation PDF could not be downloaded');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `quotation-${quoteId}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}

export function portalQuotePdfHref(token: string) {
  return `${ROOT}/portal/${encodeURIComponent(token)}/pdf`;
}

export function planFulfillment(
  quoteId: string,
  token: string,
  expectedVersion: number,
  overrides?: Array<{ quoteLineId: string; warehouseId: string; quantity: number }>,
) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/fulfillment/plan`, {
    method: 'POST',
    body: { expectedVersion, overrides },
    token,
  });
}

export function generateBilling(quoteId: string, token: string, expectedVersion: number) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/billing/generate`, {
    method: 'POST',
    body: { expectedVersion },
    token,
  });
}

export function cancelBilling(quoteId: string, scheduleId: string, token: string, expectedVersion: number) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/billing/${scheduleId}/cancel`, {
    method: 'POST',
    body: { expectedVersion },
    token,
  });
}

export function confirmQuote(quoteId: string, token: string, expectedVersion: number) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/confirm`, {
    method: 'POST',
    body: { expectedVersion },
    token,
  });
}

export function completeQuote(quoteId: string, token: string, expectedVersion: number) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/complete`, {
    method: 'POST',
    body: { expectedVersion },
    token,
  });
}

export function deleteQuote(quoteId: string, token: string, expectedVersion: number) {
  return apiRequest<{ id: string; deleted: true }>(`${ROOT}/quotes/${quoteId}`, {
    method: 'DELETE',
    body: { expectedVersion },
    token,
  });
}

export function voidQuote(quoteId: string, token: string, expectedVersion: number) {
  return apiRequest<QuoteView>(`${ROOT}/quotes/${quoteId}/void`, {
    method: 'POST',
    body: { expectedVersion },
    token,
  });
}

export function deleteProduct(id: string, token: string) {
  return apiRequest<{ id: string; deleted: true }>(`${ROOT}/catalog/products/${id}`, { method: 'DELETE', token });
}

export function deletePolicy(id: string, token: string) {
  return apiRequest<{ id: string; deleted: true }>(`${ROOT}/catalog/policies/${id}`, { method: 'DELETE', token });
}

export function deleteChain(id: string, token: string) {
  return apiRequest<{ id: string; deleted: true }>(`${ROOT}/catalog/chains/${id}`, { method: 'DELETE', token });
}

export function deleteWarehouse(id: string, token: string) {
  return apiRequest<{ id: string; deleted: true }>(`${ROOT}/catalog/warehouses/${id}`, { method: 'DELETE', token });
}

export function upsertCustomer(input: { id?: string; name: string; email: string; tier?: Customer['tier'] }, token: string) {
  return apiRequest<Customer>(`${ROOT}/catalog/customers`, { method: input.id ? 'PATCH' : 'POST', body: input, token });
}

export function deleteCustomer(id: string, token: string) {
  return apiRequest<{ id: string; deleted: true }>(`${ROOT}/catalog/customers/${id}`, { method: 'DELETE', token });
}

export function upsertWarehouse(input: { id?: string; name: string; fulfillmentCostPerUnit: number }, token: string) {
  return apiRequest<Warehouse>(`${ROOT}/catalog/warehouses`, { method: input.id ? 'PATCH' : 'POST', body: input, token });
}

export function deleteStock(warehouseId: string, productId: string, token: string) {
  return apiRequest<StockLevel[]>(`${ROOT}/catalog/stock/${warehouseId}/${productId}`, { method: 'DELETE', token });
}

export function upsertRelation(input: Omit<ProductRelation, 'id'> & { id?: string }, token: string) {
  return apiRequest<ProductRelation>(`${ROOT}/catalog/relations`, { method: input.id ? 'PATCH' : 'POST', body: input, token });
}

export function deleteRelation(id: string, token: string) {
  return apiRequest<{ id: string; deleted: true }>(`${ROOT}/catalog/relations/${id}`, { method: 'DELETE', token });
}

export function contactVendor(quoteId: string, input: { productId?: string; message: string }, token: string) {
  return apiRequest<{ recorded: true; delivered: false; channel: 'audit'; quoteId: string }>(`${ROOT}/quotes/${quoteId}/vendor-contact`, {
    method: 'POST',
    body: input,
    token,
  });
}

export function getPortalQuote(token: string) {
  return apiGet<QuoteView>(`${ROOT}/portal/${encodeURIComponent(token)}`);
}

export function applyPortalChange(
  token: string,
  lines: Array<{ lineId: string; quantity?: number; discountPercent?: number }>,
  expectedVersion: number,
) {
  return apiRequest<QuoteView>(`${ROOT}/portal/${encodeURIComponent(token)}`, {
    method: 'PATCH',
    body: { expectedVersion, lines },
  });
}

export function createPortalNegotiation(
  token: string,
  input: {
    expectedVersion: number;
    note: string;
    requestedDiscountPercent?: number | null;
    requestedTargetAmount?: number | null;
    requestedLines?: NegotiationRequest['requestedLines'];
  },
) {
  return apiRequest<QuoteView>(`${ROOT}/portal/${encodeURIComponent(token)}/negotiations`, {
    method: 'POST',
    body: input,
  });
}

export function agreePortalQuote(token: string, expectedVersion: number) {
  return apiRequest<QuoteView>(`${ROOT}/portal/${encodeURIComponent(token)}/agree`, {
    method: 'POST',
    body: { expectedVersion },
  });
}

export async function listQuoteAudit(quoteId: string, token: string): Promise<AuditEvent[]> {
  const result = await apiGet<{ items: AuditEvent[] }>(
    `/api/v1/audit?resource=quote&resourceId=${encodeURIComponent(quoteId)}&limit=50`,
    token,
  );
  return result.items ?? [];
}
