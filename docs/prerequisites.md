# Prerequisites

Authoritative list of software and accounts needed to use this repository. Versions below are taken from `package.json`, `package-lock.json`, `.nvmrc`, Dockerfiles, Compose files, GitHub Actions, and scripts. Do not treat marketing pages or this file’s older drafts as a source of extra tools.

A new teammate can run a local demo with **Git**, **Node.js 24**, **npm 11**, **Docker Engine with Compose v2**, and a **web browser**. PostgreSQL and Redis are started by Docker. Python, a native database, a native Redis, a local Odoo server, Yarn/pnpm, Playwright, and Kubernetes are not part of this kit’s setup.

Variable catalog after install: [environment.md](environment.md). First run: [getting-started.md](getting-started.md). Compose details: [docker.md](docker.md). Pin table: [VERSION_MATRIX.md](VERSION_MATRIX.md). Upgrade rules: [VERSIONING_POLICY.md](VERSIONING_POLICY.md).

## Classification

| Label                            | Meaning                                                                                                           |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **MANDATORY LOCAL INSTALLATION** | Install on the developer machine for the documented workflows                                                     |
| **DOCKER-PROVIDED**              | Runs as a Compose (or CI service) container. Do not install on the host unless you deliberately opt out of Docker |
| **OPTIONAL**                     | Only if you choose that workflow or integration                                                                   |
| **CI-ONLY**                      | Provided by GitHub Actions on `ubuntu-24.04`. Not a laptop install                                                 |
| **DEPLOYMENT-ONLY**              | Needed to ship images or a live environment, not to develop locally                                               |
| **ONLINE ACCOUNT**               | Credentials or a hosted product. Not a local package                                                              |

---

## 1. Mandatory software

These are required to follow [getting-started.md](getting-started.md): clone, `npm install`, start data stores, migrate, seed, run the app, hit `/health` and `/ready`, and run tests.

