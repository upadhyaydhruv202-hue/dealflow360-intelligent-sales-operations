export class DomainError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly details: Record<string, unknown>;
  readonly isOperational = true as const;

  constructor(code: string, message: string, statusCode: number, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function notFound(message: string, details: Record<string, unknown> = {}): DomainError {
  return new DomainError('NOT_FOUND', message, 404, details);
}

export function conflict(message: string, details: Record<string, unknown> = {}): DomainError {
  return new DomainError('CONFLICT', message, 409, details);
}

export function forbidden(message: string, details: Record<string, unknown> = {}): DomainError {
  return new DomainError('AUTHORIZATION_ERROR', message, 403, details);
}

export function invalid(message: string, details: Record<string, unknown> = {}): DomainError {
  return new DomainError('VALIDATION_ERROR', message, 400, details);
}
