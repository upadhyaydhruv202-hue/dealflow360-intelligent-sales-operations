import { z } from 'zod';

import { NotFoundError, ValidationError } from '../../errors';
import { PERMISSIONS } from '../../rbac/catalog';
import type { IntentRegistry } from '../intents.registry';
import { defineIntent } from '../intents.types';

const customers = [
  { id: 'cust-1001', name: 'Northwind Traders', email: 'ops@northwind.example', status: 'active', city: 'Seattle' },
  { id: 'cust-1002', name: 'Contoso Manufacturing', email: 'billing@contoso.example', status: 'active', city: 'Redmond' },
  { id: 'cust-1003', name: 'Fabrikam Retail', email: 'hello@fabrikam.example', status: 'inactive', city: 'Portland' },
];

const now = new Date();
const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 12)).toISOString();
const lastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 8)).toISOString();

const orders = [
  { id: 'ord-5001', customerId: 'cust-1001', status: 'processing', total: 1280, orderedAt: thisMonth },
  { id: 'ord-5002', customerId: 'cust-1001', status: 'delivered', total: 420, orderedAt: lastMonth },
  { id: 'ord-5003', customerId: 'cust-1002', status: 'pending', total: 990, orderedAt: thisMonth },
  { id: 'ord-5004', customerId: 'cust-1002', status: 'pending', total: 62_500, orderedAt: thisMonth },
  { id: 'ord-5005', customerId: 'cust-1003', status: 'pending', total: 81_000, orderedAt: lastMonth },
];

const invoices = [
  { id: 'inv-9001', orderId: 'ord-5002', customerId: 'cust-1001', amount: 420, status: 'paid' },
  { id: 'inv-9002', orderId: 'ord-5003', customerId: 'cust-1002', amount: 990, status: 'open' },
  { id: 'inv-9003', orderId: 'ord-5004', customerId: 'cust-1002', amount: 62_500, status: 'open' },
];

const tasks: Array<{ id: string; title: string; customerId?: string; status: string }> = [
  { id: 'task-1', title: 'Follow up on overdue invoice', customerId: 'cust-1002', status: 'open' },
];

const deleted = new Set<string>();
const messages: Array<{ id: string; customerId: string; body: string }> = [];
let taskSeq = 2;

const dateRangeSchema = z.enum(['current_month', 'last_month', 'current_year']).optional();

export function registerDemoIntents(registry: IntentRegistry): void {
  registry.register(searchCustomersIntent());
  registry.register(searchOrdersIntent());
  registry.register(getInvoiceIntent());
  registry.register(generateReportIntent());
  registry.register(summarizeCustomerIntent());
  registry.register(createTaskIntent());
  registry.register(deleteRecordIntent());
  registry.register(bulkUpdateOrdersIntent());
  registry.register(sendCustomerMessageIntent());
  registry.register(applyCreditIntent());
}

function searchCustomersIntent() {
  return defineIntent({
    name: 'SEARCH_CUSTOMERS',
    description: 'Search demo customers by name, status, or city. Replace with a repository-backed query in a hackathon.',
    requiredPermission: PERMISSIONS.INTENTS_USE,
    riskLevel: 'low',
    actionKind: 'read',
    examples: ['Find active customers in Seattle', 'Search customers named Contoso'],
    inputSchema: z.object({
      query: z.string().trim().min(1).max(80).optional(),
      status: z.enum(['active', 'inactive']).optional(),
      city: z.string().trim().min(1).max(80).optional(),
    }),
    handler: async (input) =>
      customers.filter((customer) => {
        if (deleted.has(customer.id)) {
          return false;
        }
        if (input.status && customer.status !== input.status) {
          return false;
        }
        if (input.city && customer.city.toLowerCase() !== input.city.toLowerCase()) {
          return false;
        }
        if (input.query) {
          const needle = input.query.toLowerCase();
          return customer.name.toLowerCase().includes(needle) || customer.email.toLowerCase().includes(needle);
        }
        return true;
      }),
  });
}

function searchOrdersIntent() {
  return defineIntent({
    name: 'SEARCH_ORDERS',
    description: 'Search demo orders by status, amount, and date range. Example: pending orders above 50000 this month.',
    requiredPermission: PERMISSIONS.INTENTS_USE,
    riskLevel: 'low',
    actionKind: 'read',
    examples: ['Show pending orders above ₹50,000 this month.', 'List delivered orders for customer cust-1001'],
    inputSchema: z.object({
      status: z.enum(['pending', 'processing', 'delivered']).optional(),
      amountGreaterThan: z.number().nonnegative().max(1_000_000_000).optional(),
      dateRange: dateRangeSchema,
      customerId: z.string().trim().min(1).max(64).optional(),
    }),
    validate: (input) => {
      if (input.amountGreaterThan !== undefined && !Number.isFinite(input.amountGreaterThan)) {
        throw new ValidationError('amountGreaterThan must be a finite number', [
          { path: 'amountGreaterThan', message: 'Invalid amount', code: 'custom' },
        ]);
      }
    },
    handler: async (input) =>
      orders.filter((order) => {
        if (deleted.has(order.id)) {
          return false;
        }
        if (input.status && order.status !== input.status) {
          return false;
        }
        if (input.customerId && order.customerId !== input.customerId) {
          return false;
        }
        if (input.amountGreaterThan !== undefined && order.total <= input.amountGreaterThan) {
          return false;
        }
        if (input.dateRange && !inDateRange(order.orderedAt, input.dateRange)) {
          return false;
        }
        return true;
      }),
  });
}

