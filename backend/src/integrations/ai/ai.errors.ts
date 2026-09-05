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

export const AI_PROVIDER_DETAIL = 'ai';

export function isAiTimeoutError(error: unknown): boolean {
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
  if (isAiTimeoutError(error)) {
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

export function isRetryableAiError(error: unknown): boolean {
  if (error instanceof RateLimitError || error instanceof TimeoutError) {
    return true;
  }

  if (error instanceof ExternalServiceError) {
    const status = (error.details as { status?: number } | undefined)?.status;
    return status === 408 || status === 429 || (typeof status === 'number' && status >= 500);
  }

  return isRetryableNetworkError(error);
}

export function isRetryableStructuredOutputError(error: unknown): boolean {
  return error instanceof ValidationError;
}

export function mapAiHttpError(
  status: number,
  payload: unknown,
  retryAfterMs?: number,
  provider = AI_PROVIDER_DETAIL,
): AppError {
  const message = publicAiMessage(status, payload);
  const details = {
    provider,
    status,
    retryAfterMs,
  };

  if (status === 401 || status === 403) {
    return new ExternalServiceError(message, details);
  }

  if (status === 404) {
    return new NotFoundError(message, details);
  }

  if (status === 429) {
    return new RateLimitError(message, details);
  }

  if (status === 400 || status === 422) {
    return new ExternalServiceError(message, details);
  }

  return new ExternalServiceError(message, details);
}

export function mapAiTransportError(error: unknown, provider = AI_PROVIDER_DETAIL): AppError {
  if (
    error instanceof AuthenticationError ||
    error instanceof AuthorizationError ||
    error instanceof NotFoundError ||
    error instanceof RateLimitError ||
    error instanceof ValidationError ||
    error instanceof ExternalServiceError ||
    error instanceof TimeoutError
  ) {
    return error;
  }

  if (isAiTimeoutError(error)) {
    return new TimeoutError('AI request timed out', { provider });
  }

  if (isRetryableNetworkError(error)) {
    return new ExternalServiceError('AI provider is unreachable', { provider });
  }

  return new ExternalServiceError('AI request failed', { provider });
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

function publicAiMessage(status: number, payload: unknown): string {
  const raw = extractProviderMessage(payload);
  const safe = raw && raw.length <= 200 && !looksLikeInternal(raw) ? raw : '';

  if (status === 401 || status === 403) {
    return 'AI provider authentication failed';
  }

  if (status === 404) {
    return safe || 'AI model was not found';
  }

  if (status === 429) {
    return 'AI provider rate limit exceeded';
  }

  if (status === 400 || status === 422) {
    return safe || 'AI provider rejected the request';
  }

  if (status >= 500) {
    return 'AI provider is unavailable';
  }

  return safe || 'AI request failed';
}

function extractProviderMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const typed = payload as { error?: { message?: string }; message?: string };
  const nested = typed.error?.message;
  if (typeof nested === 'string') {
    return nested.trim();
  }

  return typeof typed.message === 'string' ? typed.message.trim() : '';
}

function looksLikeInternal(message: string): boolean {
  return /traceback|api[_-]?key|aistudio|generativelanguage|\/v1beta/i.test(message);
}
