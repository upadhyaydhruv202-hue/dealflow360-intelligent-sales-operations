# Errors

Normalized operational errors thrown by services and middleware. The global Express handler in `backend/src/middleware/error-handler.ts` maps them to the standard API envelope.

## Types

| Class | HTTP | Code |
| --- | --- | --- |
| `ValidationError` | 400 | `VALIDATION_ERROR` |
| `AuthenticationError` | 401 | `AUTHENTICATION_ERROR` |
| `AuthorizationError` | 403 | `AUTHORIZATION_ERROR` |
| `NotFoundError` | 404 | `NOT_FOUND` |
| `ConflictError` | 409 | `CONFLICT` |
| `RateLimitError` | 429 | `RATE_LIMIT` |
| `ExternalServiceError` | 502 | `EXTERNAL_SERVICE_ERROR` |
| `DatabaseError` | 503 | `DATABASE_ERROR` |
| `TimeoutError` | 504 | `TIMEOUT` |

Unknown failures become `INTERNAL_ERROR` (500) with a generic message.

`normalizeError()` maps malformed JSON, oversized bodies, Prisma errors, timeouts, and provider network failures into this hierarchy. `sanitizeErrorDetails()` strips secrets and filesystem paths before the response is sent.

Controllers should throw these classes (or helpers that throw them) and wrap async work with `asyncHandler`. Do not send stack traces to clients.

See [docs/validation.md](../../../docs/validation.md) and [docs/api-conventions.md](../../../docs/api-conventions.md).
