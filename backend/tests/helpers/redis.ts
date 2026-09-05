import { randomUUID } from 'node:crypto';

import { describe } from 'vitest';

import { createRedisClient, type RedisClient } from '../../src/lib/redis';

export function hasRedisUrl(): boolean {
  return Boolean(process.env.REDIS_URL);
}

export const describeRedis = hasRedisUrl() ? describe : describe.skip;

export function redisTestPrefix(): string {
  return `hsk:test:${randomUUID()}`;
}

export function getTestRedisUrl(): string {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL is required for Redis tests');
  }

  return url;
}

export function createTestRedis(): RedisClient {
  return createRedisClient(getTestRedisUrl());
}
