import { CacheService } from '../../lib/cache';
import { MemoryKvStore } from '../../lib/kv';
import type { OdooCacheOption } from './odoo.schemas';

export interface OdooCacheStore {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown, ttlMs: number): Promise<void>;
}

export function createMemoryOdooCache(): OdooCacheStore {
  return createOdooCacheFromKv(new CacheService(new MemoryKvStore(), 'odoo'));
}

export function createOdooCacheFromKv(
  cache: Pick<CacheService, 'getJson' | 'setJson'>,
): OdooCacheStore {
  return {
    async get<T>(key: string): Promise<T | undefined> {
      return cache.getJson<T>(key);
    },
    async set(key: string, value: unknown, ttlMs: number): Promise<void> {
      await cache.setJson(key, value, ttlMs);
    },
  };
}

export function buildOdooCacheKey(
  model: string,
  method: string,
  payload: unknown,
  option?: OdooCacheOption,
): string {
  if (option?.key) {
    return `odoo:${option.key}`;
  }

  return `odoo:${model}:${method}:${stableStringify(payload)}`;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((sorted, key) => {
        sorted[key] = sortValue((value as Record<string, unknown>)[key]);
        return sorted;
      }, {});
  }

  return value;
}
