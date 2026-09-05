import type { ReactNode } from 'react';

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
    <section>
      <h2 className="mb-4 text-title text-foreground">{title}</h2>
      {items.length === 0 ? (
        <EmptyState title={emptyTitle} className="border-0 px-0 py-6" />
      ) : (
        <ol className="relative space-y-0 border-l border-edge pl-5">
          {items.map((item) => (
            <li key={item.id} className="relative pb-5 last:pb-0">
              <span className="absolute -left-[23px] top-1.5 h-2 w-2 rounded-full bg-accent" />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  {item.description ? <p className="mt-1 text-sm text-foreground-muted">{item.description}</p> : null}
                  {item.meta ? <div className="mt-2">{item.meta}</div> : null}
                </div>
                {item.timestamp ? <time className="shrink-0 text-caption text-foreground-muted">{item.timestamp}</time> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
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
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-title text-foreground">{title}</h2>
        {headerAction}
      </div>
      {items.length === 0 ? (
        <EmptyState title={emptyTitle} className="border-0 px-0 py-6" />
      ) : (
        <ul className="divide-y divide-edge">
          {items.map((item) => (
            <li key={item.id} className="py-3" data-unread={item.unread ? 'true' : 'false'}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                  {item.body ? <p className="mt-1 text-sm text-foreground-muted">{item.body}</p> : null}
                  {item.timestamp ? <p className="mt-1 text-caption text-foreground-muted">{item.timestamp}</p> : null}
                </div>
                {item.unread && onRead ? (
                  <button type="button" className="text-caption font-medium text-foreground hover:underline" onClick={() => onRead(item.id)}>
                    Mark read
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
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
    <section>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-title text-foreground">{title}</h2>
          {description ? <p className="mt-1 text-sm text-foreground-muted">{description}</p> : null}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
