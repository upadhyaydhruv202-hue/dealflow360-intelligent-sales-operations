import { randomUUID } from 'node:crypto';

import { SEARCH } from '../../constants';
import {
  AuthorizationError,
  FeatureDisabledError,
  ValidationError,
} from '../../errors';
import { parsePagination, toPaginatedResult } from '../../repositories/query';
import type { SearchRepository } from '../../repositories/search.repository';
import type { AuditService } from '../../audit/audit.service';
import type { AppConfig } from '../../types/config';
import type { AppLogger } from '../../utils/logger';
import { DEMO_SEARCH_DOCUMENTS } from './search.demo';
import { resolveSearchRuntimeConfig, type SearchRuntimeConfig } from './search.config';
import { shouldAttemptFuzzy, tokenizeQuery } from './search.matching';
import { createMemorySearchProvider } from './providers/memory.provider';
import { createPostgresSearchProvider } from './providers/postgres.provider';
import {
  createSearchIndexRegistry,
  DEMO_SEARCH_INDEX,
  SearchIndexRegistry,
} from './search.registry';
import type {
  SearchActor,
  SearchDocumentInput,
  SearchFieldValue,
  SearchFilter,
  SearchIndexDefinition,
  SearchIndexSummary,
  SearchProvider,
  SearchQueryInput,
  SearchResolvedModeName,
  SearchResult,
  SearchSort,
  StoredSearchDocument,
} from './search.types';

const BUILTIN_SORT_FIELDS = new Set(['_score', 'createdAt', 'updatedAt', 'title']);

export interface SearchServiceOptions {
  config: AppConfig;
  logger: AppLogger;
  provider?: SearchProvider;
  registry?: SearchIndexRegistry;
  documents?: SearchRepository | null;
  audit?: AuditService | null;
  seedDemo?: boolean;
  runtime?: SearchRuntimeConfig;
}

export class SearchService {
  readonly runtime: SearchRuntimeConfig;
  private readonly provider: SearchProvider;
  private readonly registry: SearchIndexRegistry;
  private readonly audit: AuditService | null;
  private readonly logger: AppLogger;
  private readonly seedDemo: boolean;
  private demoReady: Promise<void> | null = null;

  constructor(options: SearchServiceOptions) {
    this.runtime = options.runtime ?? resolveSearchRuntimeConfig(options.config);
    this.logger = options.logger;
    this.audit = options.audit ?? null;
    this.registry = options.registry ?? createSearchIndexRegistry([DEMO_SEARCH_INDEX]);
    this.seedDemo = options.seedDemo ?? options.config.demoMode;
    this.provider =
      options.provider ??
      defaultProvider({
        runtime: this.runtime,
        documents: options.documents ?? null,
        logger: options.logger,
      });
  }

  get enabled(): boolean {
    return this.runtime.enabled;
  }

  get providerName(): SearchProvider['name'] {
    return this.provider.name;
  }

  registerIndex(definition: SearchIndexDefinition): void {
    this.registry.register(definition);
  }

  async listIndexes(actor: SearchActor): Promise<{ provider: SearchProvider['name']; indexes: SearchIndexSummary[] }> {
    this.assertReady();
    await this.ensureDemoDocuments();
    return {
      provider: this.provider.name,
      indexes: this.registry
        .list()
        .filter((index) => hasPermission(actor, index.permission))
        .map((index) => this.registry.summarize(index)),
    };
  }

  async search(input: SearchQueryInput): Promise<SearchResult> {
    this.assertReady();
    await this.ensureDemoDocuments();

    const indexes = this.resolveIndexes(input.index, input.actor);
    const query = (input.query ?? '').trim();
    const tokens = tokenizeQuery(query);
    const pagination = parsePagination({ page: input.page, pageSize: input.pageSize });
    const requestedMode = input.mode ?? 'auto';
    let mode = resolveMode(requestedMode, query, tokens);
    const filters = this.normalizeFilters(indexes, input.filters ?? []);
    const sort = this.normalizeSort(indexes, input.sort);

    const sharedIndexes = indexes.filter((index) => !index.ownerScoped).map((index) => index.name);
    const scopedIndexes = indexes.filter((index) => index.ownerScoped).map((index) => index.name);

    const providerQuery = {
      indexes: indexes.map((index) => index.name),
      sharedIndexes,
      scopedIndexes,
      ownerId: input.actor.id,
      query,
      tokens,
      mode,
      filters,
      sort,
      skip: pagination.skip,
      take: pagination.take,
      highlight: input.highlight !== false,
      fuzzyThreshold: this.runtime.fuzzyThreshold,
    };

    let result = await this.provider.search(providerQuery);
    let fallbackFrom: SearchResolvedModeName | undefined;

    if (
      requestedMode === 'auto' &&
      (mode === 'fulltext' || mode === 'keyword') &&
      result.totalItems === 0 &&
      shouldAttemptFuzzy(query, tokens)
    ) {
      fallbackFrom = mode;
      mode = 'fuzzy';
      result = await this.provider.search({ ...providerQuery, mode });
    }

    const page = toPaginatedResult(result.hits, pagination, result.totalItems);
    return {
      provider: this.provider.name,
      mode,
      fallbackFrom,
      query,
      indexes: indexes.map((index) => index.name),
      hits: page.items,
      meta: page.meta,
    };
  }

