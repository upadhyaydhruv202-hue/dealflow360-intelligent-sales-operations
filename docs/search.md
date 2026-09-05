# Optional search

Provider-agnostic keyword, filter, sort, pagination, and PostgreSQL full-text search. Application services call `SearchService`. They never import Elasticsearch, write `to_tsvector` SQL, or choose a vendor client.

Search is **off by default**. Enable `FEATURE_SEARCH=true` only when a problem statement needs lookup across indexed records. Semantic meaning search stays on optional RAG.

See `backend/src/integrations/search/`.

## Architecture

```text
Controller / Copilot / Problem module
  → SearchService
    → SearchIndexRegistry (named collections + field metadata)
    → SearchProvider
         → PostgresSearchProvider (default; SearchRepository)
         → MemorySearchProvider (tests / no database)
         → future ElasticsearchSearchProvider implements the same interface
```

```text
Controller (HTTP + zod + authenticate + requirePermission)
        │
        ▼
SearchService (authz, mode resolution, demo seed)
        │
        ├── SearchIndexRegistry
        └── SearchProvider.search / index / delete
```

Hackathons register indexes (`host.search.registerIndex`) and index documents through `SearchService`. They do not add `@elastic/elasticsearch` or put `ILIKE` queries in controllers.

## Why PostgreSQL, not Elasticsearch

| Need | This phase |
| --- | --- |
| Keyword / `ILIKE`-style lookup | PostgreSQL + memory providers |
| Filtering, sorting, pagination | Same `SearchQueryInput` on every provider |
| Full-text ranking | `websearch_to_tsquery('simple')` vs a generated `tsvector` |
| Short typos (names, SKUs) | `pg_trgm` similarity when the query is short |
| Meaning / embeddings | Optional RAG, not this module |
| Distributed search cluster | **Not shipped.** `SearchProvider` is the extension point |

`SEARCH_PROVIDER=elasticsearch` (also `opensearch`, `solr`) is **rejected at config validation** so services keep using `SearchService`. A future adapter can implement `SearchProvider` without changing controllers or problem modules.

## Enable

| Variable | Default | Notes |
| --- | --- | --- |
| `FEATURE_SEARCH` | `false` | Turns HTTP, Copilot `searchRecords`, demo index seed, and the `/search` UI on |
| `SEARCH_PROVIDER` | `postgres` when `DATABASE_URL` is set, else `memory` | `postgres` or `memory` only |
| `SEARCH_FUZZY_THRESHOLD` | `0.3` | `pg_trgm` / in-memory trigram floor (`0.1`–`0.9`) |

`SEARCH_PROVIDER=postgres` without `DATABASE_URL` falls back to memory and logs a warning. After migrating, re-seed or assign `search.use` / `search.write`.

## Modes

| Mode | Behavior |
| --- | --- |
| `browse` | Empty query: filters, sort, and pagination only |
| `keyword` | AND of escaped `ILIKE` tokens on title, body, and keywords |
| `fulltext` | `websearch_to_tsquery('simple')` vs generated `search_vector`; rank with `ts_rank_cd` |
| `fuzzy` | Trigram similarity for **short typed queries**. Not a substitute for RAG or Elasticsearch |
| `auto` | Empty → browse; short identifier → keyword; else fulltext. If keyword/fulltext returns nothing and the query is short (≤3 tokens, each ≥3 characters) → fuzzy fallback |

Text configuration is always **`simple`** (matches the generated column). There is no `SEARCH_LANGUAGE` env.

Fuzzy search is justified for typos in names and SKUs. It is not enabled as a default replacement for keyword or full-text matching.

## Indexes

Index schemas live in code (`SearchIndexRegistry`), not in a database table of mappings. The demo index **`kit.demo`** is registered by default:

* permission `search.use`, write `search.write`
* `httpWritable: true`, not owner-scoped
* fields: `title`, `body`, `status`, `category`
* demo documents when `DEMO_MODE`: `refund-policy`, `shipping-sla`, `staff-onboarding`

Problem modules can `registerIndex()` on `host.search`. This phase does **not** auto-index users, documents, or RAG chunks.

## HTTP API

Prefix `/api/v1`. Bearer token required. Search and index-list routes need `search.use`. Index and delete need `search.write`.

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| GET | `/search/indexes` | `search.use` | Registered indexes the caller may query |
| POST | `/search` | `search.use` | Search (empty query browses) |
| POST | `/search/documents` | `search.write` | Upsert a document (`201`) |
| DELETE | `/search/documents/:index/:documentId` | `search.write` | Remove a document |

Search body:

```json
{
  "query": "refund",
  "index": "kit.demo",
  "mode": "auto",
  "filters": [{ "field": "status", "operator": "eq", "value": "published" }],
  "sort": { "field": "_score", "order": "desc" },
  "page": 1,
  "pageSize": 10,
  "highlight": true
}
```

Filter operators: `eq`, `neq`, `contains`, `in`, `gte`, `lte`. Pagination meta is on the success envelope and echoed as `pagination` inside `data`. Hits are `data.hits`, not `items`.

Disabled flag → `FEATURE_DISABLED` (404). Unknown index or filter/sort field → `VALIDATION_ERROR` (400). Missing permission → `AUTHORIZATION_ERROR` (403).

## Authorization

| Role (seed) | `search.use` | `search.write` |
| --- | --- | --- |
| admin | yes | yes |
| manager | yes | yes |
| staff | yes | no |
| user | no | no |

Owner-scoped indexes additionally filter by `ownerId`. `kit.demo` is shared.

## Copilot

When `FEATURE_SEARCH` is on and `SearchService` exists, Copilot registers `searchRecords` (`search.use`, low risk). It is not RAG `searchKnowledge` and not Elasticsearch.

## Storage

Documents live in `search_documents`. A generated `search_vector` (SQL only, not in the Prisma model) plus GIN and `pg_trgm` indexes support full-text and fuzzy queries. See [database.md](database.md).

## Tests

* `backend/src/integrations/search/search.service.test.ts` — memory provider: keyword, filter, sort, pagination, fuzzy typo, browse, unknown fields, feature flag
* `backend/tests/search.http.test.ts` — authenticated HTTP, no database
* `backend/tests/search.db.test.ts` — Postgres FTS, trigram, jsonb filters (skipped without `DATABASE_URL`)
* `frontend/src/pages/SearchPage.test.tsx` — query + results
* Config rejects `SEARCH_PROVIDER=elasticsearch`

## Limitations

* Elasticsearch / OpenSearch / Solr are not implemented and must not be selected by capability recommendations.
* Full-text uses the `simple` dictionary (no stemming language pack).
* Fuzzy matching is for short queries only.
* Not semantic search and not a replacement for RAG.
* Indexing is synchronous in this phase (no `search.index` job).
* Demo documents seed only when `DEMO_MODE` is on.

## Manual verification

1. Set `FEATURE_SEARCH=true`. Keep `SEARCH_PROVIDER` unset (Postgres when `DATABASE_URL` is set).
2. Migrate, seed, sign in as manager.
3. Open http://localhost:5173/search or `POST /api/v1/search` with `{ "query": "refund" }`.
4. Confirm the refund-policy hit. Try `refnd` with `mode: "fuzzy"` or `auto`.
5. Confirm `SEARCH_PROVIDER=elasticsearch` refuses to boot. Confirm Elasticsearch is still rejected by capability recommendations.
