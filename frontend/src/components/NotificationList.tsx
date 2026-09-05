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
    <ul className="divide-y divide-edge">
      {items.map((item) => {
        const unread = !item.readAt;
        return (
          <li key={item.id} className="py-3" data-read={item.readAt ? 'true' : 'false'}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`mt-1 h-1.5 w-1.5 rounded-full ${unread ? 'bg-accent' : 'bg-edge'}`} aria-hidden />
                  <p className="text-sm font-medium text-foreground">{item.title}</p>
                </div>
                <p className="mt-1 pl-3.5 text-sm text-foreground-muted">{item.body}</p>
              </div>
              {unread && onRead ? (
                <button type="button" className="shrink-0 text-xs font-medium text-foreground hover:underline" onClick={() => onRead(item.id)}>
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