function getInvoiceIntent() {
  return defineIntent({
    name: 'GET_INVOICE',
    description: 'Fetch a demo invoice by id.',
    requiredPermission: PERMISSIONS.INTENTS_USE,
    riskLevel: 'low',
    actionKind: 'read',
    examples: ['Get invoice inv-9001'],
    inputSchema: z.object({
      id: z.string().trim().min(1).max(64),
    }),
    handler: async (input) => {
      const invoice = invoices.find((item) => item.id === input.id && !deleted.has(item.id));
      if (!invoice) {
        throw new NotFoundError('Invoice not found');
      }
      return invoice;
    },
  });
}

function generateReportIntent() {
  return defineIntent({
    name: 'GENERATE_REPORT',
    description: 'Build a demo summary report from in-memory customers and orders. Replace with ReportService in a hackathon.',
    requiredPermission: PERMISSIONS.REPORTS_GENERATE,
    riskLevel: 'low',
    actionKind: 'read',
    examples: ['Generate a pending-orders report'],
    inputSchema: z.object({
      title: z.string().trim().min(1).max(120).default('Order summary'),
      status: z.enum(['pending', 'processing', 'delivered']).optional(),
    }),
    handler: async (input) => {
      const rows = orders.filter((order) => !deleted.has(order.id) && (!input.status || order.status === input.status));
      return {
        title: input.title,
        generatedAt: new Date().toISOString(),
        rowCount: rows.length,
        total: rows.reduce((sum, order) => sum + order.total, 0),
        rows,
      };
    },
  });
}

function summarizeCustomerIntent() {
  return defineIntent({
    name: 'SUMMARIZE_CUSTOMER',
    description: 'Summarize a demo customer and their orders. This uses registered facts, not model-authored SQL.',
    requiredPermission: PERMISSIONS.INTENTS_USE,
    riskLevel: 'low',
    actionKind: 'read',
    examples: ['Summarize customer cust-1001'],
    inputSchema: z.object({
      id: z.string().trim().min(1).max(64),
    }),
    handler: async (input) => {
      const customer = customers.find((item) => item.id === input.id && !deleted.has(item.id));
      if (!customer) {
        throw new NotFoundError('Customer not found');
      }
      const related = orders.filter((order) => order.customerId === customer.id && !deleted.has(order.id));
      return {
        id: customer.id,
        name: customer.name,
        status: customer.status,
        orderCount: related.length,
        outstanding: related.filter((order) => order.status !== 'delivered').reduce((sum, order) => sum + order.total, 0),
        summary: `${customer.name} is ${customer.status} in ${customer.city} with ${related.length} demo orders.`,
      };
    },
  });
}

function createTaskIntent() {
  return defineIntent({
    name: 'CREATE_TASK',
    description: 'Create a demo follow-up task. Medium risk: it writes a record.',
    requiredPermission: PERMISSIONS.INTENTS_USE,
    riskLevel: 'medium',
    actionKind: 'write',
    examples: ['Create a task to call Contoso'],
    inputSchema: z.object({
      title: z.string().trim().min(3).max(120),
      customerId: z.string().trim().min(1).max(64).optional(),
    }),
    validate: (input) => {
      if (input.customerId && !customers.some((customer) => customer.id === input.customerId)) {
        throw new ValidationError('Unknown customer for task', [
          { path: 'customerId', message: 'Customer is not in the demo catalog', code: 'custom' },
        ]);
      }
    },
    handler: async (input) => {
      const task = {
        id: `task-${taskSeq}`,
        title: input.title,
        customerId: input.customerId,
        status: 'open',
      };
      taskSeq += 1;
      tasks.push(task);
      return task;
    },
  });
}

function deleteRecordIntent() {
  return defineIntent({
    name: 'DELETE_RECORD',
    description: 'Delete a demo customer, order, or invoice by id. High-risk DELETE: requires explicit confirmation.',
    requiredPermission: PERMISSIONS.INTENTS_USE,
    riskLevel: 'high',
    highRiskClass: 'DELETE',
    examples: ['Delete order ord-5003'],
    inputSchema: z.object({
      id: z.string().trim().min(1).max(64),
    }),
    handler: async (input) => {
      const exists = [...customers, ...orders, ...invoices].some((item) => item.id === input.id);
      if (!exists) {
        throw new NotFoundError('Record not found');
      }
      deleted.add(input.id);
      return { id: input.id, deleted: true };
    },
  });
}

