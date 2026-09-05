# Background jobs

Enqueue work from services. Process it in the API process and/or the workers process. Redis is required in production; locally it is optional.

Controllers must not drain queues. Poll `GET /api/v1/jobs/:jobId` for safe status. Optional Server-Sent Events (`FEATURE_REALTIME`) can push the same public status; they are not required. See [realtime.md](realtime.md).

`JOBS_PROCESS` (default `true`) controls whether this process registers queue consumers. Docker Compose sets `JOBS_PROCESS=false` on the API and `true` on the worker so HTTP is not competing with PDF/AI jobs. Local `npm run dev` leaves it unset so the API still consumes jobs when you are not running workers.

## Backends

| Condition | Backend | Shared across processes? |
| --- | --- | --- |
| `REDIS_URL` set | BullMQ queue `hackathon` | Yes |
| `REDIS_URL` unset (API/workers, not tests) | File queue under `backend/job-queue` | Yes, on the same machine |
| Tests (`NODE_ENV=test` without `jobsDir`) | In-memory | No |

Local/demo mode does not require Redis. The file queue keeps the API and `npm run dev:workers` in sync on one machine.

## Job names

| Job | Purpose |
| --- | --- |
| `email.send` | Transactional email |
| `sms.send` | Transactional SMS |
| `pdf.generate` | PDF generation |
| `report.generate` | Report PDF generation (`ReportService`) |
| `ai.analyze` | Background AI analysis |
| `document.process` | Document intelligence (`document.analyze` is kept as an alias) |
| `rag.index` | Optional RAG document chunking and embedding (`FEATURE_RAG`) |
| `anomaly.evaluate` | Optional statistical anomaly evaluation (`FEATURE_ANOMALY_DETECTION`) |
| `odoo.sync` | Allowlisted idempotent Odoo reads |
| `cleanup` | Expire cache/OTP/job-status leftovers |
| `notification.dispatch` | Multi-channel notification delivery |
| `automation.execute` | Automation engine |

Problem-specific jobs register from `modules/problem` via `host.jobs.process` (API when `JOBS_PROCESS` is true, and always on the worker). See [problem-module.md](problem-module.md).

## Job model

`GET /api/v1/jobs/:jobId` (permission `jobs.read`) returns:

* `jobId`, `type`, `status`, `attempts`
* `createdAt`, `startedAt`, `completedAt`
* `error` (sanitized; never secrets or payloads)
* `progress` (0–100)

Jobs that were enqueued with a `userId` payload field or `createdBy` option are visible to that user and to `admin`. Other callers get 404. Jobs without an owner (email, SMS, cleanup) stay readable by anyone with `jobs.read`. Status responses never include `createdBy` or the payload.

Statuses: `queued`, `processing`, `completed`, `failed`, `retrying`.

Workers bind `jobId` into structured logs. Optional `MetricsSink` records `jobs.enqueued`, `jobs.status`, and `jobs.latency`. See [observability.md](observability.md).

In development (and other non-production, non-test boots with `DATABASE_URL`), the API upserts the default RBAC catalog on startup. New keys such as `jobs.read` are granted to the catalog roles without a manual seed. Production still uses `npm run db:seed` (or an explicit catalog grant). Tests seed the catalog themselves.

Async enqueue responses include `jobId` so callers can poll this endpoint. Payloads are not returned.

```bash
npm run dev:workers
```

That command runs `backend/src/worker.ts`, which loads the same config and always registers processors. Docker Compose starts the same process as the `worker` service after Postgres, Redis, and the API are healthy. See [docker.md](docker.md).

## Retries and timeouts

Configurable with `JOB_MAX_ATTEMPTS` (default 3), `JOB_BACKOFF_MS` (exponential, default 200), and `JOB_TIMEOUT_MS` (default 60s).

Validation, authentication, authorization, not-found, and conflict errors are not retried. `odoo.sync` rejects write methods. Destructive work should set `retryable: false` when enqueueing.

## Idempotency

Pass `jobId` to skip a duplicate that is already queued, processing, or completed. Email delivery also uses an idempotency store (Redis when configured, memory otherwise) so retries do not send twice.

## Payload rules

* Attach the current request ID with `withRequestId` (the queue does this on enqueue)
* Workers wrap handlers in `runWithJobContext`
* Validate payloads with Zod inside the handler — never trust a cast
* Log failures without credentials, tokens, or OTP codes

## Workers

The workers process starts independently, recovers interrupted file-queue jobs on boot, and shuts down on `SIGTERM`/`SIGINT` without leaking in-flight credentials in logs.

When a `pdf.generate` or `report.generate` job finishes in the worker, `report.completed` is emitted on **that process** event bus so automation rules still fire while Compose sets `JOBS_PROCESS=false` on the API. Do not use `workers/src/index.ts` as the job runner — it is a lifecycle stub. `npm run dev:workers` and the Compose `worker` service start `backend/src/worker.ts`.

## Tests

In-memory enqueue, success, failure, retry, timeout, duplicate `jobId`, non-retryable errors, cleanup, and shutdown. File-queue sharing between two processes. HTTP status API. Optional SSE job progress is covered in [realtime.md](realtime.md). Do not require a live Redis server for unit tests. When `REDIS_URL` is set, BullMQ integration tests cover retries, duplicate ids, and timeouts. See [testing.md](testing.md).
