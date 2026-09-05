# Architecture decisions

This file has two parts.

1. **Kit stack** — why this repository is React, Express, PostgreSQL, Redis, and adapters. Do not rewrite these during a hackathon unless the statement **forces** a change.
2. **This product** — DealFlow360 decisions live with [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md) and [HACKATHON_MODULES.md](HACKATHON_MODULES.md).

System diagrams: [ARCHITECTURE.md](ARCHITECTURE.md). Capability catalog: [docs/capabilities.md](docs/capabilities.md).

---

## Part A — Kit stack (stable)

Priority: correctness, security, reliability, then speed of delivery. The kit is a **modular monolith**, not microservices.

### Why these technologies?

| Choice | Why | Alternative considered | Trade-off |
| --- | --- | --- | --- |
| React + Vite + Tailwind + React Router | Fast SPA, HMR, reusable UI kit, no server-render requirement for a judged demo | Next.js / Remix | No SSR/RSC. Pages are client-routed. |
| React Context (session, theme, flags) | Few globals | Redux / TanStack Query as defaults | Add a data library only if the golden path is fetch-heavy |
| Node.js + Express REST `/api/v1` | Matches the layering rules; easy to read under time pressure | Nest, Fastify, GraphQL | Less built-in structure; controllers must stay thin |
| TypeScript in the API | Schemas and providers benefit from types | JS-only API | Frontend can stay TS/JS as already set up |
| PostgreSQL + Prisma (one ORM) | Relational integrity, migrations, seed | Mongo, Knex, Drizzle | CHECK constraints live in SQL migrations; do not add a second ORM |
| Redis (optional locally) | Cache, rate limits, OTP, idempotency, BullMQ | Redis mandatory even on a laptop | File queue shares jobs on one machine without Redis; **production requires Redis** |
| BullMQ when `REDIS_URL` is set | Retries, backoff, shared workers | Kafka, cloud queues | Enough for hackathon and small production |
| Docker Compose | One command: API, worker, Postgres, Redis, frontend | Kubernetes, service mesh | Not multi-region HA |
| GitHub Actions | Lint, test, build, image smoke | Vendor-specific CI | CD is provider-agnostic on purpose |
| Odoo JSON-2 behind `OdooService` | Odoo 19 API-key auth, allowlisted capabilities | XML-RPC, frontend→Odoo | No arbitrary methods from the browser |
| AI via `AIService` (Gemini + mock) | Provider file is swappable; Zod on output | Calling Gemini from React | Keys stay server-side; mock for demo/CI |
| Email / SMS / storage adapters | Swap SMTP/Resend/Brevo, local/S3 | Vendor SDK in controllers | Demo mode never sends real mail/SMS |
| Env feature flags | Enable only what the statement needs | Remote flag SaaS | Restart to change flags; not per-user |
| Optional SSE (`FEATURE_REALTIME`) | Server→client job/inbox/dashboard/automation/document status on Express | WebSockets / Socket.IO / a realtime microservice | Not bidirectional; off by default; poll REST when the flag is off |
| Shared `@hackathon/api-contract` (Zod + TS) | One source for envelopes, `/api/v1` paths, and `FEATURE_NAMES` | OpenAPI + codegen, duplicate frontend/backend types | Not a full HTTP spec. Business bodies stay in module schemas |
| Capability catalog | Machine-readable inventory of modules, adapters, and modes | A second FEATURE_* system | Metadata only; flags and RBAC stay authoritative |
| Demo mode | Safe judged laptop | Always-live third parties | Production refuses `DEMO_MODE` unless explicitly allowed |

### Request and async flows

```text
HTTP → request ID → middleware → route → controller → Zod → service
     → repository | integration adapter → PostgreSQL | provider
```

```text
Slow work: service → queue (memory | file | BullMQ) → worker → service → event / notification
```

### Security boundaries (non-negotiable)

* Frontend: no Odoo/AI/SMTP/JWT **secrets**. `VITE_*` is not for keys.
* Backend owns credentials, RBAC, rate limits, SSRF on user-controlled URLs.
* AI output is untrusted: schema → policy → allowlisted tool/intent → optional confirmation.
* Odoo: `odoo.read` / `odoo.write` independent of “logged in”; capabilities in code.
* Do not describe a hackathon fork as “fully secure.” See [docs/security.md](docs/security.md).

### What we will not add by default

Kubernetes, Kafka, GraphQL, extra databases, extra Node services, a second ORM. Add them only with a written requirement in Part B.

---

## Part B — This hackathon (fill in)

Copy the official statement into [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md). Keep this section short enough to brief a teammate in five minutes.

### Problem

### Target users

### Actors

### Core workflow (golden path)

```text
1.
2.
3.
```

### Secondary workflows (explicitly later)

### Enabled modules and flags

See [HACKATHON_MODULES.md](HACKATHON_MODULES.md).

```text
FEATURE_ODOO=
FEATURE_AI=
FEATURE_AUTOMATION=
FEATURE_COPILOT=
FEATURE_INTENTS=
FEATURE_PROBLEM_INTELLIGENCE=
FEATURE_CAPABILITY_RECOMMENDATIONS=
FEATURE_PROJECT_PLANNING=
FEATURE_PROJECT_GENERATOR=
FEATURE_RAG=
FEATURE_ANOMALY_DETECTION=
FEATURE_REALTIME=
FEATURE_SMS=
FEATURE_S3=
FEATURE_PDF=
DEMO_MODE=
```

### Odoo

| Item | Decision |
| --- | --- |
| Apps | |
| Models | |
| Read | |
| Write | |
| Capabilities | |
| Sync / jobs | |
| Demo if Odoo is down | |

### Application database entities

### AI capabilities

For each: necessary? input → schema → failure behavior. Link Phase 4 answers.

### Automation rules

Trigger / condition / action — or **none**.

### Notifications and jobs

### Reports and files

### Authentication and authorization

Default roles: ADMIN, MANAGER, STAFF, USER. Extra keys:

```text
# example: inventory.approve
```

### Security considerations

Destructive actions, confirmation, audit events to show in the demo.

### Performance and deployment

What must be queued. Compose vs hybrid. Production secrets on the host only.

### Why this slice (not the whole kit)

### Alternatives considered (this problem)

### Risks

### Success criteria

### Demo fallback
