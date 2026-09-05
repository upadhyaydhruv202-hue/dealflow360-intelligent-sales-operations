import type { ApiResponse } from '@hackathon/api-contract';
import { createContext, createElement, useContext, type ReactNode } from 'react';

const DEFAULT_BASE_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly body?: ApiResponse<unknown>,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export type QueryValue = string | number | boolean | null | undefined;

export interface ApiRequestOptions {
  method?: string;
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  query?: Record<string, QueryValue>;
  idempotencyKey?: string;
}

export interface ApiClientConfig {
  baseUrl?: string;
  getToken?: () => string | undefined | Promise<string | undefined>;
  fetchImpl?: typeof fetch;
}

export function joinApiPath(path: string, query?: Record<string, QueryValue>): string {
  if (!query) {
    return path;
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${path}${path.includes('?') ? '&' : '?'}${qs}` : path;
}

export function getApiErrorMessage(error: unknown, fallback = 'Request failed'): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export function createApiClient(config: ApiClientConfig = {}) {
  const baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;

  async function request<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
    const token = options.token ?? (await config.getToken?.());
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...options.headers,
    };
    if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
    if (options.idempotencyKey) {
      headers['Idempotency-Key'] = options.idempotencyKey;
    }

    const url = `${baseUrl}${joinApiPath(path, options.query)}`;
    const fetchImpl = config.fetchImpl ?? globalThis.fetch;
    const response = await fetchImpl(url, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      credentials: 'include',
    });

    let body: ApiResponse<T> | undefined;
    try {
      body = (await response.json()) as ApiResponse<T>;
    } catch {
      throw new ApiClientError(`Request failed: ${response.status}`, response.status);
    }

    if (!response.ok || !body || !body.success) {
      const message = body && !body.success ? body.error.message : `Request failed: ${response.status}`;
      throw new ApiClientError(message, response.status, body);
    }

    return body.data;
  }

  return {
    request,
    get: <T>(path: string, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}) =>
      request<T>(path, { ...options, method: 'GET' }),
    post: <T>(path: string, body?: unknown, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}) =>
      request<T>(path, { ...options, method: 'POST', body }),
    put: <T>(path: string, body?: unknown, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}) =>
      request<T>(path, { ...options, method: 'PUT', body }),
    patch: <T>(path: string, body?: unknown, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}) =>
      request<T>(path, { ...options, method: 'PATCH', body }),
    delete: <T>(path: string, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}) =>
      request<T>(path, { ...options, method: 'DELETE' }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;

export const api = createApiClient();

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  return api.get<T>(path, { token });
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return api.request<T>(path, options);
}

const ApiClientContext = createContext<ApiClient>(api);

export function ApiClientProvider({ client, children }: { client?: ApiClient; children: ReactNode }) {
  return createElement(ApiClientContext.Provider, { value: client ?? api }, children);
}

export function useApiClient(): ApiClient {
  return useContext(ApiClientContext);
}
