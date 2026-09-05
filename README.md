# DealFlow360

DealFlow360 is a quotation-to-cash operations workspace for a hackathon demo: live discounts, risk explanation, approval chains, warehouse splits, hybrid billing, and a token-isolated customer portal.

It is built on this repository’s reusable starter kit (auth, RBAC, PostgreSQL/Prisma, optional Odoo/AI adapters, jobs, Docker, CI). DealFlow business logic lives in `modules/problem/`. The reusable platform stays generic.

**New teammate?** Start with [Manual Project Setup](#manual-project-setup) below.

Full kit catalog: [docs/SETUP_MANUAL.md](docs/SETUP_MANUAL.md). Software and accounts: [docs/prerequisites.md](docs/prerequisites.md). Versions: [docs/VERSION_MATRIX.md](docs/VERSION_MATRIX.md). Environment catalog: [docs/environment.md](docs/environment.md). Demo workflow: [Manual Project Setup](#demo-workflow).

---

# Manual Project Setup

Instructions for a teammate who has just received this repository. Use **npm only** (`package.json` `packageManager` is `npm@11.6.2`; `.npmrc` sets `engine-strict=true`). Do not use Yarn, pnpm, or Bun.

## Prerequisites

Install these on the laptop. Versions come from `package.json` `engines`, `.nvmrc`, Dockerfiles, and Compose — not from marketing pages.

| Software | Version in this repo | Required? |
| --- | --- | --- |
| Git | Unspecified — any current Git that can clone HTTPS/SSH | Yes |
| Node.js | `^24` (`.nvmrc` is `24`) | Yes |
| npm | `^11` (`packageManager` `npm@11.6.2`) | Yes (ships with Node 24) |
| Docker Engine + Compose **v2.24+** | Compose `include` / `env_file.required` | Yes for the documented path |
| Web browser | Unspecified | Yes |

Docker provides **PostgreSQL 16** (`postgres:16-alpine`) and **Redis 7** (`redis:7-alpine`). Do not install native Postgres, Redis, Yarn/pnpm/Bun, Playwright, or a local Odoo unless you are deliberately leaving the documented path.

Confirm:

```bash
git --version
node -v
npm -v
docker version
docker compose version
```

Expect Node `v24.x` and npm `11.x`.

Odoo is **optional** and **off** in `.env.example` (`FEATURE_ODOO=false`). A live Odoo 19 JSON-2 server is not required to run DealFlow360.

## Repository Structure

```text
frontend/              React + Vite + Tailwind (port 5173)
backend/               Express API, TypeScript (port 5000)
workers/               Background job worker (same backend image)
packages/api-contract  Shared /api/v1 envelopes and feature names
database/              Prisma schema, migrations, seeds
infra/                 Compose Postgres/Redis, nginx, healthchecks
docs/                  Operator and module documentation
modules/problem/       DealFlow360 backend + frontend (hackathon-specific)
.github/               CI/CD workflows
docker-compose.yml     Full local stack (includes infra compose)
```

DealFlow APIs: `/api/v1/dealflow`. Staff UI: `/dealflow`. Customer portal: `/portal/:token`.

## Environment Variables

1. Copy the template (never commit `.env`):

```bash
cp .env.example .env
```

PowerShell: `Copy-Item .env.example .env` (`cp` is usually an alias).

2. For a judged demo that stays on mock AI/email/SMS, you may copy `.env.demo.example` instead.

3. For backend tests, also copy `.env.test.example` → `.env.test`.

Authoritative catalog: [docs/environment.md](docs/environment.md). Do not put real secrets in the README or `*.example` files. Never prefix server secrets with `VITE_`.

### Application (required for local run)

| Variable | Local placeholder | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | |
| `PORT` | `5000` | API listen port |
| `FRONTEND_URL` | `http://localhost:5173` | CORS / links |
| `VITE_API_URL` | empty | Leave empty so Vite proxies `/api` to the API |
| `DEMO_MODE` | `true` | Seeds demo users; relaxes seeded login rate limits |

### Database

| Variable | Local placeholder | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5433/hackathon` | Host port **5433**, not 5432 |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `postgres` / `postgres` / `hackathon` | Compose interpolation only |

### Redis

| Variable | Local placeholder | Notes |
| --- | --- | --- |
| `REDIS_URL` | `redis://localhost:6379` | Required in production. Local Compose publishes 6379 |

### Authentication

| Variable | Local placeholder | Notes |
| --- | --- | --- |
| `JWT_ACCESS_SECRET` | 32+ character placeholder in `.env.example` | Required whenever `DATABASE_URL` is set |
| `JWT_REFRESH_SECRET` | 32+ character placeholder in `.env.example` | Same |

Generate your own for anything beyond local demo:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Odoo (optional — off by default)

| Variable | Local placeholder | Notes |
| --- | --- | --- |
| `FEATURE_ODOO` / `ODOO_ENABLED` | `false` | Keep false unless you have a real Odoo 19 |
| `ODOO_BASE_URL` | empty | Origin only, no `/json/2` suffix |
| `ODOO_DATABASE` | empty | Sent as `X-Odoo-Database` |
| `ODOO_API_KEY` | empty | Server-side Bearer token; never send to React |

### AI (optional)

| Variable | Local placeholder | Notes |
| --- | --- | --- |
| `FEATURE_AI` / `AI_ENABLED` | `true` in `.env.example` | Toolkit + copilot flags also default on for local demo |
| `AI_PROVIDER` | `gemini` | `gemini` or `mock` |
| `GEMINI_API_KEY` | empty | Leave empty for local demo |
| `AI_MODEL` | empty | Default Gemini model is `gemini-2.5-flash` when a key is set |

When `DEMO_MODE` is on and Gemini has no key, the API uses the **mock** AI provider. DealFlow360 pricing, approvals, fulfillment, and billing do **not** require a live LLM.

### Storage / email / SMS

| Variable | Local default | Required for DealFlow demo? |
| --- | --- | --- |
| `STORAGE_PROVIDER` | `local` | No |
| `STORAGE_SIGNING_SECRET` | placeholder in `.env.example` | Required in production |
| `EMAIL_ENABLED` | `false` | No |
| `FEATURE_SMS` / `SMS_ENABLED` | `false` | No |

### Feature flags that matter for this demo

Keep `FEATURE_ODOO=false` unless a real Odoo 19 is configured. Missing flags default **off** except `FEATURE_PDF` (defaults on). See `.env.example` and [docs/features.md](docs/features.md).

## Database Setup

PostgreSQL is the only primary database. Prisma is the only ORM. Use the root npm scripts (they wrap `backend` + the schema in `database/prisma/`).

1. Start Postgres (and Redis) via Compose:

```bash
npm run deps:up
```

Equivalent: `docker compose up -d postgres redis`.

2. Host URL must use port **5433** (`DATABASE_URL` in `.env.example`).

3. Apply migrations and seed:

```bash
npm run db:migrate
npm run db:seed
```

`npm install` already runs `prisma generate` (backend `postinstall`).

4. Seed creates RBAC, the DealFlow catalog (customers, products, warehouses, stock, policies, chains), and demo users when `DEMO_MODE` is on.

5. Destructive reset (drops the database, migrates, seeds):

```bash
npm run db:reset
```

6. After a DealFlow confirm that consumed Core Gateway stock, restore catalog quantities with `npm run db:seed` (seed now resets on-hand **and** reserved).

7. Verify: `GET http://localhost:5000/ready` after the API is up, or `docker exec hackathon-postgres pg_isready`.

Details: [docs/database.md](docs/database.md).

## Redis Setup

Redis is part of the documented local stack (BullMQ, cache, rate limits, OTP, idempotency).

```bash
npm run deps:up
```

Host: `127.0.0.1:6379`. `REDIS_URL=redis://localhost:6379`.

Inside full Compose, the API/worker override this to `redis://redis:6379`.

Verify: `docker exec hackathon-redis redis-cli ping` → `PONG`.

The API process can start without Redis for some paths, but `.env.example` sets `REDIS_URL`. If Redis is configured and down, `GET /ready` fails. Details: [docs/redis.md](docs/redis.md).

## Odoo Setup

**Do not install Odoo to run this demo.** `.env.example` has `FEATURE_ODOO=false` and `ODOO_ENABLED=false`. Confirmations stay local. The UI must not invent sale-order IDs.

If a teammate later connects a real server:

- Protocol in this repo: **Odoo 19** JSON-2 (`POST /json/2/<model>/<method>`). XML-RPC is out of scope.
- Set `FEATURE_ODOO=true`, `ODOO_ENABLED=true`, `ODOO_BASE_URL`, `ODOO_DATABASE`, `ODOO_API_KEY`.
- Create the API key in Odoo: **Preferences → Account Security → New API Key**. Use a dedicated bot user.
- Credentials stay on the server. React never receives the key. There is no generic “run any Odoo method” HTTP API.
- Probe (staff, permission `odoo.read`): `GET /api/v1/odoo/health`.
- `GET /ready` pings Odoo only when the integration is enabled.

Details: [docs/odoo.md](docs/odoo.md).

## AI Setup

AI is **optional** for the DealFlow golden path.

- Provider: `AI_PROVIDER=gemini` or `mock`.
- Key: `GEMINI_API_KEY` (server-only).
- Default model when using Gemini: `gemini-2.5-flash` if `AI_MODEL` is unset ([docs/VERSION_MATRIX.md](docs/VERSION_MATRIX.md)).
- Local/demo: leave the key empty with `DEMO_MODE=true` — runtime falls back to the mock provider ([docs/ai.md](docs/ai.md)).
- Features that use the toolkit (copilot, intents, problem intelligence) are flagged separately and are not required to quote, approve, fulfill, or bill.

Never put an API key in the frontend or in this README.

## Install Dependencies

From the repository root (the folder that contains this `package.json`):

```bash
npm install
```

This is an npm workspaces monorepo (`frontend`, `backend`, `workers`, `packages/api-contract`, `modules/problem`). One install from the root is enough. CI and Dockerfiles use `npm ci`.

## Run Backend

Requires `.env`, Postgres, Redis, migrations, and seed.

```bash
npm run dev:backend
```

- URL: http://localhost:5000
- Health: http://localhost:5000/health
- Ready: http://localhost:5000/ready
- API: http://localhost:5000/api/v1

Or run API + Vite together: `npm run dev`.

Workers (email/PDF/AI jobs) are optional for the DealFlow golden path:

```bash
npm run dev:workers
```

Without Redis, the API and worker can share a file queue; with `REDIS_URL` they share BullMQ.

## Run Frontend

```bash
npm run dev:frontend
```

- URL: http://localhost:5173
- Vite proxies `/api`, `/health`, and `/ready` to `API_PROXY_TARGET` (default `http://localhost:5000`)
- Leave `VITE_API_URL` empty for local hybrid

Sign-in UI: http://localhost:5173/login

## Run Complete Project

**Recommended (hybrid): Docker for Postgres/Redis, Node on the host.**

Terminal 1 — data stores:

```bash
npm run deps:up
npm run db:migrate
npm run db:seed
```

Terminal 2 — API + UI:

```bash
npm run dev
```

Open http://localhost:5173/login

Do not run `docker compose up --build` and `npm run dev` on the same ports at the same time.

**Alternative — full Compose** (API, worker, frontend, Postgres, Redis):

```bash
docker compose up --build
```

Compose migrates on API start and seeds when `SEED_ON_START=true`.

## Docker Setup

Supported commands from root `package.json` and `docker-compose.yml`:

```bash
npm run deps:up          # postgres + redis only
npm run deps:down        # stop those two
npm run docker:up        # docker compose up --build
npm run docker:down      # docker compose down
npm run docker:logs      # docker compose logs -f
npm run docker:ps        # docker compose ps
npm run docker:smoke     # node infra/scripts/smoke.mjs
```

| Service | Host |
| --- | --- |
| Frontend | http://localhost:5173 |
| API | http://localhost:5000 |
| Health / ready | http://localhost:5000/health · `/ready` |
| Postgres | `127.0.0.1:5433` |
| Redis | `127.0.0.1:6379` |
| Optional nginx profile | http://localhost:8080 (`docker compose --profile nginx up --build`) |

Images use multi-stage Alpine builds. Secrets stay in `.env` / `.env.example`, not Dockerfiles. Details: [docs/docker.md](docs/docker.md).

## Verification Checklist

- [ ] Repository available on disk (clone or copy of this project folder)
- [ ] Node 24 + npm 11
- [ ] `npm install` completed
- [ ] `.env` copied from `.env.example`
- [ ] Docker Postgres + Redis running (`npm run deps:up`)
- [ ] `npm run db:migrate` and `npm run db:seed`
- [ ] `GET /health` and `GET /ready` succeed
- [ ] Frontend at http://localhost:5173
- [ ] Login as `demo.staff@example.com` / `demo-password`
- [ ] `/dealflow` dashboard loads
- [ ] Quotations list loads
- [ ] Approval center opens (`/dealflow/approvals`)
- [ ] Customer portal opens (`/portal/df-demo-portal-token-northwind-0001` after seed)
- [ ] Odoo remains marked unavailable unless you configured a real server
- [ ] Optional: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`

Odoo connected: **skip** unless `FEATURE_ODOO=true` and credentials are set.

## Troubleshooting

Only issues that match this repository’s configuration:

| Symptom | What to check |
| --- | --- |
| `npm install` refuses Node/npm | `.npmrc` `engine-strict=true`. Use Node 24 and npm 11 |
| Database connection failed | `npm run deps:up`; `DATABASE_URL` host port **5433**; container `hackathon-postgres` healthy |
| Redis / `/ready` 503 | `docker exec hackathon-redis redis-cli ping`; `REDIS_URL=redis://localhost:6379` on the host |
| Prisma migrate failed | Postgres must be up first. Schema path is `database/prisma`. Use `npm run db:migrate`, not a global Prisma CLI |
| Port 5000 or 5173 in use | Stop the other `npm run dev` or `docker compose` stack |
| Frontend cannot reach API | Hybrid: keep `VITE_API_URL` empty. Confirm API on :5000. Vite proxies `/api` |
| CORS | `.env.example` allows `http://localhost:5173` and `http://localhost:8080` |
| Login “too many attempts” | Use a seeded demo email with `DEMO_MODE=true`, or wait out the 15-minute window |
| `demo.user` cannot open `/dealflow` | Expected. That account is a customer user. Use staff/manager/admin |
| Warehouse split looks empty | Confirm consumes Core Gateway stock (West 4 / East 3). Run `npm run db:seed` |
| Odoo health fails | Expected when `FEATURE_ODOO=false`. Do not invent sale orders |
| AI / Gemini errors | Leave `GEMINI_API_KEY` empty with `DEMO_MODE=true`, or set `AI_PROVIDER=mock` |
| Tests need a database | `Copy-Item .env.test.example .env.test` then `npm run db:test:prepare` |

## Demo Workflow

Seeded password for all demo accounts: `demo-password`.

| Email | Use for |
| --- | --- |
| `demo.staff@example.com` | Create, submit, fulfill, bill, confirm |
| `demo.manager@example.com` | Sales Manager approval only |
| `demo.admin@example.com` | Finance and Final (admin may act on any step) |
| `demo.user@example.com` | Customer account — **not** the staff workspace |

Seeded portal token: `df-demo-portal-token-northwind-0001` → `/portal/df-demo-portal-token-northwind-0001`

Golden path:

1. Login as **staff** → Dashboard → New quotation → Northwind Retail.
2. Add **Core Gateway × 8 @ 16%** and **Control Suite × 1 @ 16%**.
3. Discount / Risk: requested vs allowed vs variance, why, who (Sales Manager → Finance → Final).
4. Submit. Staff cannot approve (API 403).
5. Manager approves. Admin approves Finance, then Final.
6. Add recommended Edge Sensor Pack.
7. Accept suggested split: West 4, East 3, backorder 1. Available = on-hand − reserved.
8. Generate billing. One-time and recurring are separate. The API does not collect payments.
9. Copy portal link (or the seeded token). Customer raises discount to **22%**.
10. Material change invalidates prior approvals and opens a new chain.
11. Manager + admin approve again. Staff confirms locally (no Odoo sale order).
12. Activity/audit on a manager or admin session.

If you confirm another qty-8 hardware quote, run `npm run db:seed` before repeating the split.

---

# Starter kit reference

Reusable capabilities (auth, RBAC, Odoo adapter, AI toolkit, jobs, Docker, CI) remain in `backend/`, `frontend/`, `workers/`, and `docs/`. Do not move DealFlow rules into those folders.

| Topic | Doc |
| --- | --- |
| A–Z kit manual | [docs/SETUP_MANUAL.md](docs/SETUP_MANUAL.md) |
| Prerequisites | [docs/prerequisites.md](docs/prerequisites.md) |
| Fresh-machine checklist | [docs/FRESH_SETUP_CHECKLIST.md](docs/FRESH_SETUP_CHECKLIST.md) |
| Architecture | [ARCHITECTURE.md](ARCHITECTURE.md) |
| Problem module boundary | [docs/problem-module.md](docs/problem-module.md) |
| Testing | [docs/testing.md](docs/testing.md) |
| Security | [docs/security.md](docs/security.md) |
| CI/CD | [docs/ci-cd.md](docs/ci-cd.md) |

Quality checks (from repo root):

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Unit/HTTP tests mock Odoo, AI, email, SMS, and storage. Postgres integration tests need `DATABASE_URL`; Redis/BullMQ tests need `REDIS_URL`. E2E: `npm run db:test:prepare` then `npm run test:e2e`.

---

# Security

Never commit API keys, passwords, JWT secrets, Odoo keys, SMTP passwords, or cloud keys. `.gitignore` excludes `.env`, `.env.test`, key material, and `credentials.json`. Production refuses to start without required secrets.

Odoo and Gemini credentials are backend-only.

```bash
npm run security:secrets
npm run security:audit
```

---

# License

See the repository license/notice files. Third-party dependencies remain under their own licenses.
