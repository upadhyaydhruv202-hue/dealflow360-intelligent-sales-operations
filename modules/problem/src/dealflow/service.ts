import {
  allRequiredApproved,
  applyApprovalDecision,
  autoApproveIfAllowed,
  buildApprovalSteps,
  invalidateApprovals,
} from './approval-engine';
import { buildBillingSchedules, cancelSchedule } from './billing-engine';
import { assessQuote, isMaterialChange } from './discount-engine';
import { conflict, invalid, notFound } from './errors';
import { consumeStockOnConfirm, planFulfillment, reserveStock } from './fulfillment-engine';
import { assertTransition, canMutateCommercials, isOpenForBilling, isOpenForPlanning } from './lifecycle';
import { recommendProducts } from './recommendation-engine';
import { emptyAggregate, type DealflowStore } from './store';
import type {
  Actor,
  GovernanceConfig,
  Quote,
  QuoteAggregate,
  QuoteAssessment,
  QuoteLine,
  Recommendation,
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
  }>;
  listQuotes(): Promise<unknown[]>;
  getQuote(id: string): Promise<unknown>;
  getQuoteByToken(token: string): Promise<unknown>;
  createQuote(input: { customerId: string; ownerId?: string; lines?: LineInput[] }, actor: Actor): Promise<unknown>;
  addLine(quoteId: string, input: LineInput, actor: Actor): Promise<unknown>;
  updateLine(quoteId: string, lineId: string, input: Partial<LineInput>, actor: Actor): Promise<unknown>;
  removeLine(quoteId: string, lineId: string, actor: Actor): Promise<unknown>;
  assess(quoteId: string): Promise<unknown>;
  submit(quoteId: string, actor: Actor): Promise<unknown>;
  decide(quoteId: string, approvalId: string, input: { decision: 'approved' | 'rejected'; reason: string }, actor: Actor): Promise<unknown>;
  startNegotiation(quoteId: string, actor: Actor): Promise<unknown>;
  applyPortalChange(token: string, input: { lines: Array<{ lineId: string; quantity?: number; discountPercent?: number }> }): Promise<unknown>;
  recommendations(quoteId: string): Promise<Recommendation[]>;
  applyRecommendation(quoteId: string, relationId: string, actor: Actor): Promise<unknown>;
  planFulfillment(quoteId: string, overrides: Array<{ quoteLineId: string; warehouseId: string; quantity: number }> | undefined, actor: Actor): Promise<unknown>;
  generateBilling(quoteId: string, actor: Actor): Promise<unknown>;
  cancelBilling(quoteId: string, scheduleId: string, actor: Actor): Promise<unknown>;
  confirm(quoteId: string, actor: Actor): Promise<unknown>;
  complete(quoteId: string, actor: Actor): Promise<unknown>;
}

interface LineInput {
  productId: string;
  quantity: number;
  discountPercent: number;
}

