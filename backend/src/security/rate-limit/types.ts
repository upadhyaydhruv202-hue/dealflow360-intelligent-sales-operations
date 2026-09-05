export interface RateLimitIncrementResult {
  count: number;
  resetAt: number;
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitIncrementResult>;
}

export interface RateLimiterOptions {
  store: RateLimitStore;
  windowMs: number;
  max: number;
  prefix: string;
  enabled?: boolean;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}
