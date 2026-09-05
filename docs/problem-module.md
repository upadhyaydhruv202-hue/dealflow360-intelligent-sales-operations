# Problem module extension

The kit is a **modular monolith**. Hackathon-specific code is an isolated workspace at `modules/problem` (`@hackathon/problem`). It is not a microservice.

## Why this shape

Backend `tsc` emit sets `rootDir` to `backend/src`. Importing `modules/problem/**/*.ts` from `backend/src` would pull those files into the API compilation and break emit (or dump `dist/` as `backend/src` + `modules/problem`).

The smallest compatible fix:

1. **Platform contract** in `backend/src/problem/` (`ProblemHost`, `loadProblemModule`, `applyProblemModule`). This folder is generic infrastructure, not a domain.
2. **Problem implementation** in `modules/problem`, compiled with its own `rootDir: src`.
3. **Runtime load** from `createApp` and `createBackgroundWorker` (no static `import` of problem source into the API emit graph).
4. **Frontend pages** in `modules/problem/frontend`, registered by `frontend/src/problem.ts` (Vite has no `rootDir` emit constraint).

```text
API / worker boot
  → loadProblemModule()          # src under tsx; dist in tests and production
  → applyProblemModule(host)
       → permissions already merged at RBAC seed
       → register(host)          # routes, jobs, events, registries

React boot
  → frontend/src/problem.ts
  → problemRoutes / problemNav
```

## Plug-in checklist for a new statement

1. Domain code lives in `modules/problem/src/dealflow`. Keep exporting `problemModule` from `src/index.ts`.
2. Declare extra permissions on the module. `seedRbacCatalog` / startup catalog sync merges them. Do not add statement-specific keys to `backend/src/rbac/catalog.ts`.
3. Optionally declare `capabilities` on the module (see [capabilities.md](capabilities.md)). DealFlow360 registers `problem.dealflow`.
4. In `register(host)`:
   - `host.stage === 'api'`: `host.mount('/your-path', router)` with `host.http.authenticate`, `requirePermission`, and `parseBody` / `parseQuery` / `parseParams`.
   - Always: `host.jobs.process(...)` so the worker can run the job (`JOBS_PROCESS=false` on the Compose API).
   - Optional: `host.events.on`, `host.copilot.register`, `host.intents.register`, `host.reports.registerTemplate`, `host.automation.triggers.register`, `host.scheduler.register`, `host.odooAdapters.create`.
5. Add Prisma models only in `database/prisma`. Repositories in the problem package receive `host.prisma`.
6. Add pages under `modules/problem/frontend` and export them from `frontend/index.ts` (`problemNav`, `problemRoutes`). Compose `frontend/src/ui`; call `/api/v1/...` through `frontend/src/services/api`.
7. Tests next to problem code. HTTP/worker proof: `backend/tests/problem.http.test.ts`.

Controllers stay thin: schema, authz, call a problem service. Services may use `host.ai` / `host.odoo` — never Gemini, Odoo, SMTP, or S3 SDKs.

## Problem slot

DealFlow360 occupies this slot:

| Surface | Proof |
| --- | --- |
| `GET /api/v1/problem` | Public manifest (`id: dealflow`) |
| `/api/v1/dealflow/*` | Quote governance, approvals, fulfillment, billing |
| Job `dealflow.odoo.sync` | Registered on API (when processing jobs) and worker |
| `/dealflow` | Frontend workspace probe |

## Related

* Inventory and layout: [modules/problem/README.md](../modules/problem/README.md)
* RBAC: [rbac.md](rbac.md)
* Jobs: [jobs.md](jobs.md)
