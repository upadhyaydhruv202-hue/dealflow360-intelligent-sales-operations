import { useState } from 'react';

import { NotificationList, type NotificationItem } from './NotificationList';

export function NotificationBell({
  items,
  unreadCount,
  onRead,
  onReadAll,
}: {
  items: NotificationItem[];
  unreadCount: number;
  onRead?: (id: string) => void;
  onReadAll?: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        className="relative rounded-lg border border-edge bg-surface-elevated px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        Notifications
        {unreadCount > 0 ? (
          <span className="ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-info px-1.5 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-edge bg-surface-elevated p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">Inbox</p>
            {onReadAll && unreadCount > 0 ? (
              <button type="button" className="text-xs text-info hover:underline" onClick={onReadAll}>
                Mark all read
              </button>
            ) : null}
          </div>
          <NotificationList items={items} onRead={onRead} emptyLabel="No notifications yet" />
        </div>
      ) : null}
    </div>
  );
}
