import { randomUUID } from 'node:crypto';

import type { KvStore } from '../lib/kv';
import { normalizeDestination } from './otp.hash';
import type { OtpPurpose, OtpRecord } from './otp.types';

export class OtpRepository {
  constructor(
    private readonly kv: KvStore,
    private readonly now: () => number = Date.now,
    private readonly prefix = 'otp:challenge',
  ) {}

  async get(purpose: OtpPurpose, destination: string): Promise<OtpRecord | null> {
    const raw = await this.kv.get(this.key(purpose, destination));
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as OtpRecord;
      if (!parsed || typeof parsed.codeHash !== 'string') {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  async save(record: OtpRecord): Promise<void> {
    const ttlMs = Math.max(1, record.expiresAt - this.now());
    await this.kv.set(this.key(record.purpose, record.destination), JSON.stringify(record), ttlMs);
  }

  async create(input: Omit<OtpRecord, 'id' | 'createdAt' | 'attempts' | 'consumedAt'>): Promise<OtpRecord> {
    const record: OtpRecord = {
      ...input,
      id: randomUUID(),
      attempts: 0,
      consumedAt: null,
      createdAt: this.now(),
      destination: normalizeDestination(input.destination),
    };
    await this.save(record);
    return record;
  }

  async consume(record: OtpRecord): Promise<boolean> {
    const ttlMs = Math.max(1, record.expiresAt - this.now());
    const claimed = await this.kv.setNx(this.consumeKey(record.id), '1', ttlMs);
    if (!claimed) {
      return false;
    }
    await this.save({ ...record, consumedAt: this.now() });
    return true;
  }

  async incrementAttempts(record: OtpRecord): Promise<OtpRecord> {
    const next = { ...record, attempts: record.attempts + 1 };
    await this.save(next);
    return next;
  }

  async delete(purpose: OtpPurpose, destination: string): Promise<void> {
    await this.kv.del(this.key(purpose, destination));
  }

  private key(purpose: OtpPurpose, destination: string): string {
    return `${this.prefix}:${purpose}:${normalizeDestination(destination)}`;
  }

  private consumeKey(id: string): string {
    return `${this.prefix}:used:${id}`;
  }
}
