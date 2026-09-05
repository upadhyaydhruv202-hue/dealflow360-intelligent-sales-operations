export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'critical';
export type NotificationCategory = 'order_updates' | 'security_alerts' | 'reports' | 'marketing' | 'system';
export type NotificationChannel = 'email' | 'in_app' | 'sms' | 'push' | 'webhook';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  readAt?: string | null;
  createdAt?: string;
}

export function NotificationList({
  items,
  emptyLabel = 'No notifications',
  onRead,
}: {
  items: NotificationItem[];
  emptyLabel?: string;
  onRead?: (id: string) => void;
}) {
  if (items.length === 0) {
        return <p className="text-sm text-foreground-muted">{emptyLabel}</p>;
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const unread = !item.readAt;
        return (
          <li
            key={item.id}
            className={`rounded-xl border p-4 shadow-sm ${
              unread ? 'border-info/40 bg-info/10' : 'border-edge bg-surface-elevated'
            }`}
            data-read={item.readAt ? 'true' : 'false'}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">{item.type}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{item.title}</p>
                <p className="mt-1 text-sm text-foreground-muted">{item.body}</p>
              </div>
              {unread && onRead ? (
                <button
                  type="button"
                    className="shrink-0 text-xs font-medium text-info hover:underline"
                  onClick={() => onRead(item.id)}
                >
                  Mark read
                </button>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
