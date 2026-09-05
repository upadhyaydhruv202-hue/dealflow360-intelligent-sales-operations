# Getting started

## Prerequisites

Install tools from [prerequisites.md](prerequisites.md) before this page. That list is authoritative (versions from `package.json`, `.nvmrc`, Dockerfiles, Compose, and CI).

For the usual hybrid workflow you need Git, Node.js **24** (`engines.node` `^24`), npm **11** (`engines.npm` `^11`, `packageManager` `npm@11.6.2`), Docker Engine with Compose **v2.24+**, and a browser. PostgreSQL 16 and Redis 7 come from Compose (`npm run deps:up` or `docker compose up --build`). Do not install Python, a local Odoo, Yarn/pnpm, or native Postgres/Redis unless you are opting out of Docker. Version table: [VERSION_MATRIX.md](VERSION_MATRIX.md).

## Setup

```bash
cd DealFlow360
cp .env.example .env
npm install
```

Environment catalog: [environment.md](environment.md). For a judged demo with mock providers, copy `.env.demo.example` instead.

### Full Docker stack

```bash
docker compose up --build
```

This starts frontend, backend, worker, Postgres, and Redis. See [docker.md](docker.md).

### Hybrid (Node on the host)

Start local dependencies if you want readiness checks against Postgres and Redis:

```bash
npm run deps:up
```

Docker publishes PostgreSQL on **localhost:5433** so it does not collide with a native PostgreSQL install on 5432. Keep `DATABASE_URL` pointed at that port (see `.env.example`). Compose containers use the `postgres` and `redis` service names instead of localhost.

The API still starts without Docker. `GET /health` stays up. `GET /ready` skips unconfigured dependencies and fails with HTTP 503 when a configured dependency is unreachable.

Apply migrations and optional demo data:

```bash
npm run db:migrate
npm run db:seed
```

`npm run db:seed` creates demo users when `DEMO_MODE` is on. After that, local `npm run dev` upserts the default RBAC catalog on startup, so new permission keys land without seeding again. Production does not auto-sync; run seed there. Production with `DEMO_MODE=false` skips demo users.

Copy `.env.test.example` to `.env.test` if you want a dedicated test URL, or run:

```bash
npm run db:test:prepare
npm test
npm run test:e2e
```

`db:test:prepare` creates `hackathon_test` from your `.env` credentials and applies migrations. If PostgreSQL was already initialized before the Docker init script existed:

```bash
docker exec hackathon-postgres createdb -U postgres hackathon_test
```

## Run

```bash
npm run dev
```

Or start everything with Docker: `docker compose up --build` ([docker.md](docker.md)).

