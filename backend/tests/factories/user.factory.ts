import { randomUUID } from 'node:crypto';

import type { AuthenticatedUser } from '../../src/auth/types';
import type { PublicUser, Repositories } from '../../src/repositories';
import { ROLES } from '../../src/rbac/catalog';
import { TEST_PASSWORD_HASH } from './constants';
import { createPermission } from './permission.factory';
import { createRole } from './role.factory';
import { uniqueLabel } from './sequence';

export interface BuildUserInput {
  id?: string;
  email?: string;
  displayName?: string;
  passwordHash?: string;
  status?: PublicUser['status'];
}

export interface BuiltUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  status: PublicUser['status'];
}

export interface BuildActorInput {
  id?: string;
  email?: string;
  displayName?: string;
  status?: AuthenticatedUser['status'];
  role?: string;
  roles?: string[];
  permissions?: string[];
}

export function buildUser(overrides: BuildUserInput = {}): BuiltUser {
  const n = uniqueLabel('');
  return {
    id: overrides.id ?? randomUUID(),
    email: (overrides.email ?? `user-${n}@example.com`).trim().toLowerCase(),
    displayName: overrides.displayName ?? 'Test User',
    passwordHash: overrides.passwordHash ?? TEST_PASSWORD_HASH,
    status: overrides.status ?? 'active',
  };
}

export function buildActor(overrides: BuildActorInput = {}): AuthenticatedUser {
  const roles = overrides.roles ?? [overrides.role ?? ROLES.USER];
  return {
    id: overrides.id ?? '11111111-1111-4111-8111-111111111111',
    email: overrides.email ?? 'user@example.com',
    displayName: overrides.displayName ?? 'Test User',
    status: overrides.status ?? 'active',
    role: overrides.role ?? roles[0] ?? ROLES.USER,
    roles,
    permissions: overrides.permissions ?? [],
  };
}

export async function createUser(repos: Repositories, overrides: BuildUserInput = {}): Promise<PublicUser> {
  const built = buildUser(overrides);
  return repos.users.create({
    email: built.email,
    displayName: built.displayName,
    passwordHash: built.passwordHash,
    status: built.status,
  });
}

export async function createUserWithRole(
  repos: Repositories,
  roleName: string,
  overrides: BuildUserInput = {},
): Promise<PublicUser> {
  const user = await createUser(repos, overrides);
  const role = await repos.roles.findByNameOrThrow(roleName);
  await repos.roles.assignUser(user.id, role.id);
  return user;
}

export async function createUserWithPermissions(
  repos: Repositories,
  permissionKeys: string[],
  overrides: BuildUserInput = {},
): Promise<PublicUser> {
  const user = await createUser(repos, overrides);
  const role = await createRole(repos);
  for (const key of permissionKeys) {
    const existing = await repos.permissions.findByKey(key);
    const permission = existing ?? (await createPermission(repos, { key }));
    await repos.roles.assignPermission(role.id, permission.id);
  }
  await repos.roles.assignUser(user.id, role.id);
  return user;
}
