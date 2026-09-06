import { useCallback, useEffect, useRef, useState } from 'react';

import { useOptionalFeatures } from '@/features';
import { getApiErrorMessage } from '@/services/api';
import { subscribeRealtime, type RealtimeEvent } from '@/services/realtime';

import { getDealflowCatalog, getQuote, listAnomalies, listQuotes } from './api';
import type { DealflowCatalog, QuoteView } from './types';

interface SharedDealflowRealtime {
  listeners: Set<() => void>;
  controller: AbortController;
  cancelled: boolean;
}

const sharedRealtime = new Map<string, SharedDealflowRealtime>();

function isDealflowRealtimeEvent(event: RealtimeEvent): boolean {
  const payload = event.payload ?? {};
  return payload.source === 'dealflow' || payload.kind === 'dealflow' || event.type === 'dashboard.updated';
}

function connectSharedDealflowRealtime(token: string, entry: SharedDealflowRealtime) {
  void (async function connect() {
    try {
      await subscribeRealtime({
        token,
        channels: ['dashboard'],
        signal: entry.controller.signal,
        onEvent: (event) => {
          if (!isDealflowRealtimeEvent(event)) {
            return;
          }
          for (const listener of [...entry.listeners]) {
            listener();
          }
        },
      });
    } catch (error) {
      if (entry.cancelled || entry.controller.signal.aborted) {
        return;
      }
      const match = error instanceof Error ? error.message.match(/failed: (\d+)/) : null;
      const status = match ? Number(match[1]) : 0;
      if (status === 401 || status === 403 || status === 404) {
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (!entry.cancelled) {
        entry.controller = new AbortController();
        connectSharedDealflowRealtime(token, entry);
      }
    }
  })();
}

interface LoadState<T> {
  loading: boolean;
  error?: string;
  data?: T;
}

export function useQuotes(token: string | undefined) {
  const [state, setState] = useState<LoadState<QuoteView[]>>({ loading: Boolean(token) });

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    if (!token) {
      setState({ loading: false, error: undefined, data: undefined });
      return;
    }
    setState((current) => ({ ...current, loading: options?.silent ? Boolean(current.loading && !current.data) : true, error: undefined }));
    try {
      const data = await listQuotes(token);
      setState({ loading: false, data });
    } catch (error) {
      setState((current) => ({
        loading: false,
        data: options?.silent ? current.data : undefined,
        error: getApiErrorMessage(error, 'Unable to load quotations'),
      }));
    }
  }, [token]);

  useDealflowRealtime(token, () => {
    void reload({ silent: true });
  });

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload: () => reload() };
}

export function useCatalog(token: string | undefined) {
  const [state, setState] = useState<LoadState<DealflowCatalog>>({ loading: Boolean(token) });

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    if (!token) {
      setState({ loading: false });
      return;
    }
    setState((current) => ({
      ...current,
      loading: options?.silent ? Boolean(current.loading && !current.data) : true,
      error: undefined,
    }));
    try {
      const data = await getDealflowCatalog(token);
      setState({ loading: false, data });
    } catch (error) {
      setState((current) => ({
        loading: false,
        data: options?.silent ? current.data : undefined,
        error: getApiErrorMessage(error, 'Unable to load catalog'),
      }));
    }
  }, [token]);

  useDealflowRealtime(token, () => {
    void reload({ silent: true });
  });

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}

export function useQuote(id: string | undefined, token: string | undefined) {
  const [state, setState] = useState<LoadState<QuoteView>>({ loading: Boolean(id && token) });

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    if (!id || !token) {
      setState({ loading: false });
      return;
    }
    setState((current) => ({
      ...current,
      loading: options?.silent ? Boolean(current.loading && !current.data) : !current.data,
      error: undefined,
    }));
    try {
      const data = await getQuote(id, token);
      setState({ loading: false, data });
    } catch (error) {
      setState((current) => ({
        loading: false,
        data: options?.silent ? current.data : undefined,
        error: getApiErrorMessage(error, 'Unable to load quotation'),
      }));
    }
  }, [id, token]);

  useDealflowRealtime(token, () => {
    void reload({ silent: true });
  });

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload, setQuote: (data: QuoteView) => setState({ loading: false, data }) };
}

export function useAnomalies(token: string | undefined) {
  const [state, setState] = useState<LoadState<Awaited<ReturnType<typeof listAnomalies>>>>({ loading: Boolean(token) });

  const reload = useCallback(async (options?: { silent?: boolean }) => {
    if (!token) {
      setState({ loading: false });
      return;
    }
    setState((current) => ({
      ...current,
      loading: options?.silent ? Boolean(current.loading && !current.data) : true,
      error: undefined,
    }));
    try {
      const data = await listAnomalies(token);
      setState({ loading: false, data });
    } catch (error) {
      setState((current) => ({
        loading: false,
        data: options?.silent ? current.data : undefined,
        error: getApiErrorMessage(error, 'Unable to load anomalies'),
      }));
    }
  }, [token]);

  useDealflowRealtime(token, () => {
    void reload({ silent: true });
  });

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}

export function useDealflowRealtime(token: string | undefined, onRefresh: () => void) {
  const features = useOptionalFeatures();
  const enabled = Boolean(token) && features?.isEnabled('realtime') === true;
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled || !token) {
      return;
    }

    const listener = () => onRefreshRef.current();
    let entry = sharedRealtime.get(token);
    if (!entry) {
      entry = { listeners: new Set(), controller: new AbortController(), cancelled: false };
      sharedRealtime.set(token, entry);
      connectSharedDealflowRealtime(token, entry);
    }
    entry.listeners.add(listener);

    return () => {
      entry.listeners.delete(listener);
      if (entry.listeners.size === 0) {
        entry.cancelled = true;
        entry.controller.abort();
        sharedRealtime.delete(token);
      }
    };
  }, [enabled, token]);
}
