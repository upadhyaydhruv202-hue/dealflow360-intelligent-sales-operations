# Version matrix

Authoritative compatibility table for this repository. **Current Version** for npm packages is the version resolved in `package-lock.json` at the time of the last audit, not the caret range in `package.json`. Image tags are taken from Dockerfiles and Compose files. Do not invent versions from marketing pages.

Policy: [VERSIONING_POLICY.md](VERSIONING_POLICY.md). Install list: [prerequisites.md](prerequisites.md).

Audit date: **2026-08-30**.

| Component | Current Version | Recommended/Supported | Pinned? | Source of Truth | Notes |
| --- | --- | --- | --- | --- | --- |
| Node.js | **24** (CI, Docker, `.nvmrc`). Host verified `v24.12.0` | `^24` (Active LTS). Node 20 is EOL (2026-04-30) and unsupported | Major pin (`24`, not `latest`) | `.nvmrc`; root `package.json` `engines.node`; `backend/Dockerfile`; `frontend/Dockerfile`; `actions/setup-node` `node-version-file` | Odd-numbered and Node 22/26 majors are untested. `engine-strict=true` in `.npmrc` |
| npm | **11.6.2** (host). Lockfile v3 | `^11` (ships with Node 24). Only package manager | Exact in `packageManager`; range in `engines.npm` | Root `package.json` `packageManager` + `engines.npm`; `package-lock.json` `lockfileVersion` 3 | Do not add Yarn, pnpm, or Bun. CI and Dockerfiles use `npm ci` |
| React | 18.3.1 | React 18.x | Lockfile | `frontend/package.json` `^18.3.1`; lockfile | React 19 is a breaking upgrade. Not adopted |
| React DOM | 18.3.1 | Match React 18 | Lockfile | `frontend/package.json` | |
| React Router | 6.30.6 | 6.x | Lockfile | `frontend/package.json` `^6.30.0` | v7 is a breaking upgrade. Residual moderate advisory noted in [security.md](security.md) |
| Vite | 6.4.3 | Vite 6.x | Lockfile | `frontend/package.json` `^6.2.1` | Vite 7 not adopted. Engine allows Node 18, 20, or ≥22 |
| `@vitejs/plugin-react` | 4.7.0 | 4.x with Vite 6 | Lockfile | `frontend/package.json` | Peer allows Vite 4–7; kit stays on Vite 6 |
| Tailwind CSS | 3.4.19 | Tailwind 3.x | Lockfile | `frontend/package.json` `^3.4.17` | Tailwind 4 is a breaking upgrade (new engine). Not adopted |
| PostCSS | 8.5.26 | 8.x | Lockfile | `frontend/package.json` | |
| Autoprefixer | 10.5.4 | 10.x | Lockfile | `frontend/package.json` | |
| TypeScript | 5.9.3 | 5.8+ / 5.9.x | Lockfile | Root and workspaces `^5.8.2`; `tsconfig.base.json` `target`/`lib` ES2022 | TypeScript 6 not adopted |
| `@types/node` | 24.13.3 | Match runtime major (24) | Lockfile | `backend/package.json`, `workers/package.json` `^24.0.0` | Previously 22.x while runtime was 20; now aligned to Node 24 |
| Prisma ORM | 6.19.3 | Prisma 6.x + PostgreSQL 16 | Lockfile | `backend/package.json` `^6.16.2`; `database/prisma/schema.prisma` | Prisma 7/8 are breaking (config, adapters, seed). Not adopted. CLI warns that `package.json#prisma` is deprecated for Prisma 7 (`prisma.config.ts`). CLI `engines.node` ≥18.18 |
| PostgreSQL | **16** (`postgres:16-alpine`) | PostgreSQL 16 | Major image tag | `infra/docker-compose.yml`; CI service in `.github/workflows/ci.yml` | Tag floats within 16.x Alpine. Not `latest`. Host port 5433 |
| Redis | **7** (`redis:7-alpine`) | Redis 7 | Major image tag | `infra/docker-compose.yml`; CI service | Tag floats within 7.x Alpine. BullMQ + ioredis 5 require Redis 5+; kit tests against 7 |
| BullMQ | 6.3.1 | BullMQ 6.x + Redis 7 + ioredis 5 | Lockfile | `backend/package.json` `^6.3.1` | Optional peers `ioredis`, `redis`, `pg`. Kit uses `ioredis` 5.11.1 |
| ioredis | 5.11.1 | 5.x | Lockfile | `backend/package.json` `^5.6.0` | Direct dependency, not only a BullMQ peer |
| Express | 4.22.2 | Express 4.x | Lockfile | `backend/package.json` `^4.21.2` | Express 5 is a breaking upgrade. Not adopted |
| Zod | 3.25.76 | Zod 3.x | Lockfile | `backend/package.json` `^3.24.2` | Zod 4 is a breaking upgrade. Not adopted |
| AI (Gemini) | Custom REST; default model `gemini-2.5-flash`; API root `generativelanguage.googleapis.com/v1beta` | Gemini `generateContent` / embed on **v1beta** (SDK default). Stable **v1** exists for production-only features | Code constants | `backend/src/integrations/ai/ai.config.ts`; `gemini.provider.ts` | No `@google/genai` / `@google/generative-ai` package. `v1beta` is not removed; it is the preview channel. Model ids expire independently of the HTTP API version |
| Odoo | JSON-2 `POST /json/2/<model>/<method>`; API key Bearer | **Odoo 19** JSON-2. XML-RPC/JSON-RPC are deprecated upstream (removal targeted at Odoo 22) | Protocol in code | `backend/src/integrations/odoo/odoo.config.ts`; [odoo.md](odoo.md) | Not an npm SDK. Older Odoo XML-RPC servers are out of scope |
| Node Docker image | `node:24-alpine` | Node 24 Alpine | Major tag | `backend/Dockerfile`; `frontend/Dockerfile` | Floats within 24.x Alpine. Not `latest` |
| Frontend nginx | `nginxinc/nginx-unprivileged:1.27-alpine` | 1.27 Alpine unprivileged | Minor tag | `frontend/Dockerfile` production; Compose `nginx` profile | Not `latest` |
| Docker Compose | Minimum **v2.24+** (`include`, `env_file.required`). Host verified **v5.4.0** | Compose V2 plugin, not Compose V1 | Feature pin, not image pin | [docker.md](docker.md); `docker compose version` | Root `docker-compose.yml` `include`s `infra/docker-compose.yml` |
| GitHub Actions runner | `ubuntu-24.04` | Ubuntu 24.04 | Distro pin | `.github/workflows/ci.yml`; `cd.yml` | Not `ubuntu-latest` (that tag moves) |
| `actions/checkout` | v7 | Current major | Major tag | Workflows | Replaces v4 (Node 20 action runtime, deprecated on github.com) |
| `actions/setup-node` | v7 | Current major | Major tag | Workflows | `node-version-file: .nvmrc`; `cache: npm`; then `npm ci` |
| `actions/upload-artifact` | v7 | Current major | Major tag | Workflows | |
| `docker/setup-buildx-action` | v4 | Current major | Major tag | `cd.yml` | |
| `docker/login-action` | v4 | Current major | Major tag | `cd.yml` | |
| `docker/build-push-action` | v7 | Current major | Major tag | `cd.yml` | |
| Vitest | 3.2.7 | Vitest 3.x | Lockfile | All workspaces `^3.0.8` | Vitest 4 not adopted |
| `@vitest/coverage-v8` | 3.2.7 | Match Vitest | Lockfile | Workspaces | |
| Testing Library React | 16.3.3 | 16.x + React 18 | Lockfile | `frontend/package.json` | |
| `@testing-library/jest-dom` | 6.9.1 | 6.x | Lockfile | `frontend/package.json` | |
| jsdom | 26.1.0 | 26.x | Lockfile | `frontend/package.json` | UI tests; no Playwright/Cypress |
| Supertest | 7.2.2 | 7.x | Lockfile | `backend/package.json` | API e2e |
| pdf-lib | 1.17.1 | 1.17.x (no active successor in tree) | Lockfile | `backend/package.json` `^1.17.1` | Last feature release 2021. Adequate for the kit renderer; treat as maintenance risk |
| Multer | 2.2.0 | 2.x | Lockfile | `backend/package.json` | |
| Nodemailer | 9.0.6 | 9.x | Lockfile | `backend/package.json` | |
| Pino | 9.14.0 | 9.x | Lockfile | `backend` / `workers` | |
| Helmet | 8.3.0 | 8.x | Lockfile | `backend/package.json` | |
| dotenv | 16.6.1 | 16.x | Lockfile | `backend` / `workers` | |
| jsonwebtoken | 9.0.3 | 9.x | Lockfile | `backend/package.json` | |
| bcryptjs | 2.4.3 | 2.4.x in this tree | Lockfile | `backend/package.json` | 3.x exists; not adopted without a dedicated change |
| AWS SDK S3 | 3.1120.0 | aws-sdk-js-v3 | Lockfile | `backend/package.json` | `engines.node` ≥20 |
| ESLint | 9.39.5 | 9.x until a coordinated ESLint 10 + typescript-eslint upgrade | Lockfile | Root `^9.22.0` | **EOL** (2026-08-06). npm marks this version deprecated. Dev-only; do not confuse with runtime support |
| `typescript-eslint` | 8.68.0 | 8.x with ESLint 9 | Lockfile | Root | |
| Prettier | 3.9.6 | 3.x | Lockfile | Root | |
| tsx | 4.23.12 | 4.x | Lockfile | `backend` / `workers` | Uses esbuild 0.28; Vite 6 uses esbuild 0.25 (two copies) |

## How to read this table

* **Pinned?** means whether a future clone gets the same version without a moving tag. npm apps are pinned by `package-lock.json`. Docker majors still float (for example `postgres:16-alpine` tracks the latest 16 Alpine build).
* **Recommended/Supported** is what this kit tests and documents, not every version a library’s `engines` field allows.
* Re-run `npm ls --depth=0` and read Dockerfiles after upgrades. This file is not updated automatically.

## Intentionally not upgraded

These majors exist and were **not** adopted in this audit (breaking or out of scope):

* Prisma 7 / 8
* Express 5
* React 19
* React Router 7
* Vite 7
* Tailwind 4
* Zod 4
* ESLint 10
* Vitest 4
* Node 26 (Current at audit time; not LTS yet)
