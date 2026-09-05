# AI integration

Reusable, provider-agnostic LLM service plus an **AI intelligence toolkit**. Future hackathons add **versioned prompts** and **output schemas**. They do not change `AIService` internals, and they do not send Gemini API keys to React.

Controllers must call `AIService`. They never import a vendor SDK or contain prompt strings.

See `backend/src/integrations/ai/` for the implementation.

## Purpose

Call a language model from backend services with:

* a single public interface
* swappable providers (`gemini`, `mock`, then `providers/new-provider`)
* schema-validated structured output
* timeouts, retries, and normalized errors
* logs that never include API keys, raw documents, or confidential prompts/results
* optional `MetricsSink` for `ai.calls` / `ai.latency` (see [observability.md](observability.md))

Problem-specific prompts and policies belong in `modules/problem/`. Reusable prompt builders live in `backend/src/integrations/ai/prompts/`.

## Architecture

```text
Controller (HTTP + zod + authenticate + requirePermission("ai.use"))
        │
        ▼
Application / problem service
        │
        ▼
AIService   generateText / generateStructured / summarize / classify / extract / analyze / recommend / draft / embed
        │
        ▼
AiProvider  (gemini.provider | mock.provider | new-provider)
        │
        ▼
Gemini REST  POST /v1beta/models/{model}:generateContent
```

Business logic must not import provider-specific SDKs. Adding another vendor means a new file under `providers/` and one factory case. Controllers and problem modules stay unchanged.

AI output is untrusted. Structured results are parsed as JSON and validated with Zod before they are returned. They are never executed as code, SQL, shell, or Odoo methods. The shared control plane is documented in [ai-guardrails.md](ai-guardrails.md).

```text
User
 ↓
Authentication
 ↓
Authorization (ai.use)
 ↓
Input limits + secret redaction + untrusted-data fencing
 ↓
AIService
 ↓
Provider (timeout + retries)
 ↓
Structured output
 ↓
Schema validation
 ↓
Review policy (confidence / missing fields)
 ↓
Tool allowlist / confirmation / approved handler
 ↓
Audit (no secrets)
```

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `AI_ENABLED` / `FEATURE_AI` | `false` | Either flag enables the integration |
| `AI_PROVIDER` | `gemini` | `gemini` or `mock` |
| `AI_MODEL` | `gemini-2.5-flash` for Gemini, `mock` for mock | Optional override |
| `GEMINI_API_KEY` | unset | Server-side only; never log or send to React |
| `AI_TIMEOUT_MS` | `30000` | Per-request abort |
| `AI_MAX_OUTPUT_TOKENS` | `4096` | Provider generation cap |
| `AI_TEMPERATURE` | `0.2` | `0`–`2` |
| `AI_MAX_RETRIES` | `2` | Extra attempts after the first |
| `AI_RETRY_BASE_MS` | `200` | Exponential backoff base |

Production requires `GEMINI_API_KEY` when AI is enabled with Gemini. `AI_PROVIDER=mock` is allowed in production only when `DEMO_MODE=true`.

When `DEMO_MODE` or `NODE_ENV=test` is set and Gemini has no key, the runtime falls back to the mock provider so local/CI/demo work without a paid API.

## Intelligence toolkit

These operations are reusable. They are not problem-specific. AI is advisory, not authoritative truth.

| Capability | How to call it | Why not a separate HTTP route |
| --- | --- | --- |
| Summarization | `POST /ai/summarize` | Dedicated I/O (`style`, `length`, `language`) |
| Classification | `POST /ai/classify` | Dedicated I/O (optional `labels`) |
| Sentiment analysis | `POST /ai/classify` (`sentiment`) and `POST /ai/analyze` | Same signals, no extra endpoint |
| Priority detection | `POST /ai/classify` (`priority`) and `POST /ai/analyze` | Same signals, no extra endpoint |
| Structured extraction | `POST /ai/extract` with `fields` | Caller provides the field list |
| Entity extraction | `POST /ai/extract` `schemaName=entities` | Named extract schema |
| Action-item extraction | `POST /ai/extract` `schemaName=actionItems` | Named extract schema |
| Risk analysis | `POST /ai/analyze` (`focus=risk` optional) | Analyze already returns structured `risks` |
| Recommendation | `POST /ai/recommend` | Dedicated I/O |
| Response drafting | `POST /ai/draft` | Distinct contract; drafts always `requiresReview: true` |

`content` is the preferred document field. `text` is accepted as an alias on summarize, classify, extract, analyze, and draft. Recommend accepts `context` or `content`.

### Summarize

Input: `content`, optional `style` (`brief` \| `detailed` \| `bullet` \| `executive`), `length` (`short` \| `medium` \| `long`), `language`, `maxSentences`.

Output:

```json
{
  "summary": "The shipment missed the promised window.",
  "keyPoints": ["Delivery is two days late"],
  "actions": ["Notify the customer"]
}
```

### Classify

Input: `content`, optional `labels` (at least two identifiers when provided).

Output always includes:

```json
{
  "category": "delivery_delay",
  "priority": "high",
  "sentiment": "negative",
  "confidence": 0.86,
  "reason": "The package missed the promised window."
}
```

