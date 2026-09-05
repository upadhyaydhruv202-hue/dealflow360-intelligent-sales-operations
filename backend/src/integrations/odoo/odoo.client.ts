import { REQUEST_ID } from '../../constants';
import { ExternalServiceError } from '../../errors';
import type { AppLogger } from '../../utils/logger';
import { getRequestId } from '../../utils/request-context';
import {
  buildOdooJson2Url,
  buildOdooVersionUrl,
  isIdempotentOdooMethod,
  ODOO_PROVIDER,
  type OdooRuntimeConfig,
} from './odoo.config';
import {
  isRetryableOdooError,
  mapOdooHttpError,
  mapOdooTransportError,
  parseRetryAfterMs,
} from './odoo.errors';

export type OdooFetch = (input: string, init: RequestInit) => Promise<Response>;
export type OdooSleeper = (ms: number) => Promise<void>;

export interface OdooClientOptions {
  config: OdooRuntimeConfig;
  logger: AppLogger;
  fetchImpl?: OdooFetch;
  sleep?: OdooSleeper;
}

export interface OdooCallOptions {
  model: string;
  method: string;
  body?: Record<string, unknown>;
  idempotent?: boolean;
}

export class OdooClient {
  private readonly fetchImpl: OdooFetch;
  private readonly sleep: OdooSleeper;

  constructor(private readonly options: OdooClientOptions) {
    this.fetchImpl = options.fetchImpl ?? defaultFetch;
    this.sleep = options.sleep ?? defaultSleep;
  }

  async ping(): Promise<void> {
    await this.call({
      model: 'res.users',
      method: 'context_get',
      body: {},
      idempotent: true,
    });
  }

  async getVersion(): Promise<unknown> {
    return this.request(buildOdooVersionUrl(this.requireBaseUrl()), {
      method: 'GET',
      idempotent: true,
    });
  }

  async call<T = unknown>(input: OdooCallOptions): Promise<T> {
    const url = buildOdooJson2Url(this.requireBaseUrl(), input.model, input.method);
    const idempotent = input.idempotent ?? isIdempotentOdooMethod(input.method);

    return this.request<T>(url, {
      method: 'POST',
      body: JSON.stringify(input.body ?? {}),
      idempotent,
      model: input.model,
      odooMethod: input.method,
    });
  }

  private async request<T>(
    url: string,
    init: {
      method: 'GET' | 'POST';
      body?: string;
      idempotent: boolean;
      model?: string;
      odooMethod?: string;
    },
  ): Promise<T> {
    const maxAttempts = this.options.config.maxRetries + 1;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const started = Date.now();
      const requestId = getRequestId();

      try {
        const response = await this.fetchImpl(url, {
          method: init.method,
          headers: this.headers(requestId),
          body: init.body,
          signal: AbortSignal.timeout(this.options.config.timeoutMs),
        });

        const payload = await readJsonPayload(response);
        const durationMs = Date.now() - started;

        if (!response.ok) {
          const retryAfterMs = parseRetryAfterMs(response.headers.get('retry-after'));
          const mapped = mapOdooHttpError(response.status, payload, retryAfterMs);
          this.log('warn', {
            model: init.model,
            method: init.odooMethod,
            status: response.status,
            durationMs,
            attempt,
            requestId,
          });

          if (attempt < maxAttempts && isRetryableOdooError(mapped, init.idempotent)) {
            lastError = mapped;
            await this.sleep(retryAfterMs ?? backoffMs(this.options.config.retryBaseMs, attempt));
            continue;
          }

          throw mapped;
        }

        this.log('debug', {
          model: init.model,
          method: init.odooMethod,
          status: response.status,
          durationMs,
          attempt,
          requestId,
        });

        return payload as T;
      } catch (error) {
        if (isAppError(error)) {
          throw error;
        }

        const mapped = mapOdooTransportError(error);
        this.log('warn', {
          model: init.model,
          method: init.odooMethod,
          durationMs: Date.now() - started,
          attempt,
          requestId,
          error: mapped.message,
        });

        lastError = mapped;
        if (attempt < maxAttempts && isRetryableOdooError(mapped, init.idempotent)) {
          await this.sleep(backoffMs(this.options.config.retryBaseMs, attempt));
          continue;
        }

        throw mapped;
      }
    }

    throw lastError instanceof Error ? lastError : new ExternalServiceError('Odoo request failed', { provider: ODOO_PROVIDER });
  }

  private headers(requestId: string | undefined): Record<string, string> {
    const { apiKey, database, userAgent } = this.options.config;
    if (!apiKey) {
      throw new ExternalServiceError('Odoo API key is not configured', { provider: ODOO_PROVIDER });
    }

    const headers: Record<string, string> = {
      Authorization: `bearer ${apiKey}`,
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      'User-Agent': userAgent,
    };

    if (database) {
      headers['X-Odoo-Database'] = database;
    }

    if (requestId && REQUEST_ID.PATTERN.test(requestId)) {
      headers[REQUEST_ID.HEADER] = requestId;
    }

    return headers;
  }

  private requireBaseUrl(): string {
    const baseUrl = this.options.config.baseUrl;
    if (!baseUrl) {
      throw new ExternalServiceError('Odoo base URL is not configured', { provider: ODOO_PROVIDER });
    }

    return baseUrl;
  }

  private log(
    level: 'debug' | 'warn',
    payload: Record<string, unknown>,
  ): void {
    this.options.logger[level](
      {
        provider: ODOO_PROVIDER,
        ...payload,
      },
      'Odoo request',
    );
  }
}

async function readJsonPayload(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ExternalServiceError('Odoo returned a non-JSON response', {
      provider: ODOO_PROVIDER,
      status: response.status,
    });
  }
}

function backoffMs(baseMs: number, attempt: number): number {
  return baseMs * 2 ** (attempt - 1);
}

function defaultFetch(input: string, init: RequestInit): Promise<Response> {
  return fetch(input, init);
}

function defaultSleep(ms: number): Promise<void> {
  if (ms <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isAppError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'statusCode' in error && 'code' in error);
}
