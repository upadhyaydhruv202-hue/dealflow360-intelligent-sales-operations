import { SEARCH, type FilterOperator } from '../../../constants';
import { highlightSnippets, keywordScore, matchesAllTokens, trigramSimilarity } from '../search.matching';
import type {
  ProviderSearchQuery,
  ProviderSearchResult,
  SearchFilter,
  SearchHit,
  SearchProvider,
  StoredSearchDocument,
} from '../search.types';

interface MemoryRecord extends StoredSearchDocument {
  haystack: string;
}

export class MemorySearchProvider implements SearchProvider {
  readonly name = 'memory' as const;
  private readonly documents = new Map<string, MemoryRecord>();

  async index(document: StoredSearchDocument): Promise<void> {
    this.documents.set(memoryKey(document.indexName, document.documentId), {
      ...document,
      haystack: `${document.title} ${document.body} ${document.keywords}`.toLowerCase(),
    });
  }

  async delete(indexName: string, documentId: string): Promise<void> {
    this.documents.delete(memoryKey(indexName, documentId));
  }

  async search(query: ProviderSearchQuery): Promise<ProviderSearchResult> {
    const matched: Array<{ record: MemoryRecord; score: number }> = [];

    for (const record of this.documents.values()) {
      if (!query.indexes.includes(record.indexName)) {
        continue;
      }
      if (!visibleToActor(record, query)) {
        continue;
      }
      if (!matchesFilters(record.filters, query.filters)) {
        continue;
      }

      const score = scoreRecord(record, query);
      if (query.mode !== 'browse' && score <= 0) {
        continue;
      }
      matched.push({ record, score });
    }

    sortMatches(matched, query);
    const totalItems = matched.length;
    const page = matched.slice(query.skip, query.skip + query.take);

    return {
      totalItems,
      hits: page.map(({ record, score }) => toHit(record, score, query)),
    };
  }
}

export function createMemorySearchProvider(): MemorySearchProvider {
  return new MemorySearchProvider();
}

function memoryKey(indexName: string, documentId: string): string {
  return `${indexName}:${documentId}`;
}

function visibleToActor(record: MemoryRecord, query: ProviderSearchQuery): boolean {
  if (query.sharedIndexes.includes(record.indexName)) {
    return true;
  }
  if (!query.scopedIndexes.includes(record.indexName)) {
    return true;
  }
  return record.ownerId === null || record.ownerId === query.ownerId;
}

function scoreRecord(record: MemoryRecord, query: ProviderSearchQuery): number {
  if (query.mode === 'browse' || query.tokens.length === 0) {
    return 0;
  }

  if (query.mode === 'keyword') {
    if (!matchesAllTokens(record.haystack, query.tokens)) {
      return 0;
    }
    return (
      keywordScore(record.title, query.tokens, 2) +
      keywordScore(record.keywords, query.tokens, 1.5) +
      keywordScore(record.body, query.tokens, 1)
    );
  }

  if (query.mode === 'fulltext') {
    if (!matchesAllTokens(record.haystack, query.tokens)) {
      return 0;
    }
    return (
      keywordScore(record.title, query.tokens, 3) +
      keywordScore(record.keywords, query.tokens, 2) +
      keywordScore(record.body, query.tokens, 1)
    );
  }

  const similarity = fuzzyScore(record, query.query);
  return similarity >= query.fuzzyThreshold ? similarity : 0;
}

function fuzzyScore(record: MemoryRecord, query: string): number {
  const parts = [
    record.title,
    record.keywords,
    ...record.title.split(/\s+/),
    ...record.keywords.split(/\s+/),
  ].filter((part) => part.trim().length >= 3);
  let best = 0;
  for (const part of parts) {
    best = Math.max(best, trigramSimilarity(part, query));
  }
  return best;
}

function matchesFilters(
  filters: Record<string, string | number | boolean | null>,
  rules: readonly SearchFilter[],
): boolean {
  return rules.every((rule) => matchesFilter(filters[rule.field], rule.operator, rule.value));
}

function matchesFilter(actual: unknown, operator: FilterOperator, expected: unknown): boolean {
  if (actual === undefined) {
    return false;
  }
  if (operator === 'eq') {
    return actual === expected;
  }
  if (operator === 'neq') {
    return actual !== expected;
  }
  if (operator === 'in') {
    return Array.isArray(expected) && expected.includes(actual);
  }
  if (operator === 'contains') {
    return typeof actual === 'string' && typeof expected === 'string'
      ? actual.toLowerCase().includes(expected.toLowerCase())
      : false;
  }
  if (typeof actual !== 'number' || typeof expected !== 'number' || !Number.isFinite(actual) || !Number.isFinite(expected)) {
    return false;
  }
  if (operator === 'gte') {
    return actual >= expected;
  }
  if (operator === 'lte') {
    return actual <= expected;
  }
  return false;
}

function sortMatches(
  matched: Array<{ record: MemoryRecord; score: number }>,
  query: ProviderSearchQuery,
): void {
  const sorts = query.sort.length > 0 ? query.sort : [{ field: '_score', order: 'desc' as const }];
  matched.sort((left, right) => {
    for (const sort of sorts) {
      const compared = compareSort(left, right, sort.field, sort.order);
      if (compared !== 0) {
        return compared;
      }
    }
    return right.record.createdAt.getTime() - left.record.createdAt.getTime();
  });
}

function compareSort(
  left: { record: MemoryRecord; score: number },
  right: { record: MemoryRecord; score: number },
  field: string,
  order: 'asc' | 'desc',
): number {
  const direction = order === 'asc' ? 1 : -1;
  const leftValue = sortValue(left, field);
  const rightValue = sortValue(right, field);
  if (leftValue === rightValue) {
    return 0;
  }
  if (leftValue === undefined || leftValue === null) {
    return 1;
  }
  if (rightValue === undefined || rightValue === null) {
    return -1;
  }
  if (leftValue > rightValue) {
    return direction;
  }
  if (leftValue < rightValue) {
    return -direction;
  }
  return 0;
}

function sortValue(
  item: { record: MemoryRecord; score: number },
  field: string,
): string | number | boolean | Date | null | undefined {
  if (field === '_score') {
    return item.score;
  }
  if (field === 'createdAt') {
    return item.record.createdAt;
  }
  if (field === 'updatedAt') {
    return item.record.updatedAt;
  }
  if (field === 'title') {
    return item.record.title.toLowerCase();
  }
  return item.record.filters[field] ?? item.record.payload[field];
}

function toHit(record: MemoryRecord, score: number, query: ProviderSearchQuery): SearchHit {
  const highlights = query.highlight
    ? highlightSnippets(`${record.title}. ${record.body}`, query.tokens).slice(0, 2)
    : undefined;
  return {
    index: record.indexName,
    documentId: record.documentId,
    title: record.title,
    snippet: collapse(record.body, SEARCH.MAX_HIGHLIGHT_CHARS),
    score: Number(score.toFixed(4)),
    fields: record.payload,
    highlights: highlights && highlights.length > 0 ? highlights : undefined,
  };
}

function collapse(value: string, max: number): string | undefined {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}
