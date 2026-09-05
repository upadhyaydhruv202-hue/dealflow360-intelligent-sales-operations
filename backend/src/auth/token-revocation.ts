import { AuthenticationError } from '../errors';
import type { KvStore } from '../lib/kv';

const JTI_PREFIX = 'auth:deny-jti:';
const USER_VER_PREFIX = 'auth:access-ver:';

export class TokenRevocationStore {
  constructor(
    private readonly kv: KvStore,
    private readonly accessTtlMs: number,
  ) {}

  async denyAccessJti(jti: string): Promise<void> {
    await this.kv.set(`${JTI_PREFIX}${jti}`, '1', this.ttlMs());
  }

  async currentAccessVersion(userId: string): Promise<number> {
    const raw = await this.kv.get(`${USER_VER_PREFIX}${userId}`);
    if (!raw) {
      return 0;
    }
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : 0;
  }

  async revokeUserAccess(userId: string): Promise<void> {
    const next = (await this.currentAccessVersion(userId)) + 1;
    await this.kv.set(`${USER_VER_PREFIX}${userId}`, String(next), this.ttlMs());
  }

  async assertAccessAllowed(claims: { sub: string; jti: string; tvn?: number }): Promise<void> {
    const denied = await this.kv.get(`${JTI_PREFIX}${claims.jti}`);
    if (denied) {
      throw new AuthenticationError('Token has been revoked');
    }

    const required = await this.currentAccessVersion(claims.sub);
    if ((claims.tvn ?? 0) < required) {
      throw new AuthenticationError('Token has been revoked');
    }
  }

  private ttlMs(): number {
    return Math.max(1000, this.accessTtlMs + 5_000);
  }
}
