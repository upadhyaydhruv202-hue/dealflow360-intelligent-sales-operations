import { describe, expect, it } from 'vitest';

import { INTENTS } from '../constants';
import { MemoryKvStore } from '../lib/kv';
import { KvIntentConfirmationStore } from './intents.pending';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER = '22222222-2222-2222-2222-222222222222';

function payload() {
  return {
    userId: USER_ID,
    utterance: 'Delete order ord-5003',
    intent: 'DELETE_RECORD',
    input: { id: 'ord-5003' },
    confidence: 0.9,
  };
}

describe('KvIntentConfirmationStore', () => {
  it('saves a UUID token and consumes it once for the owner', async () => {
    const store = new KvIntentConfirmationStore(new MemoryKvStore());
    const pending = await store.save(payload());
    expect(pending.token).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    const first = await store.take(pending.token, USER_ID);
    expect(first).toMatchObject({ intent: 'DELETE_RECORD', input: { id: 'ord-5003' } });
    await expect(store.take(pending.token, USER_ID)).resolves.toBeUndefined();
  });

  it('does not consume a token when the caller is a different user', async () => {
    const store = new KvIntentConfirmationStore(new MemoryKvStore());
    const pending = await store.save(payload());

    await expect(store.take(pending.token, OTHER_USER)).resolves.toBeUndefined();
    const owned = await store.take(pending.token, USER_ID);
    expect(owned?.userId).toBe(USER_ID);
  });

  it('rejects expired tokens without handing them to a later caller', async () => {
    let now = 1_000_000;
    const store = new KvIntentConfirmationStore(new MemoryKvStore(), () => now);
    const pending = await store.save(payload());
    now += INTENTS.CONFIRMATION_TTL_MS + 1;

    await expect(store.take(pending.token, USER_ID)).resolves.toBeUndefined();
  });

  it('ignores tokens that are not UUIDs', async () => {
    const store = new KvIntentConfirmationStore(new MemoryKvStore());
    await expect(store.take('not-a-uuid', USER_ID)).resolves.toBeUndefined();
    await expect(store.take('../secret', USER_ID)).resolves.toBeUndefined();
  });

  it('lets only one concurrent take succeed', async () => {
    const store = new KvIntentConfirmationStore(new MemoryKvStore());
    const pending = await store.save(payload());
    const [first, second] = await Promise.all([
      store.take(pending.token, USER_ID),
      store.take(pending.token, USER_ID),
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
  });
});
