# Schemas

Zod is the only validation library. Request, query, params, headers, file metadata, AI output, provider responses, and configuration all use it.

Controllers must not inline validation rules. Compose reusable schemas from `common.ts` and parse with the helpers in `parse.ts`.

## Layout

* `common.ts` — IDs, emails, URLs, dates, enums, pagination, sorting, filters, upload metadata
* `parse.ts` — `parseBody`, `parseParams`, `parseQuery`, `parseHeaders`, `parseFileMetadata`, `parseAiOutput`, `parseProviderResponse`, `parseConfig`
* `auth.ts` / `rbac.ts` — feature schemas built from the common primitives

Route middleware: `validate({ body, params, query, headers })` in `backend/src/middleware/validate.ts`.

Shared response envelopes live in `@hackathon/api-contract`, not here. See [docs/validation.md](../../../docs/validation.md) and [docs/api-contract.md](../../../docs/api-contract.md).
