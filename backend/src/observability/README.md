# Observability

Structured logs, health/readiness, optional metrics, and optional error-tracking hooks. No vendor SDK is required. Plug in Sentry, Application Insights, Prometheus, or a custom sink when a hackathon needs it.

## Structured logging

Pino JSON logs include:

* `timestamp` (pino default)
* `level`
* `message`
* `requestId` when a request or job context exists
* `jobId` for background work
* `module` on HTTP and AI log lines
* `duration` / `durationMs` / `latencyMs` where useful

Passwords, tokens, API keys, and OTPs are redacted by the logger. Do not log confidential AI prompts or results.

```ts
logger.info({ module: 'reports', requestId, durationMs: 12 }, 'Report generated');
```

HTTP requests (except `/health` and `/ready`) are logged with method, path, status, and duration.

## Metrics hooks

`MetricsSink` is `increment` / `timing` / optional `gauge`. The default is a no-op. Tests can use `MemoryMetrics`.

Recorded names:

| Name | When |
| --- | --- |
| `http.requests` / `http.errors` / `http.latency` | After each API response |
| `jobs.enqueued` / `jobs.status` / `jobs.latency` | Queue enqueue and handler completion |
| `ai.calls` / `ai.latency` | AI provider calls (provider, model is in logs, not metric tags beyond provider/operation) |
| `notification.delivery` | Channel send outcome |

```ts
import { createObservability, MemoryMetrics } from '../observability';

const metrics = new MemoryMetrics();
const observability = createObservability({ metrics });
```

## Error tracking

`ErrorTracker.captureException` is called from the global error handler for unhandled failures. Default is a no-op.

```ts
const observability = createObservability({
  errors: {
    captureException(error, context) {
      // Sentry.captureException(error, { extra: context });
    },
  },
});
```

Do not send secrets in `context.extra`.

## Health

`GET /health` is process liveness. `GET /ready` pings PostgreSQL, Redis, Odoo, and AI when those integrations are configured. Unconfigured dependencies are skipped. Error strings are sanitized so connection URLs and keys do not leak.

## AI observability

Each AI call logs `provider`, `model`, `operation`, `latencyMs`, and `success` without prompt or result text. Metrics use `ai.calls` and `ai.latency`. Audit events use `ai.generate` / `ai.tool` (see [audit.md](../docs/audit.md)).
