# API conventions

Application APIs use the prefix:

```text
/api/v1
```

The prefix, envelopes, public error codes, pagination `meta`, and `FEATURE_NAMES` live in `@hackathon/api-contract`. See [api-contract.md](api-contract.md). Do not add a second envelope or OpenAPI generator.

Operational probes stay outside that prefix:

* `GET /health`
* `GET /ready`

`GET /api/v1/audit` lists redacted audit events for callers with `audit.read`. See [audit.md](audit.md).

`GET /api/v1/features` is the public feature-flag snapshot. `GET /api/v1/capabilities` is the public capability catalog. See [features.md](features.md) and [capabilities.md](capabilities.md).

## Success

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

`meta` may be an empty object. Paginated list endpoints should put page data there:

```json
{
  "page": 1,
  "pageSize": 20,
  "totalItems": 100,
  "totalPages": 5,
  "hasNextPage": true,
  "hasPreviousPage": false
}
```

Maximum page size is 100 (`MAX_PAGE_SIZE` in the repository query helpers).

## Error

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  },
  "requestId": "..."
}
```

Every response includes `x-request-id`. Clients may send that header to correlate logs. Malformed incoming IDs are replaced with a generated UUID.

Validation failures use `details` as an array of `{ path, message, code }`. Other errors keep `details` as an object. See [validation.md](validation.md).

## Error types

Use `AppError` subclasses instead of ad-hoc status codes:

* `ValidationError` (400)
* `AuthenticationError` (401)
* `AuthorizationError` (403)
* `NotFoundError` (404)
* `FeatureDisabledError` (404 `FEATURE_DISABLED`)
* `ConflictError` (409)
* `RateLimitError` (429)
* `ExternalServiceError` (502)
* `DatabaseError` (503)
* `TimeoutError` (504)

Unhandled errors become `INTERNAL_ERROR` (500). Responses never include stack traces, secrets, filesystem paths, or provider credentials.

## Controllers

Controllers validate input through shared Zod schemas, call services, and return envelopes. They must not query the database or call provider SDKs.

## Authentication

`POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`, `POST /api/v1/auth/otp/request`, and `POST /api/v1/auth/otp/verify` are documented in [auth.md](auth.md) and [otp.md](otp.md).

Authorization (roles and `resource.action` permissions) is documented in [rbac.md](rbac.md). Protect privileged routes with `authenticate()` then `requirePermission()` or `authorizeRole()`.
