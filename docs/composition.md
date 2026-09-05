# Platform composition

How the API, worker, feature flags, and problem module share one contract. Cleanup must not invent a second registry.

## Sources of truth

| Concern | Canonical source | Aliases / copies that must not drift |
| --- | --- | --- |
| Optional modules on/off | `FEATURE_NAMES` in `@hackathon/api-contract`; evaluation in `FEATURE_REGISTRY` (`backend/src/features/registry.ts`) | Env `FEATURE_*` (plus documented `AI_ENABLED` / `ODOO_ENABLED` / `SMS_ENABLED`). Frontend re-exports `FEATURE_NAMES` from the contract. Capability catalog `featureFlag` fields point at this registry; they do not replace it. |
| Job names | `JOB_NAMES` in `backend/src/constants/index.ts` | Module `*_JOB` constants (`EMAIL_SEND_JOB`, `DOCUMENT_PROCESS_JOB`, …) alias `JOB_NAMES`. `document.analyze` remains an enqueue/process alias of `document.process`. |
| HTTP envelope and `/api/v1` paths | `@hackathon/api-contract` | Backend `types/api.ts` and frontend `types/api.ts` re-export the shared envelopes. See [api-contract.md](api-contract.md). |
| Problem host | `backend/src/problem/types.ts` | `modules/problem/src/host.ts` is a structural copy so `@hackathon/problem` does not import `backend/src`. |

## Process wiring

`createApp` (HTTP) and `createBackgroundWorker` (jobs) both:

1. Build shared services (queue, storage, email, SMS, PDF, Odoo, AI, notifications, documents, reports, RAG, search, analytics, anomaly, realtime, automation) behind the same feature flags.
2. Call `bindPlatformPlugins` then `applyProblemModule`.

The API additionally mounts `/api/v1`, Copilot, intents, planning, generator, OTP, and the scheduler. The worker always sets `processJobs: true` and does not start HTTP or the scheduler.

The `@hackathon/workers` package entry is a **lifecycle stub**. `npm run dev:workers` / Compose `worker` run `backend/src/worker.ts`. Do not put processors in `workers/src`.

## Disabled features

When a `FEATURE_*` flag is off, HTTP returns **404** `FEATURE_DISABLED`. That is not an upstream outage. Missing Gemini/SMTP/SMS configuration still returns **502** `EXTERNAL_SERVICE_ERROR`.

Use `requireEnabledService(service, name)` in controllers and `FeatureDisabledError(name)` in services when the flag is off.

## What not to merge

* Capability catalog vs `FEATURE_REGISTRY` — inventory vs process switches.
* Platform plugins vs the problem module — plugins extend core registries; problem code stays under `modules/problem`.
* `authorizeRole` vs `requirePermission` — both are public; routes use permissions.
* `requireFeature` HTTP middleware — public helper for route-level gates; most routes already null-out the service.

## Tests

* `backend/src/constants/job-names.test.ts` — module job constants equal `JOB_NAMES`
* `backend/src/features/features.test.ts` — frontend `FEATURE_NAMES` equals backend `FEATURE_NAMES`
* HTTP suites for optional modules — disabled flag → `FEATURE_DISABLED`