export function createDealflowService(options: {
  store: DealflowStore;
  audit?: DealflowAudit | null;
  config?: GovernanceConfig;
}): DealflowService {
  const store = options.store;
  const config = options.config ?? DEFAULT_GOVERNANCE;

  const audit = async (
    actor: Actor | undefined,
    action: string,
    resourceId: string,
    extra: { oldValue?: unknown; newValue?: unknown; metadata?: unknown; status?: string } = {},
  ) => {
    await options.audit?.record({
      actorId: actor?.id,
      action,
      resource: 'quote',
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

  const refreshAssessment = async (aggregate: QuoteAggregate): Promise<QuoteAssessment> => {
    const [policies, chains, catalogProducts] = await Promise.all([
      store.listPolicies(),
      store.listChains(),
      store.listProducts(),
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
      config,
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
    return assessment;
  };

  const present = (aggregate: QuoteAggregate, assessment?: QuoteAssessment) => ({
    ...aggregate.quote,
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
  });

  const saveAssessed = async (aggregate: QuoteAggregate) => {
    const assessment = await refreshAssessment(aggregate);
    aggregate.quote.updatedAt = new Date().toISOString();
    const saved = await store.saveQuote(aggregate);
    return { saved, assessment };
  };

  const requireMutable = (status: Quote['status']) => {
    if (!canMutateCommercials(status)) {
      throw conflict(`Quote commercials cannot change while status is ${status}`, { status });
    }
  };

  const appendRevision = (aggregate: QuoteAggregate, actor: Actor | undefined, materialChange: boolean) => {
    aggregate.quote.version += 1;
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
    const assessment = await refreshAssessment(aggregate);
    const material = isMaterialChange(before, assessment, config);
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
      aggregate.approvals = [...previous, ...buildApprovalSteps(aggregate.quote.id, chain)];
      assertTransition(aggregate.quote.status, 'approval_required');
      aggregate.quote.status = 'approval_required';
    }
    appendRevision(aggregate, actor, true);
    return { assessment, material: true };
  };

  return {
    async catalog() {
      const [customers, products, warehouses, stock, policies, chains] = await Promise.all([
        store.listCustomers(),
        store.listProducts(),
        store.listWarehouses(),
        store.listStock(),
        store.listPolicies(),
        store.listChains(),
      ]);
      return { customers, products, warehouses, stock, policies, chains };
    },

    async listQuotes() {
      const quotes = await store.listQuoteSummaries();
      return quotes.map((item) => present(item));
    },

    async getQuote(id) {
      const aggregate = await load(id);
      const assessment = await refreshAssessment(aggregate);
      return present(aggregate, assessment);
    },

    async getQuoteByToken(token) {
      const aggregate = await store.getQuoteByToken(token);
      if (!aggregate) {
        throw notFound('Quote portal token is invalid');
      }
      const assessment = await refreshAssessment(aggregate);
      return present(aggregate, assessment);
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
        createdAt: now,
        updatedAt: now,
      };
      const lines: QuoteLine[] = [];
      for (const line of input.lines ?? []) {
        lines.push(await toLine(store, quote.id, line));
      }
      const aggregate = emptyAggregate(quote, { lines });
      aggregate.customer = customer;
      const { saved, assessment } = await saveAssessed(aggregate);
      await audit(actor, 'quote.created', saved.quote.id, { newValue: present(saved, assessment) });
      return present(saved, assessment);
    },

    async addLine(quoteId, input, actor) {
      const aggregate = await load(quoteId);
      requireMutable(aggregate.quote.status);
      const before = {
        blendedDiscountPercent: aggregate.quote.blendedDiscountPercent,
        netTotal: aggregate.quote.netTotal,
      };
      aggregate.lines.push(await toLine(store, quoteId, input));
      const reapprove = await maybeReapprove(aggregate, before, actor);
      const { saved, assessment } = await saveAssessed(aggregate);
      await audit(actor, 'quote.line_added', quoteId, {
        metadata: input,
        newValue: { decision: assessment.decision, material: reapprove.material },
      });
      return present(saved, assessment);
    },

    async updateLine(quoteId, lineId, input, actor) {
      const aggregate = await load(quoteId);
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
      if (input.productId && input.productId !== line.productId) {
        const replacement = await toLine(store, quoteId, {
          productId: input.productId,
          quantity: line.quantity,
          discountPercent: line.discountPercent,
        });
        line.productId = replacement.productId;
        line.listPrice = replacement.listPrice;
        line.unitCost = replacement.unitCost;
      }
      const reapprove = await maybeReapprove(aggregate, before, actor);
      const { saved, assessment } = await saveAssessed(aggregate);
      await audit(actor, 'quote.discount_changed', quoteId, {
        oldValue: before.line,
        newValue: line,
        metadata: { material: reapprove.material },
      });
      return present(saved, assessment);
    },

    async removeLine(quoteId, lineId, actor) {
      const aggregate = await load(quoteId);
      requireMutable(aggregate.quote.status);
      const before = {
        blendedDiscountPercent: aggregate.quote.blendedDiscountPercent,
        netTotal: aggregate.quote.netTotal,
      };
      aggregate.lines = aggregate.lines.filter((item) => item.id !== lineId);
      const reapprove = await maybeReapprove(aggregate, before, actor);
      const { saved, assessment } = await saveAssessed(aggregate);
      await audit(actor, 'quote.line_removed', quoteId, { metadata: { lineId, material: reapprove.material } });
      return present(saved, assessment);
    },

    async assess(quoteId) {
      const aggregate = await load(quoteId);
      const assessment = await refreshAssessment(aggregate);
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
      const assessment = await refreshAssessment(aggregate);
      if (assessment.decision === 'rejected') {
        throw conflict('Quote exceeds reject ceilings and cannot be submitted', { reasons: assessment.reasons });
      }
      const chains = await store.listChains();
      const chain = assessment.requiredChainId
        ? chains.find((item) => item.id === assessment.requiredChainId)
        : undefined;
      aggregate.approvals = autoApproveIfAllowed(quoteId, assessment, chain, actor);

      if (assessment.decision === 'allowed' || assessment.decision === 'warning') {
        assertTransition(aggregate.quote.status, 'approved');
        aggregate.quote.status = 'approved';
      } else {
        assertTransition(aggregate.quote.status, 'approval_required');
        aggregate.quote.status = 'approval_required';
      }

      const { saved } = await saveAssessed(aggregate);
      await audit(actor, 'quote.submitted', quoteId, {
        newValue: { status: saved.quote.status, decision: assessment.decision, chainId: assessment.requiredChainId },
      });
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

      const { saved, assessment } = await saveAssessed(aggregate);
      return present(saved, assessment);
    },

    async startNegotiation(quoteId, actor) {
      const aggregate = await load(quoteId);
      if (aggregate.quote.status !== 'approved') {
        throw conflict('Only approved quotes can enter customer negotiation');
      }
      assertTransition(aggregate.quote.status, 'customer_negotiation');
      aggregate.quote.status = 'customer_negotiation';
      const { saved, assessment } = await saveAssessed(aggregate);
      await audit(actor, 'quote.negotiation_started', quoteId, { newValue: { status: 'customer_negotiation' } });
      return present(saved, assessment);
    },

    async applyPortalChange(token, input) {
      const aggregate = await store.getQuoteByToken(token);
      if (!aggregate) {
        throw notFound('Quote portal token is invalid');
      }
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
      }
      const actor = { id: 'portal', role: 'user' };
      const reapprove = await maybeReapprove(aggregate, before, actor);
      const { saved, assessment } = await saveAssessed(aggregate);
      await audit(actor, 'quote.negotiated', saved.quote.id, {
        oldValue: before,
        newValue: { lines: saved.lines, status: saved.quote.status },
        metadata: { material: reapprove.material },
      });
      return present(saved, assessment);
    },

    async recommendations(quoteId) {
      const aggregate = await load(quoteId);
      const [products, relations] = await Promise.all([store.listProducts(), store.listRelations()]);
      return recommendProducts({ lines: aggregate.lines, products, relations });
    },

    async applyRecommendation(quoteId, relationId, actor) {
      const aggregate = await load(quoteId);
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
      const { saved, assessment } = await saveAssessed(aggregate);
      await audit(actor, 'quote.recommendation_applied', quoteId, {
        metadata: { relationId, material: reapprove.material },
        newValue: { netTotal: assessment.netTotal, marginPercent: assessment.marginPercent },
      });
      return present(saved, assessment);
    },

    async planFulfillment(quoteId, overrides, actor) {
      const aggregate = await load(quoteId);
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
      const { saved, assessment } = await saveAssessed(aggregate);
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

    async generateBilling(quoteId, actor) {
      const aggregate = await load(quoteId);
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
      const { saved, assessment } = await saveAssessed(aggregate);
      await audit(actor, 'quote.billing_generated', quoteId, { newValue: saved.schedules });
      return present(saved, assessment);
    },

    async cancelBilling(quoteId, scheduleId, actor) {
      const aggregate = await load(quoteId);
      const schedule = aggregate.schedules.find((item) => item.id === scheduleId);
      if (!schedule) {
        throw notFound('Billing schedule not found', { scheduleId });
      }
      const cancelled = cancelSchedule({ schedule });
      aggregate.schedules = aggregate.schedules.map((item) => (item.id === scheduleId ? cancelled : item));
      const { saved, assessment } = await saveAssessed(aggregate);
      await audit(actor, 'quote.billing_cancelled', quoteId, {
        oldValue: schedule,
        newValue: cancelled,
      });
      return present(saved, assessment);
    },

    async confirm(quoteId, actor) {
      const aggregate = await load(quoteId);
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
      const { saved } = await saveAssessed(aggregate);
      await audit(actor, 'quote.confirmed', quoteId, { newValue: { status: saved.quote.status } });
      return present(saved, assessment);
    },

    async complete(quoteId, actor) {
      const aggregate = await load(quoteId);
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
      const { saved, assessment } = await saveAssessed(aggregate);
      await audit(actor, 'quote.completed', quoteId);
      return present(saved, assessment);
    },
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidOrNull(value: string | null | undefined): string | null {
  return value && UUID_PATTERN.test(value) ? value : null;
}

async function toLine(store: DealflowStore, quoteId: string, input: LineInput): Promise<QuoteLine> {
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
    listPrice: product.listPrice,
    discountPercent: input.discountPercent,
    unitCost: product.cost,
  };
}
