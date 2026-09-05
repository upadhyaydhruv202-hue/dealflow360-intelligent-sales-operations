import { randomUUID } from 'node:crypto';

import { INTENTS } from '../constants';
import { MemoryKvStore, type KvStore } from '../lib/kv';
import { idSchema } from '../schemas/common';
import type { IntentConfirmationStore, PendingIntentCommand } from './intents.types';

const KEY_PREFIX = 'intents:confirm';

export class KvIntentConfirmationStore implements IntentConfirmationStore {
  constructor(
    private readonly kv: KvStore,
    private readonly now: () => number = Date.now,
  ) {}

  async save(command: Omit<PendingIntentCommand, 'token' | 'expiresAt'>): Promise<PendingIntentCommand> {
    const record: PendingIntentCommand = {
      ...command,
      token: randomUUID(),
      expiresAt: this.now() + INTENTS.CONFIRMATION_TTL_MS,
    };
    await this.kv.set(this.dataKey(record.token), JSON.stringify(record), INTENTS.CONFIRMATION_TTL_MS);
    return record;
  }

  async take(token: string, userId: string): Promise<PendingIntentCommand | undefined> {
    if (!idSchema.safeParse(token).success) {
      return undefined;
    }

    const raw = await this.kv.get(this.dataKey(token));
    if (!raw) {
      return undefined;
    }

    const record = parsePending(raw);
    if (!record || record.userId !== userId || record.expiresAt <= this.now()) {
      return undefined;
    }

    const remainingMs = Math.max(1, record.expiresAt - this.now());
    const claimed = await this.kv.setNx(this.usedKey(token), '1', remainingMs);
    if (!claimed) {
      return undefined;
    }

    await this.kv.del(this.dataKey(token));
    return record;
  }

  private dataKey(token: string): string {
    return `${KEY_PREFIX}:${token}`;
  }

  private usedKey(token: string): string {
    return `${KEY_PREFIX}:used:${token}`;
  }
}

export function createIntentConfirmations(kv: KvStore = new MemoryKvStore()): IntentConfirmationStore {
  return new KvIntentConfirmationStore(kv);
}

export function createMemoryIntentConfirmations(): IntentConfirmationStore {
  return createIntentConfirmations(new MemoryKvStore());
}

function parsePending(raw: string): PendingIntentCommand | undefined {
  try {
    const value = JSON.parse(raw) as Partial<PendingIntentCommand>;
    if (
      typeof value.token !== 'string' ||
      typeof value.userId !== 'string' ||
      typeof value.utterance !== 'string' ||
      typeof value.intent !== 'string' ||
      typeof value.confidence !== 'number' ||
      typeof value.expiresAt !== 'number' ||
      !value.input ||
      typeof value.input !== 'object' ||
      Array.isArray(value.input)
    ) {
      return undefined;
    }

    return {
      token: value.token,
      userId: value.userId,
      utterance: value.utterance,
      intent: value.intent,
      input: value.input as Record<string, unknown>,
      confidence: value.confidence,
      evidence: typeof value.evidence === 'string' ? value.evidence : undefined,
      expiresAt: value.expiresAt,
    };
  } catch {
    return undefined;
  }
}
