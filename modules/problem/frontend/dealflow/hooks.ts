import { useCallback, useEffect, useState } from 'react';

import { getApiErrorMessage } from '@/services/api';

import { getDealflowCatalog, getQuote, listQuotes } from './api';
import type { DealflowCatalog, QuoteView } from './types';

interface LoadState<T> {
  loading: boolean;
  error?: string;
  data?: T;
}

export function useQuotes(token: string | undefined) {
  const [state, setState] = useState<LoadState<QuoteView[]>>({ loading: Boolean(token) });

  const reload = useCallback(async () => {
    if (!token) {
      setState({ loading: false, error: undefined, data: undefined });
      return;
    }
    setState((current) => ({ ...current, loading: true, error: undefined }));
    try {
      const data = await listQuotes(token);
      setState({ loading: false, data });
    } catch (error) {
      setState({ loading: false, error: getApiErrorMessage(error, 'Unable to load quotations') });
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}

export function useCatalog(token: string | undefined) {
  const [state, setState] = useState<LoadState<DealflowCatalog>>({ loading: Boolean(token) });

  const reload = useCallback(async () => {
    if (!token) {
      setState({ loading: false });
      return;
    }
    try {
      const data = await getDealflowCatalog(token);
      setState({ loading: false, data });
    } catch (error) {
      setState({ loading: false, error: getApiErrorMessage(error, 'Unable to load catalog') });
    }
  }, [token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload };
}

export function useQuote(id: string | undefined, token: string | undefined) {
  const [state, setState] = useState<LoadState<QuoteView>>({ loading: Boolean(id && token) });

  const reload = useCallback(async () => {
    if (!id || !token) {
      setState({ loading: false });
      return;
    }
    setState((current) => ({ ...current, loading: !current.data, error: undefined }));
    try {
      const data = await getQuote(id, token);
      setState({ loading: false, data });
    } catch (error) {
      setState({ loading: false, error: getApiErrorMessage(error, 'Unable to load quotation') });
    }
  }, [id, token]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { ...state, reload, setQuote: (data: QuoteView) => setState({ loading: false, data }) };
}
