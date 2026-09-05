import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BarChart3,
  Bell,
  Boxes,
  FileText,
  LayoutDashboard,
  Package,
  Receipt,
  Repeat,
  ShieldCheck,
  Sparkles,
  Warehouse,
} from 'lucide-react';

export interface AppNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  feature?: string;
  command?: string;
  rail?: boolean;
}

export interface AppNavGroup {
  id: string;
  label: string;
  items: AppNavItem[];
}

export const appNavGroups: AppNavGroup[] = [
  {
    id: 'core',
    label: 'Core',
    items: [
      { to: '/dealflow', label: 'Dashboard', icon: LayoutDashboard, end: true, command: 'Open overview', rail: true },
      { to: '/dealflow/health', label: 'Deal Health', icon: Activity, command: 'Open deal health', rail: true },
      { to: '/dealflow/reports', label: 'Reports', icon: BarChart3, command: 'Open reports', rail: true },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { to: '/dealflow/quotes', label: 'Quotations', icon: FileText, command: 'Open quotations', rail: true },
      { to: '/dealflow/approvals', label: 'Approvals', icon: ShieldCheck, command: 'Open approvals', rail: true },
      { to: '/dealflow/fulfillment', label: 'Fulfillment', icon: Warehouse, command: 'Open fulfillment', rail: true },
    ],
  },
  {
    id: 'commercial',
    label: 'Commercial',
    items: [
      { to: '/dealflow/subscriptions', label: 'Subscriptions', icon: Repeat, command: 'Open subscriptions', rail: true },
      { to: '/dealflow/invoices', label: 'Invoices', icon: Receipt, command: 'Open invoices', rail: true },
      { to: '/dealflow/catalog', label: 'Products / Policies', icon: Package, command: 'Open catalog', rail: true },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { to: '/notifications', label: 'Notifications', icon: Bell, command: 'Open notifications' },
      { to: '/', label: 'Foundation', icon: Boxes, end: true, command: 'Open foundation status' },
      { to: '/dashboard', label: 'Platform dashboard', icon: LayoutDashboard, command: 'Open platform dashboard' },
      { to: '/ui', label: 'UI kit', icon: Sparkles, command: 'Open UI kit' },
      { to: '/copilot', label: 'Copilot', icon: Sparkles, feature: 'copilot', command: 'Open copilot' },
      { to: '/intents', label: 'Intents', icon: Sparkles, feature: 'intents', command: 'Open intents' },
      { to: '/search', label: 'Search', icon: Sparkles, feature: 'search', command: 'Open search' },
      { to: '/analytics', label: 'Analytics', icon: BarChart3, feature: 'analytics', command: 'Open analytics' },
      { to: '/automations', label: 'Automations', icon: Sparkles, feature: 'automation', command: 'Open automations' },
    ],
  },
];

export function railGroups(): AppNavGroup[] {
  return appNavGroups
    .map((group) => ({ ...group, items: group.items.filter((item) => item.rail) }))
    .filter((group) => group.items.length > 0);
}

export function findNavItem(pathname: string): AppNavItem | undefined {
  const flattened = appNavGroups.flatMap((group) => group.items);
  const exact = flattened.find((item) => (item.end ? pathname === item.to : pathname === item.to));
  if (exact) return exact;
  return flattened
    .filter((item) => item.to !== '/' && pathname.startsWith(item.to))
    .sort((left, right) => right.to.length - left.to.length)[0];
}

export function breadcrumbForPath(pathname: string): Array<{ label: string; to?: string }> {
  if (pathname.startsWith('/dealflow/quotes/') && pathname !== '/dealflow/quotes') {
    return [
      { label: 'Quotations', to: '/dealflow/quotes' },
      { label: 'Workspace' },
    ];
  }
  const item = findNavItem(pathname);
  if (!item) return [{ label: 'DealFlow360' }];
  if (item.to === '/dealflow' || item.to === '/') {
    return [{ label: item.label }];
  }
  return [{ label: 'Dashboard', to: '/dealflow' }, { label: item.label }];
}