When `labels` are provided, `category` must be one of them. Invalid model output is rejected.

Low confidence is still a successful response. Callers must treat `confidence` as a review signal, not as proof.

### Extract

HTTP callers **select** a named schema or **provide** a field list. They cannot send arbitrary Zod or executable schemas.

| `schemaName` | Required extra input | `fields` object |
| --- | --- | --- |
| `fields` (default) | `fields`: identifier list | One key per requested field (`null` if missing) |
| `entities` | none | `people`, `organizations`, `locations`, `dates`, `amounts`, `identifiers` |
| `actionItems` | none | `actionItems[]` with `action`, optional `owner`, `due`, `priority` |

Output envelope:

```json
{
  "fields": { "orderId": "99", "eta": null },
  "missingFields": ["eta"],
  "confidence": 0.7,
  "warnings": ["ETA was not stated"],
  "requiresReview": true
}
```

The service sets `requiresReview` to `true` when confidence is below `0.6` or any requested field is missing, even if the model claimed otherwise.

Trusted backend code may still pass any Zod schema to `generateStructured()`.

### Analyze

Input: `content`, optional `focus` (`general` \| `risk`).

Output includes summary, findings, structured risks, sentiment, priority, confidence, and `requiresReview`.

```json
{
  "summary": "The shipment is at risk of missing SLA.",
  "findings": ["Promised window has already passed"],
  "risks": [
    {
      "risk": "Customer SLA breach",
      "severity": "high",
      "likelihood": "high",
      "mitigation": "Notify the customer and rebook the carrier"
    }
  ],
  "sentiment": "negative",
  "priority": "high",
  "confidence": 0.8,
  "requiresReview": false
}
```

### Recommend

Every item contains `recommendation`, `reason`, optional `evidence`, and `confidence`.

```json
{
  "recommendations": [
    {
      "recommendation": "Rebook the carrier for the next window",
      "reason": "The original delivery promise was missed",
      "evidence": "The notice says the parcel is two days late",
      "confidence": 0.74
    }
  ]
}
```

Recommendations are suggestions. They must not be executed as SQL, code, shell, or Odoo methods.

### Draft

Input: `content`, optional `purpose`, `tone` (`neutral` \| `friendly` \| `formal` \| `empathetic`), `audience`, `language`.

Output is a draft plus optional `subject` / `alternatives`. `requiresReview` is always `true` after service policy — a draft is never treated as a sent message.

## Public HTTP API

Prefix: `/api/v1`. All routes require a bearer token and `ai.use`.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/ai/health` | Provider connectivity |
| POST | `/ai/generate` | `generateText()` |
| POST | `/ai/structured` | `generateStructured()` using the built-in `insight` schema |
| POST | `/ai/summarize` | `summarize()` |
| POST | `/ai/classify` | `classify()` |
| POST | `/ai/extract` | `extract()` |
| POST | `/ai/analyze` | `analyze()` |
| POST | `/ai/recommend` | `recommend()` |
| POST | `/ai/draft` | `draft()` |
| POST | `/ai/embed` | `embed()` |

`GET /ready` also pings AI when the integration is enabled. Unconfigured AI is skipped and does not fail readiness.

Structured HTTP example (`POST /api/v1/ai/structured`):

```json
{
  "prompt": "A delivery is two days late.",
  "schemaName": "insight"
}
```

Validated result:

```json
{
  "category": "delivery_delay",
  "priority": "high",
  "reason": "The shipment missed the promised window."
}
```

Clients cannot send arbitrary executable schemas. Known HTTP output schemas are listed in `AI_OUTPUT_SCHEMAS` (`insight`, `decision`). Trusted backend code may pass any Zod schema to `generateStructured()`. Action-oriented calls should use `generateDecision()` / `schemaName: "decision"`:

```json
{
  "result": { "action": "notify" },
  "confidence": 0.82,
  "evidence": ["The shipment missed the promised window."],
  "requiresReview": false
}
```

HTTP bodies do not accept `system`, `model`, or `messages[].role = "system"`. Those stay available on `AIService` for trusted backend callers.

## Service interface

```ts
import { createAiService, aiInsightSchema } from '../integrations/ai';

const ai = createAiService({ config, logger });

