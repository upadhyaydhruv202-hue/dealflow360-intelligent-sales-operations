# Natural-language business actions

Safe intent engine: a user describes an operation in natural language, the model proposes **one registered command**, then the backend validates, authorizes, optionally confirms, and runs a handler. This is not a generic ChatGPT clone and it is not Copilot chat — it is a one-shot command pipeline with a pluggable registry.

## Architecture

```text
Natural language
 → authenticate + intents.use
 → AI extraction (structured JSON)
 → intent allowlist
 → input schema
 → RBAC (intent permission)
 → business-rule validation
 → confirmation when high-risk
 → handler
 → result
 → audit (no secrets)
```

```text
Controller → IntentService → AIService / IntentRegistry / ConfirmationStore / AuditService
```

Hackathons register new intents. They do not add arbitrary SQL, JavaScript, shell, HTTP, or Odoo-method intents.

## Enable

| Variable | Default | Notes |
| --- | --- | --- |
| `FEATURE_INTENTS` | `false` | Turns the HTTP API and `/intents` UI on |
| `FEATURE_AI` / `AI_ENABLED` | `false` | The engine still needs a ready AI provider |
| `DEMO_MODE` | `true` locally | Registers demo intents (`SEARCH_ORDERS`, `DELETE_RECORD`, …) |

Production still requires a real AI key unless `AI_PROVIDER=mock` and `DEMO_MODE=true`.

## HTTP API

Prefix `/api/v1`. Bearer token and `intents.use` required (manager and admin by default). AI rate limits apply.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/intents` | Allowlisted intents the server knows about |
| POST | `/intents/execute` | Parse an utterance or confirm a pending high-risk command |

Execute body:

```json
{
  "utterance": "Show pending orders above ₹50,000 this month.",
  "confirm": false,
  "confirmationToken": "optional-uuid"
}
```

`utterance` is required unless `confirm` is true. Confirmation executes the **server-stored** pending command for that token; it does not trust a client-supplied intent or filters.

Example AI extraction (never executed until the pipeline below succeeds):

```json
{
  "intent": "SEARCH_ORDERS",
  "input": {
    "status": "pending",
    "amountGreaterThan": 50000,
    "dateRange": "current_month"
  },
  "confidence": 0.91,
  "ambiguous": false
}
```

Response:

```json
{
  "status": "completed",
  "utterance": "Show pending orders above ₹50,000 this month.",
  "command": {
    "intent": "SEARCH_ORDERS",
    "input": {
      "status": "pending",
      "amountGreaterThan": 50000,
      "dateRange": "current_month"
    }
  },
  "confidence": 0.91,
  "authorized": true,
  "result": { "items": [] }
}
```

`status` is `completed`, `pending_confirmation`, `denied`, `invalid`, `ambiguous`, or `error`.

## Intent registry

Every intent defines:

* `name` (`SEARCH_ORDERS` — SCREAMING_SNAKE_CASE)
* `description`
* `inputSchema` (Zod)
* `requiredPermission`
* `riskLevel` (`low` \| `medium` \| `high`)
* `handler`
* optional `highRiskClass`, `actionKind`, `validate`, `needsConfirmation`, `outputSchema`, `examples`

```ts
registry.register({
  name: 'SEARCH_ORDERS',
  description: 'Search orders the caller may read',
  requiredPermission: 'intents.use',
  riskLevel: 'low',
  inputSchema: z.object({
    status: z.enum(['pending', 'processing', 'delivered']).optional(),
    amountGreaterThan: z.number().nonnegative().optional(),
    dateRange: z.enum(['current_month', 'last_month', 'current_year']).optional(),
  }),
  handler: async (input, context) => orders.search(input, context.user),
});
```

Register from `modules/problem` by calling `registry.register` (or pass `extra` into `createDefaultIntentRegistry`). Names such as `EXECUTE_SQL`, `SHELL`, or `FETCH` are rejected.

## High-risk operations

These classes **always** require explicit confirmation (`confirm: true` plus the server token):

| Class | Mapped action kind |
| --- | --- |
| `DELETE` | `deletion` |
| `BULK_UPDATE` | `bulk_change` |
| `SEND_EXTERNAL_MESSAGE` | `external_message` |
| `FINANCIAL_ACTION` | `financial` |

Demo intents: `DELETE_RECORD`, `BULK_UPDATE_ORDERS`, `SEND_CUSTOMER_MESSAGE`, `APPLY_CREDIT`.

## Security

Never executed, even if the model proposes them:

* raw SQL
* arbitrary JavaScript or shell
* arbitrary Odoo methods
* arbitrary HTTP requests

The model only fills a JSON envelope. Handlers are TypeScript functions you registered.

## Audit

Each attempt writes `audit_events` with action `intent.execute`:

* original utterance (redacted)
* parsed intent and input
* `authorized`
* `action` / intent name
* `outcome` (`completed`, `denied`, `pending_confirmation`, …)

## Demo intents

When `DEMO_MODE=true`, the kit registers in-memory catalog intents (replace with repositories in a hackathon):

| Intent | Permission | Risk |
| --- | --- | --- |
| `SEARCH_CUSTOMERS` | `intents.use` | low |
| `SEARCH_ORDERS` | `intents.use` | low |
| `GET_INVOICE` | `intents.use` | low |
| `GENERATE_REPORT` | `reports.generate` | low |
| `SUMMARIZE_CUSTOMER` | `intents.use` | low |
| `CREATE_TASK` | `intents.use` | medium |
| `DELETE_RECORD` | `intents.use` | high / `DELETE` |
| `BULK_UPDATE_ORDERS` | `intents.use` | high / `BULK_UPDATE` |
| `SEND_CUSTOMER_MESSAGE` | `intents.use` | high / `SEND_EXTERNAL_MESSAGE` |
| `APPLY_CREDIT` | `intents.use` | high / `FINANCIAL_ACTION` |

## Frontend

`/intents` is gated by `FEATURE_INTENTS`. Sign in at `/login` (after seed: `demo.admin@example.com` / `demo-password`). The page uses `AuthProvider`; it does not paste raw JWTs.

## Tests

* valid intent
* invalid / unknown intent
* malformed structured AI response
* unauthorized intent
* destructive confirmation (`DELETE` / financial)
* confirmation token replay and binding to the issuing user
* ambiguous or low-confidence request
* forbidden registry names

## Limitations

* Confirmation tokens use the shared `KvStore` (Redis when `REDIS_URL` is set, otherwise in-process memory) with a 10-minute TTL. Consume is single-use (`SET NX`) so two API replicas cannot both confirm the same delete.
* Staff and user roles do not receive `intents.use` by default (same pattern as `copilot.use`).
* Demo handlers use in-memory records. They are not a business database.
* Extraction quality depends on the model. Low confidence and `UNKNOWN` never run a handler.
