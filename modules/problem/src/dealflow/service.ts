import {
  allRequiredApproved,
  applyApprovalDecision,
  autoApproveIfAllowed,
  buildApprovalSteps,
  invalidateApprovals,
} from './approval-engine';
import { buildBillingSchedules, cancelSchedule } from './billing-engine';
import { assessQuote, isMaterialChange, selectRoleAuthority } from './discount-engine';
import { conflict, forbidden, invalid, notFound } from './errors';
import { validateGovernance, validateQuantityBreaks, validateRoleAuthorities } from './governance-config';
import { consumeStockOnConfirm, planFulfillment, reserveStock } from './fulfillment-engine';
import { resolveUnitPrice } from './pricing-engine';
import { assertTransition, canMutateCommercials, isOpenForBilling, isOpenForPlanning } from './lifecycle';
import { detectQuoteAnomalies } from './anomaly-engine';
import { computeDealHealth } from './health-engine';
import { toPortalView } from './portal-view';
import { renderCustomerQuotePdf } from './quote-pdf';
import { recommendProducts } from './recommendation-engine';
import { emptyAggregate, type DealflowStore } from './store';
import { computeTaxTotal } from './tax-engine';
import type {
  Actor,
  AnomalyStatus,
  CustomerDecision,
  DealflowAnomaly,
  GovernanceConfig,
  QuantityBreak,
  Quote,
  QuoteAggregate,
  QuoteAssessment,
  QuoteLine,
  Recommendation,
  RoleAuthority,
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
    quantityBreaks: QuantityBreak[];
    roleAuthorities: RoleAuthority[];
    governance: GovernanceConfig;
  }>;
  replaceQuantityBreaks(items: QuantityBreak[], actor: Actor): Promise<QuantityBreak[]>;
  replaceRoleAuthorities(items: RoleAuthority[], actor: Actor): Promise<RoleAuthority[]>;
  updateGovernance(input: Partial<GovernanceConfig>, actor: Actor): Promise<GovernanceConfig>;
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
  applyPortalChange(token: string, input: { expectedVersion: number; lines: Array<{ lineId: string; quantity?: number; discountPercent?: number }> }): Promise<unknown>;
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

