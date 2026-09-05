import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { asyncHandler } from '../utils/async-handler';
import { assertPermission, assertRole } from './authorize';

/**
 * Require the caller to have at least one of the listed roles.
 * Role names are case-insensitive (`ADMIN` === `admin`).
 *
 * ADMIN is not implied. Missing roles are denied even if the user is an admin.
 */
export function authorizeRole(...roles: string[]): RequestHandler {
  if (roles.length === 0) {
    throw new Error('authorizeRole requires at least one role name');
  }

  return asyncHandler((req: Request, _res: Response, next: NextFunction) => {
    assertRole(req.user, ...roles);
    next();
  });
}

/**
 * Require the caller to have every listed permission (`resource.action`).
 *
 * Unknown keys are denied. Adding `inventory.approve` does not require middleware changes.
 * Odoo access is a permission check, not a side effect of being logged in.
 */
export function requirePermission(...permissions: string[]): RequestHandler {
  if (permissions.length === 0) {
    throw new Error('requirePermission requires at least one permission key');
  }

  return asyncHandler((req: Request, _res: Response, next: NextFunction) => {
    assertPermission(req.user, ...permissions);
    next();
  });
}
