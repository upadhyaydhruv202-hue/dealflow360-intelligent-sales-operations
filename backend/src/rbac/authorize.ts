import type { AuthenticatedUser } from '../auth/types';
import { AuthenticationError, AuthorizationError } from '../errors';
import { normalizePermissionKey, normalizeRoleName } from './names';

export function hasRole(user: Pick<AuthenticatedUser, 'roles'>, ...roles: string[]): boolean {
  const owned = new Set(user.roles.map(normalizeRoleName));
  return roles.some((role) => owned.has(normalizeRoleName(role)));
}

export function hasPermission(
  user: Pick<AuthenticatedUser, 'permissions'>,
  ...permissions: string[]
): boolean {
  const owned = new Set(user.permissions.map(normalizePermissionKey));
  return permissions.every((permission) => owned.has(normalizePermissionKey(permission)));
}

export function hasAnyPermission(
  user: Pick<AuthenticatedUser, 'permissions'>,
  ...permissions: string[]
): boolean {
  const owned = new Set(user.permissions.map(normalizePermissionKey));
  return permissions.some((permission) => owned.has(normalizePermissionKey(permission)));
}

export function assertAuthenticated(user: AuthenticatedUser | undefined): AuthenticatedUser {
  if (!user) {
    throw new AuthenticationError('Authentication required');
  }

  return user;
}

export function assertRole(user: AuthenticatedUser | undefined, ...roles: string[]): AuthenticatedUser {
  const current = assertAuthenticated(user);
  if (!hasRole(current, ...roles)) {
    throw new AuthorizationError('You are not allowed to perform this action', {
      requiredRoles: roles.map(normalizeRoleName),
    });
  }

  return current;
}

export function assertPermission(
  user: AuthenticatedUser | undefined,
  ...permissions: string[]
): AuthenticatedUser {
  const current = assertAuthenticated(user);
  if (!hasPermission(current, ...permissions)) {
    throw new AuthorizationError('You are not allowed to perform this action', {
      requiredPermissions: permissions.map(normalizePermissionKey),
    });
  }

  return current;
}
