# Shared API contract

One package, `@hackathon/api-contract`, is the source of truth for structures that both the React client and Express API must agree on:

* success and error envelopes
* `/api/v1` path catalog
* public error codes
* pagination `meta`
* `FEATURE_NAMES` and the `GET /api/v1/features` snapshot

Business request and response bodies (AI, copilot, planning, and so on) stay in their modules. This package does not replace controller Zod schemas.

## Why this shape

The audit found duplicated envelope types, hardcoded `/api/v1/...` strings, and two `FEATURE_NAMES` lists.

| Option | Decision |
| --- | --- |
| Shared TypeScript workspace package | **Chosen.** npm workspaces already exist. Backend and frontend depend on `@hackathon/api-contract`. |
| Zod schemas | **Chosen as the schema language.** Types are inferred. Zod is already the kit's only validator. |
| Generated types | Not a second system. `z.infer` is the generated type. |
| OpenAPI | Rejected. No existing spec, and a generator would compete with Zod. |

Do not add OpenAPI, `openapi-typescript`, or a second envelope module.

## Architecture

```text
packages/api-contract
        │
        ├── frontend services / FeatureProvider
        └── backend constants, types, routes, sendSuccess / sendError
```

`sendSuccess` and `sendError` build envelopes with `createSuccessEnvelope` / `createErrorEnvelope`. Clients unwrap `data` when `success` is true. Operational probes stay at `/health` and `/ready`.

## Configuration

No environment variables. The contract is compile-time.

## Public interface

Import from `@hackathon/api-contract`:

```ts
import {
  API_PATHS,
  API_PREFIX,
  ERROR_CODES,
  FEATURE_NAMES,
  createSuccessEnvelope,
  unknownSuccessResponseSchema,
} from '@hackathon/api-contract';
```

| Export | Use |
| --- | --- |
| `API_PREFIX` | Always `/api/v1` |
| `API_PATHS` | Absolute paths for HTTP clients |
| `API_ROUTE_PATHS` | Relative paths for Express routers |
| `OPERATIONAL_PATHS` | `/health`, `/ready` |
| Envelope helpers and Zod schemas | Shared JSON shape |
| `FEATURE_NAMES` | Public flag names (not `FEATURE_*` env evaluation) |

`API_PATHS.realtime.events` / `API_ROUTE_PATHS.realtime.events` are the optional SSE routes. See [realtime.md](realtime.md).
`API_PATHS.search.*` / `API_ROUTE_PATHS.search.*` are the optional search routes. See [search.md](search.md).
`API_PATHS.analytics.*` / `API_ROUTE_PATHS.analytics.*` are the optional analytics routes. See [analytics.md](analytics.md).

Server `isFeatureEnabled(config, name)` and the env registry stay in `backend/src/features`. The frontend still treats `GET /api/v1/features` as UX only.

## Dependencies

* `zod` (same major as the API)
* Consumed by `@hackathon/backend` and `@hackathon/frontend`

## Setup

```bash
npm install
npm test -w @hackathon/api-contract
```

`prepare` at the repository root builds this package so the API can resolve `dist/`. The Vite app aliases `@hackathon/api-contract` to the TypeScript source so the production bundle does not depend on CommonJS re-exports.

## Examples

```ts
const items = await api.get(API_PATHS.features);
```

```ts
router.get(API_ROUTE_PATHS.features, controller.getFeatures);
```

## Tests

* Package unit tests: envelopes, paths, feature names, pagination
* Backend: `sendSuccess` / `sendError` parse with the schemas; `GET /api/v1` and `GET /api/v1/features` match
* Frontend: the API client accepts contract-valid success envelopes and throws on contract-valid errors; services call `API_PATHS`

## Limitations

* Not a full OpenAPI surface. Unlisted backend-only routes may still use local path strings.
* Adding a feature flag requires updating `FEATURE_NAMES` here, then `FEATURE_REGISTRY` on the API.
* Changing envelope field names is a breaking API change.
