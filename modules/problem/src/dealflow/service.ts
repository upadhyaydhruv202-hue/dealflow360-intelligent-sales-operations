import {
  allRequiredApproved,
  applyApprovalDecision,
  autoApproveIfAllowed,
  buildApprovalSteps,
  invalidateApprovals,
} from './approval-engine';
import { buildBillingSchedules, cancelSchedule, hybridCommercials } from './billing-engine';
import { assessQuote, isMaterialChange, selectRoleAuthority } from './discount-engine';
import { conflict, forbidden, invalid, notFound } from './errors';
import { validateGovernance, validateQuantityBreaks, validateRoleAuthorities } from './governance-config';
import { consumeStockOnConfirm, planFulfillment, reserveStock } from './fulfillment-engine';
import {
  actorDiscountCeiling,
  actorDiscountRoles,
  assertDiscountWithinAuthority,
  assertPriceOverrideWithinAuthority,
  loyaltyBonusPercent,
  persistCustomerTier,
  wonPurchaseCountToTier,
} from './loyalty';
import { resolveUnitPrice } from './pricing-engine';
import { assertTransition, canDeleteQuote, canMutateCommercials, canVoidQuote, isCommerciallyLocked, isOpenForBilling, isOpenForPlanning } from './lifecycle';
import { detectQuoteAnomalies } from './anomaly-engine';
import { computeDealHealth } from './health-engine';
import { toPortalView } from './portal-view';
import {
  assertCustomerSafePayload,
  buildCustomerQuoteDocument,
  customerQuoteEmailKey,
  customerQuoteEmailStamp,
  emailFilename,
  newQuoteEmailDelivery,
  renderCustomerQuoteEmail,
} from './customer-email';
import { renderCustomerQuotePdf } from './quote-pdf';
import { recommendProducts } from './recommendation-engine';
import { emptyAggregate, type DealflowStore } from './store';
import { computeTaxTotal } from './tax-engine';
import type {
  Actor,
  AnomalyStatus,
  ApprovalChain,
  Customer,
  CustomerDecision,
  DealflowAnomaly,
  DiscountPolicy,
  GovernanceConfig,
  NegotiationRequest,
  NegotiationRequestedLine,
  Product,
  QuantityBreak,
  Quote,
  QuoteAggregate,
  QuoteAssessment,
  QuoteEmailDelivery,
  QuoteEmailEvent,
  QuoteLine,
  Recommendation,
  RoleAuthority,
  StockLevel,
  Warehouse,
} from './types';
import { DEFAULT_GOVERNANCE } from './types';

export interface DealflowAudit {
  record: (input: {
    actorId?: string;
    action: string;
    resource?: string;
    resourceId?: string;
    metadata?: unknown;
    oldValue?: unknown;
    newValue?: unknown;
    status?: string;
  }) => Promise<void>;
}

export interface DealflowService {
  catalog(): Promise<{
    customers: Awaited<ReturnType<DealflowStore['listCustomers']>>;
    products: Awaited<ReturnType<DealflowStore['listProducts']>>;
    warehouses: Awaited<ReturnType<DealflowStore['listWarehouses']>>;
    stock: Awaited<ReturnType<DealflowStore['listStock']>>;
    policies: Awaited<ReturnType<DealflowStore['listPolicies']>>;
    chains: Awaited<ReturnType<DealflowStore['listChains']>>;
    relations: Awaited<ReturnType<DealflowStore['listRelations']>>;
    quantityBreaks: QuantityBreak[];
    roleAuthorities: RoleAuthority[];
    governance: GovernanceConfig;
  }>;
  replaceQuantityBreaks(items: QuantityBreak[], actor: Actor): Promise<QuantityBreak[]>;
  replaceRoleAuthorities(items: RoleAuthority[], actor: Actor): Promise<RoleAuthority[]>;
  updateGovernance(input: Partial<GovernanceConfig>, actor: Actor): Promise<GovernanceConfig>;
  upsertProduct(
    input: Partial<Product> & {
      sku?: string;
      name?: string;
      category?: string;
      listPrice?: number;
      cost?: number;
      billingType?: Product['billingType'];
      stock?: Array<{ warehouseId: string; quantityOnHand: number; incoming?: number }>;
      quantityBreaks?: Array<Omit<QuantityBreak, 'id' | 'productId'> & { id?: string; productId?: string }>;
    },
    actor: Actor,
  ): Promise<Product>;
  deleteProduct(id: string, actor: Actor): Promise<{ id: string; deleted: true }>;
  upsertCustomer(input: { id?: string; name: string; email: string; tier?: Customer['tier'] }, actor: Actor): Promise<Customer>;
  deleteCustomer(id: string, actor: Actor): Promise<{ id: string; deleted: true }>;
  upsertStock(input: StockLevel, actor: Actor): Promise<StockLevel[]>;
  deleteStock(warehouseId: string, productId: string, actor: Actor): Promise<StockLevel[]>;
  upsertPolicy(input: Partial<DiscountPolicy> & { name: string; warningPercent: number; approvalPercent: number; rejectPercent: number; maxMarginImpactPercent: number; priority: number }, actor: Actor): Promise<DiscountPolicy>;
  deletePolicy(id: string, actor: Actor): Promise<{ id: string; deleted: true }>;
  upsertChain(input: Partial<ApprovalChain> & { name: string; minRiskScore: number; minBlendedDiscountPercent: number; priority: number; steps: ApprovalChain['steps'] }, actor: Actor): Promise<ApprovalChain>;
  deleteChain(id: string, actor: Actor): Promise<{ id: string; deleted: true }>;
  upsertWarehouse(input: { id?: string; name: string; fulfillmentCostPerUnit: number }, actor: Actor): Promise<Warehouse>;
  deleteWarehouse(id: string, actor: Actor): Promise<{ id: string; deleted: true }>;
  upsertRelation(
    input: { id?: string; productId: string; recommendedProductId: string; kind: 'upsell' | 'cross_sell'; reason: string; promotion?: string | null; minQuantity?: number },
    actor: Actor,
  ): Promise<Awaited<ReturnType<DealflowStore['listRelations']>>[number]>;
  deleteRelation(id: string, actor: Actor): Promise<{ id: string; deleted: true }>;
  contactVendor(
    quoteId: string,
    input: { productId?: string; message: string },
    actor: Actor,
  ): Promise<{ recorded: true; delivered: false; channel: 'audit'; quoteId: string }>;
  listQuotes(): Promise<unknown[]>;
  listMyQuotes(actor: Actor): Promise<unknown[]>;
  provisionCustomer(input: { email: string; displayName: string; companyName?: string }): Promise<unknown>;
  getQuote(id: string, actor?: Actor): Promise<unknown>;
  getQuoteByToken(token: string): Promise<unknown>;
  createQuote(input: { customerId: string; ownerId?: string; lines?: LineInput[] }, actor: Actor): Promise<unknown>;
  deleteQuote(quoteId: string, actor: Actor, expectedVersion: number): Promise<{ id: string; deleted: true }>;
  voidQuote(quoteId: string, actor: Actor, expectedVersion: number): Promise<unknown>;
  addLine(quoteId: string, input: LineInput & { expectedVersion: number }, actor: Actor): Promise<unknown>;
  updateLine(
    quoteId: string,
    lineId: string,
    input: Partial<LineInput> & { expectedVersion: number; unitPrice?: number },
    actor: Actor,
  ): Promise<unknown>;
  removeLine(quoteId: string, lineId: string, input: { expectedVersion: number }, actor: Actor): Promise<unknown>;
  assess(quoteId: string, actor?: Actor): Promise<unknown>;
  submit(quoteId: string, actor: Actor): Promise<unknown>;
  decide(quoteId: string, approvalId: string, input: { decision: 'approved' | 'rejected'; reason: string }, actor: Actor): Promise<unknown>;
  startNegotiation(quoteId: string, actor: Actor): Promise<unknown>;
  createNegotiationRequest(
    quoteId: string,
    input: {
      expectedVersion?: number;
      note: string;
      requestedDiscountPercent?: number | null;
      requestedTargetAmount?: number | null;
      requestedLines?: NegotiationRequestedLine[];
      actorId?: string | null;
      actorRole?: string | null;
    },
    actor?: Actor,
  ): Promise<unknown>;
  listNegotiationRequests(quoteId: string, actor?: Actor): Promise<NegotiationRequest[]>;
  respondToNegotiation(
    quoteId: string,
    negotiationId: string,
    input: { expectedVersion: number; decision: 'accepted' | 'rejected' | 'in_review'; responseNote: string },
    actor: Actor,
  ): Promise<unknown>;
  sendNegotiationToManager(quoteId: string, negotiationId: string | undefined, actor: Actor, expectedVersion: number): Promise<unknown>;
  reviseAsManager(
    quoteId: string,
    input: { expectedVersion: number; lines?: Array<{ lineId: string; quantity?: number; discountPercent?: number; productId?: string }> },
    actor: Actor,
  ): Promise<unknown>;
  returnRevisedQuote(quoteId: string, negotiationId: string | undefined, actor: Actor, expectedVersion: number): Promise<unknown>;
  agreeToFinal(quoteId: string, input: { expectedVersion: number }, actor?: Actor): Promise<unknown>;
  finalizeQuotation(quoteId: string, actor: Actor, expectedVersion: number): Promise<unknown>;
  lockDeal(quoteId: string, actor: Actor, expectedVersion: number): Promise<unknown>;
  applyPortalChange(token: string, input: { expectedVersion: number; lines: Array<{ lineId: string; quantity?: number; discountPercent?: number }> }): Promise<unknown>;
  createPortalNegotiation(
    token: string,
    input: {
      expectedVersion: number;
      note: string;
      requestedDiscountPercent?: number | null;
      requestedTargetAmount?: number | null;
      requestedLines?: NegotiationRequestedLine[];
    },
  ): Promise<unknown>;
  recommendations(quoteId: string): Promise<Recommendation[]>;
  applyRecommendation(quoteId: string, relationId: string, actor: Actor, expectedVersion: number): Promise<unknown>;
  applyPortalDecision(
    token: string,
    input: { expectedVersion: number; action: CustomerDecision; comment?: string },
  ): Promise<unknown>;
  listAnomalies(): Promise<DealflowAnomaly[]>;
  disposeAnomaly(id: string, input: { status: AnomalyStatus; resolution?: string }, actor: Actor): Promise<DealflowAnomaly>;
  customerQuotePdf(quoteId: string, actor?: Actor): Promise<Buffer>;
  customerQuotePdfByToken(token: string): Promise<Buffer>;
  planFulfillment(
    quoteId: string,
    overrides: Array<{ quoteLineId: string; warehouseId: string; quantity: number }> | undefined,
    actor: Actor,
    expectedVersion: number,
  ): Promise<unknown>;
  generateBilling(quoteId: string, actor: Actor, expectedVersion: number): Promise<unknown>;
  cancelBilling(quoteId: string, scheduleId: string, actor: Actor, expectedVersion: number): Promise<unknown>;
  confirm(quoteId: string, actor: Actor, expectedVersion: number): Promise<unknown>;
  complete(quoteId: string, actor: Actor, expectedVersion: number): Promise<unknown>;
}

interface LineInput {
  productId: string;
  quantity: number;
  discountPercent: number;
}

export interface DealflowNotify {
  notify: (input: {
    userId: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    title: string;
    body: string;
  }) => Promise<unknown>;
}

