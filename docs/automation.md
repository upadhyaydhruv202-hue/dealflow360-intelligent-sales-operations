# Automation engine

Generic trigger → condition → action workflows. Future hackathons register a trigger, optionally a condition operator, and an action, then create a rule. They do not modify engine internals.

```text
Event
  → EventBus
  → enabled rules for that trigger (priority, then createdAt)
  → declarative conditions (no JavaScript)
  → idempotent execution row
  → job automation.execute
  → ordered actions (RBAC, schema, destructive policy)
  → retries, status, audit
```

```text
Controller → AutomationService → Engine / Registries / Store
                                 → Email / Notifications / PDF / AI / Odoo / Jobs / Audit
```

## Enable

| Variable | Default | Notes |
| --- | --- | --- |
| `FEATURE_AUTOMATION` | `false` | Turns the HTTP API, event matching, and workers on |
| `SCHEDULER_ENABLED` | follows automation | See [scheduler.md](scheduler.md) |

Core events when the flag is on:

* `user.created` after register
* `document.uploaded` after a document is stored
* `report.completed` after a PDF is generated
* `anomaly.detected` after statistical detection finds an anomaly (`FEATURE_ANOMALY_DETECTION`)

`order.*`, `invoice.overdue`, `scheduled`, and `webhook.received` are registered so problem modules can emit them. The built-in scheduler emits `scheduled` with `payload.schedule` (default `tick`) on `SCHEDULER_INTERVAL`. See [scheduler.md](scheduler.md).

## HTTP API

Prefix `/api/v1`. Bearer token required.

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| GET | `/automations/catalog` | `automations.read` | Registered triggers, operators, and actions |
| GET | `/automations/rules` | `automations.read` | List rules |
| POST | `/automations/rules` | `automations.write` | Create a rule |
| GET | `/automations/rules/:id` | `automations.read` | Get a rule |
| PATCH | `/automations/rules/:id` | `automations.write` | Update a rule (clears validation) |
| POST | `/automations/rules/:id/validate` | `automations.write` | Schema + policy validation (required before enabling AI rules) |
| POST | `/automations/rules/:id/enable` | `automations.write` | Enable a rule |
| POST | `/automations/rules/:id/disable` | `automations.write` | Disable a rule |
| GET | `/automations/executions` | `automations.read` | Execution history |
| GET | `/automations/executions/:id` | `automations.read` | One execution plus action runs |
| POST | `/automations/events` | `automations.execute` | Emit a registered trigger |
| POST | `/automations/webhooks` | `automations.execute` | Emit `webhook.received` |

Example rule:

```json
{
  "name": "Remind late invoices",
  "trigger": "invoice.overdue",
  "enabled": true,
  "conditions": [
    { "field": "daysOverdue", "operator": "greaterThan", "value": 7 }
  ],
  "actions": [
    { "type": "sendEmail", "template": "invoice-reminder", "toField": "email" }
  ]
}
```

## Conditions

Operators: `equals`, `notEquals`, `greaterThan`, `lessThan`, `greaterOrEqual`, `lessOrEqual`, `contains`, `in`, `exists`.

Field paths are dotted identifiers (`customer.email`). `__proto__` and similar keys are rejected. Arbitrary JavaScript is never evaluated. Register extra operators with `registries.operators.register(name, (field, value) => boolean)`.

## Actions

Built-in types (all schema-validated):

| Type | Permission | Destructive |
| --- | --- | --- |
| `sendEmail` | `notifications.write` | no |
| `sendNotification` | `notifications.write` | no |
| `generatePDF` | `reports.generate` | no |
| `queueAIAnalysis` | `ai.use` | no |
| `callOdoo` | `odoo.read` (writes need `odoo.write`) | writes only |
| `createAuditLog` | `automations.write` | no |
| `enqueueJob` | `automations.execute` | no (allowlisted job names) |
| `webhook` | `automations.execute` | yes (SSRF-safe HTTPS POST; mocked in demo mode) |
| `updateRecord` | `automations.write` | yes (registered resource updaters only) |

Creating a rule requires the caller to hold every action's permission. At execution, if the event has an actor, those permissions are checked again.

Destructive actions (`webhook`, `updateRecord`, Odoo `create`/`write`/`unlink`) require `allowDestructive: true` on the rule. Odoo writes also require `confirmed: true` on the action itself; `allowDestructive` no longer implies confirmation. Actorless (scheduled) Odoo writes use the same `confirmed` flag rather than skipping the confirmation gate.

AI-generated rules (`source: "ai"`) are stored disabled. Call validate, then enable.

## Extending

```ts
registries.triggers.register({ name: 'inventory.low', description: 'Stock below reorder point' });
registries.actions.register(defineAutomationAction({
  type: 'createPurchaseOrder',
  description: 'Create a purchase order',
  requiredPermission: 'inventory.write',
  destructive: false,
  inputSchema: z.object({ type: z.literal('createPurchaseOrder'), sku: z.string() }),
  handler: async (input, context) => problemService.createPo(input, context),
}));
registries.recordUpdaters.register({
  resource: 'inventory.item',
  handler: async ({ id, data }) => inventoryRepo.update(id, data),
});
registries.allowedJobs.allow('inventory.sync');
```

Emit from a problem service:

```ts
await events.emit({
  type: 'inventory.low',
  id: eventIdFor('inventory.low', sku),
  payload: { sku, quantity: 2 },
});
```

Do not add SQL, shell, eval, or arbitrary HTTP/Odoo-method actions.

## Execution

* Rules for a trigger run in priority order (lower number first), then `createdAt`
* Duplicate `(ruleId, eventId)` is skipped
* Job `automation.execute` retries (`AUTOMATION.JOB_ATTEMPTS`, backoff)
* Succeeded actions are not re-run on retry
* Status: `queued` → `running` → `succeeded` | `failed`
* Each run is audited (`automation.execute`, `automation.rule`)

## Frontend

`/automations` lists rules, creates the invoice-reminder example, creates a `scheduled` tick rule, toggles enable, and emits `invoice.overdue`. Sign in at `/login` with an account that has `automations.read` / `automations.write` / `automations.execute` (manager and admin after seed).

## Tests

Unit tests cover matching, non-matching, disabled, failure, retry, idempotency, authorization, invalid rules, and AI validation. HTTP tests cover catalog, create, validation errors, and 403.

## Limitations

* `updateRecord` does nothing until a resource updater is registered (`demo.invoice` in demo mode)
* Outbound webhooks are mocked when `DEMO_MODE=true`
* In-memory executions are used in unit tests; PostgreSQL is used in the running app
