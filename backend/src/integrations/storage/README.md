# Storage

Local disk, PostgreSQL `stored_objects`, and S3 adapters behind `StorageService`. Callers use `upload` / `download` / `delete` / `getSignedUrl` (or `put` / `get` for generated objects), never filesystem paths or the S3 SDK.

`storage.getSignedUrl(idOrKey)` issues a time-limited URL. See `docs/storage.md`.
