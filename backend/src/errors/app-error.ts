import { ERROR_CODES, type ErrorCode } from '../constants';

export interface ValidationIssue {
  path: string;
  message: string;
  code: string;
}

export type ErrorDetails = Record<string, unknown> | ValidationIssue[];

export class AppError extends Error {
  readonly code: ErrorCode | string;
  readonly statusCode: number;
  readonly details: ErrorDetails;
  readonly isOperational: boolean;

  constructor(
    code: ErrorCode | string,
    message: string,
    statusCode = 500,
    details: ErrorDetails = {},
    isOperational = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Invalid request', details: ErrorDetails = []) {
    super(ERROR_CODES.VALIDATION_ERROR, message, 400, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required', details: ErrorDetails = {}) {
    super(ERROR_CODES.AUTHENTICATION_ERROR, message, 401, details);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'You are not allowed to perform this action', details: ErrorDetails = {}) {
    super(ERROR_CODES.AUTHORIZATION_ERROR, message, 403, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', details: ErrorDetails = {}) {
    super(ERROR_CODES.NOT_FOUND, message, 404, details);
  }
}

export class FeatureDisabledError extends AppError {
  constructor(feature: string, details: Record<string, unknown> = {}) {
    super(ERROR_CODES.FEATURE_DISABLED, `${feature} is not enabled`, 404, { feature, ...details });
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict', details: ErrorDetails = {}) {
    super(ERROR_CODES.CONFLICT, message, 409, details);
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', details: ErrorDetails = {}) {
    super(ERROR_CODES.RATE_LIMIT, message, 429, details);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message = 'External service failed', details: ErrorDetails = {}) {
    super(ERROR_CODES.EXTERNAL_SERVICE_ERROR, message, 502, details);
  }
}

export class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', details: ErrorDetails = {}) {
    super(ERROR_CODES.DATABASE_ERROR, message, 503, details);
  }
}

export class TimeoutError extends AppError {
  constructor(message = 'The operation timed out', details: ErrorDetails = {}) {
    super(ERROR_CODES.TIMEOUT, message, 504, details);
  }
}
