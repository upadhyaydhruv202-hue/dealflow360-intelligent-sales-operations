# `@hackathon/api-contract`

Authoritative shared contract for API envelopes, `/api/v1` paths, error codes, pagination meta, and public feature-flag names.

Frontend and backend import this package. Do not add OpenAPI, generated clients, or a second envelope type system.

## Public interface

| Export | Role |
| --- | --- |
| `createSuccessEnvelope` / `createErrorEnvelope` | Build the documented JSON envelopes |
| `unknownSuccessResponseSchema` / `errorResponseSchema` | Zod validation of those envelopes |
| `API_PREFIX` / `API_PATHS` / `API_ROUTE_PATHS` | Versioned application paths (`/api/v1`) |
| `OPERATIONAL_PATHS` | `/health` and `/ready` (outside `/api/v1`) |
| `ERROR_CODES` | Public error codes |
| `FEATURE_NAMES` / `publicFeatureStateSchema` | `GET /api/v1/features` snapshot |
| `PAGINATION` / `paginationMetaSchema` | List `meta` |

## Setup

The root `prepare` script builds this workspace. After `npm install`:

```bash
npm test -w @hackathon/api-contract
npm run typecheck -w @hackathon/api-contract
```

See [docs/api-contract.md](../../docs/api-contract.md).