export interface DealflowCustomerEmailSender {
  (input: {
    to: string;
    subject: string;
    text: string;
    html?: string;
    attachments?: Array<{ filename: string; contentBase64: string; contentType: string }>;
    idempotencyKey: string;
    quoteId: string;
    eventType: string;
    data?: Record<string, unknown>;
  }): Promise<{
    status: 'sent' | 'not_configured' | 'failed' | 'skipped';
    provider?: string;
    providerMessageId?: string;
    notificationDeliveryId?: string;
    error?: string;
  }>;
}

export function createDealflowService(options: {
  store: DealflowStore;
  audit?: DealflowAudit | null;
  config?: GovernanceConfig;
  notify?: DealflowNotify['notify'] | null;
  sendCustomerEmail?: DealflowCustomerEmailSender | null;
  publish?: ((event: { type: string; quoteId?: string; payload?: Record<string, unknown> }) => Promise<void>) | null;
  odoo?: {
    enabled: boolean;
    createSaleOrder?: (input: { quoteNumber: string; customerName: string; netTotal: number }) => Promise<number>;
  } | null;
}): DealflowService {
  const store = options.store;

  const governanceOf = async () => options.config ?? (await store.getGovernance());
  const pricingRulesOf = async () => ({
    quantityBreaks: await store.listQuantityBreaks(),
    roleAuthorities: await store.listRoleAuthorities(),
    config: await governanceOf(),
  });

  const assertExpectedVersion = (aggregate: QuoteAggregate, expectedVersion: number) => {
    if (aggregate.quote.version !== expectedVersion) {
      throw conflict('Quotation updated by another user.', {
        currentVersion: aggregate.quote.version,
        expectedVersion,
      });
    }
  };

  const bumpVersion = (aggregate: QuoteAggregate) => {
    aggregate.quote.version += 1;
  };

  const audit = async (
    actor: Actor | undefined,
    action: string,
    resourceId: string,
    extra: { oldValue?: unknown; newValue?: unknown; metadata?: unknown; status?: string; resource?: string } = {},
  ) => {
    await options.audit?.record({
      actorId: actor?.id,
      action,
      resource: extra.resource ?? 'quote',
      resourceId,
      status: extra.status ?? 'success',
      oldValue: extra.oldValue,
      newValue: extra.newValue,
      metadata: extra.metadata,
    });
  };

  const load = async (id: string): Promise<QuoteAggregate> => {
    const found = await store.getQuote(id);
    if (!found) {
      throw notFound('Quote not found', { id });
    }
    return found;
  };

  const notify = async (userId: string | null | undefined, title: string, body: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    if (!userId || !options.notify) return;
    await options.notify({ userId, title, body, type }).catch(() => undefined);
  };

  const refreshAssessment = async (aggregate: QuoteAggregate, _actor?: Actor): Promise<QuoteAssessment> => {
    const [policies, chains, catalogProducts, stock, warehouses, rules] = await Promise.all([
      store.listPolicies(),
      store.listChains(),
      store.listProducts(),
      store.listStock(),
      store.listWarehouses(),
      pricingRulesOf(),
    ]);
    aggregate.products = catalogProducts.filter((item) =>
      aggregate.lines.some((line) => line.productId === item.id),
    );
    const assessment = assessQuote({
      customerTier: aggregate.customer.tier,
      lines: aggregate.lines.map((line) => {
        const product = catalogProducts.find((item) => item.id === line.productId);
        if (!product) {
          throw invalid('Quote line references an unknown product', { productId: line.productId });
        }
        return { line, product };
      }),
      policies,
      chains,
      config: rules.config,
      quantityBreaks: rules.quantityBreaks,
      roleAuthorities: rules.roleAuthorities,
      stock,
      warehouses,
    });
    aggregate.quote.listTotal = assessment.listTotal;
    aggregate.quote.discountTotal = assessment.discountTotal;
    aggregate.quote.netTotal = assessment.netTotal;
    aggregate.quote.costTotal = assessment.costTotal;
    aggregate.quote.marginPercent = assessment.marginPercent;
    aggregate.quote.blendedDiscountPercent = assessment.blendedDiscountPercent;
    aggregate.quote.riskScore = assessment.riskScore;
    aggregate.quote.assessmentDecision = assessment.decision;
    aggregate.quote.requiredChainId = assessment.requiredChainId ?? null;
    aggregate.quote.taxTotal = computeTaxTotal(aggregate.lines, catalogProducts, rules.config);
    return assessment;
  };

  const present = (
    aggregate: QuoteAggregate,
    assessment?: QuoteAssessment,
    extras?: {
      loyalty?: { tier: string; wonPurchaseCount: number; bonusPercent: number };
      negotiations?: NegotiationRequest[];
      discountAuthority?: ReturnType<typeof actorDiscountCeiling>;
      customerEmails?: QuoteEmailDelivery[];
    },
  ) => {
    const taxTotal = aggregate.quote.taxTotal ?? 0;
    const commercials = hybridCommercials({
      lines: aggregate.lines,
      products: aggregate.products,
      taxTotal,
    });
    return {
      ...aggregate.quote,
      taxTotal,
      grandTotal: aggregate.quote.netTotal + taxTotal,
      recurringMonthly: commercials.recurringMonthly,
      recurringAnnual: commercials.recurringAnnual,
      commercials,
      loyalty: extras?.loyalty,
      negotiations: extras?.negotiations,
      discountAuthority: extras?.discountAuthority,
      customerEmails: extras?.customerEmails,
      health: computeDealHealth(aggregate, assessment, options.config ?? DEFAULT_GOVERNANCE),
      odooIntegration: {
        configured: Boolean(options.odoo?.enabled),
        saleOrderId: aggregate.quote.odooSaleOrderId ?? null,
      },
      customer: aggregate.customer,
      lines: aggregate.lines.map((line) => ({
        ...line,
        product: aggregate.products.find((item) => item.id === line.productId) ?? null,
      })),
      assessment,
      approvals: aggregate.approvals,
      fulfillment: {
        allocations: aggregate.allocations,
        backorders: aggregate.backorders,
        shipmentCount: new Set(aggregate.allocations.filter((item) => !item.isBackorder).map((item) => item.warehouseId)).size,
        fulfillmentCost: aggregate.allocations
          .filter((item) => !item.isBackorder)
          .reduce((sum, item) => sum + item.quantity * item.unitFulfillmentCost, 0),
        backorderQuantity: aggregate.backorders.reduce((sum, item) => sum + item.quantity, 0),
      },
      billing: aggregate.schedules,
      revisions: aggregate.revisions,
    };
  };

  const decorate = async (
    aggregate: QuoteAggregate,
    assessment?: QuoteAssessment,
    actor?: Actor,
    includeNegotiations = true,
  ) => {
    const won = await store.countWonPurchases(aggregate.customer.id);
    const loyaltyTier = wonPurchaseCountToTier(won);
    const persisted = persistCustomerTier(loyaltyTier);
    if (aggregate.customer.email && persistCustomerTier(aggregate.customer.tier) !== persisted) {
      const updated = await store.upsertCustomer({
        name: aggregate.customer.name,
        email: aggregate.customer.email,
        tier: persisted,
      });
      aggregate.customer = { ...aggregate.customer, tier: updated.tier };
    }
    const [config, authorities, negotiations, customerEmails] = await Promise.all([
      governanceOf(),
      store.listRoleAuthorities(),
      includeNegotiations ? store.listNegotiations(aggregate.quote.id) : Promise.resolve([] as NegotiationRequest[]),
      store.listQuoteEmails(aggregate.quote.id),
    ]);
    return present(aggregate, assessment, {
      loyalty: { tier: loyaltyTier, wonPurchaseCount: won, bonusPercent: loyaltyBonusPercent(loyaltyTier) },
      negotiations: includeNegotiations ? negotiations : undefined,
      discountAuthority: actor
        ? actorDiscountCeiling({ authorities, actor, loyaltyTier, config })
        : undefined,
      customerEmails,
    });
  };

  const dispatchCustomerQuoteEmail = async (aggregate: QuoteAggregate, eventType: QuoteEmailEvent, actor?: Actor) => {
    const recipient = aggregate.customer.email?.trim();
    const key = customerQuoteEmailKey(
      aggregate.quote.id,
      eventType,
      customerQuoteEmailStamp(aggregate, eventType),
    );
    const existing = await store.findQuoteEmailByKey(key);
    if (existing?.status === 'sent' || existing?.status === 'not_configured') {
      return existing;
    }
    const document = buildCustomerQuoteDocument(aggregate, eventType);
    assertCustomerSafePayload(document);
    const copy = renderCustomerQuoteEmail(document);
    let record =
      existing ??
      (await store.saveQuoteEmail(
        newQuoteEmailDelivery({
          id: crypto.randomUUID(),
          quoteId: aggregate.quote.id,
          eventType,
          quoteVersion: aggregate.quote.version,
          recipientEmail: recipient || '',
          status: recipient ? 'pending' : 'failed',
          idempotencyKey: key,
          payload: document,
          errorMessage: recipient ? null : 'Customer email is missing',
        }),
      ));
    if (existing) {
      record = await store.saveQuoteEmail({
        ...record,
        quoteVersion: aggregate.quote.version,
        recipientEmail: recipient || record.recipientEmail,
        payload: document,
        updatedAt: new Date().toISOString(),
      });
    }
    if (!recipient) {
      await audit(actor, `quote.customer_email_${eventType}`, aggregate.quote.id, {
        status: 'failure',
        metadata: { reason: 'missing_recipient', key },
      });
      return record;
    }
    try {
      const pdf = await renderCustomerQuotePdf(aggregate, document.taxTotal, eventType);
      if (!options.sendCustomerEmail) {
        record = await store.saveQuoteEmail({
          ...record,
          status: 'not_configured',
          errorMessage: 'Email adapter is not available',
          updatedAt: new Date().toISOString(),
        });
      } else {
        const result = await options.sendCustomerEmail({
          to: recipient,
          subject: copy.subject,
          text: copy.text,
          html: copy.html,
          attachments: [
            {
              filename: emailFilename(document),
              contentBase64: pdf.toString('base64'),
              contentType: 'application/pdf',
            },
          ],
          idempotencyKey: key,
          quoteId: aggregate.quote.id,
          eventType,
          data: {
            quoteNumber: document.quoteNumber,
            status: document.status,
            payableAmount: document.payableAmount,
            quoteVersion: document.quoteVersion,
          },
        });
        const mapped =
          result.status === 'sent'
            ? 'sent'
            : result.status === 'not_configured'
              ? 'not_configured'
              : result.status === 'skipped'
                ? record.status === 'sent'
                  ? 'sent'
                  : record.status === 'not_configured'
                    ? 'not_configured'
                    : 'pending'
                : 'failed';
        record = await store.saveQuoteEmail({
          ...record,
          status: mapped,
          provider: result.provider ?? null,
          providerMessageId: result.providerMessageId ?? null,
          notificationDeliveryId: result.notificationDeliveryId ?? null,
          errorMessage: result.error ?? (mapped === 'not_configured' ? 'Email provider is not configured' : null),
          sentAt: mapped === 'sent' ? new Date().toISOString() : null,
          updatedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      record = await store.saveQuoteEmail({
        ...record,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Customer email failed',
        updatedAt: new Date().toISOString(),
      });
    }
    await audit(actor, `quote.customer_email_${eventType}`, aggregate.quote.id, {
      status: record.status === 'sent' ? 'success' : record.status === 'failed' ? 'failure' : 'success',
      metadata: {
        status: record.status,
        recipient: record.recipientEmail,
        version: record.quoteVersion,
      },
    });
    await notify(
      uuidOrNull(aggregate.quote.ownerId) ?? actor?.id,
      eventType === 'final_invoice' ? 'Customer final bill email' : 'Customer provisional invoice email',
      record.status === 'sent'
        ? `${aggregate.quote.number} was emailed to ${record.recipientEmail}.`
        : record.status === 'not_configured'
          ? `${aggregate.quote.number} email is pending — email provider is not configured.`
          : `${aggregate.quote.number} email was not delivered: ${record.errorMessage ?? 'unknown error'}.`,
      record.status === 'sent' ? 'success' : 'warning',
    );
    await publish('quote.updated', aggregate.quote.id, { customerEmail: record.status, eventType });
    return record;
  };

  const actorHas = (actor: Actor | undefined, permission: string) => {
    if (!actor) return false;
    if (actor.permissions?.includes(permission)) return true;
    return actorDiscountRoles(actor).includes('admin');
  };

  const canWriteProducts = (actor: Actor | undefined) =>
    actorHas(actor, 'dealflow.catalog.products.write') || actorHas(actor, 'dealflow.catalog.write');
  const canManageCustomers = (actor: Actor | undefined) =>
    actorHas(actor, 'dealflow.catalog.write') || actorHas(actor, 'dealflow.quotes.write');

  const assertManagerActor = (actor: Actor) => {
    const roles = actorDiscountRoles(actor);
    if (!roles.includes('manager') && !roles.includes('admin')) {
      throw forbidden('Only a manager can perform this commercial step');
    }
  };

  const assertCommercialWrite = async (
    aggregate: QuoteAggregate,
    actor: Actor,
    discounts: number[],
    overrides: Array<{ rulePrice: number; appliedPrice: number }> = [],
  ) => {
    if (isCommerciallyLocked(aggregate.quote.status, aggregate.quote.financeLockedAt)) {
      throw conflict('Locked quotations cannot be changed. Clone a new revision to reopen approval.', {
        status: aggregate.quote.status,
      });
    }
    if (!canMutateCommercials(aggregate.quote.status)) {
      throw conflict(`Quote commercials cannot change while status is ${aggregate.quote.status}`, {
        status: aggregate.quote.status,
      });
    }
    if (aggregate.quote.status === 'manager_review') {
      assertManagerActor(actor);
    }
    const [authorities, config, won] = await Promise.all([
      store.listRoleAuthorities(),
      governanceOf(),
      store.countWonPurchases(aggregate.customer.id),
    ]);
    const loyaltyTier = wonPurchaseCountToTier(won);
    for (const discount of discounts) {
      assertDiscountWithinAuthority(discount, { authorities, actor, loyaltyTier, config });
    }
    for (const item of overrides) {
      assertPriceOverrideWithinAuthority(item.rulePrice, item.appliedPrice, { authorities, actor });
    }
  };

  const publish = async (type: string, quoteId?: string, payload?: Record<string, unknown>) => {
    await options.publish?.({ type, quoteId, payload }).catch(() => undefined);
  };

  const persistAnomalies = async (aggregate: QuoteAggregate, assessment: QuoteAssessment | undefined, actor?: Actor) => {
    const config = await governanceOf();
    const existing = await store.listAnomalies();
    for (const item of detectQuoteAnomalies(aggregate, assessment, config)) {
      const open = existing.find(
        (row) => row.type === item.type && row.entityId === item.entityId && row.status === 'open',
      );
      if (open) continue;
      const saved = await store.upsertAnomaly({
        ...item,
        id: crypto.randomUUID(),
        status: 'open',
        updatedAt: item.detectedAt,
      });
      await notify(uuidOrNull(aggregate.quote.ownerId), 'Anomaly detected', saved.description, 'warning');
      await audit(actor, 'anomaly.detected', saved.id, { resource: 'anomaly', newValue: saved });
      await publish('anomaly.created', aggregate.quote.id, { anomalyId: saved.id, type: saved.type });
    }
  };

  const saveAssessed = async (aggregate: QuoteAggregate, actor?: Actor) => {
    const assessment = await refreshAssessment(aggregate, actor);
    aggregate.quote.updatedAt = new Date().toISOString();
    const saved = await store.saveQuote(aggregate);
    await persistAnomalies(saved, assessment, actor);
    await publish('quote.updated', saved.quote.id, { status: saved.quote.status, version: saved.quote.version });
    return { saved, assessment };
  };

  const appendRevision = (aggregate: QuoteAggregate, actor: Actor | undefined, materialChange: boolean) => {
    aggregate.revisions = [
      ...aggregate.revisions,
      {
        id: crypto.randomUUID(),
        quoteId: aggregate.quote.id,
        version: aggregate.quote.version,
        snapshot: {
          status: aggregate.quote.status,
          lines: aggregate.lines,
          blendedDiscountPercent: aggregate.quote.blendedDiscountPercent,
          netTotal: aggregate.quote.netTotal,
        },
        materialChange,
        createdBy: uuidOrNull(actor?.id),
        createdAt: new Date().toISOString(),
      },
    ];
  };

  const maybeReapprove = async (aggregate: QuoteAggregate, before: { blendedDiscountPercent: number; netTotal: number }, actor?: Actor) => {
    const assessment = await refreshAssessment(aggregate, actor);
    const material = isMaterialChange(before, assessment, await governanceOf());
    if (!material) {
      return { assessment, material: false };
    }
    if (aggregate.quote.status === 'approved') {
      const previous = invalidateApprovals(aggregate.approvals);
      const chains = await store.listChains();
      const chain = assessment.requiredChainId
        ? chains.find((item) => item.id === assessment.requiredChainId)
        : undefined;
      if (!chain) {
        throw conflict('Material change requires approval but no matching chain is configured');
      }
      const maxLevels = (await governanceOf()).maxApprovalLevels;
      aggregate.approvals = [...previous, ...buildApprovalSteps(aggregate.quote.id, chain, maxLevels)];
      assertTransition(aggregate.quote.status, 'approval_required');
      aggregate.quote.status = 'approval_required';
    }
    return { assessment, material: true };
  };

  const finishMutation = (aggregate: QuoteAggregate, actor: Actor | undefined, material: boolean) => {
    bumpVersion(aggregate);
    if (material) {
      appendRevision(aggregate, actor, true);
    }
  };

  return {
    async catalog() {
      const [customers, products, warehouses, stock, policies, chains, relations, rules] = await Promise.all([
        store.listCustomers(),
        store.listProducts(),
        store.listWarehouses(),
        store.listStock(),
        store.listPolicies(),
        store.listChains(),
        store.listRelations(),
        pricingRulesOf(),
      ]);
      return {
        customers,
        products,
        warehouses,
        stock,
        policies,
        chains,
        relations,
        quantityBreaks: rules.quantityBreaks,
        roleAuthorities: rules.roleAuthorities,
        governance: rules.config,
      };
    },

    async replaceQuantityBreaks(items, actor) {
      const previous = await store.listQuantityBreaks();
      const next = await store.replaceQuantityBreaks(validateQuantityBreaks(items));
      await audit(actor, 'governance.quantity_breaks_updated', 'catalog', {
        resource: 'governance',
        oldValue: previous,
        newValue: next,
      });
      return next;
    },

    async replaceRoleAuthorities(items, actor) {
      const previous = await store.listRoleAuthorities();
      const next = await store.replaceRoleAuthorities(validateRoleAuthorities(items));
      await audit(actor, 'governance.role_authorities_updated', 'catalog', {
        resource: 'governance',
        oldValue: previous,
        newValue: next,
      });
      return next;
    },

    async updateGovernance(input, actor) {
      const previous = await store.getGovernance();
      const next = await store.replaceGovernance(validateGovernance({ ...previous, ...input }));
      await audit(actor, 'governance.settings_updated', 'catalog', {
        resource: 'governance',
        oldValue: previous,
        newValue: next,
      });
      return next;
    },

    async upsertProduct(input, actor) {
      if (!canWriteProducts(actor)) {
        throw forbidden('You are not allowed to create or edit products');
      }
      const current = input.id ? await store.getProduct(input.id) : null;
      if (input.id && !current) {
        throw notFound('Product not found', { id: input.id });
      }
      const sku = (input.sku ?? current?.sku ?? '').trim();
      const name = (input.name ?? current?.name ?? '').trim();
      const category = (input.category ?? current?.category ?? '').trim();
      const listPrice = input.listPrice ?? current?.listPrice ?? 0;
      const cost = input.cost ?? current?.cost ?? 0;
      const billingType = input.billingType ?? current?.billingType ?? 'one_time';
      const billingFrequency =
        billingType === 'recurring'
          ? (input.billingFrequency ?? current?.billingFrequency ?? 'monthly')
          : null;
      if (!sku || !name) {
        throw invalid('Product SKU and name are required');
      }
      if (name.length > 160 || sku.length > 80) {
        throw invalid('Product name or SKU is too long');
      }
      if (listPrice < 0 || cost < 0) {
        throw invalid('Product price and cost cannot be negative');
      }
      if (input.taxRatePercent != null && (input.taxRatePercent < 0 || input.taxRatePercent > 100)) {
        throw invalid('Tax rate must be between 0 and 100');
      }
      if (billingType === 'recurring' && !billingFrequency) {
        throw invalid('Billing frequency is required for subscription products');
      }
      const duplicate = (await store.listProducts()).find(
        (item) => item.sku.toLowerCase() === sku.toLowerCase() && item.id !== (input.id ?? current?.id),
      );
      if (duplicate) {
        throw conflict('SKU already exists. Please use a unique SKU.', { sku });
      }
      const product: Product = {
        id: input.id ?? current?.id ?? crypto.randomUUID(),
        sku,
        name,
        category: category || 'general',
        listPrice,
        cost,
        billingType,
        billingFrequency,
        description: input.description === undefined ? (current?.description ?? null) : input.description,
        taxCategory: input.taxCategory === undefined ? (current?.taxCategory ?? null) : input.taxCategory,
        taxRatePercent: input.taxRatePercent === undefined ? (current?.taxRatePercent ?? null) : input.taxRatePercent,
        active: input.active ?? current?.active ?? true,
        taxable: input.taxable ?? current?.taxable ?? true,
        createdAt: current?.createdAt,
        updatedAt: current?.updatedAt,
      };
      let saved: Product;
      try {
        saved = await store.upsertProduct(product);
      } catch (error) {
        const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: string }).code) : '';
        if (code === 'P2002' || /unique/i.test(error instanceof Error ? error.message : '')) {
          throw conflict('SKU already exists. Please use a unique SKU.', { sku });
        }
        throw error;
      }
      if (input.stock) {
        for (const row of input.stock) {
          await this.upsertStock(
            {
              warehouseId: row.warehouseId,
              productId: saved.id,
              quantityOnHand: row.quantityOnHand,
              reserved: 0,
              incoming: row.incoming ?? 0,
            },
            actor,
          );
        }
      }
      if (input.quantityBreaks) {
        if (
          input.quantityBreaks.some((item) => item.adjustmentKind === 'percent') &&
          !actorHas(actor, 'dealflow.catalog.write')
        ) {
          throw forbidden('Percent quantity-break discounts require Admin catalog configuration');
        }
        const existing = (await store.listQuantityBreaks()).filter((item) => item.productId !== saved.id);
        const next = validateQuantityBreaks([
          ...existing,
          ...input.quantityBreaks.map((item) => ({
            id: item.id ?? crypto.randomUUID(),
            name: item.name,
            productId: saved.id,
            customerTier: item.customerTier ?? null,
            minQuantity: item.minQuantity,
            maxQuantity: item.maxQuantity ?? null,
            adjustmentKind: item.adjustmentKind,
            adjustmentValue: item.adjustmentValue,
            active: item.active !== false,
          })),
        ]);
        await store.replaceQuantityBreaks(next);
      }
      const created = !current;
      const activated = current && current.active === false && saved.active !== false;
      const deactivated = current && current.active !== false && saved.active === false;
      const actorMeta = { role: actor.role, roles: actor.roles, sku: saved.sku };
      await audit(actor, created ? 'catalog.product_created' : 'catalog.product_updated', saved.id, {
        resource: 'catalog',
        oldValue: current ?? undefined,
        newValue: saved,
        metadata: actorMeta,
      });
      if (activated) {
        await audit(actor, 'catalog.product_activated', saved.id, {
          resource: 'catalog',
          oldValue: current,
          newValue: saved,
          metadata: actorMeta,
        });
      }
      if (deactivated) {
        await audit(actor, 'catalog.product_deactivated', saved.id, {
          resource: 'catalog',
          oldValue: current,
          newValue: saved,
          metadata: actorMeta,
        });
      }
      await publish('catalog.updated', undefined, { productId: saved.id, sku: saved.sku, created });
      return saved;
    },

    async deleteProduct(id, actor) {
      if (!canWriteProducts(actor)) {
        throw forbidden('You are not allowed to delete products');
      }
      const current = await store.getProduct(id);
      if (!current) {
        throw notFound('Product not found', { id });
      }
      const used = await store.countProductQuoteLines(id);
      if (used > 0) {
        throw conflict('Product is used on quotations. Archive it instead.', { id, quoteLines: used });
      }
      await store.deleteProduct(id);
      await audit(actor, 'catalog.product_deleted', id, {
        resource: 'catalog',
        oldValue: current,
        metadata: { role: actor.role, sku: current.sku },
      });
      await publish('catalog.updated', undefined, { productId: id, sku: current.sku, deleted: true });
      return { id, deleted: true as const };
    },

    async upsertCustomer(input, actor) {
      if (!canManageCustomers(actor)) {
        throw forbidden('You are not allowed to create or edit customers');
      }
      const name = input.name.trim();
      const email = input.email.trim();
      if (!name || !email || !email.includes('@')) {
        throw invalid('Customer name and a valid email are required');
      }
      if (input.id) {
        const current = await store.getCustomer(input.id);
        if (!current) {
          throw notFound('Customer not found', { id: input.id });
        }
      }
      const saved = await store.upsertCustomer({
        id: input.id,
        name,
        email,
        tier: input.tier,
      });
      await audit(actor, input.id ? 'catalog.customer_updated' : 'catalog.customer_created', saved.id, {
        resource: 'catalog',
        newValue: saved,
      });
      await publish('catalog.updated', undefined, { customerId: saved.id });
      return saved;
    },

    async deleteCustomer(id, actor) {
      if (!canManageCustomers(actor)) {
        throw forbidden('You are not allowed to delete customers');
      }
      const current = await store.getCustomer(id);
      if (!current) {
        throw notFound('Customer not found', { id });
      }
      const used = await store.countCustomerQuotes(id);
      if (used > 0) {
        throw conflict('Customer is used on quotations and cannot be deleted. Edit the contact details instead.', {
          id,
          quotes: used,
        });
      }
      await store.deleteCustomer(id);
      await audit(actor, 'catalog.customer_deleted', id, { resource: 'catalog', oldValue: current });
      await publish('catalog.updated', undefined, { customerId: id, deleted: true });
      return { id, deleted: true as const };
    },

    async upsertStock(input, actor) {
      if (!canWriteProducts(actor)) {
        throw forbidden('You are not allowed to update product stock');
      }
      if (input.quantityOnHand < 0 || input.reserved < 0 || (input.incoming ?? 0) < 0) {
        throw invalid('Stock quantities cannot be negative');
      }
      const warehouses = await store.listWarehouses();
      if (!warehouses.some((item) => item.id === input.warehouseId)) {
        throw notFound('Warehouse not found', { warehouseId: input.warehouseId });
      }
      const product = await store.getProduct(input.productId);
      if (!product) {
        throw notFound('Product not found', { productId: input.productId });
      }
      const saved = await store.upsertStock(input);
      await audit(actor, 'catalog.stock_upserted', input.productId, { resource: 'catalog', newValue: input });
      return saved;
    },

    async deleteStock(warehouseId, productId, actor) {
      if (!canWriteProducts(actor)) {
        throw forbidden('You are not allowed to delete product stock');
      }
      const warehouses = await store.listWarehouses();
      if (!warehouses.some((item) => item.id === warehouseId)) {
        throw notFound('Warehouse not found', { warehouseId });
      }
      const product = await store.getProduct(productId);
      if (!product) {
        throw notFound('Product not found', { productId });
      }
      const saved = await store.deleteStock(warehouseId, productId);
      await audit(actor, 'catalog.stock_deleted', productId, {
        resource: 'catalog',
        metadata: { warehouseId, productId },
      });
      return saved;
    },

    async upsertPolicy(input, actor) {
      if (!actorHas(actor, 'dealflow.catalog.write')) {
        throw forbidden('You are not allowed to change discount policies');
      }
      const previous = input.id ? (await store.listPolicies()).find((item) => item.id === input.id) : undefined;
      const policy: DiscountPolicy = {
        id: input.id ?? crypto.randomUUID(),
        name: input.name.trim(),
        customerTier: input.customerTier ?? null,
        productCategory: input.productCategory ?? null,
        warningPercent: input.warningPercent,
        approvalPercent: input.approvalPercent,
        rejectPercent: input.rejectPercent,
        maxMarginImpactPercent: input.maxMarginImpactPercent,
        priority: input.priority,
        description: input.description ?? null,
        active: input.active !== false,
      };
      const saved = await store.upsertPolicy(policy);
      await audit(actor, previous ? 'catalog.policy_updated' : 'catalog.policy_created', saved.id, {
        resource: 'catalog',
        oldValue: previous,
        newValue: saved,
        metadata: { role: actor.role, roles: actor.roles },
      });
      return saved;
    },

    async deletePolicy(id, actor) {
      if (!actorHas(actor, 'dealflow.catalog.write')) {
        throw forbidden('You are not allowed to delete discount policies');
      }
      const current = (await store.listPolicies()).find((item) => item.id === id);
      if (!current) {
        throw notFound('Policy not found', { id });
      }
      await store.deletePolicy(id);
      await audit(actor, 'catalog.policy_deleted', id, { resource: 'catalog', oldValue: current });
      await publish('catalog.updated', undefined, { policyId: id, deleted: true });
      return { id, deleted: true as const };
    },

    async upsertChain(input, actor) {
      const chain: ApprovalChain = {
        id: input.id ?? crypto.randomUUID(),
        name: input.name.trim(),
        minRiskScore: input.minRiskScore,
        minBlendedDiscountPercent: input.minBlendedDiscountPercent,
        priority: input.priority,
        active: input.active !== false,
        steps: input.steps.map((step, index) => ({
          ...step,
          id: step.id ?? crypto.randomUUID(),
          chainId: input.id ?? step.chainId,
          stepOrder: step.stepOrder ?? index + 1,
        })),
      };
      chain.steps = chain.steps.map((step) => ({ ...step, chainId: chain.id }));
      const saved = await store.upsertChain(chain);
      await audit(actor, 'catalog.chain_upserted', saved.id, { resource: 'catalog', newValue: saved });
      return saved;
    },

    async deleteChain(id, actor) {
      if (!actorHas(actor, 'dealflow.catalog.write')) {
        throw forbidden('You are not allowed to delete approval chains');
      }
      const current = await store.getChain(id);
      if (!current) {
        throw notFound('Approval chain not found', { id });
      }
      const used = await store.countChainApprovals(id);
      if (used > 0) {
        throw conflict('Approval chain is used on quotations. Archive it instead.', { id, usages: used });
      }
      await store.deleteChain(id);
      await audit(actor, 'catalog.chain_deleted', id, { resource: 'catalog', oldValue: current });
      await publish('catalog.updated', undefined, { chainId: id, deleted: true });
      return { id, deleted: true as const };
    },

    async upsertWarehouse(input, actor) {
      if (!actorHas(actor, 'dealflow.catalog.write')) {
        throw forbidden('You are not allowed to create or edit warehouses');
      }
      const name = input.name.trim();
      if (!name) {
        throw invalid('Warehouse name is required');
      }
      if (input.fulfillmentCostPerUnit < 0) {
        throw invalid('Fulfillment cost cannot be negative');
      }
      if (input.id) {
        const current = (await store.listWarehouses()).find((item) => item.id === input.id);
        if (!current) {
          throw notFound('Warehouse not found', { id: input.id });
        }
      }
      const warehouse: Warehouse = {
        id: input.id ?? crypto.randomUUID(),
        name,
        fulfillmentCostPerUnit: input.fulfillmentCostPerUnit,
      };
      const saved = await store.upsertWarehouse(warehouse);
      await audit(actor, input.id ? 'catalog.warehouse_updated' : 'catalog.warehouse_created', saved.id, {
        resource: 'catalog',
        newValue: saved,
      });
      await publish('catalog.updated', undefined, { warehouseId: saved.id });
      return saved;
    },

    async upsertRelation(input, actor) {
      if (!actorHas(actor, 'dealflow.catalog.write')) {
        throw forbidden('You are not allowed to change product recommendations');
      }
      const product = await store.getProduct(input.productId);
      const recommended = await store.getProduct(input.recommendedProductId);
      if (!product || !recommended) {
        throw notFound('Product not found for this recommendation');
      }
      if (input.productId === input.recommendedProductId) {
        throw invalid('A product cannot recommend itself');
      }
      const relation = {
        id: input.id ?? crypto.randomUUID(),
        productId: input.productId,
        recommendedProductId: input.recommendedProductId,
        kind: input.kind,
        reason: input.reason.trim(),
        promotion: input.promotion ?? null,
        minQuantity: input.minQuantity ?? 1,
      };
      if (!relation.reason) {
        throw invalid('Recommendation reason is required');
      }
      const saved = await store.upsertRelation(relation);
      await audit(actor, input.id ? 'catalog.relation_updated' : 'catalog.relation_created', saved.id, {
        resource: 'catalog',
        newValue: saved,
      });
      return saved;
    },

    async deleteRelation(id, actor) {
      if (!actorHas(actor, 'dealflow.catalog.write')) {
        throw forbidden('You are not allowed to delete product recommendations');
      }
      const current = (await store.listRelations()).find((item) => item.id === id);
      if (!current) {
        throw notFound('Recommendation not found', { id });
      }
      await store.deleteRelation(id);
      await audit(actor, 'catalog.relation_deleted', id, { resource: 'catalog', oldValue: current });
      return { id, deleted: true as const };
    },

    async deleteWarehouse(id, actor) {
      if (!actorHas(actor, 'dealflow.catalog.write')) {
        throw forbidden('You are not allowed to delete warehouses');
      }
      const current = (await store.listWarehouses()).find((item) => item.id === id);
      if (!current) {
        throw notFound('Warehouse not found', { id });
      }
      const used = await store.countWarehouseAllocations(id);
      if (used > 0) {
        throw conflict('Warehouse is used by fulfillment and cannot be deleted.', { id, allocations: used });
      }
      await store.deleteWarehouse(id);
      await audit(actor, 'catalog.warehouse_deleted', id, { resource: 'catalog', oldValue: current });
      await publish('catalog.updated', undefined, { warehouseId: id, deleted: true });
      return { id, deleted: true as const };
    },

    async listQuotes() {
      const quotes = await store.listQuoteSummaries();
      return Promise.all(quotes.map((item) => decorate(item)));
    },

    async listMyQuotes(actor) {
      const customers = await store.findCustomersByEmail(actor.email ?? '');
      if (!customers.length) {
        return [];
      }
      const ids = new Set(customers.map((item) => item.id));
      const quotes = await store.listQuoteSummaries();
      return quotes
        .filter((item) => ids.has(item.quote.customerId) || ids.has(item.customer.id))
        .map((item) => ({
          ...toPortalView({
            ...item.quote,
            customer: { name: item.customer.name },
            lines: item.lines.map((line) => ({
              ...line,
              product: item.products.find((product) => product.id === line.productId) ?? null,
            })),
          }),
          portalToken: item.quote.portalToken,
        }));
    },

    async provisionCustomer(input) {
      const customer = await store.upsertCustomer({
        name: input.companyName?.trim() || input.displayName.trim() || input.email,
        email: input.email,
      });
      const won = await store.countWonPurchases(customer.id);
      const tier = persistCustomerTier(wonPurchaseCountToTier(won));
      if (persistCustomerTier(customer.tier) !== tier) {
        return store.upsertCustomer({ name: customer.name, email: customer.email, tier });
      }
      return { ...customer, loyaltyTier: wonPurchaseCountToTier(won) };
    },

    async getQuote(id, actor) {
      const aggregate = await load(id);
      const assessment = await refreshAssessment(aggregate, actor);
      return decorate(aggregate, assessment, actor);
    },

    async getQuoteByToken(token) {
      const aggregate = await store.getQuoteByToken(token);
      if (!aggregate) {
        throw notFound('Quote portal token is invalid');
      }
      await refreshAssessment(aggregate);
      const presented = await decorate(aggregate);
      return portalPayloadFromPresented(presented);
    },

    async createQuote(input, actor) {
      const customer = await store.getCustomer(input.customerId);
      if (!customer) {
        throw notFound('Customer not found', { customerId: input.customerId });
      }
      const now = new Date().toISOString();
      const quote: Quote = {
        id: crypto.randomUUID(),
        number: await store.nextQuoteNumber(),
        customerId: customer.id,
        ownerId: input.ownerId ?? actor.id,
        status: 'draft',
        listTotal: 0,
        discountTotal: 0,
        netTotal: 0,
        costTotal: 0,
        marginPercent: 0,
        blendedDiscountPercent: 0,
        riskScore: 0,
        assessmentDecision: 'allowed',
        requiredChainId: null,
        portalToken: store.newPortalToken(),
        version: 1,
        taxTotal: 0,
        customerDecision: 'none',
        createdAt: now,
        updatedAt: now,
      };
      const lines: QuoteLine[] = [];
      const breaks = await store.listQuantityBreaks();
      const draftAggregate = emptyAggregate(quote, { lines });
      draftAggregate.customer = customer;
      await assertCommercialWrite(
        draftAggregate,
        actor,
        (input.lines ?? []).map((line) => line.discountPercent),
      );
      for (const line of input.lines ?? []) {
        lines.push(await toLine(store, quote.id, line, breaks));
      }
      draftAggregate.lines = lines;
      const { saved, assessment } = await saveAssessed(draftAggregate, actor);
      await audit(actor, 'quote.created', saved.quote.id, { newValue: present(saved, assessment) });
      return decorate(saved, assessment, actor);
    },

    async deleteQuote(quoteId, actor, expectedVersion) {
      if (!actorHas(actor, 'dealflow.quotes.write')) {
        throw forbidden('You are not allowed to delete quotations');
      }
      const aggregate = await load(quoteId);
      assertExpectedVersion(aggregate, expectedVersion);
      if (isCommerciallyLocked(aggregate.quote.status, aggregate.quote.financeLockedAt)) {
        throw conflict('Locked orders cannot be deleted. Cancel billing instead.', { status: aggregate.quote.status });
      }
      if (!canDeleteQuote(aggregate.quote.status)) {
        if (canVoidQuote(aggregate.quote.status)) {
          throw conflict('This quotation cannot be deleted. Void it instead.', { status: aggregate.quote.status });
        }
        throw conflict('This quotation cannot be deleted.', { status: aggregate.quote.status });
      }
      await store.deleteQuote(quoteId);
      await audit(actor, 'quote.deleted', quoteId, {
        oldValue: { number: aggregate.quote.number, status: aggregate.quote.status },
      });
      await publish('quote.deleted', quoteId, { number: aggregate.quote.number });
      return { id: quoteId, deleted: true as const };
    },

    async voidQuote(quoteId, actor, expectedVersion) {
      if (!actorHas(actor, 'dealflow.quotes.write')) {
        throw forbidden('You are not allowed to void quotations');
      }
      const aggregate = await load(quoteId);
      assertExpectedVersion(aggregate, expectedVersion);
      if (isCommerciallyLocked(aggregate.quote.status, aggregate.quote.financeLockedAt)) {
        throw conflict('Locked orders cannot be voided. Cancel billing instead.', { status: aggregate.quote.status });
      }
      if (!canVoidQuote(aggregate.quote.status)) {
        if (canDeleteQuote(aggregate.quote.status)) {
          throw conflict('Delete this draft instead of voiding it.', { status: aggregate.quote.status });
        }
        throw conflict('This quotation cannot be voided.', { status: aggregate.quote.status });
      }
      if (
        (aggregate.quote.status === 'approval_required' ||
          aggregate.quote.status === 'approved' ||
          aggregate.quote.status === 'finalized') &&
        !actorHas(actor, 'dealflow.quotes.approve')
      ) {
        throw forbidden('Only an approver can void a quote in the approval pipeline');
      }
      const previous = aggregate.quote.status;
      assertTransition(aggregate.quote.status, 'rejected');
      aggregate.quote.status = 'rejected';
      bumpVersion(aggregate);
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.voided', quoteId, {
        oldValue: { status: previous },
        newValue: { status: saved.quote.status },
      });
      await notify(
        uuidOrNull(saved.quote.ownerId) ?? actor.id,
        'Quotation voided',
        `${saved.quote.number} was voided and is no longer active.`,
        'warning',
      );
      return decorate(saved, assessment, actor);
    },

    async addLine(quoteId, input, actor) {
      const aggregate = await load(quoteId);
      assertExpectedVersion(aggregate, input.expectedVersion);
      await assertCommercialWrite(aggregate, actor, [input.discountPercent]);
      const before = {
        blendedDiscountPercent: aggregate.quote.blendedDiscountPercent,
        netTotal: aggregate.quote.netTotal,
      };
      aggregate.lines.push(await toLine(store, quoteId, input, await store.listQuantityBreaks()));
      const reapprove = await maybeReapprove(aggregate, before, actor);
      finishMutation(aggregate, actor, reapprove.material);
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.line_added', quoteId, {
        metadata: input,
        newValue: { decision: assessment.decision, material: reapprove.material },
      });
      return decorate(saved, assessment, actor);
    },

    async updateLine(quoteId, lineId, input, actor) {
      const aggregate = await load(quoteId);
      assertExpectedVersion(aggregate, input.expectedVersion);
      const line = aggregate.lines.find((item) => item.id === lineId);
      if (!line) {
        throw notFound('Quote line not found', { lineId });
      }
      const before = {
        blendedDiscountPercent: aggregate.quote.blendedDiscountPercent,
        netTotal: aggregate.quote.netTotal,
        line: { ...line },
      };
      if (input.quantity !== undefined) line.quantity = input.quantity;
      if (input.discountPercent !== undefined) line.discountPercent = input.discountPercent;
      if (input.unitPrice !== undefined && input.unitPrice < 0) {
        throw invalid('Unit price cannot be negative');
      }
      const currentProduct = await store.getProduct(line.productId);
      const breaks = await store.listQuantityBreaks();
      const rulePrice = currentProduct
        ? resolveUnitPrice({
            product: currentProduct,
            quantity: line.quantity,
            breaks,
            customerTier: aggregate.customer.tier,
          }).unitPrice
        : line.listPrice;
      if (input.productId && input.productId !== line.productId) {
        const replacement = await toLine(store, quoteId, {
          productId: input.productId,
          quantity: line.quantity,
          discountPercent: line.discountPercent,
        }, breaks);
        line.productId = replacement.productId;
        line.listPrice = replacement.listPrice;
        line.unitCost = replacement.unitCost;
      } else if (input.unitPrice !== undefined) {
        line.listPrice = input.unitPrice;
      } else if (input.quantity !== undefined) {
        line.listPrice = rulePrice;
      }
      await assertCommercialWrite(
        aggregate,
        actor,
        [line.discountPercent],
        input.unitPrice !== undefined ? [{ rulePrice, appliedPrice: line.listPrice }] : [],
      );
      const reapprove = await maybeReapprove(aggregate, before, actor);
      finishMutation(aggregate, actor, reapprove.material);
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.discount_changed', quoteId, {
        oldValue: before.line,
        newValue: line,
        metadata: { material: reapprove.material },
      });
      return decorate(saved, assessment, actor);
    },

    async removeLine(quoteId, lineId, input, actor) {
      const aggregate = await load(quoteId);
      assertExpectedVersion(aggregate, input.expectedVersion);
      await assertCommercialWrite(aggregate, actor, []);
      const before = {
        blendedDiscountPercent: aggregate.quote.blendedDiscountPercent,
        netTotal: aggregate.quote.netTotal,
      };
      aggregate.lines = aggregate.lines.filter((item) => item.id !== lineId);
      const reapprove = await maybeReapprove(aggregate, before, actor);
      finishMutation(aggregate, actor, reapprove.material);
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.line_removed', quoteId, { metadata: { lineId, material: reapprove.material } });
      return decorate(saved, assessment, actor);
    },

    async assess(quoteId, actor) {
      const aggregate = await load(quoteId);
      const assessment = await refreshAssessment(aggregate, actor);
      await store.saveQuote(aggregate);
      return decorate(aggregate, assessment, actor);
    },

    async submit(quoteId, actor) {
      const aggregate = await load(quoteId);
      if (aggregate.quote.status !== 'finalized') {
        throw conflict(`Only finalized quotations can be submitted for approval (status ${aggregate.quote.status})`);
      }
      if (aggregate.lines.length === 0) {
        throw invalid('A quote needs at least one line before submit');
      }
      const assessment = await refreshAssessment(aggregate, actor);
      if (assessment.decision === 'rejected') {
        throw conflict('Quote exceeds reject ceilings and cannot be submitted', { reasons: assessment.reasons });
      }
      const chains = await store.listChains();
      const chain = assessment.requiredChainId
        ? chains.find((item) => item.id === assessment.requiredChainId)
        : undefined;
      aggregate.approvals = autoApproveIfAllowed(
        quoteId,
        assessment,
        chain,
        actor,
        (await governanceOf()).maxApprovalLevels,
      );
      bumpVersion(aggregate);

      if (assessment.decision === 'allowed' || assessment.decision === 'warning') {
        assertTransition(aggregate.quote.status, 'approved');
        aggregate.quote.status = 'approved';
      } else {
        assertTransition(aggregate.quote.status, 'approval_required');
        aggregate.quote.status = 'approval_required';
      }

      const { saved } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.submitted', quoteId, {
        newValue: { status: saved.quote.status, decision: assessment.decision, chainId: assessment.requiredChainId },
      });
      if (saved.quote.status === 'approval_required') {
        await notify(
          actor.id,
          'Approval requested',
          `${saved.quote.number} needs ${assessment.requiredChainName ?? 'review'}: ${assessment.reasons[0] ?? 'governance rule'}`,
          'warning',
        );
        if (assessment.highValue || assessment.mergeRisk) {
          await notify(
            actor.id,
            assessment.highValue ? 'High-value approval required' : 'Approval merge risk',
            assessment.reasons.find((reason) => reason.includes(assessment.highValue ? 'High-value' : 'merge risk')) ??
              assessment.reasons[0] ??
              'Review the governance reasons on the quote.',
            'warning',
          );
        }
      }
      if (saved.quote.status === 'approved') {
        await dispatchCustomerQuoteEmail(saved, 'prelim_invoice', actor);
      }
      return decorate(saved, assessment, actor);
    },

    async decide(quoteId, approvalId, input, actor) {
      const aggregate = await load(quoteId);
      if (aggregate.quote.status !== 'approval_required') {
        throw conflict('Quote is not waiting for approval');
      }
      const previous = aggregate.approvals;
      aggregate.approvals = applyApprovalDecision({
        approvals: aggregate.approvals,
        approvalId,
        actor,
        decision: input.decision,
        reason: input.reason,
        previousValues: { status: aggregate.quote.status, riskScore: aggregate.quote.riskScore },
        newValues: { decision: input.decision },
      });

      if (input.decision === 'rejected') {
        assertTransition(aggregate.quote.status, 'rejected');
        aggregate.quote.status = 'rejected';
        await audit(actor, 'quote.rejected', quoteId, { oldValue: previous, newValue: aggregate.approvals, metadata: { reason: input.reason } });
      } else if (allRequiredApproved(aggregate.approvals)) {
        assertTransition(aggregate.quote.status, 'approved');
        aggregate.quote.status = 'approved';
        await audit(actor, 'quote.approved', quoteId, { oldValue: previous, newValue: aggregate.approvals, metadata: { reason: input.reason } });
      } else {
        await audit(actor, 'quote.approval_step', quoteId, { metadata: { approvalId, decision: input.decision, reason: input.reason } });
      }

      bumpVersion(aggregate);
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await notify(
        uuidOrNull(saved.quote.ownerId) ?? actor.id,
        input.decision === 'approved' ? 'Approval recorded' : 'Quote returned',
        `${saved.quote.number} was ${input.decision}. ${input.reason}`,
        input.decision === 'approved' ? 'success' : 'warning',
      );
      const decided = saved.approvals.find((item) => item.id === approvalId);
      const alreadyPrelim = (await store.listQuoteEmails(saved.quote.id)).some((item) => item.eventType === 'prelim_invoice');
      if (
        input.decision === 'approved' &&
        (decided?.roleKey === 'manager' || (saved.quote.status === 'approved' && !alreadyPrelim))
      ) {
        await dispatchCustomerQuoteEmail(saved, 'prelim_invoice', actor);
      }
      return decorate(saved, assessment, actor);
    },

    async startNegotiation(quoteId, actor) {
      const aggregate = await load(quoteId);
      const authority = selectRoleAuthority(await store.listRoleAuthorities(), actor);
      if (authority && !authority.canNegotiate) {
        throw forbidden('Your role is not authorized to open customer negotiation');
      }
      if (aggregate.quote.status !== 'draft' && aggregate.quote.status !== 'rejected') {
        throw conflict('Only draft quotations can be opened for customer negotiation');
      }
      assertTransition(aggregate.quote.status, 'customer_negotiation');
      aggregate.quote.status = 'customer_negotiation';
      bumpVersion(aggregate);
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.negotiation_started', quoteId, { newValue: { status: 'customer_negotiation' } });
      return decorate(saved, assessment, actor);
    },

    async createNegotiationRequest(quoteId, input, actor) {
      const aggregate = await load(quoteId);
      if (input.expectedVersion !== undefined) {
        assertExpectedVersion(aggregate, input.expectedVersion);
      }
      if (aggregate.quote.status !== 'draft' && aggregate.quote.status !== 'customer_negotiation') {
        throw conflict('Negotiation notes can only be attached to an open quotation', {
          status: aggregate.quote.status,
        });
      }
      const existing = await store.listNegotiations(quoteId);
      if (existing.some((item) => item.status === 'open')) {
        throw conflict('A negotiation request is already open for this quotation', {
          quoteId,
          status: 'open',
        });
      }
      if (aggregate.quote.status === 'draft') {
        assertTransition(aggregate.quote.status, 'customer_negotiation');
        aggregate.quote.status = 'customer_negotiation';
      }
      const customerActor = (input.actorRole ?? actor?.role) === 'customer' || (input.actorRole ?? actor?.role) === 'user';
      const requestedLines = (input.requestedLines ?? []).map((line) => {
        const current = aggregate.lines.find((item) => item.id === line.lineId);
        return {
          ...line,
          originalQuantity: line.originalQuantity ?? current?.quantity,
          originalDiscountPercent: line.originalDiscountPercent ?? current?.discountPercent,
        };
      });
      if (customerActor) {
        for (const line of requestedLines) {
          const current = aggregate.lines.find((item) => item.id === line.lineId);
          if (!current) continue;
          if (line.action === 'remove') continue;
          if (line.quantity !== undefined) current.quantity = line.quantity;
        }
      }
      const now = new Date().toISOString();
      const request: NegotiationRequest = {
        id: crypto.randomUUID(),
        quoteId,
        customerId: aggregate.customer.id,
        actorId: input.actorId ?? actor?.id ?? null,
        actorRole: input.actorRole ?? actor?.role ?? 'customer',
        requestedDiscountPercent: input.requestedDiscountPercent ?? null,
        requestedTargetAmount: input.requestedTargetAmount ?? null,
        requestedLines,
        note: input.note.trim(),
        quoteVersion: aggregate.quote.version,
        status: 'open',
        createdAt: now,
        updatedAt: now,
      };
      const savedRequest = await store.saveNegotiation(request);
      aggregate.quote.activeNegotiationId = savedRequest.id;
      bumpVersion(aggregate);
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.negotiation_noted', quoteId, { newValue: savedRequest });
      await publish('negotiation.updated', quoteId, { negotiationId: savedRequest.id, status: savedRequest.status });
      await notify(
        uuidOrNull(saved.quote.ownerId),
        'Customer negotiation request',
        `${saved.quote.number}: ${savedRequest.note.slice(0, 140)}`,
        'warning',
      );
      return decorate(saved, assessment, actor);
    },

    async listNegotiationRequests(quoteId, actor) {
      const aggregate = await load(quoteId);
      if (actor?.role === 'user' || actor?.roles?.includes('user')) {
        const mine = await store.findCustomersByEmail(actor.email ?? '');
        if (!mine.some((item) => item.id === aggregate.customer.id)) {
          throw forbidden('You can only read negotiations for your own quotations');
        }
      }
      return store.listNegotiations(quoteId);
    },

    async respondToNegotiation(quoteId, negotiationId, input, actor) {
      const aggregate = await load(quoteId);
      assertExpectedVersion(aggregate, input.expectedVersion);
      const request = await store.getNegotiation(negotiationId);
      if (!request || request.quoteId !== quoteId) {
        throw notFound('Negotiation request not found', { negotiationId });
      }
      request.status = input.decision;
      request.responseNote = input.responseNote.trim();
      request.respondedBy = actor.id;
      request.respondedAt = new Date().toISOString();
      request.updatedAt = request.respondedAt;
      if (input.decision === 'accepted') {
        for (const line of request.requestedLines) {
          const current = aggregate.lines.find((item) => item.id === line.lineId);
          if (!current || line.action === 'remove') continue;
          if (line.quantity !== undefined) current.quantity = line.quantity;
          if (line.discountPercent !== undefined) {
            await assertCommercialWrite(aggregate, actor, [line.discountPercent]);
            current.discountPercent = line.discountPercent;
          }
        }
      }
      await store.saveNegotiation(request);
      aggregate.quote.activeNegotiationId = request.id;
      bumpVersion(aggregate);
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, `quote.negotiation_${input.decision}`, quoteId, {
        newValue: { negotiationId, decision: input.decision, responseNote: request.responseNote },
      });
      await publish('negotiation.updated', quoteId, { negotiationId, status: request.status });
      await notify(
        uuidOrNull(saved.quote.ownerId) ?? actor.id,
        input.decision === 'accepted' ? 'Negotiation request accepted' : input.decision === 'rejected' ? 'Negotiation request rejected' : 'Negotiation in review',
        `${saved.quote.number}: ${request.responseNote.slice(0, 140)}`,
        input.decision === 'rejected' ? 'warning' : 'success',
      );
      return decorate(saved, assessment, actor);
    },

    async sendNegotiationToManager(quoteId, negotiationId, actor, expectedVersion) {
      const aggregate = await load(quoteId);
      assertExpectedVersion(aggregate, expectedVersion);
      if (aggregate.quote.status !== 'draft' && aggregate.quote.status !== 'customer_negotiation') {
        throw conflict('Only an open quotation can be sent to a manager', { status: aggregate.quote.status });
      }
      assertTransition(aggregate.quote.status, 'manager_review');
      aggregate.quote.status = 'manager_review';
      if (negotiationId) {
        const request = await store.getNegotiation(negotiationId);
        if (!request || request.quoteId !== quoteId) {
          throw notFound('Negotiation request not found', { negotiationId });
        }
        request.status = 'sent_to_manager';
        request.updatedAt = new Date().toISOString();
        await store.saveNegotiation(request);
        aggregate.quote.activeNegotiationId = request.id;
      }
      bumpVersion(aggregate);
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.sent_to_manager', quoteId, { metadata: { negotiationId } });
      await publish('negotiation.updated', quoteId, { status: 'sent_to_manager' });
      return decorate(saved, assessment, actor);
    },

    async reviseAsManager(quoteId, input, actor) {
      assertManagerActor(actor);
      const aggregate = await load(quoteId);
      assertExpectedVersion(aggregate, input.expectedVersion);
      if (aggregate.quote.status !== 'manager_review') {
        throw conflict('Manager revisions are only allowed during manager review');
      }
      const before = {
        blendedDiscountPercent: aggregate.quote.blendedDiscountPercent,
        netTotal: aggregate.quote.netTotal,
      };
      const discounts: number[] = [];
      for (const change of input.lines ?? []) {
        const line = aggregate.lines.find((item) => item.id === change.lineId);
        if (!line) {
          throw notFound('Quote line not found', { lineId: change.lineId });
        }
        if (change.quantity !== undefined) line.quantity = change.quantity;
        if (change.discountPercent !== undefined) line.discountPercent = change.discountPercent;
        discounts.push(line.discountPercent);
        const product = await store.getProduct(change.productId ?? line.productId);
        if (product) {
          if (change.productId && change.productId !== line.productId) {
            line.productId = product.id;
            line.unitCost = product.cost;
          }
          line.listPrice = resolveUnitPrice({
            product,
            quantity: line.quantity,
            breaks: await store.listQuantityBreaks(),
            customerTier: aggregate.customer.tier,
          }).unitPrice;
        }
      }
      await assertCommercialWrite(aggregate, actor, discounts);
      if (aggregate.quote.activeNegotiationId) {
        const request = await store.getNegotiation(aggregate.quote.activeNegotiationId);
        if (request) {
          request.status = 'manager_revised';
          request.updatedAt = new Date().toISOString();
          await store.saveNegotiation(request);
        }
      }
      const reapprove = await maybeReapprove(aggregate, before, actor);
      finishMutation(aggregate, actor, reapprove.material);
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.manager_revised', quoteId, { metadata: input });
      await publish('negotiation.updated', quoteId, { status: 'manager_revised' });
      return decorate(saved, assessment, actor);
    },

    async returnRevisedQuote(quoteId, negotiationId, actor, expectedVersion) {
      assertManagerActor(actor);
      const aggregate = await load(quoteId);
      assertExpectedVersion(aggregate, expectedVersion);
      if (aggregate.quote.status !== 'manager_review') {
        throw conflict('Only a quotation in manager review can be returned to the customer');
      }
      assertTransition(aggregate.quote.status, 'customer_negotiation');
      aggregate.quote.status = 'customer_negotiation';
      const targetId = negotiationId ?? aggregate.quote.activeNegotiationId;
      if (targetId) {
        const request = await store.getNegotiation(targetId);
        if (request && request.quoteId === quoteId) {
          request.status = 'returned_to_customer';
          request.updatedAt = new Date().toISOString();
          await store.saveNegotiation(request);
        }
      }
      bumpVersion(aggregate);
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.returned_to_customer', quoteId);
      await publish('negotiation.updated', quoteId, { status: 'returned_to_customer' });
      await dispatchCustomerQuoteEmail(saved, 'prelim_invoice', actor);
      return decorate(saved, assessment, actor);
    },

    async agreeToFinal(quoteId, input, actor) {
      const aggregate = await load(quoteId);
      assertExpectedVersion(aggregate, input.expectedVersion);
      if (
        aggregate.quote.status !== 'draft' &&
        aggregate.quote.status !== 'customer_negotiation' &&
        aggregate.quote.status !== 'manager_review' &&
        aggregate.quote.status !== 'finalized'
      ) {
        throw conflict('This quotation is not waiting for customer confirmation');
      }
      const latest = (await store.listNegotiations(quoteId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
      if (latest && (latest.status === 'open' || latest.status === 'in_review' || latest.status === 'sent_to_manager')) {
        throw conflict('Confirm the quotation after the sales team returns a revision or accepts the request');
      }
      if (latest) {
        latest.status = 'agreed';
        latest.updatedAt = new Date().toISOString();
        await store.saveNegotiation(latest);
        aggregate.quote.activeNegotiationId = latest.id;
      }
      aggregate.quote.customerDecision = 'accepted';
      aggregate.quote.customerDecisionAt = new Date().toISOString();
      aggregate.quote.customerDecisionVersion = aggregate.quote.version;
      bumpVersion(aggregate);
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.customer_agreed', quoteId, {
        newValue: { version: saved.quote.customerDecisionVersion, decision: 'accepted' },
      });
      await publish('negotiation.updated', quoteId, { status: 'agreed', decision: 'accepted' });
      await notify(
        uuidOrNull(saved.quote.ownerId) ?? actor?.id,
        'Customer confirmed quotation',
        `${saved.quote.number} was confirmed on version ${saved.quote.customerDecisionVersion}.`,
        'success',
      );
      return decorate(saved, assessment, actor);
    },

    async finalizeQuotation(quoteId, actor, expectedVersion) {
      assertManagerActor(actor);
      const aggregate = await load(quoteId);
      assertExpectedVersion(aggregate, expectedVersion);
      if (aggregate.quote.status !== 'manager_review' && aggregate.quote.status !== 'customer_negotiation') {
        throw conflict(`A quotation can only be finalized from review (status ${aggregate.quote.status})`);
      }
      if (aggregate.lines.length === 0) {
        throw invalid('A quotation needs at least one line before it can be finalized');
      }
      assertTransition(aggregate.quote.status, 'finalized');
      aggregate.quote.status = 'finalized';
      aggregate.quote.commerciallyFrozenAt = new Date().toISOString();
      aggregate.quote.commerciallyFrozenBy = actor.id;
      appendRevision(aggregate, actor, true);
      bumpVersion(aggregate);
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.finalized', quoteId, { newValue: { status: 'finalized' } });
      await publish('quote.updated', quoteId, { status: 'finalized' });
      await dispatchCustomerQuoteEmail(saved, 'prelim_invoice', actor);
      return decorate(saved, assessment, actor);
    },

    async lockDeal(quoteId, actor, expectedVersion) {
      return this.confirm(quoteId, actor, expectedVersion);
    },

    async createPortalNegotiation(token, input) {
      const aggregate = await store.getQuoteByToken(token);
      if (!aggregate) {
        throw notFound('Quote portal token is invalid');
      }
      return this.createNegotiationRequest(
        aggregate.quote.id,
        {
          ...input,
          actorId: null,
          actorRole: 'customer',
        },
        { id: 'portal', role: 'user' },
      );
    },

    async applyPortalChange(token, input) {
      const aggregate = await store.getQuoteByToken(token);
      if (!aggregate) {
        throw notFound('Quote portal token is invalid');
      }
      assertExpectedVersion(aggregate, input.expectedVersion);
      if (aggregate.quote.status !== 'customer_negotiation' && aggregate.quote.status !== 'draft') {
        throw conflict('This quote is not open for customer negotiation');
      }
      if (aggregate.quote.status === 'draft') {
        assertTransition(aggregate.quote.status, 'customer_negotiation');
        aggregate.quote.status = 'customer_negotiation';
      }
      const before = {
        blendedDiscountPercent: aggregate.quote.blendedDiscountPercent,
        netTotal: aggregate.quote.netTotal,
        lines: aggregate.lines.map((line) => ({ ...line })),
      };
      const requestedDiscounts: number[] = [];
      for (const change of input.lines) {
        const line = aggregate.lines.find((item) => item.id === change.lineId);
        if (!line) {
          throw notFound('Quote line not found', { lineId: change.lineId });
        }
        if (change.quantity !== undefined) line.quantity = change.quantity;
        if (change.discountPercent !== undefined) {
          requestedDiscounts.push(change.discountPercent);
        }
        const product = await store.getProduct(line.productId);
        if (product) {
          line.listPrice = resolveUnitPrice({
            product,
            quantity: line.quantity,
            breaks: await store.listQuantityBreaks(),
            customerTier: aggregate.customer.tier,
          }).unitPrice;
        }
      }
      const actor = { id: 'portal', role: 'user' };
      if (requestedDiscounts.length) {
        const now = new Date().toISOString();
        const request = await store.saveNegotiation({
          id: crypto.randomUUID(),
          quoteId: aggregate.quote.id,
          customerId: aggregate.customer.id,
          actorId: null,
          actorRole: 'customer',
          requestedDiscountPercent: Math.max(...requestedDiscounts),
          requestedTargetAmount: null,
          requestedLines: input.lines.map((line) => ({
            lineId: line.lineId,
            quantity: line.quantity,
            discountPercent: line.discountPercent,
            action: 'update',
          })),
          note: `Requested line discounts: ${requestedDiscounts.join(', ')}%`,
          status: 'open',
          createdAt: now,
          updatedAt: now,
        });
        aggregate.quote.activeNegotiationId = request.id;
      }
      const reapprove = await maybeReapprove(aggregate, before, actor);
      finishMutation(aggregate, actor, reapprove.material);
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.negotiated', saved.quote.id, {
        oldValue: before,
        newValue: { lines: saved.lines, status: saved.quote.status },
        metadata: { material: reapprove.material },
      });
      await publish('negotiation.updated', saved.quote.id, { status: saved.quote.status });
      await notify(
        uuidOrNull(saved.quote.ownerId),
        'Customer negotiation received',
        `${saved.quote.number} was updated from the portal.`,
        'warning',
      );
      const presented = await decorate(saved, assessment, actor);
      return portalPayloadFromPresented(presented);
    },

    async recommendations(quoteId) {
      const aggregate = await load(quoteId);
      const [products, relations] = await Promise.all([store.listProducts(), store.listRelations()]);
      return recommendProducts({ lines: aggregate.lines, products, relations });
    },

    async applyRecommendation(quoteId, relationId, actor, expectedVersion) {
      const aggregate = await load(quoteId);
      assertExpectedVersion(aggregate, expectedVersion);
      await assertCommercialWrite(aggregate, actor, [0]);
      const relations = await store.listRelations();
      const relation = relations.find((item) => item.id === relationId);
      if (!relation) {
        throw notFound('Recommendation rule not found', { relationId });
      }
      const recommendations = recommendProducts({
        lines: aggregate.lines,
        products: await store.listProducts(),
        relations,
      });
      if (!recommendations.some((item) => item.relationId === relationId)) {
        throw conflict('Recommendation is not applicable to the current quote');
      }
      const before = {
        blendedDiscountPercent: aggregate.quote.blendedDiscountPercent,
        netTotal: aggregate.quote.netTotal,
      };
      const line = await toLine(store, quoteId, {
        productId: relation.recommendedProductId,
        quantity: 1,
        discountPercent: 0,
      });
      line.recommendedFromId = relation.id;
      aggregate.lines.push(line);
      const reapprove = await maybeReapprove(aggregate, before, actor);
      finishMutation(aggregate, actor, reapprove.material);
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.recommendation_applied', quoteId, {
        metadata: { relationId, material: reapprove.material },
        newValue: { netTotal: assessment.netTotal, marginPercent: assessment.marginPercent },
      });
      return decorate(saved, assessment, actor);
    },

    async planFulfillment(quoteId, overrides, actor, expectedVersion) {
      const aggregate = await load(quoteId);
      assertExpectedVersion(aggregate, expectedVersion);
      if (!isOpenForPlanning(aggregate.quote.status)) {
        throw conflict(`Fulfillment cannot be planned while status is ${aggregate.quote.status}`);
      }
      const [warehouses, stock] = await Promise.all([store.listWarehouses(), store.listStock()]);
      const plan = planFulfillment({
        quoteId,
        lines: aggregate.lines,
        products: aggregate.products,
        warehouses,
        stock,
        overrides,
      });
      const productByLineId = Object.fromEntries(aggregate.lines.map((line) => [line.id, line.productId]));
      const reserved = reserveStock({
        stock,
        productByLineId,
        previous: aggregate.allocations,
        next: plan.allocations,
      });
      await store.replaceStock(reserved);
      aggregate.allocations = plan.allocations;
      aggregate.backorders = plan.backorders;
      if (aggregate.quote.status === 'confirmed') {
        assertTransition(aggregate.quote.status, 'fulfillment');
        aggregate.quote.status = 'fulfillment';
      }
      bumpVersion(aggregate);
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.fulfillment_planned', quoteId, {
        newValue: {
          shipmentCount: plan.shipmentCount,
          fulfillmentCost: plan.fulfillmentCost,
          backorderQuantity: plan.backorderQuantity,
          overrides: overrides ?? [],
        },
      });
      return decorate(saved, assessment, actor);
    },

    async generateBilling(quoteId, actor, expectedVersion) {
      const aggregate = await load(quoteId);
      assertExpectedVersion(aggregate, expectedVersion);
      if (!isOpenForBilling(aggregate.quote.status)) {
        throw conflict(`Billing cannot be generated while status is ${aggregate.quote.status}`);
      }
      aggregate.schedules = buildBillingSchedules({
        quoteId,
        lines: aggregate.lines,
        products: aggregate.products,
      });
      if (aggregate.quote.status === 'confirmed' || aggregate.quote.status === 'fulfillment') {
        assertTransition(aggregate.quote.status, 'billing');
        aggregate.quote.status = 'billing';
      }
      bumpVersion(aggregate);
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.billing_generated', quoteId, { newValue: saved.schedules });
      return decorate(saved, assessment, actor);
    },

    async cancelBilling(quoteId, scheduleId, actor, expectedVersion) {
      const aggregate = await load(quoteId);
      assertExpectedVersion(aggregate, expectedVersion);
      const schedule = aggregate.schedules.find((item) => item.id === scheduleId);
      if (!schedule) {
        throw notFound('Billing schedule not found', { scheduleId });
      }
      const cancelled = cancelSchedule({ schedule });
      aggregate.schedules = aggregate.schedules.map((item) => (item.id === scheduleId ? cancelled : item));
      bumpVersion(aggregate);
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.billing_cancelled', quoteId, {
        oldValue: schedule,
        newValue: cancelled,
      });
      return decorate(saved, assessment, actor);
    },

    async confirm(quoteId, actor, expectedVersion) {
      const aggregate = await load(quoteId);
      assertExpectedVersion(aggregate, expectedVersion);
      if (!actorHas(actor, 'dealflow.quotes.lock')) {
        throw forbidden('Only a finance manager can lock a quotation');
      }
      if (aggregate.quote.financeLockedAt) {
        await dispatchCustomerQuoteEmail(aggregate, 'final_invoice', actor);
        return decorate(aggregate, await refreshAssessment(aggregate), actor);
      }
      if (aggregate.quote.status !== 'approved') {
        throw conflict(`Quote cannot be locked from ${aggregate.quote.status}`);
      }
      if (!allRequiredApproved(aggregate.approvals)) {
        throw conflict('Quote still requires approval');
      }
      const assessment = await refreshAssessment(aggregate);
      if (assessment.decision === 'rejected') {
        throw conflict('Quote is outside reject ceilings');
      }
      const [stock] = await Promise.all([store.listStock()]);
      if (aggregate.allocations.length) {
        const productByLineId = Object.fromEntries(aggregate.lines.map((line) => [line.id, line.productId]));
        await store.replaceStock(
          consumeStockOnConfirm({
            stock,
            productByLineId,
            allocations: aggregate.allocations,
          }),
        );
      }
      assertTransition(aggregate.quote.status, 'confirmed');
      aggregate.quote.status = 'confirmed';
      aggregate.quote.financeLockedAt = new Date().toISOString();
      aggregate.quote.financeLockedBy = actor.id;
      if (aggregate.allocations.length) {
        assertTransition(aggregate.quote.status, 'fulfillment');
        aggregate.quote.status = 'fulfillment';
      }
      if (aggregate.schedules.length) {
        assertTransition(aggregate.quote.status, 'billing');
        aggregate.quote.status = 'billing';
      }
      bumpVersion(aggregate);
      if (options.odoo?.enabled && options.odoo.createSaleOrder) {
        try {
          aggregate.quote.odooSaleOrderId = await options.odoo.createSaleOrder({
            quoteNumber: aggregate.quote.number,
            customerName: aggregate.customer.name,
            netTotal: aggregate.quote.netTotal,
          });
        } catch (error) {
          await audit(actor, 'quote.odoo_sync_failed', quoteId, {
            metadata: { message: error instanceof Error ? error.message : 'Odoo sync failed' },
            status: 'failure',
          });
        }
      } else {
        await audit(actor, 'quote.odoo_not_configured', quoteId, {
          metadata: { configured: false },
        });
      }
      const { saved } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.confirmed', quoteId, {
        newValue: {
          status: saved.quote.status,
          odooSaleOrderId: saved.quote.odooSaleOrderId ?? null,
          financeLockedAt: saved.quote.financeLockedAt,
        },
      });
      await dispatchCustomerQuoteEmail(saved, 'final_invoice', actor);
      return decorate(saved, assessment, actor);
    },

    async complete(quoteId, actor, expectedVersion) {
      const aggregate = await load(quoteId);
      assertExpectedVersion(aggregate, expectedVersion);
      if (aggregate.quote.status !== 'billing' && aggregate.quote.status !== 'fulfillment' && aggregate.quote.status !== 'confirmed') {
        throw conflict(`Quote cannot be completed from ${aggregate.quote.status}`);
      }
      assertTransition(aggregate.quote.status === 'confirmed' ? 'confirmed' : aggregate.quote.status, 'completed');
      if (aggregate.quote.status === 'confirmed') {
        aggregate.quote.status = 'fulfillment';
      }
      if (aggregate.quote.status === 'fulfillment') {
        assertTransition('fulfillment', 'billing');
        aggregate.quote.status = 'billing';
      }
      assertTransition(aggregate.quote.status, 'completed');
      aggregate.quote.status = 'completed';
      bumpVersion(aggregate);
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.completed', quoteId);
      return decorate(saved, assessment, actor);
    },

    async applyPortalDecision(token, input) {
      if (input.action !== 'accepted' && input.action !== 'declined') {
        throw invalid('Customer decision must be accepted or declined');
      }
      const aggregate = await store.getQuoteByToken(token);
      if (!aggregate) {
        throw notFound('Quote portal token is invalid');
      }
      assertExpectedVersion(aggregate, input.expectedVersion);
      if (aggregate.quote.status !== 'draft' && aggregate.quote.status !== 'customer_negotiation' && aggregate.quote.status !== 'manager_review') {
        throw conflict('This quote is not open for customer acceptance');
      }
      if (aggregate.quote.customerDecision === input.action && aggregate.quote.customerDecisionVersion === aggregate.quote.version) {
        return portalPayloadFromPresented(await decorate(aggregate));
      }
      aggregate.quote.customerDecision = input.action;
      aggregate.quote.customerDecisionAt = new Date().toISOString();
      aggregate.quote.customerDecisionComment = input.comment ?? null;
      aggregate.quote.customerDecisionVersion = aggregate.quote.version;
      bumpVersion(aggregate);
      const actor = { id: 'portal', role: 'user' };
      const { saved } = await saveAssessed(aggregate, actor);
      await audit(actor, input.action === 'accepted' ? 'quote.customer_accepted' : 'quote.customer_declined', saved.quote.id, {
        newValue: {
          decision: input.action,
          comment: input.comment ?? null,
          version: saved.quote.customerDecisionVersion,
        },
      });
      await notify(
        uuidOrNull(saved.quote.ownerId),
        input.action === 'accepted' ? 'Customer accepted quotation' : 'Customer declined quotation',
        `${saved.quote.number} was ${input.action} on version ${saved.quote.customerDecisionVersion}.`,
        input.action === 'accepted' ? 'success' : 'warning',
      );
      await publish('negotiation.updated', saved.quote.id, { decision: input.action });
      return {
        ...portalPayloadFromPresented(await decorate(saved)),
        customerDecision: saved.quote.customerDecision,
        customerDecisionComment: saved.quote.customerDecisionComment,
      };
    },

    async listAnomalies() {
      return store.listAnomalies();
    },

    async disposeAnomaly(id, input, actor) {
      const existing = (await store.listAnomalies()).find((item) => item.id === id);
      if (!existing) {
        throw notFound('Anomaly not found', { id });
      }
      const next = await store.upsertAnomaly({
        ...existing,
        status: input.status,
        resolution: input.resolution ?? existing.resolution ?? null,
        resolverId: actor.id,
        updatedAt: new Date().toISOString(),
      });
      await audit(actor, 'anomaly.disposed', id, {
        resource: 'anomaly',
        oldValue: { status: existing.status },
        newValue: { status: next.status, resolution: next.resolution },
      });
      await publish('anomaly.updated', next.quoteId ?? undefined, { anomalyId: next.id, status: next.status });
      return next;
    },

    async customerQuotePdf(quoteId) {
      const aggregate = await load(quoteId);
      await refreshAssessment(aggregate);
      return renderCustomerQuotePdf(
        aggregate,
        computeTaxTotal(aggregate.lines, aggregate.products, await governanceOf()),
        aggregate.quote.financeLockedAt ? 'final_invoice' : 'prelim_invoice',
      );
    },

    async customerQuotePdfByToken(token) {
      const aggregate = await store.getQuoteByToken(token);
      if (!aggregate) {
        throw notFound('Quote portal token is invalid');
      }
      await refreshAssessment(aggregate);
      return renderCustomerQuotePdf(
        aggregate,
        computeTaxTotal(aggregate.lines, aggregate.products, await governanceOf()),
        aggregate.quote.financeLockedAt ? 'final_invoice' : 'prelim_invoice',
      );
    },

    async contactVendor(quoteId, input, actor) {
      const aggregate = await load(quoteId);
      const product = input.productId
        ? aggregate.products.find((item) => item.id === input.productId) ?? (await store.getProduct(input.productId))
        : undefined;
      await audit(actor, 'quote.vendor_contacted', quoteId, {
        metadata: { productId: input.productId, sku: product?.sku, message: input.message },
      });
      await notify(
        actor.id,
        'Vendor contact recorded',
        product
          ? `${aggregate.quote.number}: procurement note for ${product.sku} was recorded.`
          : `${aggregate.quote.number}: procurement note was recorded.`,
        'info',
      );
      return { recorded: true as const, delivered: false as const, channel: 'audit' as const, quoteId };
    },
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidOrNull(value: string | null | undefined): string | null {
  return value && UUID_PATTERN.test(value) ? value : null;
}

