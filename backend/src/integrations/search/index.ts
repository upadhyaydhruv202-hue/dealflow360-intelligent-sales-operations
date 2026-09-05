export { createSearchService, SearchService } from './search.service';
export type { SearchServiceOptions } from './search.service';
export { resolveSearchRuntimeConfig, isSearchEnabled, resolveDefaultSearchProvider } from './search.config';
export type { SearchRuntimeConfig } from './search.config';
export { SearchIndexRegistry, createSearchIndexRegistry, DEMO_SEARCH_INDEX } from './search.registry';
export { createMemorySearchProvider, MemorySearchProvider } from './providers/memory.provider';
export { createPostgresSearchProvider, PostgresSearchProvider } from './providers/postgres.provider';
export { DEMO_SEARCH_DOCUMENTS } from './search.demo';
export {
  searchBodySchema,
  searchIndexBodySchema,
  searchDocumentParamsSchema,
  searchIndexNameSchema,
  searchDocumentIdSchema,
} from './search.schemas';
export type {
  SearchProvider,
  SearchIndexDefinition,
  SearchQueryInput,
  SearchResult,
  SearchHit,
  SearchDocumentInput,
  SearchActor,
} from './search.types';