| Software          | Classification                                               | Why                                                                                                                                                                                                                   |
| ----------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git               | **MANDATORY LOCAL INSTALLATION**                             | Clone the repository. CI also checks out with Git. No Git version is pinned in this repo                                                                                                                              |
| Node.js           | **MANDATORY LOCAL INSTALLATION**                             | Root `package.json` `engines.node` is `^24`. Used for `npm install`, Prisma generate/migrate/seed, `npm run dev`, workers, lint, typecheck, tests, and `infra/scripts/*.mjs`                                         |
| npm               | **MANDATORY LOCAL INSTALLATION**                             | The only package manager this repo uses. Root `engines.npm` is `^11` and `packageManager` is `npm@11.6.2`. CI and Dockerfiles run `npm ci`. Node 24 already ships npm 11 — do not add Yarn or pnpm |
| Docker Engine     | **MANDATORY LOCAL INSTALLATION**                             | Starts PostgreSQL and Redis (`npm run deps:up`) and the full stack (`docker compose up --build`). Scripts call `docker compose`, not `docker-compose`                                                                 |
| Docker Compose v2 | **MANDATORY LOCAL INSTALLATION** (plugin / `docker compose`) | Root `docker-compose.yml` uses `include` and `env_file.path` with `required: false`. [docker.md](docker.md) requires Compose **v2.24+**. Verify with `docker compose version`                                         |
| Web browser       | **MANDATORY LOCAL INSTALLATION**                             | Open the SPA (Compose and Vite both publish http://localhost:5173). UI tests use **jsdom** inside Vitest; Playwright and Cypress are not in the repo                                                                  |

**Node on the host vs Node in Docker:** the full Compose stack runs the API and worker on `node:24-alpine` inside images. You still need host Node.js for `npm install`, host-side migrate/seed, `npm test`, and `npm run dev`. A laptop with only Docker can start the Compose app after you copy `.env`, but it cannot run the documented test and lint commands.

---

## 2. Versions

Only versions that appear in project files.

| Component                 | Version in repo                                                                            | Source                                                                                                                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js                   | `^24` (developers, CI, images). Node 20 is EOL and unsupported                     | Root `package.json` `engines.node`; `.nvmrc` is `24`; `actions/setup-node` uses `node-version-file: .nvmrc`; `backend/Dockerfile` and `frontend/Dockerfile` use `FROM node:24-alpine` |
| npm                       | `^11` (`packageManager` `npm@11.6.2`)                                              | Root `package.json` `engines.npm` and `packageManager`; `package-lock.json` `lockfileVersion` 3; `.github/workflows/ci.yml` and Dockerfiles use `npm ci` |
| PostgreSQL                | **16** (Alpine image tag)                                                                  | `infra/docker-compose.yml` `postgres:16-alpine`; CI service `postgres:16-alpine`                                                                                                      |
| Redis                     | **7** (Alpine image tag)                                                                   | `infra/docker-compose.yml` `redis:7-alpine`; CI service `redis:7-alpine`                                                                                                              |
| Prisma ORM                | Declared `^6.16.2` in `backend/package.json`; installed via npm (not a separate installer) | `backend/package.json`; `npx prisma` / `npm run db:*`                                                                                                                                 |
| Frontend production nginx | `nginxinc/nginx-unprivileged:1.27-alpine`                                                  | `frontend/Dockerfile` production stage                                                                                                                                                |
| Optional Compose proxy    | same `nginxinc/nginx-unprivileged:1.27-alpine`                                             | `docker-compose.yml` service `nginx` (profile `nginx`)                                                                                                                                |
| TypeScript                | `^5.8.2` as an npm dependency                                                              | Root and workspace `package.json`. Not a separate compiler install                                                                                                                    |
| Git                       | Unspecified                                                                                | Use any current Git that can clone HTTPS or SSH                                                                                                                                       |
| Docker Engine             | Unspecified beyond Compose **v2.24+**                                                      | [docker.md](docker.md), justified by Compose `include` and `env_file.required: false`                                                                                                 |
| Odoo protocol             | **Odoo 19** JSON-2 (`POST /json/2/<model>/<method>`)                                       | [odoo.md](odoo.md). This is a remote API, not a local Odoo version to install                                                                                                         |
| Gemini default model      | `gemini-2.5-flash` when `AI_PROVIDER=gemini` and `AI_MODEL` is unset                       | `backend/src/integrations/ai/ai.config.ts`                                                                                                                                            |

CI runners are `ubuntu-24.04` (GitHub-hosted). That OS image is **CI-ONLY**.

---

## 3. Docker-provided services

Do **not** install PostgreSQL, Redis, Nginx, or a second Node runtime on the host for the default path. Compose already provides them.

Default stack (`docker compose up --build` from the repository root):

| Compose service | Image / build                                                | Host access                              | Role                                                              |
| --------------- | ------------------------------------------------------------ | ---------------------------------------- | ----------------------------------------------------------------- |
| `postgres`      | `postgres:16-alpine`                                         | `127.0.0.1:5433` → container `5432`      | Primary database. Init script also creates `hackathon_test`       |
| `redis`         | `redis:7-alpine`                                             | `127.0.0.1:6379`                         | BullMQ, cache, rate limits, OTP, idempotency                      |
| `backend`       | `backend/Dockerfile` target `development` (`node:24-alpine`) | http://localhost:5000                    | Express API. Runs Prisma migrate; seeds when `SEED_ON_START=true` |
| `worker`        | same image as `backend`, command `worker`                    | none                                     | Job consumer (`JOBS_PROCESS=true`)                                |
| `frontend`      | `frontend/Dockerfile` target `production`                    | http://localhost:5173 → container `8080` | Static SPA + nginx proxy for `/api`, `/health`, `/ready`          |

Hybrid path (`npm run deps:up`) starts **only** `postgres` and `redis`. Host Node then uses `DATABASE_URL=...@localhost:5433/...` and `REDIS_URL=redis://localhost:6379` from `.env.example`.

Inside Compose, API and worker **do not** use those localhost URLs. The compose file overrides them to `postgres:5432` and `redis:6379`.

**Optional Compose profile** `nginx`: extra reverse proxy on http://localhost:8080. Not started by `docker compose up`. Image is Docker-provided.

**Not in this stack** (do not install for the kit): Mailhog, MinIO, Adminer, Kafka, RabbitMQ, extra Postgres/Redis, a vector-database container, a local Odoo container. RAG uses PostgreSQL. See [docker.md](docker.md).

GitHub Actions **Verify** starts its own `postgres:16-alpine` and `redis:7-alpine` as job services (**CI-ONLY**). That is not a second tool to install locally.

---

## 4. Optional software

| Software                | Classification | When you need it                                                                                                                                                              |
| ----------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Native PostgreSQL       | **OPTIONAL**   | Only if you refuse Docker. Match Compose: PostgreSQL **16**. Point `DATABASE_URL` at your port (Compose uses host **5433** specifically to avoid a native server on **5432**) |
| Native Redis            | **OPTIONAL**   | Same opt-out. Match Compose: Redis **7**. Default URL is `redis://localhost:6379`                                                                                             |
| nvm, fnm, or n          | **OPTIONAL**   | Convenient way to install Node **24** to match `.nvmrc`                                                                                                                       |
| Cursor or VS Code       | **OPTIONAL**   | Any editor works. `.vscode/` and `.cursor/` are gitignored. There is no committed extensions list                                                                             |
| curl / wget             | **OPTIONAL**   | Manual HTTP checks. `npm run docker:smoke` uses Node `fetch`. PowerShell’s `curl` alias is not the same as `curl.exe`                                                         |
| Docker Desktop GUI      | **OPTIONAL**   | Typical on Windows and macOS. Linux can use Docker Engine + the Compose plugin                                                                                                |
| Compose profile `nginx` | **OPTIONAL**   | Unified local origin on port 8080. Image is pulled by Docker                                                                                                                  |
| GitHub CLI (`gh`)       | **OPTIONAL**   | Not referenced by npm scripts or workflows                                                                                                                                    |

### Do not install for this kit

| Item                                   | Why not                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Python                                 | No application or script in this repo requires Python. Odoo is called over HTTP from Node                                |
| Local Odoo / Odoo.sh installer         | Odoo is an **ONLINE ACCOUNT** / remote server when `FEATURE_ODOO` is on. Default `.env.example` has `ODOO_ENABLED=false` |
| Yarn, pnpm, Bun                        | Lockfile and CI are npm                                                                                                  |
| Playwright, Cypress, ChromeDriver      | [testing.md](testing.md): e2e is API-level Vitest + Supertest                                                            |
| Kubernetes, Helm, Kafka                | Explicitly out of scope ([docker.md](docker.md), `AGENTS.md`)                                                            |
| Make, Go, Rust, Java                   | Not used by scripts or images                                                                                            |
| Global TypeScript, Prisma CLI, or Vite | Installed under `node_modules` by `npm install`                                                                          |

---

## 5. Required accounts

None of these are required to clone the repo, start Compose with demo mocks, or run unit tests.

| Account / product                             | Classification                           | When it is required                                                                                                                                                                                                                                                           |
| --------------------------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Git host (GitHub if this remote uses Actions) | **ONLINE ACCOUNT**                       | Clone/push. A GitHub user is needed to open PRs against GitHub and to use the bundled workflows                                                                                                                                                                               |
| Google AI Studio / Gemini API key             | **ONLINE ACCOUNT**                       | Real LLM calls when `FEATURE_AI` / `AI_ENABLED` and `AI_PROVIDER=gemini`. Production refuses to start without `GEMINI_API_KEY` in that case. Local demo: empty key falls back to **mock** when `DEMO_MODE=true` ([ai.md](ai.md)). `.env.demo.example` sets `AI_PROVIDER=mock` |
| Odoo 19 database + API key                    | **ONLINE ACCOUNT**                       | When `ODOO_ENABLED` or `FEATURE_ODOO` is true. Needs `ODOO_BASE_URL`, `ODOO_DATABASE`, `ODOO_API_KEY`. Create the key in Odoo: Preferences → Account Security. Default flags are **off**                                                                                      |
| SMTP server                                   | **ONLINE ACCOUNT**                       | `EMAIL_ENABLED=true` and `EMAIL_PROVIDER=smtp`                                                                                                                                                                                                                                |
| Resend                                        | **ONLINE ACCOUNT**                       | `EMAIL_PROVIDER=resend` (`RESEND_API_KEY`)                                                                                                                                                                                                                                    |
| Brevo                                         | **ONLINE ACCOUNT**                       | `EMAIL_PROVIDER=brevo` (`BREVO_API_KEY`)                                                                                                                                                                                                                                      |
| HTTP SMS gateway                              | **ONLINE ACCOUNT**                       | `FEATURE_SMS` / `SMS_ENABLED` and `SMS_PROVIDER=http` (`SMS_HTTP_URL`, `SMS_API_KEY` in production). Default is **mock** / SMS off                                                                                                                                            |
| AWS account + S3 bucket                       | **ONLINE ACCOUNT**                       | `STORAGE_PROVIDER=s3` / `FEATURE_S3`. Local default is `STORAGE_PROVIDER=local` (disk + PostgreSQL). No MinIO container                                                                                                                                                       |
| GitHub Container Registry (or override)       | **DEPLOYMENT-ONLY** / **ONLINE ACCOUNT** | CD pushes `backend` and `frontend` images. Default registry `ghcr.io` ([ci-cd.md](ci-cd.md))                                                                                                                                                                                  |
| Production PostgreSQL and Redis               | **DEPLOYMENT-ONLY**                      | Production `NODE_ENV=production` requires `DATABASE_URL` and `REDIS_URL`. Do not reuse Compose placeholders                                                                                                                                                                   |
| Deploy webhook / host SSH                     | **DEPLOYMENT-ONLY**                      | Only if `DEPLOY_PROVIDER` is `webhook` or `command`. Default CD stops after registry push                                                                                                                                                                                     |

GitHub Actions itself is **CI-ONLY** for contributors: it is not installed locally. Paid Gemini/Odoo/email/SMS/AWS must not be configured in CI ([testing.md](testing.md)).

---

## 6. Installation order

Install tools in this order so later steps have what they need.

1. **Git**
2. **Docker Engine + Compose v2.24+** (start the daemon; on Windows/macOS that is usually Docker Desktop)
3. **Node.js 24** (bundled npm already satisfies `engines.npm` `^11`). Confirm `node -v` is v24.x and `npm -v` is 11.x
4. Confirm a **browser** is available
5. Then follow [Quick start](#quick-start) (clone → `.env` → `npm install` → Docker data stores → migrate → seed → app → health → tests)

Do not install native PostgreSQL or Redis before Docker unless you have already decided to skip Compose.

---

## 7. Verification commands

Run from any directory for tools, then from the repository root for project checks.

```bash
git --version
node -v
npm -v
docker version
docker compose version
```

Expect Node `v24.x` (`engines.node` `^24`; CI and images use 24). Expect npm 11.x (`engines.npm` `^11`). Expect `docker compose version` to report **v2.24** or newer.

After clone and `npm install`:

```bash
npm run deps:up
docker compose ps
npm run db:migrate
```

After the API is up, open http://localhost:5000/health (liveness) and http://localhost:5000/ready (Postgres + Redis when those URLs are set), or:

```bash
node -e "fetch('http://localhost:5000/health').then(r=>r.json()).then(console.log)"
node -e "fetch('http://localhost:5000/ready').then(r=>r.json()).then(console.log)"
```

Full Compose smoke (stack must already be up):

```bash
npm run docker:smoke
```

Quality:

```bash
npm run lint
npm run typecheck
npm test
```

---

## 8. Windows, macOS, and Linux notes

### Windows

- Docker Desktop with the WSL 2 backend is the usual Engine + Compose install. Enable it before `docker compose up`.
- Keep the repo on a drive Docker can bind-mount. Data lives in `docker-data/` (gitignored). Antivirus locking those files can make Postgres unhealthy.
- Host PostgreSQL is mapped to **5433**, not 5432, so a native Windows PostgreSQL service can keep 5432. Do not change `.env` to 5432 while using Compose.
- Copy env files with `copy .env.example .env` or `cp .env.example .env` (PowerShell treats `cp` as `Copy-Item`).
- Prefer `curl.exe` if you use curl; PowerShell `curl` is `Invoke-WebRequest`.
- Use Node.js **Windows x64** matching `^24`. Git for Windows is enough; Git Bash is optional.

### macOS

- Docker Desktop (or another Engine that provides `docker compose`).
- **Port 5000** is often taken by AirPlay Receiver. The API defaults to `PORT=5000`. Turn AirPlay Receiver off or set `PORT` and keep Vite’s proxy in sync.
- Homebrew is optional (`node@24`, `git`). nvm reading `.nvmrc` is also fine.

### Linux

- Install Docker Engine and the **Compose v2 plugin** (`docker compose`). Do not use Compose V1 (`docker-compose` Python package).
- Add your user to the `docker` group or the daemon will refuse `npm run deps:up`.
- Node 24 from NodeSource, nvm, or the distro’s Node 24 package is enough; this repo does not require a distro PostgreSQL package.

### All platforms

- Run npm and Compose from the **repository root** (workspaces + `docker-compose.yml` live there).
- Do not run `docker compose up --build` and `npm run dev` against the same ports at once.
- `docker compose down` does not delete `docker-data/`.

---

## 9. Common setup issues

| Symptom                                                         | Likely cause                                                                 | What to do                                                                                                      |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `engines` / unexpected Node                                     | Node 20 or 22                                                                | Install Node 24 (`.nvmrc` is `24`). Node 20 is EOL |
| `engines` / unexpected npm                                      | npm 10 or Yarn/pnpm                                                          | Use the npm that ships with Node 24 (`engines.npm` `^11`)                                                       |
| `npm ci` fails, or missing workspaces                           | Yarn/pnpm, or not at repo root                                               | Use npm; `cd` to the repo root                                                                                  |
| `docker: command not found` or Compose v1 errors                | Engine not installed, or `docker-compose` V1                                 | Install Docker; use `docker compose` v2.24+                                                                     |
| Cannot connect to the daemon                                    | Docker Desktop/WSL not running                                               | Start Docker, wait until it is ready                                                                            |
| `ECONNREFUSED` on `localhost:5432`                              | Host Node using the in-container port                                        | Use `localhost:5433` as in `.env.example`                                                                       |
| `ECONNREFUSED` on 5433 / 6379                                   | Data stores not started                                                      | `npm run deps:up` and wait until healthy                                                                        |
| `/ready` HTTP 503                                               | `DATABASE_URL` / `REDIS_URL` set but unreachable, or enabled Odoo/AI failing | Check Compose health; disable unused integrations                                                               |
| Login 503 / missing JWT                                         | Empty `JWT_*` in `.env`                                                      | Copy placeholders from `.env.example` (replace before any shared host)                                          |
| `hackathon_test` missing                                        | Volume created before `infra/postgres-init` existed                          | `docker exec hackathon-postgres createdb -U postgres hackathon_test` ([getting-started.md](getting-started.md)) |
| Port already allocated (`5000`, `5173`, `6379`, `5433`, `8080`) | Another process or a second Compose project                                  | Stop the other stack; on macOS check AirPlay vs 5000                                                            |
| Prisma migrate cannot connect                                   | `.env` not at repo root, or Docker not up                                    | `backend` scripts load the **root** `.env` ([configuration.md](configuration.md))                               |
| AI “not ready” with Gemini                                      | No `GEMINI_API_KEY` and demo mock not selected                               | Use `.env.demo.example`, or set the key, or `AI_PROVIDER=mock` with `DEMO_MODE=true`                            |
| Odoo health fails                                               | Flags on without a reachable Odoo 19                                         | Leave `FEATURE_ODOO=false` until you have URL, database, and API key                                            |
| Bind mount / Postgres crash loop on Windows                     | `docker-data/postgres` locked or not writable                                | Stop Compose, exclude the folder from real-time antivirus, retry                                                |
| Tests skip DB/Redis suites                                      | URLs unset                                                                   | `cp .env.test.example .env.test`; `npm run db:test:prepare`; optionally uncomment `REDIS_URL`                   |

---

## Quick start

Documented happy path: **hybrid** (Docker for Postgres/Redis, Node on the host). That matches the sequence below. For a judged demo with mock AI/email/SMS, copy `.env.demo.example` instead of `.env.example`.

```text
Install prerequisites
  → clone repository
  → configure .env
  → install dependencies
  → start Docker (Postgres + Redis)
  → migrate database
  → seed
  → start application
  → verify health
  → run tests
```

### 1. Install prerequisites

Git, Docker Engine + Compose v2.24+, Node.js 24 (npm 11 included), browser. Use [Verification commands](#7-verification-commands).

### 2. Clone

```bash
git clone <repository-url>
cd hackathon-starter-kit
```

### 3. Configure `.env`

```bash
cp .env.example .env
```

Full catalog: [environment.md](environment.md). JWT placeholders in `.env.example` are for local use only.

### 4. Install dependencies

```bash
npm install
```

This also runs `prisma generate` (backend `postinstall`).

### 5. Start Docker (data stores)

```bash
npm run deps:up
```

Equivalent: `docker compose up -d postgres redis`.

### 6. Migrate

```bash
npm run db:migrate
```

### 7. Seed

```bash
npm run db:seed
```

Demo users exist only when `DEMO_MODE` is on (default in development). After seed, local `npm run dev` upserts the RBAC catalog. See [database.md](database.md).

### 8. Start the application

```bash
npm run dev
```

API: http://localhost:5000. SPA: http://localhost:5173. Optional workers: `npm run dev:workers`.

**Full Docker alternative:** skip host migrate/seed/dev and run `docker compose up --build`. The API container migrates and, with `SEED_ON_START=true`, seeds. Wait until `backend` is healthy.

### 9. Verify health

- http://localhost:5000/health — process liveness
- http://localhost:5000/ready — dependencies (Postgres and Redis when configured)
- Sign-in UI: http://localhost:5173/login — after seed, `demo.admin@example.com` / `demo-password`

### 10. Run tests

```bash
cp .env.test.example .env.test
npm run db:test:prepare
npm test
npm run test:e2e
```

`npm test` skips Postgres/Redis integration suites when those URLs are unset. `test:e2e` requires the test database. See [testing.md](testing.md).

---

## See also

- [getting-started.md](getting-started.md) — commands and local URLs
- [environment.md](environment.md) — every variable
- [docker.md](docker.md) — Compose services and hybrid vs full stack
- [ci-cd.md](ci-cd.md) — GitHub Actions and deploy accounts
- [configuration.md](configuration.md) — how `.env` is loaded
