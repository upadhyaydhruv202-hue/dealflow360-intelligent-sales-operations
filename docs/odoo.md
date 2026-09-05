# Odoo integration

Reusable Odoo 19 JSON-2 connector. Future hackathons add **model adapters** and **capabilities**. They do not change the HTTP client, and they do not send Odoo credentials to React.

There is no generic “run any Odoo method” HTTP API. Frontend users never choose a model or method name.

## Purpose

Call Odoo from backend services with:

* API-key authentication
* validated arguments
* retries for safe transient failures
* normalized errors
* an allowlist/capability model for anything triggered by a user

Problem-specific partner, order, or inventory rules belong in adapters or `modules/problem/`.

## Architecture

```text
Controller (HTTP + zod + authenticate + requirePermission)
        │
        ▼
Application / problem service
        │
        ├── OdooService.execute(user, capability, method, params)
        │         RBAC → capability → validation → confirmation → adapter
        │
        └── Model adapter (res.partner, sale.order, …)
                  createOdooModelAdapter({ model, service, readCapability, writeCapability })
                  │
                  ▼
            OdooOperations  (private to OdooService; tests may construct it directly)
                  │
                  ▼
            OdooClient      (JSON-2 HTTP, timeout, retries, logging)
                  │
                  ▼
            Odoo 19  POST /json/2/<model>/<method>
```

Credentials stay in server env: `ODOO_BASE_URL`, `ODOO_DATABASE`, `ODOO_API_KEY`.

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `ODOO_ENABLED` / `FEATURE_ODOO` | `false` | Either flag enables the integration |
| `ODOO_BASE_URL` | unset | Origin only, no `/json/2` suffix |
| `ODOO_DATABASE` | unset | Sent as `X-Odoo-Database` |
| `ODOO_API_KEY` | unset | Bearer token; never log or return it |
| `ODOO_TIMEOUT_MS` | `15000` | Per-request abort |
| `ODOO_MAX_RETRIES` | `2` | Extra attempts after the first |
| `ODOO_RETRY_BASE_MS` | `200` | Exponential backoff base |

Production requires the URL, database, and API key when Odoo is enabled.

Create an API key in Odoo: **Preferences → Account Security → New API Key**. Prefer a dedicated bot user with the minimum Odoo access rights.

## Public HTTP API

Prefix: `/api/v1`. This is a connectivity probe, not a CRUD proxy.

| Method | Path | Auth | Permission | Description |
| --- | --- | --- | --- | --- |
| GET | `/odoo/health` | Bearer | `odoo.read` | Odoo connectivity using the server API key |

`GET /ready` also pings Odoo when the integration is enabled. Unconfigured Odoo is skipped and does not fail readiness.

## Low-level operations

Trusted backend **reads** may still call typed search/read helpers with a model name hardcoded in source. Privileged **writes** (`create` / `write` / `unlink` / `callMethod`) require `capability` plus the same RBAC and confirmation path as `execute()`. `service.operations` is not a public backdoor.

```ts
import { createOdooService } from '../integrations/odoo';

const odoo = createOdooService({ config, logger });

await odoo.search({ model: 'res.partner', domain: [['is_company', '=', true]], limit: 20 });
await odoo.create({
  model: 'res.partner',
  values: [{ name: 'Ada' }],
  capability: 'partners.write',
  user: req.user,
  confirmed: true,
});
```

Optional:

* `searchReadPaged({ page, pageSize, includeTotal })` — offset/limit pagination
* `operations.readBatched` / `createBatched` — chunk large id/value lists
* `searchRead(input, { ttlMs })` / `read(input, { ttlMs })` — opt-in cache hook; **never** used for writes

Retries apply to idempotent reads and to HTTP 429. Creates, writes, unlinks, and unknown methods are not retried on 5xx (the request may already have committed in Odoo).

## Allowlist / capabilities

Anything a logged-in user can trigger must go through `OdooService.execute`. The caller supplies a **capability name** and a **method**. They do not supply a model, and they cannot pass an arbitrary Odoo method.

