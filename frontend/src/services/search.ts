import type { PaginationMeta } from '@hackathon/api-contract';
import { API_PATHS } from '@hackathon/api-contract';

import { apiRequest } from './api';

export interface SearchHit {
  index: string;
  documentId: string;
  title: string;
  snippet?: string;
  score: number;
  fields: Record<string, string | number | boolean | null>;
  highlights?: string[];
}

export interface SearchResponse {
  provider: 'postgres' | 'memory';
  mode: 'browse' | 'keyword' | 'fulltext' | 'fuzzy';
  fallbackFrom?: 'browse' | 'keyword' | 'fulltext' | 'fuzzy';
  query: string;
  indexes: string[];
  hits: SearchHit[];
  pagination: PaginationMeta;
}

export interface SearchIndexSummary {
  name: string;
  summary?: string;
  ownerScoped: boolean;
  httpWritable: boolean;
  filterableFields: string[];
  sortableFields: string[];
}

export function listSearchIndexes(token: string): Promise<{ provider: string; indexes: SearchIndexSummary[] }> {
  return apiRequest(API_PATHS.search.indexes, { method: 'GET', token });
}

export function searchRecords(
  input: {
    query?: string;
    index?: string;
    mode?: 'auto' | 'keyword' | 'fulltext' | 'fuzzy';
    filters?: Array<{ field: string; operator: string; value: unknown }>;
    sort?: { field: string; order: 'asc' | 'desc' };
    page?: number;
    pageSize?: number;
  },
  token: string,
): Promise<SearchResponse> {
  return apiRequest<SearchResponse>(API_PATHS.search.root, {
    method: 'POST',
    token,
    body: input,
  });
}

export function indexSearchDocument(
  input: {
    index: string;
    documentId?: string;
    title?: string;
    body?: string;
    fields?: Record<string, string | number | boolean | null>;
  },
  token: string,
): Promise<{ index: string; documentId: string }> {
  return apiRequest(API_PATHS.search.documents, {
    method: 'POST',
    token,
    body: input,
  });
}
