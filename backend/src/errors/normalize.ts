import { Prisma } from '@prisma/client';

import { mapPrismaError } from '../lib/prisma-error';
import {
  AppError,
  ExternalServiceError,
  TimeoutError,
  ValidationError,
  type ErrorDetails,
} from './app-error';

export function normalizeError(error: unknown): unknown {
  if (error instanceof AppError) {
    return error;
  }

  if (isOperationalHttpError(error)) {
    return new AppError(error.code, error.message, error.statusCode, error.details ?? {});
  }

  if (isMalformedJson(error)) {
    return new ValidationError('Malformed JSON body', [
      { path: 'body', message: 'Request body must be valid JSON', code: 'invalid_json' },
    ]);
  }

  if (isPayloadTooLarge(error)) {
    return new ValidationError('Request body is too large', [
      { path: 'body', message: 'Request body exceeds the configured size limit', code: 'too_big' },
    ]);
  }

  if (isUploadTooLarge(error)) {
    return new ValidationError('Uploaded file is too large', [
      { path: 'file.size', message: 'File exceeds the maximum allowed size', code: 'too_big' },
    ]);
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return new ValidationError('The provided data is invalid');
  }

  if (isPrismaError(error)) {
    try {
      mapPrismaError(error);
    } catch (mapped) {
      return mapped;
    }
  }

  if (isTimeout(error)) {
    return new TimeoutError();
  }

  if (isExternalNetworkError(error)) {
    return new ExternalServiceError();
  }

  return error;
}

function isOperationalHttpError(
  error: unknown,
): error is Error & { code: string; statusCode: number; details?: ErrorDetails; isOperational: true } {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const typed = error as { code?: unknown; statusCode?: unknown; isOperational?: unknown; message?: unknown };
  return (
    typeof typed.code === 'string' &&
    typeof typed.statusCode === 'number' &&
    typed.statusCode >= 400 &&
    typed.statusCode < 600 &&
    typed.isOperational === true &&
    typeof typed.message === 'string'
  );
}

function isMalformedJson(error: unknown): boolean {
  if (!(error instanceof SyntaxError)) {
    return false;
  }

  const typed = error as SyntaxError & { status?: number; type?: string };
  return typed.type === 'entity.parse.failed' || typed.status === 400;
}

function isPayloadTooLarge(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const typed = error as { status?: number; statusCode?: number; type?: string };
  return typed.type === 'entity.too.large' || typed.status === 413 || typed.statusCode === 413;
}

function isUploadTooLarge(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return (error as { code?: string }).code === 'LIMIT_FILE_SIZE';
}

function isPrismaError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError ||
    error instanceof Prisma.PrismaClientUnknownRequestError ||
    error instanceof Prisma.PrismaClientRustPanicError ||
    error instanceof Prisma.PrismaClientInitializationError
  );
}

function isTimeout(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const typed = error as { name?: string; code?: string };
  return (
    typed.name === 'TimeoutError' ||
    typed.name === 'AbortError' ||
    typed.code === 'ETIMEDOUT' ||
    typed.code === 'ESOCKETTIMEDOUT' ||
    typed.code === 'UND_ERR_CONNECT_TIMEOUT'
  );
}

function isExternalNetworkError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const typed = error as { code?: string };
  return (
    typed.code === 'ECONNREFUSED' ||
    typed.code === 'ENOTFOUND' ||
    typed.code === 'EAI_AGAIN' ||
    typed.code === 'ECONNRESET' ||
    typed.code === 'EHOSTUNREACH'
  );
}
