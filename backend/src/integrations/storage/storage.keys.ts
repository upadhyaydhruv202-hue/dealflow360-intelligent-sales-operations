import path from 'node:path';

import { ValidationError } from '../../errors';

const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,510}$/;

export function assertStorageKey(key: string): string {
  const trimmed = key.trim();
  if (!trimmed || trimmed.includes('..') || trimmed.startsWith('/') || trimmed.startsWith('\\')) {
    throw new ValidationError('Invalid storage key', [
      { path: 'storageKey', message: 'Storage key must be a relative path without traversal', code: 'custom' },
    ]);
  }

  if (path.isAbsolute(trimmed) || /^[A-Za-z]:/.test(trimmed) || !KEY_PATTERN.test(trimmed)) {
    throw new ValidationError('Invalid storage key', [
      { path: 'storageKey', message: 'Storage key must be a relative path without traversal', code: 'custom' },
    ]);
  }

  return trimmed.replace(/\\/g, '/');
}

export function resolveStoragePath(root: string, key: string): string {
  const safeKey = assertStorageKey(key);
  const rootResolved = path.resolve(root);
  const resolved = path.resolve(rootResolved, ...safeKey.split('/'));
  const prefix = rootResolved.endsWith(path.sep) ? rootResolved : `${rootResolved}${path.sep}`;

  if (resolved !== rootResolved && !resolved.startsWith(prefix)) {
    throw new ValidationError('Invalid storage key', [
      { path: 'storageKey', message: 'Storage key must stay inside the storage root', code: 'custom' },
    ]);
  }

  return resolved;
}

/**
 * Relative local dirs resolve against the backend package so the API and workers
 * share the same files regardless of process cwd.
 */
export function resolveLocalStorageDir(localDir: string): string {
  const trimmed = localDir.trim();
  if (path.isAbsolute(trimmed)) {
    return path.resolve(trimmed);
  }

  const backendRoot = path.resolve(__dirname, '../../..');
  return path.resolve(backendRoot, trimmed);
}
