export const ROLE_NAME_PATTERN = /^[a-z][a-z0-9_]{1,63}$/;

/** `resource.action`, optionally with further dotted segments (`case.assign`). */
export const PERMISSION_KEY_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9_]*)+$/;

export function normalizeRoleName(name: string): string {
  return name.trim().toLowerCase();
}

export function normalizePermissionKey(key: string): string {
  return key.trim().toLowerCase();
}

export function isRoleName(value: string): boolean {
  return ROLE_NAME_PATTERN.test(normalizeRoleName(value));
}

export function isPermissionKey(value: string): boolean {
  return PERMISSION_KEY_PATTERN.test(normalizePermissionKey(value));
}