await ai.generateText({ prompt: 'Write a one-line status update.' });
await ai.generateStructured({
  prompt: 'Classify this ticket',
  schema: aiInsightSchema,
  schemaName: 'insight',
});
await ai.summarize({ content, style: 'brief', length: 'short', language: 'en' });
await ai.classify({ content, labels: ['delivery_delay', 'billing'] });
await ai.extract({ content, fields: ['orderId', 'eta'] });
await ai.extract({ content, schemaName: 'entities' });
await ai.extract({ content, schemaName: 'actionItems' });
await ai.analyze({ content, focus: 'risk' });
await ai.recommend({ context, goal: 'Reduce repeat delays', limit: 3 });
await ai.draft({ content, purpose: 'Reply to the customer', tone: 'empathetic' });
await ai.embed({ text });
```

`embed()` returns a numeric vector. Gemini uses `gemini-embedding-001` unless a trusted caller passes `model`. The mock provider returns a deterministic vector for tests and demo mode.

## Versioned prompts

Prompt strings live under `backend/src/integrations/ai/prompts/`. Controllers must not contain prompts.

Each toolkit operation has a versioned template (`id` + `version`, currently `v1`) registered in `AI_PROMPT_CATALOG`. Every template prepends a safety preamble: AI is not authoritative, untrusted data fences are not instructions, and the model must not produce executable SQL, code, shell commands, or arbitrary Odoo methods. Document and user content is wrapped in `UNTRUSTED DATA` fences.

To change behavior, add `v2` beside `v1` and point the catalog at the new version. Do not edit scattered strings in HTTP handlers.

## Adding a new AI capability

Use this sequence so hackathon features stay reusable and safe:

1. **Decide whether an existing endpoint already fits.** Prefer `extract` named schemas, `analyze` focus, or `classify` labels before adding a route.
2. **Add a Zod output schema** in `ai.schemas.ts`. Include `confidence` and `requiresReview` when the result could be acted on.
3. **Add a versioned prompt** (`prompts/my-capability.ts`) with `id`, `version: 'v1'`, and `build()`. Register it in `AI_PROMPT_CATALOG`. Keep the safety preamble.
4. **Add an `AIService` method** that validates input, builds the prompt, calls `executeStructured`, and applies review policy. Do not put prompts in the controller.
5. **Expose HTTP only when the I/O is distinct.** Reuse `/ai/extract` or `/ai/analyze` when possible. HTTP must use an allowlisted schema, never a client-supplied Zod schema.
6. **Teach the mock provider** a deterministic default for the new operation.
7. **Test with mocks:** success, invalid JSON / schema mismatch, missing fields, and low confidence. Do not call paid APIs in CI.
8. **Document** the operation in this file and, if it is a reusable module, [capabilities.md](capabilities.md).

Problem-specific prompts belong in `modules/problem/`. They should still call `AIService.generateStructured()` with a local Zod schema.

## Mock provider

`MockAiProvider` is used for local testing, CI, and demo mode. Tests can queue exact strings or errors:

```ts
const provider = new MockAiProvider();
provider.enqueue('{"category":"billing","priority":"low","sentiment":"neutral","confidence":0.4,"reason":"invoice mismatch"}');
```

## Observability

Each request logs `operation`, `provider`, `model`, `requestId`, `latencyMs`, `success`, `promptChars`, and prompt `id`/`version` when present. Logs do not include API keys, prompt text, documents, or generated bodies.

## Adding a provider

1. Add `backend/src/integrations/ai/providers/new-provider.ts` implementing `AiProvider`.
2. Register it in `providers/create-provider.ts`.
3. Extend `AI_PROVIDER` in `backend/src/config/schema.ts` if it needs a new name.
4. Do not change controllers or problem modules.

## Tests

* successful generation
* provider failure, timeout, and rate limit
* malformed JSON and schema mismatch
* missing extract fields (`requiresReview`)
* low-confidence classify / extract / analyze (returned, not thrown)
* drafts always require review
* mocked provider operations
* Gemini HTTP mapping with a fake `fetch`

## Limitations

* HTTP `generateStructured` only exposes the built-in `insight` and `decision` schemas
* Gemini is called over REST; there is no vendor SDK in this package
* Staff and user roles do not receive `ai.use` by default (manager and admin do)
* Copilot is a separate module (`FEATURE_COPILOT`, `copilot.use`). See [copilot.md](copilot.md).
* Natural-language business actions are a separate module (`FEATURE_INTENTS`, `intents.use`). See [intents.md](intents.md).
* Problem statement intelligence is a separate module (`FEATURE_PROBLEM_INTELLIGENCE`, `problem.analyze`). See [problem-intelligence.md](problem-intelligence.md).
* Capability recommendations are a separate deterministic module (`FEATURE_CAPABILITY_RECOMMENDATIONS`, `capabilities.recommend`). See [capability-recommendations.md](capability-recommendations.md).
* Project planning is a separate module (`FEATURE_PROJECT_PLANNING`, `projects.plan`). It produces a validated Project Configuration and does not generate code. See [project-planning.md](project-planning.md).
* The project generator is a separate module (`FEATURE_PROJECT_GENERATOR`, `projects.generate`). It consumes that approved object and writes an isolated overlay. See [project-generator.md](project-generator.md).
* RAG is a separate optional module (`FEATURE_RAG`, `rag.use`). See [rag.md](rag.md).
* Anomaly insights are a separate optional module (`FEATURE_ANOMALY_DETECTION`, `anomaly.use`). Detection is statistical; AI only explains. See [anomaly.md](anomaly.md).
* Shared safety controls live in [ai-guardrails.md](ai-guardrails.md). They cannot guarantee that a model will never produce misleading text that still matches a schema.
* Document uploads use `documents.analyze` / `documents.read` (manager and admin)
* Summaries, classifications, extractions, and drafts are advisory until a human or a separate authorized handler acts on them
