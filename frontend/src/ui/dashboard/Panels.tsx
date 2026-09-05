import type { ReactNode } from 'react';

import { Card, CardDescription, CardHeader, CardTitle } from '../primitives/Card';
import { EmptyState } from '../states/FeedbackStates';

export interface ActivityItem {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  timestamp?: string;
  meta?: ReactNode;
}

export function ActivityFeed({
  title = 'Recent activity',
  items,
  emptyTitle = 'No activity yet',
}: {
  title?: string;
  items: ActivityItem[];
  emptyTitle?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      {items.length === 0 ? (
        <EmptyState title={emptyTitle} className="border-0 px-0 py-6" />
      ) : (
        <ol className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="border-b border-edge pb-3 last:border-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  {item.description ? <p className="mt-1 text-sm text-foreground-muted">{item.description}</p> : null}
                  {item.meta ? <p className="mt-1 text-xs text-foreground-muted">{item.meta}</p> : null}
                </div>
                {item.timestamp ? <time className="shrink-0 text-xs text-foreground-muted">{item.timestamp}</time> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export interface DashboardNotice {
  id: string;
  title: string;
  body?: string;
  unread?: boolean;
  timestamp?: string;
}

export function NotificationPanel({
  title = 'Notifications',
  items,
  emptyTitle = 'No notifications',
  onRead,
  headerAction,
}: {
  title?: string;
  items: DashboardNotice[];
  emptyTitle?: string;
  onRead?: (id: string) => void;
  headerAction?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {headerAction}
      </CardHeader>
      {items.length === 0 ? (
        <EmptyState title={emptyTitle} className="border-0 px-0 py-6" />
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-edge p-3" data-unread={item.unread ? 'true' : 'false'}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  {item.body ? <p className="mt-1 text-sm text-foreground-muted">{item.body}</p> : null}
                  {item.timestamp ? <p className="mt-1 text-xs text-foreground-muted">{item.timestamp}</p> : null}
                </div>
                {item.unread && onRead ? (
                  <button type="button" className="text-xs font-medium text-info hover:underline" onClick={() => onRead(item.id)}>
                    Mark read
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function TableSection({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{title}</CardTitle>
          {description ? <CardDescription className="mt-1">{description}</CardDescription> : null}
        </div>
        {actions}
      </CardHeader>
      {children}
    </Card>
  );
}
