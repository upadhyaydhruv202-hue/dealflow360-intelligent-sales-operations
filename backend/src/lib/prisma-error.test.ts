import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { ConflictError, DatabaseError, NotFoundError, ValidationError } from '../errors';
import { mapPrismaError } from './prisma-error';

describe('mapPrismaError', () => {
  it('maps unique constraint failures to ConflictError', () => {
    const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '0.0.0',
      meta: { target: ['email'] },
    });

    expect(() => mapPrismaError(error)).toThrow(ConflictError);
  });

  it('maps missing related records to ValidationError', () => {
    const error = new Prisma.PrismaClientKnownRequestError('FK failed', {
      code: 'P2003',
      clientVersion: '0.0.0',
      meta: { field_name: 'user_id' },
    });

    expect(() => mapPrismaError(error)).toThrow(ValidationError);
  });

  it('maps missing records to NotFoundError', () => {
    const error = new Prisma.PrismaClientKnownRequestError('No record', {
      code: 'P2025',
      clientVersion: '0.0.0',
    });

    expect(() => mapPrismaError(error)).toThrow(NotFoundError);
  });

  it('maps check constraint text to ValidationError', () => {
    expect(() => mapPrismaError(new Error('new row violates check constraint "users_email_format_check"'))).toThrow(
      ValidationError,
    );
  });

  it('maps unknown failures to DatabaseError without leaking internals', () => {
    try {
      mapPrismaError(new Error('ECONNREFUSED secret-host'));
      throw new Error('expected DatabaseError');
    } catch (error) {
      expect(error).toBeInstanceOf(DatabaseError);
      expect((error as DatabaseError).message).toBe('Database operation failed');
    }
  });
});
