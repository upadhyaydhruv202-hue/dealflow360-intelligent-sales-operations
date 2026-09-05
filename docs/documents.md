# Document intelligence

Reusable pipeline for uploading documents and extracting structured fields. This is generic infrastructure. Problem-specific field lists belong in `modules/problem/` or in the optional `fields` override on the API.

## Pipeline

```text
Upload
  → MIME / extension / size / filename / magic-byte validation
  → store original bytes (StorageService)
  → persist document metadata (status, checksum, type)
  → extract text or attach bytes for multimodal models
  → wrap extracted text as untrusted data
  → AI extract (schema-validated)
  → confidence / missing-field review
  → persist extraction separately from the source document
  → optional document.analyzed hook
```

Large files, or `async=true`, enqueue `document.process` (`document.analyze` remains a registered alias). With `REDIS_URL` set, BullMQ shares that job between the API and `npm run dev:workers`. Without Redis, the API and workers share a file queue on the same machine.

## Supported inputs

| Extension | MIME |
| --- | --- |
| `.pdf` | `application/pdf` |
| `.png` | `image/png` |
| `.jpg` / `.jpeg` | `image/jpeg` |
| `.txt` | `text/plain` |

Add another type by extending the allowlists in `backend/src/integrations/documents/document.types.ts` and the matching magic-byte check.

## File validation

Rejects:

* empty or oversized files (`DOCUMENT_MAX_BYTES`, default 10 MiB)
* unknown extensions or MIME types
* MIME/extension/content mismatches
* path traversal and unsafe filenames (`..`, `/`, `\`, NUL)

TXT files must be mostly UTF-8 text. PDF, PNG, and JPEG are checked against magic bytes.

## Public HTTP API

Prefix: `/api/v1`. All routes require a bearer token.

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| POST | `/documents/analyze` | `documents.analyze` | Multipart upload and extraction |
| GET | `/documents/:id` | `documents.read` | Poll status and read the latest extraction |

`POST /documents/analyze` fields:

* `file` (required)
* `documentType` (required): `invoice`, `receipt`, `certificate`, `application`, `form`, `contract`, `report`, `generic`
* `fields` (optional JSON array of identifiers) — overrides the default field list for that type
* `async` (optional boolean) — force background processing

Success envelope `data`:

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "status": "completed",
  "documentType": "invoice",
  "fields": { "invoiceNumber": "99", "total": "40.00" },
  "missingFields": [],
  "confidence": 0.92,
  "warnings": [],
  "requiresReview": false
}
```

Background jobs return HTTP 202 with `status: "processing"`. Poll `GET /documents/:id`. `needs_review` means extraction finished but a human should check it. `failed` keeps a sanitized error in `warnings`.

Clients cannot send executable schemas. They select a document type and optionally a field list, the same constraint as `/ai/extract`.

## Confidence

`DOCUMENT_CONFIDENCE_THRESHOLD` (default `0.7`) is applied after AI schema validation.

`requiresReview` is true when:

* confidence is below the threshold
* any requested field is missing or empty
* the model listed a field as missing (that value is stored as `null`, not the invented string)

Extracted values are advisory. Do not execute them as SQL, code, shell, or Odoo methods.

## Storage and persistence

Original bytes go to `StorageService` (local directory by default, S3 when `STORAGE_PROVIDER=s3`). PostgreSQL stores:

* `documents` — source metadata and processing status
* `document_extractions` — AI output only

Storage keys are relative (`documents/{userId}/{documentId}/{filename}`). Filesystem paths are never returned to clients.

See [storage.md](storage.md) for local vs S3 configuration.

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `STORAGE_PROVIDER` | `local` | `local`, `s3`, or `postgres` |
| `STORAGE_LOCAL_DIR` | `storage` | Relative to the backend package |
| `DOCUMENT_MAX_BYTES` | `10485760` | Upload cap |
| `DOCUMENT_MAX_TEXT_CHARS` | `100000` | Extracted text cap |
| `DOCUMENT_CONFIDENCE_THRESHOLD` | `0.7` | Review cutoff |
| `DOCUMENT_ASYNC_THRESHOLD_BYTES` | `1048576` | Files this large run asynchronously |

Document intelligence requires AI to be enabled. Mock the AI provider in tests and demo mode.

## Tests

Mock the AI provider. Cover:

* valid upload
* unsupported file
* oversized file
* AI failure
* malformed AI output
* low confidence
* retry of a background job

Do not treat extracted fields as ground truth.

## Limitations

* PDF text extraction is best-effort; image-only or encrypted PDFs are sent as multimodal attachments
* Callers only see their own documents
* Multi-host workers need Redis (BullMQ) and shared object storage (`STORAGE_PROVIDER=s3` or `postgres`, or local plus PostgreSQL dual-write)
