# Role-based access control

Reusable authorization on top of authentication. Identity is `authenticate()`. Access is roles and `resource.action` permissions loaded from PostgreSQL on each request.

Frontend checks are UX only. Backend middleware and services are authoritative.

## Model

```text
User
  → Role (many)
    → Permission (many)
```

A user may hold multiple roles. Effective permissions are the **union** of those roles. There is no hardcoded ADMIN bypass in middleware: ADMIN is a seeded role that is granted the default catalog, not a special case in `requirePermission`.

Default roles (configurable; stored lowercase, matched case-insensitively):

| Role | Typical use |
| --- | --- |
| `admin` (`ADMIN`) | Full starter-kit catalog |
| `manager` (`MANAGER`) | Users, reports, notifications, Odoo reads |
| `staff` (`STAFF`) | Operational access, including `odoo.read` |
| `user` (`USER`) | Application login without Odoo access |

`AUTH_DEFAULT_ROLE` (default `user`) is assigned on register when that role exists.

## Permission format

Keys are `resource.action` (lowercase, dotted). Examples already in the catalog:

* `users.read` / `users.write`
* `reports.generate`
* `notifications.read`
* `odoo.read` / `odoo.write`
* `ai.use`
* `copilot.use`
* `intents.use`
* `problem.analyze`
* `capabilities.recommend`
* `projects.plan`
* `projects.generate`
* `rag.use`
* `search.use` / `search.write`
* `anomaly.use`
* `documents.analyze` / `documents.read`
* `files.read` / `files.write`
* `automations.read` / `automations.write` / `automations.execute`
* `jobs.read`
* `audit.read`
* `admin.settings`

Future hackathons add keys such as `inventory.approve` on `problemModule.permissions` in `modules/problem` **without changing middleware internals**. Catalog seed merges those keys. Do not put statement-specific permissions in `backend/src/rbac/catalog.ts`.

## Middleware

```ts
import { authenticate } from '../auth';
import { authorizeRole, requirePermission } from '../rbac';

router.get('/reports', authenticate, requirePermission('reports.generate'), controller.generate);
router.delete('/settings', authenticate, authorizeRole('ADMIN'), controller.reset);
```

* `authorizeRole("ADMIN")` — caller must have **at least one** of the listed roles (`ADMIN` and `admin` are the same).
* `requirePermission("reports.generate")` — caller must have **every** listed permission.
* Missing `authenticate()` fails closed with `401`.
* Wrong role or permission returns `403 AUTHORIZATION_ERROR`.

Use `hasRole` / `hasPermission` / `assertPermission` in services for non-HTTP checks.

Do not authorize from the JWT `role` claim. `authenticate()` reloads roles and permissions from the database so assignments take effect before the access token expires.

## Odoo is independent of application login

Being allowed to use the app is not permission to change Odoo records.

| Role | App login | `odoo.read` | `odoo.write` |
| --- | --- | --- | --- |
| USER | yes | no | no |
| STAFF | yes | yes | no |
| MANAGER | yes | yes | no |
| ADMIN | yes | yes | yes |

Future Odoo routes must use `requirePermission("odoo.read")` or `requirePermission("odoo.write")`. Do not treat `authorizeRole("ADMIN")` as a substitute for an Odoo permission unless that is an explicit product decision.

`GET /api/v1/odoo/health` is the only generic Odoo HTTP route. It checks connectivity. It does not execute user-supplied models or methods. See [odoo.md](odoo.md).

AI routes require `ai.use`. Manager and admin receive it by default. See [ai.md](ai.md).

Copilot routes require `copilot.use`. Manager and admin receive it by default. Each tool still checks its own permission. See [copilot.md](copilot.md).

Natural-language action routes require `intents.use`. Manager and admin receive it by default. Each intent still checks its own permission. See [intents.md](intents.md).

Problem-statement intelligence requires `problem.analyze`. Manager and admin receive it by default. The model cannot execute tools. See [problem-intelligence.md](problem-intelligence.md).

Capability recommendations require `capabilities.recommend`. Manager and admin receive it by default. The engine is deterministic and advisory; it does not enable flags. See [capability-recommendations.md](capability-recommendations.md).

RAG routes require `rag.use`. Manager and admin receive it by default. The module stays off until `FEATURE_RAG=true`. See [rag.md](rag.md).

Search routes require `search.use` (query) and `search.write` (index/delete). Manager and admin receive both; staff receives `search.use`. The module stays off until `FEATURE_SEARCH=true`. See [search.md](search.md).

