# Optional analytics

Provider-agnostic KPI definitions, aggregations, time-series queries, dashboards, filters, and exports. Application services call `AnalyticsService`. They never import ClickHouse, BigQuery, or Snowflake, and they never run unbounded `GROUP BY` SQL.

Analytics is **off by default**. Enable `FEATURE_ANALYTICS=true` only when a problem statement needs reusable metrics. Problem-specific KPIs belong under `modules/problem` as registered definitions plus ingested facts. The kit does not ship sales, ticket, or Odoo business metrics in core.

See `backend/src/integrations/analytics/`.

## Architecture

```text
Controller / Copilot / Problem module
  → AnalyticsService
    → AnalyticsRegistry (KPI + dashboard definitions in code)
    → AnalyticsProvider
         → PostgresAnalyticsProvider (default; AnalyticsRepository)
         → MemoryAnalyticsProvider (tests / no database)
         → future warehouse adapter implements the same interface
```

```text
Controller (HTTP + zod + authenticate + requirePermission)
        │
        ▼
AnalyticsService (authz, time bounds, demo seed)
        │
        ├── AnalyticsRegistry
        └── AnalyticsProvider.snapshot / timeseries / breakdown / ingest
```

Hackathons `registerKpi()` / `registerDashboard()` on `host.analytics` and ingest facts through `AnalyticsService`. They do not add `@clickhouse/client` or put aggregation SQL in controllers.

## Why PostgreSQL, not a warehouse

| Need | This phase |
| --- | --- |
| KPI snapshot (count/sum/avg/min/max) | Indexed `analytics_facts` + required `kpi_key` + time range |
| Time series | `date_trunc` after the index range filter |
| Filters / breakdown | jsonb `@>` on `dimensions` (GIN) plus group-by of one declared field |
| Pagination | Same envelope as the rest of the kit |
| Distributed OLAP cluster | **Not shipped.** `AnalyticsProvider` is the extension point |

`ANALYTICS_PROVIDER=clickhouse` (also `bigquery`, `snowflake`, `redshift`) is **rejected at config validation** so services keep using `AnalyticsService`. A future adapter can implement `AnalyticsProvider` without changing controllers or problem modules.

## Enable

| Variable | Default | Notes |
| --- | --- | --- |
| `FEATURE_ANALYTICS` | `false` | Turns HTTP, Copilot `queryAnalytics`, demo fact seed, and the `/analytics` UI on |
| `ANALYTICS_PROVIDER` | `postgres` when `DATABASE_URL` is set, else `memory` | `postgres` or `memory` only |
| `ANALYTICS_MAX_RANGE_DAYS` | `90` | Hard cap; hour granularity is further capped at 14 days |
| `ANALYTICS_MAX_SERIES_POINTS` | `366` | Internal dashboard/export take |
| `ANALYTICS_MAX_EXPORT_ROWS` | `1000` | Export row cap |

`ANALYTICS_PROVIDER=postgres` without `DATABASE_URL` falls back to memory and logs a warning. After migrating, re-seed or assign `analytics.read` / `analytics.write` / `analytics.export`.

## KPI definitions

KPI schemas live in code (`AnalyticsRegistry`), not in a database table of metrics. The demo KPIs **`kit.demo.events`** (count) and **`kit.demo.value`** (sum) are registered by default:

* permission `analytics.read`, write `analytics.write`, export `analytics.export`
* `httpWritable: true`, not owner-scoped
* dimensions: `status`, `category`
* demo facts when `DEMO_MODE`: 14 UTC days of generic events (not product KPIs)

The demo dashboard **`kit.demo`** composes snapshot, time-series, and breakdown widgets over those KPIs.

Problem modules can `registerKpi()` / `registerDashboard()` on `host.analytics`. This phase does **not** scrape Odoo, users, or jobs for business metrics.

## Query rules

Every aggregation **must** include:

1. A registered `kpi` (`kpi_key` equality)
2. A bounded `from`/`to` window (default last 7 days; never unbounded)

Hour series allow at most 14 days. Day series allow at most 90 days (or `ANALYTICS_MAX_RANGE_DAYS`). Week/month allow up to 366 days. Filter operators are `eq`, `neq`, `in`, `gte`, `lte`. There is no `contains` / `ILIKE` on dimensions.

## Indexing requirements

`analytics_facts` is written for this access path:

