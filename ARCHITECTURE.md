# HACKATHON STARTER KIT — ARCHITECTURE

## 1. SYSTEM PURPOSE

This repository is a reusable full-stack application platform designed to accelerate hackathon development.

The platform provides reusable capabilities for:

* authentication
* authorization
* databases
* AI
* Odoo
* automation
* background processing
* notifications
* storage
* reporting
* security
* observability
* CI/CD

Problem-specific features must be added separately.



# 2. HIGH-LEVEL ARCHITECTURE

text
                    React Frontend
                         │
                         │ HTTPS / REST
                         ▼
                  Express API Layer
                         │
             ┌───────────┼───────────┐
             │           │           │
             ▼           ▼           ▼
          Services   Integrations  Jobs
             │           │           │
             ▼           ▼           ▼
       Repositories    Providers   Workers
             │
             ▼
         PostgreSQL

External integrations:

Services
   │
   ├── Odoo
   ├── AI Provider
   ├── Email Provider
   ├── SMS Provider
   ├── Storage Provider
   └── Search Provider (Postgres default; future Elasticsearch adapter implements the same interface)

Infrastructure:

Redis
Docker Compose (see docs/docker.md)
GitHub Actions




# 3. FRONTEND ARCHITECTURE

text
frontend/src/

ui/           Reusable visual system (see docs/ui.md) — includes theme and toasts
features/     FeatureProvider — UX only, loads GET /api/v1/features
auth/         AuthProvider, SessionGate, login form
components/   Feature UI that composes the kit (notifications, copilot re-export)
pages/
layouts/
hooks/        Optional shared hooks (README only until a hook is added)
context/      Optional global context (auth and theme already live under auth/ and ui/)
services/     API modules — import paths from `@hackathon/api-contract`
lib/
types/
utils/


## Components

Reusable visual components live in `frontend/src/ui`.

Examples:

* Button, Input, Select, Modal, DataTable, Card
* AppShell, Sidebar, Topbar, PageContainer
* DashboardLayout (slots only — no hardcoded business data)
* CopilotChat and AI result surfaces

Feature-specific composites (notification inbox, preferences) stay under `components/`.

## Pages

Application-level screens. `/ui` is the component gallery. `/dashboard` is a placeholder layout.

## Hooks

Put reusable React behavior here when it is not auth, theme, or API access. Auth lives in `auth/`. Theme and toasts live in `ui/`. Do not hide backend URLs in hooks.

## Context

Use React Context only for genuine global state. Session state is `auth/AuthProvider`. Theme is `ui` ThemeProvider. `context/` is a placeholder for additional kit-wide providers.

Do not place every state variable inside Context.

## Services

API communication.

Components must not contain hardcoded backend URLs.



# 3A. OPERATIONAL ENDPOINTS

These stay outside `/api/v1`:

* `GET /health` — process liveness and application status
* `GET /ready` — PostgreSQL, Redis, Odoo, and AI checks when those integrations are configured
* `GET /api/v1/audit` — RBAC-protected audit list (see [audit.md](docs/audit.md))

Application APIs use `/api/v1` and the standard success/error envelopes from `@hackathon/api-contract` (see [api-contract.md](docs/api-contract.md)). `GET /api/v1/features` is the public feature-flag snapshot (UX only; see [features.md](docs/features.md)). `GET /api/v1/capabilities` is the public capability catalog and optional project profiles (see [capabilities.md](docs/capabilities.md) and [profiles.md](docs/profiles.md)).



# 4. BACKEND ARCHITECTURE

text
backend/src/

config/
constants/    Re-exports API_PREFIX, ERROR_CODES, and paths from `@hackathon/api-contract`
platform/     Thin plugins (definePlatformPlugin, optional plugin version) used by createApp and the worker
capabilities/ Machine-readable capability catalog, deterministic resolver, and optional project profiles (not FEATURE_* and not Odoo allowlists)
controllers/
routes/
services/
repositories/
middleware/
schemas/
integrations/
jobs/
events/
scheduler/
notifications/
automation/
auth/
rbac/
security/
audit/
observability/
features/
intents/
problem-intelligence/
capability-recommendations/
project-planning/
anomaly/
utils/
types/
constants/




# 5. REQUEST FLOW

Normal request:

text
HTTP Request
     ↓
Request ID
     ↓
Middleware
     ↓
