# Testing

Reusable test conventions for the starter kit. A feature is not complete until tests cover its main success path **and** its main failure modes.

CI runs without production credentials, paid SaaS, or human interaction. Mock Odoo, AI, email, SMS, storage, and other HTTP providers.

## Commands

From the repository root:

```bash
npm test                 # unit + integration (skips Postgres/Redis suites when those URLs are unset)
npm run test:unit        # workspace unit tests (backend src/, frontend, workers)
npm run test:integration # backend HTTP / Prisma / Redis suites (skips when URLs are unset)
npm run test:watch       # backend watch mode
npm run test:coverage    # V8 coverage (text, HTML, lcov under each workspace's coverage/)
npm run test:e2e         # representative API workflow (requires DATABASE_URL)
```

Workspace-specific:

```bash
npm test -w backend
npm run test:watch -w frontend
npm run test:coverage -w workers
```

Prepare a dedicated Postgres database before integration or e2e tests:

```bash
cp .env.test.example .env.test
npm run db:test:prepare
```

Variable catalog: [environment.md](environment.md). Do not put production secrets in `.env.test`.

Optional Redis (KV, cache, idempotency, BullMQ). Uncomment `REDIS_URL` in `.env.test` or export it, then start Compose:

```bash
npm run deps:up
```

Without `DATABASE_URL` or `REDIS_URL`, those integration suites are skipped (`describe.skip`). `npm run test:e2e` fails loudly if Postgres is missing.

## Layers

| Layer       | Where                                                                                | Tools                              | External services                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | `backend/src/**/*.test.ts`, `packages/api-contract/src/**/*.test.ts`, `modules/problem/src/**/*.test.ts`, `frontend/src/**/*.test.tsx`, `workers/src/**/*.test.ts` | Vitest                             | None. Use in-memory stores and mock providers. Frontend UI tests cover primitives, overlays, tables, theme/toasts, and API client errors. Shared envelope/path/flag contract tests live in `@hackathon/api-contract` plus backend/frontend compatibility suites. |
| Integration | `backend/tests/**/*.test.ts` (HTTP, Prisma, Redis, queues)                           | Vitest, Supertest, Prisma, ioredis | Local Postgres and optional Redis only.                                                                                                   |
| End-to-end  | `backend/tests/e2e/**/*.test.ts`                                                     | Vitest, Supertest, `createApp`     | Postgres. Mock AI/email/SMS via demo/test config.                                                                                         |

Do not add Playwright or Cypress unless a hackathon truly needs a browser driver. The representative workflow is API-level: register, authorize, automate, notify, audit.

## Mocks

Never call live Gemini, Odoo, SMTP, SMS gateways, or S3 in tests.

| Concern          | Mock / test double                                                   |
| ---------------- | -------------------------------------------------------------------- |
| AI               | `MockAiProvider` (`enqueue` text or `Error`)                         |
| Odoo             | `createTestOdooService` / `createTestOdooClient` with a stub `fetch` |
| Email            | `MockEmailProvider`                                                  |
| SMS              | `MockSmsProvider` (`failTimes`, `permanentFailure`)                  |
| OTP delivery     | `MockOtpProvider`                                                    |
| Storage metadata | `MemoryFileStore`                                                    |
| Push / webhook   | `MockPushProvider`, `MockWebhookProvider`                            |
| Generic HTTP     | `createRejectingFetch()`                                             |

Import the barrel: `backend/tests/mocks`. Module-level helpers also live next to the integration (`ai.test-helpers.ts`, `odoo.test-helpers.ts`).

Demo mode and `NODE_ENV=test` already select mock email/SMS/OTP. CI must not set `GEMINI_API_KEY`, `ODOO_API_KEY`, SMTP passwords, or AWS keys. Shared API contract tests live in `packages/api-contract`, `backend/src/api-contract.compatibility.test.ts`, `backend/tests/api-contract.http.test.ts`, and `frontend/src/services/api-contract.compatibility.test.ts`. Feature-flag tests live in `backend/src/features` and `backend/tests/features.http.test.ts`. Intent-engine tests live in `backend/src/intents` and `backend/tests/intents.http.test.ts`. Problem-statement intelligence tests live in `backend/src/problem-intelligence` and `backend/tests/problem-intelligence.http.test.ts`. Capability-recommendation tests live in `backend/src/capability-recommendations` and `backend/tests/capability-recommendations.http.test.ts`. Project-planning tests live in `backend/src/project-planning` and `backend/tests/project-planning.http.test.ts`. Project-generator tests live in `backend/src/project-generator` and `backend/tests/project-generator.http.test.ts`. RAG tests live in `backend/src/integrations/rag`, `backend/tests/rag.http.test.ts`, and `backend/tests/rag.db.test.ts` (Postgres, skipped without `DATABASE_URL`). Search tests live in `backend/src/integrations/search`, `backend/tests/search.http.test.ts`, `backend/tests/search.db.test.ts`, and `frontend/src/pages/SearchPage.test.tsx`. Analytics tests live in `backend/src/integrations/analytics`, `backend/tests/analytics.http.test.ts`, `backend/tests/analytics.db.test.ts`, and `frontend/src/pages/AnalyticsPage.test.tsx`. Anomaly tests live in `backend/src/anomaly`, `backend/tests/anomaly.http.test.ts`, and `backend/tests/anomaly.db.test.ts`. Optional realtime tests live in `backend/src/realtime`, `backend/tests/realtime.http.test.ts`, `frontend/src/services/realtime.test.ts`, and `frontend/src/pages/RealtimePage.test.tsx`. Capability registry tests live in `backend/src/capabilities` (including the dependency resolver in `resolve.test.ts` and project profiles in `profiles/resolve.test.ts`) and `backend/tests/capabilities.http.test.ts`. See [features.md](features.md), [capabilities.md](capabilities.md), [profiles.md](profiles.md), [intents.md](intents.md), [problem-intelligence.md](problem-intelligence.md), [capability-recommendations.md](capability-recommendations.md), [project-planning.md](project-planning.md), [rag.md](rag.md), [search.md](search.md), [analytics.md](analytics.md), [anomaly.md](anomaly.md), and [realtime.md](realtime.md).

