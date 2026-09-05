import {
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../errors';

export class UnretryableError extends Error {
  readonly retryable = false as const;

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = 'UnretryableError';
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
  }
}

export function isRetryableJobError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return true;
  }

  if (error instanceof UnretryableError) {
    return false;
  }

  if ((error as { retryable?: unknown }).retryable === false) {
    return false;
  }

  return !(
    error instanceof ValidationError ||
    error instanceof AuthenticationError ||
    error instanceof AuthorizationError ||
    error instanceof NotFoundError ||
    error instanceof ConflictError
  );
}
