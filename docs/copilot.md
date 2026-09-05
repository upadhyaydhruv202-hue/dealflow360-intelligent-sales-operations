# Copilot

Controlled assistant that can answer questions and call **allowlisted** application tools. This is not a generic ChatGPT clone: the model proposes tools, then the backend authenticates, authorizes, validates, optionally confirms, executes a registered handler, and audits the attempt.

## Architecture

```text
User message
 → authenticate + copilot.use
 → AI planner (structured JSON)
 → tool allowlist
 → RBAC (tool permission)
 → input schema
 → confirmation when high-risk
 → handler
 → optional output schema
 → assistant reply
 → audit (no secrets)
```

```text
Controller → CopilotService → AIService / ToolRegistry / ConversationStore / AuditService
```

Hackathons register new tools. They do not add arbitrary SQL, JavaScript, shell, HTTP, or Odoo-method tools.

## Enable

| Variable | Default | Notes |
| --- | --- | --- |
| `FEATURE_COPILOT` | `false` | Turns the HTTP API and service on |
| `FEATURE_AI` / `AI_ENABLED` | `false` | Copilot still needs a ready AI provider |
| `DEMO_MODE` | `true` locally | Registers demo tools (`getCustomer`, `searchOrders`, `getInvoice`, `deleteRecord`) |

Production still requires a real AI key unless `AI_PROVIDER=mock` with `DEMO_MODE=true` and `ALLOW_DEMO_IN_PRODUCTION=true`.

## HTTP API

Prefix `/api/v1`. Bearer token and `copilot.use` required (manager and admin by default).

| Method | Path | Description |
| --- | --- | --- |
| GET | `/copilot/tools` | Allowlisted tools the server knows about |
| POST | `/copilot/chat` | Send a message or confirm a pending high-risk tool |
| GET | `/copilot/conversations` | List the caller's threads |
| GET | `/copilot/conversations/:id` | Thread plus messages |
| POST | `/copilot/conversations/:id/clear` | Delete messages, keep the id |
| DELETE | `/copilot/conversations/:id` | Delete the thread |

Chat body:

```json
{
  "message": "Look up customer cust-1001",
  "conversationId": "optional-uuid",
  "confirm": false
}
```

`message` is required unless `confirm` is true. Confirmation consumes a single-use pending record for that conversation (same pattern as intents). A second `confirm: true` is rejected. The client does not supply the tool list.

Response:

```json
{
  "conversationId": "...",
  "status": "completed",
  "message": {
    "id": "...",
    "role": "assistant",
    "content": "Used getCustomer.",
    "confidence": 0.88,
    "evidence": "The question named a customer lookup."
  },
  "tools": [
    {
      "name": "getCustomer",
      "status": "success",
      "riskLevel": "low",
      "arguments": { "id": "cust-1001" },
      "result": { "id": "cust-1001", "name": "Northwind Traders" }
    }
  ]
}
```

`status` is `completed`, `pending_confirmation`, or `error`. Tool statuses: `success`, `failed`, `denied`, `invalid_arguments`, `pending_confirmation`.

## Tool registry

Every tool defines:

* `name` (camelCase)
* `description`
* `inputSchema` (Zod)
* `requiredPermission`
* `handler`
* `riskLevel` (`low` \| `medium` \| `high`)
* optional `needsConfirmation(input)` and `outputSchema`

```ts
registry.register({
  name: 'searchOrders',
  description: 'Search orders the caller may read',
  requiredPermission: 'orders.read',
  riskLevel: 'low',
  inputSchema: z.object({ customerId: z.string().uuid() }),
  handler: async (input, context) => orders.search(input.customerId, context.user),
});
```

Register from `modules/problem` by calling `registry.register` (or pass extra tools into `createDefaultCopilotRegistry` once you wire that module). Names such as `executeSql`, `shell`, or `fetch` are rejected.

Built-in tools (when the matching service exists):

| Tool | Permission | Risk |
| --- | --- | --- |
| `listNotifications` | `notifications.read` | low |
| `createNotification` | `notifications.write` | medium; high/confirm if `email: true`. Always notifies the current user |
| `generateReport` | `reports.generate` | low |
| `summarizeDocument` | `documents.read` | low |
| `getDocument` | `documents.read` | low |
| `searchOdooRecords` | `odoo.read` | low; capability + read method allowlist only |
| `searchKnowledge` | `rag.use` | low; only when `FEATURE_RAG` is on |
| `searchRecords` | `search.use` | low; only when `FEATURE_SEARCH` is on |
| `queryAnalytics` | `analytics.read` | low; only when `FEATURE_ANALYTICS` is on |
| `detectAnomaly` | `anomaly.use` | low; only when `FEATURE_ANOMALY_DETECTION` is on |

Demo tools (DEMO_MODE): `getCustomer`, `searchOrders`, `getInvoice`, `deleteRecord` (high-risk, confirmation required). Replace them with repository-backed tools for a real problem.

## Security

Before a handler runs:

1. Authentication
2. `copilot.use` on the route
3. Tool name must exist in the registry
4. Caller must have the tool's permission
5. Arguments must match the tool schema
6. High-risk tools (delete, bulk update, financial, external messaging) need `confirm: true`

The planner never receives handlers. Conversation history and audit rows are redacted (`password`, `token`, `apiKey`, and similar). Tool execution uses the shared AI guardrails executor (`executeAiTool`): allowlist, RBAC, schema, high-risk confirmation, and audit. See [ai-guardrails.md](ai-guardrails.md).

## Audit

Each tool attempt writes `audit_events` with action `copilot.tool`:

* user
* tool name (`resource`)
* redacted request
* result status
* timestamp
* request ID

## Frontend

`frontend/src/ui/ai/CopilotChat.tsx` is the reusable transcript (re-exported from `frontend/src/components/CopilotChat.tsx`): messages, loading, retry, clear, tool status, confidence/evidence, and a confirmation prompt. Related surfaces (`AiResponseCard`, `EvidencePanel`, `AiConfidenceBadge`, `ToolActivityIndicator`) live in `frontend/src/ui`. See [ui.md](ui.md).

`/copilot` is a demo page. Sign in at `/login` (after seed: `demo.admin@example.com` / `demo-password`). The page uses `AuthProvider`; it does not paste raw JWTs.

## Tests

Covered:

* normal question
* tool invocation
* unauthorized tool
* invalid tool arguments
* destructive confirmation
* AI failure
* tool failure (no secret leakage)
* HTTP authz and clear conversation

## Limitations

* The planner can propose at most three tools per turn
* Demo catalog data is in-memory and resets with the process
* Staff and user roles do not receive `copilot.use` by default
* `searchOdooRecords` only works after you register Odoo capabilities
