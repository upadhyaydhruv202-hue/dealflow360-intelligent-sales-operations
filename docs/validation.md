# Validation

Zod is the only schema library. Controllers, jobs, AI output, and provider adapters must reuse schemas instead of duplicating rules.

Shared success/error envelopes are defined once in `@hackathon/api-contract` and inferred as TypeScript types. Request-body schemas stay in `backend/src/schemas`. See [api-contract.md](api-contract.md).

## Architecture

```text
HTTP request
  → request ID
  → validate({ body, params, query, headers }) or parseBody / parseParams / parseQuery
  → controller
  → service (parseAiOutput / parseProviderResponse)
  → repository / adapter
  → errorHandler
```

Configuration uses the same library in `backend/src/config/schema.ts` via `parseConfig()`.

## Reusable schemas

Import from `backend/src/schemas`:

| Schema | Use |
| --- | --- |
| `idSchema` / `idParamsSchema` | UUIDs |
| `emailSchema` | Emails |
| `urlSchema` | Absolute URLs |
| `isoDateStringSchema` / `dateSchema` | Dates |
| `enumSchema([...])` | Closed string sets |
| `paginationQuerySchema` | `page`, `pageSize` |
| `sortQuerySchema` | `sortBy`, `sortOrder` |
| `filterRuleSchema` / `filterRulesSchema` | Allowlisted filters |
| `uploadedFileMetadataSchema` / `createFileMetadataSchema()` | Upload metadata only |
| Storage upload (`storageUploadBodySchema`) | Optional `purpose`; file bytes are validated in `StorageService` |
| Document analyze body (`documentAnalyzeBodySchema`) | Multipart `documentType`, optional `fields` JSON, optional `async` |
| `requestIdSchema` | Correlation IDs |

Feature schemas (`auth.ts`, `rbac.ts`) compose these. Do not re-declare email or UUID rules in a controller.

## Parse helpers

| Helper | Error |
| --- | --- |
| `parseBody` / `parseParams` / `parseQuery` / `parseHeaders` | `ValidationError` (400) |
| `parseFileMetadata` | `ValidationError` (400) |
| `parseAiOutput` | `ValidationError` (400), source `ai` |
| `parseProviderResponse` | `ExternalServiceError` (502) |
| `parseConfig` | startup `Error` (not an HTTP response) |

AI structured output is always parsed with `parseAiOutput`. Action-oriented results should use the shared decision envelope (`result`, `confidence`, `evidence`, `requiresReview`). See [ai-guardrails.md](ai-guardrails.md).

Route-level alternative:

```ts
router.get('/items', validate({ query: paginationQuerySchema }), controller.list);
```

## Error envelope

Validation failures:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request",
    "details": [
      { "path": "body.email", "message": "Invalid email", "code": "invalid_string" }
    ]
  },
  "requestId": "..."
}
```

Other errors keep `details` as an object. Clients should accept either an array or an object.

Responses never include stack traces, secrets, filesystem paths, or provider credentials. Unhandled exceptions become `INTERNAL_ERROR` with a generic message.

## Request ID

Every request gets `x-request-id` (incoming value when it matches `[A-Za-z0-9_.:-]{1,128}`, otherwise a UUID). The ID is stored in async local storage so logs, job payloads (`withRequestId`), workers (`runWithJobContext`), and audit events (`getAuditContext`) can read it. Job workers also bind `jobId`. Client IP is stored on the request context for audit rows.

## Tests

See `backend/src/schemas/*.test.ts`, `backend/src/errors/*.test.ts`, `backend/src/middleware/error-handler.test.ts`, and `backend/tests/http.test.ts`.
