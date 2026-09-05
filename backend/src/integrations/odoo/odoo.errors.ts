import {
  AuthenticationError,
  AuthorizationError,
  ExternalServiceError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
  ValidationError,
  type AppError,
} from '../../errors';
import { ODOO_PROVIDER } from './odoo.config';

export interface OdooErrorBody {
  name?: string;
  message?: string;
  arguments?: unknown[];
  context?: Record<string, unknown>;
  debug?: string;
}

export function isOdooTimeoutError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const typed = error as { name?: string; code?: string; cause?: { code?: string; name?: string } };
  const name = typed.name ?? typed.cause?.name;
  const code = typed.code ?? typed.cause?.code;

  return (
    name === 'TimeoutError' ||
    name === 'AbortError' ||
    code === 'ABORT_ERR' ||
    code === 'ETIMEDOUT' ||
    code === 'ESOCKETTIMEDOUT' ||
    code === 'UND_ERR_CONNECT_TIMEOUT'
  );
}

export function isRetryableNetworkError(error: unknown): boolean {
  if (isOdooTimeoutError(error)) {
    return true;
  }

  if (!error || typeof error !== 'object') {
    return false;
  }

  const typed = error as { code?: string; cause?: { code?: string } };
  const code = typed.code ?? typed.cause?.code;
  return (
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'EAI_AGAIN' ||
    code === 'ECONNRESET' ||
    code === 'EHOSTUNREACH' ||
    code === 'EPIPE' ||
    code === 'UND_ERR_SOCKET'
  );
}

export function isRetryableOdooError(error: unknown, idempotent: boolean): boolean {
  if (error instanceof RateLimitError) {
    return true;
  }

  if (error instanceof TimeoutError) {
    return idempotent;
  }

  if (error instanceof ExternalServiceError) {
    const status = (error.details as { status?: number } | undefined)?.status;
    return idempotent && (status === 502 || status === 503 || status === 504);
  }

  return isRetryableNetworkError(error) && idempotent;
}

export function mapOdooHttpError(status: number, payload: unknown, retryAfterMs?: number): AppError {
  const body = asErrorBody(payload);
  const message = publicOdooMessage(status, body);
  const details = {
    provider: ODOO_PROVIDER,
    status,
    odooError: body?.name,
    retryAfterMs,
  };

  if (status === 401) {
    return new AuthenticationError(message, details);
  }

  if (status === 403) {
    return new AuthorizationError(message, details);
  }

  if (status === 404) {
    return new NotFoundError(message, details);
  }

  if (status === 429) {
    return new RateLimitError(message, details);
  }

  if (status === 400 || status === 422) {
    return new ValidationError(message, [
      {
        path: 'odoo',
        message,
        code: body?.name ?? 'odoo_validation_error',
      },
    ]);
  }

  if (status >= 500) {
    return new ExternalServiceError(message, details);
  }

  return new ExternalServiceError(message, details);
}

export function mapOdooTransportError(error: unknown): AppError {
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) {
    return error;
  }

  if (
    error instanceof NotFoundError ||
    error instanceof RateLimitError ||
    error instanceof ValidationError ||
    error instanceof ExternalServiceError ||
    error instanceof TimeoutError
  ) {
    return error;
  }

  if (isOdooTimeoutError(error)) {
    return new TimeoutError('Odoo request timed out', { provider: ODOO_PROVIDER });
  }

  if (isRetryableNetworkError(error)) {
    return new ExternalServiceError('Odoo is unreachable', { provider: ODOO_PROVIDER });
  }

  return new ExternalServiceError('Odoo request failed', { provider: ODOO_PROVIDER });
}

export function parseRetryAfterMs(header: string | null): number | undefined {
  if (!header) {
    return undefined;
  }

  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(Math.round(seconds * 1000), 5_000);
  }

  return undefined;
}

function asErrorBody(payload: unknown): OdooErrorBody | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  return payload as OdooErrorBody;
}

function publicOdooMessage(status: number, body: OdooErrorBody | undefined): string {
  const raw = typeof body?.message === 'string' ? body.message.trim() : '';
  const safe = raw && raw.length <= 200 && !looksLikeTraceback(raw) ? raw : '';

  if (status === 401) {
    return safe || 'Odoo authentication failed';
  }

  if (status === 403) {
    return safe || 'Odoo denied access to this resource';
  }

  if (status === 404) {
    return safe || 'Odoo model or record was not found';
  }

  if (status === 429) {
    return 'Odoo rate limit exceeded';
  }

  if (status === 400 || status === 422) {
    return safe || 'Odoo rejected the request';
  }

  if (status >= 500) {
    return 'Odoo is unavailable';
  }

  return safe || 'Odoo request failed';
}

function looksLikeTraceback(message: string): boolean {
  return /traceback|werkzeug|\/opt\/|file "/i.test(message);
}