Route
     ↓
Controller
     ↓
Schema validation
     ↓
Service
     ↓
Repository / Integration
     ↓
Response / centralized error handler


Long-running request:

text
HTTP Request
     ↓
Controller
     ↓
Service
     ↓
Queue
     ↓
Worker
     ↓
Service
     ↓
Database / External Provider
     ↓
Notification / Job Result




# 6. AUTHENTICATION

text
React
 ↓
Login API
 ↓
Auth Service
 ↓
PostgreSQL
 ↓
JWT
 ↓
Authenticated Request


Authentication determines identity.

RBAC determines permissions.



# 7. RBAC

text
User
 ↓
Role (one or many)
 ↓
Permission (`resource.action`)
 ↓
Authorized Action


Example:

text
MANAGER
   ↓
reports.generate
   ↓
generate report


The backend is authoritative. Frontend permission checks are UX only.

Default seeded roles: ADMIN, MANAGER, STAFF, USER. Add keys such as `inventory.approve` in `backend/src/rbac/catalog.ts` or via `POST /api/v1/permissions`, then call `requirePermission("inventory.approve")`. Do not change middleware internals.

See `docs/rbac.md`.



# 8. DATABASE

PostgreSQL stores persistent business/application data.

Prisma is the only ORM/query library. Application code reaches Postgres through:

```text
Service → Repository → Prisma Client → PostgreSQL
```

Schema, migrations, and seeds live in `database/prisma`. See `docs/database.md`.

Redis stores temporary/fast-access data such as:

* cache
* jobs
* rate-limit state
* OTP state
* idempotency state

Do not use Redis as the primary business database.



# 9. ODOO

Odoo is treated as an external business system.

```text
Frontend
   ↓
Backend (authenticate + requirePermission)
   ↓
OdooService / model adapter
   ↓
OdooClient (JSON-2)
   ↓
POST /json/2/<model>/<method>
```

Odoo credentials remain server-side (`ODOO_BASE_URL`, `ODOO_DATABASE`, `ODOO_API_KEY`).

Application login does not grant Odoo access. Enforce `odoo.read` and `odoo.write` independently of whether the user may use the application.

User-triggered calls must use a capability allowlist. Never execute an arbitrary method name supplied by an end user.

Problem-specific Odoo model logic belongs in adapters (`createOdooModelAdapter`) or `modules/problem/`. The base client stays generic.

See `docs/odoo.md`.



# 10. AI

AI is treated as an external service.

```text
Controller / Application Service
       ↓
AIService
       ↓
AiProvider (gemini | mock | new-provider)
       ↓
Gemini REST / other model
```

Reusable toolkit operations (summarize, classify, extract, analyze, recommend, draft) live on `AIService` with versioned prompts and Zod output schemas. Sentiment, priority, risk, entities, and action items reuse those operations instead of extra HTTP routes.

Document intelligence (`POST /api/v1/documents/analyze`) uploads a file, validates it, stores the original, extracts text or sends bytes multimodally, then calls `AIService.extract()`. Source documents and AI output are stored separately. See `docs/documents.md`.

Copilot (`POST /api/v1/copilot/chat`) plans over an allowlisted tool registry, then enforces RBAC, schemas, and confirmation before any handler. See `docs/copilot.md`.

Natural-language business actions (`POST /api/v1/intents/execute`) extract one registered intent, then enforce schema, permission, business rules, and high-risk confirmation before any handler. Confirmation tokens live in the shared `KvStore` (Redis when configured). See `docs/intents.md`.

Problem statement intelligence (`POST /api/v1/problem-intelligence/analyze`) turns a statement into a schema-validated spec and classifies each requirement as an existing catalog capability or new `modules/problem` logic. The model cannot execute tools or write the repository. See `docs/problem-intelligence.md`.

Capability recommendations (`POST /api/v1/capability-recommendations/recommend`) take that structured analysis and return an advisory module set (capabilities, profiles, adapters, infrastructure, architecture and deployment modes). The engine is deterministic, does not call AI, and never enables `FEATURE_*`. See `docs/capability-recommendations.md`.

Project planning (`POST /api/v1/project-planning/analyze|validate|approve`) is a human selection UI plus backend validation. It produces a Project Configuration for later generation and does not write code or enable flags. See `docs/project-planning.md`.

