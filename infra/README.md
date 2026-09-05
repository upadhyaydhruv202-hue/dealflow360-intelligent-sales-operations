# Infrastructure

Docker Compose for local development.

## Full stack

From the repository root:

```bash
docker compose up --build
```

Starts the required services: `frontend`, `backend`, `worker`, `postgres`, and `redis`. Optional `nginx` is a Compose profile, not part of the default stack. There is no RabbitMQ or second database/cache container.

See [docs/docker.md](../docs/docker.md).

## Postgres and Redis only

Use this when you run Node on the host (`npm run dev`):

* PostgreSQL 16 (`localhost:5433`, databases `hackathon` and `hackathon_test`)
* Redis 7 (`localhost:6379`)

```bash
npm run deps:up
```

Stop:

```bash
npm run deps:down
```

`deps:up` / `deps:down` use the same Compose project as the full stack, so you can start Postgres/Redis first and later run `docker compose up --build` without a name conflict.

Data is stored in `docker-data/` at the repository root (gitignored).
