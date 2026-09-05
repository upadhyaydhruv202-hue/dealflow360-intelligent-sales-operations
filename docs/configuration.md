# Configuration

Centralized configuration lives in `backend/src/config`.

The process loads `.env` from the repository root, then validates environment variables. Invalid values fail startup with a field-level message. Missing production secrets fail with a bullet list.

**Catalog:** every variable (required/optional, secrets, frontend vs server, feature flags, CI/CD) is in [environment.md](environment.md).

Copy [`.env.example`](../.env.example) to `.env` before running locally. Optional templates: [`.env.test.example`](../.env.test.example), [`.env.demo.example`](../.env.demo.example).

## Loading

`backend/src/config/env.ts` reads the repository-root `.env` (and cwd fallbacks). `envSchema` in `backend/src/config/schema.ts` parses types and defaults. `loadConfig()` maps a nested `AppConfig` and runs production/runtime secret checks.

Workers load the same root `.env`. Compose loads `.env.example` then optional `.env`, and **overrides** `DATABASE_URL` / `REDIS_URL` / `JOBS_PROCESS` inside containers. See [docker.md](docker.md).

## Public frontend vs server-only

The SPA may only read `VITE_API_URL` (`frontend/src/services/api.ts`). Vite does not expose non-`VITE_` variables to the browser. Do not prefix JWT, Odoo, AI, SMTP, SMS, or AWS secrets with `VITE_`.

`API_PROXY_TARGET` is Vite-dev-server only (`frontend/vite.config.ts`). It is not baked into the production frontend image.

## Production refusals

When `NODE_ENV=production`, startup fails unless:

- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are set and at least 32 characters
- `AUTH_BCRYPT_COST` is at least 10
- `DATABASE_URL` and `REDIS_URL` are set
- `DEMO_MODE` is off, or `ALLOW_DEMO_IN_PRODUCTION=true` (never on a real tenant)
- `CORS_ORIGINS` does not include `*`
- Enabled integrations have their secrets (Odoo, Gemini, email, HTTP SMS, S3)

Outside production, JWT secrets are still required whenever `DATABASE_URL` is set (`NODE_ENV=test` is exempt so unit tests can omit a database).

Mock AI, email, SMS, and OTP providers are allowed in production only with demo mode.

## Feature flags

`FEATURE_*` (and aliases `AI_ENABLED`, `ODOO_ENABLED`, `SMS_ENABLED`) are evaluated in `backend/src/config`. Missing flags default to `false` except `FEATURE_PDF` (`true`). Registry, demo-mode safety, and `GET /api/v1/features`: [features.md](features.md). How to turn modules off: [environment.md](environment.md#how-to-disable-features).

## Tests

`backend/src/config/config.test.ts` covers parsing and production secret rules. `backend/tests/infra/env-catalog.test.ts` keeps `.env.example` aligned with `envSchema` and asserts the frontend public surface is `VITE_API_URL` only.
