import type { ProblemPermission } from './host';

export const DEALFLOW_PERMISSIONS: readonly ProblemPermission[] = [
  { key: 'dealflow.catalog.read', description: 'Read DealFlow360 customers, products, warehouses, and policies' },
  { key: 'dealflow.catalog.write', description: 'Create and edit DealFlow360 discount policies, approval chains, quantity-break percent rules, role ranges, and governance' },
  { key: 'dealflow.catalog.products.write', description: 'Create and edit DealFlow360 products and warehouse stock without changing discount policies or governance' },
  { key: 'dealflow.quotes.read', description: 'Read quotes, assessments, and fulfillment plans' },
  { key: 'dealflow.quotes.write', description: 'Create and edit quotes, send to manager, submit finalized quotations, and negotiate' },
  { key: 'dealflow.quotes.lock', description: 'Finance lock of an approved quotation' },
  { key: 'dealflow.quotes.approve', description: 'Record an approval or rejection on a quote chain' },
  { key: 'dealflow.approvals.manager', description: 'Act as Sales Manager on an approval chain' },
  { key: 'dealflow.approvals.finance', description: 'Act as Finance on an approval chain' },
  { key: 'dealflow.approvals.final', description: 'Give final approval on an approval chain' },
  { key: 'dealflow.fulfillment.write', description: 'Plan warehouse splits, overrides, and backorders' },
  { key: 'dealflow.billing.write', description: 'Generate and cancel hybrid billing schedules' },
];

export const DEALFLOW_ROLE_PERMISSIONS: Readonly<Record<string, readonly string[]>> = {
  manager: [
    'dealflow.catalog.read',
    'dealflow.quotes.read',
    'dealflow.quotes.write',
    'dealflow.quotes.approve',
    'dealflow.approvals.manager',
    'dealflow.fulfillment.write',
    'dealflow.billing.write',
  ],
  staff: [
    'dealflow.catalog.read',
    'dealflow.catalog.products.write',
    'dealflow.quotes.read',
    'dealflow.quotes.write',
    'dealflow.fulfillment.write',
    'dealflow.billing.write',
  ],
  finance: [
    'dealflow.catalog.read',
    'dealflow.quotes.read',
    'dealflow.quotes.approve',
    'dealflow.quotes.lock',
    'dealflow.approvals.finance',
    'dealflow.billing.write',
    'notifications.read',
    'reports.generate',
    'analytics.read',
    'audit.read',
  ],
  operations: [
    'dealflow.catalog.read',
    'dealflow.quotes.read',
    'dealflow.fulfillment.write',
    'notifications.read',
    'analytics.read',
  ],
};
