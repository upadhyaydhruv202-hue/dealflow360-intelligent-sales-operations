import { useEffect, useRef } from 'react';

import { subscribeRealtime, type RealtimeEvent, type RealtimeReady } from '../services/realtime';

export function useRealtime(options: {
  token?: string;
  channels?: readonly string[];
  enabled?: boolean;
  onEvent: (event: RealtimeEvent) => void;
  onReady?: (ready: RealtimeReady) => void;
}) {
  const onEventRef = useRef(options.onEvent);
  const onReadyRef = useRef(options.onReady);
  onEventRef.current = options.onEvent;
  onReadyRef.current = options.onReady;

  useEffect(() => {
    if (!options.enabled || !options.token) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    async function connect() {
      try {
        await subscribeRealtime({
          token: options.token as string,
          channels: options.channels,
          signal: controller.signal,
          onEvent: (event) => onEventRef.current(event),
          onReady: (ready) => onReadyRef.current?.(ready),
        });
      } catch (error) {
        if (cancelled || controller.signal.aborted) {
          return;
        }
        const match = error instanceof Error ? error.message.match(/failed: (\d+)/) : null;
        const status = match ? Number(match[1]) : 0;
        if (status === 401 || status === 403 || status === 404) {
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
        if (!cancelled) {
          void connect();
        }
      }
    }

    void connect();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [options.enabled, options.token, options.channels?.join(',')]);
}
