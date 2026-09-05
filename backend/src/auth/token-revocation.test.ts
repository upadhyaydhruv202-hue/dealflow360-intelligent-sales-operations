import { describe, expect, it } from 'vitest';

import { AuthenticationError } from '../errors';
import { MemoryKvStore } from '../lib/kv';
import { TokenRevocationStore } from './token-revocation';

describe('TokenRevocationStore', () => {
  it('denies a specific access jti', async () => {
    const store = new TokenRevocationStore(new MemoryKvStore(), 60_000);
    await store.denyAccessJti('jti-1');
    await expect(store.assertAccessAllowed({ sub: 'user-1', jti: 'jti-1', tvn: 0 })).rejects.toBeInstanceOf(
      AuthenticationError,
    );
    await expect(store.assertAccessAllowed({ sub: 'user-1', jti: 'jti-2', tvn: 0 })).resolves.toBeUndefined();
  });

  it('revokes access tokens below the current user version', async () => {
    const store = new TokenRevocationStore(new MemoryKvStore(), 60_000);
    await store.revokeUserAccess('user-1');
    expect(await store.currentAccessVersion('user-1')).toBe(1);
    await expect(store.assertAccessAllowed({ sub: 'user-1', jti: 'old', tvn: 0 })).rejects.toThrow(/revoked/);
    await expect(store.assertAccessAllowed({ sub: 'user-1', jti: 'next', tvn: 1 })).resolves.toBeUndefined();
    await expect(store.assertAccessAllowed({ sub: 'user-2', jti: 'other', tvn: 0 })).resolves.toBeUndefined();
  });
});
