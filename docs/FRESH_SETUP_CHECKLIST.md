# Fresh setup checklist

Use this page as a new-developer reproduction of the documented happy path. Authoritative catalogs stay in [prerequisites.md](prerequisites.md), [environment.md](environment.md), [VERSION_MATRIX.md](VERSION_MATRIX.md), and [SETUP_MANUAL.md](SETUP_MANUAL.md). If this page and those files disagree, the catalogs plus the code win.

**Last reproduction:** 2026-08-30 (Windows 10, existing clone of this repository, hybrid + Compose). **Result: PASS.**

---

## 1. Required software

Install on the laptop (do not install native PostgreSQL or Redis unless you skip Docker):

| Software | Classification |
| --- | --- |
| Git | Mandatory |
| Node.js 24 | Mandatory |
| npm 11 (ships with Node 24) | Mandatory |
| Docker Engine + Compose v2 plugin | Mandatory |
| Web browser | Mandatory |

Docker provides PostgreSQL 16 and Redis 7. Do not install Python, Yarn/pnpm/Bun, Playwright/Cypress, a local Odoo, Kubernetes, or global Prisma/TypeScript/Vite CLIs.

---

## 2. Required versions

Confirm before clone. Sources: `package.json` `engines`, `.nvmrc`, Dockerfiles, Compose, CI.

| Component | Expect |
| --- | --- |
| Node.js | `v24.x` (`engines.node` `^24`; `.nvmrc` is `24`) |
| npm | `11.x` (`engines.npm` `^11`; `packageManager` `npm@11.6.2`) |
| Docker Compose | **v2.24+** (`docker compose version`, not `docker-compose` V1) |
| PostgreSQL | **16** (`postgres:16-alpine`) via Compose |
| Redis | **7** (`redis:7-alpine`) via Compose |
| Prisma | npm dependency Prisma 6 (not a separate installer) |

```bash
git --version
node -v
npm -v
docker version
docker compose version
```

`.npmrc` sets `engine-strict=true`. Node 20/22 and npm 10 will fail install.

---

## 3. Required accounts

**None** for clone, local demo with mocks, unit tests, or Compose with `.env.example` / `.env.demo.example`.

Optional (only when that feature is on):

| Account | When |
| --- | --- |
| GitHub | Push/PRs and bundled Actions |
| Gemini API key | Real LLM (`AI_PROVIDER=gemini` in production) |
| Odoo 19 + API key | `FEATURE_ODOO` / `ODOO_ENABLED` |
| SMTP / Resend / Brevo | Real email |
| HTTP SMS gateway | `FEATURE_SMS` + `SMS_PROVIDER=http` |
| AWS S3 | `STORAGE_PROVIDER=s3` / `FEATURE_S3` |
| GHCR (or other registry) | CD image push |

Local demo: empty `GEMINI_API_KEY` with `DEMO_MODE=true` uses the mock AI provider.

---

## 4. Required environment variables

Copy templates. Never commit `.env`, `.env.test`, or `.env.demo`.

```bash
cp .env.example .env
# Windows PowerShell: Copy-Item also works. `cp` is an alias for Copy-Item.
cp .env.test.example .env.test
```

For a judged demo with mock AI/email/SMS, copy `.env.demo.example` instead of `.env.example`.

The process loads the **repository-root** `.env`. Full catalog: [environment.md](environment.md).

**Minimum for local hybrid / Compose (already in `.env.example`):**

| Variable | Local value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5433/hackathon` | Host port **5433**, not 5432 |
| `REDIS_URL` | `redis://localhost:6379` | Compose overrides this inside containers |
| `JWT_ACCESS_SECRET` | 32+ character placeholder | Empty values break `npm run dev`; Compose fills a default |
| `JWT_REFRESH_SECRET` | 32+ character placeholder | Same |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | `postgres` / `postgres` / `hackathon` | Compose interpolation |
| `DEMO_MODE` | `true` | Default outside production |
| `FEATURE_*` | As in `.env.example` | Missing flags default **off** except `FEATURE_PDF` |

**Always required in production:** `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `STORAGE_SIGNING_SECRET`, `AUTH_BCRYPT_COST` ≥ 10.

**Tests:** `.env.test.example` sets `DATABASE_URL` to `hackathon_test`. `REDIS_URL` is **commented**. Uncomment it (or export it) to run Redis/BullMQ integration tests. CI sets both URLs on the runner.

---

## 5. Installation sequence

Documented happy path: **hybrid** (Docker for Postgres/Redis, Node on the host). Full Compose is an alternative.

```text
Install Git, Docker Engine + Compose v2.24+, Node.js 24, browser
  → clone repository
  → copy .env.example to .env
  → npm install
  → npm run deps:up
  → npm run db:migrate
  → npm run db:seed
  → npm run dev
  → GET /health and GET /ready
  → copy .env.test.example to .env.test
  → npm run db:test:prepare
  → npm test
  → npm run test:e2e
  → npm run build