Analytics routes require `analytics.read` (query/dashboards), `analytics.write` (ingest), and `analytics.export` (CSV/JSON). Manager and admin receive all three; staff receives `analytics.read`. The module stays off until `FEATURE_ANALYTICS=true`. See [analytics.md](analytics.md).

Anomaly routes require `anomaly.use`. Manager and admin receive it by default. The module stays off until `FEATURE_ANOMALY_DETECTION=true`. See [anomaly.md](anomaly.md).

Document intelligence routes require `documents.analyze` / `documents.read`. Manager and admin receive them by default. See [documents.md](documents.md).

File upload routes require `files.read` / `files.write`. User, staff, manager, and admin receive them by default. Callers only access their own files unless they have `admin.settings`. See [storage.md](storage.md).

Automation routes require `automations.read`, `automations.write`, or `automations.execute`. Manager and admin receive all three; staff can read. See [automation.md](automation.md).

Job status (`GET /api/v1/jobs/:jobId`) requires `jobs.read`. Staff, manager, and admin receive it by default. See [jobs.md](jobs.md).

Optional realtime (`GET /api/v1/realtime/events`) reuses those same keys (`jobs.read`, `notifications.read`, `automations.read`, `documents.read`). There is no extra permission. Off unless `FEATURE_REALTIME=true`. See [realtime.md](realtime.md).

## Public HTTP API

Prefix: `/api/v1`. All of these require a bearer token **and** a catalog permission.

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| GET | `/roles` | `roles.read` | List roles and their permission keys |
| POST | `/roles` | `roles.write` | Create a role |
| GET | `/permissions` | `roles.read` | List permission keys |
| POST | `/permissions` | `roles.write` | Create a permission key |
| POST | `/roles/:roleName/permissions` | `roles.write` | Grant a permission to a role |
| POST | `/users/:userId/roles` | `roles.write` | Assign a role to a user |

`GET /api/v1/auth/me` returns `roles` and `permissions` for UI rendering. That list is not an authorization decision.

## Adding a permission for a hackathon

### 1. Catalog (recommended for defaults)

Edit `backend/src/rbac/catalog.ts`:

```ts
export const PERMISSIONS = {
  // ...
  INVENTORY_APPROVE: 'inventory.approve',
} as const;

// add to DEFAULT_PERMISSIONS, then to the roles that should have it
```

Re-run `npm run db:seed` in production, or restart the API locally. Outside production and test, startup upserts the default catalog (roles, permission keys, and default role grants). Seed is additive; it does not delete custom keys.

ADMIN receives every **catalog** key through seed data. A key created only via the API is not auto-granted to ADMIN.

### 2. API (runtime / demo)

```http
POST /api/v1/permissions
Authorization: Bearer <admin-access-token>
Content-Type: application/json

{
  "key": "inventory.approve",
  "description": "Approve inventory adjustments"
}
```

```http
POST /api/v1/roles/staff/permissions
Authorization: Bearer <admin-access-token>
Content-Type: application/json

{ "key": "inventory.approve" }
```

### 3. Protect the route

```ts
router.post(
  '/inventory/:id/approve',
  authenticate,
  requirePermission('inventory.approve'),
  controller.approve,
);
```

No changes to `authorizeRole` / `requirePermission` internals.

### 4. Optional custom role

```http
POST /api/v1/roles
{ "name": "inventory_manager", "description": "Approve stock movements" }

POST /api/v1/roles/inventory_manager/permissions
{ "key": "inventory.approve" }

POST /api/v1/users/<user-id>/roles
{ "role": "inventory_manager" }
```

## Frontend (UX only)

`frontend/src/lib/rbac.ts` helpers hide buttons and routes. Never skip the backend check because the UI hid a control.

```ts
if (hasPermission(user, 'odoo.write')) {
  // show "Sync to Odoo"
}
```

## Tests

* correct / missing role
* correct / missing permission
* unauthenticated access
* multiple roles (permission union)
* protected catalog routes
* new keys such as `inventory.approve` without middleware changes
* ADMIN does not bypass unassigned permissions
* USER can call `/auth/me` but cannot obtain Odoo write rights from login alone

## Limitations

* Permissions are loaded on each authenticated request (no cache). Fine for hackathon scale.
* Seed is additive; unused roles from earlier demos (for example `member`) are not deleted.
* Outside production and test, API startup syncs the default catalog so new keys (for example `jobs.read`) are granted without a manual seed. Production must still run `npm run db:seed`.
* There is no permission-revocation HTTP endpoint yet (remove rows in the database or add one in a later module).
