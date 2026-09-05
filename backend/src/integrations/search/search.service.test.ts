import { describe, expect, it } from 'vitest';
import pino from 'pino';

import { loadConfig } from '../../config';
import { ERROR_CODES } from '../../constants';
import { AuthorizationError, FeatureDisabledError, ValidationError } from '../../errors';
import { AuditService, createMemoryAuditStore } from '../../audit';
import { PERMISSIONS } from '../../rbac/catalog';
import { createSearchService } from './search.service';
import { createMemorySearchProvider } from './providers/memory.provider';
import { createSearchIndexRegistry, DEMO_SEARCH_INDEX } from './search.registry';

const silentLogger = pino({ level: 'silent' });

function actor(permissions: string[] = [PERMISSIONS.SEARCH_USE, PERMISSIONS.SEARCH_WRITE]) {
  return { id: '11111111-1111-1111-1111-111111111111', permissions };
}

function build(env: Record<string, string> = {}) {
  const config = loadConfig({
    NODE_ENV: 'test',
    FEATURE_SEARCH: 'true',
    SEARCH_PROVIDER: 'memory',
    DEMO_MODE: 'true',
    ...env,
  });
  const search = createSearchService({
    config,
    logger: silentLogger,
    provider: createMemorySearchProvider(),
    registry: createSearchIndexRegistry([DEMO_SEARCH_INDEX]),
    audit: new AuditService(createMemoryAuditStore()),
    seedDemo: env.SEED_DEMO !== 'false',
  });
  return { search, config };
}

describe('SearchService (memory provider)', () => {
  it('indexes, filters, sorts, and paginates keyword hits', async () => {
    const { search } = build({ SEED_DEMO: 'false' });
    await search.index(
      {
        index: 'kit.demo',
        documentId: 'alpha',
        title: 'Alpha refund window',
        body: 'Fourteen days for a late shipment refund.',
        fields: { status: 'published', category: 'policy' },
      },
      actor(),
    );
    await search.index(
      {
        index: 'kit.demo',
        documentId: 'beta',
        title: 'Beta shipping SLA',
        body: 'Three business days.',
        fields: { status: 'draft', category: 'ops' },
      },
      actor(),
    );

    const result = await search.search({
      query: 'refund',
      mode: 'keyword',
      filters: [{ field: 'status', operator: 'eq', value: 'published' }],
      sort: { field: 'title', order: 'asc' },
      pageSize: 10,
      actor: actor([PERMISSIONS.SEARCH_USE]),
    });

    expect(result.provider).toBe('memory');
    expect(result.provider).not.toBe('elasticsearch');
    expect(result.mode).toBe('keyword');
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.documentId).toBe('alpha');
    expect(result.meta.totalItems).toBe(1);
  });

  it('uses fuzzy matching for a short typo', async () => {
    const { search } = build();
    const result = await search.search({
      query: 'refnd',
      mode: 'fuzzy',
      actor: actor([PERMISSIONS.SEARCH_USE]),
    });
    expect(result.hits.some((hit) => hit.documentId === 'refund-policy')).toBe(true);
  });

  it('falls back from keyword to fuzzy in auto mode when nothing matches', async () => {
    const { search } = build();
    const result = await search.search({
      query: 'refnd',
      mode: 'auto',
      actor: actor([PERMISSIONS.SEARCH_USE]),
    });
    expect(result.mode).toBe('fuzzy');
    expect(result.fallbackFrom).toBe('keyword');
    expect(result.hits.some((hit) => hit.documentId === 'refund-policy')).toBe(true);
  });

  it('browses with filters when the query is empty', async () => {
    const { search } = build();
    const result = await search.search({
      query: '',
      filters: [{ field: 'status', operator: 'eq', value: 'draft' }],
      actor: actor([PERMISSIONS.SEARCH_USE]),
    });
    expect(result.mode).toBe('browse');
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0]?.documentId).toBe('staff-onboarding');
  });

  it('paginates results', async () => {
    const { search } = build();
    const page1 = await search.search({
      query: '',
      sort: { field: 'title', order: 'asc' },
      page: 1,
      pageSize: 2,
      actor: actor([PERMISSIONS.SEARCH_USE]),
    });
    const page2 = await search.search({
      query: '',
      sort: { field: 'title', order: 'asc' },
      page: 2,
      pageSize: 2,
      actor: actor([PERMISSIONS.SEARCH_USE]),
    });
    expect(page1.hits).toHaveLength(2);
    expect(page2.hits).toHaveLength(1);
    expect(page1.meta.hasNextPage).toBe(true);
    expect(page2.meta.hasNextPage).toBe(false);
    expect(new Set([...page1.hits, ...page2.hits].map((hit) => hit.documentId)).size).toBe(3);
  });

  it('rejects an unknown filter field', async () => {
    const { search } = build();
    await expect(
      search.search({
        query: 'refund',
        filters: [{ field: 'secret', operator: 'eq', value: 'x' }],
        actor: actor([PERMISSIONS.SEARCH_USE]),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects an unknown index', async () => {
    const { search } = build();
    await expect(
      search.search({
        query: 'refund',
        index: 'does.not.exist',
        actor: actor([PERMISSIONS.SEARCH_USE]),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects an unknown sort field', async () => {
    const { search } = build();
    await expect(
      search.search({
        query: 'refund',
        sort: { field: 'secret', order: 'asc' },
        actor: actor([PERMISSIONS.SEARCH_USE]),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('denies search without permission', async () => {
    const { search } = build();
    await expect(search.search({ query: 'refund', actor: actor([]) })).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });

  it('stays disabled unless FEATURE_SEARCH is on', async () => {
    const { search } = build({ FEATURE_SEARCH: 'false' });
    await expect(search.search({ query: 'refund', actor: actor() })).rejects.toMatchObject({
      code: ERROR_CODES.FEATURE_DISABLED,
    });
    expect(search.enabled).toBe(false);
    expect(() => {
      throw new FeatureDisabledError('search');
    }).toThrow(/search is not enabled/);
  });
});