```ts
import {
  createOdooCapabilityRegistry,
  odooReadCapability,
  odooWriteCapability,
} from '../integrations/odoo';
import { PERMISSIONS } from '../rbac';

const capabilities = createOdooCapabilityRegistry([
  odooReadCapability('partners.read', 'res.partner'),
  odooWriteCapability('partners.write', 'res.partner'),
  {
    name: 'orders.confirm',
    model: 'sale.order',
    methods: ['action_confirm'],
    permission: PERMISSIONS.ODOO_WRITE,
    risk: 'high',
    requiresConfirmation: true,
  },
]);

await odoo.execute({
  user: req.user,
  capability: 'orders.confirm',
  method: 'action_confirm',
  ids: [orderId],
  confirmed: true,
});
```

For each user-facing action the service:

1. Authenticates (your route uses `authenticate()`)
2. Authorizes the capability’s application permission (`odoo.read` / `odoo.write` or a tighter key you add)
3. Validates input
4. Validates that the method is on the capability (and therefore the model is fixed)
5. Requires `confirmed: true` when the capability says so

Application login is not Odoo access. `USER` can use the app without `odoo.read` or `odoo.write`. See [rbac.md](rbac.md).

## Model adapters

Adapters bind a technical model name to `OdooService.execute` with explicit read/write capabilities. They do not expose `OdooOperations`.

Put reusable, generic helpers next to the integration. Put hackathon-specific mapping and workflows in `modules/problem/`.

### partner.adapter

```ts
import { createOdooModelAdapter, type OdooService } from '../../../backend/src/integrations/odoo';

export interface PartnerRecord {
  id: number;
  name: string;
  email?: string;
  is_company?: boolean;
}

export function createPartnerAdapter(service: OdooService) {
  const partners = createOdooModelAdapter<PartnerRecord>({
    model: 'res.partner',
    service,
    readCapability: 'partners.read',
    writeCapability: 'partners.write',
  });

  return {
    ...partners,
    findCompanies(limit = 20, caller: { user?: { id: string; permissions: string[] } }) {
      return partners.searchRead({
        domain: [['is_company', '=', true]],
        fields: ['name', 'email'],
        limit,
        ...caller,
      });
    },
  };
}
```

Writes without `writeCapability` throw. `action_confirm` still must be allowlisted if a user can invoke it through HTTP.

Do not add these adapters to the reusable core unless they stay generic and unused by default. The factory `createOdooModelAdapter({ model, service, readCapability, writeCapability })` is the extension point.

## Health

* `OdooService.checkConnectivity()` — `res.users/context_get` with the server API key
* `GET /ready` — includes Odoo when enabled
* `GET /api/v1/odoo/health` — same check for operators with `odoo.read`

Demo mode does not invent a fake Odoo write. If Odoo is disabled, operations fail closed.

## Errors

Odoo HTTP statuses map onto the starter-kit error types:

| Odoo | App error |
| --- | --- |
| 401 | `AuthenticationError` (server API key, not the app user’s JWT) |
| 403 | `AuthorizationError` |
| 404 | `NotFoundError` |
| 429 | `RateLimitError` |
| 400 / 422 | `ValidationError` |
| 5xx | `ExternalServiceError` |
| timeout | `TimeoutError` |

Python tracebacks from Odoo are logged at most as status/metadata. They are not returned to clients. Secrets are redacted by the existing logger and error sanitizer.

## Tests

Mocks only. CI does not need a live Odoo:

* `backend/src/integrations/odoo/odoo.client.test.ts`
* `backend/src/integrations/odoo/odoo.service.test.ts`
* `backend/src/integrations/odoo/odoo.schemas.test.ts`

Covered: successful read, validation, authentication failure, permission failure, timeout, Odoo error, pagination, mocked write, allowlist, confirmation.

## Limitations

* One Odoo database and API key per process
* JSON-2 named arguments only (Odoo 19+)
* Each JSON-2 call is its own Odoo transaction; chain related writes in a single Odoo method when atomicity matters
* No blind caching of mutable or sensitive records
* API keys expire (Odoo caps duration); rotate `ODOO_API_KEY` operationally
* `search` / `searchRead` / `read` on `OdooService` remain ungated for trusted server code with a hardcoded model. Do not pass untrusted model names into those helpers.