function bulkUpdateOrdersIntent() {
  return defineIntent({
    name: 'BULK_UPDATE_ORDERS',
    description: 'Set status on matching demo orders. High-risk BULK_UPDATE: requires explicit confirmation.',
    requiredPermission: PERMISSIONS.INTENTS_USE,
    riskLevel: 'high',
    highRiskClass: 'BULK_UPDATE',
    examples: ['Mark all pending orders for cust-1002 as processing'],
    inputSchema: z.object({
      customerId: z.string().trim().min(1).max(64).optional(),
      fromStatus: z.enum(['pending', 'processing', 'delivered']).optional(),
      toStatus: z.enum(['pending', 'processing', 'delivered']),
    }),
    handler: async (input) => {
      const updated: string[] = [];
      for (const order of orders) {
        if (deleted.has(order.id)) {
          continue;
        }
        if (input.customerId && order.customerId !== input.customerId) {
          continue;
        }
        if (input.fromStatus && order.status !== input.fromStatus) {
          continue;
        }
        order.status = input.toStatus;
        updated.push(order.id);
      }
      return { updated, toStatus: input.toStatus };
    },
  });
}

function sendCustomerMessageIntent() {
  return defineIntent({
    name: 'SEND_CUSTOMER_MESSAGE',
    description: 'Queue a demo customer message. High-risk SEND_EXTERNAL_MESSAGE: requires confirmation. Demo mode does not deliver mail.',
    requiredPermission: PERMISSIONS.INTENTS_USE,
    riskLevel: 'high',
    highRiskClass: 'SEND_EXTERNAL_MESSAGE',
    examples: ['Email Contoso about invoice inv-9002'],
    inputSchema: z.object({
      customerId: z.string().trim().min(1).max(64),
      body: z.string().trim().min(3).max(500),
    }),
    handler: async (input) => {
      const customer = customers.find((item) => item.id === input.customerId && !deleted.has(item.id));
      if (!customer) {
        throw new NotFoundError('Customer not found');
      }
      const message = { id: `msg-${messages.length + 1}`, customerId: customer.id, body: input.body };
      messages.push(message);
      return { ...message, delivered: false, channel: 'demo' };
    },
  });
}

function applyCreditIntent() {
  return defineIntent({
    name: 'APPLY_CREDIT',
    description: 'Apply a demo credit to an open invoice. High-risk FINANCIAL_ACTION: requires confirmation.',
    requiredPermission: PERMISSIONS.INTENTS_USE,
    riskLevel: 'high',
    highRiskClass: 'FINANCIAL_ACTION',
    examples: ['Apply a 100 credit to invoice inv-9002'],
    inputSchema: z.object({
      invoiceId: z.string().trim().min(1).max(64),
      amount: z.number().positive().max(1_000_000),
    }),
    handler: async (input) => {
      const invoice = invoices.find((item) => item.id === input.invoiceId && !deleted.has(item.id));
      if (!invoice) {
        throw new NotFoundError('Invoice not found');
      }
      if (invoice.status === 'paid') {
        throw new ValidationError('Cannot credit a paid invoice', [
          { path: 'invoiceId', message: 'Invoice is already paid', code: 'custom' },
        ]);
      }
      invoice.amount = Math.max(0, invoice.amount - input.amount);
      if (invoice.amount === 0) {
        invoice.status = 'paid';
      }
      return { id: invoice.id, amount: invoice.amount, status: invoice.status, credited: input.amount };
    },
  });
}

export function resetDemoIntentData(): void {
  deleted.clear();
  messages.length = 0;
  tasks.splice(1);
  taskSeq = 2;
  orders[0]!.status = 'processing';
  orders[1]!.status = 'delivered';
  orders[2]!.status = 'pending';
  orders[3]!.status = 'pending';
  orders[4]!.status = 'pending';
  invoices[1]!.amount = 990;
  invoices[1]!.status = 'open';
  invoices[2]!.amount = 62_500;
  invoices[2]!.status = 'open';
}

function inDateRange(iso: string, range: 'current_month' | 'last_month' | 'current_year'): boolean {
  const date = new Date(iso);
  const current = new Date();
  if (range === 'current_year') {
    return date.getUTCFullYear() === current.getUTCFullYear();
  }
  if (range === 'current_month') {
    return date.getUTCFullYear() === current.getUTCFullYear() && date.getUTCMonth() === current.getUTCMonth();
  }
  const previous = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 1, 1));
  return date.getUTCFullYear() === previous.getUTCFullYear() && date.getUTCMonth() === previous.getUTCMonth();
}