```

Do not run `docker compose up --build` and `npm run dev` on the same ports at once.

---

## 6. Docker startup

**Data stores only (hybrid):**

```bash
npm run deps:up
```

Equivalent: `docker compose up -d postgres redis`. Host: Postgres `127.0.0.1:5433`, Redis `127.0.0.1:6379`.

**Full stack** (API, worker, frontend, Postgres, Redis):

```bash
docker compose up --build
```

Or `npm run docker:up`. Wait until `backend` is healthy. The API container migrates and, with `SEED_ON_START=true`, seeds.

| Service | Host access |
| --- | --- |
| frontend | http://localhost:5173 |
| backend | http://localhost:5000 |
| health | http://localhost:5000/health |
| ready | http://localhost:5000/ready |
| worker | none (consumes jobs) |
| optional nginx profile | http://localhost:8080 |

Smoke against a running stack:

```bash
docker compose up --build -d --wait
npm run docker:smoke
```

`docker compose down` does not delete `docker-data/`.

---

## 7. Database setup

PostgreSQL 16 via Compose. Prisma is the only ORM.

```bash
npm run db:migrate    # non-interactive deploy
npm run db:seed       # demo users when DEMO_MODE is on
npm run db:test:prepare   # create/migrate hackathon_test
```

Demo logins (local/demo only): `demo.admin@example.com` / `demo-password` (also manager, staff, user `@example.com`).

If `hackathon_test` is missing on an old volume:

```bash
docker exec hackathon-postgres createdb -U postgres hackathon_test
```

---

## 8. Redis setup

Redis 7 via Compose (`npm run deps:up` or full stack). No native Redis install.

Host URL: `redis://localhost:6379`. Containers use `redis://redis:6379`.

When `REDIS_URL` is unset, KV/rate limits/OTP use memory and jobs use a file queue. Production requires `REDIS_URL`.

---

## 9. Application startup

**Hybrid:**

```bash
npm run dev
```

Optional workers: `npm run dev:workers`. All three: `npm run dev:all`.

**Compose:** `docker compose up --build` (skip host migrate/seed/dev).

Sign-in UI: http://localhost:5173/login

---

## 10. Test commands

```bash
cp .env.test.example .env.test
npm run db:test:prepare
npm test
npm run test:e2e
npm run lint
npm run typecheck
npm run build
```

Optional Redis/BullMQ suites (Redis must be up):

```bash
# Uncomment REDIS_URL in .env.test, or:
# PowerShell: $env:REDIS_URL = 'redis://localhost:6379'
# bash: export REDIS_URL=redis://localhost:6379
npm test -w backend -- tests/redis tests/queues
```

---

## Reproduction log (2026-08-30)

Verification used this workspace (already cloned from `https://github.com/AumPethani05/hackathon-starter-kit.git`). A brand-new empty disk was not used. `node_modules` already existed; `npm install` was re-run. Compose images already existed; the full stack was not rebuilt from scratch (`--build` skipped). After the hybrid check, `docker compose up -d --wait` recreated API/worker/frontend from the existing images.

### Host tools

| Check | Result |
| --- | --- |
| Git | 2.52.0.windows.1 |
| Node.js | v24.12.0 |
| npm | 11.6.2 |
| Docker Engine | 29.7.2 |
| Docker Compose | v5.4.0 |
| `git ls-remote origin main` | Succeeded |

### Steps

| Step | Command / check | Result |
| --- | --- | --- |
| Clone | Existing repo; remote reachable | PASS (not a clean `git clone` into a new folder) |
| Prerequisites | Versions above | PASS |
| `.env` | Copied `.env.example` → `.env` | PASS. Prior local `.env` had **empty** JWT secrets and many missing keys |
| `.env.test` | Copied `.env.test.example` → `.env.test` | PASS |
| `npm install` | Root workspaces | PASS (`up to date`; `engine-strict` accepted Node 24) |
| Docker data stores | `npm run deps:up` | PASS (Postgres + Redis already healthy) |
| Postgres | `pg_isready`; `SELECT version()` | PASS — PostgreSQL **16.15** Alpine |
| Redis | `redis-cli ping` | PASS — Redis **7.4.11** |
| `npm run db:migrate` | `migrate deploy` | PASS (12 migrations, none pending) |
| `npm run db:seed` | Demo users | PASS |
| `npm run db:test:prepare` | `hackathon_test` | PASS |
| `npm test` | Workspaces | PASS — 699 backend + 54 frontend + 2 workers passed; **5 skipped** (Redis URL unset in `.env.test`) |
| Redis suites | `REDIS_URL=redis://localhost:6379` `npm test -w backend -- tests/redis tests/queues` | PASS — 6/6 |
| `npm run test:e2e` | API workflow | PASS |
| `npm run build` | All workspaces | PASS |
| Compose startup | Stack already up; later `up -d --wait` | PASS — all five services healthy |
| Hybrid startup | Stopped API/frontend/worker; `npm run dev` | PASS — listening on :5000 / :5173 |
| `GET /health` | Docker and hybrid | PASS — HTTP 200, `status: ok` |
| `GET /ready` | Docker and hybrid | PASS — HTTP 200, database + Redis healthy, Odoo skipped, AI healthy (demo mock) |
| `npm run docker:smoke` | Frontend, API, worker, stores, `/health`, `/ready` | PASS |
| Demo login | `POST /api/v1/auth/login` | PASS — HTTP 200, tokens under `data.tokens` |
| SPA | `GET http://127.0.0.1:5173/` | PASS — title + `#root` |

