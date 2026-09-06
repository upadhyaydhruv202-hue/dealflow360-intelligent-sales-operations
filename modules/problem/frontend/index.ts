import { createElement, type ReactElement } from 'react';

import { AnomalyCenterPage } from './dealflow/AnomalyCenterPage';
import { ApprovalDetailPage } from './dealflow/ApprovalDetailPage';
import { ApprovalsPage } from './dealflow/ApprovalsPage';
import { AssistantPage } from './dealflow/AssistantPage';
import { InvoicesPage, SubscriptionsPage } from './dealflow/BillingPages';
import { DiscountPoliciesPage, ProductDetailPage } from './dealflow/CatalogDetailPages';
import { BillingDetailPage, InvoiceDetailPage } from './dealflow/CommercialDetailPages';
import { CatalogPage, DealHealthPage, ReportsPage } from './dealflow/InsightsPages';
import { DealflowDashboardPage } from './dealflow/DashboardPage';
import { FulfillmentDetailPage } from './dealflow/FulfillmentDetailPage';
import { FulfillmentPage } from './dealflow/FulfillmentPage';
import { NegotiationsPage } from './dealflow/NegotiationsPage';
import { QuoteWorkspacePage } from './dealflow/QuoteWorkspacePage';
import { QuotesListPage } from './dealflow/QuotesListPage';
import { SettingsPage } from './dealflow/SettingsPage';

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
  { to: '/dealflow/negotiations', label: 'Negotiations' },
  { to: '/dealflow/approvals', label: 'Approvals' },
  { to: '/dealflow/fulfillment', label: 'Fulfillment' },
  { to: '/dealflow/subscriptions', label: 'Subscriptions' },
  { to: '/dealflow/invoices', label: 'Invoices' },
  { to: '/dealflow/health', label: 'Deal Health' },
  { to: '/dealflow/anomalies', label: 'Anomalies' },
  { to: '/dealflow/assistant', label: 'Assistant' },
  { to: '/dealflow/reports', label: 'Reports' },
  { to: '/dealflow/catalog', label: 'Products / Policies' },
  { to: '/dealflow/settings', label: 'Configuration' },
];

export const problemRoutes: ProblemRoute[] = [
  { path: '/dealflow', element: createElement(DealflowDashboardPage) },
  { path: '/dealflow/quotes', element: createElement(QuotesListPage) },
  { path: '/dealflow/quotes/:quoteId', element: createElement(QuoteWorkspacePage) },
  { path: '/dealflow/negotiations', element: createElement(NegotiationsPage) },
  { path: '/dealflow/approvals', element: createElement(ApprovalsPage) },
  { path: '/dealflow/approvals/:quoteId', element: createElement(ApprovalDetailPage) },
  { path: '/dealflow/fulfillment', element: createElement(FulfillmentPage) },
  { path: '/dealflow/fulfillment/:quoteId', element: createElement(FulfillmentDetailPage) },
  { path: '/dealflow/subscriptions', element: createElement(SubscriptionsPage) },
  { path: '/dealflow/subscriptions/:quoteId', element: createElement(BillingDetailPage) },
  { path: '/dealflow/invoices', element: createElement(InvoicesPage) },
  { path: '/dealflow/invoices/:quoteId', element: createElement(InvoiceDetailPage) },
  { path: '/dealflow/health', element: createElement(DealHealthPage) },
  { path: '/dealflow/anomalies', element: createElement(AnomalyCenterPage) },
  { path: '/dealflow/assistant', element: createElement(AssistantPage) },
  { path: '/dealflow/reports', element: createElement(ReportsPage) },
  { path: '/dealflow/catalog', element: createElement(CatalogPage) },
  { path: '/dealflow/catalog/products/:productId', element: createElement(ProductDetailPage) },
  { path: '/dealflow/catalog/policies', element: createElement(DiscountPoliciesPage) },
  { path: '/dealflow/settings', element: createElement(SettingsPage) },
];
