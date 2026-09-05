import { randomBytes } from 'node:crypto';

import {
  DEFAULT_CHAINS,
  DEFAULT_CUSTOMERS,
  DEFAULT_POLICIES,
  DEFAULT_PRODUCTS,
  DEFAULT_RELATIONS,
  DEFAULT_STOCK,
  DEFAULT_WAREHOUSES,
} from './defaults';
import type {
  ApprovalChain,
  BillingSchedule,
  Customer,
  DiscountPolicy,
  FulfillmentSplit,
  Product,
  ProductRelation,
  QuoteAggregate,
  QuoteApproval,
  QuoteLine,
  QuoteRevision,
  StockLevel,
  Warehouse,
} from './types';

export interface DealflowStore {
  listCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | null>;
  listProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | null>;
  listWarehouses(): Promise<Warehouse[]>;
  listStock(): Promise<StockLevel[]>;
  replaceStock(stock: StockLevel[]): Promise<void>;
  listPolicies(): Promise<DiscountPolicy[]>;
  listChains(): Promise<ApprovalChain[]>;
  getChain(id: string): Promise<ApprovalChain | null>;
  listRelations(): Promise<ProductRelation[]>;
  nextQuoteNumber(): Promise<string>;
  newPortalToken(): string;
  listQuoteSummaries(): Promise<QuoteAggregate[]>;
  getQuote(id: string): Promise<QuoteAggregate | null>;
  getQuoteByToken(token: string): Promise<QuoteAggregate | null>;
  saveQuote(aggregate: QuoteAggregate): Promise<QuoteAggregate>;
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
  const quotes = new Map<string, QuoteAggregate>();
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
    async listProducts() {
      return clone(products);
    },
    async getProduct(id) {
      return clone(products.find((item) => item.id === id) ?? null);
    },
    async listWarehouses() {
      return clone(warehouses);
    },
    async listStock() {
      return clone(stock);
    },
    async replaceStock(next) {
      stock.splice(0, stock.length, ...clone(next));
    },
    async listPolicies() {
      return clone(policies);
    },
    async listChains() {
      return clone(chains);
    },
    async getChain(id) {
      return clone(chains.find((item) => item.id === id) ?? null);
    },
    async listRelations() {
      return clone(relations);
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
