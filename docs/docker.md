# Docker

Local full-stack development with Docker Compose. Kubernetes is not required.

## Services

| Service | Role | Classification | Host port | In-network name |
| --- | --- | --- | --- | --- |
| `postgres` | PostgreSQL 16 | **Required** | localhost:5433 → 5432 (loopback only) | `postgres:5432` |
| `redis` | Redis 7 | **Required** | localhost:6379 (loopback only) | `redis:6379` |
| `backend` | Express API | **Required** | http://localhost:5000 | `backend:5000` |
| `worker` | Background jobs (BullMQ) | **Required** | none | `worker` |
| `frontend` | React SPA (nginx, unprivileged) | **Required** | http://localhost:5173 | `frontend:8080` |
| `nginx` | Reverse proxy in front of frontend + API | **Optional** (Compose profile `nginx`) | http://localhost:8080 | profile `nginx` |

`backend` and `worker` share one image (`hackathon-backend:dev`). They are not duplicate API containers: the API sets `JOBS_PROCESS=false`; the worker runs `command: ['worker']`.

The frontend **production** stage already embeds nginx to serve the SPA and proxy `/api`, `/health`, and `/ready`. The Compose `nginx` service is a separate edge proxy for a single origin on port 8080. It is not a second Postgres/Redis, and it is not started by `docker compose up`.

CI (`.github/workflows/ci.yml`) starts its own Postgres and Redis as GitHub Actions job services for tests. That is not a second Compose stack.

### Not in this stack

There is no RabbitMQ, Kafka, Mailhog, MinIO, Adminer, extra Postgres, extra Redis, extra worker, or extra backend service. RAG uses PostgreSQL (not a vector-database container). The frontend Dockerfile `development` stage (Vite) is kept for Dockerized HMR but is not a Compose service; use `npm run dev` on the host for that workflow.

Containers talk to each other by **service name**. Compose overrides `DATABASE_URL` and `REDIS_URL` inside `backend` and `worker` so they do not use `localhost`.

The frontend image proxies `/health`, `/ready`, and `/api` to `backend`, so the browser can keep `VITE_API_URL` empty. Nginx re-resolves `backend` through Docker DNS so a recreated API container does not leave stale IPs (HTTP 502).

## Prerequisites

Host tooling (Git, Node, npm, Compose v2.24+, what Docker already runs) is listed in [prerequisites.md](prerequisites.md).

* Docker Engine with Compose v2.24+ (`docker compose version`)
* Copy `.env.example` to `.env` and replace local JWT placeholders before using auth in a shared environment. Compose still fills empty `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` with the local-dev placeholders so login is not 503 when `.env` has blank keys. Change those placeholders before any shared or production use.

Compose loads `.env.example` then `.env` (optional). Secrets stay in env files, never in Dockerfiles.

## Start the stack

From the repository root:

```bash
docker compose up --build
```

Or:

```bash
npm run docker:up
```

First start runs migrations and, when `SEED_ON_START=true`, demo seed. Wait until `backend` is healthy (`GET /ready`).

* Frontend: http://localhost:5173
* API: http://localhost:5000
* Health: http://localhost:5000/health
* Readiness: http://localhost:5000/ready

## Stop, logs, and exec

```bash
docker compose down
docker compose logs
docker compose logs -f backend
docker compose exec backend sh
docker compose exec postgres psql -U postgres -d hackathon
```

npm shortcuts: `npm run docker:down`, `npm run docker:logs`, `npm run docker:ps`.

`docker compose down` stops app containers and the included Postgres/Redis services. Data in `docker-data/` is kept.

Postgres and Redis from `npm run deps:up` use the same Compose project (`hackathon-starter-kit`). You can start the rest of the stack later with `docker compose up --build` without renaming or removing those containers.

## Optional nginx

Unified entry on port 8080 (still not started by default):

```bash
docker compose --profile nginx up --build
```

`CORS_ORIGINS` in `.env.example` includes `http://localhost:8080`.

SSE (`/api/v1/realtime/`) is proxied with buffering off and a long read timeout in `infra/nginx/proxy.conf` and `infra/nginx/frontend.conf`. See [realtime.md](realtime.md).

## Hybrid workflow (Node on the host)

Start only Postgres and Redis, then run the app with npm:

```bash
npm run deps:up
npm run db:migrate
npm run db:seed
npm run dev
npm run dev:workers
```

Host processes use `DATABASE_URL=...@localhost:5433` and `REDIS_URL=redis://localhost:6379` from `.env`. Do not run the full Compose stack and `npm run dev` against the same ports at once.

```bash
npm run deps:down
```

## Images

| File | Stages | Runtime user |
| --- | --- | --- |
| `backend/Dockerfile` | `deps` → `development` / `build` → `production` (`node:24-alpine`) | `node` |
| `frontend/Dockerfile` | `deps` → `development` / `build` → `production` (`node:24-alpine`, nginx 1.27) | nginx-unprivileged |

Both images copy and build `packages/api-contract` so `@hackathon/api-contract` resolves in the container.

Images use major (or major.minor) tags, not `latest`. Postgres is `postgres:16-alpine`, Redis is `redis:7-alpine`. See [VERSION_MATRIX.md](VERSION_MATRIX.md).

Compose uses the backend **development** stage (TypeScript via `tsx`, migrate + optional seed) and the frontend **production** stage (small static image). The backend **production** stage is a compiled, `npm ci --omit=dev` image for deployment.

Production considerations already in the files:

* Alpine bases and multi-stage builds
* Non-root processes where practical
* No API keys or passwords in Dockerfiles
* Health checks and `depends_on: condition: service_healthy`
* Persistent Postgres volume (`docker-data/postgres`)

## Environment

| Variable | Compose behavior |
| --- | --- |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Interpolation for the Postgres service and in-container `DATABASE_URL` |
| `DATABASE_URL` | Overridden to `postgresql://...@postgres:5432/...` in API and worker containers |
| `REDIS_URL` | Overridden to `redis://redis:6379` in API and worker containers |
| `JOBS_PROCESS` | `false` on the API container, `true` on the worker |
| `SEED_ON_START` | Default `true` for the API container; runs Prisma seed after migrate |
| `VITE_API_URL` | Build arg for the frontend image; leave empty to use the nginx proxy |
| `API_PROXY_TARGET` | Vite-only (`frontend/vite.config.ts`); defaults to `http://localhost:5000`, or `http://backend:5000` in the frontend development image |

See [environment.md](environment.md) and [configuration.md](configuration.md).

## Tests

Static Compose/Dockerfile assertions run with `npm test -w backend` (`backend/tests/infra/docker.test.ts`). They do not start containers.

Against a running stack:

```bash
docker compose up --build -d --wait
npm run docker:smoke
docker compose down
```

CI job `docker` builds production images, starts the stack, and runs the same smoke checks: frontend, backend, worker, Postgres, Redis, `/health`, and `/ready`. See [ci-cd.md](ci-cd.md).

## Limitations

* Compose is the local/dev path. There is no Kubernetes dependency.
* The optional `nginx` profile is a convenience reverse proxy, not a production ingress.
* Bind-mounted `docker-data/` is for local persistence; it is gitignored.
* Demo JWT values in `.env.example` are local placeholders, not production secrets.
