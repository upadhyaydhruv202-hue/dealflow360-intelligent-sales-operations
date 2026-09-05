import { createHash, timingSafeEqual } from 'node:crypto';

import { JOBS } from '../constants';
import type { KvStore } from './kv';

export class OtpStore {
  constructor(
    private readonly kv: KvStore,
    private readonly prefix = 'otp',
  ) {}

  async put(
    namespace: string,
    identifier: string,
    code: string,
    ttlMs = JOBS.OTP_TTL_MS,
  ): Promise<void> {
    await this.kv.set(this.key(namespace, identifier), hashCode(namespace, identifier, code), ttlMs);
  }

  async verify(namespace: string, identifier: string, code: string): Promise<boolean> {
    const stored = await this.kv.get(this.key(namespace, identifier));
    if (!stored) {
      return false;
    }

    const candidate = hashCode(namespace, identifier, code);
    if (!safeEqual(stored, candidate)) {
      return false;
    }

    await this.kv.del(this.key(namespace, identifier));
    return true;
  }

  async clear(namespace: string, identifier: string): Promise<void> {
    await this.kv.del(this.key(namespace, identifier));
  }

  private key(namespace: string, identifier: string): string {
    return `${this.prefix}:${namespace}:${identifier.trim().toLowerCase()}`;
  }
}

function hashCode(namespace: string, identifier: string, code: string): string {
  return createHash('sha256')
    .update(`${namespace}:${identifier.trim().toLowerCase()}:${code}`)
    .digest('hex');
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
