import {
  API_PATHS,
  API_PREFIX,
  ERROR_CODES as CONTRACT_ERROR_CODES,
  FEATURE_NAMES as CONTRACT_FEATURE_NAMES,
  OPERATIONAL_PATHS,
  paginationMetaSchema,
  publicFeatureStateSchema,
} from '@hackathon/api-contract';
import { describe, expect, it } from 'vitest';

import { API_PREFIX as BACKEND_API_PREFIX, ERROR_CODES, OPERATIONAL_PATHS as BACKEND_OPS } from './constants';
import { FEATURE_NAMES, FEATURE_REGISTRY, getPublicFeatureState } from './features';
import { loadConfig } from './config';
import { buildPageMeta, parsePagination } from './repositories/query/pagination';

describe('backend contract compatibility', () => {
  it('re-exports the shared prefix, operational paths, and error codes', () => {
    expect(BACKEND_API_PREFIX).toBe(API_PREFIX);
    expect(BACKEND_API_PREFIX).toBe('/api/v1');
    expect(BACKEND_OPS).toEqual(OPERATIONAL_PATHS);
    expect(ERROR_CODES).toEqual(CONTRACT_ERROR_CODES);
    expect(API_PATHS.features).toBe(`${API_PREFIX}/features`);
  });

  it('keeps FEATURE_REGISTRY aligned with the shared feature names', () => {
    expect([...FEATURE_NAMES]).toEqual([...CONTRACT_FEATURE_NAMES]);
    expect(Object.keys(FEATURE_REGISTRY)).toEqual([...CONTRACT_FEATURE_NAMES]);
  });

  it('publishes feature snapshots that match the contract schema', () => {
    const snapshot = getPublicFeatureState(
      loadConfig({
        NODE_ENV: 'test',
        DEMO_MODE: 'true',
        FEATURE_AI: 'true',
        AI_PROVIDER: 'mock',
      }),
    );
    expect(publicFeatureStateSchema.parse(snapshot)).toEqual(snapshot);
    expect(snapshot.features.ai).toBe(true);
  });

  it('builds list meta that matches the contract pagination schema', () => {
    const meta = buildPageMeta(parsePagination({ page: 2, pageSize: 10 }), 25);
    expect(paginationMetaSchema.parse(meta)).toEqual({
      page: 2,
      pageSize: 10,
      totalItems: 25,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });
});
