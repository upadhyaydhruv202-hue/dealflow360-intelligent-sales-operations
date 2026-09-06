# Feature flags and demo mode

Env-based configuration so a new hackathon can enable only the capabilities the problem statement needs. There is no remote flag SaaS.

Server evaluation is authoritative (`isFeatureEnabled()`, `isDemoMode()`). The frontend may hide navigation from `GET /api/v1/features`. That is UX only and does not replace API checks, RBAC, or production secret rules.

`FEATURE_NAMES` and the public snapshot shape come from `@hackathon/api-contract`. `FEATURE_REGISTRY` (env vars, defaults, dependencies) stays on the API. See [api-contract.md](api-contract.md).

```bash
FEATURE_ODOO=true
FEATURE_AI=true
FEATURE_AUTOMATION=true
FEATURE_PDF=true
FEATURE_SMS=false
```

## Public interface

| Helper | Role |
| --- | --- |
| `isFeatureEnabled(config, name)` | True only when that flag is on. Missing and unknown names are false |
| `isDemoMode(config)` | True when `DEMO_MODE` is on (defaults to true outside production) |
| `requireFeature(config, name)` | Throws `FEATURE_DISABLED` (404) when the flag is off |
| `requireEnabledService(service, name)` | Throws `FEATURE_DISABLED` (404) when a feature-gated service was not constructed |
| `shouldMockExternalIntegrations(config)` | Demo or test: mock email, SMS, OTP, and optional AI |
| `GET /api/v1/features` | Public snapshot `{ demoMode, features }` with no secrets |

```ts
import { isFeatureEnabled, isDemoMode, requireFeature } from '../features';

if (isFeatureEnabled(config, 'copilot')) {
  // register copilot
}

if (isDemoMode(config)) {
  // mock OTP / email / SMS; optional mock AI
}

requireFeature(config, 'odoo');
```

## Feature registry

Defaults apply when the variable is **missing**. `.env.example` turns common local-demo flags on. `FEATURE_PDF` defaults to `true` so PDF/report HTTP stays available unless you turn it off.

| Flag | Default | Dependencies | Purpose |
| --- | --- | --- | --- |
| `FEATURE_AI` | `false` | — | LLM toolkit and document intelligence. Alias: `AI_ENABLED` |
| `FEATURE_ODOO` | `false` | — | Odoo JSON-2 integration. Alias: `ODOO_ENABLED` |
| `FEATURE_AUTOMATION` | `false` | events, jobs | Workflow HTTP API, event matching, workers |
| `FEATURE_NOTIFICATIONS` | `false` | email/SMS adapters | Extra notification side effects (document-analysis alerts). Inbox HTTP stays available when the database is configured |
| `FEATURE_OTP` | `false` | email or SMS | OTP HTTP and password reset |
| `FEATURE_SMS` | `false` | — | SMS channel. Alias: `SMS_ENABLED` |
| `FEATURE_S3` | `false` | — | Require AWS secrets. `STORAGE_PROVIDER=s3` also enables this flag |
| `FEATURE_RAG` | `false` | `FEATURE_AI` | Optional semantic search and RAG answers with source citations |
| `FEATURE_SEARCH` | `false` | — | Optional keyword, filter, sort, pagination, and PostgreSQL full-text search. Elasticsearch is not included |
| `FEATURE_ANALYTICS` | `false` | — | Optional KPI aggregations, time-series, dashboards, filters, and exports. Warehouses are not included |
| `FEATURE_COPILOT` | `false` | `FEATURE_AI` | Copilot HTTP API and chat UI. Still needs a ready AI provider |
| `FEATURE_INTENTS` | `false` | `FEATURE_AI` | Natural-language business actions. Still needs a ready AI provider |
| `FEATURE_PROBLEM_INTELLIGENCE` | `false` | `FEATURE_AI` | Problem statement → structured spec and catalog classification. Still needs a ready AI provider |
| `FEATURE_CAPABILITY_RECOMMENDATIONS` | `false` | — | Structured analysis → advisory capabilities/profiles/modes. Does not call AI or enable other flags |
| `FEATURE_PROJECT_PLANNING` | `false` | — | Project planning UI/API: selection + validated Project Configuration. Does not generate code or enable flags |
| `FEATURE_PROJECT_GENERATOR` | `false` | — | Deterministic generator: approved configuration → isolated overlay under `generated/`. Does not modify kit source |
| `FEATURE_ANOMALY_DETECTION` | `false` | AI optional | Optional statistical anomaly engine plus AI explanation. Off by default |
| `FEATURE_REALTIME` | `false` in the registry; `true` in DealFlow360 `.env.example` | — | Optional Server-Sent Events for allowlisted job, notification, dashboard, automation, document, and DealFlow quote/approval/billing/anomaly status. REST polling stays available when off |
| `FEATURE_PDF` | `true` | storage | PDF generate and report HTTP APIs. Set `false` to disable. Jobs and automation can still render PDFs |

Dependencies in this table are runtime needs, not automatic AND-gates. `FEATURE_COPILOT=true` does not silently enable AI; set `FEATURE_AI` (or `AI_ENABLED`) as well.

## Demo mode

`DEMO_MODE` defaults to **true** when `NODE_ENV` is not `production`. Set `DEMO_MODE=false` for a production-like local run.

When demo mode is on:

* Seed may create demo users (`demo.admin@example.com` / `demo-password`)
* Email never leaves the process (mock provider)
* SMS never hits a real gateway
* OTP uses the mock adapter (no accidental real SMS or production email)
* AI may fall back to the mock provider when no Gemini key is set
* Automation webhooks, copilot demo tools, and intent demo handlers stay mock/in-process

Production (`NODE_ENV=production`) refuses `DEMO_MODE=true` unless `ALLOW_DEMO_IN_PRODUCTION=true`. It also refuses mock AI, email, SMS, and OTP providers unless demo mode is allowed that way. Do not set either flag on a real production tenant.

Demo-user seed is skipped when `DEMO_MODE` is off (including production). RBAC catalog seed still runs. DealFlow also skips customers, inventory, and quotations; configuration (products, policies, chains, governance) still seeds. When `DEMO_MODE` is on, seed recreates the connected presentation book so dashboards and lists stay internally consistent.

## Frontend

`FeatureProvider` loads `GET /api/v1/features`. Copilot, Actions, Problem intelligence, Recommendations, Project planning, Project generator, RAG, Search, Analytics, Anomalies, Realtime, and Automations links appear only when those flags are on. `/copilot`, `/intents`, `/problem-intelligence`, `/capability-recommendations`, `/project-planning`, `/project-generator`, `/rag`, `/search`, `/analytics`, `/anomalies`, `/realtime`, and `/automations` show an empty state if opened while disabled. The API rejects disabled optional modules with `FEATURE_DISABLED` (404). Missing providers (Gemini, SMTP, SMS gateways) still return `EXTERNAL_SERVICE_ERROR` (502).

## Tests

* Enabled flag, disabled flag, missing flag, unknown name
* Demo mode and production mode
* `GET /api/v1/features` snapshot
* Frontend nav hiding and `FeatureGate`

The capability catalog (`docs/capabilities.md`) describes what exists. `resolveCapabilities` validates an explicit selection and never turns flags on. Optional [project profiles](profiles.md) compose that catalog; they are not required and they do not replace this flag registry. This flag registry decides what is **on** for a process.

## Limitations

* Flags are process env, not per-user or per-tenant. Restart after a change.
* Notification inbox HTTP is not gated by `FEATURE_NOTIFICATIONS` (in-app inbox stays available when the database is configured; the flag controls extra side effects such as document-analysis alerts).
