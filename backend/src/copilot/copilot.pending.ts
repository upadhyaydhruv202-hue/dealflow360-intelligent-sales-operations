import { randomUUID } from 'node:crypto';

import { COPILOT } from '../constants';
import { MemoryKvStore, type KvStore } from '../lib/kv';
import { idSchema } from '../schemas/common';
import type { CopilotPlannedTool } from './copilot.types';

const KEY_PREFIX = 'copilot:confirm';

export interface PendingCopilotCommand {
  token: string;
  conversationId: string;
  userId: string;
  tools: CopilotPlannedTool[];
  expiresAt: number;
}

export interface CopilotConfirmationStore {
  save(input: {
    conversationId: string;
    userId: string;
    tools: CopilotPlannedTool[];
  }): Promise<PendingCopilotCommand>;
  take(conversationId: string, userId: string): Promise<PendingCopilotCommand | undefined>;
  clear(conversationId: string): Promise<void>;
}

export class KvCopilotConfirmationStore implements CopilotConfirmationStore {
  constructor(
    private readonly kv: KvStore,
    private readonly now: () => number = Date.now,
  ) {}

  async save(input: {
    conversationId: string;
    userId: string;
    tools: CopilotPlannedTool[];
  }): Promise<PendingCopilotCommand> {
    const record: PendingCopilotCommand = {
      token: randomUUID(),
      conversationId: input.conversationId,
      userId: input.userId,
      tools: input.tools,
      expiresAt: this.now() + COPILOT.CONFIRMATION_TTL_MS,
    };
    await this.kv.set(this.dataKey(input.conversationId), JSON.stringify(record), COPILOT.CONFIRMATION_TTL_MS);
    return record;
  }

  async take(conversationId: string, userId: string): Promise<PendingCopilotCommand | undefined> {
    if (!idSchema.safeParse(conversationId).success) {
      return undefined;
    }

    const raw = await this.kv.get(this.dataKey(conversationId));
    if (!raw) {
      return undefined;
    }

    const record = parsePending(raw);
    if (!record || record.userId !== userId || record.expiresAt <= this.now()) {
      return undefined;
    }

    const remainingMs = Math.max(1, record.expiresAt - this.now());
    const claimed = await this.kv.setNx(this.usedKey(record.token), '1', remainingMs);
    if (!claimed) {
      return undefined;
    }

    await this.kv.del(this.dataKey(conversationId));
    return record;
  }

  async clear(conversationId: string): Promise<void> {
    await this.kv.del(this.dataKey(conversationId));
  }

  private dataKey(conversationId: string): string {
    return `${KEY_PREFIX}:${conversationId}`;
  }

  private usedKey(token: string): string {
    return `${KEY_PREFIX}:used:${token}`;
  }
}

export function createCopilotConfirmations(kv: KvStore = new MemoryKvStore()): CopilotConfirmationStore {
  return new KvCopilotConfirmationStore(kv);
}

export function createMemoryCopilotConfirmations(): CopilotConfirmationStore {
  return createCopilotConfirmations(new MemoryKvStore());
}

function parsePending(raw: string): PendingCopilotCommand | undefined {
  try {
    const value = JSON.parse(raw) as Partial<PendingCopilotCommand>;
    if (
      typeof value.token !== 'string' ||
      typeof value.conversationId !== 'string' ||
      typeof value.userId !== 'string' ||
      typeof value.expiresAt !== 'number' ||
      !Array.isArray(value.tools)
    ) {
      return undefined;
    }

    const tools: CopilotPlannedTool[] = [];
    for (const item of value.tools) {
      if (!item || typeof item !== 'object' || typeof item.name !== 'string') {
        continue;
      }
      const args = item.arguments;
      tools.push({
        name: item.name,
        arguments: args && typeof args === 'object' && !Array.isArray(args) ? args : {},
      });
    }

    return {
      token: value.token,
      conversationId: value.conversationId,
      userId: value.userId,
      tools,
      expiresAt: value.expiresAt,
    };
  } catch {
    return undefined;
  }
}
