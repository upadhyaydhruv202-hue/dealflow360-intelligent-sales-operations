import type { ProblemPermission } from './host';

export const DEALFLOW_PERMISSIONS: readonly ProblemPermission[] = [
  { key: 'dealflow.catalog.read', description: 'Read DealFlow360 customers, products, warehouses, and policies' },
  { key: 'dealflow.quotes.read', description: 'Read quotes, assessments, and fulfillment plans' },
  { key: 'dealflow.quotes.write', description: 'Create and edit quotes, submit, confirm, and negotiate' },
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
    'dealflow.quotes.read',
    'dealflow.quotes.write',
    'dealflow.fulfillment.write',
    'dealflow.billing.write',
  ],
};