* Frontend: http://localhost:5173
* API: http://localhost:5000
* Health: http://localhost:5000/health
* Readiness: http://localhost:5000/ready
* API v1: http://localhost:5000/api/v1
* Feature flags: http://localhost:5000/api/v1/features (see [features.md](features.md))
* Auth: http://localhost:5000/api/v1/auth/login (see [auth.md](auth.md))
* Sign-in UI: http://localhost:5173/login (after seed: `demo.admin@example.com` / `demo-password`)
* Password reset: http://localhost:5000/api/v1/auth/password-reset/request (see [auth.md](auth.md))
* OTP: http://localhost:5000/api/v1/auth/otp/request (see [otp.md](otp.md))
* RBAC: http://localhost:5000/api/v1/roles (see [rbac.md](rbac.md))
* Odoo health: http://localhost:5000/api/v1/odoo/health (see [odoo.md](odoo.md); requires `odoo.read`)
* AI health: http://localhost:5000/api/v1/ai/health (see [ai.md](ai.md); requires `ai.use`)
* Document analyze: http://localhost:5000/api/v1/documents/analyze (see [documents.md](documents.md); requires `documents.analyze`)
* Notifications: http://localhost:5000/api/v1/notifications (see [notifications.md](notifications.md); requires `notifications.read`)
* Notifications UI: http://localhost:5173/notifications
* PDF generate: http://localhost:5000/api/v1/pdf/generate (see [pdf.md](pdf.md); requires `reports.generate`)
* Reports: http://localhost:5000/api/v1/reports/generate (see [reports.md](reports.md); requires `reports.generate`)
* Files: http://localhost:5000/api/v1/files (see [storage.md](storage.md); requires `files.read` / `files.write`)
* Copilot chat: http://localhost:5000/api/v1/copilot/chat (see [copilot.md](copilot.md); requires `copilot.use`)
* Copilot UI: http://localhost:5173/copilot
* Business actions: http://localhost:5000/api/v1/intents/execute (see [intents.md](intents.md); requires `intents.use`)
* Business actions UI: http://localhost:5173/intents
* Problem intelligence: http://localhost:5000/api/v1/problem-intelligence/analyze (see [problem-intelligence.md](problem-intelligence.md); requires `FEATURE_PROBLEM_INTELLIGENCE` and `problem.analyze`)
* Problem intelligence UI: http://localhost:5173/problem-intelligence
* Capability recommendations: http://localhost:5000/api/v1/capability-recommendations/recommend (see [capability-recommendations.md](capability-recommendations.md); requires `FEATURE_CAPABILITY_RECOMMENDATIONS` and `capabilities.recommend`)
* Capability recommendations UI: http://localhost:5173/capability-recommendations
* Project planning: http://localhost:5000/api/v1/project-planning/validate (see [project-planning.md](project-planning.md); requires `FEATURE_PROJECT_PLANNING` and `projects.plan`)
* Project planning UI: http://localhost:5173/project-planning
* Project generator: http://localhost:5000/api/v1/project-generator/preview (see [project-generator.md](project-generator.md); requires `FEATURE_PROJECT_GENERATOR` and `projects.generate`)
* Project generator UI: http://localhost:5173/project-generator
* RAG (optional): http://localhost:5000/api/v1/rag/ask (see [rag.md](rag.md); requires `FEATURE_RAG` and `rag.use`)
* RAG UI: http://localhost:5173/rag
* Search (optional): http://localhost:5000/api/v1/search (see [search.md](search.md); requires `FEATURE_SEARCH` and `search.use`)
* Search UI: http://localhost:5173/search
* Analytics (optional): http://localhost:5000/api/v1/analytics/query (see [analytics.md](analytics.md); requires `FEATURE_ANALYTICS` and `analytics.read`)
* Analytics UI: http://localhost:5173/analytics
* Anomalies (optional): http://localhost:5000/api/v1/anomalies/evaluate (see [anomaly.md](anomaly.md); requires `FEATURE_ANOMALY_DETECTION` and `anomaly.use`)
* Anomalies UI: http://localhost:5173/anomalies
* Realtime (optional): http://localhost:5000/api/v1/realtime/channels (see [realtime.md](realtime.md); requires `FEATURE_REALTIME` and an existing read permission such as `jobs.read`)
* Realtime UI: http://localhost:5173/realtime
* Automations: http://localhost:5000/api/v1/automations/rules (see [automation.md](automation.md); requires `automations.read` / `automations.write`)
* Automations UI: http://localhost:5173/automations
* UI kit: http://localhost:5173/ui (see [ui.md](ui.md))
* Dashboard layout: http://localhost:5173/dashboard
* Job status: http://localhost:5000/api/v1/jobs/:jobId (see [jobs.md](jobs.md); requires `jobs.read`)

Workers register `email.send`, `sms.send`, `pdf.generate`, `report.generate`, `ai.analyze`, `document.process`, `rag.index` (when `FEATURE_RAG` is on), `anomaly.evaluate` (when `FEATURE_ANOMALY_DETECTION` is on), `odoo.sync`, `cleanup`, `notification.dispatch`, and `automation.execute`. Without Redis they share a file queue with the API; with `REDIS_URL` they share BullMQ. See [jobs.md](jobs.md) and [redis.md](redis.md).

```bash
npm run dev:workers
```

## Verify

```bash
npm test
npm run test:unit
npm run test:integration
npm run test:watch
npm run test:coverage
npm run test:e2e
npm run lint
npm run typecheck
npm run build
npm run security:secrets
```

See [testing.md](testing.md) for factories, mocks, coverage, and CI rules. GitHub Actions workflows live in `.github/workflows/` ([ci-cd.md](ci-cd.md)).

## Production secrets

`NODE_ENV=production` fails startup if required secrets are missing. See [environment.md](environment.md) for the full catalog and [configuration.md](configuration.md) for how values are loaded. Copy JWT secrets from `.env.example` into `.env` (and replace them) before calling login locally. Optional demo template: `.env.demo.example`.