function portalPayloadFromPresented(presented: Record<string, unknown> & {
  id: string;
  number: string;
  status: string;
  listTotal: number;
  discountTotal: number;
  netTotal: number;
  blendedDiscountPercent: number;
  customer: { name: string };
  lines: Array<{
    id: string;
    quantity: number;
    listPrice: number;
    discountPercent: number;
    product?: { sku?: string; name?: string; billingType?: string | null } | null;
  }>;
}) {
  return toPortalView(presented);
}

async function toLine(
  store: DealflowStore,
  quoteId: string,
  input: LineInput,
  breaks?: QuantityBreak[],
): Promise<QuoteLine> {
  if (input.quantity <= 0) {
    throw invalid('Quantity must be greater than zero');
  }
  if (input.discountPercent < 0 || input.discountPercent > 100) {
    throw invalid('Discount percent must be between 0 and 100');
  }
  const product = await store.getProduct(input.productId);
  if (!product) {
    throw notFound('Product not found', { productId: input.productId });
  }
  if (product.active === false) {
    throw invalid('Product is inactive', { productId: input.productId });
  }
  return {
    id: crypto.randomUUID(),
    quoteId,
    productId: product.id,
    quantity: input.quantity,
    listPrice: resolveUnitPrice({
      product,
      quantity: input.quantity,
      breaks: breaks ?? (await store.listQuantityBreaks()),
    }).unitPrice,
    discountPercent: input.discountPercent,
    unitCost: product.cost,
  };
}
