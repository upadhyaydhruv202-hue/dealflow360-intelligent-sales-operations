import { createElement, type ReactElement } from 'react';

import { ApprovalsPage } from './dealflow/ApprovalsPage';
import { InvoicesPage, SubscriptionsPage } from './dealflow/BillingPages';
import { CatalogPage, DealHealthPage, ReportsPage } from './dealflow/InsightsPages';
import { DealflowDashboardPage } from './dealflow/DashboardPage';
import { FulfillmentPage } from './dealflow/FulfillmentPage';
import { QuoteWorkspacePage } from './dealflow/QuoteWorkspacePage';
import { QuotesListPage } from './dealflow/QuotesListPage';

export { CustomerPortalPage } from './dealflow/PortalPage';
export { CustomerAccountPage } from './dealflow/CustomerAccountPage';

export interface ProblemNavItem {
  to: string;
  label: string;
  end?: boolean;
  feature?: string;
}

export interface ProblemRoute {
  path: string;
  element: ReactElement;
}

export const problemNav: ProblemNavItem[] = [
  { to: '/dealflow', label: 'Dashboard', end: true },
  { to: '/dealflow/quotes', label: 'Quotations' },
  { to: '/dealflow/approvals', label: 'Approvals' },
  { to: '/dealflow/fulfillment', label: 'Fulfillment' },
  { to: '/dealflow/subscriptions', label: 'Subscriptions' },
  { to: '/dealflow/invoices', label: 'Invoices' },
  { to: '/dealflow/health', label: 'Deal Health' },
  { to: '/dealflow/reports', label: 'Reports' },
  { to: '/dealflow/catalog', label: 'Products / Policies' },
];

export const problemRoutes: ProblemRoute[] = [
  { path: '/dealflow', element: createElement(DealflowDashboardPage) },
  { path: '/dealflow/quotes', element: createElement(QuotesListPage) },
  { path: '/dealflow/quotes/:quoteId', element: createElement(QuoteWorkspacePage) },
  { path: '/dealflow/approvals', element: createElement(ApprovalsPage) },
  { path: '/dealflow/fulfillment', element: createElement(FulfillmentPage) },
  { path: '/dealflow/subscriptions', element: createElement(SubscriptionsPage) },
  { path: '/dealflow/invoices', element: createElement(InvoicesPage) },
  { path: '/dealflow/health', element: createElement(DealHealthPage) },
  { path: '/dealflow/reports', element: createElement(ReportsPage) },
  { path: '/dealflow/catalog', element: createElement(CatalogPage) },
];
