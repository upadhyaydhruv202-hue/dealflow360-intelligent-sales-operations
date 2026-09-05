# Observability

Structured logging, health/readiness, optional metrics, and optional error-tracking hooks. An external vendor is **not** required. Plug in Sentry, Application Insights, Datadog, Prometheus, or a custom sink when a deployment needs it.

See `backend/src/observability/` and `backend/src/utils/logger.ts`.

## Structured logging

Pino JSON logs include:

* timestamp
* level
* message
* `requestId` when a request or job context exists
* `jobId` for background work
* `module` on HTTP and AI lines
* duration / `durationMs` / `latencyMs` where useful

Passwords, tokens, API keys, and OTPs are redacted. Do not log confidential AI prompts or results.

HTTP requests (except `/health` and `/ready`) are logged with method, path, status, duration, and request id.

## Metrics hooks

`MetricsSink` exposes `increment`, `timing`, and optional `gauge`. Default implementation is a no-op. Tests can use `MemoryMetrics`.

| Name | When |
| --- | --- |
| `http.requests` / `http.errors` / `http.latency` | After each API response |
| `jobs.enqueued` / `jobs.status` / `jobs.latency` | Queue enqueue and handler completion |
| `ai.calls` / `ai.latency` | AI provider calls |
| `notification.delivery` | Channel send outcome |

```ts
import { createObservability, MemoryMetrics } from '../observability';

const observability = createObservability({ metrics: new MemoryMetrics() });
```

Pass `observability` into `createApp({ ..., observability })`.

## Error tracking

`ErrorTracker.captureException` is invoked from the global error handler for 5xx and unhandled errors. Default is a no-op.

```ts
createObservability({
  errors: {
    captureException(error, context) {
      // Sentry.captureException(error, { extra: context });
    },
  },
});
```

Do not put secrets in `context.extra`.

## Health

Operational probes stay outside `/api/v1`:

* `GET /health` — process liveness (service, environment, uptime)
* `GET /ready` — PostgreSQL, Redis, Odoo, and AI when configured

Unconfigured dependencies are skipped and treated as ready. Dependency error strings are sanitized so connection URLs and keys do not leak.

## AI observability

Each AI call logs `provider`, `model`, `operation`, `latencyMs`, and `success` without prompt or result text. Metrics use `ai.calls` and `ai.latency`. Durable audit rows use `ai.generate` / `ai.tool`. See [audit.md](audit.md) and [ai.md](ai.md).

## Tests

* metric and error-tracker hooks
* HTTP request logging (skips health)
* logger mixin (`requestId`, `jobId`, secret redaction)
* health sanitization

## Limitations

* No built-in Prometheus endpoint or Sentry SDK
* In-memory metrics are for tests; production should inject a real sink
* Health does not probe SMTP or SMS providers
