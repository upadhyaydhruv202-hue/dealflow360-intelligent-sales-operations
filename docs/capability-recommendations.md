# Capability recommendation engine

Deterministic, **advisory** mapping from a structured problem-statement analysis to platform capabilities, profiles, adapters, infrastructure, and architecture/deployment modes.

The engine does not call AI, write `.env`, enable `FEATURE_*`, construct services, or generate a project. Human selection remains authoritative.

See `backend/src/capability-recommendations/`.

## Purpose

Input: structured problem statement analysis (the output of problem intelligence, or a hand-written spec + mappings).

Output:

* recommended capabilities, profiles, adapters, and infrastructure
* recommended architecture mode and deployment mode
* rejected extras (Elasticsearch, Kafka, pgvector, microservices, Kubernetes) when those would otherwise be tempting
* suggested `FEATURE_*` values (advisory only)

Every recommendation includes:

* requirement satisfied
* capability selected
* reason
* dependency impact
* complexity impact
* security impact
* confidence
* alternative

## Policy examples

| Need | Recommendation |
| --- | --- |
| Simple search | `search` + `adapter.search.postgres` on PostgreSQL. Elasticsearch is **not** in the catalog |
| KPIs / dashboards / time-series | `analytics` + `adapter.analytics.postgres` on PostgreSQL. ClickHouse / BigQuery / Snowflake are **not** in the catalog |
| Semantic search | Optional `rag` if justified. pgvector is **not** in this catalog; use `adapter.rag.vector.postgres` (JSON embeddings) or memory |
| Large-scale search | Stay on PostgreSQL `SearchService`. Elasticsearch is **not** in the catalog and is not added automatically |
| Background jobs | Existing `jobs` (memory / file / BullMQ) |
| Distributed event streaming | `events` + `jobs`. Kafka only if a written requirement forces an external broker — and even then it is outside this catalog, so it is not selected |
| Default architecture | Modular monolith |
| Default deployment | Local-hybrid. Compose when the statement asks for containers. Kubernetes is experimental and unimplemented |

Never automatically add unnecessary technologies (Kafka, Elasticsearch, S3, SMS, RAG, Nginx, Kubernetes, microservices).

## Architecture

```text
POST /api/v1/capability-recommendations/recommend
  → authenticate + capabilities.recommend
  → CapabilityRecommendationController (Zod body)
  → CapabilityRecommendationService
       → recommendCapabilities (pure)
            → classify mappings against the catalog
            → detect signals
            → Basic Web baseline + justified extras
            → never-select policy
            → requiredClosure (optional extras stay off)
            → default adapters
            → named profiles as shortcuts
            → resolveCapabilities (validate; do not enable)
       → audit (counts and mode names only; no problem text)
```

```text
Structured analysis
  → advisory recommendation
  → human review
  → HACKATHON_MODULES.md / FEATURE_*
```

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `FEATURE_CAPABILITY_RECOMMENDATIONS` | `false` | Turns the HTTP API and `/capability-recommendations` UI on. Does **not** require `FEATURE_AI` |

Permission: `capabilities.recommend` (manager and admin after seed).

## Public interface

```ts
import { recommendCapabilities, createCapabilityRecommendationService } from './capability-recommendations';

const result = recommendCapabilities(analysis);
// result.advisory === true
// result.enabledNothing === true
```

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/api/v1/capability-recommendations/recommend` | Bearer + `capabilities.recommend` |

Body: `{ "analysis": { "spec": {}, "mappings": [] }, "title": "optional" }`.

`analysis` accepts problem-intelligence JSON (`spec`, `mappings`, `existingCapabilities`, `unknowns`) or a shorter mapping-only draft.

The JSON envelope is `{ success, data }`. `data` includes `architectureMode`, `deploymentMode`, `profiles`, `capabilities`, `adapters`, `infrastructure`, `rejected`, `selected`, `featureFlags`, `resolution`, `notes`, and `confidence`. The `/capability-recommendations` UI renders each group. Problem intelligence can call the same API after analyze. The [project planning wizard](project-planning.md) turns a human selection into a validated Project Configuration; it does not treat this advisory list as enablement. The [project generator](project-generator.md) consumes an approved configuration.

## Safety

| Control | Behavior |
| --- | --- |
| Advisory only | `advisory` and `humanSelectionAuthoritative` are always true |
| No enablement | The process `FEATURE_*` map is not mutated. Suggested flags are a list, not a write |
| No generation | No git, filesystem, Docker, or Kubernetes apply path |
| Catalog is authoritative | Kafka, Elasticsearch, and pgvector are never selected; they appear only as rejected alternatives when considered |
| Resolver | `resolveCapabilities` validates the closed recommended set. `missing` is not treated as an include list |
| Audit | `capability.recommendations.generated` stores counts and mode names — not the analysis text |

## Tests

* Known inputs: simple search, semantic search, large-scale search, background jobs, Kafka streaming, default architecture, Odoo+AI, microservices/Kubernetes (`engine.test.ts`)
* Shuffled mappings produce identical JSON
* HTTP: success, `capabilities.recommend` denied, missing body, feature disabled (`backend/tests/capability-recommendations.http.test.ts`)
* UI: recommend and render advisory banner (`frontend/src/pages/CapabilityRecommendationsPage.test.tsx`)

## Limitations

* Keyword + catalog-name signals, not semantic matching. Unfamiliar wording may miss a justified module (human review).
* Recommending a profile does not mean every optional extra on that profile should be enabled.
* Listing Kubernetes or Elasticsearch as rejected does not implement them.
* `GET /api/v1/features` remaining off does not stop a human from copying names into `HACKATHON_MODULES.md`.

## Manual verification

1. Set `FEATURE_CAPABILITY_RECOMMENDATIONS=true`. AI is not required. Restart the API.
2. Sign in as manager/admin (`capabilities.recommend`).
3. Open http://localhost:5173/capability-recommendations or `POST /api/v1/capability-recommendations/recommend` with the simple-search fixture (search records by name).
4. Confirm `search` + Postgres are recommended and Elasticsearch / RAG are not selected.
5. Paste a semantic-search analysis. Confirm `rag` is recommended and pgvector / Elasticsearch are in **Not recommended**.
6. Confirm `GET /api/v1/audit` (as a role with `audit.read`) has `capability.recommendations.generated` without the analysis text.
