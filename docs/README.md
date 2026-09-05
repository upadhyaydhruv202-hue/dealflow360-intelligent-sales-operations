# Documentation

Teammate onboarding for DealFlow360 starts in the root [README.md](../README.md) (**Manual Project Setup**). This folder is the kit catalog.

| Document | Purpose |
| --- | --- |
| [Setup manual](SETUP_MANUAL.md) | Complete A–Z setup and usage guide compiled from this repository |
| [Prerequisites](prerequisites.md) | Software, versions, Docker-provided services, accounts, install order |
| [Version matrix](VERSION_MATRIX.md) | Current vs supported versions and pin sources |
| [Versioning policy](VERSIONING_POLICY.md) | Upgrade rules, security updates, and test requirements |
| [Getting started](getting-started.md) | Local setup and verification |
| [Fresh setup checklist](FRESH_SETUP_CHECKLIST.md) | New-developer reproduction: software, env, Docker, migrate, tests, health |
| [UI kit](ui.md) | Reusable React + Tailwind components, layout, dashboard, AI UI |
| [Docker](docker.md) | Compose stack, health checks, and `docker compose up --build` |
| [Foundation](foundation.md) | Configuration, health, shutdown, extension points |
| [Database](database.md) | Prisma, migrations, seeding, repositories |
| [Authentication](auth.md) | Register, login, JWT, refresh rotation, `authenticate()` |
| [RBAC](rbac.md) | Roles, `resource.action` permissions, `authorizeRole` / `requirePermission` |
| [Odoo](odoo.md) | Odoo 19 JSON-2 client, capabilities, model adapters |
| [AI](ai.md) | Provider-agnostic LLM service and intelligence toolkit (Gemini, mock) |
| [AI guardrails](ai-guardrails.md) | Shared AI safety layer: schema, tools, confirmation, redaction, audit |
| [Document intelligence](documents.md) | Upload, validate, extract, and persist structured document fields |
| [Storage](storage.md) | Local filesystem, PostgreSQL, and S3 object storage |
| [Background jobs](jobs.md) | In-memory, file, or BullMQ queues, job status API, and the workers process |
| [Redis](redis.md) | Optional cache, rate limits, OTP state, idempotency keys, and queues |
| [Email](email.md) | Transactional email (SMTP, Resend, Brevo, mock) and reusable templates |
| [OTP](otp.md) | Hashed one-time passcodes with email, SMS, and mock delivery |
| [SMS](sms.md) | Transactional SMS (HTTP + mock) |
| [PDF](pdf.md) | Low-level PDF renderer |
| [Reports](reports.md) | Report templates, async PDF jobs, storage, notifications |
| [Notifications](notifications.md) | Multi-channel notifications, templates, preferences |
| [Copilot](copilot.md) | Controlled assistant, tool registry, confirmation, and audit |
| [Optional RAG](rag.md) | Semantic search and retrieval-augmented generation (off by default) |
| [Optional search](search.md) | Keyword, filter, sort, pagination, and PostgreSQL full-text search (off by default) |
| [Optional analytics](analytics.md) | KPI definitions, aggregations, time-series, dashboards, filters, and exports (off by default) |
| [Optional anomaly engine](anomaly.md) | Statistical detection plus optional AI explanation (off by default) |
| [Optional real-time](realtime.md) | Server-Sent Events for allowlisted live status (off by default) |
| [Natural-language actions](intents.md) | NL → registered intent → validate → authorize → confirm → handler |
| [Problem statement intelligence](problem-intelligence.md) | Problem statement → structured spec → existing capability vs new problem logic |
| [Capability recommendations](capability-recommendations.md) | Structured analysis → advisory capabilities, profiles, adapters, and modes |
| [Project planning](project-planning.md) | Problem statement → human selection → validated Project Configuration (no code generation) |
| [Project generator](project-generator.md) | Approved Project Configuration → isolated overlay (core, capabilities, adapters, problem module, tests, docs) |
| [Automation](automation.md) | Trigger-condition-action workflows, event bus, and pluggable actions |
| [Scheduler](scheduler.md) | Interval and UTC cron ticks that emit domain events |
| [API conventions](api-conventions.md) | `/api/v1` envelopes and error model |
| [Shared API contract](api-contract.md) | `@hackathon/api-contract`: envelopes, paths, feature names |
| [Validation](validation.md) | Zod schemas, parse helpers, error types, request IDs |
| [Security](security.md) | Headers, CORS, rate limits, SSRF, secrets, residual risks |
| [Audit](audit.md) | Audit events, redaction, RBAC list API |
| [Observability](observability.md) | Structured logs, health, metrics and error-tracking hooks |
| [Environment variables](environment.md) | Authoritative catalog: required, optional, secrets, frontend-safe |
| [Configuration](configuration.md) | How `.env` is loaded and validated |
| [Feature flags](features.md) | `FEATURE_*` registry, `isFeatureEnabled()`, demo mode |
| [Platform composition](composition.md) | Shared API/worker wiring, job-name catalog, disabled-feature contract |
| [Capability registry](capabilities.md) | Machine-readable catalog, dependency graph, and explicit-selection resolver |
| [Project profiles](profiles.md) | Optional composable capability sets, maturity, and version compatibility |
| [Problem module](problem-module.md) | Isolated `modules/problem` extension: host, compile boundary, DealFlow360 slot |
| [Testing](testing.md) | Unit, integration, e2e, mocks, factories, coverage, CI |
| [CI/CD](ci-cd.md) | GitHub Actions CI, provider-agnostic CD, artifacts, rollback |

Repository-level documents:

* `README.md`
* `AGENTS.md`
* `ARCHITECTURE.md`
* `ARCHITECTURE_DECISION.md`
* `HACKATHON_MODULES.md`
* `PROBLEM_STATEMENT.md`
