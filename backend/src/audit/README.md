# Audit

Reusable audit trail for sensitive application actions. Events are written by services (never by controllers calling Prisma) and can be listed through an RBAC-protected API.

Never store passwords, raw JWTs, API keys, OTP values, or other secrets. Payloads are redacted before persist. Audit writes must not fail the original action.

## Stored fields

| Field | Notes |
| --- | --- |
| `actorId` | Authenticated user id when known (`user_id` in PostgreSQL) |
| `action` | Stable name such as `user.login` or `copilot.tool` |
| `resource` | Resource type or tool name |
| `resourceId` | Specific record id when useful |
| `timestamp` | `created_at` |
| `requestId` | From `x-request-id` / async context |
| `ip` | Client address when the write happens inside an HTTP request |
| `metadata` | Redacted JSON (`request` column; backward compatible with copilot/automation) |
| `oldValue` / `newValue` | Optional redacted snapshots |
| `status` | `succeeded`, `failed`, `denied`, and similar |

## Example actions

| Constant | Stored action |
| --- | --- |
| `USER_LOGIN` | `user.login` |
| `USER_CREATED` | `user.created` |
| `ODOO_RECORD_CREATED` | `odoo.record.created` |
| `ODOO_RECORD_UPDATED` | `odoo.record.updated` |
| `AI_ACTION_REQUESTED` | `ai.generate` |
| `AI_TOOL_EXECUTED` | `ai.tool` (copilot uses `copilot.tool`) |
| `FILE_UPLOADED` | `file.uploaded` |
| `REPORT_GENERATED` | `report.generated` |
| `NOTIFICATION_SENT` | `notification.sent` |
| `AUTOMATION_EXECUTED` | `automation.execute` |
| `RAG_INDEXED` | `rag.index` |
| `RAG_ASKED` | `rag.ask` |
| `ANOMALY_EVALUATED` | `anomaly.evaluate` |

Use `AUDIT_ACTIONS` in `backend/src/constants`. Problem-specific modules may add their own action names.

## Public interface

```text
GET /api/v1/audit
```

Requires authentication and `audit.read`. Admin has every catalog permission; manager receives `audit.read` by default.

Query parameters:

* `page`, `pageSize` (max 100)
* `actorId` (UUID)
* `action`
* `resource`
* `resourceId`
* `requestId`
* `from`, `to` (ISO timestamps)

Response `data.items` uses the fields above. Pagination lives in `meta`.

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

Include `getAuditContext()` so events pick up `requestId` and `ip` when a request is in flight. `AuditService.record` already merges that context.

## Tests

* unit: creation, redaction, pagination, filters
* HTTP: permission restrictions, pagination, actor/action/date filters, secret exclusion
