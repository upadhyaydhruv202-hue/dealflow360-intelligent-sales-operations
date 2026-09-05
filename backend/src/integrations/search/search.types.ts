import type { PaginationMeta } from '@hackathon/api-contract';

import type { FilterOperator, SearchModeName, SearchProviderName, SearchResolvedModeName } from '../../constants';

export type { SearchModeName, SearchProviderName, SearchResolvedModeName };

/**
 * Implemented providers are postgres (default) and memory (tests).
 * A future Elasticsearch adapter must implement {@link SearchProvider} only.
 * Application services must depend on SearchService, never on a vendor client.
 */
export const SEARCH_PROVIDER_NAMES = ['postgres', 'memory'] as const;

export type SearchFieldType = 'text' | 'keyword' | 'number' | 'boolean' | 'date';

export type SearchFieldValue = string | number | boolean | null;

export interface SearchIndexField {
  type: SearchFieldType;
  /** Include in keyword / full-text matching. */
  searchable?: boolean;
  filterable?: boolean;
  sortable?: boolean;
  /** Relative weight for keyword scoring (default 1). */
  boost?: number;
  /** Maps this field into the stored title, body, or keyword bag. */
  role?: 'title' | 'body' | 'keyword' | 'filter';
}

export interface SearchIndexDefinition {
  name: string;
  summary?: string;
  permission: string;
  writePermission?: string;
  ownerScoped?: boolean;
  httpWritable?: boolean;
  fields: Record<string, SearchIndexField>;
  defaultSort?: SearchSort;
}

export interface SearchSort {
  field: string;
  order: 'asc' | 'desc';
}

export interface SearchFilter {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

export interface SearchActor {
  id: string;
  permissions: readonly string[];
}

export interface SearchDocumentInput {
  index: string;
  documentId?: string;
  title?: string;
  body?: string;
  fields?: Record<string, SearchFieldValue>;
  ownerId?: string | null;
}

export interface StoredSearchDocument {
  id: string;
  indexName: string;
  documentId: string;
  title: string;
  body: string;
  keywords: string;
  payload: Record<string, SearchFieldValue>;
  filters: Record<string, SearchFieldValue>;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchQueryInput {
  query?: string;
  index?: string | readonly string[];
  mode?: SearchModeName;
  filters?: SearchFilter[];
  sort?: SearchSort | SearchSort[];
  page?: number;
  pageSize?: number;
  highlight?: boolean;
  actor: SearchActor;
}

export interface SearchHit {
  index: string;
  documentId: string;
  title: string;
  snippet?: string;
  score: number;
  fields: Record<string, SearchFieldValue>;
  highlights?: string[];
}

export interface SearchResult {
  provider: SearchProviderName;
  mode: SearchResolvedModeName;
  fallbackFrom?: SearchResolvedModeName;
  query: string;
  indexes: string[];
  hits: SearchHit[];
  meta: PaginationMeta;
}

export interface SearchIndexSummary {
  name: string;
  summary?: string;
  ownerScoped: boolean;
  httpWritable: boolean;
  filterableFields: string[];
  sortableFields: string[];
}

export interface ProviderSearchQuery {
  indexes: readonly string[];
  sharedIndexes: readonly string[];
  scopedIndexes: readonly string[];
  ownerId: string | null;
  query: string;
  tokens: readonly string[];
  mode: SearchResolvedModeName;
  filters: readonly SearchFilter[];
  sort: readonly SearchSort[];
  skip: number;
  take: number;
  highlight: boolean;
  fuzzyThreshold: number;
}

export interface ProviderSearchResult {
  hits: SearchHit[];
  totalItems: number;
}

export interface SearchProvider {
  readonly name: SearchProviderName;
  index(document: StoredSearchDocument): Promise<void>;
  delete(indexName: string, documentId: string): Promise<void>;
  search(query: ProviderSearchQuery): Promise<ProviderSearchResult>;
}
