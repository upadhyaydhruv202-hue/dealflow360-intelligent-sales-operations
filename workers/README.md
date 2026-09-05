# Workers

The worker process runs background jobs outside the HTTP request lifecycle.

**Do not run `node workers/dist/index.js`.** That file is a process-lifecycle stub used in tests. It logs a warning and does not consume jobs.

`npm run dev:workers` / `npm run start -w workers` start `backend/src/worker.ts` (compiled as `backend/dist/worker.js`). That entry:

* loads environment variables from the repository root `.env`
* connects to PostgreSQL and Redis when configured
* registers `email.send`, `sms.send`, `pdf.generate`, `report.generate`, `ai.analyze`, `document.process`, `rag.index` (when `FEATURE_RAG` is on), `anomaly.evaluate` (when `FEATURE_ANOMALY_DETECTION` is on), `odoo.sync`, `cleanup`, `notification.dispatch`, and `automation.execute` through the same backend services as the API
* handles `SIGTERM` and `SIGINT`

With `REDIS_URL`, the API and this process share BullMQ. Docker Compose sets `REDIS_URL=redis://redis:6379` for the `worker` service. Without Redis they share a file queue on the backend package disk (`job-queue/`). Tests keep an in-memory queue.

This package still contains `createWorkerRuntime` for process-lifecycle tests. Do not put problem-specific job logic here — add processors in `backend/src` and register them from `createBackgroundWorker`.
