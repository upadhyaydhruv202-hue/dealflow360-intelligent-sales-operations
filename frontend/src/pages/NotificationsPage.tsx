import { useState } from 'react';

import { SessionGate } from '../auth/SessionGate';
import { useAuth } from '../auth/AuthProvider';
import { useOptionalFeatures } from '../features';
import { NotificationBell } from '../components/NotificationBell';
import { NotificationList, type NotificationItem } from '../components/NotificationList';
import { NotificationPreferences, type NotificationPreference } from '../components/NotificationPreferences';
import { getApiErrorMessage } from '../services/api';
import {
  getNotificationPreferences,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from '../services/notifications';
import { useRealtime } from '../hooks/useRealtime';
import { Alert, Breadcrumb, Button, PageContainer } from '../ui';

export function NotificationsPage() {
  const { accessToken } = useAuth();
  const features = useOptionalFeatures();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([]);
  const [mandatoryCategories, setMandatoryCategories] = useState<string[]>(['security_alerts']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function withToken<T>(run: (token: string) => Promise<T>): Promise<T | undefined> {
    if (!accessToken) {
      setError('Sign in to continue.');
      return undefined;
    }
    setLoading(true);
    setError(undefined);
    try {
      return await run(accessToken);
    } catch (caught) {
      setError(toErrorMessage(caught));
      return undefined;
    } finally {
      setLoading(false);
    }
  }

  async function refresh(accessToken: string) {
    const [list, unread, prefs] = await Promise.all([
      listNotifications(accessToken),
      getUnreadCount(accessToken),
      getNotificationPreferences(accessToken),
    ]);
    setItems(list.items);
    setUnreadCount(unread.count);
    setPreferences(prefs.preferences);
    setMandatoryCategories(prefs.mandatoryCategories);
  }

  useRealtime({
    token: accessToken,
    channels: ['notifications'],
    enabled: Boolean(accessToken) && features?.isEnabled('realtime') === true,
    onEvent: (event) => {
      if (event.type !== 'notification.created') {
        return;
      }
      const payload = event.payload;
      const id = typeof payload.id === 'string' ? payload.id : event.id;
      setItems((current) => {
        if (current.some((item) => item.id === id)) {
          return current;
        }
        return [
          {
            id,
            type: toNotificationType(payload.type),
            title: typeof payload.title === 'string' ? payload.title : 'Notification',
            body: typeof payload.body === 'string' ? payload.body : '',
            readAt: null,
          },
          ...current,
        ];
      });
      setUnreadCount((count) => count + 1);
    },
  });

  return (
    <PageContainer
      breadcrumb={<Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Notifications' }]} />}
      title="Notifications"
      description="In-app history, unread state, and per-category channel preferences. Email, SMS, push, and webhook delivery stay on the backend behind channel adapters."
      actions={
        <NotificationBell
          items={items.slice(0, 5)}
          unreadCount={unreadCount}
          onRead={(id) => void withToken(async (accessToken) => {
            await markNotificationRead(id, accessToken);
            await refresh(accessToken);
          })}
          onReadAll={() => void withToken(async (accessToken) => {
            await markAllNotificationsRead(accessToken);
            await refresh(accessToken);
          })}
        />
      }
    >
      <SessionGate title="Sign in to view notifications">
      <div className="mb-6 flex flex-wrap gap-2">
        <Button disabled={loading} onClick={() => void withToken(refresh)}>
          Load inbox
        </Button>
        <Button
          variant="outline"
          disabled={loading}
          onClick={() => void withToken(async (accessToken) => {
            await markAllNotificationsRead(accessToken);
            await refresh(accessToken);
          })}
        >
          Mark all read
        </Button>
      </div>

      {error ? (
        <Alert variant="error" title="Request failed" className="mb-6">
          {error}
        </Alert>
      ) : null}

      <NotificationList
        items={items}
        onRead={(id) => void withToken(async (accessToken) => {
          await markNotificationRead(id, accessToken);
          await refresh(accessToken);
        })}
      />

      <section className="mt-8 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Preferences</h2>
        <NotificationPreferences
          preferences={preferences}
          mandatoryCategories={mandatoryCategories}
          onChange={(preference) =>
            void withToken(async (accessToken) => {
              await updateNotificationPreferences([preference], accessToken);
              await refresh(accessToken);
            })
          }
        />
      </section>
      </SessionGate>
    </PageContainer>
  );
}

function toErrorMessage(error: unknown): string {
  return getApiErrorMessage(error, 'Unable to reach the API');
}

function toNotificationType(value: unknown): NotificationItem['type'] {
  if (value === 'success' || value === 'warning' || value === 'error' || value === 'info') {
    return value;
  }
  return 'info';
}
