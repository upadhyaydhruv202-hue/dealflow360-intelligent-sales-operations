import { Prisma } from '@prisma/client';

import { ConflictError, DatabaseError, NotFoundError, ValidationError } from '../errors/app-error';

export function mapPrismaError(error: unknown): never {
  if (error instanceof ConflictError || error instanceof ValidationError || error instanceof NotFoundError) {
    throw error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new ConflictError('A record with this value already exists', {
        fields: error.meta?.target,
      });
    }

    if (error.code === 'P2003') {
      throw new ValidationError('Related record does not exist', {
        field: error.meta?.field_name,
      });
    }

    if (error.code === 'P2025') {
      throw new NotFoundError('Record not found');
    }

    if (error.code === 'P2004' || error.code === 'P2011') {
      throw new ValidationError('The provided data failed a database constraint');
    }

    throw new DatabaseError('Database operation failed', { code: error.code });
  }

  if (isCheckConstraintViolation(error)) {
    throw new ValidationError('The provided data failed a database constraint');
  }

  throw new DatabaseError('Database operation failed');
}

export async function runDatabase<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    mapPrismaError(error);
  }
}

function isCheckConstraintViolation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('violates check constraint');
}
