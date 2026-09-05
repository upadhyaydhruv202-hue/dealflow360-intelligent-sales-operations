import { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';

import { useOptionalAuth } from '../../auth/AuthProvider';
import { NotificationList, type NotificationItem } from '../../components/NotificationList';
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../../services/notifications';
import { cn } from '../cn';
import { Drawer } from '../overlays/Drawer';
import { Button } from '../primitives/Button';
import { focusRing } from '../styles';

function dayBucket(value?: string): 'Today' | 'Yesterday' | 'Earlier' {
  if (!value) return 'Earlier';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Earlier';
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const then = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const diff = (start - then) / 86_400_000;
  if (diff <= 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return 'Earlier';
}

export function NotificationDrawer() {
  const auth = useOptionalAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  async function refresh(token: string) {
    const [list, unread] = await Promise.all([listNotifications(token), getUnreadCount(token)]);
    setItems(list.items);
    setUnreadCount(unread.count);
  }

  useEffect(() => {
    if (!open || !auth?.accessToken) return;
    setLoading(true);
    void refresh(auth.accessToken).finally(() => setLoading(false));
  }, [auth?.accessToken, open]);

  const grouped = useMemo(() => {
    const buckets: Record<'Today' | 'Yesterday' | 'Earlier', NotificationItem[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };
    for (const item of items) {
      buckets[dayBucket(item.createdAt)].push(item);
    }
    return buckets;
  }, [items]);

  return (
    <>
      <button
        type="button"
        className={cn(
          'relative rounded-control p-2 text-foreground-muted transition-colors duration-df hover:bg-surface-muted hover:text-foreground',
          focusRing,
        )}
        aria-label="Notifications"
        onClick={() => setOpen(true)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
            {unreadCount}
          </span>
        ) : null}
      </button>
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Notifications"
        footer={
          auth?.accessToken ? (
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void (async () => {
                    if (!auth.accessToken) return;
                    await markAllNotificationsRead(auth.accessToken);
                    await refresh(auth.accessToken);
                  })()
                }
              >
                Mark all as read
              </Button>
            </div>
          ) : null
        }
      >
        {!auth?.isAuthenticated ? (
          <p className="text-sm text-foreground-muted">Sign in to load your inbox.</p>
        ) : loading && items.length === 0 ? (
          <p className="text-sm text-foreground-muted">Loading inbox…</p>
        ) : items.length === 0 ? (
          <NotificationList items={[]} />
        ) : (
          <div className="space-y-6">
            {(['Today', 'Yesterday', 'Earlier'] as const).map((bucket) =>
              grouped[bucket].length ? (
                <section key={bucket}>
                  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                    {bucket}
                  </h3>
                  <NotificationList
                    items={grouped[bucket]}
                    onRead={(id) =>
                      void (async () => {
                        if (!auth.accessToken) return;
                        await markNotificationRead(id, auth.accessToken);
                        await refresh(auth.accessToken);
                      })()
                    }
                  />
                </section>
              ) : null,
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}
