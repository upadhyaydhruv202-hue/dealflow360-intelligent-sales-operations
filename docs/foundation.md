# Foundation module

## Purpose

Establish repository structure, centralized configuration, API conventions, health/readiness probes, graceful shutdown, and empty extension points for later modules.

This module does not implement authentication, AI, Odoo, or problem-specific business logic. Identity tables and JWT settings exist so the Auth module can attach without changing the loader.

## Architecture

```text
frontend (React / Vite)
        │
        ▼
backend (Express)
        │
        ├── config validation (zod)
        ├── GET /health
        ├── GET /ready  → PostgreSQL, Redis, Odoo, and AI pings (when configured)
        └── /api/v1     → version metadata

workers  → `backend/src/worker.ts` (file queue without Redis; BullMQ when `REDIS_URL` is set)
database → Prisma schema, migrations, and demo seed
infra    → Docker Compose (Postgres, Redis, API, worker, frontend; optional nginx)
modules/problem → `@hackathon/problem` (runtime-loaded extension; see [problem-module.md](problem-module.md))
packages/api-contract → `@hackathon/api-contract` (shared envelopes, paths, feature names; see [api-contract.md](api-contract.md))
```

## Configuration

`backend/src/config` loads `.env` from the repository root, validates with zod, and maps a nested `AppConfig`.

Production (`NODE_ENV=production`) requires:

* `JWT_ACCESS_SECRET` (32+ characters)
* `JWT_REFRESH_SECRET` (32+ characters)
* `DATABASE_URL`
* `REDIS_URL`

Additional secrets are required when the matching feature is enabled (Odoo, AI/Gemini, email, S3). Full catalog: [environment.md](environment.md).

## Public interface

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Process liveness and application status |
| GET | `/ready` | Dependency readiness |
| GET | `/api/v1` | API version metadata |
| GET | `/api/v1/features` | Public feature-flag snapshot (see [features.md](features.md)) |
| GET | `/api/v1/capabilities` | Public capability catalog snapshot (see [capabilities.md](capabilities.md)) |

All JSON responses use the standard success/error envelopes.

## Dependencies

* Express, Helmet, CORS
* zod
* pino
* Prisma (`@prisma/client`) for PostgreSQL
* `ioredis` for optional Redis readiness probes

## Setup

See [getting-started](getting-started.md).

## Tests

* config validation (including production secret failures)
* response envelopes
* health/readiness with mocked dependencies
* graceful shutdown
* frontend homepage probe rendering
* worker start/stop

Database tests live with the Database module; see [database](database.md).

## Limitations

* JWT settings are consumed by the Auth module; see [auth.md](auth.md)
* Readiness checks Postgres, Redis, Odoo, and AI when those integrations are configured
* Readiness error messages are sanitized; see [observability.md](observability.md)