## Factories

Reusable builders live in `backend/tests/factories`.

- `build*` returns a plain object (unit tests, no database).
- `create*` persists through repositories (Postgres integration).

| Factory                                                                         | Use                                  |
| ------------------------------------------------------------------------------- | ------------------------------------ |
| `buildUser` / `createUser` / `createUserWithRole` / `createUserWithPermissions` | Users                                |
| `buildRole` / `createRole`                                                      | Roles                                |
| `buildPermission` / `createPermission`                                          | Permissions (`resource.action` keys) |
| `buildNotification` / `createNotification`                                      | In-app inbox rows                    |
| `buildAutomationRule` / `createAutomationRule`                                  | Automation rules                     |
| `buildDocument` / `createDocument`                                              | Document metadata                    |
| `buildAuditEvent` / `createAuditEvent`                                          | Audit events                         |

`createTestUser` in `backend/tests/helpers/database.ts` delegates to `createUser`. HTTP helpers: `registerSession`, `loginSession`, `authHeader` in `backend/tests/helpers/http.ts`.

Reset tables with `resetDatabase()` between integration tests. Seed the default catalog with `seedRbacCatalog(getTestPrisma())` when roles or permissions are required.

## What to test

Every new module should cover, at minimum:

| Case                      | Example                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------- |
| Success                   | Happy path through the service or HTTP envelope                                       |
| Invalid input             | Zod `VALIDATION_ERROR`, check constraints                                             |
| Missing data              | `NotFoundError` / 404                                                                 |
| Duplicate requests        | Unique keys, notification `idempotencyKey`, automation `eventId`                      |
| Timeouts                  | Job `timeoutMs`, AI/Odoo client timeouts                                              |
| Retries                   | Transient provider errors; non-retryable validation/authz                             |
| Permission failures       | 401 unauthenticated, 403 missing `resource.action`                                    |
| External service failures | Mock provider throws; mapped `ExternalServiceError`                                   |
| Malformed AI output       | Schema parse + parse retries, then `ValidationError`                                  |
| Queue failures            | Closed queue, failed job status, BullMQ when Redis is up                              |
| Database failures         | Unreachable Postgres, `mapPrismaError` → `DatabaseError` without leaking URLs/secrets |

Controllers stay thin: assert status codes and envelopes. Put business assertions in service tests.

## Coverage

`npm run test:coverage` writes:

- `backend/coverage/`
- `frontend/coverage/`
- `workers/coverage/`
- `packages/api-contract/coverage/`

HTML: `coverage/index.html`. CI does not fail on a global percentage. Do not chase 100%. Raise coverage on auth, RBAC, validation, secrets handling, and money/destructive paths first. UI chrome and generated Prisma client are not a target.

## CI

GitHub Actions (`.github/workflows/ci.yml`) provides Postgres and Redis, caches npm, installs, migrates, lints, typechecks, runs `npm run test:unit` (with coverage), `npm run test:integration`, `npm run test:e2e`, secret scan, dependency audit, frontend build, and backend build. A separate Docker job builds production images, starts Compose (data stores, then API with `/health` and `/ready` retries, then worker/frontend), and runs `infra/scripts/smoke.mjs`. Reports, coverage, and `dist/` are uploaded as artifacts. No paid APIs.

CD (`.github/workflows/cd.yml`) is provider-agnostic: reusable CI → image build → registry push → deploy hook → health check. See [ci-cd.md](ci-cd.md).

Compose/Dockerfile structure is asserted in `backend/tests/infra/docker.test.ts` without starting containers.

## Adding tests for a new module

1. Unit-test the service, repository helpers, validators, and parsers next to the source (`foo.service.test.ts`).
2. Add an HTTP suite under `backend/tests/` when the module exposes `/api/v1`.
3. Use factories instead of one-off `prisma.user.create` blobs.
4. Mock every external provider.
5. Cover the failure modes in the table above that apply.
6. Document env vars and how to run the tests in the module README.
7. Keep problem-specific tests under `modules/problem/` (`src/**/*.test.ts` and `frontend/**/*.test.tsx`), not in reusable core. Platform registration is covered by `backend/tests/problem.http.test.ts`.

## Helpers

| Helper             | Role                                   |
| ------------------ | -------------------------------------- |
| `describeDatabase` | Skip when `DATABASE_URL` is unset      |
| `describeRedis`    | Skip when `REDIS_URL` is unset         |
| `AUTH_TEST_ENV`    | JWT and bcrypt settings safe for tests |
| `createApp`        | Full Express app for HTTP/e2e (`plugins` optional) |
| `discoverCapabilities` | Capability catalog without constructing services |

`fileParallelism` is off in the backend Vitest config so Prisma tests do not share a truncated database.

## Known limits

- Browser e2e (Playwright) is not in the core kit.
- Redis/BullMQ tests run only when `REDIS_URL` points at a reachable Redis.
- Coverage HTML is local/CI-artifact only; it is gitignored.
