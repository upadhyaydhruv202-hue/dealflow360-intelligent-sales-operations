import { useState } from 'react';

import { SessionGate } from '../auth/SessionGate';
import { useAuth } from '../auth/AuthProvider';
import { useFeatures } from '../features';
import { useRealtime } from '../hooks/useRealtime';
import { getApiErrorMessage } from '../services/api';
import {
  getRealtimeChannels,
  REALTIME_CHANNELS,
  type RealtimeChannel,
  type RealtimeEvent,
} from '../services/realtime';
import { Alert, Badge, Breadcrumb, Button, Card, PageContainer } from '../ui';

export function RealtimePage() {
  const { accessToken } = useAuth();
  const { isEnabled } = useFeatures();
  const [available, setAvailable] = useState<RealtimeChannel[]>([]);
  const [selected, setSelected] = useState<RealtimeChannel[]>(['jobs', 'notifications']);
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [status, setStatus] = useState<'idle' | 'connected' | 'error'>('idle');
  const [error, setError] = useState<string>();
  const enabled = isEnabled('realtime') && Boolean(accessToken);

  useRealtime({
    token: accessToken,
    channels: selected,
    enabled,
    onReady: () => {
      setStatus('connected');
      setError(undefined);
    },
    onEvent: (event) => {
      setEvents((current) => [event, ...current].slice(0, 40));
    },
  });

  async function loadChannels() {
    if (!accessToken) {
      setError('Sign in to continue.');
      return;
    }
    try {
      const result = await getRealtimeChannels(accessToken);
      const names = result.channels.map((item) => item.name);
      setAvailable(names);
      setSelected((current) => current.filter((item) => names.includes(item)));
      setError(undefined);
    } catch (caught) {
      setError(getApiErrorMessage(caught, 'Unable to list realtime channels'));
    }
  }

  return (
    <PageContainer
      breadcrumb={<Breadcrumb items={[{ label: 'Home', to: '/' }, { label: 'Realtime' }]} />}
      title="Realtime"
      description="Optional Server-Sent Events for allowlisted job, notification, dashboard, automation, and document status. Polling still works when this flag is off."
    >
      <SessionGate title="Sign in to subscribe">
        <div className="mb-6 flex flex-wrap gap-2">
          <Button onClick={() => void loadChannels()}>Load allowed channels</Button>
          <Badge tone={status === 'connected' ? 'success' : 'neutral'}>
            {status === 'connected' ? 'Connected' : 'Idle'}
          </Badge>
        </div>

        {error ? (
          <Alert variant="error" title="Realtime" className="mb-6">
            {error}
          </Alert>
        ) : null}

        <Card className="mb-6 space-y-2 p-4">
          <p className="text-sm font-medium text-foreground">Allowlisted channels</p>
          <div className="flex flex-wrap gap-3">
            {(available.length > 0 ? available : REALTIME_CHANNELS).map((channel) => (
              <label key={channel} className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={selected.includes(channel)}
                  onChange={() =>
                    setSelected((current) =>
                      current.includes(channel)
                        ? current.filter((item) => item !== channel)
                        : [...current, channel],
                    )
                  }
                />
                {channel}
              </label>
            ))}
          </div>
        </Card>

        <ul className="space-y-2">
          {events.length === 0 ? (
            <li className="text-sm text-foreground-muted">No events yet. Enqueue a job or send a notification.</li>
          ) : (
            events.map((event) => (
              <li key={event.id} className="rounded-lg border border-edge bg-surface-elevated p-3 text-sm">
                <p className="font-medium text-foreground">
                  {event.type} · {event.channel}
                </p>
                <p className="text-xs text-foreground-muted">{event.occurredAt}</p>
                <pre className="mt-2 overflow-x-auto text-xs text-foreground-muted">
                  {JSON.stringify(event.payload, null, 2)}
                </pre>
              </li>
            ))
          )}
        </ul>
      </SessionGate>
    </PageContainer>
  );
}
