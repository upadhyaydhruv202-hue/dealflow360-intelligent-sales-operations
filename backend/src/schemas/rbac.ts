import { z } from 'zod';

import { PERMISSION_KEY_PATTERN, ROLE_NAME_PATTERN } from '../rbac/names';
import { idSchema } from './common';

export const createRoleBodySchema = z.object({
  name: z
    .string()
    .trim()
    .toLowerCase()
    .regex(ROLE_NAME_PATTERN, 'Role names must be lowercase letters, digits, or underscores'),
  description: z.string().trim().min(1).max(200),
});

export const createPermissionBodySchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(PERMISSION_KEY_PATTERN, 'Permission keys must use resource.action (for example users.read)'),
  description: z.string().trim().min(1).max(200),
});

export const roleNameParamsSchema = z.object({
  roleName: z.string().trim().toLowerCase().min(1).max(64),
});

export const userIdParamsSchema = z.object({
  userId: idSchema,
});

export const assignPermissionBodySchema = z.object({
  key: z
    .string()
    .trim()
    .toLowerCase()
    .regex(PERMISSION_KEY_PATTERN, 'Permission keys must use resource.action (for example inventory.approve)'),
});

export const assignRoleBodySchema = z.object({
  role: z.string().trim().min(1).max(64),
});

export type CreateRoleBody = z.infer<typeof createRoleBodySchema>;
export type CreatePermissionBody = z.infer<typeof createPermissionBodySchema>;
export type AssignPermissionBody = z.infer<typeof assignPermissionBodySchema>;
export type AssignRoleBody = z.infer<typeof assignRoleBodySchema>;
