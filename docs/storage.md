# Storage

Bytes live in object storage. Callers use `StorageService` — never `@aws-sdk/client-s3` or filesystem paths.

```text
Upload
  → validation (size, filename, extension, content)
  → metadata
  → storage provider
  → persistence
```

`STORAGE_PROVIDER=local` (default) writes to disk under the backend package. When a database is configured, objects are also written to PostgreSQL so workers on another host can read them. `STORAGE_PROVIDER=postgres` stores only in PostgreSQL. `STORAGE_PROVIDER=s3` uses a private bucket. Local development does not require AWS credentials.

## Providers

| `STORAGE_PROVIDER` | Behavior |
| --- | --- |
| `local` (default) | Files under the backend package, plus PostgreSQL when the API has a database |
| `postgres` | PostgreSQL `stored_objects` only (shared across hosts that share the DB) |
| `s3` | AWS S3 (private objects, signed downloads) |

Relative local directories resolve against the **backend package**, not process cwd, so the API and workers share the same files.

S3 object keys are the same relative keys used locally. Path traversal (`..`, absolute paths) is rejected. PutObject does not set a public ACL. Do not attach a public bucket policy.

## Public interface

Object API (PDF, document intelligence, generated exports):

```ts
storage.put({ key, body, contentType })
storage.get(key)
storage.delete(key)
storage.signDownload(key, expiresInSeconds?)
```

File API (attachments, avatars, uploads):

```ts
storage.upload({ originalname, size, buffer, uploadedBy?, purpose? })
storage.download(fileId)
storage.delete(fileId) // or storage.deleteFile(fileId)
storage.getSignedUrl(fileId, expiresInSeconds?)
storage.getFile(fileId)
```

`createStorageService(config)` selects the provider from configuration. Client-reported MIME types are ignored; type is taken from file content and extension.

`purpose` selects a key prefix and allowlist: `attachment` (default), `avatar`, `export`, `document`, `report`.

## HTTP API

Authenticated routes require `files.read` / `files.write`. Callers only see their own files unless they have `admin.settings`. Storage keys are not returned on upload/get.

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| POST | `/api/v1/files` | `files.write` | Multipart upload (`file`, optional `purpose`) |
| GET | `/api/v1/files/:id` | `files.read` | Metadata |
| GET | `/api/v1/files/:id/content` | `files.read` | Bytes |
| POST | `/api/v1/files/:id/url` | `files.read` | Time-limited signed URL (`expiresInSeconds` optional) |
| DELETE | `/api/v1/files/:id` | `files.write` | Delete bytes and metadata |
| GET | `/api/v1/storage/download` | HMAC signature; `uid` requires matching session | Signed download for local/postgres |

S3 uses a native presigned GET when no actor is bound. Local and Postgres signed URLs hit `GET /api/v1/storage/download?key=&expires=&sig=` and optional `uid`. HMAC payload is `v2` (older links are invalid). User-triggered signed URLs bind `uid` to the actor and require that user (or `admin.settings`) on download. Generated PDF/report links without `uid` remain possession-based until expiry.

## Metadata

PostgreSQL `stored_files` stores `id`, `originalName`, `storedName`, `storageKey`, `mimeType`, `size`, `provider`, `purpose`, `uploadedBy`, `createdAt`. Bytes never live in this row.

## Validation

Rejected:

* empty or oversized files (`STORAGE_MAX_BYTES`)
* path traversal and dangerous filenames
* unsupported extensions
* content that does not match the extension (magic bytes)

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `STORAGE_PROVIDER` | `local` | `local`, `s3`, or `postgres` |
| `STORAGE_LOCAL_DIR` | `storage` | Relative to the backend package, or an absolute path |
| `STORAGE_MAX_BYTES` | `10485760` | Upload cap for `upload()` and `POST /files` |
| `STORAGE_SIGNED_URL_EXPIRES` | `300` | Default signed URL lifetime in seconds (max 86400) |
| `STORAGE_SIGNING_SECRET` | unset in config; dedicated HMAC in production | HMAC for local/postgres signed downloads. **Required in production** (32+). Never reuse `JWT_ACCESS_SECRET`. Dev uses an isolated fallback, not the JWT secret. |
| `AWS_REGION` | `us-east-1` when unset on the S3 client | Required in practice for S3 |
| `AWS_ACCESS_KEY_ID` | unset | Required in production when S3 is enabled |
| `AWS_SECRET_ACCESS_KEY` | unset | Required in production when S3 is enabled |
| `AWS_S3_BUCKET` | unset | Required in production when S3 is enabled |
| `FEATURE_S3` | `false` | Makes AWS secrets required in production even if `STORAGE_PROVIDER=local` |

## Migrating from local storage to S3

Keys are stable. Copy existing objects, then switch the provider.

1. Keep serving from local (or local+postgres dual-write) until the copy finishes.
2. Create a **private** bucket. Block public access. Do not use a website hosting policy.
3. Copy objects with the same relative keys (`files/...`, `documents/...`, `pdfs/...`):

```bash
aws s3 sync ./backend/storage s3://YOUR_BUCKET --sse AES256
```

If dual-write to PostgreSQL is enabled, you can also stream from `stored_objects` instead of disk.

4. Set `STORAGE_PROVIDER=s3` and the `AWS_*` variables. Restart the API and workers.
5. Confirm `POST /api/v1/files` and an existing signed download still work.
6. Leave local files in place until you are sure the bucket has every key, then delete them.

New `getSignedUrl` calls become S3 presigned GETs when no actor is bound. HMAC links (`GET /api/v1/storage/download?key=&expires=&sig=&uid=`) keep working after the switch: that route reads through `StorageService.get()`, which fetches from S3 when the provider is `s3`. Keep `STORAGE_SIGNING_SECRET` stable; it must not be the JWT access secret. `v2` signatures are not compatible with older `v1` links.

## Tests

CI uses `STORAGE_PROVIDER=local` (or an in-memory file store). Mock the S3 client. Cover upload, invalid file, oversized file, delete, missing file, signed URL, and provider failure.

## Limitations

* Local disk is not shared across hosts unless dual-write to PostgreSQL is on, or you mount the same volume
* Signed HMAC downloads without `uid` prove possession of the URL, not the caller's session. Keep TTL short. Authenticated `GET /files/:id/content` is the session-bound alternative
* User-bound signed URLs (`uid`) require a matching access token or cookie on download
