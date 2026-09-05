import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../errors';
import { assertStorageKey, resolveLocalStorageDir, resolveStoragePath } from './storage.keys';

describe('storage keys', () => {
  it('accepts relative object keys', () => {
    expect(assertStorageKey('documents/user/file.txt')).toBe('documents/user/file.txt');
  });

  it('rejects traversal and absolute keys', () => {
    expect(() => assertStorageKey('../secret')).toThrow(ValidationError);
    expect(() => assertStorageKey('/etc/passwd')).toThrow(ValidationError);
    expect(() => assertStorageKey('C:\\Windows\\win.ini')).toThrow(ValidationError);
  });

  it('resolves keys inside the local root', () => {
    const root = path.resolve('/tmp/hsk-storage');
    expect(resolveStoragePath(root, 'a/b.txt')).toBe(path.resolve(root, 'a', 'b.txt'));
  });

  it('resolves relative local dirs against the backend package', () => {
    const backendRoot = path.resolve(__dirname, '../../..');
    expect(resolveLocalStorageDir('storage')).toBe(path.resolve(backendRoot, 'storage'));
    expect(resolveLocalStorageDir('/abs/storage')).toBe(path.resolve('/abs/storage'));
  });
});
