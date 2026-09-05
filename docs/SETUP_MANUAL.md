# Complete setup and usage manual

This is the A–Z setup and usage guide for DealFlow360. It is compiled from the repository (npm scripts, Compose files, routes, config schema, and existing module docs). It does not invent commands, modules, or architecture.

**Companion sources of truth** (use these when a catalog must stay exact):

| Topic | File |
| --- | --- |
| Environment variable catalog | [environment.md](environment.md) |
| Software versions | [VERSION_MATRIX.md](VERSION_MATRIX.md), [prerequisites.md](prerequisites.md) |
| Module status | [capabilities.md](capabilities.md) |
| Architecture diagrams | [ARCHITECTURE.md](../ARCHITECTURE.md) |
| API envelopes | [api-conventions.md](api-conventions.md) |
| Problem-statement template | [PROBLEM_STATEMENT.md](../PROBLEM_STATEMENT.md) |
| DealFlow360 demo | [README.md](../README.md#demo-workflow) |
| Module enable list | [HACKATHON_MODULES.md](../HACKATHON_MODULES.md) |
| Architecture decisions | [ARCHITECTURE_DECISION.md](../ARCHITECTURE_DECISION.md) |

If this page and a companion file disagree, the companion file plus the code win.

---

## How a new developer should use this document

1. Read [§1 Project purpose](#1-project-purpose) and [§3 Architecture](#3-architecture).
2. Install tools from [§5 Prerequisites](#5-prerequisites).
3. Follow [Quick start](#quick-start).
4. Enable only the modules the problem needs ([§30 Feature flags](#30-feature-flags)).
5. DealFlow360 setup and demo: [README.md](../README.md#manual-project-setup). Clone/env/deploy detail: [§33 Future hackathon reuse](#33-future-hackathon-reuse).

---

## Table of contents

1. [Project purpose](#1-project-purpose)
2. [Technology stack](#2-technology-stack)
3. [Architecture](#3-architecture)
4. [Directory structure](#4-directory-structure)
5. [Prerequisites](#5-prerequisites)
6. [Software versions](#6-software-versions)
7. [Environment variables](#7-environment-variables)
8. [Docker](#8-docker)
9. [PostgreSQL](#9-postgresql)
10. [Redis](#10-redis)
11. [Authentication](#11-authentication)
12. [RBAC](#12-rbac)
13. [Validation](#13-validation)
14. [Odoo](#14-odoo)
15. [AI](#15-ai)
16. [AI document intelligence](#16-ai-document-intelligence)
17. [AI Copilot](#17-ai-copilot)
18. [Automation](#18-automation)
19. [Background jobs](#19-background-jobs)
20. [Notifications](#20-notifications)
21. [Email](#21-email)
22. [OTP](#22-otp)
23. [File upload](#23-file-upload)
24. [Storage](#24-storage)
25. [PDF / report generation](#25-pdf--report-generation)
26. [Security](#26-security)
27. [Audit logs](#27-audit-logs)
28. [Testing](#28-testing)
29. [CI/CD](#29-cicd)
30. [Feature flags](#30-feature-flags)
31. [Demo mode](#31-demo-mode)
32. [Troubleshooting](#32-troubleshooting)
33. [Future hackathon reuse](#33-future-hackathon-reuse)
34. [Git](#34-git)
35. [Additional modules](#35-additional-modules) (SMS, scheduler, intents, problem intelligence, RAG, anomaly, UI, observability, foundation, profiles)
36. [Root npm scripts](#36-root-npm-scripts)
37. [HTTP API index](#37-http-api-index)
38. [Frontend routes](#38-frontend-routes)

---

## Quick start

Documented happy path: **hybrid** (Docker for PostgreSQL and Redis, Node on the host). Full Compose is an alternative. For a judged demo with mock AI/email/SMS, copy `.env.demo.example` instead of `.env.example`.

```text
Install prerequisites
  → clone repository
  → configure .env
  → npm install
  → start Docker (Postgres + Redis)
  → migrate
  → seed
  → start application
  → verify health
  → run tests
```

### 1. Install prerequisites

Git, Docker Engine + Compose v2.24+, Node.js 24 (npm 11 included), a browser. Confirm:

```bash
git --version
node -v
npm -v
docker version
docker compose version
```

Expect Node `v24.x` and npm `11.x`. Expect `docker compose version` to report **v2.24** or newer.

### 2. Clone

```bash
git clone <repository-url>
cd DealFlow360
```

### 3. Configure `.env`

```bash
cp .env.example .env
```

On Windows PowerShell, `cp` works as `Copy-Item`. JWT placeholders in `.env.example` are for local use only.

### 4. Install dependencies

```bash
npm install
```

This also runs `prisma generate` (backend `postinstall`).

### 5. Start data stores

```bash
npm run deps:up
```

Equivalent: `docker compose up -d postgres redis`. Host PostgreSQL is published on **localhost:5433**.

### 6. Migrate and seed

```bash
npm run db:migrate
npm run db:seed
```

Demo users exist only when `DEMO_MODE` is on (default outside production). Password for all seeded demo accounts: `demo-password`.

| Email | Role |
| --- | --- |
| `demo.admin@example.com` | admin |
| `demo.manager@example.com` | manager |
| `demo.staff@example.com` | staff |
| `demo.user@example.com` | user |

### 7. Start the application

```bash
npm run dev
```

- Frontend: http://localhost:5173
- API: http://localhost:5000
- Health: http://localhost:5000/health
- Readiness: http://localhost:5000/ready
- Sign-in UI: http://localhost:5173/login

Optional workers (document analysis, email, PDF, AI, Odoo sync, reports, cleanup, notifications):

```bash
npm run dev:workers
```

API + frontend + workers in one process group:

```bash
npm run dev:all
```

**Full Docker alternative** (skip host migrate/seed/dev):

```bash
docker compose up --build
```

The API container migrates and, with `SEED_ON_START=true`, seeds. Wait until `backend` is healthy.

Do not run `docker compose up --build` and `npm run dev` against the same ports at once.

### 8. Verify

```bash
node -e "fetch('http://localhost:5000/health').then(r=>r.json()).then(console.log)"
node -e "fetch('http://localhost:5000/ready').then(r=>r.json()).then(console.log)"
```

Against a running Compose stack:

```bash
npm run docker:smoke
```

### 9. Tests

```bash
cp .env.test.example .env.test
npm run db:test:prepare
npm test
npm run test:e2e
```

`npm test` skips Postgres/Redis integration suites when those URLs are unset. `test:e2e` requires the test database.

---

## 1. Project purpose

This repository is a **reusable full-stack starter kit** for Odoo hackathons, AI hackathons, software-engineering hackathons, college hackathons, startup MVPs, academic projects, prototypes, and rapid production-style applications.

It provides reusable infrastructure so teams can focus on the problem statement instead of rebuilding authentication, databases, AI integrations, notifications, file processing, automation, Docker, and CI/CD.

The reusable core must stay generic. Hackathon-specific business logic belongs under `modules/problem/`. Do not transform this repository into a single-purpose application.

License: **AGPL-3.0-or-later** (`LICENSE`, root `package.json`). Third-party dependencies remain subject to their own licenses.

Status of each capability: [capabilities.md](capabilities.md). Webhooks as a standalone integration module are **Planned**, not READY (inbound automation webhooks do exist under the automation engine).

---

## 2. Technology stack

Taken from `package.json`, Dockerfiles, Compose, and [VERSION_MATRIX.md](VERSION_MATRIX.md).

### Frontend

- React 18
- Vite 6
- Tailwind CSS 3
- React Router 6

### Backend

- Node.js 24
- Express 4
- TypeScript
- REST under `/api/v1`

### Database

- PostgreSQL 16
- Prisma 6 (the only ORM)

### Infrastructure

- Redis 7
- BullMQ 6 (when `REDIS_URL` is set)
- Docker Compose v2.24+
- GitHub Actions (`ubuntu-24.04`)

### AI

Provider-agnostic adapters. Current providers: **Gemini** (REST, no vendor SDK package) and **mock**. Default Gemini model: `gemini-2.5-flash`.

### Integrations

- Odoo 19 JSON-2
- Email (SMTP, Resend, Brevo, mock)
- SMS (HTTP + mock)
- Storage (local disk, PostgreSQL objects, S3)
- PDF (`pdf-lib`)

### Intentionally not in this kit

Python, Yarn/pnpm/Bun, Playwright/Cypress, Kubernetes, Kafka, GraphQL, a local Odoo installer, Mailhog, MinIO, Adminer, a vector-database container.

---

## 3. Architecture

Layers (from [ARCHITECTURE.md](../ARCHITECTURE.md) and `AGENTS.md`):

```text
Frontend → API → Controller → Service → Repository → Database

External integrations:
Service → Integration Adapter → External Provider

Asynchronous execution:
API / Service → Queue → Worker → Service → Event / Notification
```

```text
                    React Frontend
                         │
                         │ HTTPS / REST
                         ▼
                  Express API Layer
                         │
             ┌───────────┼───────────┐
             │           │           │
             ▼           ▼           ▼
          Services   Integrations  Jobs
             │           │           │
             ▼           ▼           ▼
       Repositories    Providers   Workers
             │
             ▼
         PostgreSQL
```

### Request flow

```text
HTTP Request
  → Request ID
  → Middleware (headers, CORS, rate limits, auth, RBAC)
  → Route
  → Controller (Zod validation)
  → Service
  → Repository / Integration
  → Response / centralized error handler
```

Long-running work is queued instead of blocking HTTP.

### Operational endpoints

These stay **outside** `/api/v1`:

| Method | Path | Role |
| --- | --- | --- |
| GET | `/health` | Process liveness |
| GET | `/ready` | PostgreSQL, Redis, Odoo, and AI when those integrations are configured |

Application APIs use `/api/v1` and the standard envelopes ([api-conventions.md](api-conventions.md)).

### Frontend architecture

```text
frontend/src/
  ui/           Reusable visual system (theme and toasts live here)
  features/     FeatureProvider — UX only, loads GET /api/v1/features
  auth/         AuthProvider, SessionGate, login
  components/   Feature UI that composes the kit
  pages/
  layouts/
  hooks/        Optional shared hooks (placeholder README)
  context/      Optional extra providers (auth/theme already exist)
  services/     API modules — the only place that knows backend paths
  lib/
```

Components must not hardcode backend URLs. The SPA may only receive `VITE_API_URL`.

### Backend layout

```text
backend/src/
  config/ controllers/ routes/ services/ repositories/
  middleware/ schemas/ integrations/ jobs/ events/
  scheduler/ notifications/ automation/ auth/ rbac/
  security/ audit/ observability/ features/ intents/ anomaly/
```

### Dependency direction

Preferred: Controller → Service → Repository / Integration.

Avoid: Repository → Controller, Database → Controller, AI provider → Controller, Odoo adapter → Frontend.

### Problem-specific code

All hackathon-specific features live under `modules/problem/`. The reusable core must remain generic.

---

## 4. Directory structure

```text
DealFlow360/
  frontend/              React + Vite + Tailwind (Dockerfile)
  backend/               Express API (TypeScript, Dockerfile, worker.ts)
  workers/               Workspace that runs backend/src/worker.ts
  database/              Prisma schema, migrations, seeds
  infra/                 Compose data stores, nginx, Postgres init, healthchecks, deploy scripts
  docs/                  Module and operator documentation
  modules/problem/       Hackathon-specific code only
  .github/workflows/     ci.yml, cd.yml
  .github/dependabot.yml
  docker-compose.yml     App services; includes infra/docker-compose.yml
  ARCHITECTURE.md
  ARCHITECTURE_DECISION.md
  HACKATHON_MODULES.md
  HACKATHON_MODULES.md
  PROBLEM_STATEMENT.md
  AGENTS.md
  LICENSE
  .env.example
  .env.demo.example
  .env.test.example
```

`docker-data/` is gitignored local Compose volume data (Postgres and Redis). Do not commit it.

Workers do **not** have a separate Dockerfile. Compose and CD use the backend image with command `worker`.

---

## 5. Prerequisites

Authoritative list: [prerequisites.md](prerequisites.md).

### Mandatory local installation

| Software | Why |
| --- | --- |
| Git | Clone. No Git version is pinned |
| Node.js **24** | `engines.node` is `^24`. `.nvmrc` is `24` |
| npm **11** | Only package manager. `engines.npm` is `^11`, `packageManager` is `npm@11.6.2` |
| Docker Engine + Compose **v2.24+** | `docker compose` (not `docker-compose` V1). Root compose uses `include` and `env_file.path` with `required: false` |
| Web browser | SPA at http://localhost:5173 |

A laptop with only Docker can start the Compose app after you copy `.env`, but it cannot run the documented test and lint commands without host Node.

### Docker-provided (do not install on the host for the default path)

PostgreSQL 16, Redis 7, optional nginx (`nginxinc/nginx-unprivileged:1.27-alpine`).

### Optional

Native PostgreSQL 16, native Redis 7, nvm/fnm, Cursor/VS Code, curl.exe, GitHub CLI (`gh` is not referenced by npm scripts).

### Online accounts (only when that feature is on)

Gemini API key, Odoo 19 database + API key, SMTP/Resend/Brevo, HTTP SMS gateway, AWS S3, GHCR for CD.

None of these are required to clone, start Compose with demo mocks, or run unit tests.

### Installation order

1. Git
2. Docker Engine + Compose v2.24+ (start the daemon)
3. Node.js 24
4. Browser
5. Then Quick start above

### Platform notes

- **Windows:** Docker Desktop + WSL 2 is typical. Host Postgres is mapped to **5433**, not 5432. Prefer `curl.exe` (PowerShell `curl` is `Invoke-WebRequest`). Keep the repo on a drive Docker can bind-mount.
- **macOS:** Port **5000** is often taken by AirPlay Receiver. Turn it off or change `PORT` and keep Vite’s proxy in sync.
- **Linux:** Install the Compose **v2 plugin**. Add your user to the `docker` group.

---

## 6. Software versions

Authoritative table: [VERSION_MATRIX.md](VERSION_MATRIX.md) (audit date **2026-08-30**). Policy: [VERSIONING_POLICY.md](VERSIONING_POLICY.md).

| Component | Version in this repo | Source |
| --- | --- | --- |
| Node.js | `^24` (`.nvmrc` `24`; images `node:24-alpine`) | `package.json` engines, Dockerfiles, CI |
| npm | `^11` (`packageManager` `npm@11.6.2`) | Root `package.json` |
| PostgreSQL | **16** (`postgres:16-alpine`) | Compose + CI services |
| Redis | **7** (`redis:7-alpine`) | Compose + CI services |
| Prisma | declared `^6.16.2` | `backend/package.json` |
| Express | `^4.21.2` | `backend/package.json` |
| React | `^18.3.1` | `frontend/package.json` |
| Vite | `^6.2.1` | `frontend/package.json` |
| Tailwind | `^3.4.17` | `frontend/package.json` |
| TypeScript | `^5.8.2` | Root and workspaces |
| Vitest | `^3.0.8` | Workspaces |
| Odoo protocol | Odoo **19** JSON-2 | Code + [odoo.md](odoo.md) |
| Gemini default model | `gemini-2.5-flash` | `backend/src/integrations/ai/ai.config.ts` |
| Frontend nginx | `nginxinc/nginx-unprivileged:1.27-alpine` | Frontend Dockerfile |
| GitHub Actions runner | `ubuntu-24.04` | `ci.yml` / `cd.yml` |

npm is the only package manager. `.npmrc` sets `engine-strict=true`. Do not add Yarn, pnpm, or Bun.

Majors intentionally **not** adopted: Prisma 7/8, Express 5, React 19, React Router 7, Vite 7, Tailwind 4, Zod 4, Vitest 4, Node 26.

Reproducibility comes from `package-lock.json`, not caret ranges.

---

## 7. Environment variables

Authoritative catalog: [environment.md](environment.md). Loading rules: [configuration.md](configuration.md).

### Files

| File | Purpose |
| --- | --- |
| `.env.example` | Local development and Compose. Copy to `.env` |
| `.env.demo.example` | Safe judged demo: mock AI/email/SMS/OTP |
| `.env.test.example` | Copy to `.env.test` for backend tests (`hackathon_test`) |

Never commit `.env`, `.env.test`, or `.env.demo`. Never put real secrets in `*.example` files.

The process loads **repository-root** `.env`. Backend Prisma scripts also load that root file.

### Public frontend vs server secrets

The only variable Vite may bake into the browser is **`VITE_API_URL`**. Do not prefix JWT, Odoo, AI, SMTP, SMS, or AWS secrets with `VITE_`.

`API_PROXY_TARGET` is Vite **dev-server** only (`frontend/vite.config.ts`). Default `http://localhost:5000`. It is not shipped in the production SPA.

### Always required in production (`NODE_ENV=production`)

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET` (32+ characters)
- `JWT_REFRESH_SECRET` (32+ characters)
- `AUTH_BCRYPT_COST` at least `10` (default `12` already satisfies this)

JWT secrets are also required in development whenever `DATABASE_URL` is set (tests are exempt).

Production also refuses `CORS_ORIGINS=*` and refuses `DEMO_MODE=true` unless `ALLOW_DEMO_IN_PRODUCTION=true` (never on a real tenant).

### How to enable or disable features

Missing `FEATURE_*` flags default to **false** except `FEATURE_PDF` (**true**). `.env.example` turns common local-demo flags on.

| To disable | Set |
| --- | --- |
| AI, documents LLM, copilot/intents/RAG answers | `FEATURE_AI=false` and `AI_ENABLED=false` |
| Odoo | `FEATURE_ODOO=false` and `ODOO_ENABLED=false` |
| Automation HTTP + event matching | `FEATURE_AUTOMATION=false` |
| Extra notification side effects | `FEATURE_NOTIFICATIONS=false` |
| OTP and password-reset OTP | `FEATURE_OTP=false` |
| SMS | `FEATURE_SMS=false` and `SMS_ENABLED=false` |
| S3 | `FEATURE_S3=false` and `STORAGE_PROVIDER=local` (or `postgres`) |
| RAG | `FEATURE_RAG=false` |
| Search | `FEATURE_SEARCH=false` |
| Analytics | `FEATURE_ANALYTICS=false` |
| Copilot | `FEATURE_COPILOT=false` |
| Intents | `FEATURE_INTENTS=false` |
| Problem intelligence | `FEATURE_PROBLEM_INTELLIGENCE=false` |
| Capability recommendations | `FEATURE_CAPABILITY_RECOMMENDATIONS=false` |
| Project planning | `FEATURE_PROJECT_PLANNING=false` |
| Project generator | `FEATURE_PROJECT_GENERATOR=false` |
| Anomaly engine | `FEATURE_ANOMALY_DETECTION=false` |
| Real-time SSE | `FEATURE_REALTIME=false` |
| PDF/report HTTP | `FEATURE_PDF=false` |
| Email sending | `EMAIL_ENABLED=false` |
| Scheduler ticks | `SCHEDULER_ENABLED=false` |
| Job consumers in this process | `JOBS_PROCESS=false` |
| Demo mode | `DEMO_MODE=false` |

Aliases: `AI_ENABLED`, `ODOO_ENABLED`, `SMS_ENABLED`. `STORAGE_PROVIDER=s3` also enables S3.

Feature flags are process env, not per-user. Restart after a change.

Generate local JWT secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Group-by-group tables (application, database, Redis, auth, Odoo, AI, RAG, anomaly, email, SMS, storage, jobs, security, CORS, CI/CD) live in [environment.md](environment.md). Do not invent names that are not listed there.

---

## 8. Docker

Details: [docker.md](docker.md).

### Purpose

Local full-stack development with Docker Compose. Kubernetes is not required.

### Dependencies

Docker Engine with Compose v2.24+. Copy `.env.example` to `.env`. Compose loads `.env.example` then optional `.env`. Secrets stay in env files, never in Dockerfiles.

### Configuration

Root `docker-compose.yml` includes `infra/docker-compose.yml` (Postgres + Redis). App services: `backend`, `worker`, `frontend`, optional `nginx` (profile `nginx`).

Inside API/worker containers, Compose **overrides**:

- `DATABASE_URL` → `postgresql://…@postgres:5432/…`
- `REDIS_URL` → `redis://redis:6379`
- `JOBS_PROCESS=false` on API, `true` on worker
- `SEED_ON_START` default `true` on the API container

Host Node uses `localhost:5433` and `localhost:6379` from `.env`.

### How it works

| Service | Image / build | Host access | Role |
| --- | --- | --- | --- |
| `postgres` | `postgres:16-alpine` | `127.0.0.1:5433` → 5432 | Primary database. Init also creates `hackathon_test` |
| `redis` | `redis:7-alpine` | `127.0.0.1:6379` | BullMQ, cache, rate limits, OTP, idempotency |
| `backend` | `backend/Dockerfile` target `development` | http://localhost:5000 | Express API. Migrates; seeds when `SEED_ON_START=true` |
| `worker` | same image, `command: ['worker']` | none | Job consumer |
| `frontend` | `frontend/Dockerfile` target `production` | http://localhost:5173 → container 8080 | Static SPA; nginx proxies `/api`, `/health`, `/ready` |
| `nginx` | unprivileged 1.27 Alpine | http://localhost:8080 | Optional unified origin. Not started by default |

Backend and worker share image `hackathon-backend:dev`. The frontend production stage already embeds nginx; the Compose `nginx` service is a separate edge proxy.

Images use multi-stage Alpine builds and non-root processes where practical.

### Public interface / commands

```bash
docker compose up --build
# or
npm run docker:up

docker compose down          # npm run docker:down
docker compose logs          # npm run docker:logs (follow)
docker compose ps            # npm run docker:ps
docker compose logs -f backend
docker compose exec backend sh
docker compose exec postgres psql -U postgres -d hackathon

docker compose --profile nginx up --build   # optional :8080

npm run deps:up     # postgres + redis only
npm run deps:down
npm run docker:smoke
```

`docker compose down` does **not** delete `docker-data/`.

### Example usage

Full stack for a demo: `docker compose up --build`, then open http://localhost:5173/login with `demo.admin@example.com` / `demo-password`.

Hybrid: `npm run deps:up` then `npm run db:migrate`, `npm run db:seed`, `npm run dev`.

### Failure cases

- Compose V1 (`docker-compose`) cannot parse `include` / `env_file.required`.
- Docker daemon not running.
- Port conflicts on 5000, 5173, 6379, 5433, 8080.
- `/ready` 503 if Postgres/Redis/enabled Odoo/AI cannot be reached.
- Windows antivirus locking `docker-data/postgres`.

### Tests

Static Compose/Dockerfile assertions: `backend/tests/infra/docker.test.ts` (no containers). CI Docker job builds production images, starts Compose in stages (data stores, API with `/health` and `/ready` retries, then worker/frontend), then `infra/scripts/smoke.mjs`.

### Limitations

No Mailhog, MinIO, Adminer, Kafka, extra Postgres/Redis, or local Odoo container. RAG uses PostgreSQL. The frontend Dockerfile `development` stage exists for Dockerized HMR but is **not** a Compose service.

### Extension points

- Optional nginx profile
- CD builds **production** stages and pushes to a registry ([ci-cd.md](ci-cd.md))
- Hackathon-specific `docker-compose.prod.yml` belongs in the fork, not the generic kit

---

## 9. PostgreSQL

Details: [database.md](database.md), `database/README.md`.

### Purpose

Primary persistent relational database. Identity, notifications, documents, automation, audit, optional RAG/anomaly, and file metadata live here.

### Dependencies

PostgreSQL 16. Prisma 6 is the only ORM. Application code reaches Postgres through `Service → Repository → Prisma Client`. Controllers must not query Prisma.

### Configuration

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Required in production. Host hybrid: `postgresql://postgres:postgres@localhost:5433/hackathon` |
| `DATABASE_POOL_MAX` | Default `10` (`connection_limit`) |
| `DATABASE_POOL_TIMEOUT_SECONDS` | Default `10` |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Compose interpolation only (`postgres` / `postgres` / `hackathon`) |

### How it works

Schema, migrations, and seeds: `database/prisma`. UUID primary keys, snake_case columns via `@map`. Check constraints live in SQL migrations.

`GET /ready` pings PostgreSQL with `SELECT 1`.

### Public interface

```bash
npm run db:generate       # prisma generate
npm run db:migrate        # migrate deploy (CI and production)
npm run db:migrate:dev    # create/apply a migration in development
npm run db:seed
npm run db:reset          # drop database, migrate, seed (destructive)
npm run db:test:prepare   # create hackathon_test and migrate
```

`db:migrate` is non-interactive.

### Example usage

After `npm run deps:up`:

```bash
npm run db:migrate
npm run db:seed
```

Add a model: edit `database/prisma/schema.prisma`, then:

```bash
npm run db:migrate:dev -- --name add_widget
```

Create a repository under `backend/src/repositories`. Put problem-specific models in the same Prisma schema only when they are needed; keep problem services under `modules/problem/`.

### Failure cases

- `ECONNREFUSED` on 5432: host Node must use **5433** with Compose.
- Missing `hackathon_test`: volume created before `infra/postgres-init` existed. Fix: `docker exec hackathon-postgres createdb -U postgres hackathon_test`.
- Production `DEMO_MODE=false` seeds the RBAC catalog and **skips** demo users.

### Tests

Prisma integration suites run when `DATABASE_URL` is set (`describeDatabase`). Factories in `backend/tests/factories`. `resetDatabase()` between tests.

### Limitations

Prisma 6 does not model CHECK in the schema file (checks are SQL). There is no `migrate down` workflow; rollbacks are forward migrations or a restored backup. Do not add `pg`, Knex, or Drizzle.

### Extension points

New models + repositories. Optional `directUrl` later if PgBouncer is introduced. Problem tables should still go through repositories.

---

## 10. Redis

Details: [redis.md](redis.md).

### Purpose

Optional locally, **required in production**. Fast, short-lived data: queues, cache, rate limits, OTP hashes, idempotency keys, copilot/intent confirmation tokens. Not the primary business database.

### Dependencies

Redis 7. `ioredis` 5. BullMQ when used as the job backend.

### Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `REDIS_URL` | unset | Host: `redis://localhost:6379`. Compose overrides to `redis://redis:6379` |

When unset: in-process memory for KV/rate limits/OTP, and a **file queue** under `backend/job-queue` so API and workers on one machine still share jobs.

### How it works

| Use | Interface |
| --- | --- |
| Background queues | BullMQ queue `hackathon` |
| Cache | `CacheService` |
| Rate limiting | `createRateLimitStore` |
| OTP state | hashed challenges in `KvStore` |
| Intent / copilot confirmations | KV with TTL and `SET NX` consume |
| Idempotency | `IdempotencyStore` |

### Public interface

There is no Redis HTTP API. Services call `createKvStore`, `CacheService`, `IdempotencyStore`.

### Example usage

`.env.example` sets `REDIS_URL=redis://localhost:6379` with `npm run deps:up`. Production must set a real URL.

### Failure cases

Production fails closed on rate-limit store failure (`RATE_LIMIT_FAIL_CLOSED` defaults true in production). Development fails open so a local Redis outage does not block work.

### Tests

Memory KV tests always run. Redis/BullMQ suites run when `REDIS_URL` is set. Uncomment it in `.env.test` and start Compose.

### Limitations

In-memory stores are per process and reset on restart. Do not persist orders or users in Redis.

### Extension points

Swap is already behind `KvStore`. Do not add a second cache product for the same job.

---

## 11. Authentication

Details: [auth.md](auth.md).

### Purpose

Identify the current user (email/password, JWT access + rotating refresh tokens, optional OTP and password reset). Authorization is RBAC, not this module.

### Dependencies

Database (users, refresh tokens). Redis optional (rate limits, OTP, token denylist). `FEATURE_OTP` for OTP HTTP and password reset.

### Configuration

| Variable | Default |
| --- | --- |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | required in production; 32+ chars |
| `JWT_ACCESS_EXPIRES_IN` | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `7d` |
| `JWT_ISSUER` | `hackathon-starter-kit` |
| `JWT_AUDIENCE` | `hackathon-starter-kit-api` |
| `AUTH_PASSWORD_MIN_LENGTH` / `MAX` | `8` / `72` |
| `AUTH_BCRYPT_COST` | `12` (`4` in tests); production min `10` |
| `AUTH_DEFAULT_ROLE` | `user` |
| `AUTH_LOGIN_RATE_LIMIT_MAX` | `5` per email / window |
| `AUTH_LOGIN_IP_RATE_LIMIT_MAX` | `20` per IP / window |
| `AUTH_LOGIN_RATE_LIMIT_WINDOW` | `15m` |

Tokens are **HS256**. Claims are minimal (`sub`, `type`, `role`, `jti`, `iss`, `aud`, `iat`, `exp`). Do not put email or names in tokens. Do not authorize from the JWT `role` claim; `authenticate()` reloads roles from the database.

### How it works

```text
POST /api/v1/auth/login → AuthController → AuthService
  → PasswordService (bcrypt) + TokenService (JWT) + repositories
```

Refresh tokens are stored as SHA-256 hashes. Refresh rotates (old row revoked). Reuse of a revoked token revokes the family. Logout revokes the family; with `Authorization: Bearer`, that access `jti` is denylisted.

### Public interface / API

Prefix `/api/v1/auth`:

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/register` | No | Create account and issue tokens |
| POST | `/login` | No | Verify credentials and issue tokens |
| POST | `/refresh` | No | Rotate refresh token |
| POST | `/logout` | No | Revoke refresh family; denylist access if Bearer sent |
| GET | `/me` | Bearer | Current user + roles + permissions |
| POST | `/otp/request` | No | Issue OTP ([§22](#22-otp)) |
| POST | `/otp/verify` | No | Verify OTP; login purpose issues tokens |
| POST | `/password-reset/request` | No | Same envelope whether the email exists |
| POST | `/password-reset/confirm` | No | Set password; revoke tokens |

Protect other routes with `authenticate()` then `requirePermission()`.

### Example usage

Sign-in UI: http://localhost:5173/login. After seed: `demo.admin@example.com` / `demo-password`.

`AuthProvider` keeps the access token in memory and uses httpOnly cookies for refresh. User JSON may be cached in `localStorage`; JWTs are not.

### Failure cases

- Unknown email and wrong password: same `401 Invalid email or password`
- Disabled account with correct password: `403 Account is disabled`
- Missing JWT secrets with `DATABASE_URL`: API refuses to start (login would 503)
- Duplicate register email: conflict

### Tests

Hashing, JWT expiry/malformed type, register/login, refresh rotation/reuse, logout, disabled account, brute-force limits. See `backend/src/auth` and HTTP suites.

### Limitations

Access tokens are denylisted on logout when Bearer or an access cookie is sent. Keep access TTL short. Expired refresh-token cleanup is not a background job. XSS on the SPA origin can still use cookies ([security.md](security.md)).

### Extension points

Call the HTTP API and `authenticate()`. Do not fork token/password internals into `modules/problem`.

---

## 12. RBAC

Details: [rbac.md](rbac.md). Catalog: `backend/src/rbac/catalog.ts`.

### Purpose

Authorize actions after identity. Model: User → Role (many) → Permission (`resource.action`). Effective permissions are the **union** of roles. There is **no** hardcoded ADMIN bypass in middleware.

### Dependencies

Auth + Database.

### Configuration

`AUTH_DEFAULT_ROLE` (default `user`) is assigned on register when that role exists. Catalog is upserted on local API startup (non-production, non-test) when `DATABASE_URL` is set. Production must run `npm run db:seed`.

Default roles: `admin`, `manager`, `staff`, `user` (stored lowercase; `authorizeRole("ADMIN")` matches).

Default permission keys:

`users.read` / `users.write`, `roles.read` / `roles.write`, `reports.generate`, `notifications.read` / `notifications.write`, `odoo.read` / `odoo.write`, `ai.use`, `copilot.use`, `intents.use`, `rag.use`, `anomaly.use`, `documents.analyze` / `documents.read`, `files.read` / `files.write`, `automations.read` / `automations.write` / `automations.execute`, `jobs.read`, `audit.read`, `admin.settings`.

Odoo vs login (seeded defaults):

| Role | App login | `odoo.read` | `odoo.write` |
| --- | --- | --- | --- |
| USER | yes | no | no |
| STAFF | yes | yes | no |
| MANAGER | yes | yes | no |
| ADMIN | yes | yes | yes |

Staff and user do **not** receive `ai.use` / `copilot.use` by default.

### How it works

`authenticate()` attaches `req.user` with `roles` and `permissions`. `requirePermission("reports.generate")` requires **every** listed permission. `authorizeRole("ADMIN")` requires **at least one** listed role. Missing auth is 401; wrong permission is 403.

Frontend `frontend/src/lib/rbac.ts` is UX only.

### Public interface / API

Prefix `/api/v1`. Bearer + catalog permission:

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/roles` | `roles.read` |
| POST | `/roles` | `roles.write` |
| GET | `/permissions` | `roles.read` |
| POST | `/permissions` | `roles.write` |
| POST | `/roles/:roleName/permissions` | `roles.write` |
| POST | `/users/:userId/roles` | `roles.write` |

`GET /api/v1/auth/me` returns roles/permissions for UI rendering. That list is not an authorization decision.

### Example usage

Add `inventory.approve` in `catalog.ts` (or `POST /api/v1/permissions`), grant it to a role, then `requirePermission("inventory.approve")`. Do not change middleware internals.

### Failure cases

Unauthenticated 401. Missing permission 403. A key created only via the API is **not** auto-granted to ADMIN.

### Tests

Correct/missing role and permission, unauthenticated, permission union, ADMIN does not bypass unassigned keys, USER cannot obtain Odoo write from login alone.

### Limitations

Permissions are loaded on each request (no cache). Seed is additive. There is no permission-revocation HTTP endpoint.

### Extension points

`catalog.ts` or the RBAC HTTP API. Problem routes use the same middleware.

---

## 13. Validation

Details: [validation.md](validation.md), [api-conventions.md](api-conventions.md).

### Purpose

Zod is the only schema library. Validate HTTP input, AI output, provider responses, files, and configuration.

### Dependencies

None beyond Zod 3.

### Configuration

`REQUEST_BODY_LIMIT` (default `1mb`). Config schema: `backend/src/config/schema.ts`.

### How it works

```text
HTTP → request ID → parseBody/Params/Query or validate() → controller → service
  (parseAiOutput / parseProviderResponse) → errorHandler
```

### Public interface

Reusable schemas from `backend/src/schemas`: `idSchema`, `emailSchema`, `urlSchema`, pagination/sort/filter helpers, file metadata, document analyze body.

Helpers: `parseBody` / `parseParams` / `parseQuery` / `parseHeaders` → `ValidationError` (400); `parseAiOutput` → validation with source `ai`; `parseProviderResponse` → `ExternalServiceError` (502); `parseConfig` → startup Error.

Success envelope: `{ success: true, data, meta }`. Error envelope: `{ success: false, error: { code, message, details }, requestId }`.

Error types: `ValidationError` (400), `AuthenticationError` (401), `AuthorizationError` (403), `NotFoundError` (404), `FeatureDisabledError` (404 `FEATURE_DISABLED`), `ConflictError` (409), `RateLimitError` (429), `ExternalServiceError` (502), `DatabaseError` (503), `TimeoutError` (504). Unhandled → `INTERNAL_ERROR` (500) with no stack.

Every response includes `x-request-id`.

### Example usage

```ts
router.get('/items', validate({ query: paginationQuerySchema }), controller.list);
```

### Failure cases

Invalid body → `VALIDATION_ERROR` with `details` as an array of `{ path, message, code }`. Other errors keep `details` as an object.

### Tests

Common schema tests, parse helpers, global error handler, HTTP envelope tests.

### Limitations

Clients must accept `details` as either array or object. Responses never include stack traces, secrets, or filesystem paths.

### Extension points

Compose feature schemas from shared primitives. Do not re-declare email/UUID rules in a controller.

---

## 14. Odoo

Details: [odoo.md](odoo.md). Implementation: `backend/src/integrations/odoo/`.

### Purpose

Reusable Odoo **19 JSON-2** connector. Future hackathons add **model adapters** and **capabilities**. They do not change the HTTP client, and they do not send Odoo credentials to React.

There is **no** generic “run any Odoo method” HTTP API. Frontend users never choose a model or method name.

### Dependencies

HTTP from Node. Application auth + `odoo.read` / `odoo.write` for user-triggered calls. Feature flags `FEATURE_ODOO` or `ODOO_ENABLED`.

### Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `ODOO_ENABLED` / `FEATURE_ODOO` | `false` | Either enables the integration |
| `ODOO_BASE_URL` | unset | Origin only, **no** `/json/2` suffix |
| `ODOO_DATABASE` | unset | Sent as `X-Odoo-Database` |
| `ODOO_API_KEY` | unset | Bearer token; never log or return it |
| `ODOO_TIMEOUT_MS` | `15000` | Per-request abort |
| `ODOO_MAX_RETRIES` | `2` | Extra attempts after the first |
| `ODOO_RETRY_BASE_MS` | `200` | Exponential backoff base |

Production requires URL, database, and API key when Odoo is enabled.

Create a key in Odoo: **Preferences → Account Security → New API Key**. Prefer a dedicated bot user with minimum Odoo rights.

### How it works — integration architecture

```text
Controller (HTTP + zod + authenticate + requirePermission)
        │
        ▼
Application / problem service
        │
        ├── OdooService.execute(user, capability, method, params)
        │         allowlist + app RBAC + confirmation + schemas
        │
        └── Model adapter (res.partner, sale.order, …)
                  │
                  ▼
            OdooOperations  (search / searchRead / read / create / write / unlink / callMethod)
                  │
                  ▼
            OdooClient      (JSON-2 HTTP, timeout, retries, logging)
                  │
                  ▼
            Odoo 19  POST /json/2/<model>/<method>
```

Credentials stay server-side. Application login does **not** grant Odoo access.

### Authentication (Odoo vs app)

- **App user:** JWT via `authenticate()`. Permission `odoo.read` or `odoo.write` (or a tighter key you add).
- **Odoo server:** one process-wide API key (`ODOO_API_KEY`) as HTTP Bearer, plus `X-Odoo-Database`. A 401 from Odoo is `AuthenticationError` for the **server key**, not the app user’s JWT.

### Read / write operations

Trusted backend code (adapters, jobs) may call typed operations. Method names come from **your source code**, not from `req.body`.

```ts
import { createOdooService } from '../integrations/odoo';

const odoo = createOdooService({ config, logger });

await odoo.search({ model: 'res.partner', domain: [['is_company', '=', true]], limit: 20 });
await odoo.searchRead({ model: 'res.partner', domain: [], fields: ['name', 'email'], limit: 20 });
await odoo.read({ model: 'res.partner', ids: [1], fields: ['name'] });
await odoo.create({ model: 'res.partner', values: [{ name: 'Ada' }] });
await odoo.write({ model: 'res.partner', ids: [1], values: { email: 'ada@example.com' } });
await odoo.unlink({ model: 'res.partner', ids: [1] });
await odoo.callMethod({ model: 'sale.order', method: 'action_confirm', ids: [12] });
```

Optional: `searchReadPaged`, `readBatched` / `createBatched`, opt-in read cache `{ ttlMs }` (**never** for writes).

Retries apply to idempotent reads and HTTP 429. Creates, writes, unlinks, and unknown methods are **not** retried on 5xx (the request may already have committed in Odoo). Job `odoo.sync` rejects write methods.

### Allowlist / capabilities (user-triggered)

Anything a logged-in user can trigger must go through `OdooService.execute`. The caller supplies a **capability name** and a **method**. They do not supply a model, and they cannot pass an arbitrary Odoo method.

```ts
await odoo.execute({
  user: req.user,
  capability: 'orders.confirm',
  method: 'action_confirm',
  ids: [orderId],
  confirmed: true,
});
```

For each user-facing action the service: authenticates → authorizes the capability’s app permission → validates input → validates the method is on the capability (model is fixed) → requires `confirmed: true` when the capability says so.

`OdooService.create` / `write` / `unlink` / `callMethod` require a capability and go through `execute()`. `service.operations` is not a public backdoor. Ungated **read** helpers still exist for trusted server code with hardcoded models.

### Model adapters

`createOdooModelAdapter({ model, service, readCapability, writeCapability })` binds a technical model name to `execute()`. Put reusable helpers next to the integration. Put hackathon-specific mapping in `modules/problem/`.

Examples in [odoo.md](odoo.md): partner (`res.partner`), order (`sale.order` + `action_confirm`), inventory (`product.product` / `stock.quant`). Do not add those adapters to the reusable core unless they stay generic and unused by default.

### Public HTTP API

| Method | Path | Auth | Permission | Description |
| --- | --- | --- | --- | --- |
| GET | `/api/v1/odoo/health` | Bearer | `odoo.read` | Connectivity via `res.users/context_get` |

`GET /ready` also pings Odoo when enabled. Unconfigured Odoo is skipped and does not fail readiness.

Demo mode does **not** invent a fake Odoo write. If Odoo is disabled, operations fail closed.

### Error handling

| Odoo | App error |
| --- | --- |
| 401 | `AuthenticationError` (server API key) |
| 403 | `AuthorizationError` |
| 404 | `NotFoundError` |
| 429 | `RateLimitError` |
| 400 / 422 | `ValidationError` |
| 5xx | `ExternalServiceError` |
| timeout | `TimeoutError` |

Python tracebacks from Odoo are not returned to clients. Secrets are redacted.

### Security

- Credentials never go to React
- User-triggered calls use capability allowlist
- `odoo.read` / `odoo.write` independent of application login
- Copilot `searchOdooRecords` only works after you register capabilities; it is read + allowlist only
- Automation `callOdoo` writes need `odoo.write`, `allowDestructive: true` on the rule, and `confirmed: true` on the action

### How a future hackathon adds Odoo models

1. Leave `FEATURE_ODOO=false` until you have URL, database, and API key.
2. Fill `ODOO_BASE_URL`, `ODOO_DATABASE`, `ODOO_API_KEY`. Set `FEATURE_ODOO=true` (or `ODOO_ENABLED=true`).
3. In `modules/problem/`, create an adapter with `createOdooModelAdapter({ model: 'your.model', service, readCapability, writeCapability })`.
4. Register capabilities (`odooReadCapability` / `odooWriteCapability` or a custom high-risk capability).
5. Expose only your problem HTTP routes; do not add a generic method proxy.
6. For user-triggered writes, use `execute()` with confirmation.
7. Mock tests with `createTestOdooClient` / stub `fetch`. CI must not call live Odoo.

### Tests

`odoo.client.test.ts`, `odoo.service.test.ts`, `odoo.schemas.test.ts`. Mocks only. Covered: successful read, validation, authz, timeout, Odoo error, pagination, mocked write, allowlist, confirmation.

### Limitations

- One Odoo database and API key per process
- JSON-2 named arguments only (Odoo 19+)
- Each JSON-2 call is its own Odoo transaction
- No blind caching of mutable records
- API keys expire; rotate `ODOO_API_KEY` operationally
- Older XML-RPC servers are out of scope

### Extension points

`createOdooModelAdapter`, capability registry, problem services. Adding another Odoo version protocol would be a dedicated change, not a silent XML-RPC fallback.

---

## 15. AI

Details: [ai.md](ai.md), [ai-guardrails.md](ai-guardrails.md). Code: `backend/src/integrations/ai/`.

### Purpose

Provider-agnostic LLM service plus a reusable intelligence toolkit (summarize, classify, extract, analyze, recommend, draft, embed). Controllers call `AIService`. They never import a vendor SDK or contain prompt strings.

AI is advisory, not authoritative truth. Output is never executed as SQL, code, shell, or Odoo methods.

### Dependencies

`FEATURE_AI` or `AI_ENABLED`. Permission `ai.use` (manager and admin by default). Optional Redis does not gate AI.

### Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `AI_ENABLED` / `FEATURE_AI` | `false` (`.env.example` sets true) | Either enables AI |
| `AI_PROVIDER` | `gemini` | `gemini` or `mock` |
| `AI_MODEL` | unset → `gemini-2.5-flash` for Gemini | Optional override |
| `GEMINI_API_KEY` | unset | Server-side only |
| `AI_TIMEOUT_MS` | `30000` | Provider abort |
| `AI_MAX_OUTPUT_TOKENS` | `4096` | |
| `AI_TEMPERATURE` | `0.2` | `0`–`2` |
| `AI_MAX_RETRIES` | `2` | Extra attempts after the first |
| `AI_RETRY_BASE_MS` | `200` | Backoff base |

Production requires `GEMINI_API_KEY` when AI is on with Gemini. `AI_PROVIDER=mock` in production only with demo mode allowed.

When `DEMO_MODE` or `NODE_ENV=test` and Gemini has no key, runtime falls back to **mock**.

### Provider abstraction

```text
Controller → AIService → AiProvider (gemini | mock | new-provider)
                         → Gemini REST POST /v1beta/models/{model}:generateContent
```

Adding a vendor: new file under `providers/`, one factory case in `create-provider.ts`, optional new `AI_PROVIDER` enum value. Controllers stay unchanged. There is no `@google/genai` package; the kit uses REST.

### Prompts

Versioned templates live under `backend/src/integrations/ai/prompts/` (`id` + `version`, currently `v1`, catalog `AI_PROMPT_CATALOG`). Each prepends a safety preamble. User/document content is wrapped in `UNTRUSTED DATA` fences. To change behavior, add `v2` beside `v1` and point the catalog at it. Problem-specific prompts belong in `modules/problem/` and should still call `generateStructured()` with a local Zod schema.

HTTP bodies do **not** accept `system`, `model`, or `messages[].role = "system"`. Those stay on `AIService` for trusted backend callers. A spoofed `system` string cannot replace the canonical safety preamble.

### Structured output and validation

Structured results are extracted as JSON and parsed with Zod (`parseAiOutput`). Invalid output is rejected, with **one parse retry**. Action-oriented calls should use `generateDecision()` / HTTP `schemaName: "decision"`:

```json
{ "result": {}, "confidence": 0.0, "evidence": [], "requiresReview": false }
```

Confidence below `0.6` forces `requiresReview: true` even if the model claimed otherwise.

HTTP `POST /ai/structured` only exposes built-in schemas `insight` and `decision`. Trusted backend code may pass any Zod schema to `generateStructured()`. Clients cannot send executable schemas.

Extract HTTP callers select `schemaName` (`fields`, `entities`, `actionItems`) or a field identifier list.

### Retries, timeouts, rate limits

- Provider retries: `AI_MAX_RETRIES` (default 2), exponential backoff `AI_RETRY_BASE_MS`
- Timeouts: `AI_TIMEOUT_MS` (default 30s)
- HTTP rate limit category **AI**: default 20 / 1m per user on `/ai/*`, `/copilot/*`, `/intents/*`, `/rag/*`, `/anomalies/*`

### Caching

There is no general LLM response cache in this kit. Optional Odoo **read** cache is a different feature. RAG stores embeddings, not raw completions.

### Guardrails

See [ai-guardrails.md](ai-guardrails.md). Pipeline:

```text
User → authentication → authorization
  → input limits (100,000 chars) + secret redaction + untrusted fencing + injection-signal logging
  → provider (timeout + retries)
  → output schema validation
  → review policy
  → tool allowlist + permission + confirmation
  → approved handler
  → audit (no secrets)
```

Forbidden tool names include `executeSql`, `shell`, and `fetch`. High-risk tools need application `confirmed: true`; `confirm` inside tool arguments is ignored.

Logs record `operation`, `provider`, `model`, `requestId`, `latencyMs`, prompt `id`/`version` — not API keys, prompt text, or documents.

### Tool calling

Shared executor `executeAiTool`. Copilot and intents use it. Register tools with `name`, `requiredPermission`, `inputSchema`, `riskLevel`, `handler`. See [§17](#17-ai-copilot) and [§35 intents](#natural-language-actions-intents).

### Document analysis

See [§16](#16-ai-document-intelligence). Uploaded text is fenced as untrusted data before `AIService.extract()`.

### Public HTTP API

Prefix `/api/v1`. Bearer + `ai.use`:

| Method | Path | Description |
| --- | --- | --- |
| GET | `/ai/health` | Provider connectivity |
| POST | `/ai/generate` | `generateText()` |
| POST | `/ai/structured` | `generateStructured()` (`insight` or `decision`) |
| POST | `/ai/summarize` | summary, keyPoints, actions |
| POST | `/ai/classify` | category, priority, sentiment, confidence |
| POST | `/ai/extract` | fields / entities / actionItems |
| POST | `/ai/analyze` | findings, risks, sentiment, priority |
| POST | `/ai/recommend` | suggestions with evidence |
| POST | `/ai/draft` | always `requiresReview: true` |
| POST | `/ai/embed` | numeric vector (`gemini-embedding-001` unless overridden) |

`content` is preferred; `text` is an alias on several routes. Recommend accepts `context` or `content`.

### Example usage

```ts
const ai = createAiService({ config, logger });
await ai.summarize({ content, style: 'brief', length: 'short' });
await ai.classify({ content, labels: ['delivery_delay', 'billing'] });
await ai.extract({ content, fields: ['orderId', 'eta'] });
```

Mock provider for tests:

```ts
const provider = new MockAiProvider();
provider.enqueue('{"category":"billing","priority":"low","sentiment":"neutral","confidence":0.4,"reason":"invoice mismatch"}');
```

### Failure cases

Provider failure, timeout, 429 → mapped app errors. Malformed JSON / schema mismatch → rejected. Low confidence is still HTTP success; callers must treat `confidence` as a review signal. Missing extract fields set `requiresReview`.

### Tests

Success, provider failure/timeout/rate limit, malformed JSON, missing fields, low confidence, drafts always require review, Gemini HTTP mapping with fake `fetch`, guardrails tests (injection, forbidden tools, confirmation bypass, redaction).

### Limitations

Guardrails cannot guarantee a model will never produce misleading text that still matches a schema. Staff/user lack `ai.use` by default. Copilot, intents, RAG, and anomaly are separate modules/flags.

### Extension points

New capability sequence in [ai.md](ai.md): prefer existing endpoints → Zod schema → versioned prompt → `AIService` method → HTTP only if I/O is distinct → teach mock provider → mock tests → document.

---

## 16. AI document intelligence

Details: [documents.md](documents.md).

### Purpose

Upload PDF/PNG/JPEG/TXT, validate, store the original, extract text or send bytes multimodally, run schema-validated `AIService.extract()`, persist extraction separately from the source.

### Dependencies

AI enabled. StorageService. Jobs (`document.process`, alias `document.analyze`). Permissions `documents.analyze` / `documents.read` (manager and admin by default).

### Configuration

| Variable | Default |
| --- | --- |
| `DOCUMENT_MAX_BYTES` | `10485760` |
| `DOCUMENT_MAX_TEXT_CHARS` | `100000` |
| `DOCUMENT_CONFIDENCE_THRESHOLD` | `0.7` |
| `DOCUMENT_ASYNC_THRESHOLD_BYTES` | `1048576` |
| `STORAGE_PROVIDER` | `local` |

Requires AI. Mock the provider in tests and demo mode.

### How it works

```text
Upload → MIME/extension/size/filename/magic-byte validation
  → store original (StorageService)
  → persist documents row
  → extract text or multimodal bytes
  → UNTRUSTED DATA fence
  → AI extract
  → confidence / missing-field review
  → document_extractions row
  → optional document.analyzed / notifications
```

Large files or `async=true` enqueue `document.process`.

Supported: `.pdf`, `.png`, `.jpg`/`.jpeg`, `.txt` with matching MIME and magic bytes.

### Public interface / API

| Method | Path | Permission |
| --- | --- | --- |
| POST | `/api/v1/documents/analyze` | `documents.analyze` |
| GET | `/api/v1/documents/:id` | `documents.read` |

Multipart fields: `file` (required), `documentType` (required: `invoice`, `receipt`, `certificate`, `application`, `form`, `contract`, `report`, `generic`), optional `fields` JSON array, optional `async`.

Background jobs return HTTP **202** with `status: "processing"`. Poll GET. `needs_review` means extraction finished but a human should check. Callers only see their own documents.

### Example usage

Upload an invoice PDF as `documentType=invoice`. Override field list with `fields`. Do not execute extracted values as SQL or Odoo methods.

### Failure cases

Empty/oversized file, unknown type, MIME mismatch, path traversal in filename, AI failure, malformed AI output, low confidence (`requiresReview`).

### Tests

Valid upload, unsupported/oversized file, AI failure, malformed output, low confidence, background retry. Mock AI. Do not treat extracted fields as ground truth.

### Limitations

PDF text extraction is best-effort; image-only or encrypted PDFs go multimodal. Multi-host workers need Redis and shared object storage.

### Extension points

Allowlists in `document.types.ts` plus magic-byte checks. Problem-specific field lists in `modules/problem/` or the `fields` override.

---

## 17. AI Copilot

Details: [copilot.md](copilot.md).

### Purpose

Controlled assistant: the model proposes **allowlisted** tools; the backend authenticates, authorizes, validates, optionally confirms, executes a registered handler, and audits. Not a generic ChatGPT clone.

### Dependencies

`FEATURE_COPILOT` plus a ready AI provider (`FEATURE_AI` / `AI_ENABLED`). Permission `copilot.use`. `DEMO_MODE` registers demo tools.

### Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `FEATURE_COPILOT` | `false` (`.env.example` true) | HTTP + UI |
| `FEATURE_AI` / `AI_ENABLED` | off unless set | Still required at runtime |

### How it works

```text
User message → authenticate + copilot.use
  → AI planner (structured JSON)
  → tool allowlist → RBAC → input schema
  → confirmation when high-risk
  → handler → assistant reply → audit
```

Planner may propose at most **three** tools per turn. Client does not supply the tool list. Confirmation consumes a single-use pending record (`confirm: true`). A second confirm is rejected.

### Public interface / API

| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/v1/copilot/tools` | Allowlisted tools |
| POST | `/api/v1/copilot/chat` | Message or confirm |
| GET | `/api/v1/copilot/conversations` | List threads |
| GET | `/api/v1/copilot/conversations/:id` | Thread + messages |
| POST | `/api/v1/copilot/conversations/:id/clear` | Delete messages, keep id |
| DELETE | `/api/v1/copilot/conversations/:id` | Delete thread |

Chat body: `{ "message", "conversationId?", "confirm?" }`. Status: `completed`, `pending_confirmation`, `error`.

Built-in tools (when the matching service exists): `listNotifications`, `createNotification`, `generateReport`, `summarizeDocument`, `getDocument`, `searchOdooRecords`, `searchKnowledge` (RAG on), `searchRecords` (search on), `queryAnalytics` (analytics on), `detectAnomaly` (anomaly on).

Demo tools (`DEMO_MODE`): `getCustomer`, `searchOrders`, `getInvoice`, `deleteRecord` (high-risk).

UI: http://localhost:5173/copilot (`CopilotChat` in `frontend/src/ui/ai`).

### Example usage

Sign in as demo admin, open `/copilot`, ask to look up customer `cust-1001` (demo catalog). Confirm before `deleteRecord`.

### Failure cases

Unauthorized tool, invalid arguments, AI failure, tool failure (no secret leakage), confirmation required, missing `FEATURE_COPILOT` → 404 `FEATURE_DISABLED`.

### Tests

Normal question, tool invocation, unauthorized/invalid args, destructive confirmation, AI/tool failure, HTTP authz, clear conversation.

### Limitations

Demo catalog is in-memory. Staff/user lack `copilot.use` by default. `searchOdooRecords` needs registered Odoo capabilities.

### Extension points

`registry.register` from `modules/problem` (or extra tools into `createDefaultCopilotRegistry`). Names such as `executeSql`, `shell`, `fetch` are rejected.

---

## 18. Automation

Details: [automation.md](automation.md), [scheduler.md](scheduler.md).

### Purpose

Generic **trigger → condition → action** workflows. Hackathons register a trigger, optionally an operator, and an action, then create a rule. They do not modify engine internals.

### Dependencies

`FEATURE_AUTOMATION`. Jobs (`automation.execute`). Event bus. Optional scheduler. Permissions `automations.read` / `write` / `execute`.

### Configuration

| Variable | Default |
| --- | --- |
| `FEATURE_AUTOMATION` | `false` (`.env.example` true) |
| `SCHEDULER_ENABLED` | follows automation |
| `SCHEDULER_INTERVAL` | `1m` |
| `SCHEDULER_POLL` | `1s` |

### How it works

```text
Trigger  →  Condition  →  Action
```

```text
Event → EventBus
  → enabled rules for that trigger (priority, then createdAt)
  → declarative conditions (no JavaScript)
  → idempotent execution row (ruleId + eventId)
  → job automation.execute
  → ordered actions (RBAC, schema, destructive policy)
  → retries, status, audit
```

**Example:** trigger `invoice.overdue` → condition `daysOverdue > 7` → action `sendEmail` / `sendNotification`.

Core events when the flag is on: `user.created`, `document.uploaded`, `report.completed`, `anomaly.detected` (if anomaly on). Registered for problem modules to emit: `order.*`, `invoice.overdue`, `scheduled`, `webhook.received`.

Scheduler emits `scheduled` with `payload.schedule` (default `tick`). `eventId` is `scheduled:{name}:{slot}`.

Conditions operators: `equals`, `notEquals`, `greaterThan`, `lessThan`, `greaterOrEqual`, `lessOrEqual`, `contains`, `in`, `exists`. Field paths are dotted identifiers. `__proto__` is rejected. Arbitrary JavaScript is never evaluated.

Built-in actions:

| Type | Permission | Destructive |
| --- | --- | --- |
| `sendEmail` | `notifications.write` | no |
| `sendNotification` | `notifications.write` | no |
| `generatePDF` | `reports.generate` | no |
| `queueAIAnalysis` | `ai.use` | no |
| `callOdoo` | `odoo.read` (writes need `odoo.write`) | writes only |
| `createAuditLog` | `automations.write` | no |
| `enqueueJob` | `automations.execute` | no (allowlisted job names) |
| `webhook` | `automations.execute` | yes (SSRF-safe HTTPS; mocked in demo) |
| `updateRecord` | `automations.write` | yes (registered updaters only) |

Creating a rule requires the caller to hold every action’s permission. Destructive actions need `allowDestructive: true`. Odoo writes also need `confirmed: true` on the action. AI-generated rules (`source: "ai"`) are stored disabled; validate, then enable.

Execution status: `queued` → `running` → `succeeded` | `failed`. Succeeded actions are not re-run on retry.

### Public interface / API

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/api/v1/automations/catalog` | `automations.read` |
| GET/POST | `/api/v1/automations/rules` | read / write |
| GET/PATCH | `/api/v1/automations/rules/:id` | read / write |
| POST | `/api/v1/automations/rules/:id/validate` | write |
| POST | `/api/v1/automations/rules/:id/enable` | write |
| POST | `/api/v1/automations/rules/:id/disable` | write |
| GET | `/api/v1/automations/executions` | read |
| GET | `/api/v1/automations/executions/:id` | read |
| POST | `/api/v1/automations/events` | `automations.execute` |
| POST | `/api/v1/automations/webhooks` | `automations.execute` |

UI: http://localhost:5173/automations.

### Example usage

```json
{
  "name": "Remind late invoices",
  "trigger": "invoice.overdue",
  "enabled": true,
  "conditions": [{ "field": "daysOverdue", "operator": "greaterThan", "value": 7 }],
  "actions": [{ "type": "sendEmail", "template": "invoice-reminder", "toField": "email" }]
}
```

Emit from a problem service: `events.emit({ type: 'inventory.low', id, payload })`.

### Failure cases

Disabled rule skipped. Duplicate `(ruleId, eventId)` skipped. Missing action permission at execution. Invalid rule schema. Actorless scheduled Odoo writes still need `confirmed`.

### Tests

Matching, non-matching, disabled, failure, retry, idempotency, authorization, invalid rules, AI validation, HTTP catalog/create/403.

### Limitations

`updateRecord` does nothing until a resource updater is registered (`demo.invoice` in demo mode). Outbound webhooks are mocked when `DEMO_MODE=true`.

### Extension points

`registries.triggers.register`, `registries.actions.register`, `registries.operators.register`, `registries.recordUpdaters.register`, `registries.allowedJobs.allow`. Do not add SQL, shell, eval, or arbitrary HTTP/Odoo-method actions.

Scheduler: `scheduler.register({ name, intervalMs | cron, trigger? })` or `createApp({ schedules })`.

---

## 19. Background jobs

Details: [jobs.md](jobs.md). Worker: `backend/src/worker.ts` (also `npm run dev:workers`).

### Purpose

Enqueue expensive work from services. Controllers must not drain queues. Poll `GET /api/v1/jobs/:jobId` for sanitized status.

### Dependencies

Optional Redis (BullMQ). File queue without Redis. Production requires Redis. `JOBS_PROCESS` (default `true`) controls whether this process registers consumers.

### Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `JOB_MAX_ATTEMPTS` | `3` | |
| `JOB_BACKOFF_MS` | `200` | Exponential backoff base |
| `JOB_TIMEOUT_MS` | `60000` | Per-attempt timeout |
| `JOBS_PROCESS` | `true` | Compose: `false` on API, `true` on worker |

Local `npm run dev` leaves `JOBS_PROCESS` unset so the API still consumes jobs if you are not running workers.

### Queues (backends)

| Condition | Backend | Shared across processes? |
| --- | --- | --- |
| `REDIS_URL` set | BullMQ queue `hackathon` | Yes |
| `REDIS_URL` unset (not tests) | File queue under `backend/job-queue` | Yes, same machine |
| Tests without `jobsDir` | In-memory | No |

### Job names

`email.send`, `sms.send`, `pdf.generate`, `report.generate`, `ai.analyze`, `document.process` (`document.analyze` alias), `rag.index`, `anomaly.evaluate`, `odoo.sync`, `cleanup`, `notification.dispatch`, `automation.execute`.

### Retries

Configurable attempts, exponential backoff, per-attempt timeout. **Not retried:** validation, authentication, authorization, not-found, conflict. `odoo.sync` rejects write methods. Destructive work should set `retryable: false` when enqueueing.

### Idempotency

Pass `jobId` to skip a duplicate that is already queued, processing, or completed. Email (and similar) also use `IdempotencyStore` so retries do not send twice.

### Job status

`GET /api/v1/jobs/:jobId` requires `jobs.read`. Returns `jobId`, `type`, `status`, `attempts`, timestamps, sanitized `error`, `progress` (0–100). Never includes payload or `createdBy`.

Statuses: `queued`, `processing`, `completed`, `failed`, `retrying`.

Jobs enqueued with `userId` or `createdBy` are visible to that user and to `admin`. Others get 404. Jobs without an owner (email, SMS, cleanup) stay readable by anyone with `jobs.read`.

Staff, manager, and admin receive `jobs.read` by default.

### Public interface

```bash
npm run dev:workers
```

Docker Compose `worker` service after Postgres, Redis, and API are healthy.

### Example usage

Async document analyze or report generate returns `jobId`. Poll the jobs endpoint. Attach request ID via `withRequestId` (queue does this on enqueue). Validate payloads with Zod inside the handler.

### Failure cases

Closed queue, handler throw, timeout → `failed` or `retrying`. Non-retryable errors fail immediately.

### Tests

In-memory enqueue/success/failure/retry/timeout/duplicate `jobId`/cleanup/shutdown. File-queue sharing. HTTP status API. BullMQ when Redis is up.

### Limitations

File queue is one machine. Production must use Redis. Interrupted file-queue jobs recover on worker boot.

### Extension points

Register a new job name in the worker and API processor lists, then allow it in automation `allowedJobs` if rules should enqueue it. Payload validation in the handler.

---

## 20. Notifications

Details: [notifications.md](notifications.md).

### Purpose

Multi-channel notifications: in-app, email, SMS, push, webhook. Application logic must not import vendor SDKs.

### Dependencies

Database for inbox. Email/SMS adapters when those channels are used. Job `notification.dispatch`. `FEATURE_NOTIFICATIONS` controls extra side effects (for example document-analysis alerts); inbox HTTP still works when the database is configured.

### Configuration

See email/SMS env groups. Preferences categories: `order_updates`, `security_alerts`, `reports`, `marketing`, `system`. `security_alerts` cannot be disabled.

### How it works

```text
Business Event → NotificationService.sendNotification()
  → preference check + template render → Channel Adapter → Provider
```

Delivery status: `queued` → `processing` → `sent` | `failed` | `retrying`. High/critical often deliver inline. Idempotency via `idempotencyKey`.

Templates: `generic`, `welcome`, `document-analyzed`, `order-updated`, `invoice-reminder`, `security-alert`, `report-ready`, `marketing`. `{{field}}` interpolation.

### Public interface / API

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/api/v1/notifications` | `notifications.read` |
| GET | `/api/v1/notifications/unread-count` | read |
| GET | `/api/v1/notifications/preferences` | read |
| PUT | `/api/v1/notifications/preferences` | read |
| GET | `/api/v1/notifications/deliveries/:id` | write |
| POST | `/api/v1/notifications/send` | write |
| POST | `/api/v1/notifications` | write (legacy in-app) |
| POST | `/api/v1/notifications/:id/read` | read |
| POST | `/api/v1/notifications/read-all` | read |

UI: http://localhost:5173/notifications.

### Example usage

```ts
await notifications.sendNotification({
  channel: 'email',
  recipient: { userId, email },
  template: 'order-updated',
  data: { orderId: 'A-1', status: 'shipped' },
  idempotencyKey: 'order.updated:A-1',
});
```

### Failure cases

Disabled preference, invalid recipient, provider failure (other channels unaffected), duplicate idempotency key returns existing delivery.

### Tests

Valid send, provider failure, retry, disabled preference, invalid recipient, duplicate key. Mock providers.

### Limitations

Push default is an in-memory mock. Webhooks mocked in demo/test.

### Extension points

Register templates; add a `ChannelAdapter` + provider. Do not import Twilio into `NotificationService`.

---

## 21. Email

Details: [email.md](email.md).

### Purpose

Transactional email via `EmailService`. Job `email.send`.

### Dependencies

Optional. `EMAIL_ENABLED`. Providers: `smtp`, `resend`, `brevo`, `mock`.

### Configuration

| Variable | Notes |
| --- | --- |
| `EMAIL_ENABLED` | default `false` |
| `EMAIL_PROVIDER` | default `smtp` |
| `EMAIL_FROM` / `SMTP_FROM` | required in production when enabled |
| `SMTP_HOST` / `SMTP_PORT` | required for smtp |
| `RESEND_API_KEY` / `BREVO_API_KEY` | required for those providers in production |

Demo mode never delivers real mail. `EMAIL_PROVIDER=mock` in production only with demo mode.

### How it works

`send` / `sendEmail` with template or subject+text. `{ async: true }` enqueues. `idempotencyKey` skips a second deliver. `generateEmailContent()` drafts from **verified facts**; `requiresReview` is always true; secrets are not sent to the model.

Templates: `welcome`, `verification`, `password-reset`, `otp`, `notification`, `report-ready`, `alert`.

### Public interface

No dedicated `/email` HTTP route. Used by OTP, notifications, reports, automation.

### Example usage

```ts
await email.send({ to, subject, template, variables }, { async: true });
```

### Failure cases

Disabled email, missing From, provider timeout. Delivery failure deletes OTP challenge when used as OTP channel.

### Tests

Mock provider only. Do not call real SMTP/Resend/Brevo in CI.

### Limitations

No Mailhog container.

### Extension points

New template files under `backend/src/integrations/email/templates`. New provider implementing the email provider interface.

---

## 22. OTP

Details: [otp.md](otp.md).

### Purpose

Hashed one-time passcodes for login, verification, and password reset. Codes are never returned by the API and must not be logged.

### Dependencies

`FEATURE_OTP`. Email and/or SMS. KV (Redis or memory).

### Configuration

| Variable | Default |
| --- | --- |
| `FEATURE_OTP` | `false` (`.env.example` true) |
| `OTP_PROVIDER` | `auto` (`auto` or `mock`) |
| `OTP_DIGITS` | `6` (4–8) |
| `OTP_TTL` | `10m` |
| `OTP_MAX_ATTEMPTS` | `5` |
| `OTP_RESEND_COOLDOWN` | `60s` |
| `OTP_HASH_SECRET` | falls back to `JWT_ACCESS_SECRET` |

HMAC-SHA256 hashed storage. Rate limits per destination and IP.

### How it works

Request → generate digits → hash → store → deliver (email/SMS/mock). Verify consumes the challenge. Unknown emails still get a success envelope on request (no mail) so accounts are not enumerated. `purpose: "login"` issues JWTs for an existing active user. Accounts are never created from OTP.

### Public interface / API

`POST /api/v1/auth/otp/request` and `/otp/verify`. Password reset uses dedicated auth routes with `purpose: "password-reset"`.

### Example usage

```json
{ "destination": "ada@example.com", "channel": "email", "purpose": "login" }
```

### Failure cases

Incorrect/expired/reused code, too many attempts, resend cooldown, disabled account, provider failure (challenge deleted).

### Tests

Valid/incorrect/expired/reused, attempts, throttling, provider failure, HTTP rate limits, login OTP does not enumerate emails.

### Limitations

In-memory KV is per process without Redis. Mock providers may hold codes in process memory for tests.

### Extension points

SMS via `SmsProvider`, not Twilio inside `OtpService`.

---

## 23. File upload

Upload is part of Storage plus document intelligence. Middleware: `backend/src/middleware/file-upload.ts`, `document-upload.ts`.

### Purpose

Validated multipart uploads (Multer memory storage, one file). Client MIME is ignored; type comes from content and extension.

### Dependencies

Storage module. Rate limit category **upload**: 10 / 15m per user.

### Configuration

`STORAGE_MAX_BYTES` (files), `DOCUMENT_MAX_BYTES` (documents). `REQUEST_BODY_LIMIT` does not replace upload caps.

### How it works

Reject empty/oversized files, path traversal (`..`, `/`, `\`, NUL), unsupported extensions, magic-byte mismatches.

`purpose` on file upload: `attachment` (default), `avatar`, `export`, `document`, `report`.

### Public interface

`POST /api/v1/files` (`files.write`) and `POST /api/v1/documents/analyze` (`documents.analyze`).

### Failure cases

Oversized, malicious filename, MIME mismatch → validation error. Unauthenticated → 401.

### Tests

`backend/tests/security.http.test.ts` (oversized uploads, malicious filenames). Storage and document tests.

### Limitations

Memory storage for the incoming buffer; persist via StorageService.

### Extension points

Purpose allowlists in storage validation. New document types in document allowlists.

---

## 24. Storage

Details: [storage.md](storage.md).

### Purpose

Object bytes behind `StorageService`. Never call `@aws-sdk/client-s3` or filesystem paths from controllers or problem modules.

### Dependencies

Local disk and/or PostgreSQL `stored_objects` / `stored_files`. S3 when enabled.

### Configuration

| Variable | Default |
| --- | --- |
| `STORAGE_PROVIDER` | `local` (`local`, `s3`, `postgres`) |
| `STORAGE_LOCAL_DIR` | `storage` (relative to **backend package**) |
| `STORAGE_MAX_BYTES` | `10485760` |
| `STORAGE_SIGNED_URL_EXPIRES` | `300` seconds |
| `STORAGE_SIGNING_SECRET` | dedicated HMAC; required in production |
| `AWS_*` | required in production when S3 is on |
| `FEATURE_S3` | `false` |

`local` dual-writes to PostgreSQL when a database is configured so workers on another host can read objects.

### How it works

`put` / `get` / `delete` / `signDownload` for objects. `upload` / `download` / `getSignedUrl` for file records. S3 uses private objects and presigned GET. Local/postgres signed URLs: HMAC `GET /api/v1/storage/download?key=&expires=&sig=` (possession of the URL is the capability; keep TTL short).

### Public interface / API

| Method | Path | Permission |
| --- | --- | --- |
| POST | `/api/v1/files` | `files.write` |
| GET | `/api/v1/files/:id` | `files.read` |
| GET | `/api/v1/files/:id/content` | `files.read` |
| POST | `/api/v1/files/:id/url` | `files.read` |
| DELETE | `/api/v1/files/:id` | `files.write` |
| GET | `/api/v1/storage/download` | HMAC signature (no session) |

Callers only see their own files unless they have `admin.settings`. Storage keys are not returned on upload/get.

User, staff, manager, and admin receive `files.read` / `files.write` by default.

### Example usage

PDF and document pipelines store under relative keys (`documents/{userId}/…`, `reports/…`, `pdfs/…`).

S3 migration steps (including `aws s3 sync`) are in [storage.md](storage.md) — that AWS CLI command is an operator step, not an npm script.

### Failure cases

Missing file 404. Invalid signature on HMAC download. S3 credential failure in production if S3 is enabled.

### Tests

Upload, invalid/oversized, delete, missing, signed URL, mocked S3. CI uses local or in-memory store.

### Limitations

Local disk is not shared across hosts without dual-write, postgres provider, or a shared volume. HMAC downloads are unauthenticated by design.

### Extension points

New `StorageProvider` implementation selected from config.

---

## 25. PDF / report generation

Details: [pdf.md](pdf.md), [reports.md](reports.md).

### Purpose

Low-level PDF renderer (`pdf-lib`) and higher-level `ReportService` with templates, async jobs, storage, and optional notification/email.

### Dependencies

`FEATURE_PDF` (default **true**) for HTTP. Storage. Job `pdf.generate` / `report.generate`. Permission `reports.generate`.

### Configuration

`FEATURE_PDF=false` disables PDF/report HTTP. Jobs and automation can still render PDFs.

### How it works

```text
Report request → data provider (verified facts) → template → renderer
  → StorageService → job status + optional notification/email
```

AI narrative is stored and rendered in a labeled block. It must not overwrite verified facts.

Built-in types: `simple`, `table`, `summary`, `document`.

Default HTTP generate is **202** queued when a job queue is available. `options.async: false` for tiny documents/tests.

### Public interface / API

| Method | Path | Permission |
| --- | --- | --- |
| POST | `/api/v1/pdf/generate` | `reports.generate` |
| GET | `/api/v1/reports/types` | `reports.generate` |
| POST | `/api/v1/reports/generate` | `reports.generate` |

Simple PDF body: `{ title, sections, async? }`. Report body: `{ type, data, options }`.

### Example usage

Queue a table report; poll `GET /api/v1/jobs/:jobId`. Register problem templates from `modules/problem` via `createDefaultReportRegistry()` and `createApp({ reportRegistry })`.

### Failure cases

Missing required data, renderer/storage failure, RBAC 403. Notification/email failure does not delete the stored PDF.

### Tests

Simple/table reports, missing data, renderer/storage/job failure, fact/narrative separation, HTTP 202 and RBAC.

### Limitations

Bar charts are small-series SVG-like drawings in pdf-lib, not a charting library. Problem layouts must not live in the reusable core.

### Extension points

`registerTemplate` + `registerDataProvider`. Do not import `pdf-lib` from `modules/problem`.

---

## 26. Security

Details: [security.md](security.md). This kit is a **baseline**, not a claim that the app is fully secure.

### Purpose

HTTP hardening, secrets handling, RBAC, rate limits, SSRF checks, AI/Odoo guardrails, file validation.

### JWT

See [§11](#11-authentication). Separate access/refresh secrets, short access TTL, rotation, reuse detection, optional access denylist on logout, version bump after password reset.

### RBAC

See [§12](#12-rbac). Backend is authoritative.

### Secrets

- Do not commit `.env`, key files, or `credentials.json` (`.gitignore` excludes them)
- Production refuses to start without required secrets
- `npm run security:secrets` scans tracked files
- `npm run security:audit` runs `npm audit --omit=dev --audit-level=high`
- GitHub Actions uses repository Secrets/Variables; workflows do not hardcode credentials
- Logger redacts passwords, tokens, API keys, OTPs
- Frontend must never receive Odoo/AI/SMTP/storage/JWT secrets

### Rate limiting

`RATE_LIMIT_ENABLED` default true. Redis when configured, else memory.

| Category | Default | Typical routes |
| --- | --- | --- |
| Public | 60 / 1m IP | unauthenticated `/api/v1` |
| Authentication | 20 / 15m IP | register, refresh, logout |
| Login brute force | 5 / email and 20 / IP per 15m | login |
| OTP | 5 / destination and 20 / IP per 15m | OTP |
| Password reset | 5 / email and 20 / IP per 15m | reset |
| Authenticated | 120 / 1m user | Bearer APIs |
| Admin | 30 / 1m user | RBAC catalog |
| AI | 20 / 1m user | AI family |
| Upload | 10 / 15m user | files and documents |

Health/readiness are not rate-limited.

### Odoo credentials

Server-only. Capability allowlist for user-triggered calls. See [§14](#14-odoo).

### AI guardrails

Schema validation, fencing, tool allowlists, confirmation, redaction, audit. See [§15](#15-ai).

### File security

Magic-byte checks, path-safe names, private S3, short signed URLs. User-bound HMAC downloads require matching auth (`uid`). Links without `uid` prove URL possession. `STORAGE_SIGNING_SECRET` is required in production and is never the JWT secret.

### Other HTTP controls

Helmet CSP `default-src 'none'`, frame deny, nosniff, HSTS in production. CORS allowlist only (`CORS_ORIGINS`; `*` rejected). Body size limit. `TRUST_PROXY` defaults to false; set `1` only behind a proxy that overwrites `X-Forwarded-For`. Cookie-only mutations need a trusted Origin.

User-controlled URLs (notification/automation webhooks): http/https, no embedded credentials, ports 80/443, block private/loopback/metadata, DNS check, `redirect: 'error'`, timeout. Operator-configured Odoo/SMS/email URLs may target private hosts for on-prem hackathons.

### Failure cases / residual risks

Documented in [security.md](security.md): SSRF pinning residual, in-memory stores in dev/test, SPA XSS vs cookies, ungated Odoo **read** helpers, dependency advisories (Prisma CLI `deepmerge-ts` high; react-router moderate). Do not `npm audit fix --force` if that downgrades Prisma. This kit is not fully secure.

### Tests

`backend/tests/security.http.test.ts` and `backend/src/security/*.test.ts`.

### Limitations

Treat as hackathon/MVP baseline; review against the problem threat model before production.

### Extension points

`secureCookieOptions()` exists for a later httpOnly-cookie session. Do not disable rate limits or demo mocks on a real tenant.

---

## 27. Audit logs

Details: [audit.md](audit.md).

### Purpose

Durable, redacted audit events in PostgreSQL `audit_events`. A failed audit persist must not fail the original action.

### Dependencies

Database. Permission `audit.read` (admin full catalog; manager has it by default).

### Configuration

No dedicated env vars. Request ID from `x-request-id`.

### How it works

`AuditService.record` redacts then writes. List via API.

Example actions: `user.login`, `user.created`, `odoo.record.created` / `updated`, `ai.generate`, `copilot.tool`, `intent.execute`, `file.uploaded`, `report.generated`, `notification.sent`, `automation.execute`, `rag.index` / `rag.ask`, `anomaly.evaluate`.

Never store passwords, raw JWTs, API keys, or OTP values.

### Public interface / API

`GET /api/v1/audit` — query `page`, `pageSize` (max 100), `actorId`, `action`, `resource`, `resourceId`, `requestId`, `from`, `to`. Pagination in `meta`.

### Example usage

Copilot and intents already write tool/intent attempts. Hackathons may add problem-specific action names.

### Failure cases

Missing `audit.read` → 403. Persist failure is logged, not thrown to the user.

### Tests

Redaction, list API RBAC, example domain writes.

### Limitations

Metadata is stored in a `request` JSON column for compatibility.

### Extension points

`AUDIT_ACTIONS` constants in `backend/src/constants`. Call `AuditService.record` from problem services.

---

## 28. Testing

Details: [testing.md](testing.md).

### Purpose

Unit, integration, and API e2e without paid SaaS. A feature is not complete until success **and** main failure modes are tested.

### Dependencies

Vitest 3, Supertest, jsdom (frontend). Postgres for DB/e2e. Optional Redis.

### Configuration

Copy `.env.test.example` to `.env.test`. `AUTH_BCRYPT_COST=4`. `DEMO_MODE=true`. AI mocked. Optional `REDIS_URL`.

### How it works

| Layer | Where | Externals |
| --- | --- | --- |
| Unit | `backend/src/**/*.test.ts`, `frontend/src/**/*.test.tsx`, `workers/src/**/*.test.ts` | None |
| Integration | `backend/tests/**/*.test.ts` | Local Postgres, optional Redis |
| E2E | `backend/tests/e2e/**/*.test.ts` | Postgres; mock AI/email/SMS |

`fileParallelism` is off in backend Vitest so Prisma tests do not share a truncated database.

Mocks: `MockAiProvider`, test Odoo client, `MockEmailProvider`, `MockSmsProvider`, `MockOtpProvider`, `MemoryFileStore`, mock push/webhook. Import `backend/tests/mocks`.

Factories: `build*` (plain objects) and `create*` (persist) in `backend/tests/factories`.

### Public interface / commands

```bash
npm test
npm run test:unit
npm run test:integration
npm run test:watch
npm run test:coverage
npm run test:e2e

npm test -w backend
npm run test:watch -w frontend
npm run test:coverage -w workers

cp .env.test.example .env.test
npm run db:test:prepare
```

There is **no** Playwright or Cypress in this kit. E2E is API-level (register, authorize, automate, notify, audit).

### Example usage

`describeDatabase` / `describeRedis` skip when URLs are unset. `npm run test:e2e` fails loudly if Postgres is missing.

### Failure cases

CI must not set `GEMINI_API_KEY`, `ODOO_API_KEY`, SMTP passwords, or AWS keys.

### Tests of the test infra

Compose/Dockerfile structure tests without starting containers. Env catalog test keeps `.env.example` aligned with `envSchema`.

### Limitations

Browser e2e is not in the core kit. Coverage HTML is gitignored. CI does not fail on a global coverage percentage.

### Extension points

Problem-specific tests under `modules/problem/` or that module’s `*.test.ts`. CI already runs workspace tests.

---

## 29. CI/CD

Details: [ci-cd.md](ci-cd.md).

### Purpose

Reusable GitHub Actions: verify every PR and `main`/`master` push; optionally build images and deploy without hardcoding a cloud vendor.

### Dependencies

GitHub-hosted `ubuntu-24.04`. Service containers: `postgres:16-alpine`, `redis:7-alpine`. Node from `.nvmrc`.

### Configuration

GitHub **Variables** and **Secrets** listed in [environment.md](environment.md) and [ci-cd.md](ci-cd.md). Do not put application JWT/Odoo/AI keys in workflow YAML.

Dependabot (`.github/dependabot.yml`) opens weekly PRs for npm, Actions, Dockerfiles, and Compose.

### How it works

**CI** (`.github/workflows/ci.yml`):

- Triggers: pull requests, pushes to `main` / `master`, `workflow_call`
- Jobs: **Verify** (`npm ci`, migrate, lint, typecheck, unit+coverage, integration, e2e, secret scan, `npm audit`, frontend/backend builds) and **Docker build validation**
- Artifacts: `ci-reports-<run_id>` (14 days)
- PR concurrency cancels older runs; `main` does not cancel (CD needs a finished CI)
- Permissions: `contents: read` only

**CD** (`.github/workflows/cd.yml`):

- Manual **Run workflow** (`environment` staging/production, `ref` commit/tag/branch, `skip_verify`)
- Or auto after CI on `main`/`master` when `CD_AUTO_DEPLOY=true` (targets `CD_AUTO_ENVIRONMENT`, default staging, not production)
- Sequence: reusable CI → production images → registry push (default GHCR) → deploy hook → health check
- Image tags: `sha-<7 char rev>` (immutable) and `<environment>` (moving)
- Worker = backend image + command `worker`
- `DEPLOY_PROVIDER`: `none` (default, registry is the release), `webhook`, or `command`
- Rollback: redeploy last good SHA; no automatic database rollback; Prisma is forward-only

### Public interface

GitHub Actions UI. Scripts: `infra/scripts/deploy.mjs`, `healthcheck.mjs`, `smoke.mjs`.

### Example usage

Open a PR → CI. Merge to `main` → CI again. **Actions → CD → Run workflow** after configuring registry (and optionally deploy provider).

### Failure cases

Audit may continue on error unless `AUDIT_CONTINUE_ON_ERROR=false`. Compose failures upload `docker-compose-logs-<run_id>`. Webhook/command deploys require a health or ready URL.

### Tests

CI is the test. Local: `npm run lint`, `typecheck`, `test`, `build`, `docker:smoke`.

### Limitations

No Fly/ECS/ACA/Kubernetes manifests in reusable workflows. Encode the vendor in `DEPLOY_COMMAND` or a webhook owned by the hackathon.

### Extension points

`.nvmrc`, extra CI steps, registry vars, `DEPLOY_COMMAND`, Environment required reviewers for production.

---

## 30. Feature flags

Details: [features.md](features.md).

### Purpose

Env-based flags so a hackathon enables only what the problem needs. No remote flag SaaS. Server evaluation is authoritative. Frontend `GET /api/v1/features` is UX only.

### Dependencies

None. Copilot/intents/RAG still need a ready AI provider at runtime; the flag does not silently enable AI.

### Configuration

See [§7](#7-environment-variables). Helpers: `isFeatureEnabled()`, `isDemoMode()`, `requireFeature()` (404 `FEATURE_DISABLED`), `shouldMockExternalIntegrations()`.

### How it works

Missing flags default false except `FEATURE_PDF`. Frontend `FeatureProvider` hides nav; `/copilot`, `/intents`, `/rag`, `/anomalies`, `/realtime`, `/automations` show empty state if opened while disabled. API still rejects disabled modules.

### Public interface

`GET /api/v1/features` — public `{ demoMode, features }`, no secrets.
`GET /api/v1/capabilities` — public capability catalog and optional project profiles (metadata only; see docs/capabilities.md and docs/profiles.md). Use `resolveCapabilities` or `resolveProfiles` in `backend/src/capabilities` to validate a module set; neither enables flags nor generates a project.

### Example usage

```bash
FEATURE_ODOO=true
FEATURE_AI=true
FEATURE_AUTOMATION=true
FEATURE_PDF=true
FEATURE_SMS=false
```

### Failure cases

Unknown flag name → false. Disabled module HTTP → 404 `FEATURE_DISABLED`.

### Tests

Enabled/disabled/missing/unknown, demo vs production, features snapshot, frontend `FeatureGate`.

### Limitations

Process-wide, not per-tenant. Restart after changes.

### Extension points

Add a name to the registry in `backend/src/features` and `.env.example`, then gate routes with `requireFeature`.

---

## 31. Demo mode

Details: [features.md](features.md). Template: `.env.demo.example`.

### Purpose

Safe local/judged demo: mock outbound providers, optional demo users, no accidental real mail/SMS/Odoo writes invented by the kit.

### Dependencies

`DEMO_MODE` defaults **true** when `NODE_ENV` is not `production`.

### Configuration

| Variable | Default |
| --- | --- |
| `DEMO_MODE` | true outside production |
| `ALLOW_DEMO_IN_PRODUCTION` | `false` — never on a real tenant |

Production refuses mock AI/email/SMS/OTP unless demo mode is allowed that way.

### How it works

When on:

- Seed may create demo users (`demo-password`, `@example.com` only)
- Email never leaves the process
- SMS never hits a real gateway
- OTP uses mock adapter
- AI may fall back to mock when no Gemini key
- Automation webhooks, copilot demo tools, and intent demo handlers stay in-process

When off (including production): demo-user seed is skipped; RBAC catalog seed still runs.

### Public interface

`GET /api/v1/features` includes `demoMode`.

### Example usage

```bash
cp .env.demo.example .env
```

Sets `AI_PROVIDER=mock`, `EMAIL_PROVIDER=mock`, `SMS_PROVIDER=mock`, `OTP_PROVIDER=mock`, Odoo off.

### Failure cases

Enabling demo on a real production tenant. Empty JWT secrets. Enabling Odoo without a real server (health fails).

### Tests

Demo resolver and production refusals in config/feature tests.

### Limitations

Demo tools/intents use in-memory catalogs. Reduce realism; must never be enabled on a real tenant without an explicit decision.

### Extension points

`shouldMockExternalIntegrations(config)` in new providers.

---

## 32. Troubleshooting

From [prerequisites.md](prerequisites.md) and [getting-started.md](getting-started.md).

| Symptom | Likely cause | What to do |
| --- | --- | --- |
| `engines` / unexpected Node | Node 20 or 22 | Install Node 24 (`.nvmrc` is `24`) |
| unexpected npm | npm 10 or Yarn/pnpm | Use npm 11 that ships with Node 24 |
| `npm ci` fails | Wrong package manager or not repo root | Use npm at repository root |
| `docker: command not found` or Compose v1 | Engine missing or `docker-compose` V1 | Install Docker; `docker compose` v2.24+ |
| Cannot connect to daemon | Docker Desktop/WSL not running | Start Docker and wait |
| `ECONNREFUSED` on `localhost:5432` | Host Node using in-container port | Use `localhost:5433` |
| `ECONNREFUSED` on 5433 / 6379 | Stores not started | `npm run deps:up` |
| `/ready` HTTP 503 | Configured dependency down | Check Compose; disable unused Odoo/AI |
| Login 503 / missing JWT | Empty `JWT_*` | Copy placeholders from `.env.example` |
| `hackathon_test` missing | Old volume | `docker exec hackathon-postgres createdb -U postgres hackathon_test` |
| Port already allocated | Another process or Compose project | Stop the other stack; macOS AirPlay vs 5000 |
| Prisma cannot connect | `.env` not at repo root | Backend scripts load **root** `.env` |
| AI “not ready” | No Gemini key and mock not selected | `.env.demo.example`, or set key, or `AI_PROVIDER=mock` with `DEMO_MODE=true` |
| Odoo health fails | Flags on without Odoo 19 | Leave `FEATURE_ODOO=false` until configured |
| Postgres crash loop on Windows | `docker-data/postgres` locked | Stop Compose; exclude folder from antivirus |
| Tests skip DB/Redis | URLs unset | `.env.test` + `db:test:prepare`; uncomment `REDIS_URL` |
| HTTP 502 from frontend nginx | Stale backend IP | Frontend image re-resolves `backend` via Docker DNS; recreate stack if needed |
| Feature UI empty | Flag off | Check `GET /api/v1/features` and `.env` |
| 403 on AI/Odoo | Role lacks permission | Use demo admin, or grant `ai.use` / `odoo.read` |
| Do not run Compose + `npm run dev` together | Port clash | Pick one workflow |

Quality checks when something “works locally but CI fails”:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run security:secrets
```

---

## 33. Future hackathon reuse

**DealFlow360 demo order:** [README.md](../README.md#demo-workflow). This section is the setup and wiring checklist.

The reusable core should remain generic. Do not modify reusable modules unless the change is a genuine reusable improvement.

### Module selection

1. Read the official problem statement ([PROBLEM_STATEMENT.md](../PROBLEM_STATEMENT.md)).
2. Identify required capabilities from [HACKATHON_MODULES.md](../HACKATHON_MODULES.md).
3. Map them to [capabilities.md](capabilities.md). Optional [project profiles](profiles.md) can suggest a starting set; they do not replace flags.
4. Enable only relevant `FEATURE_*` flags.
5. Put problem code under `modules/problem/`.

Suggested mapping:

| Problem need | Module / flag |
| --- | --- |
| Login, users, roles | Auth + RBAC (always on with database) |
| ERP / Odoo data | `FEATURE_ODOO` + adapters in `modules/problem` |
| Summarize / classify / extract | `FEATURE_AI` |
| Upload invoices/PDFs | Document intelligence + storage |
| Chat assistant | `FEATURE_COPILOT` + registered tools |
| “Do X from a sentence” | `FEATURE_INTENTS` |
| Problem statement → spec | `FEATURE_PROBLEM_INTELLIGENCE` |
| Structured spec → advisory modules | `FEATURE_CAPABILITY_RECOMMENDATIONS` |
| Problem → validated Project Configuration | `FEATURE_PROJECT_PLANNING` |
| Approved configuration → isolated overlay | `FEATURE_PROJECT_GENERATOR` |
| Search policies by meaning | `FEATURE_RAG` (optional, off by default) |
| Search records by keyword / full-text | `FEATURE_SEARCH` (optional, PostgreSQL; not Elasticsearch) |
| KPIs, time-series, dashboards, exports | `FEATURE_ANALYTICS` (optional, PostgreSQL; not a warehouse) |
| Spike detection on metrics | `FEATURE_ANOMALY_DETECTION` (optional) |
| Live job / inbox / dashboard status | `FEATURE_REALTIME` (optional SSE; poll REST otherwise) |
| If X then email/notify | `FEATURE_AUTOMATION` + scheduler |
| SMS OTP | `FEATURE_OTP` + `FEATURE_SMS` |
| Private S3 | `FEATURE_S3` / `STORAGE_PROVIDER=s3` |
| PDFs | `FEATURE_PDF` (on by default) |

### Exact reuse procedure

#### 1. Clone starter

```bash
git clone <repository-url>
cd DealFlow360
```

Keep the generic core. Prefer a fork or a long-lived starter remote plus a hackathon branch (see [§34](#34-git)).

#### 2. Create a new branch

```bash
git checkout -b <your-branch-name>
```

CI runs on pull requests. Default-branch CI watches `main` and `master`. This repo does not enforce a branch naming scheme.

#### 3. Copy the official problem statement

Fill in [PROBLEM_STATEMENT.md](../PROBLEM_STATEMENT.md):

- problem, users, actors, pain points
- current and proposed workflows
- functional and non-functional requirements
- Odoo modules and models
- new application entities
- AI, automation, notification, reporting, file/document needs
- external integrations
- authentication, authorization, security
- expected output and success criteria

#### 4. Analyze requirements

List users, workflows, data, integrations, and demo script. Separate **reusable kit capabilities** from **problem-specific rules**.

#### 5. Map requirements to modules

Use the table above and [capabilities.md](capabilities.md). Do not enable RAG, anomaly, SMS, or S3 unless the problem needs them.

#### 6. Select required modules

Set flags in `.env` (and production secrets on the host). Restart after changes. Confirm `GET /api/v1/features`.

#### 7. Create a problem-specific module

Under `modules/problem/` (see `modules/problem/README.md` and [problem-module.md](problem-module.md)):

```text
modules/problem/
  src/<domain>/       services, routes, jobs, permissions
  frontend/           pages + nav/routes
```

Do **not** put authentication, Odoo clients, AI providers, or generic notifications here.

Typical work:

- Problem services and HTTP routes registered through `host.mount` / `host.http`
- Prisma models + problem repositories if new tables are required
- RBAC keys on `problemModule.permissions`
- Copilot tools and intent handlers (allowlisted, with permissions and confirmation)
- Automation triggers/actions/updaters
- Report templates and data providers
- React pages exported from `modules/problem/frontend`

#### 8. Configure integrations

- Odoo: URL, database, API key, capabilities, adapters
- AI: Gemini key or mock for demo; problem prompts + Zod schemas
- Email/SMS/S3 only if the demo or production path needs them
- Never put secrets in the frontend

#### 9. Build the workflow

Wire the main user journey: UI → `/api/v1` → service → repository/adapter → job if slow → notification. Keep controllers thin.

#### 10. Test

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

Cover success, invalid input, authz failure, provider failure, malformed AI output, idempotency. Mock paid APIs. Put problem tests next to problem code.

#### 11. Deploy

Optional: GitHub Actions CD ([§29](#29-cicd)). Set production secrets on the host (`DATABASE_URL`, `REDIS_URL`, JWT, and enabled integrations). `SEED_ON_START` is usually `false` in production. Run `npm run db:migrate` and `npm run db:seed` (catalog only if `DEMO_MODE=false`). Configure CORS and `FRONTEND_URL` / `APP_URL`. Do not set `ALLOW_DEMO_IN_PRODUCTION` on a real tenant.

#### 12. Demo

- Copy `.env.demo.example` for a judged laptop demo
- Seed demo users; sign in as `demo.admin@example.com` / `demo-password`
- Prepare a short script: login → main workflow → one AI or Odoo screen → one automation or report
- Confirm `/health` and `/ready`
- Do not depend on live paid APIs if the network is unreliable — use mock providers

Final architecture/security pass: keep secrets server-side, RBAC on destructive routes, AI output untrusted, Odoo allowlisted.

---

## 34. Git

This repository does **not** ship `CONTRIBUTING.md`, Husky, commitlint, or a GitHub Release workflow. The following is what the repo actually encodes.

### `main` / `master`

CI (`.github/workflows/ci.yml`) runs on:

- every **pull request**
- **push** to branches named `main` or `master`

CD auto-deploy (`workflow_run`) also listens to CI completion on `main` and `master`. Protect the default branch on GitHub if you want required reviews; that is a GitHub setting, not a file in this kit.

There is no git hook that blocks direct commits to `main`.

### Feature branches

Implied workflow: create a branch, open a pull request, let CI verify, merge to the default branch. PR CI concurrency **cancels** older runs for the same PR. Pushes to `main` do **not** cancel, so CD can see a finished CI.

Dependabot opens weekly PRs (npm, Actions, Docker, Compose). Treat those like feature PRs.

[VERSIONING_POLICY.md](VERSIONING_POLICY.md): breaking upgrades (Node, Prisma, React majors) **must stay on a branch** and update engines, Docker, CI, docs, and tests together.

### Hackathon branches

[README.md](../README.md) reuse step: “Create a new branch.” There is no required prefix (`hackathon/…` is not enforced). Use one branch (or fork) per problem so the reusable core on `main` stays generic.

Keep problem-specific code in `modules/problem/` even on a hackathon branch so later merges back to the starter stay possible.

### Commits

No conventional-commit check in CI. Write commits that explain **why**. Do not commit `.env`, keys, or `credentials.json`. `npm run security:secrets` and the secrets-scan CI step look for committed private keys and assigned provider secrets.

### Tags / releases

- CD manual dispatch `ref` accepts a **commit SHA, tag, or branch** (workflow input description in `cd.yml`).
- Published **container** tags are `sha-<7 char rev>` and the moving environment name (`staging` / `production`), not automatically created git tags.
- There is no workflow that runs `git tag` or publishes npm packages (`private: true`, version `0.1.0`).
- Production deploys should prefer image digest or `sha-<rev>` over floating Docker majors ([VERSIONING_POLICY.md](VERSIONING_POLICY.md)).
- Rollback is “deploy last good git SHA / image tag”, not `git revert` of the database.

If you want GitHub Releases, add that in the hackathon fork; it is not part of this kit.

---

## 35. Additional modules

These are READY in the capability catalog but were not in the numbered 1–33 list.

### Foundation

[foundation.md](foundation.md). Configuration, health/readiness, graceful shutdown, API version at `GET /api/v1`, lint/test/build tooling. Does not implement auth/AI/Odoo.

### Project profiles

[profiles.md](profiles.md). Optional composable capability sets (Basic Web, AI Application, …). They inherit via `includes` and never replace `FEATURE_*`. Cloud-Native / Offline-Resilient are metadata only — they do not add Kubernetes or a PWA. Real-Time includes optional SSE (`FEATURE_REALTIME`); it does not add WebSockets.

### Observability

[observability.md](observability.md). Pino structured logs (`requestId`, `jobId`, `module`, duration). Optional `MetricsSink` and `ErrorTracker` (no vendor required). Health/readiness stay outside `/api/v1`.

### SMS

[sms.md](sms.md). `SmsService`; providers `mock` and `http`. Job `sms.send`. `FEATURE_SMS` / `SMS_ENABLED`. E.164 `to`. Demo never hits a real gateway.

### Scheduler

[scheduler.md](scheduler.md). Clock in the API process. Emits `scheduled` (or a registered trigger). Does not run SQL or shell. `SCHEDULER_INTERVAL=0s` skips the default tick.

### Natural-language actions (intents)

[intents.md](intents.md). One-shot command pipeline: utterance → one registered intent → schema → permission → optional confirmation → handler.

| Method | Path |
| --- | --- |
| GET | `/api/v1/intents` |
| POST | `/api/v1/intents/execute` |

`FEATURE_INTENTS` + AI. Permission `intents.use`. High-risk classes: `DELETE`, `BULK_UPDATE`, `SEND_EXTERNAL_MESSAGE`, `FINANCIAL_ACTION`. UI: http://localhost:5173/intents. Forbidden intent names include `EXECUTE_SQL`, `SHELL`, `FETCH`.

### Problem statement intelligence

[problem-intelligence.md](problem-intelligence.md). Problem statement → schema-validated spec → catalog classification (existing capability vs new problem logic). The model cannot execute tools, SQL, Odoo, HTTP, or filesystem access.

| Method | Path |
| --- | --- |
| POST | `/api/v1/problem-intelligence/analyze` |

`FEATURE_PROBLEM_INTELLIGENCE` + AI. Permission `problem.analyze`. UI: http://localhost:5173/problem-intelligence. Hallucinated catalog names are not treated as existing capabilities. Unknowns stay `unknown` instead of invented facts.

### Capability recommendations

[capability-recommendations.md](capability-recommendations.md). Structured analysis → deterministic advisory capabilities, profiles, adapters, infrastructure, architecture and deployment modes. Does not call AI, enable `FEATURE_*`, or add Kafka/Elasticsearch/Kubernetes.

| Method | Path |
| --- | --- |
| POST | `/api/v1/capability-recommendations/recommend` |

`FEATURE_CAPABILITY_RECOMMENDATIONS`. Permission `capabilities.recommend`. UI: http://localhost:5173/capability-recommendations. Human selection remains authoritative.

### Project planning

[project-planning.md](project-planning.md). Problem statement → human capability/profile/mode selection → backend-validated Project Configuration. Does not generate code or enable `FEATURE_*`.

| Method | Path |
| --- | --- |
| POST | `/api/v1/project-planning/analyze` |
| POST | `/api/v1/project-planning/validate` |
| POST | `/api/v1/project-planning/approve` |

`FEATURE_PROJECT_PLANNING`. Permission `projects.plan`. UI: http://localhost:5173/project-planning. Frontend selections are not trusted.

### Project generator

[project-generator.md](project-generator.md). Approved Project Configuration → isolated overlay under `generated/` (core record, selected capabilities/adapters, problem module, tests, docs). Does not modify kit source, write the kit `.env`, or install AI-suggested packages.

| Method | Path |
| --- | --- |
| POST | `/api/v1/project-generator/preview` |
| POST | `/api/v1/project-generator/generate` |

`FEATURE_PROJECT_GENERATOR`. Permission `projects.generate`. UI: http://localhost:5173/project-generator. The backend re-validates the approved object.

### Optional RAG

[rag.md](rag.md). Off unless `FEATURE_RAG=true`. Chunk → embed → vector store (memory or Postgres JSON, **no pgvector required**) → retrieve → grounded answer with sources. If nothing clears `minScore`, the model is **not** called.

| Method | Path |
| --- | --- |
| POST | `/api/v1/rag/index` |
| GET | `/api/v1/rag/documents/:id` |
| DELETE | `/api/v1/rag/documents/:id` |
| POST | `/api/v1/rag/search` |
| POST | `/api/v1/rag/ask` |

Permission `rag.use`. UI: http://localhost:5173/rag. Job `rag.index` for large texts.

### Optional search

[search.md](search.md). Off unless `FEATURE_SEARCH=true`. `SearchService` → PostgreSQL or memory. Keyword, filter, sort, pagination, full-text (`simple`), and short-query fuzzy (`pg_trgm`). Elasticsearch is **not** included; a future `SearchProvider` adapter can be added without changing application services.

| Method | Path |
| --- | --- |
| GET | `/api/v1/search/indexes` |
| POST | `/api/v1/search` |
| POST | `/api/v1/search/documents` |
| DELETE | `/api/v1/search/documents/:index/:documentId` |

Permissions `search.use` / `search.write`. UI: http://localhost:5173/search.

### Optional analytics

[analytics.md](analytics.md). Off unless `FEATURE_ANALYTICS=true`. `AnalyticsService` → PostgreSQL or memory. Registered KPI definitions, aggregations, time-series, dashboards, filters, and CSV/JSON export. Queries always require a KPI plus a bounded time range and use indexed `analytics_facts`. ClickHouse / BigQuery / Snowflake are **not** included; a future `AnalyticsProvider` adapter can be added without changing application services. Problem-specific metrics are registered from `modules/problem`, not core.

| Method | Path |
| --- | --- |
| GET | `/api/v1/analytics/kpis` |
| GET | `/api/v1/analytics/dashboards` |
| GET | `/api/v1/analytics/dashboards/:name` |
| POST | `/api/v1/analytics/dashboards/:name` |
| POST | `/api/v1/analytics/query` |
| POST | `/api/v1/analytics/export` |
| POST | `/api/v1/analytics/facts` |

Permissions `analytics.read` / `analytics.write` / `analytics.export`. UI: http://localhost:5173/analytics.

### Optional anomaly engine

[anomaly.md](anomaly.md). Off unless `FEATURE_ANOMALY_DETECTION=true`. Detection is statistical (threshold, percent change, moving average, frequency, trend, z-score). AI only explains. Evidence is never taken from the model. `claimsStatisticalSignificance` is always `false`.

| Method | Path |
| --- | --- |
| POST | `/api/v1/anomalies/evaluate` |
| GET | `/api/v1/anomalies` |
| GET | `/api/v1/anomalies/:id` |

Permission `anomaly.use`. UI: http://localhost:5173/anomalies. Emits `anomaly.detected` when automation is on.

### Optional real-time (SSE)

[realtime.md](realtime.md). Off unless `FEATURE_REALTIME=true`. Server-Sent Events for allowlisted job, notification, dashboard, automation, and document status. REST polling stays the default. Not WebSockets and not a separate service.

| Method | Path |
| --- | --- |
| GET | `/api/v1/realtime/channels` |
| GET | `/api/v1/realtime/events` |

Reuses `jobs.read`, `notifications.read`, `automations.read`, and `documents.read`. UI: http://localhost:5173/realtime.

### UI kit

[ui.md](ui.md). React + Tailwind primitives, AppShell, dashboard slots, AI surfaces, theme (`hsk.theme` in localStorage), toasts, API client. Gallery: http://localhost:5173/ui. Dashboard layout placeholder: http://localhost:5173/dashboard. Do not put business rules in `frontend/src/ui`.

---

## 36. Root npm scripts

From root `package.json` only. Do not assume other names exist.

| Script | What it runs |
| --- | --- |
| `npm run dev` | backend + frontend (concurrently) |
| `npm run dev:all` | backend + frontend + workers |
| `npm run dev:backend` | `tsx watch` API |
| `npm run dev:frontend` | Vite |
| `npm run dev:workers` | `tsx watch` `backend/src/worker.ts` |
| `npm run build` | all workspaces |
| `npm run start` | backend `node dist/index.js` only |
| `npm run lint` / `lint:fix` | workspaces |
| `npm run format` / `format:check` | Prettier |
| `npm run typecheck` | workspaces |
| `npm test` | workspaces |
| `npm run test:unit` / `test:integration` | workspaces |
| `npm run test:watch` | backend Vitest watch |
| `npm run test:coverage` | workspaces |
| `npm run test:e2e` | backend e2e config |
| `npm run security:secrets` | backend secret scan |
| `npm run security:audit` | `npm audit --omit=dev --audit-level=high` |
| `npm run deps:up` / `deps:down` | Compose postgres + redis |
| `npm run docker:up` / `down` / `logs` / `ps` / `smoke` | Compose helpers |
| `npm run db:generate` / `migrate` / `migrate:dev` / `seed` / `reset` / `test:prepare` | Prisma via backend |

Workspace-only (not root scripts): `npm run preview -w frontend`, `npm run start:worker -w backend`, `npm run dev:worker -w backend`.

CI/Docker use `npm ci` (not a root script; documented in workflows and Dockerfiles).

---

## 37. HTTP API index

Prefix `/api/v1` unless noted. Permissions are catalog keys. Flags gate many of these.

**Operational**

- `GET /health`
- `GET /ready`

**Public / auth**

- `GET /api/v1` — version metadata
- `GET /api/v1/features`
- `GET /api/v1/capabilities` — catalog, optional profiles, version constants
- `POST /api/v1/auth/register|login|refresh|logout`
- `GET /api/v1/auth/me`
- `POST /api/v1/auth/otp/request|verify`
- `POST /api/v1/auth/password-reset/request|confirm`

**RBAC / audit / jobs**

- `/roles`, `/permissions`, `/roles/:roleName/permissions`, `/users/:userId/roles`
- `GET /api/v1/audit`
- `GET /api/v1/jobs/:jobId`

**Integrations** (see module sections for auth and flags)

- `GET /api/v1/odoo/health`
- `/api/v1/ai/*`
- `/api/v1/documents/analyze`, `/api/v1/documents/:id`
- `/api/v1/files`, `/api/v1/storage/download`
- `/api/v1/pdf/generate`, `/api/v1/reports/*`
- `/api/v1/notifications/*`
- `/api/v1/copilot/*`
- `/api/v1/intents`, `/api/v1/intents/execute`
- `/api/v1/problem-intelligence/analyze`
- `/api/v1/capability-recommendations/recommend`
- `/api/v1/rag/*`
- `/api/v1/anomalies/*`
- `/api/v1/automations/*`

Envelopes: [api-conventions.md](api-conventions.md).

---

## 38. Frontend routes

From `frontend/src/App.tsx`:

| Path | Page | Flag gate |
| --- | --- | --- |
| `/` | Home | — |
| `/login` | Login | — |
| `/dashboard` | Dashboard layout placeholder | — |
| `/ui` | UI kit gallery | — |
| `/notifications` | Inbox | — |
| `/copilot` | Copilot | `FEATURE_COPILOT` |
| `/intents` | Actions | `FEATURE_INTENTS` |
| `/problem-intelligence` | Problem intelligence | `FEATURE_PROBLEM_INTELLIGENCE` |
| `/capability-recommendations` | Capability recommendations | `FEATURE_CAPABILITY_RECOMMENDATIONS` |
| `/project-planning` | Project planning | `FEATURE_PROJECT_PLANNING` |
| `/project-generator` | Project generator | `FEATURE_PROJECT_GENERATOR` |
| `/rag` | RAG | `FEATURE_RAG` |
| `/search` | Search | `FEATURE_SEARCH` |
| `/analytics` | Analytics | `FEATURE_ANALYTICS` |
| `/anomalies` | Anomalies | `FEATURE_ANOMALY_DETECTION` |
| `/realtime` | Realtime | `FEATURE_REALTIME` |
| `/automations` | Automations | `FEATURE_AUTOMATION` |

Vite dev server (port **5173**) proxies `/api`, `/health`, and `/ready` to `API_PROXY_TARGET` (default `http://localhost:5000`).

---

## Related documentation

Full index: [docs/README.md](README.md).

Engineering rules for agents and contributors: [AGENTS.md](../AGENTS.md).
