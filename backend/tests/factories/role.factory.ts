import { randomUUID } from 'node:crypto';

import type { Repositories } from '../../src/repositories';
import { uniqueLabel } from './sequence';

export interface BuildRoleInput {
  id?: string;
  name?: string;
  description?: string;
}

export function buildRole(overrides: BuildRoleInput = {}) {
  return {
    id: overrides.id ?? randomUUID(),
    name: (overrides.name ?? uniqueLabel('role')).trim().toLowerCase(),
    description: overrides.description ?? 'Factory role',
  };
}

export async function createRole(repos: Repositories, overrides: BuildRoleInput = {}) {
  const built = buildRole(overrides);
  return repos.roles.create({
    name: built.name,
    description: built.description,
  });
}
