# Backend

Express API for the starter kit.

## Foundation

* Prisma persistence (PostgreSQL)
* Authentication (`/api/v1/auth/*`, JWT, `authenticate()` middleware)
* RBAC (`authorizeRole`, `requirePermission`, `/api/v1/roles`, `/api/v1/permissions`)
* Odoo 19 JSON-2 integration (`docs/odoo.md`, `/api/v1/odoo/health`)
* Provider-agnostic AI (`docs/ai.md`, `/api/v1/ai/*`)
* Zod validation and centralized `AppError` handling
* Standard `/api/v1` response envelopes
* `GET /health` and `GET /ready`
* Docker Compose API and worker images (see `docs/docker.md`)
* Graceful shutdown for HTTP, PostgreSQL, and Redis
* Extension directories for later modules

## Scripts

```bash
npm run dev -w backend
npm run db:migrate
npm run db:seed
npm test -w backend
npm run test:watch -w backend
npm run test:coverage -w backend
npm run test:e2e -w backend
npm run lint -w backend
npm run typecheck -w backend
npm run build -w backend
```

## Layout

See `ARCHITECTURE.md`. Problem-specific code does not belong in this package; put it in `modules/problem/`.
