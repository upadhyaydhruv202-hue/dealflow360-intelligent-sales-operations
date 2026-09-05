import { z } from 'zod';

import { NotFoundError } from '../../errors';
import { PERMISSIONS } from '../../rbac/catalog';
import type { CopilotToolRegistry } from '../copilot.registry';
import { defineCopilotTool } from '../copilot.types';

const customers = [
  { id: 'cust-1001', name: 'Northwind Traders', email: 'ops@northwind.example', status: 'active' },
  { id: 'cust-1002', name: 'Contoso Manufacturing', email: 'billing@contoso.example', status: 'active' },
];

const orders = [
  { id: 'ord-5001', customerId: 'cust-1001', status: 'processing', total: 1280 },
  { id: 'ord-5002', customerId: 'cust-1001', status: 'delivered', total: 420 },
  { id: 'ord-5003', customerId: 'cust-1002', status: 'pending', total: 990 },
];

const invoices = [
  { id: 'inv-9001', orderId: 'ord-5002', customerId: 'cust-1001', amount: 420, status: 'paid' },
  { id: 'inv-9002', orderId: 'ord-5003', customerId: 'cust-1002', amount: 990, status: 'open' },
];

const deleted = new Set<string>();

export function registerDemoCopilotTools(registry: CopilotToolRegistry): void {
  registry.register(getCustomerTool());
  registry.register(searchOrdersTool());
  registry.register(getInvoiceTool());
  registry.register(deleteRecordTool());
}

function getCustomerTool() {
  return defineCopilotTool({
    name: 'getCustomer',
    description: 'Look up a demo customer by id. Replace this in a hackathon with a real repository-backed tool.',
    requiredPermission: PERMISSIONS.COPILOT_USE,
    riskLevel: 'low',
    inputSchema: z.object({
      id: z.string().trim().min(1).max(64),
    }),
    handler: async (input) => {
      const customer = customers.find((item) => item.id === input.id && !deleted.has(item.id));
      if (!customer) {
        throw new NotFoundError('Customer not found');
      }
      return customer;
    },
  });
}

function searchOrdersTool() {
  return defineCopilotTool({
    name: 'searchOrders',
    description: 'Search demo orders by customer id or status. Replace with a problem-specific query tool.',
    requiredPermission: PERMISSIONS.COPILOT_USE,
    riskLevel: 'low',
    inputSchema: z.object({
      customerId: z.string().trim().min(1).max(64).optional(),
      status: z.string().trim().min(1).max(32).optional(),
    }),
    handler: async (input) => {
      return orders.filter((order) => {
        if (deleted.has(order.id)) {
          return false;
        }
        if (input.customerId && order.customerId !== input.customerId) {
          return false;
        }
        if (input.status && order.status !== input.status) {
          return false;
        }
        return true;
      });
    },
  });
}

function getInvoiceTool() {
  return defineCopilotTool({
    name: 'getInvoice',
    description: 'Fetch a demo invoice by id. Replace with a financial adapter that still requires confirmation for writes.',
    requiredPermission: PERMISSIONS.COPILOT_USE,
    riskLevel: 'low',
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

function deleteRecordTool() {
  return defineCopilotTool({
    name: 'deleteRecord',
    description: 'Delete a demo customer, order, or invoice by id. High-risk: requires explicit confirmation.',
    requiredPermission: PERMISSIONS.COPILOT_USE,
    riskLevel: 'high',
    actionKind: 'deletion',
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

export function resetDemoCopilotData(): void {
  deleted.clear();
}