  async index(input: SearchDocumentInput, actor: SearchActor): Promise<{ index: string; documentId: string }> {
    this.assertReady();
    await this.ensureDemoDocuments();
    const definition = this.registry.get(input.index);
    this.assertWrite(definition, actor);

    const stored = toStoredDocument(definition, input, actor);
    await this.provider.index(stored);
    await this.audit?.record({
      action: SEARCH.AUDIT_INDEX,
      resource: 'search',
      resourceId: `${stored.indexName}:${stored.documentId}`,
      userId: actor.id,
      status: 'success',
      metadata: { index: stored.indexName, provider: this.provider.name },
    });
    return { index: stored.indexName, documentId: stored.documentId };
  }

  async delete(
    input: { index: string; documentId: string },
    actor: SearchActor,
  ): Promise<{ deleted: true; index: string; documentId: string }> {
    this.assertReady();
    const definition = this.registry.get(input.index);
    this.assertWrite(definition, actor);
    await this.provider.delete(input.index, input.documentId);
    await this.audit?.record({
      action: SEARCH.AUDIT_DELETE,
      resource: 'search',
      resourceId: `${input.index}:${input.documentId}`,
      userId: actor.id,
      status: 'success',
      metadata: { index: input.index, provider: this.provider.name },
    });
    return { deleted: true, index: input.index, documentId: input.documentId };
  }

  private assertReady(): void {
    if (!this.runtime.enabled) {
      throw new FeatureDisabledError('search');
    }
  }

  private assertWrite(definition: SearchIndexDefinition, actor: SearchActor): void {
    const permission = definition.writePermission ?? definition.permission;
    if (!hasPermission(actor, permission)) {
      throw new AuthorizationError('Missing permission to write this search index', {
        permission,
        index: definition.name,
      });
    }
    if (!definition.httpWritable) {
      throw new AuthorizationError('This search index is not writable over HTTP', { index: definition.name });
    }
  }

  private resolveIndexes(
    requested: string | readonly string[] | undefined,
    actor: SearchActor,
  ): SearchIndexDefinition[] {
    const names = requested === undefined ? this.registry.list().map((index) => index.name) : asArray(requested);
    if (names.length === 0) {
      throw new ValidationError('At least one search index is required');
    }

    const indexes = names.map((name) => this.registry.get(name));
    const denied = indexes.filter((index) => !hasPermission(actor, index.permission));
    if (denied.length === names.length) {
      throw new AuthorizationError('Missing permission to search', {
        permission: denied[0]?.permission,
      });
    }
    return indexes.filter((index) => hasPermission(actor, index.permission));
  }

  private normalizeFilters(
    indexes: readonly SearchIndexDefinition[],
    filters: SearchFilter[],
  ): SearchFilter[] {
    const allowed = new Map<string, SearchIndexDefinition['fields'][string]>();
    for (const index of indexes) {
      for (const [name, field] of Object.entries(index.fields)) {
        if (field.filterable) {
          allowed.set(name, field);
        }
      }
    }

    return filters.map((filter) => {
      const field = allowed.get(filter.field);
      if (!field) {
        throw new ValidationError('Unknown filter field', {
          field: filter.field,
          allowed: [...allowed.keys()],
        });
      }
      return filter;
    });
  }

  private normalizeSort(
    indexes: readonly SearchIndexDefinition[],
    sort: SearchQueryInput['sort'],
  ): SearchSort[] {
    const requested = sort === undefined ? [] : Array.isArray(sort) ? sort : [sort];
    if (requested.length === 0) {
      const fallback = indexes[0]?.defaultSort ?? { field: '_score', order: 'desc' as const };
      return [fallback];
    }

    const sortable = new Set(BUILTIN_SORT_FIELDS);
    for (const index of indexes) {
      for (const [name, field] of Object.entries(index.fields)) {
        if (field.sortable) {
          sortable.add(name);
        }
      }
    }

    for (const item of requested) {
      if (!sortable.has(item.field)) {
        throw new ValidationError('Unknown sort field', {
          field: item.field,
          allowed: [...sortable],
        });
      }
    }
    return requested;
  }

