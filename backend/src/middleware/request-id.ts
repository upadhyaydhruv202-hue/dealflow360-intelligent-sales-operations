import { randomUUID } from 'node:crypto';

import type { NextFunction, Request, Response } from 'express';

import { AUDIT, REQUEST_ID } from '../constants';
import { runWithRequestContext } from '../utils/request-context';

export function resolveRequestId(headerValue: string | undefined): string {
  const candidate = headerValue?.trim();
  if (!candidate || candidate.length > REQUEST_ID.MAX_LENGTH || !REQUEST_ID.PATTERN.test(candidate)) {
    return randomUUID();
  }

  return candidate;
}

export function resolveClientIp(req: Pick<Request, 'ip' | 'socket'>): string | undefined {
  const raw = req.ip || req.socket?.remoteAddress;
  if (!raw) {
    return undefined;
  }

  const trimmed = raw.replace(/^::ffff:/, '').trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, AUDIT.MAX_IP_CHARS);
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = resolveRequestId(req.header(REQUEST_ID.HEADER));
  const ip = resolveClientIp(req);

  req.requestId = requestId;
  res.setHeader(REQUEST_ID.HEADER, requestId);
  runWithRequestContext({ requestId, ip }, () => next());
}
