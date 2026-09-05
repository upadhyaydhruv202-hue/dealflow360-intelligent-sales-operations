# Audit

Reusable audit logging for sensitive actions. Events persist to PostgreSQL (`audit_events`) through `AuditService` and can be listed on an RBAC-protected API.

Never store passwords, raw JWTs, API keys, OTP values, or other secrets. Payloads are redacted before write. A failed audit persist must not fail the original action.

See `backend/src/audit/` for the implementation.

## Architecture

```text
Service
  → AuditService.record (redact + request context)
    → AuditRepository
      → audit_events
```

```text
GET /api/v1/audit
  → authenticate + requirePermission("audit.read")
  → AuditController
  → AuditService.list
```

## Stored fields

| Field | Notes |
| --- | --- |
| `actorId` | User id when known (`user_id` column) |
| `action` | Stable name such as `user.login` |
| `resource` | Resource type or tool name |
| `resourceId` | Specific record id |
| `timestamp` | `created_at` |
| `requestId` | From `x-request-id` / async context |
| `ip` | Client address when recorded during an HTTP request |
| `metadata` | Redacted JSON (stored in `request` for compatibility) |
| `oldValue` / `newValue` | Optional redacted snapshots |
| `status` | `succeeded`, `failed`, `denied`, and similar |

## Example actions

Constants live in `AUDIT_ACTIONS` (`backend/src/constants`).

| Name | Stored action |
| --- | --- |
| USER_LOGIN | `user.login` |
| USER_CREATED | `user.created` |
| USER_PASSWORD_RESET | `user.password_reset` |
| ROLE_CREATED | `rbac.role.created` |
| PERMISSION_CREATED | `rbac.permission.created` |
| ROLE_PERMISSION_ASSIGNED | `rbac.role.permission_assigned` |
| USER_ROLE_ASSIGNED | `rbac.user.role_assigned` |
| ODOO_RECORD_CREATED | `odoo.record.created` |
| ODOO_RECORD_DELETED | `odoo.record.deleted` |
| ODOO_METHOD_CALLED | `odoo.method.called` |
| AI_ACTION_REQUESTED | `ai.generate` |
| AI_TOOL_EXECUTED | `ai.tool` (copilot uses `copilot.tool`) |
| INTENT_EXECUTED | `intent.execute` |
| PROBLEM_INTELLIGENCE_ANALYZED | `problem.intelligence.analyzed` |
| CAPABILITY_RECOMMENDATIONS_GENERATED | `capability.recommendations.generated` |
| PROJECT_PLANNING_ANALYZED | `project.planning.analyzed` |
| PROJECT_PLANNING_APPROVED | `project.planning.approved` |
| FILE_UPLOADED | `file.uploaded` |
| FILE_DELETED | `file.deleted` |
| REPORT_GENERATED | `report.generated` |
| NOTIFICATION_SENT | `notification.sent` |
| AUTOMATION_EXECUTED | `automation.execute` |
| RAG_INDEXED | `rag.index` |
| RAG_ASKED | `rag.ask` |
| ANOMALY_EVALUATED | `anomaly.evaluate` |

Hackathons may add problem-specific action names. Copilot, intents, problem intelligence, capability recommendations, project planning, automation, RAG, and anomaly already write additional actions (`copilot.tool`, `intent.execute`, `problem.intelligence.analyzed`, `capability.recommendations.generated`, `project.planning.analyzed`, `project.planning.approved`, `automation.rule`, `rag.index`, `rag.ask`, `rag.delete`, `anomaly.evaluate`).

## API

`GET /api/v1/audit` requires authentication and `audit.read`. Admin has the full catalog; manager receives `audit.read` by default.

Query:

* `page`, `pageSize` (max 100)
* `actorId`
* `action`
* `resource`
* `resourceId`
* `requestId`
* `from`, `to` (ISO timestamps)

`data.items` is the event list. Pagination is in `meta`.

## Usage

```ts
await audit.record({
  actorId: user.id,
  action: AUDIT_ACTIONS.FILE_UPLOADED,
  resource: 'file',
  resourceId: file.id,
  metadata: { purpose: file.purpose, size: file.size },
  status: 'succeeded',
});
```

`record` merges `requestId`, `ip`, and `actorId` from async request context when those fields are omitted.

## Tests

* unit: creation, redaction, store failure, pagination, actor/action/date filters
* HTTP: unauthenticated, missing permission, list after register/login, secret exclusion, pagination, password reset, RBAC catalog mutations

## Limitations

* Failed logins are audited without passwords or unknown emails
* Metadata is truncated if it exceeds `AUDIT.MAX_JSON_CHARS`
* Listing requires a database; there is no anonymous public audit feed
* `actorId` is stored only when it is a user UUID (non-UUID values such as `system` are omitted)
* Odoo write audits store model, ids, and field names — not field values
