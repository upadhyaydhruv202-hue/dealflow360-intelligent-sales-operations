export {
  DEFAULT_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_ROLES,
  PERMISSIONS,
  ROLES,
} from './catalog';
export type { DefaultPermissionKey, DefaultRoleName } from './catalog';
export { mergeRbacCatalog, describeProblemPermissions } from './catalog-merge';
export type { MergedRbacCatalog } from './catalog-merge';
export {
  assertAuthenticated,
  assertPermission,
  assertRole,
  hasAnyPermission,
  hasPermission,
  hasRole,
} from './authorize';
export { authorizeRole, requirePermission } from './middleware';
export {
  isPermissionKey,
  isRoleName,
  normalizePermissionKey,
  normalizeRoleName,
  PERMISSION_KEY_PATTERN,
  ROLE_NAME_PATTERN,
} from './names';
export { seedRbacCatalog, shouldSyncRbacCatalog, syncRbacCatalogIfEnabled } from './seed-catalog';