export function createDealflowService(options: {
  store: DealflowStore;
  audit?: DealflowAudit | null;
  config?: GovernanceConfig;
  notify?: DealflowNotify['notify'] | null;
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

  const refreshAssessment = async (aggregate: QuoteAggregate, actor?: Actor): Promise<QuoteAssessment> => {
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
      actor,
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

  const present = (aggregate: QuoteAggregate, assessment?: QuoteAssessment) => {
    const taxTotal = aggregate.quote.taxTotal ?? 0;
    return {
      ...aggregate.quote,
      taxTotal,
      grandTotal: aggregate.quote.netTotal + taxTotal,
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

  const requireMutable = (status: Quote['status']) => {
    if (!canMutateCommercials(status)) {
      throw conflict(`Quote commercials cannot change while status is ${status}`, { status });
    }
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
    if (aggregate.quote.status === 'approved' || aggregate.quote.status === 'customer_negotiation') {
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
      const [customers, products, warehouses, stock, policies, chains, rules] = await Promise.all([
        store.listCustomers(),
        store.listProducts(),
        store.listWarehouses(),
        store.listStock(),
        store.listPolicies(),
        store.listChains(),
        pricingRulesOf(),
      ]);
      return {
        customers,
        products,
        warehouses,
        stock,
        policies,
        chains,
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

    async listQuotes() {
      const quotes = await store.listQuoteSummaries();
      return quotes.map((item) => present(item));
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
      return store.upsertCustomer({
        name: input.companyName?.trim() || input.displayName.trim() || input.email,
        email: input.email,
      });
    },

    async getQuote(id, actor) {
      const aggregate = await load(id);
      const assessment = await refreshAssessment(aggregate, actor);
      return present(aggregate, assessment);
    },

    async getQuoteByToken(token) {
      const aggregate = await store.getQuoteByToken(token);
      if (!aggregate) {
        throw notFound('Quote portal token is invalid');
      }
      await refreshAssessment(aggregate);
      return portalPayload(aggregate);
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
      for (const line of input.lines ?? []) {
        lines.push(await toLine(store, quote.id, line, breaks));
      }
      const aggregate = emptyAggregate(quote, { lines });
      aggregate.customer = customer;
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.created', saved.quote.id, { newValue: present(saved, assessment) });
      return present(saved, assessment);
    },

    async addLine(quoteId, input, actor) {
      const aggregate = await load(quoteId);
      assertExpectedVersion(aggregate, input.expectedVersion);
      requireMutable(aggregate.quote.status);
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
      return present(saved, assessment);
    },

    async updateLine(quoteId, lineId, input, actor) {
      const aggregate = await load(quoteId);
      assertExpectedVersion(aggregate, input.expectedVersion);
      requireMutable(aggregate.quote.status);
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
      const reapprove = await maybeReapprove(aggregate, before, actor);
      finishMutation(aggregate, actor, reapprove.material);
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.discount_changed', quoteId, {
        oldValue: before.line,
        newValue: line,
        metadata: { material: reapprove.material },
      });
      return present(saved, assessment);
    },

    async removeLine(quoteId, lineId, input, actor) {
      const aggregate = await load(quoteId);
      assertExpectedVersion(aggregate, input.expectedVersion);
      requireMutable(aggregate.quote.status);
      const before = {
        blendedDiscountPercent: aggregate.quote.blendedDiscountPercent,
        netTotal: aggregate.quote.netTotal,
      };
      aggregate.lines = aggregate.lines.filter((item) => item.id !== lineId);
      const reapprove = await maybeReapprove(aggregate, before, actor);
      finishMutation(aggregate, actor, reapprove.material);
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.line_removed', quoteId, { metadata: { lineId, material: reapprove.material } });
      return present(saved, assessment);
    },

    async assess(quoteId, actor) {
      const aggregate = await load(quoteId);
      const assessment = await refreshAssessment(aggregate, actor);
      await store.saveQuote(aggregate);
      return present(aggregate, assessment);
    },

    async submit(quoteId, actor) {
      const aggregate = await load(quoteId);
      if (aggregate.quote.status !== 'draft' && aggregate.quote.status !== 'rejected') {
        throw conflict(`Only draft or rejected quotes can be submitted (status ${aggregate.quote.status})`);
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
      return present(saved, assessment);
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
      return present(saved, assessment);
    },

    async startNegotiation(quoteId, actor) {
      const aggregate = await load(quoteId);
      const authority = selectRoleAuthority(await store.listRoleAuthorities(), actor);
      if (authority && !authority.canNegotiate) {
        throw forbidden('Your role is not authorized to open customer negotiation');
      }
      if (aggregate.quote.status !== 'approved') {
        throw conflict('Only approved quotes can enter customer negotiation');
      }
      assertTransition(aggregate.quote.status, 'customer_negotiation');
      aggregate.quote.status = 'customer_negotiation';
      bumpVersion(aggregate);
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.negotiation_started', quoteId, { newValue: { status: 'customer_negotiation' } });
      return present(saved, assessment);
    },

    async applyPortalChange(token, input) {
      const aggregate = await store.getQuoteByToken(token);
      if (!aggregate) {
        throw notFound('Quote portal token is invalid');
      }
      assertExpectedVersion(aggregate, input.expectedVersion);
      if (aggregate.quote.status !== 'customer_negotiation' && aggregate.quote.status !== 'approved') {
        throw conflict('This quote is not open for customer negotiation');
      }
      if (aggregate.quote.status === 'approved') {
        assertTransition(aggregate.quote.status, 'customer_negotiation');
        aggregate.quote.status = 'customer_negotiation';
      }
      const before = {
        blendedDiscountPercent: aggregate.quote.blendedDiscountPercent,
        netTotal: aggregate.quote.netTotal,
        lines: aggregate.lines.map((line) => ({ ...line })),
      };
      for (const change of input.lines) {
        const line = aggregate.lines.find((item) => item.id === change.lineId);
        if (!line) {
          throw notFound('Quote line not found', { lineId: change.lineId });
        }
        if (change.quantity !== undefined) line.quantity = change.quantity;
        if (change.discountPercent !== undefined) line.discountPercent = change.discountPercent;
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
      const reapprove = await maybeReapprove(aggregate, before, actor);
      finishMutation(aggregate, actor, reapprove.material);
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.negotiated', saved.quote.id, {
        oldValue: before,
        newValue: { lines: saved.lines, status: saved.quote.status },
        metadata: { material: reapprove.material },
      });
      await notify(
        uuidOrNull(saved.quote.ownerId),
        'Customer negotiation received',
        `${saved.quote.number} was updated from the portal${reapprove.material ? ' and requires re-approval' : ''}.`,
        'warning',
      );
      return present(saved, assessment);
    },

    async recommendations(quoteId) {
      const aggregate = await load(quoteId);
      const [products, relations] = await Promise.all([store.listProducts(), store.listRelations()]);
      return recommendProducts({ lines: aggregate.lines, products, relations });
    },

    async applyRecommendation(quoteId, relationId, actor, expectedVersion) {
      const aggregate = await load(quoteId);
      assertExpectedVersion(aggregate, expectedVersion);
      if (
        aggregate.quote.status !== 'draft' &&
        aggregate.quote.status !== 'rejected' &&
        aggregate.quote.status !== 'approved' &&
        aggregate.quote.status !== 'customer_negotiation'
      ) {
        throw conflict(`Recommendations cannot be applied while status is ${aggregate.quote.status}`, {
          status: aggregate.quote.status,
        });
      }
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
      const { saved, assessment } = await saveAssessed(aggregate, actor);
      await audit(actor, 'quote.recommendation_applied', quoteId, {
        metadata: { relationId, material: reapprove.material },
        newValue: { netTotal: assessment.netTotal, marginPercent: assessment.marginPercent },
      });
      return present(saved, assessment);
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
      return present(saved, assessment);
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
      return present(saved, assessment);
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
      return present(saved, assessment);
    },

    async confirm(quoteId, actor, expectedVersion) {
      const aggregate = await load(quoteId);
      assertExpectedVersion(aggregate, expectedVersion);
      if (aggregate.quote.status !== 'approved' && aggregate.quote.status !== 'customer_negotiation') {
        throw conflict(`Quote cannot be confirmed from ${aggregate.quote.status}`);
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
        newValue: { status: saved.quote.status, odooSaleOrderId: saved.quote.odooSaleOrderId ?? null },
      });
      return present(saved, assessment);
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
      return present(saved, assessment);
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
      if (aggregate.quote.status !== 'approved' && aggregate.quote.status !== 'customer_negotiation') {
        throw conflict('This quote is not open for customer acceptance');
      }
      if (aggregate.quote.customerDecision === input.action && aggregate.quote.customerDecisionVersion === aggregate.quote.version) {
        return portalPayload(aggregate);
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
        ...portalPayload(saved),
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
      return renderCustomerQuotePdf(aggregate, computeTaxTotal(aggregate.lines, aggregate.products, await governanceOf()));
    },

    async customerQuotePdfByToken(token) {
      const aggregate = await store.getQuoteByToken(token);
      if (!aggregate) {
        throw notFound('Quote portal token is invalid');
      }
      await refreshAssessment(aggregate);
      return renderCustomerQuotePdf(aggregate, computeTaxTotal(aggregate.lines, aggregate.products, await governanceOf()));
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

function portalPayload(aggregate: QuoteAggregate) {
  return toPortalView({
    ...aggregate.quote,
    customer: { name: aggregate.customer.name },
    lines: aggregate.lines.map((line) => ({
      ...line,
      product: aggregate.products.find((product) => product.id === line.productId) ?? null,
    })),
  });
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
