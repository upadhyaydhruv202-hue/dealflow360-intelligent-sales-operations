# DealFlow360

### An Intelligent, Self-Governing Sales Operations Platform

> DealFlow360 treats a quotation as a governed commercial decision — not a static PDF. Discount policy, blended risk, approval chains, warehouse feasibility, hybrid billing, and customer negotiation live in one backend-authoritative loop. PostgreSQL is the system of record. Confirmation in the default demo is local.

[![CI](https://github.com/upadhyaydhruv202-hue/dealflow360-intelligent-sales-operations/actions/workflows/ci.yml/badge.svg)](https://github.com/upadhyaydhruv202-hue/dealflow360-intelligent-sales-operations/actions/workflows/ci.yml)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)](#tech-stack)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](#tech-stack)
[![Node.js](https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white)](#tech-stack)
[![Express](https://img.shields.io/badge/Express-REST%20%2Fapi%2Fv1-000000?logo=express&logoColor=white)](#tech-stack)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](#tech-stack)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](#tech-stack)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](#tech-stack)
[![License](https://img.shields.io/badge/License-AGPL--3.0--or--later-blue.svg)](#license)

**Staff workspace:** [`/dealflow`](http://localhost:5173/dealflow) · **Customer portal:** `/portal/:token` · **API:** `/api/v1/dealflow`

Product logic lives in `modules/problem/`. Auth, RBAC, Prisma, queues, and adapters stay in the reusable platform. Do not move DealFlow rules into kit folders.

| Jump | |
| --- | --- |
| [60 seconds](#-dealflow360-in-60-seconds) · [Problem](#-the-problem) · [Approach](#-the-dealflow360-approach) · [Why](#-why-dealflow360) · [Capabilities](#capability-matrix) · [Golden demo](#-golden-demo) | [Architecture](#-architecture) · [Rules](#-business-rules) · [Security](#-security--access-control) · [API](#-api-overview) · [Setup](#-quick-start) · [Limits](#implemented-vs-intentionally-limited) |

---

## ⚡ DealFlow360 in 60 Seconds

A sales rep prices a mixed hardware + subscription quote. The server explains the discount against policy, scores revenue-weighted risk, and opens the right approval chain. After approval, the same quote can attach a recommended line, split warehouses (including backorder), and generate one-time plus recurring billing. The customer negotiates on an isolated portal. A material commercial change invalidates prior approvals and starts a new chain. Staff then confirms locally.

```mermaid
flowchart LR
  A[Sales rep] --> B[Quote]
  B --> C[Policy + risk]
  C --> D[Approval chain]
  D --> E[Fulfillment]
  E --> F[Hybrid billing]
  F --> G[Customer portal]
  G --> H{Material change?}
  H -->|Yes| D
  H -->|No| I[Local confirm]
```

| Actor | Seeded account | What they do | What they cannot do |
| --- | --- | --- | --- |
| Staff | `demo.staff@example.com` | Create, submit, fulfill, bill, confirm | Approve a chain step (API 403) |
| Manager | `demo.manager@example.com` | First approval step; also has quote write | Act as Finance or Final |
| Admin | `demo.admin@example.com` | Finance + Final; every catalog permission after RBAC merge; may act on any step | Treat the customer portal as an internal console |
| Customer | `demo.user@example.com` | `/account` only | Open `/dealflow` or staff APIs |
| Portal holder | Unguessable `portalToken` | See commercial totals and change line discounts | See risk score, reasons, approvals, fulfillment, billing ops, revisions, or staff IDs |

---

## 🎯 The Problem

Traditional sales tools treat quotations as documents: a price, a PDF, maybe an email. The hard work happens outside the system.

That leaves operational gaps this product actually implements against:

| Failure | What goes wrong |
| --- | --- |
| Discount leakage | A line discount is typed without a visible ceiling, variance, or reason |
| Inconsistent approval | Nobody can say who must approve, or why this quote vs another |
| Margin erosion | Isolated line discounts hide the blended, revenue-weighted impact |
| Fake feasibility | A quote is “sold” against a single imaginary warehouse |
| Split reality | Hardware must ship from West and East; leftovers become backorder |
| Mixed commercial models | Hardware is one-time; software/services are recurring — they are not one invoice |
| Unsafe negotiation | The customer sees internal risk, audit, or approval controls |
| Stale governance | A material portal change keeps an old “approved” stamp |

DealFlow360’s problem statement is narrower than “CRM”: **one quotation lifecycle that stays governed after the customer pushes back.**

---

## 💡 The DealFlow360 Approach

Six engines share one `Quote` aggregate in PostgreSQL.

```mermaid
flowchart TB
  subgraph quote [Quote aggregate]
    L[Lines]
    A[Assessment fields]
    C[Approval steps]
    F[Fulfillment splits + backorders]
    B[Billing schedules]
    R[Revisions]
  end
  P[Discount policies] --> A
  H[Approval chains] --> C
  S[Stock on-hand − reserved] --> F
  K[Product relations] --> U[Recommendations]
  U --> L
  Portal[Token portal] -->|stripped view| L
  Portal -->|material change| C
```

| Layer | Responsibility |
| --- | --- |
| Commercial governance | Policy match by customer tier and product category |
| Risk intelligence | Line decisions + blended discount + risk score + required chain |
| Approval automation | Ordered steps; role keys; invalidation on material change |
| Fulfillment planning | Multi-warehouse allocation; available = on-hand − reserved |
| Hybrid billing | Separate one-time and recurring schedules |
| Customer negotiation | Public token routes; portal payload omits internals |

Odoo is an **optional adapter**, not the system of record. `.env.example` sets `FEATURE_ODOO=false` / `ODOO_ENABLED=false`. Confirmations do not invent remote sale-order IDs.

---

## 🔥 Why DealFlow360?

### 1. Explainable discount governance

Every assessed line records: requested discount → matched policy → warning / approval / reject ceiling → variance → reason string. The UI surfaces “why” and “who” from the backend assessment, not a frontend guess.

### 2. Revenue-weighted blended risk

The engine does not treat each line in isolation for the quote decision. Blended discount is `discountTotal / listTotal`. Risk score combines blended discount, average margin erosion, and counts of warning / approval-required / rejected lines. Multiple warning-level lines can escalate the quote (`cumulativeWarningLimit = 2`).

### 3. Governance that survives negotiation

A material change is a blended-discount increase of **2 percentage points** or a **10%** move in net total. The server invalidates outstanding approvals and opens a new chain. The customer portal never decides that policy.

### 4. Fulfillment-aware sales

Planning reads live stock. Available units are **on-hand minus reserved**. The seeded Core Gateway book is West DC 4 + East DC 3. A qty-8 hardware line produces a split plus backorder 1.

### 5. Hybrid billing

`generateBilling` writes one-time schedules for hardware and recurring schedules for software/services. The API does **not** collect or record payments.

### 6. Customer portal isolation

`GET/PATCH /api/v1/dealflow/portal/:token` returns commercial totals, blended discount %, customer name, and lines. It **omits** risk score, policy reasons, approvals, fulfillment, billing operations, revisions, and staff identifiers. Unknown tokens 404. Customer JWT login (`demo.user@example.com`) cannot open `/dealflow`. The portal token is not the customer JWT.

---

## Capability Matrix

| Capability | Status | What it does |
| --- | --- | --- |
| Discount governance | ✅ | Policy ceilings, reasons, line + quote decision |
| Risk assessment | ✅ | Blended discount, margin, risk score, required chain |
| Approval routing | ✅ | Manager → Finance → Final by risk / blended thresholds |
| Staff submit | ✅ | Staff cannot approve (API 403) |
| Recommendations | ✅ | Catalog relations (Core Gateway → Edge Sensor Pack) |
| Fulfillment split | ✅ | Multi-warehouse plan + optional overrides |
| Backorders | ✅ | Remainder after available stock |
| Hybrid billing | ✅ | One-time vs recurring schedules |
| Customer portal | ✅ | Token read + line-discount negotiation |
| Reapproval | ✅ | Material change invalidates prior steps |
| Local confirm | ✅ | Consumes allocated stock; no Odoo sale-order ID in the default demo |
| Audit trail | ✅ | Kit `AuditEvent` + quote revisions |
| Deal Health / Reports | ✅ | Derived from live quotes — no snapshot table |
| Auth + JWT + RBAC | ✅ | Required when `DATABASE_URL` is set |
| Odoo adapter | ⚙️ | Allowlisted JSON-2 client; `FEATURE_ODOO=false` in `.env.example` |
| AI toolkit | ⚙️ | `FEATURE_AI=true`; mock when `DEMO_MODE` and no Gemini key. **Not used for pricing** |
| Kit copilot / intents / planning | ⚙️ | On in `.env.example`; not the golden path |
| PDF kit | ⚙️ | `FEATURE_PDF` defaults on |
| Background jobs | ⚙️ | Queue always; Redis via Compose; worker optional for the golden path |
| Payment collection | — | No checkout, no captured payments |
| RAG / search / analytics / SSE / SMS / S3 | — | Flags false in the default demo |

---

## 🏆 Golden Demo

<a id="demo-workflow"></a>

Seeded password for every demo account: `demo-password`.

```mermaid
sequenceDiagram
  participant Staff
  participant API
  participant Manager
  participant Admin
  participant Portal
  Staff->>API: Create Northwind quote + HW-CORE-1×8@16% + SW-CTRL-1×1@16%
  API-->>Staff: Assessment: why, variance, Sales Manager → Finance → Final
  Staff->>API: Submit
  Manager->>API: Approve step 1
  Admin->>API: Approve Finance, then Final
  Staff->>API: Add recommended Edge Sensor Pack
  Staff->>API: Plan fulfillment (West 4, East 3, backorder 1)
  Staff->>API: Generate billing (one-time + monthly)
  Portal->>API: PATCH discount to 22%
  API-->>Portal: Material change; approvals invalidated
  Manager->>API: Re-approve
  Admin->>API: Re-approve remaining steps
  Staff->>API: Confirm locally
```

1. Sign in as **staff** → Dashboard → New quotation → **Northwind Retail**.
2. Add **Core Gateway × 8 @ 16%** and **Control Suite × 1 @ 16%**.
3. Open Discount / Risk: requested vs allowed vs variance, why, who.
4. Submit. Staff cannot approve.
5. Sign in as **manager**; approve Sales Manager.
6. Sign in as **admin**; approve Finance, then Final.
7. Add the recommended **Edge Sensor Pack**.
8. Accept the suggested split: West 4, East 3, backorder 1.
9. Generate billing. One-time and recurring stay separate.
10. Copy **this quote’s** portal link from the workspace (a new quote gets a new token).
11. As the customer, raise a line discount to **22%**. That exceeds the 2 pp material-change threshold.
12. The server invalidates outstanding approvals and opens a new chain.
13. Manager + admin approve again.
14. Staff confirms locally. Activity is visible on a manager or admin session.

Seeded token `df-demo-portal-token-northwind-0001` opens **DF-00001** (draft Northwind catalog quote) so you can inspect portal isolation immediately. It is not a substitute for the quote you just created.

If you confirm another qty-8 Core Gateway quote, run `npm run db:seed` before repeating the split. Seed resets on-hand **and** reserved; it does not rewrite an already-created DF-00001.

---

## 🏗️ Architecture

```text
React (Vite)
    → REST /api/v1
        → Controller (HTTP + Zod)
            → Service (policy, risk, approvals, fulfillment, billing)
                → Repository / Prisma store
                    → PostgreSQL (df_* + kit tables)
```

```text
Slow kit work (optional for the golden path):
API / service → queue (memory | file | BullMQ) → worker → service → event / notification
```

```mermaid
flowchart TB
  UI[React + Vite :5173]
  API[Express /api/v1 :5000]
  PG[(PostgreSQL :5433)]
  RD[(Redis :6379)]
  WK[Worker process]
  UI -->|proxy /api /health /ready| API
  API --> PG
  API -.->|when REDIS_URL set| RD
  WK -.-> RD
  WK --> PG
  API -.->|FEATURE_ODOO=false by default| OD[Odoo 19 JSON-2 adapter]
  API -.->|mock if no Gemini key| AI[AIService]
```

| Concern | Who owns it |
| --- | --- |
| Quotes, stock, approvals, billing, revisions | PostgreSQL via Prisma (`df_*`) |
| Users, roles, permissions, audit, notifications | PostgreSQL kit models |
| Session | HttpOnly `hsk_access` / `hsk_refresh` cookies plus in-memory Bearer token ([docs/security.md](docs/security.md)) |
| Odoo | Adapter only; off unless flags and credentials are set |
| AI | Untrusted; schema-validated; not on the pricing path |

---

## Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Frontend | React 18, Vite, TypeScript, Tailwind, React Router | Staff workspace, login, isolated portal |
| Backend | Node.js 24, Express, TypeScript | `/api/v1` controllers, Zod validation |
| Domain | `modules/problem` | DealFlow engines and UI |
| Database | PostgreSQL 16 | System of record |
| ORM | Prisma 6 | Schema, migrations, seed |
| Cache / jobs | Redis 7, BullMQ | Rate limits, OTP, idempotency, shared workers |
| Worker | Same backend image (`CMD worker`) | Email, PDF, kit jobs — optional for the demo |
| Contract | `@hackathon/api-contract` | Envelopes, `/api/v1` paths, feature names |
| Integrations | Odoo adapter, AIService, email/SMS/storage adapters | Swappable; secrets stay on the server |
| Containers | Docker Compose | Postgres, Redis, optional full stack |
| CI | GitHub Actions | Lint, typecheck, unit/integration/e2e, images, smoke |
| Tests | Vitest, Testing Library | Unit + HTTP; mocks for Odoo, AI, email, SMS, storage |

Not in this repo’s default path: Kubernetes, Kafka, GraphQL, a second ORM, Playwright as a required install, or a live Odoo server.

---

## Domain Model

Persisted DealFlow entities (`database/prisma/schema.prisma`):

| Entity | Table | Role |
| --- | --- | --- |
| Customer | `df_customers` | Tiered account (standard / gold / strategic) |
| Product | `df_products` | SKU, list, cost, billing type |
| Product relation | `df_product_relations` | Upsell / cross-sell recommendations |
| Warehouse | `df_warehouses` | Fulfillment cost per unit |
| Stock level | `df_stock_levels` | On-hand + reserved |
| Discount policy | `df_discount_policies` | Warning / approval / reject / margin impact |
| Approval chain + steps | `df_approval_chains`, `df_approval_chain_steps` | Who must sign, in order |
| Quote | `df_quotes` | Totals, risk, status, portal token |
| Quote line | `df_quote_lines` | Qty, discount, optional recommendation source |
| Approval | `df_quote_approvals` | Step state, actor, reason |
| Fulfillment split | `df_quote_fulfillment_splits` | Warehouse allocation |
| Backorder | `df_quote_backorders` | Unfilled quantity |
| Billing schedule | `df_quote_billing_schedules` | One-time or recurring |
| Quote revision | `df_quote_revisions` | Snapshot + material-change flag |
| Audit event | `audit_events` | Kit audit (managers/admins) |

Quote statuses: `draft` → `approval_required` → `approved` → `customer_negotiation` → `confirmed` / `fulfillment` / `billing` / `completed`, or `rejected`.

There is **no** stored “deal health snapshot” table. Deal Health and Reports compute from the live quote list.

---

## 🧠 Business Rules

All of the following run on the server (`modules/problem/src/dealflow`).

**Policy match.** More specific policies win (customer tier and/or product category), then lower `priority`. Northwind is `standard`, so hardware at 16% hits **Default ceiling** (warning 3%, approval 5%, reject 25%).

**Line decision.**

```text
discount >= rejectPercent        → rejected
discount >= approvalPercent      → approval_required
discount >= warningPercent       → warning
else                             → allowed
margin erosion >= maxMarginImpact → escalate to approval_required (unless already rejected)
```

**Blended discount.**

```text
blendedDiscountPercent = (listTotal - netTotal) / listTotal × 100
```

**Risk score** (clamped 0–100):

```text
blendedDiscountPercent × 2.5
+ average(marginErosionPercent) × 0.4
+ warningCount × 8
+ approvalLineCount × 15
+ rejectedCount × 40
```

**Cumulative escalation.** Two or more warning-level lines force `approval_required` on the quote.

**Chain selection.** Among chains where `riskScore >= minRiskScore` **or** `blendedDiscountPercent >= minBlendedDiscountPercent`, the highest `minRisk + minBlended` wins (then lowest priority). Seeded chains:

| Chain | Qualifies when | Steps |
| --- | --- | --- |
| Sales Manager | blended ≥ 5% or risk ≥ 0 | Manager |
| Sales Manager → Finance | blended ≥ 12% or risk ≥ 40 | Manager, Finance |
| Sales Manager → Finance → Final | blended ≥ 20% or risk ≥ 70 | Manager, Finance, Final |

Hardware-only 16% (Northwind) typically selects **Sales Manager → Finance** (blended 16 ≥ 12, risk below 70). The golden two-line quote (hardware + software at 16%) typically selects the **three-step** chain because two approval-required lines push risk ≥ 70.

**Approvals.** Staff has `dealflow.quotes.write` but not `dealflow.quotes.approve`. Each pending step also checks `dealflow.approvals.{manager|finance|final}`. Seeded **admin** receives every catalog permission after RBAC merge, and `canActOnRole` allows the admin role on any step.

**Material change.**

```text
Δ blendedDiscount ≥ 2 pp   OR   |Δ netTotal| / previousNetTotal ≥ 0.10
```

**Available stock.**

```text
available = max(0, quantityOnHand - reserved)
```

**Confirm.** Allocated (non-backorder) splits decrement both on-hand and reserved. Backorder rows are not consumed.

**Recommendations.** Catalog relations, not an LLM. Core Gateway suggests Edge Sensor Pack (cross-sell). Control Suite suggests Analytics Add-on (upsell).

---

## 🔐 Security & Access Control

| Control | Implementation |
| --- | --- |
| Authentication | Email/password; JWT access + refresh; httpOnly cookies when `AUTH_COOKIE_ENABLED=true` |
| Demo login | Seeded users, password `demo-password`; rate limits relaxed only in `DEMO_MODE` |
| Authorization | Permission keys on every mutating DealFlow route |
| Portal | Unguessable `portalToken`; public rate limit; stripped DTO |
| Secrets | No `VITE_` for JWT, Odoo, Gemini, SMTP, or cloud keys |
| Audit | Structured events; no passwords, OTPs, or tokens in logs |
| Production | Refuses to start without required secrets; `DEMO_MODE` must not behave as production |

Portal holders **cannot**: list staff quotes, call approve/fulfill/bill/confirm, or see risk reasons, approval actors, warehouse reservations, billing operations, or audit. They **can** see list / discount / net totals and blended discount %.

Do not describe this fork as “fully secure.” See [docs/security.md](docs/security.md).

```bash
npm run security:secrets
npm run security:audit
```

---

## 🔌 API Overview

Standard envelope: `{ success, data, meta }` or `{ success: false, error, requestId }`. Prefix: `/api/v1`.

Public probe: `GET /api/v1/problem` and `GET /api/v1/dealflow`.

| Area | Method | Path | Auth |
| --- | --- | --- | --- |
| Catalog | `GET` | `/api/v1/dealflow/catalog` | `dealflow.catalog.read` |
| Quotes | `GET` `POST` | `/api/v1/dealflow/quotes` | read / write |
| Quote | `GET` | `/api/v1/dealflow/quotes/:id` | read |
| Lines | `POST` `PATCH` `DELETE` | `/api/v1/dealflow/quotes/:id/lines…` | write |
| Assess | `POST` | `/api/v1/dealflow/quotes/:id/assess` | write |
| Submit | `POST` | `/api/v1/dealflow/quotes/:id/submit` | write |
| Decide | `POST` | `/api/v1/dealflow/quotes/:id/approvals/:approvalId/decide` | approve |
| Negotiate | `POST` | `/api/v1/dealflow/quotes/:id/negotiate` | write |
| Recommendations | `GET` `POST` | `/api/v1/dealflow/quotes/:id/recommendations` | read / write |
| Fulfillment | `POST` | `/api/v1/dealflow/quotes/:id/fulfillment/plan` | fulfillment.write |
| Billing | `POST` | `/api/v1/dealflow/quotes/:id/billing/generate` · `/billing/:scheduleId/cancel` | billing.write |
| Confirm / complete | `POST` | `/api/v1/dealflow/quotes/:id/confirm` · `/complete` | write |
| Portal | `GET` `PATCH` | `/api/v1/dealflow/portal/:token` | token, not staff JWT |

Operational: `GET /health`, `GET /ready`.

---

## Staff UI

| Route | Page |
| --- | --- |
| `/login` | Sales operations sign-in |
| `/dealflow` | Live dashboard (open value, approvals, risk) |
| `/dealflow/quotes` | Quotation list + workspace |
| `/dealflow/quotes/:quoteId` | Lines, risk, approvals, fulfillment, billing, activity |
| `/dealflow/approvals` | Approval queue + decision |
| `/dealflow/fulfillment` | Splits and backorders |
| `/dealflow/subscriptions` · `/invoices` | Recurring vs one-time schedules |
| `/dealflow/health` · `/reports` · `/catalog` | Exceptions, book metrics, read-only catalog |
| `/dealflow/assistant` | Contextual deal insights from assessment, stock, and catalog relations |
| `/dealflow/anomalies` | Live-quote exceptions with resolve / ignore in-session |
| `/dealflow/settings` | Seeded products, policies, chains, warehouses, billing rules, roles |
| `/account` | Customer-role landing (no staff workspace) |
| `/portal/:token` | Isolated customer quote |

Command palette: `Ctrl/Cmd+K` in the staff shell.

---

## 📁 Project Structure

```text
DealFlow360/
├── frontend/                 # React + Vite + Tailwind (port 5173)
├── backend/                  # Express API (port 5000)
├── workers/                  # Background worker (backend image)
├── packages/api-contract/    # Shared envelopes and feature names
├── database/prisma/          # Schema, migrations, seeds
├── modules/problem/          # DealFlow360 backend + frontend
├── infra/                    # Compose, nginx profile, smoke scripts
├── docs/                     # Operator and module documentation
├── .github/workflows/        # CI + optional CD
├── docker-compose.yml
├── HACKATHON_MODULES.md      # Flag selection for this demo
├── PROBLEM_STATEMENT.md
└── README.md
```

Generated output (`dist/`, `coverage/`, `node_modules/`, `docker-data/`) is not source.

### How to read the codebase

| If you want… | Start here |
| --- | --- |
| Discount, risk, material change | `modules/problem/src/dealflow/discount-engine.ts` |
| Approval steps and permissions | `modules/problem/src/dealflow/approval-engine.ts` |
| Orchestration (submit → confirm) | `modules/problem/src/dealflow/service.ts` |
| Stock split / backorder / consume | `modules/problem/src/dealflow/fulfillment-engine.ts` |
| One-time vs recurring schedules | `modules/problem/src/dealflow/billing-engine.ts` |
| HTTP surface | `modules/problem/src/dealflow/routes.ts` |
| Portal DTO | `modules/problem/src/dealflow/portal-view.ts` |
| Seeded catalog | `modules/problem/src/dealflow/defaults.ts` |
| Staff UI | `modules/problem/frontend/dealflow/` |
| Prisma models | `database/prisma/schema.prisma` (`df_*`) |
| Auth / RBAC / adapters | `backend/src/` |

---

## 🚀 Quick Start

Use **npm only** (`packageManager` `npm@11.6.2`; `.npmrc` has `engine-strict=true`). Do not use Yarn, pnpm, or Bun.

### Prerequisites

| Software | Version in this repo |
| --- | --- |
| Git | Current Git that can clone HTTPS/SSH |
| Node.js | `^24` (`.nvmrc` is `24`) |
| npm | `^11` |
| Docker Engine + Compose **v2.24+** | Required for the documented Postgres/Redis path |
| Browser | Any current desktop browser |

Compose provides PostgreSQL 16 and Redis 7. Do not install native Postgres/Redis unless you are leaving this path. Odoo is **not** required.

```bash
git --version
node -v
npm -v
docker version
docker compose version
```

### Install

```bash
git clone https://github.com/upadhyaydhruv202-hue/dealflow360-intelligent-sales-operations.git
cd dealflow360-intelligent-sales-operations
npm install
```

PowerShell env copy: `Copy-Item .env.example .env`

```bash
cp .env.example .env
```

Authoritative variable catalog: [docs/environment.md](docs/environment.md). Never commit `.env`. Never prefix server secrets with `VITE_`.

Host `DATABASE_URL` uses port **5433**: `postgresql://postgres:postgres@localhost:5433/hackathon`.

### Data stores, migrate, seed

```bash
npm run deps:up
npm run db:migrate
npm run db:seed
```

`npm install` already runs `prisma generate`.

### Run

**Recommended (hybrid):** Docker for Postgres/Redis, Node on the host.

```bash
npm run dev
```

- UI: http://localhost:5173/login  
- API: http://localhost:5000 · `/health` · `/ready`  
- Leave `VITE_API_URL` empty so Vite proxies `/api`

Do not run `docker compose up --build` and `npm run dev` on the same ports at once.

**Alternative — full Compose:**

```bash
docker compose up --build
```

Compose migrates on API start and seeds when `SEED_ON_START=true`.

Workers are optional for the golden path: `npm run dev:workers`.

| Service | Host |
| --- | --- |
| Frontend | http://localhost:5173 |
| API | http://localhost:5000 |
| Postgres | `127.0.0.1:5433` |
| Redis | `127.0.0.1:6379` |
| Optional nginx | http://localhost:8080 (`docker compose --profile nginx up --build`) |

---

## Implemented vs Intentionally Limited

| In this build | Intentionally not this build |
| --- | --- |
| Policy-based discounts, blended risk, approval chains | Live Odoo `sale.order` / invoice writes |
| Warehouse split + backorder | Payment collection or a payment provider |
| Hybrid billing schedules (one-time + recurring) | Portal comments or delivery-date APIs |
| Token portal + material-change reapproval | Machine-learning price models |
| Local confirm against PostgreSQL | Claiming Odoo is the system of record |
| Kit AI (mock without a Gemini key) | AI executing SQL, shell, or arbitrary Odoo methods |
| Redis + BullMQ + optional worker | A required worker for the golden path |
| Deal Health / Reports from live quotes | A stored deal-health snapshot or FEATURE_ANALYTICS KPIs |

Kit pages such as Copilot, intents, and project planning may appear when their flags are on. They are **not** the DealFlow360 golden path.

### Future direction

These are honest gaps, not shipped features: optional Odoo 19 confirmation through the existing allowlisted adapter, payment capture after billing schedules, and richer portal collaboration. Do not treat them as implemented.

---

## Demo Accounts

| Email | Role | Use for |
| --- | --- | --- |
| `demo.staff@example.com` | Staff | Create, submit, fulfill, bill, confirm |
| `demo.manager@example.com` | Manager | First approval step |
| `demo.admin@example.com` | Admin | Remaining approvals and catalog |
| `demo.user@example.com` | Customer | `/account` only — not `/dealflow` |

Portal token after seed: `df-demo-portal-token-northwind-0001`.

---

## Environment Notes

| Topic | Default demo truth |
| --- | --- |
| `DEMO_MODE` | `true` — seeded users; mock fallbacks |
| `FEATURE_ODOO` | `false` — do not install Odoo |
| `FEATURE_AI` | `true` — mock if `GEMINI_API_KEY` is empty |
| `FEATURE_SMS` / `EMAIL_ENABLED` | Off — no real messages |
| `STORAGE_PROVIDER` | `local` |
| JWT secrets | Placeholders in `.env.example`; generate your own beyond a laptop demo |

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

If you later enable Odoo 19: set `FEATURE_ODOO=true`, `ODOO_ENABLED=true`, origin (no `/json/2` suffix), database, and server-side API key. Probe: `GET /api/v1/odoo/health` with `odoo.read`. There is no “run any Odoo method” HTTP API.

---

## Verification Checklist

- [ ] Node 24 + npm 11
- [ ] `npm install` and `.env` from `.env.example`
- [ ] `npm run deps:up` · `db:migrate` · `db:seed`
- [ ] `GET /health` and `GET /ready` succeed
- [ ] Login as staff → `/dealflow` and quotations load
- [ ] Approval center opens
- [ ] Seeded portal token opens
- [ ] Odoo stays unavailable unless you configured a real server
- [ ] Optional: `npm run lint` · `npm run typecheck` · `npm test` · `npm run build`

---

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `npm install` refuses Node/npm | `.npmrc` `engine-strict=true`. Use Node 24 and npm 11 |
| Database connection failed | `npm run deps:up`; `DATABASE_URL` port **5433**; `hackathon-postgres` healthy |
| `/ready` 503 | `docker exec hackathon-redis redis-cli ping`; `REDIS_URL=redis://localhost:6379` |
| Prisma migrate failed | Postgres up first; `npm run db:migrate` (schema is `database/prisma`) |
| Port 5000 or 5173 in use | Stop the other `npm run dev` or Compose stack |
| Frontend cannot reach API | Keep `VITE_API_URL` empty; API on :5000 |
| Login “too many attempts” | Seeded demo email + `DEMO_MODE=true`, or wait 15 minutes |
| `demo.user` blocked from `/dealflow` | Expected |
| Empty warehouse split | Confirm consumed Core Gateway stock; `npm run db:seed` |
| Odoo health fails | Expected when `FEATURE_ODOO=false` |
| Gemini errors | Leave the key empty with `DEMO_MODE=true`, or `AI_PROVIDER=mock` |
| Tests need a database | `Copy-Item .env.test.example .env.test` then `npm run db:test:prepare` |

---

## Testing & Quality

From the repository root:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Unit and HTTP tests mock Odoo, AI, email, SMS, and storage. Postgres integration tests need `DATABASE_URL`. Redis/BullMQ tests need `REDIS_URL`. E2E: `npm run db:test:prepare` then `npm run test:e2e`.

CI (`.github/workflows/ci.yml`) runs lint, typecheck, unit (coverage), integration, e2e, secret scan, audit, builds, and Docker smoke on `ubuntu-24.04` with Postgres 16 and Redis 7 service containers. It does not call paid SaaS.

---

## Documentation Map

| Topic | File |
| --- | --- |
| Problem statement | [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md) |
| Enabled / disabled flags | [HACKATHON_MODULES.md](HACKATHON_MODULES.md) |
| A–Z kit manual | [docs/SETUP_MANUAL.md](docs/SETUP_MANUAL.md) |
| Environment catalog | [docs/environment.md](docs/environment.md) |
| Features | [docs/features.md](docs/features.md) |
| Architecture | [ARCHITECTURE.md](ARCHITECTURE.md) · [ARCHITECTURE_DECISION.md](ARCHITECTURE_DECISION.md) |
| Problem module boundary | [docs/problem-module.md](docs/problem-module.md) |
| Database / Redis / Docker | [docs/database.md](docs/database.md) · [docs/redis.md](docs/redis.md) · [docs/docker.md](docs/docker.md) |
| Security / testing / CI | [docs/security.md](docs/security.md) · [docs/testing.md](docs/testing.md) · [docs/ci-cd.md](docs/ci-cd.md) |
| Fresh machine | [docs/FRESH_SETUP_CHECKLIST.md](docs/FRESH_SETUP_CHECKLIST.md) · [docs/prerequisites.md](docs/prerequisites.md) |

---

## License

AGPL-3.0-or-later. See the repository license files. Third-party dependencies remain under their own licenses.
