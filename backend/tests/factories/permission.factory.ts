import { randomUUID } from 'node:crypto';

import type { Repositories } from '../../src/repositories';
import { uniqueLabel } from './sequence';

export interface BuildPermissionInput {
  id?: string;
  key?: string;
  description?: string;
}

export function buildPermission(overrides: BuildPermissionInput = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    key: (overrides.key ?? `factory.item${uniqueLabel('')}`).trim().toLowerCase(),
    description: overrides.description ?? 'Factory permission',
  };
}

export async function createPermission(repos: Repositories, overrides: BuildPermissionInput = {}) {
  const built = buildPermission(overrides);
  return repos.permissions.create({
    key: built.key,
    description: built.description,
  });
}
