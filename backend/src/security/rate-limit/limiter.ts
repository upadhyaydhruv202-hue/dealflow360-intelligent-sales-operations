import type { RateLimitDecision, RateLimiterOptions } from './types';

export class RateLimiter {
  constructor(private readonly options: RateLimiterOptions) {}

  get enabled(): boolean {
    return this.options.enabled !== false;
  }

  async consume(key: string): Promise<RateLimitDecision> {
    const result = await this.options.store.increment(
      `${this.options.prefix}:${key}`,
      this.options.windowMs,
    );

    const remaining = Math.max(0, this.options.max - result.count);

    return {
      allowed: result.count <= this.options.max,
      limit: this.options.max,
      remaining,
      resetAt: result.resetAt,
    };
  }
}
