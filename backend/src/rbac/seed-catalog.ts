import type { PrismaClient } from '@prisma/client';

import type { AppConfig } from '../types/config';
import type { AppLogger } from '../utils/logger';
import { loadProblemModule } from '../problem';
import { mergeRbacCatalog } from './catalog-merge';

export function shouldSyncRbacCatalog(config: Pick<AppConfig, 'isProduction' | 'isTest'>): boolean {
  return !config.isProduction && !config.isTest;
}

export async function syncRbacCatalogIfEnabled(options: {
  config: Pick<AppConfig, 'isProduction' | 'isTest'>;
  prisma?: PrismaClient | null;
  logger: Pick<AppLogger, 'info'>;
}): Promise<boolean> {
  if (!options.prisma || !shouldSyncRbacCatalog(options.config)) {
    return false;
  }

  const catalog = await seedRbacCatalog(options.prisma);
  options.logger.info(
    {
      roles: catalog.roles.size,
      permissions: catalog.permissions.size,
    },
    'RBAC catalog synced',
  );
  return true;
}

export async function seedRbacCatalog(prisma: PrismaClient): Promise<{
  roles: Map<string, { id: string }>;
  permissions: Map<string, { id: string }>;
}> {
  const catalog = resolveSeedCatalog();
  const existingRoles = await prisma.role.count();
  if (existingRoles === 0) {
    return seedEmptyCatalog(prisma, catalog);
  }

  return seedCatalogByUpsert(prisma, catalog);
}

function resolveSeedCatalog() {
  return mergeRbacCatalog(loadProblemModule());
}

/** Fast path after TRUNCATE: a handful of inserts instead of ~80 sequential upserts. */
async function seedEmptyCatalog(
  prisma: PrismaClient,
  catalog: ReturnType<typeof mergeRbacCatalog>,
): Promise<{
  roles: Map<string, { id: string }>;
  permissions: Map<string, { id: string }>;
}> {
  const now = new Date();
  await prisma.role.createMany({
    data: catalog.roles.map((role) => ({
      name: role.name,
      description: role.description,
      createdAt: now,
      updatedAt: now,
    })),
  });
  await prisma.permission.createMany({
    data: catalog.permissions.map((permission) => ({
      key: permission.key,
      description: permission.description,
      createdAt: now,
      updatedAt: now,
    })),
  });

  const roleRecords = await prisma.role.findMany({
    where: { name: { in: catalog.roles.map((role) => role.name) } },
  });
  const permissionRecords = await prisma.permission.findMany({
    where: { key: { in: catalog.permissions.map((permission) => permission.key) } },
  });

  const roles = new Map(roleRecords.map((record) => [record.name, { id: record.id }]));
  const permissions = new Map(permissionRecords.map((record) => [record.key, { id: record.id }]));
  const joins = rolePermissionRows(roles, permissions, catalog.rolePermissions);

  if (joins.length > 0) {
    await prisma.rolePermission.createMany({ data: joins });
  }

  return { roles, permissions };
}

async function seedCatalogByUpsert(
  prisma: PrismaClient,
  catalog: ReturnType<typeof mergeRbacCatalog>,
): Promise<{
  roles: Map<string, { id: string }>;
  permissions: Map<string, { id: string }>;
}> {
  const roles = new Map<string, { id: string }>();
  for (const role of catalog.roles) {
    const record = await prisma.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: { name: role.name, description: role.description },
    });
    roles.set(role.name, record);
  }

  const permissions = new Map<string, { id: string }>();
  for (const permission of catalog.permissions) {
    const record = await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: { key: permission.key, description: permission.description },
    });
    permissions.set(permission.key, record);
  }

  for (const row of rolePermissionRows(roles, permissions, catalog.rolePermissions)) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: row.roleId,
          permissionId: row.permissionId,
        },
      },
      update: {},
      create: row,
    });
  }

  return { roles, permissions };
}

function rolePermissionRows(
  roles: Map<string, { id: string }>,
  permissions: Map<string, { id: string }>,
  rolePermissions: Record<string, readonly string[]>,
): Array<{ roleId: string; permissionId: string }> {
  const joins: Array<{ roleId: string; permissionId: string }> = [];

  for (const [roleName, permissionKeys] of Object.entries(rolePermissions)) {
    const role = roles.get(roleName);
    if (!role) {
      throw new Error(`Missing catalog role: ${roleName}`);
    }

    for (const key of permissionKeys) {
      const permission = permissions.get(key);
      if (!permission) {
        throw new Error(`Missing catalog permission: ${key}`);
      }

      joins.push({ roleId: role.id, permissionId: permission.id });
    }
  }

  return joins;
}