```sql
WHERE kpi_key = $1
  AND occurred_at >= $from
  AND occurred_at < $to
  -- optional: owner_id = $actor
  -- optional: dimensions @> '{"status":"open"}'
```

Required indexes (see the analytics migration):

| Index | Purpose |
| --- | --- |
| unique `(source, event_id)` | Idempotent ingest |
| `(kpi_key, occurred_at)` | Primary aggregation / time-series range |
| `(source, occurred_at)` | Source-scoped maintenance |
| partial `(owner_id, occurred_at)` where `owner_id IS NOT NULL` | Owner-scoped KPIs |
| GIN `dimensions jsonb_path_ops` | Equality filters via `@>` |

Do not aggregate this table without `kpi_key` and a time range. Do not add covering indexes “just in case.”

## HTTP API

Prefix `/api/v1`. Bearer token required.

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| GET | `/analytics/kpis` | `analytics.read` | Registered KPIs the caller may query |
| GET | `/analytics/dashboards` | `analytics.read` | Registered dashboards the caller may open |
| GET | `/analytics/dashboards/:name` | `analytics.read` | Dashboard definition |
| POST | `/analytics/dashboards/:name` | `analytics.read` | Evaluate widgets for a time window |
| POST | `/analytics/query` | `analytics.read` | Snapshot, time series, or breakdown |
| POST | `/analytics/export` | `analytics.export` | CSV or JSON of a bounded query |
| POST | `/analytics/facts` | `analytics.write` | Ingest one fact or `{ facts: [...] }` (`201`) |

Query body:

```json
{
  "kpi": "kit.demo.events",
  "kind": "timeseries",
  "from": "2026-08-28T00:00:00.000Z",
  "to": "2026-09-04T00:00:00.000Z",
  "granularity": "day",
  "filters": [{ "field": "status", "operator": "eq", "value": "open" }],
  "page": 1,
  "pageSize": 20
}
```

Pagination meta is on the success envelope and echoed as `pagination` inside `data` for query. Snapshot results have a single `snapshot` object.

Disabled flag → `FEATURE_DISABLED` (404). Unknown KPI / filter / groupBy / oversized range → `VALIDATION_ERROR` (400). Missing permission → `AUTHORIZATION_ERROR` (403).

## Authorization

| Role (seed) | `analytics.read` | `analytics.write` | `analytics.export` |
| --- | --- | --- | --- |
| admin | yes | yes | yes |
| manager | yes | yes | yes |
| staff | yes | no | no |
| user | no | no | no |

Owner-scoped KPIs additionally filter by `ownerId`. Demo KPIs are shared.

## Copilot

When `FEATURE_ANALYTICS` is on and `AnalyticsService` exists, Copilot registers `queryAnalytics` (`analytics.read`, low risk). It is not a warehouse query tool.

## Storage

Facts live in `analytics_facts`. See [database.md](database.md).

## Tests

* `backend/src/integrations/analytics/analytics.service.test.ts` — memory provider: snapshot, filter, time series pagination, breakdown, export, ownership, range cap, feature flag
* `backend/tests/analytics.http.test.ts` — authenticated HTTP, no database
* `backend/tests/analytics.db.test.ts` — Postgres aggregations (skipped without `DATABASE_URL`)
* `frontend/src/pages/AnalyticsPage.test.tsx` — query + chart
* Config rejects `ANALYTICS_PROVIDER=clickhouse`

## Limitations

* ClickHouse / BigQuery / Snowflake / Redshift are not implemented and must not be selected by capability recommendations.
* Queries without a KPI or with a range larger than the granularity cap are rejected.
* Indexing is synchronous in this phase (no `analytics.rollup` job).
* Demo facts seed only when `DEMO_MODE` is on.
* Core KPIs are generic demo placeholders. Put real metrics in `modules/problem`.

## Manual verification

1. Set `FEATURE_ANALYTICS=true`. Keep `ANALYTICS_PROVIDER` unset (Postgres when `DATABASE_URL` is set).
2. Migrate, seed, sign in as manager.
3. Open http://localhost:5173/analytics, load the demo dashboard, run a time-series query, export CSV.
4. Confirm staff can query and cannot ingest or export.
5. Confirm `FEATURE_ANALYTICS=false` returns `FEATURE_DISABLED` (404) on `/api/v1/analytics/query`.
