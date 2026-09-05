# Jobs

Queue definitions and job payloads live here.

Workers consume these jobs asynchronously. Do not process queues inside controllers.

`createJobQueue({ redisUrl })` uses BullMQ. `createJobQueue({ jobsDir })` uses a file queue shared by the API and workers on one machine. Tests without either option stay in-memory.

Registered job names: `email.send`, `sms.send`, `pdf.generate`, `report.generate`, `ai.analyze`, `document.process` (`document.analyze` alias), `rag.index`, `anomaly.evaluate`, `odoo.sync`, `cleanup`, `notification.dispatch`, `automation.execute`. See `docs/jobs.md`.

Job name strings live in `JOB_NAMES` (`backend/src/constants/index.ts`). Module `*_JOB` constants alias that catalog.

`GET /api/v1/jobs/:jobId` returns sanitized status. Redis also backs cache, rate limits, OTP hashes, and idempotency keys when `REDIS_URL` is set.
