import { describe, expect, it } from 'vitest';

import { ERROR_CODES } from '../constants';
import {
  AppError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  DatabaseError,
  ExternalServiceError,
  FeatureDisabledError,
  NotFoundError,
  RateLimitError,
  TimeoutError,
  ValidationError,
} from './index';

describe('AppError hierarchy', () => {
  it('uses operational defaults', () => {
    const error = new AppError('CUSTOM', 'failed', 418, { reason: 'teapot' });
    expect(error.code).toBe('CUSTOM');
    expect(error.statusCode).toBe(418);
    expect(error.details).toEqual({ reason: 'teapot' });
    expect(error.isOperational).toBe(true);
  });

  it('maps standard error types to the expected codes and status codes', () => {
    expect(new ValidationError().code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(new ValidationError().statusCode).toBe(400);
    expect(new AuthenticationError().statusCode).toBe(401);
    expect(new AuthorizationError().statusCode).toBe(403);
    expect(new NotFoundError().statusCode).toBe(404);
    expect(new FeatureDisabledError('ai').code).toBe(ERROR_CODES.FEATURE_DISABLED);
    expect(new FeatureDisabledError('ai').statusCode).toBe(404);
    expect(new ConflictError().statusCode).toBe(409);
    expect(new RateLimitError().statusCode).toBe(429);
    expect(new ExternalServiceError().statusCode).toBe(502);
    expect(new DatabaseError().statusCode).toBe(503);
    expect(new TimeoutError().statusCode).toBe(504);
    expect(new ValidationError().details).toEqual([]);
    expect(new ValidationError().message).toBe('Invalid request');
  });
});
