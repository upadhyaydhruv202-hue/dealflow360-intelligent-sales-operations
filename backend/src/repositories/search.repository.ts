import { Prisma } from '@prisma/client';

import { SEARCH } from '../constants';
import { mapPrismaError } from '../lib/prisma-error';
import { escapeLike } from '../integrations/search/search.matching';
import type {
  ProviderSearchQuery,
  ProviderSearchResult,
  SearchFilter,
  SearchHit,
  SearchSort,
  StoredSearchDocument,
} from '../integrations/search/search.types';
import type { DbClient } from './types';

export interface SearchDocumentRow {
  id: string;
  indexName: string;
  documentId: string;
  title: string;
  body: string;
  keywords: string;
  payload: Prisma.JsonValue;
  filters: Prisma.JsonValue;
  ownerId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface RankedSearchRow {
  index_name: string;
  document_id: string;
  title: string;
  body: string;
  payload: Prisma.JsonValue;
  score: number | string;
  highlight: string | null;
}

export class SearchRepository {
  constructor(private readonly db: DbClient) {}

  async upsert(document: StoredSearchDocument): Promise<void> {
    try {
      await this.db.searchDocument.upsert({
        where: {
          indexName_documentId: {
            indexName: document.indexName,
            documentId: document.documentId,
          },
        },
        create: {
          id: document.id,
          indexName: document.indexName,
          documentId: document.documentId,
          title: document.title,
          body: document.body,
          keywords: document.keywords,
          payload: document.payload,
          filters: document.filters,
          ownerId: document.ownerId,
        },
        update: {
          title: document.title,
          body: document.body,
          keywords: document.keywords,
          payload: document.payload,
          filters: document.filters,
          ownerId: document.ownerId,
        },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async delete(indexName: string, documentId: string): Promise<void> {
    try {
      await this.db.searchDocument.delete({
        where: { indexName_documentId: { indexName, documentId } },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findByKey(indexName: string, documentId: string): Promise<SearchDocumentRow | null> {
    return this.db.searchDocument.findUnique({
      where: { indexName_documentId: { indexName, documentId } },
    });
  }

  async search(query: ProviderSearchQuery): Promise<ProviderSearchResult> {
    const where = buildWhere(query);
    const order = buildOrder(query.sort);
    const [countRows, rows] = await Promise.all([
      this.db.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count
        FROM search_documents d
        WHERE ${where}
      `,
      this.db.$queryRaw<RankedSearchRow[]>`
        SELECT
          d.index_name,
          d.document_id,
          d.title,
          d.body,
          d.payload,
          ${scoreExpr(query)} AS score,
          ${highlightExpr(query)} AS highlight
        FROM search_documents d
        WHERE ${where}
        ORDER BY ${order}
        LIMIT ${query.take} OFFSET ${query.skip}
      `,
    ]);

    const totalItems = Number(countRows[0]?.count ?? 0);
    return {
      totalItems,
      hits: rows.map((row) => toHit(row, query)),
    };
  }
}

function buildWhere(query: ProviderSearchQuery): Prisma.Sql {
  const clauses: Prisma.Sql[] = [Prisma.sql`d.index_name = ANY(${[...query.indexes]}::text[])`];

  if (query.scopedIndexes.length > 0) {
    const ownerMatch = query.ownerId
      ? Prisma.sql`(d.owner_id IS NULL OR d.owner_id = ${query.ownerId}::uuid)`
      : Prisma.sql`d.owner_id IS NULL`;
    clauses.push(
      Prisma.sql`(
        NOT (d.index_name = ANY(${[...query.scopedIndexes]}::text[]))
        OR ${ownerMatch}
      )`,
    );
  }

  if (query.mode === 'keyword' && query.tokens.length > 0) {
    for (const token of query.tokens) {
      const pattern = `%${escapeLike(token)}%`;
      clauses.push(
        Prisma.sql`(d.title ILIKE ${pattern} ESCAPE '\\' OR d.body ILIKE ${pattern} ESCAPE '\\' OR d.keywords ILIKE ${pattern} ESCAPE '\\')`,
      );
    }
  }

  if (query.mode === 'fulltext' && query.query.trim() !== '') {
    clauses.push(
      Prisma.sql`numnode(websearch_to_tsquery('simple', ${query.query})) > 0 AND d.search_vector @@ websearch_to_tsquery('simple', ${query.query})`,
    );
  }

  if (query.mode === 'fuzzy' && query.query.trim() !== '') {
    clauses.push(
      Prisma.sql`GREATEST(
        similarity(d.title, ${query.query}),
        similarity(d.keywords, ${query.query}),
        word_similarity(${query.query}, d.title),
        word_similarity(${query.query}, d.keywords)
      ) >= ${query.fuzzyThreshold}`,
    );
  }

  for (const filter of query.filters) {
    clauses.push(filterClause(filter));
  }

  return Prisma.join(clauses, ' AND ');
}

function filterClause(filter: SearchFilter): Prisma.Sql {
  const field = filter.field;
  if (filter.operator === 'eq') {
    return Prisma.sql`d.filters @> ${JSON.stringify({ [field]: filter.value })}::jsonb`;
  }
  if (filter.operator === 'neq') {
    return Prisma.sql`NOT (d.filters @> ${JSON.stringify({ [field]: filter.value })}::jsonb)`;
  }
  if (filter.operator === 'in' && Array.isArray(filter.value)) {
    const values = filter.value.map((item) => String(item));
    return Prisma.sql`d.filters ->> ${field} = ANY(${values}::text[])`;
  }
  if (filter.operator === 'contains' && typeof filter.value === 'string') {
    const pattern = `%${escapeLike(filter.value)}%`;
    return Prisma.sql`d.filters ->> ${field} ILIKE ${pattern} ESCAPE '\\'`;
  }
  if (filter.operator === 'gte' && typeof filter.value === 'number') {
    return Prisma.sql`(d.filters ->> ${field})::numeric >= ${filter.value}`;
  }
  if (filter.operator === 'lte' && typeof filter.value === 'number') {
    return Prisma.sql`(d.filters ->> ${field})::numeric <= ${filter.value}`;
  }
  return Prisma.sql`TRUE`;
}

function scoreExpr(query: ProviderSearchQuery): Prisma.Sql {
  if (query.mode === 'fulltext' && query.query.trim() !== '') {
    return Prisma.sql`ts_rank_cd(d.search_vector, websearch_to_tsquery('simple', ${query.query}))`;
  }
  if (query.mode === 'fuzzy' && query.query.trim() !== '') {
    return Prisma.sql`GREATEST(
      similarity(d.title, ${query.query}),
      similarity(d.keywords, ${query.query}),
      word_similarity(${query.query}, d.title)
    )`;
  }
  if (query.mode === 'keyword' && query.tokens.length > 0) {
    const pattern = `%${escapeLike(query.tokens[0] ?? '')}%`;
    return Prisma.sql`(CASE WHEN d.title ILIKE ${pattern} ESCAPE '\\' THEN 1 ELSE 0 END)`;
  }
  return Prisma.sql`0`;
}

function highlightExpr(query: ProviderSearchQuery): Prisma.Sql {
  if (!query.highlight || query.query.trim() === '') {
    return Prisma.sql`NULL`;
  }
  if (query.mode === 'fulltext') {
    return Prisma.sql`ts_headline(
      'simple',
      left(d.title || ' ' || d.body, ${SEARCH.MAX_HIGHLIGHT_CHARS * 2}::int),
      websearch_to_tsquery('simple', ${query.query}),
      'StartSel=**, StopSel=**, MaxFragments=1, MaxWords=24, MinWords=8'
    )`;
  }
  return Prisma.sql`left(d.title || '. ' || d.body, ${SEARCH.MAX_HIGHLIGHT_CHARS}::int)`;
}

function buildOrder(sorts: readonly SearchSort[]): Prisma.Sql {
  const parts = (sorts.length > 0 ? sorts : [{ field: '_score', order: 'desc' as const }]).map((sort) => {
    const direction = sort.order === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    if (sort.field === '_score') {
      return Prisma.sql`score ${direction}`;
    }
    if (sort.field === 'createdAt') {
      return Prisma.sql`d.created_at ${direction}`;
    }
    if (sort.field === 'updatedAt') {
      return Prisma.sql`d.updated_at ${direction}`;
    }
    if (sort.field === 'title') {
      return Prisma.sql`d.title ${direction}`;
    }
    return Prisma.sql`d.filters ->> ${sort.field} ${direction}`;
  });
  parts.push(Prisma.sql`d.created_at DESC`);
  return Prisma.join(parts, ', ');
}

function toHit(row: RankedSearchRow, query: ProviderSearchQuery): SearchHit {
  const highlight = row.highlight?.trim();
  return {
    index: row.index_name,
    documentId: row.document_id,
    title: row.title,
    snippet: collapse(row.body),
    score: Number(Number(row.score).toFixed(4)),
    fields: asFieldMap(row.payload),
    highlights: query.highlight && highlight ? [highlight] : undefined,
  };
}

function asFieldMap(value: Prisma.JsonValue): SearchHit['fields'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const fields: SearchHit['fields'] = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean' || item === null) {
      fields[key] = item;
    }
  }
  return fields;
}

function collapse(value: string): string | undefined {
  const trimmed = value.replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return undefined;
  }
  return trimmed.length <= SEARCH.MAX_HIGHLIGHT_CHARS
    ? trimmed
    : `${trimmed.slice(0, SEARCH.MAX_HIGHLIGHT_CHARS - 1)}…`;
}