The project generator (`POST /api/v1/project-generator/preview|generate`) re-validates an approved configuration and writes an isolated overlay under `generated/`. It does not modify kit source or provider internals. See `docs/project-generator.md`.

Optional RAG (`FEATURE_RAG`, `POST /api/v1/rag/ask`) chunks documents, embeds them through `EmbeddingProvider`, stores vectors behind `VectorStore`, retrieves by similarity, and asks `AIService` for a grounded answer with source citations. The base kit does not enable it. See `docs/rag.md`.

Optional search (`FEATURE_SEARCH`, `POST /api/v1/search`) is a provider-agnostic keyword, filter, sort, pagination, and PostgreSQL full-text layer (`SearchService` → `SearchProvider`). Elasticsearch is not shipped; a future adapter can implement the same interface. The base kit does not enable it. See `docs/search.md`.

Optional analytics (`FEATURE_ANALYTICS`, `POST /api/v1/analytics/query`) is a provider-agnostic KPI, aggregation, time-series, dashboard, filter, and export layer (`AnalyticsService` → `AnalyticsProvider`). Warehouses are not shipped; a future adapter can implement the same interface. Problem-specific metrics are registered from `modules/problem`. The base kit does not enable it. See `docs/analytics.md`.

Optional anomaly insights (`FEATURE_ANOMALY_DETECTION`, `POST /api/v1/anomalies/evaluate`) run deterministic detectors (threshold, percent change, moving average, frequency, trend, z-score), then optionally ask `AIService` only for explanation and recommendation. Measured evidence is never taken from the model. The base kit does not enable it. See `docs/anomaly.md`.

Optional real-time (`FEATURE_REALTIME`, `GET /api/v1/realtime/events`) is Server-Sent Events for allowlisted job, notification, dashboard, automation, and document status. REST polling stays the default. The kit does not add WebSockets or a separate realtime service. See `docs/realtime.md`.

Business logic must not import provider-specific SDKs directly. Structured results are schema-validated before use. See `docs/ai.md`.



# 11. AI ACTION SAFETY

text
User
 ↓
Authentication
 ↓
Authorization
 ↓
AI
 ↓
Structured Output
 ↓
Schema Validation
 ↓
Policy Validation
 ↓
Approved Handler
 ↓
Action


AI must never directly execute arbitrary code.



# 12. AUTOMATION

The generic automation model is:

text
Trigger
   ↓
Condition
   ↓
Action


Example:

text
invoice.overdue
      ↓
daysOverdue > 7
      ↓
send notification


Automation actions should use existing services rather than duplicate logic.

The engine lives in `backend/src/automation`. Services emit domain events through `EventBus`. The scheduler in `backend/src/scheduler` emits `scheduled` ticks on an interval or UTC cron. Matching is declarative. See `docs/automation.md` and `docs/scheduler.md`.



# 13. BACKGROUND JOBS

# 13. BACKGROUND JOBS

Use queues for expensive operations. `createJobQueue` uses BullMQ when `REDIS_URL` is set, a file queue shared by the API and workers on one machine when Redis is unset, and an in-memory queue in tests. The workers process (`backend/src/worker.ts`) registers the same processors as the API (`email.send`, `sms.send`, `pdf.generate`, `report.generate`, `ai.analyze`, `document.process`, `rag.index`, `anomaly.evaluate`, `odoo.sync`, `cleanup`, `notification.dispatch`, `automation.execute`).

Poll `GET /api/v1/jobs/:jobId` for sanitized status. Retries use exponential backoff and skip validation/authorization failures. Destructive Odoo writes are not retried through `odoo.sync`.

Examples:

* AI processing
* email delivery
* PDF generation
* document analysis
* Odoo synchronization
* report generation
* cleanup

text
API
 ↓
Queue
 ↓
Worker
 ↓
Result

Examples:

* AI processing
* email delivery
* PDF generation
* document analysis
* Odoo synchronization
* report generation

text
API
 ↓
Queue
 ↓
Worker
 ↓
Result




# 14. NOTIFICATION ARCHITECTURE

```text
Business Event
  → NotificationService.sendNotification()
    → Channel Adapter
      → Provider
```

Channels: email, in-app, SMS, push, webhook. Providers must be replaceable. Application logic must not import Resend, SMTP, Brevo, Twilio, or other vendor SDKs.

