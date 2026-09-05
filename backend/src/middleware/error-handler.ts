import type { NextFunction, Request, Response } from 'express';

import { ERROR_CODES } from '../constants';
import { AppError, normalizeError, sanitizeErrorDetails, sanitizeErrorMessage } from '../errors';
import type { ErrorDetails } from '../types/api';
import type { ErrorTracker } from '../observability';
import type { AppLogger } from '../utils/logger';
import { getRequestId } from '../utils/request-context';
import { sendError } from '../utils/response';

const SAFE_INTERNAL_MESSAGE = 'An unexpected error occurred';

export function errorHandler(
  logger: AppLogger,
  _isProduction: boolean,
  errors?: ErrorTracker | null,
) {
  return (error: unknown, req: Request, res: Response, _next: NextFunction): void => {
    if (res.headersSent) {
      return;
    }

    const requestId = req.requestId ?? getRequestId() ?? 'unknown';
    const normalized = normalizeError(error);

    if (normalized instanceof AppError) {
      if (normalized.statusCode >= 500) {
        logger.error({ err: error, requestId, code: normalized.code, module: 'http' }, normalized.message);
        errors?.captureException(error, { requestId, module: 'http' });
      } else {
        logger.warn({ err: error, requestId, code: normalized.code, module: 'http' }, normalized.message);
      }

      sendError(res, {
        statusCode: normalized.statusCode,
        code: normalized.code,
        message:
          _isProduction && normalized.statusCode >= 500
            ? SAFE_INTERNAL_MESSAGE
            : sanitizeErrorMessage(normalized.message),
        details:
          _isProduction && normalized.statusCode >= 500
            ? {}
            : (sanitizeErrorDetails(normalized.details) as ErrorDetails),
        requestId,
      });
      return;
    }

    logger.error({ err: error, requestId, module: 'http' }, 'Unhandled error');
    errors?.captureException(error, { requestId, module: 'http' });

    sendError(res, {
      statusCode: 500,
      code: ERROR_CODES.INTERNAL_ERROR,
      message: SAFE_INTERNAL_MESSAGE,
      details: {},
      requestId,
    });
  };
}
