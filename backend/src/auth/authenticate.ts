import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { ERROR_CODES } from '../constants';
import { AppError, AuthenticationError, DatabaseError } from '../errors';
import type { UserRepository } from '../repositories/user.repository';
import { asyncHandler } from '../utils/async-handler';
import { setRequestActor } from '../utils/request-context';
import { assertAccountActive } from './account';
import { readAccessCookie } from './session-cookies';
import type { TokenRevocationStore } from './token-revocation';
import type { TokenService } from './jwt';
import { toAuthenticatedUser, type AuthenticatedUser } from './types';

export interface AuthenticateDependencies {
  tokenService: TokenService | null;
  users: UserRepository | null;
  revocation?: TokenRevocationStore | null;
}

export function extractBearerToken(header: string | undefined): string {
  if (!header) {
    throw new AuthenticationError('Authentication required');
  }

  const match = /^(Bearer)\s+(\S+)$/i.exec(header.trim());
  if (!match) {
    throw new AuthenticationError('Invalid or malformed token');
  }

  return match[2];
}

export function tryExtractBearerToken(header: string | undefined): string | undefined {
  if (!header) {
    return undefined;
  }

  try {
    return extractBearerToken(header);
  } catch {
    return undefined;
  }
}

export function extractAccessToken(req: Request): string {
  const bearer = tryExtractBearerToken(req.header('authorization'));
  if (bearer) {
    return bearer;
  }

  const cookie = readAccessCookie(req);
  if (cookie) {
    return cookie;
  }

  throw new AuthenticationError('Authentication required');
}

export function tryExtractAccessToken(req: Request): string | undefined {
  const bearer = tryExtractBearerToken(req.header('authorization'));
  if (bearer) {
    return bearer;
  }

  return readAccessCookie(req);
}

export function getAuthenticatedUser(req: Request): AuthenticatedUser {
  if (!req.user) {
    throw new AuthenticationError('Authentication required');
  }

  return req.user;
}

export function authenticate(dependencies: AuthenticateDependencies): RequestHandler {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    await attachAuthenticatedUser(req, dependencies, extractAccessToken(req));
    next();
  });
}

export function authenticateOptional(dependencies: AuthenticateDependencies): RequestHandler {
  return asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
    const token = tryExtractAccessToken(req);
    if (!token) {
      next();
      return;
    }

    await attachAuthenticatedUser(req, dependencies, token);
    next();
  });
}

async function attachAuthenticatedUser(
  req: Request,
  dependencies: AuthenticateDependencies,
  token: string,
): Promise<void> {
  if (!dependencies.tokenService) {
    throw new AppError(ERROR_CODES.INTERNAL_ERROR, 'Authentication is not configured', 500);
  }

  const claims = dependencies.tokenService.verifyAccess(token);
  if (dependencies.revocation) {
    await dependencies.revocation.assertAccessAllowed(claims);
  }

  if (!dependencies.users) {
    throw new DatabaseError('Database is not configured');
  }

  const record = await dependencies.users.findByIdWithRoles(claims.sub);

  if (!record) {
    throw new AuthenticationError('Authentication required');
  }

  assertAccountActive(record.status);

  req.user = toAuthenticatedUser(record);
  setRequestActor(req.user.id);
}
