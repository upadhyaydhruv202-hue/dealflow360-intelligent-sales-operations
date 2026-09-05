import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  AppError,
  DatabaseError,
  ExternalServiceError,
  TimeoutError,
  ValidationError,
} from './app-error';
import { normalizeError } from './normalize';

describe('normalizeError', () => {
  it('maps malformed JSON to ValidationError', () => {
    const error = Object.assign(new SyntaxError('Unexpected token'), {
      status: 400,
      type: 'entity.parse.failed',
      body: '{"email":',
    });

    const normalized = normalizeError(error);
    expect(normalized).toBeInstanceOf(ValidationError);
    expect((normalized as ValidationError).details).toEqual([
      { path: 'body', message: 'Request body must be valid JSON', code: 'invalid_json' },
    ]);
  });

  it('maps payload and upload size limits to ValidationError', () => {
    expect(
      normalizeError(Object.assign(new Error('too large'), { type: 'entity.too.large', status: 413 })),
    ).toBeInstanceOf(ValidationError);
    expect(normalizeError(Object.assign(new Error('file'), { code: 'LIMIT_FILE_SIZE' }))).toBeInstanceOf(
      ValidationError,
    );
  });

  it('maps provider timeouts and network failures', () => {
    expect(normalizeError(Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }))).toBeInstanceOf(
      TimeoutError,
    );
    expect(normalizeError(Object.assign(new Error('aborted'), { name: 'AbortError' }))).toBeInstanceOf(
      TimeoutError,
    );
    expect(normalizeError(Object.assign(new Error('down'), { code: 'ECONNREFUSED' }))).toBeInstanceOf(
      ExternalServiceError,
    );
  });

  it('maps Prisma validation failures without leaking internals', () => {
    const error = new Prisma.PrismaClientValidationError('Invalid `prisma.user.create()` invocation in D:\\app\\src\\user.ts', {
      clientVersion: '0.0.0',
    });
    const normalized = normalizeError(error);
    expect(normalized).toBeInstanceOf(ValidationError);
    expect((normalized as ValidationError).message).toBe('The provided data is invalid');
    expect((normalized as ValidationError).message).not.toContain('D:\\');
  });

  it('maps known Prisma request errors through the database mapper', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '0.0.0',
      meta: { target: ['email'] },
    });

    const normalized = normalizeError(error);
    expect(normalized).toBeInstanceOf(Error);
    expect((normalized as Error).name).toBe('ConflictError');
  });

  it('wraps problem-module operational errors so HTTP can return their status', () => {
    const error = Object.assign(new Error('Quote not found'), {
      code: 'NOT_FOUND',
      statusCode: 404,
      isOperational: true,
      details: { id: 'q1' },
    });
    const normalized = normalizeError(error);
    expect(normalized).toBeInstanceOf(AppError);
    expect((normalized as AppError).statusCode).toBe(404);
    expect((normalized as AppError).code).toBe('NOT_FOUND');
  });

  it('leaves unknown errors unchanged so the handler can hide them', () => {
    const error = new Error('boom at D:\\secret\\file.ts with api-key=abc');
    expect(normalizeError(error)).toBe(error);
    expect(normalizeError(new DatabaseError())).toBeInstanceOf(DatabaseError);
  });
});