  private async ensureDemoDocuments(): Promise<void> {
    if (!this.seedDemo) {
      return;
    }
    this.demoReady ??= this.seedDemoDocuments();
    await this.demoReady;
  }

  private async seedDemoDocuments(): Promise<void> {
    const actor: SearchActor = { id: '00000000-0000-0000-0000-000000000000', permissions: ['search.write'] };
    for (const document of DEMO_SEARCH_DOCUMENTS) {
      const stored = toStoredDocument(DEMO_SEARCH_INDEX, document, actor);
      await this.provider.index(stored);
    }
    this.logger.debug({ count: DEMO_SEARCH_DOCUMENTS.length, index: SEARCH.DEMO_INDEX }, 'Seeded demo search documents');
  }
}

export function createSearchService(options: SearchServiceOptions): SearchService {
  return new SearchService(options);
}

function defaultProvider(options: {
  runtime: SearchRuntimeConfig;
  documents: SearchRepository | null;
  logger: AppLogger;
}): SearchProvider {
  if (options.runtime.provider === 'postgres' && options.documents) {
    return createPostgresSearchProvider(options.documents);
  }

  if (options.runtime.provider === 'postgres' && !options.documents) {
    options.logger.warn(
      'SEARCH_PROVIDER=postgres requires a database; using the in-memory search provider for this process',
    );
  }

  return createMemorySearchProvider();
}

function resolveMode(
  mode: SearchQueryInput['mode'],
  query: string,
  tokens: readonly string[],
): SearchResolvedModeName {
  if (!query || tokens.length === 0) {
    return 'browse';
  }
  if (mode === 'keyword' || mode === 'fulltext' || mode === 'fuzzy') {
    return mode;
  }
  if (tokens.length === 1 && !tokens[0]?.includes(' ')) {
    const token = tokens[0] ?? '';
    if (/^[a-z0-9._:-]+$/i.test(token) && !token.includes(' ')) {
      return token.length <= 24 ? 'keyword' : 'fulltext';
    }
  }
  return 'fulltext';
}

function toStoredDocument(
  definition: SearchIndexDefinition,
  input: SearchDocumentInput,
  actor: SearchActor,
): StoredSearchDocument {
  const fields = input.fields ?? {};
  const title = (input.title ?? stringField(fields, 'title') ?? '').trim();
  const body = (input.body ?? stringField(fields, 'body') ?? '').trim();
  if (!title && !body) {
    throw new ValidationError('Search documents need a title or body');
  }

  const payload: Record<string, SearchFieldValue> = { ...fields };
  if (title) {
    payload.title = title;
  }
  if (body) {
    payload.body = body;
  }

  const keywords = collectKeywords(definition, fields, title);
  const filters: Record<string, SearchFieldValue> = {};
  for (const [name, field] of Object.entries(definition.fields)) {
    if (field.filterable && fields[name] !== undefined) {
      filters[name] = fields[name];
    }
  }

  const now = new Date();
  return {
    id: randomUUID(),
    indexName: definition.name,
    documentId: input.documentId?.trim() || randomUUID(),
    title,
    body,
    keywords,
    payload,
    filters,
    ownerId: definition.ownerScoped ? input.ownerId ?? actor.id : input.ownerId ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

function collectKeywords(
  definition: SearchIndexDefinition,
  fields: Record<string, SearchFieldValue>,
  title: string,
): string {
  const parts = [title];
  for (const [name, field] of Object.entries(definition.fields)) {
    if (field.role === 'keyword' || (field.type === 'keyword' && field.searchable)) {
      const value = fields[name];
      if (typeof value === 'string' && value.trim()) {
        parts.push(value.trim());
      }
    }
  }
  return parts.join(' ').slice(0, SEARCH.MAX_KEYWORDS_CHARS);
}

function stringField(fields: Record<string, SearchFieldValue>, name: string): string | undefined {
  const value = fields[name];
  return typeof value === 'string' ? value : undefined;
}

function hasPermission(actor: SearchActor, permission: string): boolean {
  return actor.permissions.includes(permission);
}

function asArray(value: string | readonly string[]): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  return [...value];
}
