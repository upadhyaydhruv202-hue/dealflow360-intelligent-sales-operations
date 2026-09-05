# Problem module

Hackathon-specific code lives in this workspace (`@hackathon/problem`). The reusable platform never imports these files at compile time, so `backend` `rootDir: src` stays valid.

The platform **loads this package at runtime** and calls `register(host)` from `createApp` (API) and `createBackgroundWorker` (jobs). React pages are imported from `frontend/` by a thin shim in `frontend/src/problem.ts`.

DealFlow360 occupies this module. Host contract: [docs/problem-module.md](../../docs/problem-module.md).

## Layout

```text
modules/problem/
  src/                 Backend extension (compiled with this package)
    index.ts           Exports problemModule
    host.ts            Structural host types (no backend/src imports)
    permissions.ts     Extra RBAC keys
    dealflow/          DealFlow360 sales operations engine
  frontend/            Vite/React pages (bundled by the frontend app)
    index.ts           problemNav + problemRoutes
    dealflow/
  README.md            This inventory
```

DealFlow360 lives in `src/dealflow` and `frontend/dealflow`. Keep `src/index.ts` exporting one `problemModule`.

Do not put authentication, Odoo HTTP clients, AI providers, or generic notification engines here. Call them through `host` (`host.ai`, `host.odoo`, `host.odooAdapters.create`, `host.jobs`, `host.events`, registries).

## Where files go

| Kind | Location |
| --- | --- |
| Domain services, Zod, Odoo adapters, prompts, jobs, events | `modules/problem/src/<domain>/` |
| Thin HTTP (validate, authorize, call the service) | `modules/problem/src/<domain>/` routes + controllers |
| Repositories | `modules/problem/src/<domain>/` — receive `host.prisma` |
| Prisma models | `database/prisma/` (one ORM, one database) |
| RBAC keys | `problemModule.permissions` / `rolePermissions` (not `backend/src/rbac/catalog.ts`) |
| Capability metadata | `problemModule.capabilities` (platform catalog is `backend/src/capabilities`) |
| Copilot / intents / reports / automation / scheduler | `register(host)` using `host.copilot`, `host.intents`, `host.reports`, `host.automation`, `host.scheduler` |
| Pages / nav | `modules/problem/frontend/` |
| Problem tests | `modules/problem/src/**/*.test.ts` and `modules/problem/frontend/**/*.test.tsx` |

## Host (`register(host)`)

| Field | Use |
| --- | --- |
| `stage` | `'api'` or `'worker'` — mount HTTP only on `'api'` |
| `mount('/path', router)` | Mount under `/api/v1` |
| `http` | `Router`, `authenticate`, `requirePermission`, `parseBody` / `parseQuery` / `parseParams`, rate limits, `sendSuccess` |
| `jobs` | `process` / `enqueue` — register handlers on **both** API (tests/local) and worker |
| `events` | `on` / `emit` |
| `prisma` | Persistence; add models in `database/prisma` first |
| `copilot` / `intents` / `reports` / `automation` / `scheduler` | Existing registries |
| `ai` / `odoo` / `odooAdapters.create` | Integrations — never vendor SDKs |

Copilot tools still cannot expose arbitrary SQL, shell, HTTP, or Odoo methods. Automation cannot add JavaScript conditions or unrestricted HTTP/Odoo/SQL actions.

## Compile boundary

`@hackathon/problem` has its own `rootDir: src` and emits `dist/`. The API does not statically import those TypeScript files. It `require`s `modules/problem/src/index.ts` under `tsx` and `modules/problem/dist/index.js` in tests and production. Frontend typecheck/bundling includes `modules/problem/frontend` without a second SPA.

```bash
npm run build -w @hackathon/problem
npm run typecheck -w @hackathon/problem
npm test -w @hackathon/problem
```

DealFlow360 APIs live at `/api/v1/dealflow`. The public probe remains `GET /api/v1/problem`.
