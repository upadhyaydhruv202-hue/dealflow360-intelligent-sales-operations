# AI guardrails

Shared safety and control layer for every AI call in this starter kit. The model is an untrusted reasoning component. The application remains authoritative.

See `backend/src/integrations/ai/guardrails/` for the implementation.

## Pipeline

```text
User
 → authentication
 → authorization (ai.use / copilot.use / intents.use / problem.analyze / rag.use / documents.analyze)
 → input validation and size limits
 → secret redaction
 → untrusted-data fencing and prompt-injection detection
 → AI provider (timeouts + retries)
 → output schema validation
 → confidence / review policy
 → tool allowlist + permission + confirmation
 → approved action
 → audit (no secrets)
```

Controllers and problem modules still call `AIService` or `executeAiTool`. They do not talk to Gemini directly, and they do not execute model output.

## What is enforced

| Control | Behavior |
| --- | --- |
| Input limits | `AI_GUARDRAILS.MAX_INPUT_CHARS` (100,000). HTTP and service schemas also cap prompts, messages, and system text |
| Output schema validation | Structured results are JSON-extracted and parsed with Zod (`source: 'ai'`). Invalid output is rejected, with one parse retry |
| Sensitive-data filtering | Prompts, tool args, and audit payloads redact passwords, API keys, tokens, PEMs, JWTs, AWS key IDs, and Bearer headers before they leave the app |
| Tool allowlisting | Tools must be registered with `name`, `requiredPermission`, `inputSchema`, `riskLevel`, and `handler`. Names such as `executeSql`, `shell`, and `fetch` cannot be registered |
| Permission checks | `executeAiTool` requires the caller's RBAC permission. Missing tools and missing permissions are `denied` |
| Confirmation | High-risk tools and action kinds (`deletion`, `bulk_change`, `financial`, `external_message`, `privileged_odoo`) need an explicit `confirmed: true` from the application confirm flow. `confirm` inside tool arguments is ignored |
| Retry limits | Provider retries: `AI_MAX_RETRIES` (default 2). Structured parse retries: 1 |
| AI timeouts | `AI_TIMEOUT_MS` (default 30s) aborts the provider request |
| Prompt-injection defenses | Safety preamble; untrusted user/document fences; injection-signal logging. Documents cannot become system instructions |
| Audit trail | `ai.generate`, `ai.decision`, and tool attempts (`copilot.tool` for copilot, `intent.execute` for business actions). Request bodies are sanitized. Prompt text and secrets are not stored |

## Standard decision envelope

Action-oriented structured output should use:

```json
{
  "result": {},
  "confidence": 0.0,
  "evidence": [],
  "requiresReview": false
}
```

`AIService.generateDecision()` and HTTP `POST /ai/structured` with `schemaName: "decision"` return this envelope. Confidence below `0.6` forces `requiresReview: true` even if the model claimed otherwise.

Existing toolkit operations (`summarize`, `classify`, `extract`, `analyze`, `recommend`, `draft`) keep their dedicated schemas. Extract, analyze, and draft still apply review policy.

## Tool registry

```ts
import { createAiToolRegistry, defineAiTool, executeAiTool } from '../integrations/ai/guardrails';

const registry = createAiToolRegistry();
registry.register(defineAiTool({
  name: 'deleteRecord',
  description: 'Delete a record the caller is allowed to delete',
  requiredPermission: 'records.write',
  riskLevel: 'high',
  actionKind: 'deletion',
  inputSchema: z.object({ id: z.string().uuid() }),
  handler: async (input, context) => records.delete(input.id, context.user),
}));

await executeAiTool({
  registry,
  name: 'deleteRecord',
  args: { id },
  user,
  confirmed: false, // returns pending_confirmation
});
```

Copilot uses the same executor. High-risk confirmation still goes through `POST /copilot/chat` with `confirm: true`, not a client-supplied tool list.

## Documents

Uploaded document text is wrapped as untrusted data before extraction. Document contents cannot override the system preamble. Review policy still flags low confidence and missing fields.

## Configuration

No new environment variables. Existing controls:

| Variable | Default | Role |
| --- | --- | --- |
| `AI_TIMEOUT_MS` | `30000` | Provider abort |
| `AI_MAX_RETRIES` | `2` | Extra provider attempts after the first |
| `AI_RETRY_BASE_MS` | `200` | Backoff base |
| `FEATURE_AI` / `AI_ENABLED` | `false` | Turns AI on |
| `FEATURE_COPILOT` | `false` | Turns the tool-calling assistant on |
| `FEATURE_RAG` | `false` | Turns optional semantic search on |
| `FEATURE_SEARCH` | `false` | Turns optional keyword / full-text search on (not Elasticsearch) |
| `FEATURE_ANALYTICS` | `false` | Turns optional KPI / time-series analytics on (not a warehouse) |
| `FEATURE_ANOMALY_DETECTION` | `false` | Turns optional statistical anomaly detection on |

## Tests

Covered in `backend/src/integrations/ai/guardrails/guardrails.test.ts` and copilot/AI service tests:

* malicious prompt (injection detection + untrusted fencing)
* tool escalation (forbidden names and unregistered tools)
* invalid structured / decision envelope
* low-confidence action (confirmation required)
* unauthorized tool
* destructive confirmation bypass (`confirm` in arguments is ignored)
* secret redaction and audit without secrets

## What these guardrails can guarantee

* Model output is not executed as SQL, JavaScript, shell, HTTP, or arbitrary Odoo methods by this layer
* Only registered tools can run, and only with the caller's permission
* High-risk actions wait for an application-owned confirmation flag
* The canonical safety preamble is always installed first; a spoofed `system` string cannot replace it
* Secrets matching the redaction patterns are stripped from provider payloads and audit rows
* Structured output that fails the schema is rejected
* Low-confidence decision envelopes are marked for review
* Uploaded documents are treated as data, not as system instructions. Embedding fake UNTRUSTED fences in a document does not skip wrapping

## What they cannot guarantee

* A capable model can still produce misleading, biased, or policy-violating text that *passes* the schema. Decision envelopes that look like executable SQL/shell are flagged `requiresReview`; they are not proof of intent.
* Injection heuristics are not a complete jailbreak detector. Fencing, the safety sandwich, allowlists, and confirmation are the real controls.
* Redaction covers known keys and common token prefixes (`sk-`, `AIza`, `ghp_`, Slack `xox*`, PEMs, JWTs, AWS access keys). Novel secret formats can still slip through.
* Confirmation must be collected by the application. Copilot loads pending tools from server-side history; a buggy caller that always passes `confirmed: true` into `executeAiTool` still bypasses the UX, not a client-supplied tool list.
* Provider-side safety filters (Gemini SAFETY/BLOCKLIST) are additional, not a substitute.

Treat this as a control plane for hackathon and MVP use, then review it against the problem's threat model before production.
