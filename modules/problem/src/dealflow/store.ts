import { randomBytes } from 'node:crypto';

import {
  DEFAULT_CHAINS,
  DEFAULT_CUSTOMERS,
  DEFAULT_POLICIES,
  DEFAULT_PRODUCTS,
  DEFAULT_QUANTITY_BREAKS,
  DEFAULT_RELATIONS,
  DEFAULT_ROLE_AUTHORITIES,
  DEFAULT_STOCK,
  DEFAULT_WAREHOUSES,
} from './defaults';
import type {
  ApprovalChain,
  BillingSchedule,
  Customer,
  DiscountPolicy,
  FulfillmentSplit,
  GovernanceConfig,
  Product,
  ProductRelation,
  QuantityBreak,
  QuoteAggregate,
  QuoteApproval,
  QuoteLine,
  QuoteRevision,
  RoleAuthority,
  StockLevel,
  Warehouse,
  DealflowAnomaly,
  NegotiationRequest,
  QuoteEmailDelivery,
} from './types';
import { DEFAULT_GOVERNANCE } from './types';
import { persistCustomerTier } from './loyalty';

export interface DealflowStore {
  listCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | null>;
  findCustomersByEmail(email: string): Promise<Customer[]>;
  upsertCustomer(input: { id?: string; name: string; email: string; tier?: Customer['tier'] }): Promise<Customer>;
  deleteCustomer(id: string): Promise<void>;
  countCustomerQuotes(customerId: string): Promise<number>;
  countWonPurchases(customerId: string): Promise<number>;
  listProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  upsertProduct(product: Product): Promise<Product>;
  deleteProduct(id: string): Promise<void>;
  countProductQuoteLines(productId: string): Promise<number>;
  listWarehouses(): Promise<Warehouse[]>;
  upsertWarehouse(warehouse: Warehouse): Promise<Warehouse>;
  deleteWarehouse(id: string): Promise<void>;
  countWarehouseAllocations(warehouseId: string): Promise<number>;
  listStock(): Promise<StockLevel[]>;
  replaceStock(stock: StockLevel[]): Promise<void>;
  upsertStock(row: StockLevel): Promise<StockLevel[]>;
  deleteStock(warehouseId: string, productId: string): Promise<StockLevel[]>;
  listPolicies(): Promise<DiscountPolicy[]>;
  upsertPolicy(policy: DiscountPolicy): Promise<DiscountPolicy>;
  deletePolicy(id: string): Promise<void>;
  listChains(): Promise<ApprovalChain[]>;
  getChain(id: string): Promise<ApprovalChain | null>;
  upsertChain(chain: ApprovalChain): Promise<ApprovalChain>;
  deleteChain(id: string): Promise<void>;
  countChainApprovals(chainId: string): Promise<number>;
  listRelations(): Promise<ProductRelation[]>;
  upsertRelation(relation: ProductRelation): Promise<ProductRelation>;
  deleteRelation(id: string): Promise<void>;
  listQuantityBreaks(): Promise<QuantityBreak[]>;
  replaceQuantityBreaks(items: QuantityBreak[]): Promise<QuantityBreak[]>;
  listRoleAuthorities(): Promise<RoleAuthority[]>;
  replaceRoleAuthorities(items: RoleAuthority[]): Promise<RoleAuthority[]>;
  getGovernance(): Promise<GovernanceConfig>;
  replaceGovernance(config: GovernanceConfig): Promise<GovernanceConfig>;
  nextQuoteNumber(): Promise<string>;
  newPortalToken(): string;
  listQuoteSummaries(): Promise<QuoteAggregate[]>;
  getQuote(id: string): Promise<QuoteAggregate | null>;
  getQuoteByToken(token: string): Promise<QuoteAggregate | null>;
  saveQuote(aggregate: QuoteAggregate): Promise<QuoteAggregate>;
  deleteQuote(id: string): Promise<void>;
  listAnomalies(): Promise<DealflowAnomaly[]>;
  upsertAnomaly(item: DealflowAnomaly): Promise<DealflowAnomaly>;
  listNegotiations(quoteId: string): Promise<NegotiationRequest[]>;
  getNegotiation(id: string): Promise<NegotiationRequest | null>;
  saveNegotiation(item: NegotiationRequest): Promise<NegotiationRequest>;
  listQuoteEmails(quoteId: string): Promise<QuoteEmailDelivery[]>;
  findQuoteEmailByKey(idempotencyKey: string): Promise<QuoteEmailDelivery | null>;
  saveQuoteEmail(item: QuoteEmailDelivery): Promise<QuoteEmailDelivery>;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createMemoryStore(): DealflowStore {
  const customers = clone(DEFAULT_CUSTOMERS);
  const products = clone(DEFAULT_PRODUCTS);
  const warehouses = clone(DEFAULT_WAREHOUSES);
  const stock = clone(DEFAULT_STOCK);
  const policies = clone(DEFAULT_POLICIES);
  const chains = clone(DEFAULT_CHAINS);
  const relations = clone(DEFAULT_RELATIONS);
  const quantityBreaks = clone(DEFAULT_QUANTITY_BREAKS);
  const roleAuthorities = clone(DEFAULT_ROLE_AUTHORITIES);
  let governance = clone(DEFAULT_GOVERNANCE);
  const quotes = new Map<string, QuoteAggregate>();
  const anomalies: DealflowAnomaly[] = [];
  const negotiations: NegotiationRequest[] = [];
  const emails: QuoteEmailDelivery[] = [];
  let quoteSeq = 0;

  const attach = (aggregate: QuoteAggregate): QuoteAggregate => {
    const customer = customers.find((item) => item.id === aggregate.quote.customerId);
    if (!customer) {
      throw new Error('Customer missing on quote');
    }
    return {
      ...clone(aggregate),
      customer: clone(customer),
      products: aggregate.lines
        .map((line) => products.find((item) => item.id === line.productId))
        .filter((item): item is Product => Boolean(item))
        .map((item) => clone(item)),
    };
  };

  return {
    async listCustomers() {
      return clone(customers);
    },
    async getCustomer(id) {
      return clone(customers.find((item) => item.id === id) ?? null);
    },
    async findCustomersByEmail(email) {
      const needle = email.trim().toLowerCase();
      return clone(customers.filter((item) => item.email.toLowerCase() === needle));
    },
    async upsertCustomer(input) {
      const needle = input.email.trim().toLowerCase();
      const byId = input.id ? customers.find((item) => item.id === input.id) : undefined;
      const existing = byId ?? customers.find((item) => item.email.toLowerCase() === needle);
      if (existing) {
        existing.name = input.name;
        existing.email = input.email.trim();
        if (input.tier) existing.tier = persistCustomerTier(input.tier);
        return clone(existing);
      }
      const created: Customer = {
        id: input.id ?? crypto.randomUUID(),
        name: input.name,
        email: input.email.trim(),
        tier: persistCustomerTier(input.tier ?? 'standard'),
      };
      customers.push(created);
      return clone(created);
    },
    async deleteCustomer(id) {
      const index = customers.findIndex((item) => item.id === id);
      if (index >= 0) customers.splice(index, 1);
    },
    async countCustomerQuotes(customerId) {
      return [...quotes.values()].filter((item) => item.quote.customerId === customerId).length;
    },
    async countWonPurchases(customerId) {
      return [...quotes.values()].filter(
        (item) =>
          item.quote.customerId === customerId &&
          ['confirmed', 'fulfillment', 'billing', 'completed'].includes(item.quote.status),
      ).length;
    },
    async listProducts() {
      return clone(products);
    },
    async getProduct(id) {
      return clone(products.find((item) => item.id === id) ?? null);
    },
    async upsertProduct(product) {
      const index = products.findIndex((item) => item.id === product.id);
      if (index >= 0) products[index] = clone(product);
      else products.push(clone(product));
      return clone(product);
    },
    async deleteProduct(id) {
      const index = products.findIndex((item) => item.id === id);
      if (index < 0) return;
      products.splice(index, 1);
      const nextStock = stock.filter((item) => item.productId !== id);
      stock.splice(0, stock.length, ...nextStock);
      const nextBreaks = quantityBreaks.filter((item) => item.productId !== id);
      quantityBreaks.splice(0, quantityBreaks.length, ...nextBreaks);
      const nextRelations = relations.filter((item) => item.productId !== id && item.recommendedProductId !== id);
      relations.splice(0, relations.length, ...nextRelations);
    },
    async countProductQuoteLines(productId) {
      let count = 0;
      for (const aggregate of quotes.values()) {
        count += aggregate.lines.filter((item) => item.productId === productId).length;
      }
      return count;
    },
    async listWarehouses() {
      return clone(warehouses);
    },
    async upsertWarehouse(warehouse) {
      const index = warehouses.findIndex((item) => item.id === warehouse.id);
      if (index >= 0) warehouses[index] = clone(warehouse);
      else warehouses.push(clone(warehouse));
      return clone(warehouse);
    },
    async deleteWarehouse(id) {
      const index = warehouses.findIndex((item) => item.id === id);
      if (index < 0) return;
      warehouses.splice(index, 1);
      const nextStock = stock.filter((item) => item.warehouseId !== id);
      stock.splice(0, stock.length, ...nextStock);
    },
    async countWarehouseAllocations(warehouseId) {
      let count = 0;
      for (const aggregate of quotes.values()) {
        count += (aggregate.allocations ?? []).filter((item) => item.warehouseId === warehouseId).length;
      }
      return count;
    },
    async listStock() {
      return clone(stock);
    },
    async replaceStock(next) {
      stock.splice(0, stock.length, ...clone(next));
    },
    async upsertStock(row) {
      const index = stock.findIndex((item) => item.warehouseId === row.warehouseId && item.productId === row.productId);
      if (index >= 0) stock[index] = clone(row);
      else stock.push(clone(row));
      return clone(stock);
    },
    async deleteStock(warehouseId, productId) {
      const next = stock.filter((item) => !(item.warehouseId === warehouseId && item.productId === productId));
      stock.splice(0, stock.length, ...next);
      return clone(stock);
    },
    async listPolicies() {
      return clone(policies);
    },
    async upsertPolicy(policy) {
      const index = policies.findIndex((item) => item.id === policy.id);
      if (index >= 0) policies[index] = clone(policy);
      else policies.push(clone(policy));
      return clone(policy);
    },
    async deletePolicy(id) {
      const index = policies.findIndex((item) => item.id === id);
      if (index >= 0) policies.splice(index, 1);
    },
    async listChains() {
      return clone(chains);
    },
    async getChain(id) {
      return clone(chains.find((item) => item.id === id) ?? null);
    },
    async upsertChain(chain) {
      const index = chains.findIndex((item) => item.id === chain.id);
      if (index >= 0) chains[index] = clone(chain);
      else chains.push(clone(chain));
      return clone(chain);
    },
    async deleteChain(id) {
      const index = chains.findIndex((item) => item.id === id);
      if (index >= 0) chains.splice(index, 1);
    },
    async countChainApprovals(chainId) {
      let count = 0;
      for (const aggregate of quotes.values()) {
        if (aggregate.quote.requiredChainId === chainId) count += 1;
        count += aggregate.approvals.filter((item) => item.chainId === chainId).length;
      }
      return count;
    },
    async listRelations() {
      return clone(relations);
    },
    async upsertRelation(relation) {
      const index = relations.findIndex((item) => item.id === relation.id);
      if (index >= 0) relations[index] = clone(relation);
      else relations.push(clone(relation));
      return clone(relation);
    },
    async deleteRelation(id) {
      const index = relations.findIndex((item) => item.id === id);
      if (index >= 0) relations.splice(index, 1);
    },
    async listQuantityBreaks() {
      return clone(quantityBreaks);
    },
    async replaceQuantityBreaks(items) {
      quantityBreaks.splice(0, quantityBreaks.length, ...clone(items));
      return clone(quantityBreaks);
    },
    async listRoleAuthorities() {
      return clone(roleAuthorities);
    },
    async replaceRoleAuthorities(items) {
      roleAuthorities.splice(0, roleAuthorities.length, ...clone(items));
      return clone(roleAuthorities);
    },
    async getGovernance() {
      return clone(governance);
    },
    async replaceGovernance(next) {
      governance = clone(next);
      return clone(governance);
    },
    async nextQuoteNumber() {
      quoteSeq += 1;
      return `DF-${String(quoteSeq).padStart(5, '0')}`;
    },
    newPortalToken() {
      return randomBytes(24).toString('hex');
    },
    async listQuoteSummaries() {
      return [...quotes.values()].map(attach);
    },
    async getQuote(id) {
      const found = quotes.get(id);
      return found ? attach(found) : null;
    },
    async getQuoteByToken(token) {
      const found = [...quotes.values()].find((item) => item.quote.portalToken === token);
      return found ? attach(found) : null;
    },
    async saveQuote(aggregate) {
      quotes.set(aggregate.quote.id, clone(aggregate));
      return attach(aggregate);
    },
    async deleteQuote(id) {
      quotes.delete(id);
      const nextNegotiations = negotiations.filter((item) => item.quoteId !== id);
      negotiations.splice(0, negotiations.length, ...nextNegotiations);
      const nextEmails = emails.filter((item) => item.quoteId !== id);
      emails.splice(0, emails.length, ...nextEmails);
      const nextAnomalies = anomalies.filter((item) => item.quoteId !== id);
      anomalies.splice(0, anomalies.length, ...nextAnomalies);
    },
    async listAnomalies() {
      return clone(anomalies);
    },
    async upsertAnomaly(item) {
      const index = anomalies.findIndex((row) => row.id === item.id);
      if (index >= 0) {
        anomalies[index] = clone(item);
      } else {
        anomalies.push(clone(item));
      }
      return clone(item);
    },
    async listNegotiations(quoteId) {
      return clone(negotiations.filter((item) => item.quoteId === quoteId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    },
    async getNegotiation(id) {
      return clone(negotiations.find((item) => item.id === id) ?? null);
    },
    async saveNegotiation(item) {
      const index = negotiations.findIndex((row) => row.id === item.id);
      if (index >= 0) negotiations[index] = clone(item);
      else negotiations.push(clone(item));
      return clone(item);
    },
    async listQuoteEmails(quoteId) {
      return clone(emails.filter((item) => item.quoteId === quoteId).sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    },
    async findQuoteEmailByKey(idempotencyKey) {
      return clone(emails.find((item) => item.idempotencyKey === idempotencyKey) ?? null);
    },
    async saveQuoteEmail(item) {
      const index = emails.findIndex((row) => row.id === item.id || row.idempotencyKey === item.idempotencyKey);
      if (index >= 0) emails[index] = clone(item);
      else emails.push(clone(item));
      return clone(item);
    },
  };
}

export function emptyAggregate(
  quote: QuoteAggregate['quote'],
  extras?: Partial<Pick<QuoteAggregate, 'lines' | 'approvals' | 'allocations' | 'backorders' | 'schedules' | 'revisions'>>,
): QuoteAggregate {
  return {
    quote,
    customer: {
      id: quote.customerId,
      name: '',
      email: '',
      tier: 'standard',
    },
    lines: extras?.lines ?? [],
    products: [],
    approvals: extras?.approvals ?? [],
    allocations: extras?.allocations ?? [],
    backorders: extras?.backorders ?? [],
    schedules: extras?.schedules ?? [],
    revisions: extras?.revisions ?? [],
  };
}

export type { QuoteLine, QuoteApproval, FulfillmentSplit, BillingSchedule, QuoteRevision };