Prisma CLI printed a deprecation warning (`package.json#prisma`) and an “Update available 6.19.3 → 8.0.0-rc” banner. Those are not setup failures. Do not upgrade to Prisma 7/8 ([VERSION_MATRIX.md](VERSION_MATRIX.md)).

`npm install` reported 5 audit findings (2 moderate, 3 high). Do not run `npm audit fix --force`. See [security.md](security.md).

---

## Documentation problems

| Issue | Where | Severity |
| --- | --- | --- |
| Clone URL is the placeholder `<repository-url>` | `README.md`, [SETUP_MANUAL.md](SETUP_MANUAL.md), [prerequisites.md](prerequisites.md) | Low — GitHub users already have the URL |
| `.env` vs `npm install` order differs | `README.md` (install then `.env`); getting-started / prerequisites (`.env` then install) | Low — both work; `prisma generate` does not need a live database |
| Getting-started “Setup” starts with `cd`, not clone | [getting-started.md](getting-started.md) | Low — clone is on the README and prerequisites quick start |
| Default local tests skip Redis/BullMQ | `.env.test.example` comments `REDIS_URL`; README `npm test` block does not say to uncomment it | Medium — CI sets `REDIS_URL`; a literal copy of the example skips 5 tests |
| Prisma upgrade banner | `npm run db:migrate` | Low — can tempt a Prisma 8 upgrade that this kit rejects |
| Two startup modes, same ports | README / docker / getting-started | Low — documented, but a leftover Compose stack blocks `npm run dev` |
| Incomplete leftover `.env` | Not in git; easy if someone hand-edits | Medium — empty `JWT_*` fails host `npm run dev` when `DATABASE_URL` is set; Compose still starts because it interpolates placeholders |

No outdated **commands** were found (`docker compose` v2, `npm run deps:up`, `db:migrate`, `db:seed` all match `package.json`).

---

## Configuration problems

| Issue | Cause | Impact |
| --- | --- | --- |
| Pre-reproduction `.env` had empty `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` and omitted many `.env.example` keys (`FEATURE_INTENTS`, `FEATURE_PDF`, pool sizes, rate limits, `POSTGRES_*`, …) | File was not a full copy of `.env.example` | Hybrid API would refuse to start (JWT required when `DATABASE_URL` is set). Compose still ran because `docker-compose.yml` supplies JWT defaults and `env_file` includes `.env.example` first |
| `.env.test` before copy was a subset of `.env.test.example` (no `CORS_ORIGINS`, `AI_PROVIDER`, commented Redis) | Hand-maintained test env | Tests still ran (schema defaults); Redis suites skipped |
| Compose containers do not pick up a new `.env` until recreate | `docker compose up -d` / recreate | Flags such as `FEATURE_COPILOT` can stay stale until API/worker are recreated |

No missing **code** dependencies. Host Node 24 + npm 11 + Compose v2.24+ is sufficient. Native Postgres/Redis/Python/Odoo installs are unnecessary.

---

## Recommended fixes (docs only; not applied in this reproduction)

1. Align README with the other docs: clone → copy `.env` → `npm install` → `deps:up` → migrate → seed → `dev`.
2. In the README test block, add one line: uncomment `REDIS_URL` in `.env.test` (or export it) when Redis is running, so local `npm test` matches CI Redis coverage.
3. In [getting-started.md](getting-started.md) Setup, add the `git clone` step or point at prerequisites §2.
4. Add a troubleshooting row: “JWT secrets empty in `.env`” → copy placeholders from `.env.example` (already in the table for login 503; also mention host process **startup** failure).
5. After `npm run db:migrate`, ignore Prisma’s “update to 8” banner; the kit pins Prisma 6.
6. If Compose is already running and you change `.env`, recreate: `docker compose up -d --wait` (or `docker compose up --build`).