The engine lives in `backend/src/notifications`. Templates, preferences, delivery status (`queued` / `processing` / `sent` / `failed` / `retrying`), retries, and idempotency are documented in `docs/notifications.md`.



# 15. STORAGE

```text
Upload
  → validation
  → metadata
  → StorageService
  → Local disk | PostgreSQL | S3
```

`STORAGE_PROVIDER=local` dual-writes to PostgreSQL when a database is configured so workers on another host can read objects. `storage.upload` validates size, filename, extension, and content (client MIME is ignored). `storage.getSignedUrl` returns a time-limited URL (S3 presigned GET, or HMAC `GET /api/v1/storage/download` for local/postgres). Files are private; S3 credentials stay server-side.

Business logic must not directly depend on S3 SDKs.




# 16. REPORTING

```text
Report request
  → data provider (verified application facts)
  → report template
  → PDF renderer
  → StorageService
  → job status + optional notification / email
```

`ReportService.generateReport({ type, data, options })` queues `report.generate` by default so HTTP requests do not wait on rendering. Built-in types (`simple`, `table`, `summary`, `document`) stay generic. Hackathons register extra templates and data providers; they must not put problem-specific reports in the reusable core.

AI narrative is stored and rendered separately from source facts. It must not overwrite verified values.

See `docs/reports.md`.



# 17. OBSERVABILITY

```text
HTTP / Job / AI call
  → structured log (requestId, jobId, module, duration)
  → optional MetricsSink
  → optional ErrorTracker (5xx / unhandled)
  → AuditService for durable sensitive actions
```

Health and readiness stay outside `/api/v1`. Metrics and error tracking are hooks; no vendor is mandatory. See `docs/observability.md` and `docs/audit.md`.



# 18. PROBLEM-SPECIFIC MODULES

Hackathon-specific features live in the `@hackathon/problem` workspace:

```text
modules/problem/src/<domain>/
modules/problem/frontend/
```

The platform loads that module at runtime (`backend/src/problem`) and passes a `ProblemHost` (routes, jobs, events, RBAC merge, registries, Odoo/AI, capability catalog). See [docs/problem-module.md](docs/problem-module.md).

The reusable core must remain generic.



# 19. DEPENDENCY DIRECTION

Preferred:

text
Controller
   ↓
Service
   ↓
Repository / Integration


Avoid:

text
Repository → Controller
Database → Controller
AI Provider → Controller
Odoo Adapter → Frontend


Dependencies should move toward stable abstractions.



# 20. SECURITY BOUNDARIES

Frontend:

* no secrets

Backend:

* owns credentials
* validates requests
* enforces authentication and RBAC
* applies categorized rate limits and brute-force controls
* sanitizes errors (no stack traces in responses)
* blocks private destinations for user-controlled URLs

External providers:

* accessed only through server-side adapters
* every outbound call has a timeout and mapped errors

Database:

* accessed only through backend services/repositories

See `docs/security.md` for assumptions and residual risks. Do not describe the kit as fully secure.




# 21. SCALABILITY PRINCIPLE

Start simple.

Scale only where actual workload requires it.

Preferred:

text
React
+
Express
+
PostgreSQL
+
Redis
+
Workers


Do not introduce:

* Kubernetes
* service mesh
* multiple databases
* multiple backend services
* load balancers

unless justified by an actual requirement.



# 22. FUTURE HACKATHON EXTENSION

DealFlow360 is implemented in `modules/problem`. Extending the platform usually requires only:

1. Add problem module.
2. Add problem database models.
3. Add problem services.
4. Add Odoo adapters if necessary.
5. Add AI tasks if necessary.
6. Add automation rules.
7. Build problem UI.
8. Configure enabled modules (`FEATURE_*` and `DEMO_MODE` — see [features.md](docs/features.md)). Optional [project profiles](docs/profiles.md) can suggest a capability set; they do not replace flags.

Core infrastructure should remain mostly unchanged.



# 23. CI/CD

GitHub Actions provides reusable verification and an optional deploy path:

```text
PR / push to main
  → CI (lint, typecheck, tests, audit, builds, Docker validation)
       ↓
optional CD (manual or gated auto-deploy)
  → production images → registry → deploy hook → health check
```

Do not hardcode a cloud vendor in the workflows. Configure registry, `DEPLOY_PROVIDER`, and health URLs through GitHub variables and secrets. See `docs/ci-cd.md`.
