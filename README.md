<p align="center">
  <img src="https://img.shields.io/badge/DealFlow360-Intelligent%20Sales%20Operations-0F172A?style=for-the-badge" alt="DealFlow360" />
</p>

<h1 align="center">DealFlow360</h1>

<p align="center">
  <strong>An intelligent, self-governing sales operations platform</strong>
</p>

<p align="center">
  Quotations as governed commercial decisions — not static PDFs.<br />
  Discount policy, blended risk, approval chains, warehouse feasibility, hybrid billing, and customer negotiation live in one backend-authoritative loop.
</p>

<p align="center">
  <a href="https://github.com/upadhyaydhruv202-hue/dealflow360-intelligent-sales-operations/actions/workflows/ci.yml"><img src="https://github.com/upadhyaydhruv202-hue/dealflow360-intelligent-sales-operations/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="#-technology-stack"><img src="https://img.shields.io/badge/version-0.1.0-3178C6" alt="Version 0.1.0" /></a>
  <a href="#-license"><img src="https://img.shields.io/badge/license-AGPL--3.0--or--later-blue.svg" alt="License AGPL-3.0-or-later" /></a>
  <a href="#-technology-stack"><img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white" alt="React 18" /></a>
  <a href="#-technology-stack"><img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript 5" /></a>
  <a href="#-technology-stack"><img src="https://img.shields.io/badge/Node.js-24-339933?logo=nodedotjs&logoColor=white" alt="Node.js 24" /></a>
  <a href="#-technology-stack"><img src="https://img.shields.io/badge/Express-%2Fapi%2Fv1-000000?logo=express&logoColor=white" alt="Express REST" /></a>
  <a href="#-technology-stack"><img src="https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL 16" /></a>
  <a href="#-technology-stack"><img src="https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white" alt="Prisma 6" /></a>
  <a href="#-technology-stack"><img src="https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white" alt="Redis 7" /></a>
  <a href="https://github.com/upadhyaydhruv202-hue/dealflow360-intelligent-sales-operations/issues"><img src="https://img.shields.io/github/issues/upadhyaydhruv202-hue/dealflow360-intelligent-sales-operations" alt="Issues" /></a>
</p>

<p align="center">
  <a href="#-quick-start"><strong>Quick Start</strong></a> ·
  <a href="#-golden-demo"><strong>Golden Demo</strong></a> ·
  <a href="#-features"><strong>Features</strong></a> ·
  <a href="#-system-architecture"><strong>Architecture</strong></a> ·
  <a href="#-api-reference"><strong>API</strong></a> ·
  <a href="#-installation-guide"><strong>Install</strong></a> ·
  <a href="#-documentation"><strong>Docs</strong></a>
</p>

---

**DealFlow360** is a full-stack sales operations product built on a reusable hackathon platform. It treats a mixed hardware-and-subscription quotation as a living commercial object: policy-checked discounts, explainable risk, ordered approvals, multi-warehouse fulfillment, hybrid billing, and a customer portal that never sees internal controls.

| Surface | Where |
| --- | --- |
| Staff workspace | http://localhost:5173/dealflow |
| Customer account | `/account` |
| Customer portal | `/portal/:token` |
| REST API | `/api/v1/dealflow` |
| Product code | `modules/problem/` |
| Platform (auth, RBAC, Prisma, queues, adapters) | `backend/`, `frontend/`, `database/`, `workers/` |

PostgreSQL is the system of record. Confirmation in the default demo is local. Odoo is an optional adapter and is **off** in `.env.example`. AI is available as a kit toolkit and is **not** used for pricing.

---

## ⚡ Quick Start

A developer who already has Git, Node.js 24, npm 11, and Docker Compose v2.24+ can reach a working demo with:

```text
Clone → npm install → copy .env.example → deps:up → migrate → seed → npm run dev
```

```bash
git clone https://github.com/upadhyaydhruv202-hue/dealflow360-intelligent-sales-operations.git
cd dealflow360-intelligent-sales-operations
npm install
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
npm run deps:up
npm run db:migrate
npm run db:seed
npm run dev
```

Then open http://localhost:5173/login and sign in as `demo.staff@example.com` with password `demo-password`.

| Service | URL |
| --- | --- |
| Frontend (Vite) | http://localhost:5173 |
| API | http://localhost:5000 |
| Liveness | `GET /health` |
| Readiness | `GET /ready` |
| Postgres (host) | `127.0.0.1:5433` |
| Redis (host) | `127.0.0.1:6379` |

Use **npm only**. `.npmrc` sets `engine-strict=true`. Do not use Yarn, pnpm, or Bun. Full install notes: [Installation Guide](#-installation-guide).

---

## 📚 Table of Contents

**Product**

- [Overview](#-overview)
- [Visual Showcase](#-visual-showcase)
- [Demo](#-demo)
- [Problem Statement](#-problem-statement)
- [Our Solution](#-our-solution)
- [Objectives](#-objectives)
- [Target Users](#-target-users)
- [Features](#-features)
- [Feature Matrix](#-feature-matrix)
- [Golden Demo](#-golden-demo)

**Engineering**

- [System Architecture](#-system-architecture)
- [Data Flow](#-data-flow)
- [Application Workflows](#-application-workflows)
- [Authentication & Authorization](#-authentication--authorization)
- [Security](#-security)
- [Database Architecture](#-database-architecture)
- [Project Structure](#-project-structure)
- [Frontend Architecture](#-frontend-architecture)
- [Backend Architecture](#-backend-architecture)
- [API Reference](#-api-reference)

**Operations**

- [Testing](#-testing)
- [Requirements](#-requirements)
- [Installation Guide](#-installation-guide)
- [Environment Configuration](#-environment-configuration)
- [Development Commands](#-development-commands)
- [Docker](#-docker)
- [Deployment](#-deployment)
- [CI/CD](#-cicd)

**Product quality**

- [UI/UX Philosophy](#-uiux-philosophy)
- [Accessibility](#-accessibility)
- [Responsive Design](#-responsive-design)
- [Performance](#-performance)
- [Scalability](#-scalability)
- [Notifications](#-notifications)
- [Real-Time Features](#-real-time-features)
- [AI / ML](#-ai--ml)
- [Integrations](#-integrations)

**Handbook**

- [Technical Decisions](#-technical-decisions)
- [Design Patterns](#-design-patterns)
- [Error Handling](#-error-handling)
- [Logging & Monitoring](#-logging--monitoring)
- [Health Checks](#-health-checks)
- [Developer Workflow](#-developer-workflow)
- [Git Workflow](#-git-workflow)
- [Contributing](#-contributing)
- [Roadmap](#-roadmap)
- [Project Status](#-project-status)
- [Documentation](#-documentation)
- [User Guide](#-user-guide)
- [Admin Guide](#-admin-guide)
- [Role & Permission Matrix](#-role--permission-matrix)
- [Troubleshooting](#-troubleshooting)
- [FAQ](#-frequently-asked-questions)
- [Glossary](#-glossary)
- [Example Scenarios](#-example-scenarios)
- [Technical Deep Dive](#-technical-deep-dive)
- [Limitations](#-limitations)
- [Why This Project Matters](#-why-this-project-matters)
- [License](#-license)
- [Extended Technical Handbook](#-extended-technical-handbook)

---

## 🌍 Overview

DealFlow360 is a sales operations workspace for organizations that sell mixed catalogs: one-time hardware plus recurring software or services. The product exists because traditional quotation tools stop at a price sheet. The hard work — “is this discount allowed?”, “who must approve?”, “can the warehouse actually ship this?”, “what is one-time versus monthly?”, “how do we let the customer push back without leaking internals?” — usually happens in spreadsheets, chat, and ERP screens that do not share a single truth.

This repository solves that loop **in software**, with PostgreSQL as the system of record:

1. A sales representative builds a quote against a live catalog.
2. The customer submits a persisted negotiation request through an isolated portal.
3. Role ceilings block silent over-discounting.
4. A manager revises, finalizes, and the existing approval engine still runs.
5. Finance locks the commercial deal.
6. Staff then plan multi-warehouse fulfillment and generate hybrid billing.

The same repository is also a **reusable full-stack starter kit**. Authentication, RBAC, Prisma, Redis, BullMQ, email/SMS/storage adapters, optional Odoo and AI, CI, and Docker stay in platform folders. Hackathon-specific DealFlow rules live only under `modules/problem/`. That split is intentional: the product is specific, the platform is generic.

**Who it is for.** Sales representatives, managers, finance managers, administrators, and customers (account + token portal).

**Who it is not for (this build).** Teams that need live payment capture, a live Odoo `sale.order` as the source of truth, or machine-learning price models. Those are documented as gaps, not shipped features.

**What makes it different.** Governance survives negotiation. A material commercial change invalidates outstanding approvals on the server. The portal DTO omits risk, reasons, approvals, fulfillment internals, billing operations, revisions, and staff identifiers. Discount writes are hard-capped by role. Available stock is on-hand minus reserved.

---

## 📸 Visual Showcase

The repository does not currently contain PNG, JPG, GIF, SVG, or MP4 demo assets in source control. Do not treat marketing mockups elsewhere as part of this tree.

Until screenshots are committed, the canonical visual tour is the **golden demo** on a local stack:

| Screen | Route | What you should see |
| --- | --- | --- |
| Sign-in | `/login` | Sales operations login; demo account chips when `DEMO_MODE=true` |
| Staff dashboard | `/dealflow` | Live open value, approvals, and risk derived from quotes |
| Quotation workspace | `/dealflow/quotes/:quoteId` | Lines, assessment, negotiations, approvals, fulfillment, billing |
| Negotiations | `/dealflow/negotiations` | Customer requests waiting on staff or manager |
| Approvals | `/dealflow/approvals/:quoteId` | Chain, decide, reasons |
| Fulfillment | `/dealflow/fulfillment/:quoteId` | West DC / East DC split and backorder |
| Portal | `/portal/:token` | Commercial totals only |
| Customer account | `/account` | Buyer’s own quotations (`demo.user@example.com`) |

When adding screenshots later, place them under a dedicated `docs/assets/` (or similar) path and reference those files here. Do not invent image URLs.

---

## 🎥 Demo

<a id="demo"></a>

There is no recorded video or GIF in this repository. The judged walkthrough is interactive:

1. Start the hybrid stack ([Quick Start](#-quick-start)).
2. Follow [Golden Demo](#-golden-demo).
3. Use seeded password `demo-password` for every demo account.

Optional future placement for a walkthrough recording:

```text
docs/assets/demo.mp4
docs/assets/portal.png
docs/assets/workspace.png
```

Those files are **not** present today.

---

## 🚨 Problem Statement

Traditional sales tools treat quotations as documents: a price, a PDF, maybe an email. The operational loop happens outside the system.

### Current Challenges

| Challenge | Existing situation | Impact |
| --- | --- | --- |
| Discount leakage | A line discount is typed without a visible ceiling, variance, or reason | Margin disappears before anyone notices |
| Inconsistent approval | Nobody can say who must approve, or why this quote versus another | Deals stall or get rubber-stamped |
| Isolated line math | Each SKU is judged alone | Blended, revenue-weighted risk is invisible |
| Fake feasibility | “Sold” against a single imaginary warehouse | Operations discover the split after the handshake |
| Mixed commercial models | Hardware is one-time; software is recurring | One blended invoice misstates what is due today |
| Unsafe negotiation | The customer sees internal risk, audit, or approval controls | Governance leaks; trust drops |
| Stale governance | A material portal change keeps an old “approved” stamp | Policy is theater |
| Role confusion | Staff, manager, and finance share the same buttons | Unauthorized lock, approve, or 40% write |

The problem this product actually implements against is narrower than “CRM”:

> **One quotation lifecycle that stays governed after the customer pushes back.**

Official statement: [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md). Module flags for this demo: [HACKATHON_MODULES.md](HACKATHON_MODULES.md).

### Pain points the code addresses

- **Operational.** Split warehouses, reserved stock, backorder remainder, hybrid schedules.
- **User.** Sales reps need a ceiling they cannot bypass; customers need a portal that is not the staff app.
- **Technical.** Backend-authoritative assessment; frontend permission checks are UX only.
- **Reliability.** Optimistic concurrency (`expectedVersion`) on mutating quote operations.
- **Security.** Portal tokens are unguessable; unknown tokens 404; customer JWT cannot open `/dealflow`.

---

## 💡 Our Solution

Six engines share one `Quote` aggregate in PostgreSQL.

| Problem | Our approach | Result |
| --- | --- | --- |
| Discount leakage | Role ceilings + policy match + persist-or-403 | An 8% write from a 5% Sales Rep never lands |
| Unclear approval | Risk score + blended discount select a chain | Ordered steps with `dealflow.approvals.*` keys |
| Isolated line math | `blendedDiscountPercent = discountTotal / listTotal` | Quote-level decision, not only line-level |
| Fake stock | `available = max(0, onHand − reserved)` | Split + backorder from live `df_stock_levels` |
| Mixed billing | Product `billingType` one-time vs recurring | Separate schedules; no payment capture |
| Unsafe portal | `toPortalView()` strips internals | Customer sees totals, not risk reasons |
| Stale approval | Material-change rule on the server | Prior steps invalidated; new chain opens |
| Email theater | Manager approve → provisional; Finance lock → final bill | Recorded in `df_quote_email_deliveries`; mock is never `sent` |

```mermaid
flowchart TB
  subgraph quote [Quote aggregate]
    L[Lines]
    A[Assessment fields]
    C[Approval steps]
    F[Fulfillment splits + backorders]
    B[Billing schedules]
    R[Revisions]
    N[Negotiation requests]
  end
  P[Discount policies] --> A
  H[Approval chains] --> C
  S[Stock on-hand minus reserved] --> F
  K[Product relations] --> U[Recommendations]
  U --> L
  Portal[Token portal] -->|stripped view| L
  Portal -->|material change| C
```

Odoo is **not** the system of record. `.env.example` sets `FEATURE_ODOO=false` / `ODOO_ENABLED=false`. Confirmations do not invent remote sale-order IDs.

---

## 🎯 Objectives

| Kind | Objective |
| --- | --- |
| Primary | One governed quotation from draft through finance lock, fulfillment, and hybrid billing |
| Secondary | Isolated customer negotiation that cannot inspect staff internals |
| Technical | Backend-authoritative policy, risk, RBAC, and optimistic concurrency |
| User | Role-correct workspaces: staff `/dealflow`, customer `/account` + `/portal/:token` |
| Business | Stop discount leakage and approval theater without requiring live ERP or payments |
| Reliability | Seeded golden path a judge can complete without paid APIs |
| Security | Secrets stay on the server; demo mode must not behave as production |
| Scalability | Modular monolith + optional Redis/BullMQ workers; not microservices |

---

## 👥 Target Users

| User | Who they are | What they need | What they can do | What they cannot do |
| --- | --- | --- | --- | --- |
| Sales Representative | Field / inside sales | Fast quote + honest ceiling | Create quotes and products, send to manager, fulfill after lock (5%) | Approve a chain step, lock a deal, or write above role ceiling (API 403) |
| Manager | Sales manager | Revise without breaking governance | Review, replace line discounts (10%), finalize, first approval step | Act as Finance or Final unless they also hold those keys |
| Finance Manager | Commercial control | Lock only after a valid chain | Finance approval and commercial lock (15%) | Admin settings or catalog governance write |
| Admin | Platform + catalog owner | Configure policy without impersonating a 40% ceiling | Finance + Final after RBAC merge; catalog write; may act on any approval step | A silent 40% discount write — writes use the highest staff/manager/finance authority held |
| Customer | Buyer | See commercials, push back, confirm a revision | `/account` + portal links for their quotes; `/register` creates `user` + `DfCustomer` | Open `/dealflow` or staff APIs |
| Portal holder | Anyone with the unguessable token | Review this quote only | See commercial totals; submit negotiation; confirm/agree | See risk score, reasons, approvals, fulfillment, billing ops, revisions, or staff IDs |

Seeded demo accounts (only when `DEMO_MODE=true`):

| Email | Role |
| --- | --- |
| `demo.staff@example.com` | Sales Representative (`staff`) |
| `demo.manager@example.com` | Manager |
| `demo.finance@example.com` | Finance Manager (`finance`) |
| `demo.admin@example.com` | Admin |
| `demo.user@example.com` | Customer (`user`) |

Password for every seeded demo user: `demo-password`.

An `operations` role exists in RBAC merge (`dealflow.catalog.read`, quotes read, fulfillment write). There is **no** Operations demo account. Seed deletes `demo.operations@example.com` if it was left from an older run.

---

## ✨ Features

Each subsection below is implemented in `modules/problem` unless noted as a platform capability.

### Discount governance

**Purpose.** Stop unauthorized discounts before they persist.

**How it works.** Every assessed line records requested discount → matched policy → warning / approval / reject ceiling → variance → reason string. Policies match by customer tier and/or product category; more specific policies win, then lower `priority`. Role authorities cap writes: staff 5%, manager 10%, finance 15%. Over-cap writes return **403** and are not stored.

**User benefit.** “Why” and “who” come from the backend assessment, not a frontend guess.

**Technical implementation.** `discount-engine.ts` + `loyalty.ts` + `df_discount_policies` + `df_role_authorities`.

**Security.** Frontend buttons are UX. `requirePermission` and service-level ceiling checks are authoritative.

**Example.** A Sales Rep tries 8% on Core Gateway. API 403. A Manager replaces the line at 10%. The stored value is 10%, not 5% + 10%.

### Revenue-weighted blended risk

**Purpose.** Judge the quote as a commercial whole.

**How it works.** Blended discount is `discountTotal / listTotal` (equivalently `(listTotal − netTotal) / listTotal × 100`). Risk score combines blended discount, average margin erosion, and counts of warning / approval-required / rejected lines. Two or more warning-level lines force `approval_required` (`cumulativeWarningLimit = 2`).

**User benefit.** Multiple “small” warnings still escalate.

**Technical implementation.** Quote assessment fields on `df_quotes`; no separate snapshot table.

### Approval automation

**Purpose.** Route the right people in order.

**How it works.** Among active chains where `riskScore >= minRiskScore` **or** `blendedDiscountPercent >= minBlendedDiscountPercent`, the highest `minRisk + minBlended` wins (then lowest priority). Each pending step also checks `dealflow.approvals.{manager|finance|final}`. Staff has `dealflow.quotes.write` but **not** `dealflow.quotes.approve`.

**Seeded chains.**

| Chain | Qualifies when | Steps |
| --- | --- | --- |
| Sales Manager | blended ≥ 5% or risk ≥ 0 | Manager |
| Sales Manager → Finance | blended ≥ 12% or risk ≥ 40 | Manager, Finance |
| Sales Manager → Finance → Final | blended ≥ 20% or risk ≥ 70 | Manager, Finance, Final |

**Example.** A manager-revised 10% hardware line typically selects **Sales Manager → Finance** (blended 10 is below 12, but risk and line decisions still escalate).

### Customer negotiation

**Purpose.** Let the buyer push back without becoming a staff user.

**How it works.** Portal `POST .../negotiations` stores quantity, line comments, and counter-discount **as a request**. Requested discount is not silently applied. Status becomes `customer_negotiation`. Staff reviews on **Customer negotiations**, may respond, and can **Send to Manager**. Confirmation is blocked while a request is open, in review, or with the manager. Confirmation does not skip approval.

**Technical implementation.** `df_negotiation_requests`, `service.createPortalNegotiation`, `NegotiationsPage.tsx`.

**Security.** Public token routes use `publicRateLimit`. Payload is `toPortalView()`.

### Manager finalize and submit

**Purpose.** Freeze commercials before the approval engine.

**How it works.** Manager **Finalize** stamps freeze. Staff **Submit** is allowed only from `finalized`. The existing approval engine then runs.

**Technical implementation.** `lifecycle.ts` transitions; `finalizeQuotation` / `submit`.

### Material-change reapproval

**Purpose.** Governance that survives negotiation.

**How it works.** A material change is a blended-discount increase of **2 percentage points** or a **10%** move in net total (`materialDiscountDeltaPp`, `materialTotalDeltaRatio`). The server invalidates outstanding approvals and opens a new chain.

**Security.** The customer portal never decides that policy.

### Fulfillment planning

**Purpose.** Sell against real warehouses.

**How it works.** Planning reads live stock. Available units are **on-hand minus reserved**. The seeded Core Gateway book is West DC 4 + East DC 3. A qty-8 hardware line produces a split plus backorder 1. Overrides must still respect available stock (conflict otherwise).

**Technical implementation.** `fulfillment-engine.ts`, `df_quote_fulfillment_splits`, `df_quote_backorders`.

### Hybrid billing

**Purpose.** Do not mash one-time and recurring into one fake invoice.

**How it works.** `generateBilling` writes one-time schedules for hardware and recurring schedules for software/services (`monthly` / `quarterly` / `yearly`). The API does **not** collect or record payments. Schedules can be cancelled with `billing.write`.

**Technical implementation.** `billing-engine.ts`, `df_quote_billing_schedules`.

### Catalog recommendations

**Purpose.** Suggest attach products without an LLM.

**How it works.** Catalog relations, not a model. Core Gateway → Edge Sensor Pack (cross-sell). Control Suite → Analytics Add-on (upsell). Apply after finance lock as part of the golden path.

**Technical implementation.** `recommendation-engine.ts`, `df_product_relations`.

### Quantity breaks

**Purpose.** Reprice by volume.

**How it works.** Seeded volume prices (for example Core Gateway 1–9 list / 10–49 volume / 50+ contract) reprice the line when quantity changes. The golden path uses ×8, so HW-CORE-1 stays at list $4,000.

**Technical implementation.** `pricing-engine.ts`, `df_quantity_breaks`. Admin can replace breaks via catalog write.

### Loyalty stacking

**Purpose.** Reward repeat buyers without bypassing the commercial cap.

**How it works.** Won purchase count maps to loyalty `new` / gold / platinum (+0 / +5 / +10). Northwind starts as loyalty `new` (persisted `standard`). Bonus may stack onto the role cap when `allowLoyaltyStacking` is true, then `maxCommercialDiscountPercent` (default 25) still applies. High-value quotes (net ≥ $25,000) also require the selected chain.

**Technical implementation.** `loyalty.ts`, customer `tier` on `df_customers`.

### Tax

**Purpose.** Optional quote-level tax on taxable lines.

**How it works.** `computeTaxTotal` applies `governance.taxRatePercent` to taxable line nets. Default governance tax rate is **0**. Product `taxable` can exclude a SKU.

**Technical implementation.** `tax-engine.ts`. Portal shows `taxTotal` and `grandTotal`.

### Customer emails and PDF

**Purpose.** Tell the buyer what happened, without leaking staff internals.

**How it works.** Manager approval of the negotiated quotation emails a **provisional invoice** (awaiting Finance lock). Finance lock emails the **final bill**. Both use the live PostgreSQL quotation, attach a customer-safe PDF (`pdf-lib`), and write `df_quote_email_deliveries` plus `notification_deliveries`. If no real email provider is configured, the event stays pending / `not_configured` — it is never marked `sent`.

**Technical implementation.** `customer-email.ts`, `quote-pdf.ts`, templates `quote-prelim-invoice` and `quote-final-invoice`. Idempotency key: `dealflow:quote:{id}:{event}:{stamp}`.

**Staff PDF.** `GET /api/v1/dealflow/quotes/:id/pdf` (read). **Portal PDF.** `GET /api/v1/dealflow/portal/:token/pdf`.

### Finance lock

**Purpose.** Commercial close that staff cannot perform.

**How it works.** `dealflow.quotes.lock` (Finance Manager) moves an **approved** quote to `confirmed` and stamps `financeLockedAt`. Staff cannot confirm. After lock, commercial edits conflict (409) until a new revision reopens approval. Allocated (non-backorder) splits decrement both on-hand and reserved. Backorder rows are not consumed.

### Customer portal isolation

**Purpose.** Share commercials, not the control plane.

**How it works.** `GET/PATCH /api/v1/dealflow/portal/:token` returns commercial totals, blended discount %, customer name, and lines. It **omits** risk score, policy reasons, approvals, fulfillment, billing operations, revisions, and staff identifiers. Unknown tokens 404. `GET /api/v1/dealflow/me/quotes` lists that buyer’s quotations as the same portal DTO plus the portal token. Public `/register` creates a `user` + `DfCustomer` (never an internal role). The portal token is not the customer JWT.

### Deal Health and Reports

**Purpose.** Operational insight without a second warehouse.

**How it works.** Deal Health and Reports **compute from the live quote list**. There is no stored deal-health snapshot table. Factors include rejection, approval delay, customer decline, backorder, staleness.

**Technical implementation.** `health-engine.ts`, `InsightsPages.tsx`. Kit `FEATURE_ANALYTICS` is **false** in `.env.example` and is not this page.

### DealFlow anomalies

**Purpose.** Surface exceptions on live quotes.

**How it works.** Detectors for unusual blended discount, large deals, price overrides, repeated approval cycles, stale quotes. Staff can resolve or ignore. This is **not** the kit `FEATURE_ANOMALY_DETECTION` engine (that flag is false in the default demo).

**Technical implementation.** `anomaly-engine.ts`, `df_anomalies`, `/dealflow/anomalies`.

### Catalog and governance editors

**Purpose.** Operate the book without a SQL console.

**How it works.** Admin (catalog write) can edit policies, chains, quantity breaks, role authorities, warehouses, relations, and governance. Sales Representative plus Admin can write products and stock (`dealflow.catalog.products.write`). Staff can upsert customers on write permission.

### Optimistic concurrency

**Purpose.** Two staff members should not silently overwrite a quote.

**How it works.** Mutating quote routes accept `expectedVersion`. Stale versions conflict. Quote `version` increments on commercial change.

### Platform authentication and RBAC

**Purpose.** Identity and authorization for every staff route.

**How it works.** Email/password, JWT access + refresh, httpOnly cookies when `AUTH_COOKIE_ENABLED=true`. Permissions reload from PostgreSQL on each request. See [Authentication](#-authentication--authorization).

### Real-time staff refresh

**Purpose.** Quotes, approvals, billing, and anomalies update without a full reload.

**How it works.** When `FEATURE_REALTIME=true`, DealFlow publishes sanitized events on the dashboard SSE channel (`kind: dealflow`). Redis fan-out is used when `REDIS_URL` is set so the worker can reach API connections.

### Kit surfaces (not the golden path)

When their flags are on, the SPA also exposes Copilot, intents, problem intelligence, capability recommendations, project planning, project generator, notifications inbox, UI kit, and a platform dashboard. They are **not** required to complete DealFlow360. RAG, search, kit analytics, kit anomaly detection, SMS, and S3 are **off** in `.env.example`.

---

## 📊 Feature Matrix

| Feature | Status | User | Frontend | Backend | Database |
| --- | --- | --- | --- | --- | --- |
| Discount governance | ✅ Implemented | Staff / Manager / Finance | Quote workspace | `discount-engine.ts` | `df_discount_policies` |
| Role discount ceilings | ✅ Implemented | Staff 5 / Mgr 10 / Fin 15 | UX only | `loyalty.ts` | `df_role_authorities` |
| Blended risk assessment | ✅ Implemented | Staff | Workspace / approvals | `discount-engine.ts` | `df_quotes` fields |
| Approval chains | ✅ Implemented | Manager / Finance / Admin | Approvals pages | `approval-engine.ts` | `df_approval_chains` |
| Staff submit (no approve) | ✅ Implemented | Staff | Workspace | 403 without approve | RBAC |
| Customer negotiation | ✅ Implemented | Customer + Staff | Portal / Negotiations | `service.ts` | `df_negotiation_requests` |
| Manager finalize | ✅ Implemented | Manager | Workspace | `finalizeQuotation` | freeze stamps |
| Material-change reapproval | ✅ Implemented | All | Status / chain | server rule | `df_quote_revisions` |
| Recommendations | ✅ Implemented | Staff | Workspace | catalog relations | `df_product_relations` |
| Fulfillment split | ✅ Implemented | Staff | Fulfillment pages | `fulfillment-engine.ts` | splits + stock |
| Backorders | ✅ Implemented | Staff | Fulfillment | remainder after available | `df_quote_backorders` |
| Hybrid billing | ✅ Implemented | Staff | Subscriptions / Invoices | `billing-engine.ts` | schedules |
| Finance lock | ✅ Implemented | Finance | Workspace | `lockDeal` | `financeLockedAt` |
| Customer emails | ✅ Implemented | Customer | Inbox if configured | `customer-email.ts` | `df_quote_email_deliveries` |
| Customer PDF | ✅ Implemented | Staff + portal | Download | `quote-pdf.ts` | generated |
| Portal isolation | ✅ Implemented | Portal holder | `/portal/:token` | `portal-view.ts` | `portalToken` |
| Customer signup | ✅ Implemented | Public | `/register` | auth + `provisionCustomer` | `users` + `df_customers` |
| Deal Health / Reports | ✅ Implemented | Staff | `/dealflow/health` `/reports` | `health-engine.ts` | live quotes only |
| DealFlow anomalies | ✅ Implemented | Staff | Anomaly center | `anomaly-engine.ts` | `df_anomalies` |
| Quantity breaks | ✅ Implemented | Admin write | Settings / product | `pricing-engine.ts` | `df_quantity_breaks` |
| Loyalty stacking | ✅ Implemented | System | Portal loyalty DTO | `loyalty.ts` | customer tier |
| Tax engine | ✅ Implemented | Config | Totals | `tax-engine.ts` | governance + line nets |
| Auth + JWT + RBAC | ✅ Implemented | All signed-in | Login / cookies | `backend/src/auth` | `users`, roles |
| Audit trail | ✅ Implemented | Managers/admins | Kit audit API | kit `AuditEvent` | `audit_events` |
| SSE realtime | ✅ Implemented (flag on) | Staff | Workspace refresh | `host.realtime.publish` | Redis optional |
| Background jobs | 🟡 Partial | Operators | — | Queue always; worker optional | Redis / file / memory |
| PDF kit | 🟡 Kit on | — | — | `FEATURE_PDF` default on | files |
| AI toolkit | 🟡 Kit on, mock without key | Optional pages | Copilot etc. | `AIService` | not pricing |
| Odoo adapter | 🟡 Code present, **off** | — | — | allowlisted JSON-2 | `odoo_*` nullable IDs |
| Payment collection | 🔴 Planned | — | — | — | — |
| Live Odoo sale.order writes | 🔴 Planned | — | — | adapter exists, flags off | — |
| Kit RAG / search / analytics | ⚪ Off in demo | — | Feature-gated | flags false | unused by golden path |
| SMS / S3 | ⚪ Off in demo | — | — | flags false | local storage |

Legend: ✅ implemented for the product path · 🟡 present but optional / not golden path · 🔴 documented future · ⚪ disabled on purpose.

---

## 🏗️ System Architecture

DealFlow360 is a **modular monolith**, not a set of microservices.

```text
React (Vite :5173)
    → REST /api/v1
        → Controller (HTTP + Zod)
            → Service (policy, risk, approvals, fulfillment, billing)
                → Repository / Prisma store
                    → PostgreSQL (df_* + kit tables)

Slow kit work (optional for the golden path):
API / service → queue (memory | file | BullMQ) → worker → service → event / notification
```

```mermaid
flowchart TB
  UI[React + Vite :5173]
  API[Express /api/v1 :5000]
  PG[(PostgreSQL :5433 host / :5432 in Compose)]
  RD[(Redis :6379)]
  WK[Worker process]
  UI -->|proxy /api /health /ready /realtime| API
  API --> PG
  API -.->|when REDIS_URL set| RD
  WK -.-> RD
  WK --> PG
  API -.->|FEATURE_ODOO=false by default| OD[Odoo 19 JSON-2 adapter]
  API -.->|mock if no Gemini key| AI[AIService]
```

| Concern | Who owns it |
| --- | --- |
| Quotes, stock, approvals, billing, revisions, negotiations, emails | PostgreSQL via Prisma (`df_*`) |
| Users, roles, permissions, audit, notifications, refresh tokens | PostgreSQL kit models |
| Session | HttpOnly `hsk_access` / `hsk_refresh` cookies plus in-memory Bearer token |
| Problem module load | Runtime `register(host)` from `@hackathon/problem` — API does not statically import DealFlow TypeScript |
| Odoo | Adapter only; off unless flags and credentials are set |
| AI | Untrusted; schema-validated; not on the pricing path |
| Realtime | SSE hub; optional Redis pub/sub `hackathon:realtime` |

```mermaid
flowchart LR
  subgraph client [Browser]
    SPA[Staff SPA]
    Portal[Portal SPA]
  end
  subgraph platform [Express app]
    MW[Helmet CORS CSRF rate-limit authenticate RBAC]
    Ctrl[Controllers]
    Svc[Services]
    Prob[DealflowService]
  end
  SPA --> MW
  Portal --> MW
  MW --> Ctrl
  Ctrl --> Svc
  Ctrl --> Prob
  Prob --> Prisma[(Prisma)]
```

Compose services (root `docker-compose.yml` includes `infra/docker-compose.yml`):

| Service | Image / build | Host port | Role |
| --- | --- | --- | --- |
| `postgres` | `postgres:16-alpine` | `127.0.0.1:5433` | System of record |
| `redis` | `redis:7-alpine` | `127.0.0.1:6379` | Rate limits, OTP, idempotency, BullMQ, SSE fan-out |
| `backend` | `backend/Dockerfile` | `5000` | API (`JOBS_PROCESS=false`) |
| `worker` | same image, `CMD worker` | — | Job consumer |
| `frontend` | `frontend/Dockerfile` production | `5173→8080` | Static SPA |
| `nginx` | unprivileged 1.27, **profile `nginx`** | `8080` | Optional unified proxy |

---

## 🔄 Data Flow

Staff quote create (simplified):

```text
User (staff JWT / cookie)
  ↓
React page → createApiClient (VITE_API_URL empty → same-origin proxy)
  ↓
POST /api/v1/dealflow/quotes
  ↓
Helmet / CORS / CSRF (cookie mutations) / rate limit
  ↓
authenticate() → load user + roles + permissions from PostgreSQL
  ↓
requirePermission('dealflow.quotes.write')
  ↓
Zod createQuoteBodySchema
  ↓
DealflowService.createQuote
  ↓
Prisma store → df_quotes + portalToken
  ↓
events.emit + realtime.publish (dashboard / dealflow)
  ↓
Standard envelope { success, data, meta }
  ↓
Workspace renders lines, assessment, portal link
```

Customer portal negotiation:

```text
Portal holder (token in URL, not staff JWT)
  ↓
POST /api/v1/dealflow/portal/:token/negotiations
  ↓
publicRateLimit (no authenticate)
  ↓
Zod portalNegotiationBodySchema
  ↓
createPortalNegotiation → persist DfNegotiationRequest
  ↓
toPortalView(quote) — internals stripped
  ↓
Staff Negotiations page (authenticated read)
```

Finance lock:

```text
Finance Manager
  ↓
POST /api/v1/dealflow/quotes/:id/lock  { expectedVersion }
  ↓
dealflow.quotes.lock
  ↓
lockDeal → confirmed + financeLockedAt + consume allocated stock
  ↓
customer email final_invoice (mock stays not_configured)
  ↓
SSE dashboard.updated { kind: dealflow }
```

---

## 🧠 Application Workflows

### Registration

Public `POST /api/v1/auth/register` creates a kit `user` with `AUTH_DEFAULT_ROLE` (default `user`). DealFlow listens for `user.created` and `provisionCustomer` so a `DfCustomer` row exists. Register never assigns admin/staff/manager/finance.

### Login

`POST /api/v1/auth/login` verifies bcrypt hash, issues access + refresh JWTs, sets httpOnly cookies when enabled. SPA stores the access token in memory (not `localStorage`). Login landing: staff-like roles → `/dealflow`; customer → `/account` (`homePathForUser`).

### Password reset

When `FEATURE_OTP=true`: request OTP by email (same response if unknown), confirm with code + new password, revoke token families.

### Golden commercial path

See [Golden Demo](#-golden-demo). Status machine (`lifecycle.ts`):

```text
draft
  → customer_negotiation → manager_review → finalized
  → approval_required → approved → confirmed
  → fulfillment → billing → completed
  or rejected (can return to draft)
```

Delete allowed from `draft` / `rejected`. Void allowed from negotiation, manager review, approval, approved, finalized.

### Catalog write

Admin replaces quantity breaks, role authorities, governance; upserts policies, chains, warehouses, relations. Product/stock writers include Sales Representative.

### Search / filter / sort

Staff lists (quotations, catalog) use client tables (`DataTable`) over API list payloads. Kit `FEATURE_SEARCH` (PostgreSQL full-text module) is **false** in the default demo and is not the DealFlow list UI.

### Reporting

`/dealflow/reports` and Deal Health read live quotes. Kit PDF/report jobs remain available behind `FEATURE_PDF` and are not the golden-path KPI warehouse (`FEATURE_ANALYTICS=false`).

---

## 🔐 Authentication & Authorization

Platform module: [docs/auth.md](docs/auth.md) · [docs/rbac.md](docs/rbac.md).

### Login and tokens

| Mechanism | Behavior |
| --- | --- |
| Password | bcryptjs, cost `AUTH_BCRYPT_COST` (default 12; production ≥ 10) |
| Access JWT | HS256, `JWT_ACCESS_SECRET`, default 15m, claims `sub`, `type`, `role`, `jti`, `iss`, `aud` |
| Refresh JWT | Separate secret, hashed SHA-256 in `refresh_tokens`, rotation; reuse revokes the family |
| Cookies | `hsk_access` / `hsk_refresh`, httpOnly, `SameSite=Lax` default, `Secure` in production |
| Bearer | `Authorization: Bearer` still accepted for non-browser clients |
| Authorization source | Database roles/permissions after `authenticate()`, **not** the JWT `role` claim |

Do not put email or names in tokens. Password hashes are never returned. Unknown email and wrong password share the same 401 message.

### Public auth API

Prefix `/api/v1/auth`:

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/register` | No | Create account + tokens |
| POST | `/login` | No | Credentials → tokens |
| POST | `/refresh` | No | Rotate refresh |
| POST | `/logout` | No | Revoke family; denylist access `jti` if presented |
| GET | `/me` | Bearer or cookie | Current user |
| POST | `/otp/request` | No | OTP issue |
| POST | `/otp/verify` | No | OTP verify / login purpose |
| POST | `/password-reset/request` | No | Reset OTP |
| POST | `/password-reset/confirm` | No | Set password |

### DealFlow permission keys

Defined in `modules/problem/src/permissions.ts` and merged into the catalog (admin receives **every** catalog permission after merge):

| Key | Meaning |
| --- | --- |
| `dealflow.catalog.read` | Read customers, products, warehouses, policies |
| `dealflow.catalog.write` | Policies, chains, quantity breaks, role ranges, governance |
| `dealflow.catalog.products.write` | Products and stock without policy write |
| `dealflow.quotes.read` | Quotes, assessments, plans |
| `dealflow.quotes.write` | Create/edit, send to manager, submit finalized, negotiate |
| `dealflow.quotes.lock` | Finance lock |
| `dealflow.quotes.approve` | Record approve/reject on a chain |
| `dealflow.approvals.manager` | Act as Sales Manager step |
| `dealflow.approvals.finance` | Act as Finance step |
| `dealflow.approvals.final` | Final step |
| `dealflow.fulfillment.write` | Plan splits, overrides, backorders |
| `dealflow.billing.write` | Generate and cancel schedules |

### Portal vs JWT

Portal routes do **not** use the customer JWT. Possession of `portalToken` is the capability. Staff JWT cannot be substituted for a token, and a token cannot call approve/fulfill/bill/lock.

### Logout

Revokes the refresh family, clears cookies, and denylists the access `jti` until natural expiry.

---

## 🛡️ Security

This kit includes reusable hardening. It is **not** a claim that the application is fully secure. See [docs/security.md](docs/security.md).

### Implemented controls

| Control | Implementation |
| --- | --- |
| Password hashing | bcryptjs |
| Input validation | Zod on body, params, query; AI output schema-validated |
| Authorization | `requirePermission` / `authorizeRole` on mutating DealFlow routes |
| CORS | `CORS_ORIGINS` allowlist only; `*` rejected; credentials for listed origins |
| CSRF | Cookie-only POST/PUT/PATCH/DELETE require `Origin`/`Referer` in allowlist, `APP_URL`, or `FRONTEND_URL` |
| Helmet | CSP `default-src 'none'` on API, frame deny, nosniff, no referrer, HSTS in production |
| Rate limiting | Redis-backed when Redis is configured; production fails closed without in-memory fallback |
| Login brute force | 5 / email and 20 / IP per 15m; `DEMO_MODE` relaxes only for seeded `demo.*@example.com` |
| SQL injection | Prisma parameterized queries; no string-built SQL in DealFlow services |
| Secrets | No `VITE_` for JWT, Odoo, Gemini, SMTP, or cloud keys |
| Error bodies | Operational `AppError` sanitized; unhandled 500 has no stack |
| SSRF | User-controlled webhook URLs: http(s), no credentials, public hosts, DNS pin when undici is available |
| AI | Cannot register `executeSql` / `shell`; high-risk tools need `confirmed: true` |
| Production boot | Refuses missing secrets; `DEMO_MODE` refused unless `ALLOW_DEMO_IN_PRODUCTION` |
| Secret scan | `npm run security:secrets` |
| Dependency audit | `npm run security:audit` (`npm audit --omit=dev --audit-level=high`) |

### Portal-specific

Unknown tokens 404. DTO strip is server-side. Public rate limit on portal routes.

### Security improvements (not claimed as done)

- SPA CSP is the nginx/frontend image’s job, not Helmet on the API.
- XSS on the SPA origin can still drive cookie-authenticated requests and read the in-memory access token.
- Signed PDF/report URLs without `uid` remain possession-based until expiry (kit storage).
- No built-in WAF, bot management, or pentest report in this repository.

---

## 🗄️ Database Architecture

**Technology.** PostgreSQL 16 (`postgres:16-alpine`). **ORM.** Prisma 6 only. Schema: `database/prisma/schema.prisma`. Host URL in `.env.example`: `postgresql://postgres:postgres@localhost:5433/hackathon`.

### DealFlow entities

| Entity | Table | Role |
| --- | --- | --- |
| Customer | `df_customers` | Account; `tier` caches server loyalty |
| Product | `df_products` | SKU, list, cost, billing type, tax flags |
| Product relation | `df_product_relations` | Upsell / cross-sell |
| Warehouse | `df_warehouses` | Fulfillment cost per unit |
| Stock level | `df_stock_levels` | On-hand + reserved + incoming (composite PK warehouse+product) |
| Discount policy | `df_discount_policies` | Warning / approval / reject / margin impact |
| Approval chain + steps | `df_approval_chains`, `df_approval_chain_steps` | Who must sign, in order |
| Quantity break | `df_quantity_breaks` | Volume price |
| Role authority | `df_role_authorities` | Discount ceilings per role key |
| Governance config | `df_governance_config` | Material change, tax, caps, stale days |
| Quote | `df_quotes` | Totals, risk, status, portal token, freeze/lock |
| Quote line | `df_quote_lines` | Qty, discount, optional recommendation source |
| Approval | `df_quote_approvals` | Step state, actor, reason |
| Fulfillment split | `df_quote_fulfillment_splits` | Warehouse allocation |
| Backorder | `df_quote_backorders` | Unfilled quantity |
| Billing schedule | `df_quote_billing_schedules` | One-time or recurring |
| Quote revision | `df_quote_revisions` | Snapshot + material-change flag |
| Negotiation request | `df_negotiation_requests` | Customer note + structured intents |
| Anomaly | `df_anomalies` | DealFlow exceptions |
| Email delivery | `df_quote_email_deliveries` | Provisional / final send attempts |
| Audit event | `audit_events` | Kit audit |

Quote statuses: `draft` → `customer_negotiation` → `manager_review` → `finalized` → `approval_required` → `approved` → `confirmed` / `fulfillment` / `billing` / `completed`, or `rejected`.

```mermaid
erDiagram
  DfCustomer ||--o{ Quote : places
  Quote ||--o{ QuoteLine : contains
  DfProduct ||--o{ QuoteLine : priced_on
  Quote ||--o{ QuoteApproval : routed
  DfApprovalChain ||--o{ QuoteApproval : defines
  DfApprovalChain ||--o{ DfApprovalChainStep : has
  Quote ||--o{ QuoteFulfillmentSplit : allocates
  DfWarehouse ||--o{ QuoteFulfillmentSplit : from
  DfWarehouse ||--o{ DfStockLevel : holds
  DfProduct ||--o{ DfStockLevel : stocked
  Quote ||--o{ QuoteBackorder : remainder
  Quote ||--o{ QuoteBillingSchedule : bills
  Quote ||--o{ QuoteRevision : snapshots
  Quote ||--o{ DfNegotiationRequest : negotiates
  Quote ||--o{ DfQuoteEmailDelivery : emails
  DfProduct ||--o{ DfProductRelation : recommends
  DfProduct ||--o{ DfQuantityBreak : volume
```

Indexes observed on quotes: `[status, createdAt]`, `[customerId]`; unique `number`, `portalToken`. Products unique `sku`. Chain steps unique `[chainId, stepOrder]`.

### Kit tables (platform)

Users, refresh tokens, roles, permissions, notifications, documents, stored files, copilot conversations, automation rules, RAG/search/analytics/anomaly kit tables (unused by the golden path when those flags are off).

### Seed behavior

| `DEMO_MODE` | What seed writes |
| --- | --- |
| `true` | RBAC + DealFlow catalog + demo users + sample customers/inventory/quotes + presentation token `df-demo-portal-token-northwind-0001` for **DF-00001** |
| `false` | RBAC + DealFlow configuration (products, policies, chains, governance); **skips** demo users, sample customers, fake inventory, and sample quotes |

If you lock another qty-8 Core Gateway quote, run `npm run db:seed` before repeating the split. Seed resets on-hand **and** reserved, and recreates presentation quotations so dashboard totals stay consistent.

Production seed does not create the presentation portal token.

---

## 📁 Project Structure

```text
DealFlow360/
├── frontend/                 # React 18 + Vite 6 + Tailwind 3 (port 5173)
├── backend/                  # Express API (port 5000)
├── workers/                  # Background worker entry (runs backend worker.ts)
├── packages/api-contract/    # Envelopes, /api/v1 paths, FEATURE_NAMES
├── database/prisma/          # schema.prisma, migrations, seed.ts, seed-dealflow.ts
├── modules/problem/          # DealFlow360 backend + frontend pages
├── infra/                    # Compose data stores, nginx, smoke scripts, Docker healthchecks
├── docs/                     # Operator and module documentation
├── .github/workflows/        # ci.yml, cd.yml
├── docker-compose.yml        # App services; includes infra/docker-compose.yml
├── HACKATHON_MODULES.md      # Flag selection for this demo
├── PROBLEM_STATEMENT.md
├── ARCHITECTURE.md
├── ARCHITECTURE_DECISION.md
├── AGENTS.md                 # Engineering rules for contributors/agents
├── LICENSE                   # GNU AGPL v3
├── package.json              # Workspaces + root scripts
└── README.md
```

Generated output (`dist/`, `coverage/`, `node_modules/`, `docker-data/`) is not source.

### Important directories

| Path | Why it matters |
| --- | --- |
| `modules/problem/src/dealflow/` | All DealFlow engines, routes, Prisma store |
| `modules/problem/frontend/dealflow/` | Staff and portal React pages |
| `backend/src/auth`, `rbac`, `security` | Identity and hardening |
| `backend/src/problem/` | Host loader (`register(host)`) |
| `frontend/src/ui` | Reusable visual system |
| `frontend/src/problem.ts` | Thin shim to problem routes |
| `database/prisma/migrations/` | SQL history including DealFlow commercial workflow |

---

## 🧱 Frontend Architecture

| Topic | Actual choice |
| --- | --- |
| Framework | React 18.3 |
| Language | TypeScript 5 |
| Bundler | Vite 6 |
| Routing | React Router 6 (`BrowserRouter`) |
| Styling | Tailwind CSS 3 |
| Icons | lucide-react |
| State | React Context: auth, theme, toasts, feature flags, API client. No Redux. No TanStack Query as a default. |
| API client | `frontend/src/services/api.ts` — `createApiClient`, paths from `@hackathon/api-contract` |
| Tests | Vitest + Testing Library + jsdom |

```text
Page
 → layout (AppShell, PageContainer, NavigationRail)
 → visual components (Button, DataTable, Modal, …)
 → page/service callbacks
 → services/api.ts
 → /api/v1
```

### Routing (product)

| Route | Page |
| --- | --- |
| `/login` | Sales operations sign-in |
| `/register` | Public signup |
| `/forgot-password` | OTP reset (when OTP on) |
| `/dealflow` | Live dashboard |
| `/dealflow/quotes` | Quotation list |
| `/dealflow/quotes/:quoteId` | Workspace |
| `/dealflow/negotiations` | Customer negotiations |
| `/dealflow/approvals` · `/:quoteId` | Queue and detail |
| `/dealflow/fulfillment` · `/:quoteId` | Stock and plan |
| `/dealflow/subscriptions` · `/invoices` | Recurring vs one-time |
| `/dealflow/health` · `/reports` · `/catalog` · `/settings` | Insights and config |
| `/dealflow/anomalies` · `/assistant` | Exceptions and contextual insights |
| `/account` | Customer landing |
| `/portal/:token` | Isolated quote (outside `AppLayout`) |

Command palette: `Ctrl/Cmd+K` in the staff shell.

### UX states

`FeedbackStates.tsx` provides empty, error, and retry patterns. Tables paginate in the UI. Theme is `hsk.theme` in `localStorage` (`light` | `dark` | `system`).

### Validation

Forms validate on the client for speed; **backend Zod is authoritative**.

Vite proxy (`frontend/vite.config.ts`): `/api`, `/health`, `/ready`, and long-timeout `/api/v1/realtime` → `API_PROXY_TARGET` (default `http://localhost:5000`). Leave `VITE_API_URL` empty in local hybrid mode.

---

## ⚙️ Backend Architecture

| Topic | Actual choice |
| --- | --- |
| Runtime | Node.js 24 |
| Server | Express 4 |
| Language | TypeScript 5 |
| Validation | Zod 3 |
| Logging | Pino |
| Jobs | In-memory, file, or BullMQ when `REDIS_URL` is set |
| Worker | Same backend image / `backend/src/worker.ts` |

### Request lifecycle

```text
HTTP → request ID → Helmet/CORS/body parser
     → rate limit → CSRF (cookie mutations)
     → route → authenticate → requirePermission
     → controller → Zod → service
     → Prisma | integration adapter
     → envelope
```

Controllers stay thin. DealFlow HTTP lives in `modules/problem/src/dealflow/routes.ts` and calls `DealflowService`. Persistence is `prisma-store.ts` when `host.prisma` exists, otherwise an in-memory store for tests.

### Problem module host

`problemModule.register(host)` mounts:

- `GET /api/v1/problem` — public manifest (`id: dealflow`)
- `/api/v1/dealflow` — full router

It also registers jobs, optional Odoo adapters, `user.created` → customer provision, and realtime publish.

---

## 🔌 API Reference

Standard envelope from `@hackathon/api-contract`:

**Success**

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

**Error**

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  },
  "requestId": "..."
}
```

Public error codes include `VALIDATION_ERROR`, `AUTHENTICATION_ERROR`, `AUTHORIZATION_ERROR`, `NOT_FOUND`, `FEATURE_DISABLED`, `CONFLICT`, `RATE_LIMIT`, `EXTERNAL_SERVICE_ERROR`, `DATABASE_ERROR`, `TIMEOUT`, `NOT_READY`, `INTERNAL_ERROR`.

Prefix: `/api/v1`. Do not expose internal stack traces.

### Operational (outside `/api/v1`)

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/health` | No | Process liveness |
| GET | `/ready` | No | Postgres, Redis, Odoo, AI when configured |

### Public probes

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/problem` | Public rate limit | DealFlow manifest |
| GET | `/api/v1/dealflow` | Public rate limit | Same id/title |
| GET | `/api/v1/features` | Public | Feature-flag snapshot (UX only) |

### DealFlow catalog

| Method | Endpoint | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/dealflow/catalog` | `catalog.read` | Full catalog snapshot |
| PUT | `/dealflow/catalog/quantity-breaks` | `catalog.write` | Replace volume prices |
| PUT | `/dealflow/catalog/role-authorities` | `catalog.write` | Replace role ceilings |
| PATCH | `/dealflow/catalog/governance` | `catalog.write` | Material-change and caps |
| POST/PATCH/DELETE | `/dealflow/catalog/products` | `catalog.products.write` | SKUs |
| PUT/DELETE | `/dealflow/catalog/stock` | `catalog.products.write` | On-hand / reserved |
| POST/PATCH/DELETE | `/dealflow/catalog/customers` | `quotes.write` | Accounts |
| POST/PATCH/DELETE | `/dealflow/catalog/warehouses` | `catalog.write` | DCs |
| POST/PATCH/DELETE | `/dealflow/catalog/relations` | `catalog.write` | Upsell/cross-sell |
| POST/PATCH/DELETE | `/dealflow/catalog/policies` | `catalog.write` | Discount policies |
| POST/PATCH/DELETE | `/dealflow/catalog/chains` | `catalog.write` | Approval chains |

### Quotes and lifecycle

| Method | Endpoint | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/dealflow/me/quotes` | Authenticated customer | Portal DTOs + tokens |
| GET | `/dealflow/quotes` | `quotes.read` | Staff list |
| POST | `/dealflow/quotes` | `quotes.write` | Create |
| GET | `/dealflow/quotes/:id` | `quotes.read` | Aggregate |
| DELETE | `/dealflow/quotes/:id` | `quotes.write` | Delete draft/rejected |
| POST | `/dealflow/quotes/:id/void` | `quotes.write` | Void in-flight |
| POST/PATCH/DELETE | `/dealflow/quotes/:id/lines…` | `quotes.write` | Line CRUD |
| POST | `/dealflow/quotes/:id/assess` | `quotes.write` | Run engines |
| POST | `/dealflow/quotes/:id/submit` | `quotes.write` | Only from `finalized` |
| POST | `/dealflow/quotes/:id/approvals/:approvalId/decide` | `quotes.approve` | Step decision |
| GET/POST | `/dealflow/quotes/:id/negotiations` | read / authenticated | List / create |
| POST | `…/negotiations/:nid/respond` | `quotes.write` | Staff response |
| POST | `…/send-to-manager` · `/revise` · `/return` · `/agree` · `/finalize` | write / auth | Negotiation loop |
| POST | `/dealflow/quotes/:id/lock` · `/confirm` | `quotes.lock` | Finance lock (`/confirm` is an alias) |
| GET/POST | `/dealflow/quotes/:id/recommendations` | read / write | Catalog suggest / apply |
| POST | `/dealflow/quotes/:id/fulfillment/plan` | `fulfillment.write` | Split + backorder |
| POST | `/dealflow/quotes/:id/billing/generate` | `billing.write` | Hybrid schedules |
| POST | `/dealflow/quotes/:id/billing/:scheduleId/cancel` | `billing.write` | Cancel schedule |
| POST | `/dealflow/quotes/:id/vendor-contact` | `quotes.write` | Vendor contact action |
| POST | `/dealflow/quotes/:id/complete` | `quotes.write` | Complete deal |
| GET | `/dealflow/quotes/:id/pdf` | `quotes.read` | Customer-safe PDF |

### Portal (token, not staff JWT)

| Method | Endpoint | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/dealflow/portal/:token` | Token | Stripped view |
| PATCH | `/dealflow/portal/:token` | Token | Line/qty commercial change |
| POST | `/dealflow/portal/:token/negotiations` | Token | Submit request |
| POST | `/dealflow/portal/:token/agree` | Token | Confirm revision |
| POST | `/dealflow/portal/:token/decision` | Token | Accept/decline |
| GET | `/dealflow/portal/:token/pdf` | Token | PDF |

### Anomalies

| Method | Endpoint | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/dealflow/anomalies` | `quotes.read` | List |
| POST | `/dealflow/anomalies/:id/disposition` | `quotes.read` | Resolve / ignore |

<details>
<summary>Example: create a quote (placeholder token only)</summary>

```http
POST /api/v1/dealflow/quotes HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "customerId": "<uuid-from-catalog>"
}
```

Expected shape (fields vary by version):

```json
{
  "success": true,
  "data": {
    "quote": {
      "id": "<uuid>",
      "number": "DF-000xx",
      "status": "draft",
      "portalToken": "<unguessable>",
      "version": 1
    }
  },
  "meta": {}
}
```

Never commit or paste real production tokens.

</details>

<details>
<summary>Example: portal read</summary>

```http
GET /api/v1/dealflow/portal/df-demo-portal-token-northwind-0001 HTTP/1.1
Host: localhost:5000
```

The demo token exists only after a **demo** seed. It opens DF-00001 for isolation inspection. It is not a substitute for a quotation you create in the golden-path walkthrough.

The JSON must not include `riskScore`, approval actors, warehouse reservations, or staff ids. If it does, that is a bug.

</details>

Kit APIs (auth, notifications, jobs, copilot, intents, …) are documented under `docs/` and `packages/api-contract`. They are not required for the golden path.

---

## 🧪 Testing

| Layer | Where | Tools |
| --- | --- | --- |
| Unit | `backend/src/**/*.test.ts`, `modules/problem/src/**/*.test.ts`, `frontend/**/*.test.tsx`, `packages/api-contract`, `workers` | Vitest |
| Integration | `backend/tests/**/*.test.ts` | Vitest, Supertest, Prisma, ioredis |
| E2E | `backend/tests/e2e/**/*.test.ts` | Vitest + Supertest against `createApp` |

There is **no** Playwright or Cypress dependency. UI tests use jsdom.

```bash
npm test
npm run test:unit
npm run test:integration
npm run test:watch
npm run test:coverage
npm run test:e2e
```

Prepare a dedicated database:

```bash
cp .env.test.example .env.test
npm run db:test:prepare
```

Without `DATABASE_URL` or `REDIS_URL`, those integration suites skip (`describe.skip`). `npm run test:e2e` fails loudly if Postgres is missing.

Mocks: AI, Odoo, email, SMS, OTP, storage, push, webhook. Never call paid Gemini, live Odoo, SMTP, SMS, or S3 in tests. CI must not set those secrets.

Coverage: V8 (`text`, HTML, lcov under each workspace `coverage/`). Treat coverage as a local/CI artifact, not a published badge in this README.

Authoritative conventions: [docs/testing.md](docs/testing.md).

---

## 📦 Requirements

| Software | Version in this repo | Notes |
| --- | --- | --- |
| Git | Current | Clone HTTPS/SSH |
| Node.js | `^24` (`.nvmrc` is `24`) | Odd majors untested |
| npm | `^11` (`packageManager` `npm@11.6.2`) | Only package manager |
| Docker Engine + Compose | **v2.24+** (`include`, `env_file.required`) | Postgres + Redis path |
| Browser | Current desktop | SPA at :5173 |

Compose provides PostgreSQL 16 and Redis 7. Do not install native Postgres/Redis unless you leave this path. Python, Yarn, pnpm, Bun, Kubernetes, and a local Odoo server are **not** required.

Verify:

```bash
git --version
node -v
npm -v
docker version
docker compose version
```

Package versions (lockfile audit date **2026-08-30**): [docs/VERSION_MATRIX.md](docs/VERSION_MATRIX.md).

---

## 🚀 Installation Guide

### Step 1 — Clone

```bash
git clone https://github.com/upadhyaydhruv202-hue/dealflow360-intelligent-sales-operations.git
cd dealflow360-intelligent-sales-operations
```

If you have a fork, replace the URL with yours.

### Step 2 — Install dependencies

```bash
npm install
```

`prepare` builds `@hackathon/api-contract`. Backend `postinstall` runs `prisma generate`.

### Step 3 — Configure environment

```bash
cp .env.example .env
```

PowerShell: `Copy-Item .env.example .env`

Never commit `.env`. Never prefix server secrets with `VITE_`. Authoritative catalog: [docs/environment.md](docs/environment.md).

For a judged demo with mock providers, you may start from `.env.demo.example` instead.

### Step 4 — Start data stores

```bash
npm run deps:up
```

Host `DATABASE_URL` uses port **5433**. Redis is `localhost:6379`. Bind is loopback so the unauthenticated local images are not published on the LAN.

### Step 5 — Migrate

```bash
npm run db:migrate
```

Schema path: `database/prisma`. `npm install` already generated the client.

### Step 6 — Seed

```bash
npm run db:seed
```

Requires `DEMO_MODE=true` for demo users (default in `.env.example`).

### Step 7 — Run

**Recommended (hybrid):** Docker for Postgres/Redis, Node on the host.

```bash
npm run dev
```

- UI: http://localhost:5173/login
- API: http://localhost:5000 · `/health` · `/ready`
- Leave `VITE_API_URL` empty so Vite proxies `/api`

Do not run `docker compose up --build` and `npm run dev` on the same ports at once.

Workers are optional for the golden path: `npm run dev:workers`.

### Alternative — full Compose

```bash
docker compose up --build
```

Compose migrates on API start and seeds when `SEED_ON_START=true`. Inside containers, `DATABASE_URL` uses hostname `postgres` (port 5432), not localhost:5433.

Optional nginx:

```bash
docker compose --profile nginx up --build
```

Then http://localhost:8080. Set `TRUST_PROXY=1` only behind that proxy.

---

## ⚙️ Environment Configuration

Copy from `.env.example`. **Never put real secrets in the README.** Examples below are placeholders from the example file.

| Variable | Required | Purpose | Example (non-secret) |
| --- | --- | --- | --- |
| `NODE_ENV` | Yes | `development` / `test` / `production` | `development` |
| `PORT` | No | API port | `5000` |
| `DATABASE_URL` | Prod yes | Prisma | `postgresql://postgres:postgres@localhost:5433/hackathon` |
| `REDIS_URL` | Prod yes | Cache, limits, queues | `redis://localhost:6379` |
| `JWT_ACCESS_SECRET` | Yes with DB | Access HMAC (≥32 chars in prod) | generate with `crypto.randomBytes` |
| `JWT_REFRESH_SECRET` | Yes with DB | Refresh HMAC | generate separately |
| `STORAGE_SIGNING_SECRET` | Prod yes | Signed downloads; **not** the JWT secret | placeholder in example |
| `VITE_API_URL` | No | Bake API origin into SPA | empty for Vite proxy |
| `DEMO_MODE` | Local default true | Seeded users and mock fallbacks | `true` locally; **`false` in production** |
| `FEATURE_ODOO` | No | Odoo adapter | `false` |
| `FEATURE_AI` | No | AI toolkit | `true` (mock if no Gemini key) |
| `FEATURE_REALTIME` | No | SSE | `true` in this product’s example |
| `FEATURE_SMS` / `EMAIL_ENABLED` | No | Real messaging | off in example |
| `STORAGE_PROVIDER` | No | `local` / `postgres` / `s3` | `local` |
| `CORS_ORIGINS` | Yes for browsers | Allowlist | localhost:5173 and :5174, :8080 |
| `AUTH_COOKIE_ENABLED` | No | HttpOnly session | `true` |
| `SEED_ON_START` | Compose | Seed when API boots | `true` local |

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Production also requires `OTP_HASH_SECRET` when `FEATURE_OTP=true`. Production refuses `DEMO_MODE` unless `ALLOW_DEMO_IN_PRODUCTION=true` — never set that on a real tenant.

If you later enable Odoo 19: `FEATURE_ODOO=true`, `ODOO_ENABLED=true`, origin (no `/json/2` suffix), database, and server-side API key. Probe: `GET /api/v1/odoo/health` with `odoo.read`. There is no “run any Odoo method” HTTP API.

Full catalog: [docs/environment.md](docs/environment.md).

---

## 🧰 Development Commands

From the repository root (`package.json`):

| Command | Purpose |
| --- | --- |
| `npm install` | Workspaces install |
| `npm run dev` | Backend + frontend |
| `npm run dev:all` | Backend + frontend + workers |
| `npm run dev:backend` | API only |
| `npm run dev:frontend` | Vite only |
| `npm run dev:workers` | Worker watch |
| `npm run build` | Contract + problem + all workspaces |
| `npm run start` | `node` backend dist |
| `npm run lint` / `lint:fix` | ESLint 9 |
| `npm run format` / `format:check` | Prettier |
| `npm run typecheck` | `tsc --noEmit` workspaces |
| `npm test` and `test:*` | See [Testing](#-testing) |
| `npm run security:secrets` | Tracked-file secret scan |
| `npm run security:audit` | `npm audit --omit=dev` |
| `npm run deps:up` / `deps:down` | Postgres + Redis |
| `npm run docker:up` / `down` / `logs` / `ps` | Full Compose |
| `npm run docker:smoke` | `infra/scripts/smoke.mjs` |
| `npm run db:generate` | Prisma client |
| `npm run db:migrate` | `migrate deploy` |
| `npm run db:migrate:dev` | Dev migrations |
| `npm run db:seed` | Seed |
| `npm run db:reset` | `migrate reset --force` (destructive) |
| `npm run db:test:prepare` | Test database |

Frontend extras: `npm run preview -w @hackathon/frontend`. Backend extras: `npm run start:worker -w backend`.

---

## 🐳 Docker

Present and documented. Root Compose **includes** `infra/docker-compose.yml` (do not run the infra file alone).

| Item | Value |
| --- | --- |
| API Dockerfile | `backend/Dockerfile` (`node:24-alpine`, development/production targets) |
| Frontend Dockerfile | `frontend/Dockerfile` (build SPA, nginx unprivileged serve) |
| Worker | Same backend image, command `worker` |
| Volumes | `docker-data/postgres`, `docker-data/redis` |
| Health | API `GET /ready`; Redis `PING`; Postgres `pg_isready` |

```bash
npm run docker:up
npm run docker:ps
npm run docker:logs
npm run docker:down
```

Inside Compose, JWT placeholders are injected so empty `.env` keys cannot blank `.env.example` values. Change them before any shared or production use.

---

## ☁️ Deployment

There is **no** hard-coded production hostname in this repository. CD is provider-agnostic.

### What exists

- GitHub Actions **CI** (lint, typecheck, unit/integration/e2e, secret scan, audit, builds, Docker smoke) on `ubuntu-24.04` with Postgres 16 and Redis 7 service containers.
- GitHub Actions **CD** (`.github/workflows/cd.yml`): optional verify, build/push images to GHCR (`ghcr.io` default), staging/production GitHub Environments, OIDC `id-token: write`. Remote apply is **opt-in**. See [docs/ci-cd.md](docs/ci-cd.md).

### Production expectations (from config, not a live URL)

| Topic | Expectation |
| --- | --- |
| Frontend | Static SPA; `VITE_API_URL` baked at image build if not using same-origin proxy |
| Backend | `npm run build` then `npm run start -w backend` (or Compose production target) |
| Worker | Required if you rely on async email/PDF/jobs across processes |
| Database | PostgreSQL 16; run migrate explicitly; `SEED_ON_START=false` |
| Redis | **Required** in production (rate limit, KV, revocation; no in-memory fallback) |
| HTTPS | Terminate at proxy; Helmet HSTS when `NODE_ENV=production` |
| Secrets | Host/environment secrets only; never in the image or SPA |
| Demo | `DEMO_MODE=false` |

Do not describe a public demo URL unless you operate one. This README does not invent one.

---

## 📱 Responsive Design

The staff shell uses a navigation rail, topbar, and page container with Tailwind breakpoints. Tables, drawers, and the command palette are built for **desktop-first sales operations**. Mobile is not a separate native app. Portal and auth screens are simpler stacked layouts (`AuthScreen`) and are usable on smaller viewports, but this product is not documented as a fully designed mobile ERP.

Touch: buttons and rail targets follow the UI kit; there is no dedicated mobile navigation overhaul claimed here.

---

## 🎨 UI/UX Philosophy

| Principle | How it shows up |
| --- | --- |
| Visual hierarchy | Dashboard KPIs → operational queues → quote workspace |
| Consistency | Shared primitives in `frontend/src/ui` (Button, Input, DataTable, Badge, Modal) |
| Feedback | Toasts for API outcomes; SSE refresh when realtime is on |
| Loading | Skeletons / pending auth redirect copy |
| Empty | `EmptyState` with optional action |
| Error | `ErrorState` + retry callback |
| Isolation | Portal is a separate route tree — not a hide-the-sidebar trick |
| Command | `Ctrl/Cmd+K` for staff navigation |
| Theme | Light / dark / system without putting form state in Context |

Business rules do not live in CSS. If the UI shows a discount as allowed, the API still decides.

---

## ♿ Accessibility

Implemented building blocks:

- Semantic layout structure in the shell and auth screens
- Labels on kit form controls
- Focusable primitives (buttons, inputs, modal)
- Command palette keyboard entry

This repository does **not** claim WCAG certification, automated axe CI, or a completed screen-reader audit. Color tokens should be reviewed before a regulated deployment. Treat accessibility as an ongoing improvement, not a badge.

---

## 📈 Performance

**Implemented**

- Vite code splitting by route (SPA)
- Prisma indexes on quote status/customer and catalog lookups
- UI table pagination (client)
- SSE instead of tight polling when `FEATURE_REALTIME=true`
- Job offload for slow kit work (email, PDF) — optional worker
- Request body limit (`1mb` default)
- Redis for rate limits and shared queues

**Recommended improvements** (not shipped as product claims)

- Server-side pagination/filter for very large quote books
- CDN in front of the SPA
- Query-level `EXPLAIN` in production
- Image pipeline (few raster assets exist today)

---

## 📊 Scalability

The architecture can scale as a **horizontally replicated API** behind a proxy, with PostgreSQL as the primary bottleneck and Redis for shared ephemeral state.

| Area | Current | Future consideration |
| --- | --- | --- |
| API | Stateless Express (JWT + DB authz) | Multiple replicas + `TRUST_PROXY` only behind a stripping proxy |
| Database | Single Postgres 16 | Read replicas / pooling beyond `DATABASE_POOL_MAX` |
| Jobs | BullMQ when Redis is set | Separate worker pool; not Kafka |
| Realtime | In-process hub + Redis pub/sub | Connection caps already exist (`REALTIME_MAX_CONNECTIONS`) |
| Files | Local disk default | `STORAGE_PROVIDER=s3` when `FEATURE_S3` is on |
| CDN / LB | Optional nginx profile | Operator-provided |

Do not add Kubernetes, Kafka, or GraphQL unless a written requirement appears. See [ARCHITECTURE_DECISION.md](ARCHITECTURE_DECISION.md).

---

## 🧠 Technical Decisions

### Why React + Vite + Tailwind?

Fast SPA, HMR, reusable UI kit, no SSR requirement for a judged demo. Alternative: Next.js. Trade-off: no RSC.

### Why Express REST `/api/v1`?

Matches layered controllers and is easy to read under time pressure. Alternative: Nest, Fastify, GraphQL. Trade-off: less built-in structure — controllers must stay thin.

### Why PostgreSQL + Prisma?

Relational integrity for quotes, stock, approvals, and RBAC. One ORM only. CHECK constraints live in SQL migrations.

### Why Redis + BullMQ?

Rate limits, OTP, idempotency, shared workers. File/memory queues exist for a laptop without Redis; **production requires Redis**.

### Why SSE instead of WebSockets?

One-way server → browser status. Reuses Express auth. No extra Node service.

### Why problem module isolation?

So DealFlow rules are not copied into kit folders, and the kit remains reusable for other hackathons.

### Why not Odoo as system of record?

The statement is local governance first. The adapter is allowlisted JSON-2 for a later optional confirmation path.

---

## ⚖️ Technology Comparison

| Requirement | Chosen | Alternative | Reason |
| --- | --- | --- | --- |
| SPA | React 18 + Vite 6 | Next.js | No SSR needed for demo |
| API | Express 4 | Nest / Fastify | Explicit layering |
| Types | TypeScript 5 | JS-only API | Schemas and Prisma |
| DB | PostgreSQL 16 | Mongo | Integrity, FKs |
| ORM | Prisma 6 | Drizzle / Knex | Already the kit ORM |
| CSS | Tailwind 3 | Tailwind 4 / CSS-in-JS | Tailwind 4 is a breaking engine change, not adopted |
| Queue | BullMQ | Kafka | Enough for this product |
| AI | Gemini REST + mock | Browser SDK | Keys stay server-side |
| Realtime | SSE | Socket.IO | Unidirectional status |

---

## 🧩 Design Patterns

Observed in the repository (not an academic checklist):

| Pattern | Where |
| --- | --- |
| Layered architecture | Controller → service → repository |
| Modular monolith | One deployable API + optional worker |
| Repository / store | `prisma-store.ts` / `createMemoryStore` |
| Adapter | Email, SMS, storage, AI, Odoo |
| Middleware pipeline | Auth, RBAC, rate limit, CSRF |
| RBAC | `resource.action` keys, union of roles |
| Feature flags | `FEATURE_*` registry |
| Envelope API | Shared contract package |
| Host/plugin | `problemModule.register(host)` |
| Optimistic concurrency | `expectedVersion` |
| DTO stripping | `toPortalView` |
| Factory | Test factories under `backend/tests/factories` |

---

## 🧪 Error Handling

| Class of error | HTTP / code | User-facing |
| --- | --- | --- |
| Zod validation | 400 `VALIDATION_ERROR` | Field details, not internals |
| Unauthenticated | 401 `AUTHENTICATION_ERROR` | Login required |
| Forbidden (role/ceiling) | 403 `AUTHORIZATION_ERROR` | No persist |
| Missing quote/token | 404 `NOT_FOUND` | Unknown portal token looks the same as missing |
| Stale version / bad transition | 409 `CONFLICT` | Refresh and retry |
| Rate limit | 429 `RATE_LIMIT` | Wait / demo relax for seeded emails |
| Dependency down | 503 `NOT_READY` on `/ready` | Sanitized check names |
| Unhandled | 500 `INTERNAL_ERROR` | Generic message |

Frontend remaps some login errors (`login-errors.ts`) so demo users see actionable copy without leaking whether an email exists in production-style messages.

DealFlow domain errors: `forbidden`, `conflict`, `invalid` in `modules/problem/src/dealflow/errors.ts`.

---

## 📝 Logging & Monitoring

**Implemented:** Pino structured JSON (timestamp, level, `requestId`, `jobId`, duration). Secrets redacted. HTTP logs skip `/health` and `/ready`. AI logs provider/model/latency without prompt text.

**Hooks (no-op by default):** `MetricsSink`, `ErrorTracker.captureException`. Plug Sentry/Datadog/Prometheus yourself. There is **no** built-in Prometheus endpoint or Sentry SDK.

See [docs/observability.md](docs/observability.md).

### Recommended monitoring

Label as future operations work: uptime on `/health` and `/ready`, queue depth, email delivery status (`not_configured` vs `sent`), Postgres connections, Redis memory.

---

## 🩺 Health Checks

```http
GET /health
```

Returns process status, service name, environment, uptime, timestamp. Meta version `0.1.0`.

```http
GET /ready
```

Checks PostgreSQL, Redis, Odoo, and AI **when those integrations are configured**. Unconfigured dependencies are skipped and treated as ready. If a configured dependency is down: **503** `NOT_READY` with sanitized check details.

Compose API healthcheck hits `http://127.0.0.1:5000/ready`.

---

## 🔍 Search / Filtering / Sorting

- **DealFlow lists:** loaded via `GET /dealflow/quotes` (and catalog) then filtered/sorted/paginated in `DataTable`.
- **Kit search module:** `FEATURE_SEARCH=false` in `.env.example`. PostgreSQL full-text adapter exists in the kit but is not the golden path.
- Query parameters for kit search are documented in [docs/search.md](docs/search.md) when that flag is on.

---

## 📤 Data Import / Export

| Format | Status |
| --- | --- |
| PDF quotation | ✅ `quote-pdf.ts` / portal PDF |
| JSON API | ✅ REST envelopes |
| CSV / Excel import | Not implemented as a DealFlow feature |
| Payment files | Not implemented |

Kit report PDFs (`FEATURE_PDF`) are a separate renderer (`pdf-lib` on the platform).

---

## 🔔 Notifications

| Type | Trigger | Delivery | Notes |
| --- | --- | --- | --- |
| In-app | Kit notification service | Inbox `/notifications` | `FEATURE_NOTIFICATIONS=true` in example |
| Provisional customer email | Manager approval | Email adapter + `df_quote_email_deliveries` | Mock → `not_configured`, never `sent` |
| Final bill email | Finance lock | Same | Idempotent keys |
| SMS | Kit | Off (`FEATURE_SMS=false`) | |
| SSE | Quote/approval/billing/anomaly | Dashboard channel | Sanitized payload |

Read/unread is a kit inbox concern. Portal holders are not staff inbox users.

Templates include `quote-prelim-invoice` and `quote-final-invoice` in `notification.templates.ts`.

---

## 🤖 AI / ML

AI exists as a **kit toolkit**, not as DealFlow pricing.

| Item | Reality |
| --- | --- |
| Flag | `FEATURE_AI=true` in `.env.example` |
| Provider | Gemini REST (`gemini-2.5-flash` default in config) or mock |
| Demo | Empty `GEMINI_API_KEY` + `DEMO_MODE` → mock |
| Pricing / approvals | **Do not** call the LLM |
| Recommendations | Catalog relations, not embeddings |
| Guardrails | Schema → authorize → allowlisted tools → optional confirmation |
| Copilot / intents / problem intelligence | Optional pages; not golden path |

Do not describe DealFlow as “AI-priced.” RAG is off. Kit anomaly z-score engine is off (`FEATURE_ANOMALY_DETECTION=false`); DealFlow’s own anomaly center is rule-based on live quotes.

Privacy: do not log confidential prompts. Keys never go to React.

---

## 📡 Real-Time Features

| Mechanism | Used? |
| --- | --- |
| SSE `GET /api/v1/realtime/events` | Yes when `FEATURE_REALTIME=true` |
| WebSockets / Socket.IO | No |
| Polling | Fallback when the flag is off |
| Push (mobile) | Kit channel exists; not the golden path |

DealFlow publishes `{ kind: 'dealflow', source: 'dealflow', event, quoteId }` on the dashboard channel. Delivery requires dashboard subscription permission (jobs/notifications/automation/documents **or** that alias). Customers on `/portal` are not this SSE audience.

Caps: `REALTIME_HEARTBEAT` (default 15s), `REALTIME_MAX_CONNECTIONS` (200), `REALTIME_MAX_CONNECTIONS_PER_USER` (5).

---

## 🧑‍💻 Developer Workflow

1. Clone the repository.
2. Install with npm 11 / Node 24.
3. Copy `.env.example` → `.env`.
4. `npm run deps:up` → migrate → seed.
5. `npm run dev`.
6. Create a branch (see Git recommendations).
7. Implement in the correct layer (`modules/problem` for DealFlow rules).
8. `npm run lint` · `npm run typecheck` · `npm test`.
9. Review diffs; do not commit `.env` or `docker-data/`.
10. Open a pull request. CI must be green.

---

## 🌿 Git Workflow

The repository does not enforce a custom `commitlint` config. **Recommendations** (not hooks in this tree):

| Topic | Recommendation |
| --- | --- |
| Branches | `feat/…`, `fix/…`, `docs/…` from `main` / `master` |
| Commits | Imperative, why over what (see recent history: “Add connected DealFlow360 demo data…”) |
| PRs | Small, with test plan; CI on every PR |
| Merge | Prefer merge or squash as the team agrees; do not force-push `main` |
| Secrets | Never commit `.env`, keys, or `credentials.json` |

CI concurrency cancels in-progress PR runs.

---

## 🤝 Contributing

There is no separate `CONTRIBUTING.md` in this repository. Use this section.

1. Keep generic kit code generic. Put statement-specific rules in `modules/problem/`.
2. Follow [AGENTS.md](AGENTS.md): correctness, security, no secrets in git, Zod on the server, tests for failure modes.
3. Match existing TypeScript, ESLint, and Prettier.
4. Add or update tests beside the change (`*.test.ts` / HTTP tests).
5. Update `docs/` when you change flags, env vars, or public APIs.
6. Do not add Kubernetes, Kafka, GraphQL, or a second ORM without a written requirement.

### Issue reporting

Include environment (OS, Node, npm, Docker), steps to reproduce, expected vs actual, screenshots if UI, logs **without secrets**, and git SHA / version `0.1.0`.

### Feature requests

Describe the user, the workflow, whether it belongs in the kit or DealFlow, and flags it would need. Prefer issues on GitHub: [dealflow360-intelligent-sales-operations/issues](https://github.com/upadhyaydhruv202-hue/dealflow360-intelligent-sales-operations/issues).

---

## 🗺️ Roadmap

### ✅ Completed

- Governed quotations, risk, approvals, fulfillment split, hybrid billing
- Customer portal isolation and negotiation requests
- Finance lock, customer emails/PDF, loyalty, quantity breaks, catalog editors
- Auth, RBAC, Prisma, Docker, CI, demo seed

### 🚧 In Progress

- Product hardening on the live quote book (catalog CRUD, connected demo history, table pagination — see recent commits)

### 🔜 Next

- Optional Odoo 19 confirmation through the existing allowlisted adapter (still not the system of record)
- Richer portal collaboration (the problem statement lists portal comment/delivery-date APIs as out of scope in this build)

### 🔮 Future

- Payment capture after billing schedules
- Machine-learning price models (explicitly not this build)
- Stored analytics warehouse (`FEATURE_ANALYTICS`) if a product owner wants kit KPIs
- CHANGELOG.md and CONTRIBUTING.md as standalone files

---

## 📌 Project Status

| Area | Status |
| --- | --- |
| Frontend | ✅ Staff workspace + portal |
| Backend | ✅ `/api/v1/dealflow` |
| Database | ✅ Prisma `df_*` + kit |
| Authentication | ✅ JWT + cookies |
| Authorization | ✅ DealFlow keys + merge |
| Testing | ✅ Unit + HTTP + e2e (Postgres) |
| Docker | ✅ Compose |
| CI | ✅ GitHub Actions |
| CD | 🟡 Image push / opt-in apply |
| Odoo live writes | 🔴 Off |
| Payments | 🔴 Not implemented |
| Screenshots in repo | ⚪ None |
| Production hardening | 🟡 Baseline; not a certification |

npm package version: **0.1.0** (`private`: true). Development status: active hackathon / product slice on the reusable kit.

---

## 📚 Documentation

| Topic | File |
| --- | --- |
| Problem statement | [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md) |
| Enabled / disabled flags | [HACKATHON_MODULES.md](HACKATHON_MODULES.md) |
| A–Z kit manual | [docs/SETUP_MANUAL.md](docs/SETUP_MANUAL.md) |
| Doc index | [docs/README.md](docs/README.md) |
| Environment catalog | [docs/environment.md](docs/environment.md) |
| Features | [docs/features.md](docs/features.md) |
| Architecture | [ARCHITECTURE.md](ARCHITECTURE.md) · [ARCHITECTURE_DECISION.md](ARCHITECTURE_DECISION.md) |
| Problem module boundary | [docs/problem-module.md](docs/problem-module.md) · [modules/problem/README.md](modules/problem/README.md) |
| Database / Redis / Docker | [docs/database.md](docs/database.md) · [docs/redis.md](docs/redis.md) · [docs/docker.md](docs/docker.md) |
| Security / testing / CI | [docs/security.md](docs/security.md) · [docs/testing.md](docs/testing.md) · [docs/ci-cd.md](docs/ci-cd.md) |
| Auth / RBAC | [docs/auth.md](docs/auth.md) · [docs/rbac.md](docs/rbac.md) |
| Fresh machine | [docs/FRESH_SETUP_CHECKLIST.md](docs/FRESH_SETUP_CHECKLIST.md) · [docs/prerequisites.md](docs/prerequisites.md) |
| Realtime / notifications / jobs | [docs/realtime.md](docs/realtime.md) · [docs/notifications.md](docs/notifications.md) · [docs/jobs.md](docs/jobs.md) |

There is no OpenAPI generator. HTTP truth is Zod + `@hackathon/api-contract` + this README’s tables.

---

## 🧑‍🏫 User Guide

### Getting started (demo)

1. Install and seed ([Installation](#-installation-guide)).
2. Open `/login`.
3. Pick a demo chip or type a seeded email.

### Sales representative

1. Land on `/dealflow`.
2. **Quotations** → new quote → customer **Northwind Retail**.
3. Add **Core Gateway × 8 @ 5%** and **Control Suite × 1 @ 5%**.
4. Copy **this quote’s** portal link (not the presentation token unless you are only inspecting isolation).
5. After customer submit: **Customer negotiations** → respond or send to manager.
6. After manager finalize: **Submit**.
7. After finance lock: add recommended **Edge Sensor Pack**, plan fulfillment, generate billing.

### Manager

Revise discounts (replace, do not stack), return to customer if needed, **Finalize**, approve step 1 when the chain requires it.

### Finance

Complete remaining approval steps, then **Lock**. Staff lock is 403.

### Customer

Sign in as `demo.user@example.com` → `/account`, or open `/portal/:token` without becoming staff. Submit request, then later **Confirm quotation** on the revised version. Confirmation does not skip approval.

### Logout

Account menu → logout (revokes refresh family).

---

## 🧑‍💼 Admin Guide

Admin (`demo.admin@example.com`) receives the full merged permission catalog.

| Area | Capability |
| --- | --- |
| Login | Same `/login` |
| Dashboard | Full `/dealflow` |
| Catalog | Products, policies, chains, warehouses, relations |
| Configuration | `/dealflow/settings` quantity breaks, role ranges, governance |
| Approvals | `canActOnRole` allows admin on manager/finance/final steps |
| Discount writes | Highest matching staff/manager/finance authority — not a hidden 40% |
| Kit admin | `admin.settings` and other catalog keys from the platform role |
| User management | Platform RBAC APIs (`docs/rbac.md`) — not a dedicated DealFlow IAM UI |
| Monitoring | `/health`, `/ready`, optional kit pages; no APM bundled |

There is no separate “god mode” that bypasses `requirePermission` in middleware.

---

## 🔐 Role & Permission Matrix

| Feature | Admin | Manager | Staff | Finance | Customer | Portal token |
| --- | --- | --- | --- | --- | --- | --- |
| Open `/dealflow` | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Open `/account` | — | — | — | — | ✅ | — |
| Catalog read | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Catalog governance write | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Product/stock write | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Create/edit quotes | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Approve chain | ✅ | ✅ (manager step) | ❌ | ✅ (finance step) | ❌ | ❌ |
| Finance lock | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Fulfillment write | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Billing write | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Portal commercials | — | — | — | — | via token/account | ✅ stripped |
| Staff APIs | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |

Frontend `canAccessInternalDealflow` is UX only.

---

## 🔌 Integrations

| Integration | Purpose | Auth | Data | Config | Failure |
| --- | --- | --- | --- | --- | --- |
| PostgreSQL | System of record | URL | All durable state | `DATABASE_URL` | `/ready` 503 |
| Redis | Limits, OTP, jobs, SSE | URL | Ephemeral | `REDIS_URL` | Prod refuse in-memory |
| Email (SMTP/Resend/Brevo/mock) | Customer + kit mail | Provider keys | Quote documents | `EMAIL_*` | Recorded not_configured / failed |
| Gemini / mock AI | Kit copilot etc. | `GEMINI_API_KEY` | Prompts (untrusted out) | `FEATURE_AI` | Mock in demo |
| Odoo 19 JSON-2 | Optional ERP | API key server-side | Allowlisted models | **off** by default | Health fails expected |
| Local / Postgres / S3 storage | Files | Signing secret / AWS | PDFs, uploads | `STORAGE_PROVIDER` | Adapter errors |
| SMS | Kit OTP/SMS | Off | — | `FEATURE_SMS=false` | Unused |

BullMQ is not an external SaaS; it uses your Redis.

---

## 📦 Dependency Overview

| Dependency | Purpose | Layer |
| --- | --- | --- |
| react / react-dom / react-router-dom | SPA | Frontend |
| vite / tailwindcss | Build / CSS | Frontend |
| lucide-react | Icons | Frontend |
| express | HTTP | Backend |
| prisma / @prisma/client | ORM | Backend |
| zod | Validation | Backend + contract |
| jsonwebtoken / bcryptjs | Auth | Backend |
| helmet / cors | HTTP hardening | Backend |
| ioredis / bullmq | Redis / jobs | Backend |
| pino | Logs | Backend / workers |
| pdf-lib | PDF | Backend + problem |
| nodemailer | SMTP | Backend |
| @aws-sdk/client-s3 | Optional S3 | Backend |
| vitest / supertest / testing-library | Tests | All |

Transitive packages are in `package-lock.json`. Do not add a second ORM or test runner.

---

## 🏗️ Build Pipeline

```text
Source
  → npm ci (CI) / npm install (laptop)
  → prisma generate
  → lint
  → typecheck
  → unit tests (coverage in CI)
  → integration tests
  → e2e tests
  → secret scan + audit
  → build api-contract, frontend, problem, backend, workers
  → Docker smoke (CI)
  → optional CD image push
```

---

## 🔁 CI/CD

| Workflow | File | Triggers |
| --- | --- | --- |
| CI | `.github/workflows/ci.yml` | Push `main`/`master`, all PRs, `workflow_call` |
| CD | `.github/workflows/cd.yml` | `workflow_dispatch`, CI completed on default branches |

CI jobs use Node from `.nvmrc`, `npm ci`, migrate against `hackathon_test`, JUnit + coverage artifacts (14 days). It does not call paid SaaS.

CD builds/pushes `hackathon-backend` / frontend images to `IMAGE_REGISTRY` (default GHCR). Remote Kubernetes/cloud apply is not assumed.

---

## 🧯 Troubleshooting

| Symptom | What to check |
| --- | --- |
| `npm install` refuses Node/npm | `.npmrc` `engine-strict=true`. Use Node 24 and npm 11 |
| Database connection failed | `npm run deps:up`; `DATABASE_URL` port **5433**; container `hackathon-postgres` healthy |
| `/ready` 503 | Redis ping; `REDIS_URL=redis://localhost:6379`; Postgres up; Odoo/AI only if you configured them |
| Prisma migrate failed | Postgres up first; schema is `database/prisma` |
| Port 5000 or 5173 in use | Stop the other `npm run dev` or Compose stack |
| Frontend cannot reach API | Keep `VITE_API_URL` empty; API on :5000; proxy in `vite.config.ts` |
| Login “too many attempts” | Seeded demo email + `DEMO_MODE=true`, or wait 15 minutes |
| `demo.user` blocked from `/dealflow` | Expected |
| CORS errors | Origin must be in `CORS_ORIGINS` (5173/5174/8080 in example) |
| Cookie mutations fail | Send `Origin`/`Referer`; or use Bearer |
| Empty warehouse split | Confirm consumed Core Gateway stock; `npm run db:seed` |
| Odoo health fails | Expected when `FEATURE_ODOO=false` |
| Gemini errors | Leave the key empty with `DEMO_MODE=true`, or `AI_PROVIDER=mock` |
| Tests need a database | `Copy-Item .env.test.example .env.test` then `npm run db:test:prepare` |
| Email shows sent in demo | Should not; mock is `not_configured` — file a bug if marked `sent` |
| Compose vs hybrid clash | Do not bind both to 5000/5173 |
| Windows env copy | Use `Copy-Item`, not `cp`, if `cp` is missing |
| Permission 403 on approve | Sign in as manager/finance/admin, not staff |
| 409 on lock/edit | Refresh `expectedVersion`; commercials frozen after lock |

---

## ❓ Frequently Asked Questions

**What is this project?**  
DealFlow360: governed sales quotations on a reusable Node/React kit.

**Who is it for?**  
Sales, managers, finance, admins, and customers in a mixed hardware/subscription motion.

**What technologies does it use?**  
React 18, Vite 6, Tailwind 3, Node 24, Express 4, TypeScript 5, PostgreSQL 16, Prisma 6, Redis 7, Vitest.

**How do I install it?**  
[Installation Guide](#-installation-guide).

**How do I run it?**  
`npm run deps:up` then `npm run dev`, or `docker compose up --build`.

**Where is the database?**  
Docker Postgres on host port **5433**, database name `hackathon`.

**How does authentication work?**  
Email/password, JWT access + refresh, httpOnly cookies, RBAC from PostgreSQL.

**Is it production ready?**  
It has production boot checks, Redis requirements, and CI. It is **not** a security certification. Payments and live Odoo writes are absent. `DEMO_MODE` must be false in production.

**Can I contribute?**  
Yes — [Contributing](#-contributing).

**How do I report bugs?**  
GitHub issues with environment and repro.

**Where is the API documentation?**  
This README + `docs/api-conventions.md` + `packages/api-contract`. No OpenAPI file.

**Does AI set prices?**  
No.

**Is Odoo required?**  
No.

**Why is frontend URL 5174 in `.env.example`?**  
CORS includes both 5173 (Vite) and 5174. The documented Vite port is **5173**.

**What is the presentation portal token for?**  
After demo seed, `df-demo-portal-token-northwind-0001` opens DF-00001 so you can inspect isolation. Walk the golden path on a quote **you** create.

**Is there an operations demo user?**  
No.

**CHANGELOG?**  
No `CHANGELOG.md` in the tree. Use git history.

---

## 📖 Glossary

| Term | Meaning |
| --- | --- |
| Quote aggregate | Quote + lines + approvals + splits + schedules + revisions |
| Blended discount | Discount total over list total |
| Material change | ≥ 2pp blended increase or ≥ 10% net move |
| Portal token | Unguessable capability URL for one quote |
| Finance lock | Commercial close; consumes allocated stock |
| Hybrid billing | One-time and recurring schedules, not card capture |
| Problem module | `modules/problem` — DealFlow code |
| Kit / platform | Reusable auth, RBAC, jobs, adapters |
| Golden path | The judged demo workflow |
| Envelope | `{ success, data, meta }` / `{ success: false, error, requestId }` |
| expectedVersion | Optimistic concurrency token |
| Loyalty new/gold/platinum | Derived from won purchase count; persisted tier `standard` for new |
| Backorder | Quantity not covered by available stock |
| SSE | Server-Sent Events |

---

## 🧪 Example Scenarios

### 1. Staff blocked at 8%

1. Staff creates Northwind quote, adds hardware at 5%.
2. Staff patches line to 8%.
3. Service checks role ceiling 5%.
4. No row update; 403.
5. UI shows authorization error.

### 2. Customer request then manager replace

1. Customer submits 8% counter via portal (stored as request, not applied).
2. Status `customer_negotiation`.
3. Staff cannot apply 8%; sends to manager.
4. Manager writes 10%; stored value is 10%.
5. Customer confirms that revision; approval engine still required.

### 3. Qty-8 Core Gateway split

1. After lock, staff plans fulfillment with no overrides.
2. Engine allocates West 4, East 3, backorder 1.
3. Stock reserved on allocated qty; backorder not consumed at lock.

### 4. Mock email honesty

1. Manager approves; provisional email recorded.
2. No SMTP configured.
3. Delivery status is not `sent`.
4. Judge can still show the PDF download.

### 5. Customer cannot open staff app

1. `demo.user@example.com` logs in.
2. `homePathForUser` → `/account`.
3. Staff APIs 403 without `dealflow.quotes.read`.

---

## 🔬 Technical Deep Dive

### Policy match

Specificity = (tier match ? 2 : 0) + (category match ? 2 : 0), then lower `priority`. Implicit default if nothing matches: warning 3%, approval 5%, reject 25%.

### Line decision

```text
discount >= rejectPercent        → rejected
discount >= approvalPercent      → approval_required
discount >= warningPercent       → warning
else                             → allowed
margin erosion >= maxMarginImpact → escalate to approval_required (unless already rejected)
```

### Risk score (clamped 0–100)

```text
blendedDiscountPercent × 2.5
+ average(marginErosionPercent) × 0.4
+ warningCount × 8
+ approvalLineCount × 15
+ rejectedCount × 40
```

### Available stock

```text
available = max(0, quantityOnHand - reserved)
```

### Compile boundary

`@hackathon/problem` has its own `rootDir`. The API `require`s `modules/problem/src/index.ts` under `tsx` and `dist/index.js` in production. Frontend bundles `modules/problem/frontend` via `frontend/src/problem.ts` without a second SPA.

### Admin discount ceiling

`matchDiscountAuthority` only considers `staff` / `manager` / `finance`. Admin without those keys falls back to finance authority (15%), not 40%.

---

## 🧮 Data Lifecycle

```text
Create quote (draft, portalToken)
  → Validate Zod + RBAC
  → Store df_quotes / lines
  → Assess (policy, risk, tax)
  → Customer negotiate (request rows)
  → Manager revise / finalize
  → Submit → approval steps
  → Finance lock → consume stock, email, PDF
  → Fulfillment plan / billing generate
  → Complete
  → Void or delete (status-gated)
  → Revisions retain snapshots; audit_events for kit audit
```

Retention/deletion of personal data is not given a legal schedule in this repo. Operators must define one.

---

## 🧹 Code Quality

| Tool | Use |
| --- | --- |
| TypeScript strict-ish project configs | `typecheck` |
| ESLint 9 + typescript-eslint | `npm run lint` |
| Prettier 3 | `npm run format` |
| Zod | Runtime validation |
| Vitest | Automated tests |
| engine-strict | Node/npm majors |

Naming: DealFlow files use `kebab-case.ts`; Prisma models `Df*` mapped to `df_*`. Permission keys `resource.action`.

---

## 🔒 Privacy

| Data | Why | Where | Access |
| --- | --- | --- | --- |
| Email, display name, password hash | Login | `users` | Auth service; hash never returned |
| Customer name, email, tier | Quotes | `df_customers` | Staff catalog; portal shows name only |
| Quote commercials | Selling | `df_quotes` | Staff vs stripped portal |
| Refresh token hashes | Session | `refresh_tokens` | Auth only |
| Email delivery rows | Audit of send attempts | `df_quote_email_deliveries` | Staff/system |

This section is **not** a privacy policy or GDPR/CCPA legal claim. Add a real policy before processing production personal data.

---

## ⚠️ Limitations

- No payment capture or payment provider.
- Odoo is off; nullable `odoo_*` ids are unused in the default demo.
- No screenshot/video assets in git.
- No Playwright browser e2e.
- Deal Health is derived, not a warehouse.
- Default tax rate is 0 unless governance is changed.
- Operations role has no demo user.
- Kit Copilot/intents/planning may appear when flags are on; they are not the product story.
- pdf-lib is in maintenance; adequate for this renderer.
- ESLint 9 is marked EOL upstream (dev-only).
- Desktop-first UI.
- Single-region Compose, not multi-AZ HA.

---

## 🚧 Known Issues

No separate `ISSUES.md` is maintained in the repository. Treat GitHub Issues as the tracker.

Documented product constraints (not bugs): staff cannot approve; customers cannot open `/dealflow`; mock email is never `sent`; presentation token is not the golden-path quote.

If CI is red, start with the Actions log for this repo rather than assuming the laptop is wrong.

---

## 🔮 Future Improvements

| Category | Ideas (not implemented) |
| --- | --- |
| Performance | Server-side list query pushdown |
| Security | SPA CSP audit, regular dependency majors |
| UX | Committed screenshots, mobile nav polish |
| Scalability | Explicit worker sizing guide per tenant |
| Automation | More DealFlow-specific automation rules (kit engine exists) |
| Analytics | Optional `FEATURE_ANALYTICS` if product wants kit KPIs |
| Integrations | Allowlisted Odoo confirmation; payment provider after schedules |

---

## 🏆 Why This Project Matters

Sales organizations lose margin in the gap between CRM, ERP, warehouse, and email. DealFlow360 makes that gap visible and enforceable: ceilings, reasons, chains, stock, and billing shapes share one quote. Judges, recruiters, and operators can run the loop on a laptop without buying Gemini, Odoo, or a payment gateway.

For faculty and hackathon reviewers: the interesting idea is not “another dashboard.” It is **governance that still holds after the customer negotiates**, with an honest portal boundary.

For platform engineers: the same repo shows how to keep a reusable kit from absorbing domain rules.

---

## 💥 What Makes It Different?

| Typical tool | DealFlow360 |
| --- | --- |
| Quote as PDF | Quote as governed aggregate |
| Discount in a cell | Policy + role ceiling + 403 |
| Approval by chat | Ordered steps + invalidation |
| One warehouse field | Split + backorder from reserved stock |
| One invoice shape | One-time vs recurring schedules |
| Customer sees the CRM | Stripped portal DTO |
| “AI prices the deal” | AI is optional kit, never the price path |
| ERP is truth on day one | PostgreSQL is truth; Odoo optional later |

Unsupported slogans such as “world’s first” are intentionally avoided.

---

## 📊 Before vs After

| Before | With this project |
| --- | --- |
| Manual discount policing | Server ceilings |
| Fragmented approval | Chain selected by risk/blended |
| Inventory surprise | Available = on-hand − reserved |
| Mixed invoice | Hybrid schedules |
| Customer on internal screens | Token portal |
| Stale “approved” stamp | Material-change reapproval |

No fabricated time-saved percentages.

---

## 📈 Impact

Measurable production metrics are **not** published in this repository. Qualitative impact: a judge can complete the golden path on seeded data without live Odoo or payments. Do not invent conversion or dollar figures.

---

## 🎓 Hackathon / Academic Context

This repository is a **hackathon starter kit** filled for DealFlow360. Official problem fill-in: [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md). Module selection: [HACKATHON_MODULES.md](HACKATHON_MODULES.md). Engineering rules: [AGENTS.md](AGENTS.md).

Do not fabricate awards or rankings. Success criteria in the problem statement: discount → limit → variance → why → who is visible; warehouse available = on-hand − reserved; billing separates one-time and recurring; negotiation recreates approvals on the server.

---

## 🧑‍🚀 Project Journey

```text
Reusable kit (auth, RBAC, Prisma, Docker, CI)
  → Problem module slot
  → DealFlow engines (discount, approval, fulfillment, billing)
  → Portal isolation + negotiation
  → Finance lock + customer email/PDF
  → Connected demo book + catalog editors
  → Optional Odoo / payments (future)
```

Dates of individual features live in git history, not in a marketing timeline.

---

## 🏛️ Architecture Principles

Supported by the implementation:

- Separation of HTTP vs domain vs persistence
- Modularity (`modules/problem` vs kit)
- Backend-authoritative security
- Swappable adapters
- Demo must not behave as production
- One ORM, one API prefix, one envelope

---

## 🔍 Codebase Navigation

| I want to change… | Start here |
| --- | --- |
| Discount, risk, material change | `modules/problem/src/dealflow/discount-engine.ts` |
| Approval steps | `modules/problem/src/dealflow/approval-engine.ts` |
| Orchestration | `modules/problem/src/dealflow/service.ts` |
| Stock split / consume | `modules/problem/src/dealflow/fulfillment-engine.ts` |
| Billing | `modules/problem/src/dealflow/billing-engine.ts` |
| HTTP surface | `modules/problem/src/dealflow/routes.ts` |
| Portal DTO | `modules/problem/src/dealflow/portal-view.ts` |
| Seeded catalog | `modules/problem/src/dealflow/defaults.ts` |
| Presentation demo book | `modules/problem/src/dealflow/presentation-book.ts` |
| Staff UI | `modules/problem/frontend/dealflow/` |
| Nav | `frontend/src/layouts/nav.ts` |
| Prisma models | `database/prisma/schema.prisma` |
| Auth / RBAC / adapters | `backend/src/` |
| Envelopes / paths | `packages/api-contract/` |
| Compose | `docker-compose.yml`, `infra/docker-compose.yml` |

---

## 🧰 Maintenance Guide

- **Dependencies:** `npm ci` in CI; do not delete the lockfile; see [docs/VERSIONING_POLICY.md](docs/VERSIONING_POLICY.md).
- **Database:** add Prisma models + migrations under `database/prisma`; never a second ORM.
- **API:** Zod schemas in `schemas.ts`; keep envelopes stable.
- **Features:** prefer flags; DealFlow domain stays in the problem module.
- **Docs:** update `docs/environment.md` when adding env vars.
- **Tests:** unit + HTTP failure modes; mock providers.

### Recommended release checklist

```text
[ ] Tests pass
[ ] Lint passes
[ ] Typecheck passes
[ ] Build succeeds
[ ] Environment verified (no demo in production)
[ ] Database migrated
[ ] Documentation updated
[ ] Changelog updated (create CHANGELOG.md if you need one)
[ ] Security review completed (secrets scan + audit)
[ ] FEATURE_ODOO still matches intent
```

This checklist is **recommended**; it is not a single automated gate beyond CI.

---

## 🔄 Versioning

npm workspaces share version **0.1.0**. The kit is not published to the public npm registry (`private: true`). Docker/CD tags use git SHA (`sha-<rev>`) per [docs/ci-cd.md](docs/ci-cd.md). SemVer for product releases is not documented beyond that; add a policy if you publish tagged releases.

---

## 📝 Changelog

There is **no** `CHANGELOG.md` in this repository. Use `git log` on `main` / `master`. Creating a changelog is recommended for tagged releases.

---

## 📜 License

**AGPL-3.0-or-later.** See [LICENSE](LICENSE) (GNU Affero General Public License v3). Network use of a modified version requires offering source to that network’s users.

If you ship this as a hosted service, read AGPL obligations with your own counsel. This README is not legal advice.

---

## ⚖️ Third-Party Licenses

Direct dependencies remain under their own licenses (MIT, Apache-2.0, etc. as declared by each package). This repository does not include a generated `NOTICE` or license inventory report. Run your own `license-checker` (or similar) before a compliance review. Do not treat this paragraph as legal compliance.

---

## 🙏 Acknowledgements

- React, Vite, Tailwind CSS, React Router
- Node.js, Express, TypeScript, Zod
- PostgreSQL, Prisma
- Redis, BullMQ, ioredis
- Helmet, Pino, pdf-lib, bcryptjs, jsonwebtoken
- Vitest, Testing Library, Supertest
- GitHub Actions, Docker, nginx unprivileged image
- Optional: Gemini API, Odoo 19 JSON-2, AWS S3, Nodemailer / Resend / Brevo providers

Inspiration: governed CPQ / sales-ops practice; this implementation is original to the repository.

---

## 👨‍💻 Team

Contributor identities are those recorded in git history for [this GitHub repository](https://github.com/upadhyaydhruv202-hue/dealflow360-intelligent-sales-operations). This README does not invent additional names.

- Project Team — Development & Engineering

---

## 📬 Contact

- Issues and discussions: [GitHub Issues](https://github.com/upadhyaydhruv202-hue/dealflow360-intelligent-sales-operations/issues)
- Source: [github.com/upadhyaydhruv202-hue/dealflow360-intelligent-sales-operations](https://github.com/upadhyaydhruv202-hue/dealflow360-intelligent-sales-operations)

Do not put private emails or credentials here.

---

## ⭐ Support the Project

If DealFlow360 or the kit helped you:

- Star the repository
- Report bugs with reproduction steps
- Suggest features that fit the architecture
- Contribute tests and documentation
- Share the repo with teammates who need governed quotations — without implying unpaid production support

---

## ⚡ Golden Demo

<a id="demo-workflow"></a>

Seeded password for every demo account: `demo-password`.

```mermaid
sequenceDiagram
  participant Staff
  participant Portal
  participant API
  participant Manager
  participant Finance
  Staff->>API: Create Northwind quote + HW-CORE-1×8@5% + SW-CTRL-1×1@5%
  Portal->>API: Submit request (qty / comment / counter-discount)
  Staff->>API: Review / respond; 8% write blocked
  Staff->>API: Send to Manager
  Manager->>API: Replace line discounts (max 10%) and return revised quote
  Portal->>API: Confirm quotation (specific revision)
  Manager->>API: Finalize (freeze commercials)
  Staff->>API: Submit finalized quote
  API-->>Staff: Assessment + approval chain
  Manager->>API: Approve step 1
  Finance->>API: Approve remaining steps
  Finance->>API: Lock deal
  Staff->>API: Add recommended Edge Sensor Pack
  Staff->>API: Plan fulfillment (West 4, East 3, backorder 1)
  Staff->>API: Generate billing (one-time + monthly)
```

1. Sign in as **staff** → Dashboard → New quotation → **Northwind Retail**.
2. Add **Core Gateway × 8 @ 5%** and **Control Suite × 1 @ 5%**. Staff writes above 5% are rejected (403).
3. Copy **this quote’s** portal link. As the customer, change quantity, add a line comment, counter a discount, and **Submit request**. Status becomes **Under Negotiation**. Requested discount is stored, not applied.
4. Sign in as **staff** → **Customer negotiations**. Respond or try an 8% line write (403 — Sales Rep ceiling 5%). **Send to Manager**.
5. Sign in as **manager**. Adjust lines (a higher role **replaces** the prior discount; 5% then 10% stores 10%). Return the revised quote if needed.
6. As the customer, **Confirm quotation** on that revision. Confirmation is blocked while a request is open, in review, or with the manager. Confirmation does not skip approval.
7. As **manager**, **Finalize**. Commercials freeze.
8. As **staff**, **Submit**. Only `finalized` quotes can enter the existing approval engine.
9. Manager approves the first step; **finance** (or admin acting on that step) completes the chain.
10. As **finance**, **Lock**. Staff cannot lock (403).
11. Add the recommended **Edge Sensor Pack**, accept the suggested split (West 4, East 3, backorder 1), and generate billing. One-time and recurring stay separate.

When `DEMO_MODE=true`, seed loads a few months of connected sales-ops history (customers, catalog, quotations, fulfillment, billing) and the portal token `df-demo-portal-token-northwind-0001` opens **DF-00001** (draft Northwind catalog quote). Use that token to inspect portal isolation; it is not a substitute for a quotation you create in the golden-path walkthrough.

---

## 🏁 Implemented vs Intentionally Limited

| In this build | Intentionally not this build |
| --- | --- |
| Policy-based discounts, blended risk, approval chains | Live Odoo `sale.order` / invoice writes |
| Warehouse split + backorder | Payment collection or a payment provider |
| Hybrid billing schedules | Portal comment threads or delivery-date APIs |
| Token portal + material-change reapproval | Machine-learning price models |
| Finance lock against PostgreSQL | Claiming Odoo is the system of record |
| Kit AI (mock without a Gemini key) | AI executing SQL, shell, or arbitrary Odoo methods |
| Redis + BullMQ + optional worker | A required worker for the golden path |
| Deal Health / Reports from live quotes | A stored deal-health snapshot or FEATURE_ANALYTICS KPIs |

---

<p align="center">
  <strong>DealFlow360</strong> — quotations that stay governed after the handshake.<br />
  <a href="#-quick-start">Run it</a> ·
  <a href="#-golden-demo">Walk the demo</a> ·
  <a href="#-documentation">Read the docs</a> ·
  <a href="#-license">AGPL-3.0-or-later</a>
</p>

---

## 📘 Extended Technical Handbook

This appendix is part of the same `README.md`. It does not add product features. It expands **implemented** HTTP contracts, Prisma fields, UI pages, seed catalog, formulas, tests, and operator runbooks so a new engineer can work without opening every source file on day one.

Authoritative code remains:

- Routes: `modules/problem/src/dealflow/routes.ts`
- Zod: `modules/problem/src/dealflow/schemas.ts`
- Domain types: `modules/problem/src/dealflow/types.ts`
- Service: `modules/problem/src/dealflow/service.ts`
- Prisma: `database/prisma/schema.prisma`
- Env catalog: `docs/environment.md`
- Frontend client: `modules/problem/frontend/dealflow/api.ts`

Placeholder UUIDs below are **examples**. Replace them with values from `GET /api/v1/dealflow/catalog` on your seeded database. Never paste production tokens or passwords.

### Handbook contents

- [HTTP cookbook](#http-cookbook)
- [Auth HTTP cookbook](#auth-http-cookbook)
- [Zod contract notes](#zod-contract-notes)
- [Prisma field catalog](#prisma-field-catalog)
- [Seed catalog reference](#seed-catalog-reference)
- [Engine formulas with worked numbers](#engine-formulas-with-worked-numbers)
- [Quote status encyclopedia](#quote-status-encyclopedia)
- [Negotiation status encyclopedia](#negotiation-status-encyclopedia)
- [Error encyclopedia](#error-encyclopedia)
- [Staff page operator manual](#staff-page-operator-manual)
- [Frontend client map](#frontend-client-map)
- [Click-level golden path](#click-level-golden-path)
- [curl session](#curl-session)
- [PowerShell session](#powershell-session)
- [Test inventory](#test-inventory)
- [Migration index](#migration-index)
- [Source file map](#source-file-map)
- [Environment catalog (complete)](#environment-catalog-complete)
- [Judge and demo runbook](#judge-and-demo-runbook)
- [Extended FAQ](#extended-faq)

## HTTP cookbook

All DealFlow routes are mounted at `/api/v1/dealflow` except the public problem probe at `/api/v1/problem`. IDs are UUIDs unless noted. Mutating quote operations generally require `expectedVersion` (positive integer) matching `quote.version`.

Cookie-authenticated browsers must send a trusted `Origin` or `Referer`. The examples use Bearer tokens for copy-paste.

### Problem manifest

**Purpose.** Identify the loaded problem module without a session.

| Item | Value |
| --- | --- |
| Method | `GET` |
| Path | `/api/v1/problem` |
| Auth | Public (rate limited) |
| Permission | None |
| UI | Foundation / health pages may read this |
| Service | `createProblemManifestRouter` |
| Persistence | None |

**Request**

```http
GET /api/v1/problem HTTP/1.1
Host: localhost:5000
Content-Type: application/json
```

No JSON body (empty object allowed where `expectedVersion` is optional).

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "id": "dealflow",
    "title": "DealFlow360",
    "replaceable": false,
    "jobName": "dealflow.odoo.sync"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 429 | `RATE_LIMIT` | Public limiter exceeded |

**Notes.** The job name `dealflow.odoo.sync` is registered even when FEATURE_ODOO is false. It does not imply live Odoo writes.

### DealFlow probe

**Purpose.** Same manifest as `/problem`, under the product prefix.

| Item | Value |
| --- | --- |
| Method | `GET` |
| Path | `/api/v1/dealflow` |
| Auth | Public (rate limited) |
| Permission | None |
| UI | Optional client ping |
| Service | `createDealflowRouter GET /` |
| Persistence | None |

**Request**

```http
GET /api/v1/dealflow HTTP/1.1
Host: localhost:5000
Content-Type: application/json
```

No JSON body (empty object allowed where `expectedVersion` is optional).

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "id": "dealflow",
    "title": "DealFlow360",
    "replaceable": false,
    "jobName": "dealflow.odoo.sync"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 429 | `RATE_LIMIT` | Public limiter exceeded |

### Read catalog

**Purpose.** Snapshot of customers, products, warehouses, stock, policies, chains, quantity breaks, role authorities, and governance.

| Item | Value |
| --- | --- |
| Method | `GET` |
| Path | `/api/v1/dealflow/catalog` |
| Auth | Bearer or cookie |
| Permission | `dealflow.catalog.read` |
| UI | Catalog, Settings, Quote workspace pickers |
| Service | `DealflowService.catalog` |
| Persistence | df_customers, df_products, df_warehouses, df_stock_levels, df_discount_policies, df_approval_chains, df_quantity_breaks, df_role_authorities, df_governance_config |

**Request**

```http
GET /api/v1/dealflow/catalog HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

No JSON body (empty object allowed where `expectedVersion` is optional).

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "customers": [],
    "products": [],
    "warehouses": [],
    "stock": [],
    "policies": [],
    "chains": [],
    "quantityBreaks": [],
    "roleAuthorities": [],
    "governance": {}
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 401 | `AUTHENTICATION_ERROR` | Missing/invalid session |
| 403 | `AUTHORIZATION_ERROR` | Caller lacks catalog.read |

### Replace quantity breaks

**Purpose.** Replace the volume-price table (max 100 items).

| Item | Value |
| --- | --- |
| Method | `PUT` |
| Path | `/api/v1/dealflow/catalog/quantity-breaks` |
| Auth | Bearer or cookie |
| Permission | `dealflow.catalog.write` |
| UI | /dealflow/settings |
| Service | `replaceQuantityBreaks` |
| Persistence | df_quantity_breaks |

**Request**

```http
PUT /api/v1/dealflow/catalog/quantity-breaks HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "items": [
    {
      "name": "Core Gateway 1–9 list",
      "productId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      "minQuantity": 1,
      "maxQuantity": 9,
      "adjustmentKind": "fixed",
      "adjustmentValue": 4000,
      "active": true
    }
  ]
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": [
    {
      "name": "Core Gateway 1–9 list",
      "minQuantity": 1,
      "maxQuantity": 9,
      "adjustmentKind": "fixed",
      "adjustmentValue": 4000
    }
  ],
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Zod reject (missing name, bad UUID, >100 items) |
| 403 | `AUTHORIZATION_ERROR` | Not catalog.write (staff cannot) |

**Notes.** `adjustmentKind` is `fixed` (unit price) or `percent`. Seeded Core Gateway 1–9 is fixed 4000 so ×8 stays at list.

### Replace role authorities

**Purpose.** Replace discount ceilings used on writes (1–20 items).

| Item | Value |
| --- | --- |
| Method | `PUT` |
| Path | `/api/v1/dealflow/catalog/role-authorities` |
| Auth | Bearer or cookie |
| Permission | `dealflow.catalog.write` |
| UI | /dealflow/settings |
| Service | `replaceRoleAuthorities` |
| Persistence | df_role_authorities |

**Request**

```http
PUT /api/v1/dealflow/catalog/role-authorities HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "items": [
    {
      "roleKey": "staff",
      "maxDiscountPercent": 5,
      "minMarginPercent": 20,
      "maxPriceOverridePercent": 0,
      "canNegotiate": true,
      "exceedAction": "block"
    }
  ]
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": [
    {
      "roleKey": "staff",
      "maxDiscountPercent": 5,
      "exceedAction": "block"
    }
  ],
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Empty items or percent out of 0–100 |
| 403 | `AUTHORIZATION_ERROR` | Not catalog.write |

**Notes.** `exceedAction` enum: allow | approval | block. Seeded staff is block at 5%. Admin writes still match staff/manager/finance keys, not a hidden 40%.

### Patch governance

**Purpose.** Update material-change thresholds, tax, stale days, commercial cap, loyalty stacking.

| Item | Value |
| --- | --- |
| Method | `PATCH` |
| Path | `/api/v1/dealflow/catalog/governance` |
| Auth | Bearer or cookie |
| Permission | `dealflow.catalog.write` |
| UI | /dealflow/settings |
| Service | `updateGovernance` |
| Persistence | df_governance_config |

**Request**

```http
PATCH /api/v1/dealflow/catalog/governance HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "taxRatePercent": 0,
  "cumulativeWarningLimit": 2,
  "maxCommercialDiscountPercent": 25,
  "allowLoyaltyStacking": true
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "cumulativeWarningLimit": 2,
    "materialDiscountDeltaPp": 2,
    "materialTotalDeltaRatio": 0.1,
    "highValueNetTotal": 25000,
    "maxApprovalLevels": 3,
    "taxRatePercent": 0,
    "staleQuoteDays": 7,
    "unusualDiscountPercent": 25,
    "largeDealNetTotal": 50000,
    "maxCommercialDiscountPercent": 25,
    "allowLoyaltyStacking": true
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Empty patch or maxApprovalLevels outside 1–3 |
| 403 | `AUTHORIZATION_ERROR` | Not catalog.write |

**Notes.** At least one field required. Defaults live in `DEFAULT_GOVERNANCE` (`types.ts`).

### Create product

**Purpose.** Create a SKU. Recurring products require `billingFrequency`.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/catalog/products` |
| Auth | Bearer or cookie |
| Permission | `dealflow.catalog.products.write` |
| UI | /dealflow/catalog |
| Service | `upsertProduct` |
| Persistence | df_products |

**Request**

```http
POST /api/v1/dealflow/catalog/products HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "sku": "HW-DEMO-9",
  "name": "Demo Appliance",
  "category": "hardware",
  "listPrice": 1000,
  "cost": 400,
  "billingType": "one_time",
  "taxable": true,
  "active": true
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "sku": "HW-DEMO-9",
    "name": "Demo Appliance",
    "billingType": "one_time",
    "listPrice": 1000
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Recurring without frequency; SKU empty |
| 403 | `AUTHORIZATION_ERROR` | Finance/manager without products.write |
| 409 | `CONFLICT` | Duplicate SKU |

**Notes.** 201 on create. Staff and admin hold products.write. Optional nested `stock` (max 20) and `quantityBreaks` (max 20).

### Patch product

**Purpose.** Update an existing product by `id`.

| Item | Value |
| --- | --- |
| Method | `PATCH` |
| Path | `/api/v1/dealflow/catalog/products` |
| Auth | Bearer or cookie |
| Permission | `dealflow.catalog.products.write` |
| UI | /dealflow/catalog/products/:productId |
| Service | `upsertProduct` |
| Persistence | df_products |

**Request**

```http
PATCH /api/v1/dealflow/catalog/products HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  "name": "Core Gateway",
  "active": true
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
    "sku": "HW-CORE-1"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Missing id UUID |
| 404 | `NOT_FOUND` | Unknown product |

### Delete product

**Purpose.** Remove a SKU when the store allows it (typically unused).

| Item | Value |
| --- | --- |
| Method | `DELETE` |
| Path | `/api/v1/dealflow/catalog/products/:id` |
| Auth | Bearer or cookie |
| Permission | `dealflow.catalog.products.write` |
| UI | Product detail deactivate/delete controls |
| Service | `deleteProduct` |
| Persistence | df_products |

**Request**

```http
DELETE /api/v1/dealflow/catalog/products/:id HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

No JSON body (empty object allowed where `expectedVersion` is optional).

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa9",
    "deleted": true
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | id not UUID |
| 409 | `CONFLICT` | Product is referenced by quote lines |

### Create customer

**Purpose.** Add a buying account. Public `/register` also provisions via `user.created`.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/catalog/customers` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.write` |
| UI | Quote create customer picker / catalog |
| Service | `upsertCustomer` |
| Persistence | df_customers |

**Request**

```http
POST /api/v1/dealflow/catalog/customers HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "name": "Northwind Retail",
  "email": "buyer@example.com",
  "tier": "standard"
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "name": "Northwind Retail",
    "email": "buyer@example.com",
    "tier": "standard"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Invalid email |
| 403 | `AUTHORIZATION_ERROR` | Finance without quotes.write |

**Notes.** 201 on create. Loyalty `new` is persisted as `standard`.

### Patch customer

**Purpose.** Update name, email, or stored tier.

| Item | Value |
| --- | --- |
| Method | `PATCH` |
| Path | `/api/v1/dealflow/catalog/customers` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.write` |
| UI | Catalog |
| Service | `upsertCustomer` |
| Persistence | df_customers |

**Request**

```http
PATCH /api/v1/dealflow/catalog/customers HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "id": "11111111-1111-4111-8111-111111111111",
  "name": "Northwind Retail"
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "id": "11111111-1111-4111-8111-111111111111",
    "name": "Northwind Retail"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Missing id |

### Delete customer

**Purpose.** Delete a customer not required by live quotes (restrict FK).

| Item | Value |
| --- | --- |
| Method | `DELETE` |
| Path | `/api/v1/dealflow/catalog/customers/:id` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.write` |
| UI | Catalog |
| Service | `deleteCustomer` |
| Persistence | df_customers |

**Request**

```http
DELETE /api/v1/dealflow/catalog/customers/:id HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

No JSON body (empty object allowed where `expectedVersion` is optional).

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "id": "11111111-1111-4111-8111-111111111111",
    "deleted": true
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 409 | `CONFLICT` | Quotes still reference the customer (onDelete Restrict) |

### Create warehouse

**Purpose.** Add a fulfillment location with per-unit cost.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/catalog/warehouses` |
| Auth | Bearer or cookie |
| Permission | `dealflow.catalog.write` |
| UI | /dealflow/settings, fulfillment |
| Service | `upsertWarehouse` |
| Persistence | df_warehouses |

**Request**

```http
POST /api/v1/dealflow/catalog/warehouses HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "name": "West DC",
  "fulfillmentCostPerUnit": 18
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "name": "West DC",
    "fulfillmentCostPerUnit": 18
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 403 | `AUTHORIZATION_ERROR` | Staff without catalog.write |

### Patch warehouse

**Purpose.** Rename or change fulfillment cost.

| Item | Value |
| --- | --- |
| Method | `PATCH` |
| Path | `/api/v1/dealflow/catalog/warehouses` |
| Auth | Bearer or cookie |
| Permission | `dealflow.catalog.write` |
| UI | Settings |
| Service | `upsertWarehouse` |
| Persistence | df_warehouses |

**Request**

```http
PATCH /api/v1/dealflow/catalog/warehouses HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
  "fulfillmentCostPerUnit": 18
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
    "name": "West DC"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Missing id |

### Delete warehouse

**Purpose.** Remove a DC (cascades stock rows).

| Item | Value |
| --- | --- |
| Method | `DELETE` |
| Path | `/api/v1/dealflow/catalog/warehouses/:id` |
| Auth | Bearer or cookie |
| Permission | `dealflow.catalog.write` |
| UI | Settings |
| Service | `deleteWarehouse` |
| Persistence | df_warehouses |

**Request**

```http
DELETE /api/v1/dealflow/catalog/warehouses/:id HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

No JSON body (empty object allowed where `expectedVersion` is optional).

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb9",
    "deleted": true
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 409 | `CONFLICT` | Allocations still reference the warehouse |

### Create product relation

**Purpose.** Upsell or cross-sell edge from a source SKU.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/catalog/relations` |
| Auth | Bearer or cookie |
| Permission | `dealflow.catalog.write` |
| UI | Product detail / recommendations on quote |
| Service | `upsertRelation` |
| Persistence | df_product_relations |

**Request**

```http
POST /api/v1/dealflow/catalog/relations HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "productId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  "recommendedProductId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  "kind": "cross_sell",
  "reason": "Edge sensors complete gateway deployments",
  "promotion": "Bundle 5% after add",
  "minQuantity": 1
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "kind": "cross_sell",
    "reason": "Edge sensors complete gateway deployments"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | kind not upsell|cross_sell |

### Patch product relation

**Purpose.** Edit recommendation copy or min quantity.

| Item | Value |
| --- | --- |
| Method | `PATCH` |
| Path | `/api/v1/dealflow/catalog/relations` |
| Auth | Bearer or cookie |
| Permission | `dealflow.catalog.write` |
| UI | Catalog |
| Service | `upsertRelation` |
| Persistence | df_product_relations |

**Request**

```http
PATCH /api/v1/dealflow/catalog/relations HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "id": "eeeeeee1-eeee-4eee-8eee-eeeeeeeeeee1",
  "reason": "Edge sensors complete gateway deployments"
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "id": "eeeeeee1-eeee-4eee-8eee-eeeeeeeeeee1",
    "kind": "cross_sell"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Missing id |

### Delete product relation

**Purpose.** Remove a recommendation edge.

| Item | Value |
| --- | --- |
| Method | `DELETE` |
| Path | `/api/v1/dealflow/catalog/relations/:id` |
| Auth | Bearer or cookie |
| Permission | `dealflow.catalog.write` |
| UI | Catalog |
| Service | `deleteRelation` |
| Persistence | df_product_relations |

**Request**

```http
DELETE /api/v1/dealflow/catalog/relations/:id HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

No JSON body (empty object allowed where `expectedVersion` is optional).

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "id": "eeeeeee1-eeee-4eee-8eee-eeeeeeeeeee1",
    "deleted": true
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 404 | `NOT_FOUND` | Unknown relation |

### Upsert stock

**Purpose.** Set on-hand / reserved / incoming for a warehouse+product pair.

| Item | Value |
| --- | --- |
| Method | `PUT` |
| Path | `/api/v1/dealflow/catalog/stock` |
| Auth | Bearer or cookie |
| Permission | `dealflow.catalog.products.write` |
| UI | Product detail stock editor |
| Service | `upsertStock` |
| Persistence | df_stock_levels |

**Request**

```http
PUT /api/v1/dealflow/catalog/stock HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "warehouseId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
  "productId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  "quantityOnHand": 4,
  "reserved": 0,
  "incoming": 6
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": [
    {
      "warehouseId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      "quantityOnHand": 4,
      "reserved": 0
    }
  ],
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Negative on-hand |

**Notes.** Body reserved/incoming default to 0 in the route if omitted. Available for planning is on-hand minus reserved.

### Delete stock row

**Purpose.** Remove a stock level composite key.

| Item | Value |
| --- | --- |
| Method | `DELETE` |
| Path | `/api/v1/dealflow/catalog/stock/:warehouseId/:productId` |
| Auth | Bearer or cookie |
| Permission | `dealflow.catalog.products.write` |
| UI | Product detail |
| Service | `deleteStock` |
| Persistence | df_stock_levels |

**Request**

```http
DELETE /api/v1/dealflow/catalog/stock/:warehouseId/:productId HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

No JSON body (empty object allowed where `expectedVersion` is optional).

**Success envelope (shape)**

```json
{
  "success": true,
  "data": [],
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Path params not UUIDs |

### Create discount policy

**Purpose.** Add a warning/approval/reject policy. Null tier/category means broader match.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/catalog/policies` |
| Auth | Bearer or cookie |
| Permission | `dealflow.catalog.write` |
| UI | /dealflow/catalog/policies |
| Service | `upsertPolicy` |
| Persistence | df_discount_policies |

**Request**

```http
POST /api/v1/dealflow/catalog/policies HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "name": "Default ceiling",
  "warningPercent": 3,
  "approvalPercent": 5,
  "rejectPercent": 25,
  "maxMarginImpactPercent": 40,
  "priority": 100,
  "active": true
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "name": "Default ceiling",
    "warningPercent": 3,
    "approvalPercent": 5,
    "rejectPercent": 25
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 403 | `AUTHORIZATION_ERROR` | Not catalog.write |

### Patch discount policy

**Purpose.** Change ceilings or priority.

| Item | Value |
| --- | --- |
| Method | `PATCH` |
| Path | `/api/v1/dealflow/catalog/policies` |
| Auth | Bearer or cookie |
| Permission | `dealflow.catalog.write` |
| UI | Discount policies page |
| Service | `upsertPolicy` |
| Persistence | df_discount_policies |

**Request**

```http
PATCH /api/v1/dealflow/catalog/policies HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "id": "ccccccc1-cccc-4ccc-8ccc-ccccccccccc4",
  "warningPercent": 3
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "id": "ccccccc1-cccc-4ccc-8ccc-ccccccccccc4",
    "name": "Default ceiling"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Missing id |

### Delete discount policy

**Purpose.** Remove a policy. Assessment falls through to remaining matches or implicit default.

| Item | Value |
| --- | --- |
| Method | `DELETE` |
| Path | `/api/v1/dealflow/catalog/policies/:id` |
| Auth | Bearer or cookie |
| Permission | `dealflow.catalog.write` |
| UI | Discount policies page |
| Service | `deletePolicy` |
| Persistence | df_discount_policies |

**Request**

```http
DELETE /api/v1/dealflow/catalog/policies/:id HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

No JSON body (empty object allowed where `expectedVersion` is optional).

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "id": "ccccccc1-cccc-4ccc-8ccc-ccccccccccc4",
    "deleted": true
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 404 | `NOT_FOUND` | Unknown policy |

### Create approval chain

**Purpose.** Define an ordered 1–3 step chain with roleKey manager|finance|final.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/catalog/chains` |
| Auth | Bearer or cookie |
| Permission | `dealflow.catalog.write` |
| UI | Discount policies / settings |
| Service | `upsertChain` |
| Persistence | df_approval_chains, df_approval_chain_steps |

**Request**

```http
POST /api/v1/dealflow/catalog/chains HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "name": "Sales Manager",
  "minRiskScore": 0,
  "minBlendedDiscountPercent": 5,
  "priority": 30,
  "steps": [
    {
      "stepOrder": 1,
      "roleKey": "manager",
      "label": "Sales Manager"
    }
  ]
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "name": "Sales Manager",
    "steps": [
      {
        "roleKey": "manager"
      }
    ]
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | steps empty or >3; invalid roleKey |

### Patch approval chain

**Purpose.** Replace steps and thresholds for an existing chain id.

| Item | Value |
| --- | --- |
| Method | `PATCH` |
| Path | `/api/v1/dealflow/catalog/chains` |
| Auth | Bearer or cookie |
| Permission | `dealflow.catalog.write` |
| UI | Settings |
| Service | `upsertChain` |
| Persistence | df_approval_chains |

**Request**

```http
PATCH /api/v1/dealflow/catalog/chains HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "id": "ddddddd1-dddd-4ddd-8ddd-ddddddddddd1",
  "name": "Sales Manager",
  "minRiskScore": 0,
  "minBlendedDiscountPercent": 5,
  "priority": 30,
  "steps": [
    {
      "stepOrder": 1,
      "roleKey": "manager",
      "label": "Sales Manager"
    }
  ]
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "id": "ddddddd1-dddd-4ddd-8ddd-ddddddddddd1"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Missing id |

### Delete approval chain

**Purpose.** Remove a chain definition.

| Item | Value |
| --- | --- |
| Method | `DELETE` |
| Path | `/api/v1/dealflow/catalog/chains/:id` |
| Auth | Bearer or cookie |
| Permission | `dealflow.catalog.write` |
| UI | Settings |
| Service | `deleteChain` |
| Persistence | df_approval_chains |

**Request**

```http
DELETE /api/v1/dealflow/catalog/chains/:id HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

No JSON body (empty object allowed where `expectedVersion` is optional).

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "id": "ddddddd1-dddd-4ddd-8ddd-ddddddddddd1",
    "deleted": true
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 409 | `CONFLICT` | Quotes still point at requiredChainId |

### List my quotes (customer)

**Purpose.** Portal DTOs plus tokens for the signed-in buyer.

| Item | Value |
| --- | --- |
| Method | `GET` |
| Path | `/api/v1/dealflow/me/quotes` |
| Auth | Bearer or cookie |
| Permission | Authenticated (no staff read key required) |
| UI | /account |
| Service | `listMyQuotes` |
| Persistence | df_quotes (filtered by customer email/account) |

**Request**

```http
GET /api/v1/dealflow/me/quotes HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

No JSON body (empty object allowed where `expectedVersion` is optional).

**Success envelope (shape)**

```json
{
  "success": true,
  "data": [
    {
      "number": "DF-00001",
      "portalToken": "<token>",
      "customer": {
        "name": "Northwind Retail"
      }
    }
  ],
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 401 | `AUTHENTICATION_ERROR` | Anonymous |

**Notes.** Uses `http.authenticate` only. Staff listing is `GET /quotes`.

### List quotes (staff)

**Purpose.** Full staff quote views including risk internals.

| Item | Value |
| --- | --- |
| Method | `GET` |
| Path | `/api/v1/dealflow/quotes` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.read` |
| UI | /dealflow/quotes, dashboard aggregations |
| Service | `listQuotes` |
| Persistence | df_quotes |

**Request**

```http
GET /api/v1/dealflow/quotes HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

No JSON body (empty object allowed where `expectedVersion` is optional).

**Success envelope (shape)**

```json
{
  "success": true,
  "data": [
    {
      "number": "DF-00002",
      "status": "draft",
      "riskScore": 0
    }
  ],
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 401 | `AUTHENTICATION_ERROR` | Anonymous |
| 403 | `AUTHORIZATION_ERROR` | Customer role without quotes.read |

### Create quote

**Purpose.** Create a draft with optional initial lines. Issues unique `number` and `portalToken`.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.write` |
| UI | New quotation on /dealflow/quotes |
| Service | `createQuote` |
| Persistence | df_quotes, df_quote_lines |

**Request**

```http
POST /api/v1/dealflow/quotes HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "customerId": "11111111-1111-4111-8111-111111111111",
  "lines": [
    {
      "productId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
      "quantity": 8,
      "discountPercent": 5
    }
  ]
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "number": "DF-00010",
    "status": "draft",
    "version": 1,
    "portalToken": "<unguessable>"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | customerId not UUID; discount > 100 |
| 403 | `AUTHORIZATION_ERROR` | Finance without write; or staff discount above ceiling on included lines |

**Notes.** 201. Lines optional. Discount on create still hits role ceiling.

### Get quote

**Purpose.** Full aggregate: lines, assessment, approvals, splits, schedules, negotiations, emails.

| Item | Value |
| --- | --- |
| Method | `GET` |
| Path | `/api/v1/dealflow/quotes/:id` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.read` |
| UI | /dealflow/quotes/:quoteId |
| Service | `getQuote` |
| Persistence | df_quotes and children |

**Request**

```http
GET /api/v1/dealflow/quotes/:id HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

No JSON body (empty object allowed where `expectedVersion` is optional).

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "id": "<uuid>",
    "number": "DF-00010",
    "status": "draft",
    "lines": [],
    "approvals": []
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | id not UUID |
| 404 | `NOT_FOUND` | Unknown quote |

### Delete quote

**Purpose.** Delete only from `draft` or `rejected` (`canDeleteQuote`).

| Item | Value |
| --- | --- |
| Method | `DELETE` |
| Path | `/api/v1/dealflow/quotes/:id` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.write` |
| UI | Workspace delete |
| Service | `deleteQuote` |
| Persistence | df_quotes (cascade children) |

**Request**

```http
DELETE /api/v1/dealflow/quotes/:id HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "expectedVersion": 1
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "id": "<uuid>",
    "deleted": true
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 409 | `CONFLICT` | Wrong version or illegal status |

### Void quote

**Purpose.** Void in-flight quotes (negotiation through finalized/approved).

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes/:id/void` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.write` |
| UI | Workspace |
| Service | `voidQuote` |
| Persistence | df_quotes.status |

**Request**

```http
POST /api/v1/dealflow/quotes/:id/void HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "expectedVersion": 2
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "status": "rejected"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 409 | `CONFLICT` | Status not voidable (draft already uses delete; confirmed uses other paths) |

### Add line

**Purpose.** Add a SKU line. `expectedVersion` required.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes/:id/lines` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.write` |
| UI | Quote workspace |
| Service | `addLine` |
| Persistence | df_quote_lines |

**Request**

```http
POST /api/v1/dealflow/quotes/:id/lines HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "productId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
  "quantity": 1,
  "discountPercent": 5,
  "expectedVersion": 1
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "version": 2,
    "lines": [
      {
        "quantity": 1,
        "discountPercent": 5
      }
    ]
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 403 | `AUTHORIZATION_ERROR` | Discount above role ceiling |
| 409 | `CONFLICT` | Frozen commercials or stale version |

### Patch line

**Purpose.** Change qty, discount, product, or unitPrice. At least one commercial field plus expectedVersion.

| Item | Value |
| --- | --- |
| Method | `PATCH` |
| Path | `/api/v1/dealflow/quotes/:id/lines/:lineId` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.write` |
| UI | Quote workspace |
| Service | `updateLine` |
| Persistence | df_quote_lines |

**Request**

```http
PATCH /api/v1/dealflow/quotes/:id/lines/:lineId HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "discountPercent": 5,
  "expectedVersion": 2
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "version": 3,
    "lines": [
      {
        "discountPercent": 5
      }
    ]
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | No commercial field besides version |
| 403 | `AUTHORIZATION_ERROR` | Staff 8% write |
| 409 | `CONFLICT` | Locked or not commercially mutable |

**Notes.** unitPrice is a governed override; assessments may flag “Unit price override”.

### Remove line

**Purpose.** Drop a line from a mutable quote.

| Item | Value |
| --- | --- |
| Method | `DELETE` |
| Path | `/api/v1/dealflow/quotes/:id/lines/:lineId` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.write` |
| UI | Quote workspace |
| Service | `removeLine` |
| Persistence | df_quote_lines |

**Request**

```http
DELETE /api/v1/dealflow/quotes/:id/lines/:lineId HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "expectedVersion": 3
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "version": 4,
    "lines": []
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 409 | `CONFLICT` | Stale version or frozen |

### Assess quote

**Purpose.** Run discount, risk, tax, chain selection without submitting.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes/:id/assess` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.write` |
| UI | Workspace risk panel |
| Service | `assess` |
| Persistence | df_quotes assessment fields |

**Request**

```http
POST /api/v1/dealflow/quotes/:id/assess HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

No JSON body (empty object allowed where `expectedVersion` is optional).

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "assessmentDecision": "warning",
    "riskScore": 12.5,
    "blendedDiscountPercent": 5,
    "requiredChainId": "<uuid>"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 404 | `NOT_FOUND` | Unknown quote |

### Submit quote

**Purpose.** Enter the approval engine. Only from `finalized`. Staff cannot approve the steps they just opened.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes/:id/submit` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.write` |
| UI | Workspace Submit |
| Service | `submit` |
| Persistence | df_quote_approvals |

**Request**

```http
POST /api/v1/dealflow/quotes/:id/submit HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

No JSON body (empty object allowed where `expectedVersion` is optional).

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "status": "approval_required",
    "approvals": [
      {
        "status": "pending",
        "roleKey": "manager"
      }
    ]
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 409 | `CONFLICT` | Not finalized |
| 403 | `AUTHORIZATION_ERROR` | No write |

### Decide approval step

**Purpose.** Approve or reject a pending step with a reason (1–500 chars).

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes/:id/approvals/:approvalId/decide` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.approve` plus step key via `canActOnRole` |
| UI | /dealflow/approvals/:quoteId |
| Service | `decide` |
| Persistence | df_quote_approvals |

**Request**

```http
POST /api/v1/dealflow/quotes/:id/approvals/:approvalId/decide HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "decision": "approved",
  "reason": "Within manager authority after revision"
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "approvals": [
      {
        "status": "approved",
        "roleKey": "manager"
      }
    ]
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 403 | `AUTHORIZATION_ERROR` | Staff; or wrong step role |
| 409 | `CONFLICT` | Step not pending |

**Notes.** Manager approval of a negotiated quote triggers provisional customer email. Admin may act on any step.

### Start negotiation (staff)

**Purpose.** Move a quote into customer_negotiation from staff side.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes/:id/negotiate` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.write` |
| UI | Workspace |
| Service | `startNegotiation` |
| Persistence | df_quotes.status |

**Request**

```http
POST /api/v1/dealflow/quotes/:id/negotiate HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

No JSON body (empty object allowed where `expectedVersion` is optional).

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "status": "customer_negotiation"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 409 | `CONFLICT` | Illegal transition |

### List negotiations

**Purpose.** Staff thread of negotiation requests.

| Item | Value |
| --- | --- |
| Method | `GET` |
| Path | `/api/v1/dealflow/quotes/:id/negotiations` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.read` |
| UI | /dealflow/negotiations, workspace |
| Service | `listNegotiationRequests` |
| Persistence | df_negotiation_requests |

**Request**

```http
GET /api/v1/dealflow/quotes/:id/negotiations HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

No JSON body (empty object allowed where `expectedVersion` is optional).

**Success envelope (shape)**

```json
{
  "success": true,
  "data": [
    {
      "status": "open",
      "note": "Please consider 8% on hardware",
      "requestedDiscountPercent": 8
    }
  ],
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 404 | `NOT_FOUND` | Unknown quote |

### Create negotiation (authenticated)

**Purpose.** Persist a request note. Used by linked customer sessions; portal has its own path.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes/:id/negotiations` |
| Auth | Bearer or cookie |
| Permission | Authenticated (route does not require quotes.write) |
| UI | Portal / account |
| Service | `createNegotiationRequest` |
| Persistence | df_negotiation_requests |

**Request**

```http
POST /api/v1/dealflow/quotes/:id/negotiations HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "expectedVersion": 2,
  "note": "Need a higher discount on Core Gateway",
  "requestedDiscountPercent": 8,
  "requestedLines": [
    {
      "lineId": "<uuid>",
      "discountPercent": 8,
      "requestType": "discount",
      "comment": "Budget cap"
    }
  ]
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "status": "customer_negotiation",
    "negotiations": [
      {
        "status": "open"
      }
    ]
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Empty note |

**Notes.** 201. Requested discount is stored, not applied.

### Respond to negotiation

**Purpose.** Staff accept/reject/in_review with a required responseNote.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes/:id/negotiations/:nid/respond` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.write` |
| UI | Negotiations page |
| Service | `respondToNegotiation` |
| Persistence | df_negotiation_requests |

**Request**

```http
POST /api/v1/dealflow/quotes/:id/negotiations/:nid/respond HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "expectedVersion": 3,
  "decision": "in_review",
  "responseNote": "Sending to manager; 8% exceeds my ceiling."
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "negotiations": [
      {
        "status": "in_review",
        "responseNote": "Sending to manager; 8% exceeds my ceiling."
      }
    ]
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Missing responseNote |

### Send negotiation to manager

**Purpose.** Escalate a specific request. Quote status becomes manager_review.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes/:id/negotiations/:nid/send-to-manager` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.write` |
| UI | Negotiations |
| Service | `sendNegotiationToManager` |
| Persistence | df_quotes, df_negotiation_requests |

**Request**

```http
POST /api/v1/dealflow/quotes/:id/negotiations/:nid/send-to-manager HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "expectedVersion": 4
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "status": "manager_review"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 409 | `CONFLICT` | Illegal status or stale version |

### Send quote to manager (no nid)

**Purpose.** Escalate the active negotiation without a path nid.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes/:id/send-to-manager` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.write` |
| UI | Workspace |
| Service | `sendNegotiationToManager` |
| Persistence | df_quotes |

**Request**

```http
POST /api/v1/dealflow/quotes/:id/send-to-manager HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "expectedVersion": 4
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "status": "manager_review"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 409 | `CONFLICT` | No active negotiation / bad status |

### Manager revise

**Purpose.** Replace line qty/discount/product. Higher role replaces prior discount, it does not add.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes/:id/revise` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.write` (manager ceiling applies) |
| UI | Workspace as manager |
| Service | `reviseAsManager` |
| Persistence | df_quote_lines, df_quote_revisions |

**Request**

```http
POST /api/v1/dealflow/quotes/:id/revise HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "expectedVersion": 5,
  "lines": [
    {
      "lineId": "<uuid>",
      "discountPercent": 10
    }
  ]
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "lines": [
      {
        "discountPercent": 10
      }
    ],
    "version": 6
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 403 | `AUTHORIZATION_ERROR` | Staff calling revise above 5% |
| 409 | `CONFLICT` | Stale version |

### Return revised quote

**Purpose.** Send the revised commercial back toward the customer (optional nid variant exists).

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes/:id/return` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.write` |
| UI | Workspace |
| Service | `returnRevisedQuote` |
| Persistence | df_quotes |

**Request**

```http
POST /api/v1/dealflow/quotes/:id/return HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "expectedVersion": 6
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "status": "customer_negotiation"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 409 | `CONFLICT` | Not in manager_review |

### Return revised quote (with nid)

**Purpose.** Same as `/return` scoped to one request id.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes/:id/negotiations/:nid/return` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.write` |
| UI | Negotiations |
| Service | `returnRevisedQuote` |
| Persistence | df_negotiation_requests |

**Request**

```http
POST /api/v1/dealflow/quotes/:id/negotiations/:nid/return HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "expectedVersion": 6
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "negotiations": [
      {
        "status": "returned_to_customer"
      }
    ]
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 409 | `CONFLICT` | Unknown nid or bad status |

### Agree to final (authenticated)

**Purpose.** Customer confirms a specific version. Blocked while a request is open/in review/with manager. Does not skip approval.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes/:id/agree` |
| Auth | Bearer or cookie |
| Permission | Authenticated |
| UI | Portal / account |
| Service | `agreeToFinal` |
| Persistence | df_quotes customerDecision* |

**Request**

```http
POST /api/v1/dealflow/quotes/:id/agree HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "expectedVersion": 6
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "customerDecision": "accepted",
    "customerDecisionVersion": 6
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 409 | `CONFLICT` | Open negotiation or version mismatch |

### Finalize

**Purpose.** Manager freeze. Stamps commerciallyFrozenAt. Required before submit.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes/:id/finalize` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.write` |
| UI | Workspace Finalize |
| Service | `finalizeQuotation` |
| Persistence | df_quotes |

**Request**

```http
POST /api/v1/dealflow/quotes/:id/finalize HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "expectedVersion": 6
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "status": "finalized",
    "commerciallyFrozenAt": "<iso>"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 409 | `CONFLICT` | Not in a finalizable status |

### Finance lock

**Purpose.** Move approved quote to confirmed, stamp financeLockedAt, consume allocated stock, email final bill.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes/:id/lock` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.lock` |
| UI | Workspace Lock |
| Service | `lockDeal` |
| Persistence | df_quotes, df_stock_levels, df_quote_email_deliveries |

**Request**

```http
POST /api/v1/dealflow/quotes/:id/lock HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "expectedVersion": 7
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "status": "confirmed",
    "financeLockedAt": "<iso>"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 403 | `AUTHORIZATION_ERROR` | Staff or manager without lock |
| 409 | `CONFLICT` | Not approved / stale version |

### Confirm (alias of lock)

**Purpose.** Same handler as lock (`lockDeal`).

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes/:id/confirm` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.lock` |
| UI | Same as lock |
| Service | `lockDeal` |
| Persistence | df_quotes |

**Request**

```http
POST /api/v1/dealflow/quotes/:id/confirm HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "expectedVersion": 7
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "status": "confirmed"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 403 | `AUTHORIZATION_ERROR` | No lock permission |

### List recommendations

**Purpose.** Catalog-relation suggestions for lines on the quote (not an LLM).

| Item | Value |
| --- | --- |
| Method | `GET` |
| Path | `/api/v1/dealflow/quotes/:id/recommendations` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.read` |
| UI | Workspace after lock in golden path |
| Service | `recommendations` |
| Persistence | df_product_relations (read) |

**Request**

```http
GET /api/v1/dealflow/quotes/:id/recommendations HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

No JSON body (empty object allowed where `expectedVersion` is optional).

**Success envelope (shape)**

```json
{
  "success": true,
  "data": [
    {
      "relationId": "eeeeeee1-eeee-4eee-8eee-eeeeeeeeeee1",
      "kind": "cross_sell",
      "sku": "HW-EDGE-2"
    }
  ],
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 404 | `NOT_FOUND` | Unknown quote |

### Apply recommendation

**Purpose.** Add the recommended SKU as a line with recommendation source stamped.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes/:id/recommendations` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.write` |
| UI | Workspace |
| Service | `applyRecommendation` |
| Persistence | df_quote_lines |

**Request**

```http
POST /api/v1/dealflow/quotes/:id/recommendations HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "relationId": "eeeeeee1-eeee-4eee-8eee-eeeeeeeeeee1",
  "expectedVersion": 8
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "lines": [
      {
        "recommendedFromId": "<product-id>"
      }
    ]
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 409 | `CONFLICT` | Not open for planning/commercial rules of the service |

### Plan fulfillment

**Purpose.** Allocate warehouses; remainder becomes backorder. Overrides must fit available stock.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes/:id/fulfillment/plan` |
| Auth | Bearer or cookie |
| Permission | `dealflow.fulfillment.write` |
| UI | /dealflow/fulfillment/:quoteId |
| Service | `planFulfillment` |
| Persistence | df_quote_fulfillment_splits, df_quote_backorders |

**Request**

```http
POST /api/v1/dealflow/quotes/:id/fulfillment/plan HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "expectedVersion": 9,
  "overrides": [
    {
      "quoteLineId": "<uuid>",
      "warehouseId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1",
      "quantity": 4
    }
  ]
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "allocations": [
      {
        "warehouseName": "West DC",
        "quantity": 4
      },
      {
        "warehouseName": "East DC",
        "quantity": 3
      }
    ],
    "backorders": [
      {
        "quantity": 1
      }
    ]
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 409 | `CONFLICT` | Insufficient available; quote not confirmed/fulfillment |

**Notes.** Seeded Core Gateway: West 4, East 3. Qty 8 → backorder 1. Finance lock consumes allocated (not backorder).

### Generate billing

**Purpose.** Write one-time and recurring schedules. Does not capture payment.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes/:id/billing/generate` |
| Auth | Bearer or cookie |
| Permission | `dealflow.billing.write` |
| UI | /dealflow/invoices/:quoteId, /dealflow/subscriptions/:quoteId |
| Service | `generateBilling` |
| Persistence | df_quote_billing_schedules |

**Request**

```http
POST /api/v1/dealflow/quotes/:id/billing/generate HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "expectedVersion": 10
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "schedules": [
      {
        "kind": "one_time"
      },
      {
        "kind": "recurring",
        "frequency": "monthly"
      }
    ]
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 409 | `CONFLICT` | Not open for billing |

### Cancel billing schedule

**Purpose.** Mark a schedule cancelled.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes/:id/billing/:scheduleId/cancel` |
| Auth | Bearer or cookie |
| Permission | `dealflow.billing.write` |
| UI | Billing detail |
| Service | `cancelBilling` |
| Persistence | df_quote_billing_schedules |

**Request**

```http
POST /api/v1/dealflow/quotes/:id/billing/:scheduleId/cancel HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "expectedVersion": 11
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "schedules": [
      {
        "status": "cancelled"
      }
    ]
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 409 | `CONFLICT` | Already cancelled or stale version |

### Vendor contact

**Purpose.** Record a vendor outreach note. Client maps response as audit channel, not email send.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes/:id/vendor-contact` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.write` |
| UI | Fulfillment / workspace |
| Service | `contactVendor` |
| Persistence | Audit (kit), not a mail provider |

**Request**

```http
POST /api/v1/dealflow/quotes/:id/vendor-contact HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "productId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  "message": "Need inbound date for backorder qty 1"
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "recorded": true,
    "delivered": false,
    "channel": "audit",
    "quoteId": "<uuid>"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Empty message or >1000 chars |

**Notes.** `delivered: false` is intentional in the frontend type. This is not SMTP.

### Complete quote

**Purpose.** Move confirmed/fulfillment/billing to completed when the service allows.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/quotes/:id/complete` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.write` |
| UI | Fulfillment complete deal |
| Service | `complete` |
| Persistence | df_quotes |

**Request**

```http
POST /api/v1/dealflow/quotes/:id/complete HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "expectedVersion": 12
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "status": "completed"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 409 | `CONFLICT` | Illegal transition |

### Staff quotation PDF

**Purpose.** Customer-safe PDF (pdf-lib). Content-Type application/pdf.

| Item | Value |
| --- | --- |
| Method | `GET` |
| Path | `/api/v1/dealflow/quotes/:id/pdf` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.read` |
| UI | Workspace download |
| Service | `customerQuotePdf` |
| Persistence | Generated; uses live aggregate |

**Request**

```http
GET /api/v1/dealflow/quotes/:id/pdf HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

No JSON body (empty object allowed where `expectedVersion` is optional).

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "note": "Binary PDF, not JSON envelope"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 404 | `NOT_FOUND` | Unknown quote |

**Notes.** Not the standard JSON envelope. Filename header uses the quote id.

### List DealFlow anomalies

**Purpose.** Rule-based exceptions on live quotes (not FEATURE_ANOMALY_DETECTION).

| Item | Value |
| --- | --- |
| Method | `GET` |
| Path | `/api/v1/dealflow/anomalies` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.read` |
| UI | /dealflow/anomalies |
| Service | `listAnomalies` |
| Persistence | df_anomalies |

**Request**

```http
GET /api/v1/dealflow/anomalies HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

No JSON body (empty object allowed where `expectedVersion` is optional).

**Success envelope (shape)**

```json
{
  "success": true,
  "data": [
    {
      "type": "unusual_discount",
      "severity": "critical",
      "status": "open"
    }
  ],
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 403 | `AUTHORIZATION_ERROR` | No quotes.read |

### Dispose anomaly

**Purpose.** open | acknowledged | resolved | dismissed, optional resolution text.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/anomalies/:id/disposition` |
| Auth | Bearer or cookie |
| Permission | `dealflow.quotes.read` |
| UI | Anomaly center |
| Service | `disposeAnomaly` |
| Persistence | df_anomalies |

**Request**

```http
POST /api/v1/dealflow/anomalies/:id/disposition HTTP/1.1
Host: localhost:5000
Content-Type: application/json
Authorization: Bearer <ACCESS_TOKEN>
```

```json
{
  "status": "resolved",
  "resolution": "Manager documented the exception"
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "id": "<uuid>",
    "status": "resolved"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Invalid status enum |

### Portal GET

**Purpose.** Stripped commercial view. Unknown tokens 404.

| Item | Value |
| --- | --- |
| Method | `GET` |
| Path | `/api/v1/dealflow/portal/:token` |
| Auth | Portal token |
| Permission | Possession of token (min 16, max 128 chars) |
| UI | /portal/:token |
| Service | `getQuoteByToken + toPortalView` |
| Persistence | df_quotes.portal_token unique |

**Request**

```http
GET /api/v1/dealflow/portal/:token HTTP/1.1
Host: localhost:5000
Content-Type: application/json
```

No JSON body (empty object allowed where `expectedVersion` is optional).

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "number": "DF-00010",
    "listTotal": 34400,
    "netTotal": 32680,
    "blendedDiscountPercent": 5,
    "customer": {
      "name": "Northwind Retail"
    },
    "lines": [
      {
        "quantity": 8,
        "discountPercent": 5
      }
    ]
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Token too short |
| 404 | `NOT_FOUND` | Unknown token |
| 429 | `RATE_LIMIT` | Public limiter |

**Notes.** Must omit riskScore, approvals, fulfillment, billing ops, revisions, staff ids. Demo seed token: df-demo-portal-token-northwind-0001.

### Portal PATCH lines

**Purpose.** Customer qty/discount change on lines. May trigger material-change reapproval rules when applicable.

| Item | Value |
| --- | --- |
| Method | `PATCH` |
| Path | `/api/v1/dealflow/portal/:token` |
| Auth | Portal token |
| Permission | Token |
| UI | Portal |
| Service | `applyPortalChange` |
| Persistence | df_quote_lines |

**Request**

```http
PATCH /api/v1/dealflow/portal/:token HTTP/1.1
Host: localhost:5000
Content-Type: application/json
```

```json
{
  "expectedVersion": 1,
  "lines": [
    {
      "lineId": "<uuid>",
      "quantity": 8,
      "discountPercent": 5
    }
  ]
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "version": 2,
    "lines": [
      {
        "quantity": 8
      }
    ]
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 409 | `CONFLICT` | Stale version or not mutable |

### Portal create negotiation

**Purpose.** Submit request. expectedVersion required on portal schema.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/portal/:token/negotiations` |
| Auth | Portal token |
| Permission | Token |
| UI | Portal Submit request |
| Service | `createPortalNegotiation` |
| Persistence | df_negotiation_requests |

**Request**

```http
POST /api/v1/dealflow/portal/:token/negotiations HTTP/1.1
Host: localhost:5000
Content-Type: application/json
```

```json
{
  "expectedVersion": 2,
  "note": "Please review 8% on hardware",
  "requestedDiscountPercent": 8
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "status": "customer_negotiation",
    "negotiations": [
      {
        "status": "open"
      }
    ]
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Note empty; expectedVersion missing |

**Notes.** 201. Discount not applied.

### Portal agree

**Purpose.** Confirm revision as actor `{ id: portal, role: user }`.

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/portal/:token/agree` |
| Auth | Portal token |
| Permission | Token |
| UI | Portal Confirm quotation |
| Service | `agreeToFinal via token lookup` |
| Persistence | df_quotes |

**Request**

```http
POST /api/v1/dealflow/portal/:token/agree HTTP/1.1
Host: localhost:5000
Content-Type: application/json
```

```json
{
  "expectedVersion": 6
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "customerDecision": "accepted"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 409 | `CONFLICT` | Open request or wrong version |

### Portal decision

**Purpose.** accepted | declined with optional comment (max 500).

| Item | Value |
| --- | --- |
| Method | `POST` |
| Path | `/api/v1/dealflow/portal/:token/decision` |
| Auth | Portal token |
| Permission | Token |
| UI | Portal |
| Service | `applyPortalDecision` |
| Persistence | df_quotes.customer_decision |

**Request**

```http
POST /api/v1/dealflow/portal/:token/decision HTTP/1.1
Host: localhost:5000
Content-Type: application/json
```

```json
{
  "expectedVersion": 6,
  "action": "accepted",
  "comment": "Looks good"
}
```

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "customerDecision": "accepted"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | action not in enum |

### Portal PDF

**Purpose.** Customer-safe PDF without staff JWT.

| Item | Value |
| --- | --- |
| Method | `GET` |
| Path | `/api/v1/dealflow/portal/:token/pdf` |
| Auth | Portal token |
| Permission | Token |
| UI | Portal download |
| Service | `customerQuotePdfByToken` |
| Persistence | Generated |

**Request**

```http
GET /api/v1/dealflow/portal/:token/pdf HTTP/1.1
Host: localhost:5000
Content-Type: application/json
```

No JSON body (empty object allowed where `expectedVersion` is optional).

**Success envelope (shape)**

```json
{
  "success": true,
  "data": {
    "note": "Binary PDF"
  },
  "meta": {}
}
```

**Typical failures**

| Status | Code | When |
| --- | --- | --- |
| 404 | `NOT_FOUND` | Unknown token |

## Auth HTTP cookbook

Prefix `/api/v1/auth`. These are kit routes, not DealFlow routes. They are required to obtain tokens for the cookbook above.

### Register

**Purpose.** Create user with AUTH_DEFAULT_ROLE (`user`). Emits `user.created` → DealFlow `provisionCustomer`.

```http
POST /api/v1/auth/register HTTP/1.1
Host: localhost:5000
Content-Type: application/json
```

```json
{
  "email": "ada@example.com",
  "password": "not-a-real-password",
  "displayName": "Ada"
}
```

**Success data (typical).** `user` + `tokens.accessToken` / `refreshToken`. Password hash never returned. Role is never admin.

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Schema fail |
| 401 | `AUTHENTICATION_ERROR` | Bad credentials (login) |
| 403 | `AUTHORIZATION_ERROR` | Disabled account |
| 429 | `RATE_LIMIT` | Login/OTP/reset windows |

### Login

**Purpose.** Verify bcrypt, issue tokens, set httpOnly cookies when AUTH_COOKIE_ENABLED=true.

```http
POST /api/v1/auth/login HTTP/1.1
Host: localhost:5000
Content-Type: application/json
```

```json
{
  "email": "demo.staff@example.com",
  "password": "demo-password"
}
```

**Success data (typical).** Same token envelope as register. Demo rate limits relaxed only for seeded demo.*@example.com when DEMO_MODE=true.

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Schema fail |
| 401 | `AUTHENTICATION_ERROR` | Bad credentials (login) |
| 403 | `AUTHORIZATION_ERROR` | Disabled account |
| 429 | `RATE_LIMIT` | Login/OTP/reset windows |

### Refresh

**Purpose.** Rotate refresh token. Reuse of a revoked token revokes the family.

```http
POST /api/v1/auth/refresh HTTP/1.1
Host: localhost:5000
Content-Type: application/json
```

```json
{
  "refreshToken": "<refresh-jwt>"
}
```

**Success data (typical).** New access + refresh pair.

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Schema fail |
| 401 | `AUTHENTICATION_ERROR` | Bad credentials (login) |
| 403 | `AUTHORIZATION_ERROR` | Disabled account |
| 429 | `RATE_LIMIT` | Login/OTP/reset windows |

### Logout

**Purpose.** Revoke refresh family; denylist access jti if Authorization present; clear cookies.

```http
POST /api/v1/auth/logout HTTP/1.1
Host: localhost:5000
Content-Type: application/json
```

```json
{
  "refreshToken": "<refresh-jwt>"
}
```

**Success data (typical).** Empty/ack envelope. Safe to call twice.

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Schema fail |
| 401 | `AUTHENTICATION_ERROR` | Bad credentials (login) |
| 403 | `AUTHORIZATION_ERROR` | Disabled account |
| 429 | `RATE_LIMIT` | Login/OTP/reset windows |

### Current user

**Purpose.** Reload roles and permissions from PostgreSQL.

```http
GET /api/v1/auth/me HTTP/1.1
Host: localhost:5000
Content-Type: application/json
```

**Success data (typical).** `id`, `email`, `displayName`, `status`, `role`, `roles`, `permissions`. Authorize from this object, not JWT role claim.

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Schema fail |
| 401 | `AUTHENTICATION_ERROR` | Bad credentials (login) |
| 403 | `AUTHORIZATION_ERROR` | Disabled account |
| 429 | `RATE_LIMIT` | Login/OTP/reset windows |

### OTP request

**Purpose.** Issue OTP when FEATURE_OTP=true. Same response whether destination exists (reset flow).

```http
POST /api/v1/auth/otp/request HTTP/1.1
Host: localhost:5000
Content-Type: application/json
```

```json
{
  "email": "ada@example.com",
  "purpose": "login"
}
```

**Success data (typical).** Generic accepted message. Code is never in the JSON body.

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Schema fail |
| 401 | `AUTHENTICATION_ERROR` | Bad credentials (login) |
| 403 | `AUTHORIZATION_ERROR` | Disabled account |
| 429 | `RATE_LIMIT` | Login/OTP/reset windows |

### OTP verify

**Purpose.** Verify hashed OTP; login purpose issues tokens for existing user.

```http
POST /api/v1/auth/otp/verify HTTP/1.1
Host: localhost:5000
Content-Type: application/json
```

```json
{
  "email": "ada@example.com",
  "code": "123456",
  "purpose": "login"
}
```

**Success data (typical).** Tokens on success. Mock codes only apply in DEMO_MODE / test.

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Schema fail |
| 401 | `AUTHENTICATION_ERROR` | Bad credentials (login) |
| 403 | `AUTHORIZATION_ERROR` | Disabled account |
| 429 | `RATE_LIMIT` | Login/OTP/reset windows |

### Password reset request

**Purpose.** Always the same envelope if email unknown.

```http
POST /api/v1/auth/password-reset/request HTTP/1.1
Host: localhost:5000
Content-Type: application/json
```

```json
{
  "email": "ada@example.com"
}
```

**Success data (typical).** No user enumeration.

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Schema fail |
| 401 | `AUTHENTICATION_ERROR` | Bad credentials (login) |
| 403 | `AUTHORIZATION_ERROR` | Disabled account |
| 429 | `RATE_LIMIT` | Login/OTP/reset windows |

### Password reset confirm

**Purpose.** Set password, revoke refresh and access issued before reset.

```http
POST /api/v1/auth/password-reset/confirm HTTP/1.1
Host: localhost:5000
Content-Type: application/json
```

```json
{
  "email": "ada@example.com",
  "code": "123456",
  "password": "new-password-placeholder"
}
```

**Success data (typical).** Caller must log in again.

| Status | Code | When |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Schema fail |
| 401 | `AUTHENTICATION_ERROR` | Bad credentials (login) |
| 403 | `AUTHORIZATION_ERROR` | Disabled account |
| 429 | `RATE_LIMIT` | Login/OTP/reset windows |

### Health and readiness

```http
GET /health HTTP/1.1
Host: localhost:5000
```

JSON success with `status: ok`, `service`, `environment`, `uptimeSeconds`, `timestamp`. Meta version `0.1.0`. Not rate-limited.

```http
GET /ready HTTP/1.1
Host: localhost:5000
```

200 when configured dependencies ping. 503 `NOT_READY` with sanitized `checks.database|redis|odoo|ai`. Unconfigured integrations are skipped.

### Features snapshot

```http
GET /api/v1/features HTTP/1.1
Host: localhost:5000
```

Public map of `FEATURE_*` for UX (`FeatureProvider`). Enabling a flag here does not grant RBAC. DealFlow pages do not disappear solely because Copilot is off.

### Realtime

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/v1/realtime/channels` | Session | Channels the caller may use |
| GET | `/api/v1/realtime/events?channels=dashboard` | Session | SSE stream |

DealFlow events arrive as dashboard payloads with `kind: dealflow`. Requires `FEATURE_REALTIME=true`. 404 `FEATURE_DISABLED` when off.

### Audit list (kit)

```http
GET /api/v1/audit?resource=quote&resourceId=<uuid>&limit=50 HTTP/1.1
Authorization: Bearer <ACCESS_TOKEN>
```

Requires `audit.read`. Frontend `listQuoteAudit` / `listProductAudit` use this. Events are redacted.

## Zod contract notes

All DealFlow JSON bodies use `.strict()` in `schemas.ts`. Unknown keys fail validation.

| Schema | Constraint worth remembering |
| --- | --- |
| `tokenParamSchema` | token length 16–128 |
| `expectedVersionSchema` | positive int |
| `lineInputSchema` | discount 0–100; quantity positive |
| `patchLineBodySchema` | at least one of productId, quantity, discountPercent, unitPrice |
| `decideBodySchema` | reason 1–500 trimmed |
| `portalChangeBodySchema` | lines min 1 |
| `quantityBreakSchema` | name max 120; adjustmentKind fixed\|percent |
| `roleAuthoritySchema` | roleKey max 40; exceedAction allow\|approval\|block |
| `replaceQuantityBreaksBodySchema` | items max 100 |
| `replaceRoleAuthoritiesBodySchema` | items 1–20 |
| `patchGovernanceBodySchema` | maxApprovalLevels 1–3; at least one key |
| `vendorContactBodySchema` | message 1–1000 |
| `portalDecisionBodySchema` | action accepted\|declined; comment max 500 |
| `anomalyDispositionBodySchema` | status open\|acknowledged\|resolved\|dismissed |
| `fulfillmentPlanBodySchema` | override quantities positive |
| `requestedLineSchema` | requestType enum including question, quantity_change, product_change, removal, pricing, discount, general |
| `respondNegotiationBodySchema` | responseNote 1–2000 |
| `negotiationBodySchema` | note 1–2000; requestedLines max 50 |
| `portalNegotiationBodySchema` | expectedVersion **required** (unlike staff create where it is optional) |
| `productFieldsSchema` | sku max 80; name max 160; stock max 20; breaks max 20 |
| `productBodySchema` | recurring requires billingFrequency |
| `policyBodySchema` | name max 160; description max 500 |
| `chainBodySchema` | steps 1–3; roleKey manager\|finance\|final |
| `customerBodySchema` | email max 200 |
| `warehouseBodySchema` | fulfillmentCostPerUnit >= 0 |
| `relationBodySchema` | reason 1–500; promotion max 200 |

Path params `id`, `lineId`, `approvalId`, `scheduleId`, `nid`, `warehouseId`, `productId` are UUIDs.

## Prisma field catalog

Generated from `database/prisma/schema.prisma`. Types are Prisma/PostgreSQL as mapped.

### User (`users`)

| Field | Type / notes |
| --- | --- |
| `id` | UUID PK, gen_random_uuid() |
| `email` | unique |
| `passwordHash` | never API-returned |
| `displayName` | string |
| `status` | active \| invited \| disabled |
| `createdAt / updatedAt` | timestamps |

### RefreshToken (`refresh_tokens`)

| Field | Type / notes |
| --- | --- |
| `hashed token + family` | rotation; reuse detection |
| `userId` | FK users |

### Role / Permission / joins (`roles, permissions, user_roles, role_permissions`)

| Field | Type / notes |
| --- | --- |
| `name / key` | lowercase resource.action |
| `DealFlow keys` | merged from problem module; admin gets every key |

### DfCustomer (`df_customers`)

| Field | Type / notes |
| --- | --- |
| `id` | UUID PK |
| `name` | display |
| `email` | matches login for portal listing |
| `tier` | DfCustomerTier default standard (loyalty new persists here) |
| `odooPartnerId` | nullable; unused while Odoo off |

### DfProduct (`df_products`)

| Field | Type / notes |
| --- | --- |
| `sku` | unique |
| `name, category` | strings; category indexed |
| `listPrice, cost` | Float |
| `billingType` | one_time \| recurring |
| `billingFrequency` | monthly \| quarterly \| yearly nullable |
| `description, taxCategory, taxRatePercent` | optional |
| `active` | default true |
| `taxable` | default true; tax engine skips when false |
| `odooProductId` | nullable |

### DfProductRelation (`df_product_relations`)

| Field | Type / notes |
| --- | --- |
| `productId / recommendedProductId` | FKs, cascade on source/target delete |
| `kind` | upsell \| cross_sell |
| `reason, promotion, minQuantity` | recommendation copy; minQuantity default 1 |

### DfWarehouse (`df_warehouses`)

| Field | Type / notes |
| --- | --- |
| `name` | West DC / East DC in seed |
| `fulfillmentCostPerUnit` | used in planning cost context |
| `odooWarehouseId` | nullable |

### DfStockLevel (`df_stock_levels`)

| Field | Type / notes |
| --- | --- |
| `warehouseId + productId` | composite PK |
| `quantityOnHand` | physical |
| `reserved` | default 0; lock consumes allocated |
| `incoming` | informational for inbound |

### DfDiscountPolicy (`df_discount_policies`)

| Field | Type / notes |
| --- | --- |
| `customerTier, productCategory` | nullable match dimensions |
| `warningPercent, approvalPercent, rejectPercent` | line decision thresholds |
| `maxMarginImpactPercent` | can escalate to approval_required |
| `priority` | lower wins after specificity; indexed |
| `active` | default true |

### DfApprovalChain (`df_approval_chains`)

| Field | Type / notes |
| --- | --- |
| `minRiskScore, minBlendedDiscountPercent` | OR qualification |
| `priority` | tie-break; indexed |
| `active` | boolean |

### DfApprovalChainStep (`df_approval_chain_steps`)

| Field | Type / notes |
| --- | --- |
| `chainId + stepOrder` | unique |
| `roleKey` | manager \| finance \| final |
| `label` | UI string |

### DfQuantityBreak (`df_quantity_breaks`)

| Field | Type / notes |
| --- | --- |
| `productId` | indexed with minQuantity |
| `customerTier` | nullable more-specific match |
| `minQuantity, maxQuantity` | max nullable = open-ended |
| `adjustmentKind / adjustmentValue` | fixed unit price or percent |

### DfRoleAuthority (`df_role_authorities`)

| Field | Type / notes |
| --- | --- |
| `roleKey` | PK (staff, manager, finance) |
| `maxDiscountPercent` | hard cap on writes |
| `minMarginPercent, maxPriceOverridePercent` | additional governance |
| `canNegotiate` | default true |
| `exceedAction` | allow \| approval \| block |

### DfGovernanceConfig (`df_governance_config`)

| Field | Type / notes |
| --- | --- |
| `id` | fixed UUID GOVERNANCE_CONFIG_ID |
| `cumulativeWarningLimit` | default 2 |
| `materialDiscountDeltaPp` | default 2 |
| `materialTotalDeltaRatio` | default 0.1 |
| `highValueNetTotal` | default 25000 |
| `maxApprovalLevels` | capped at 3 in engine |
| `taxRatePercent` | default 0 |
| `staleQuoteDays` | default 7 |
| `unusualDiscountPercent` | default 25 |
| `largeDealNetTotal` | default 50000 |
| `maxCommercialDiscountPercent` | default 25 |
| `allowLoyaltyStacking` | default true |

### Quote (`df_quotes`)

| Field | Type / notes |
| --- | --- |
| `number` | unique human id DF-… |
| `customerId` | restrict delete |
| `ownerId` | optional staff |
| `status` | DfQuoteStatus default draft |
| `listTotal, discountTotal, netTotal, costTotal, marginPercent` | commercial rollups |
| `blendedDiscountPercent, riskScore, assessmentDecision` | assessment |
| `requiredChainId` | set null on chain delete |
| `portalToken` | unique unguessable |
| `version` | optimistic concurrency default 1 |
| `odooSaleOrderId` | nullable; not invented in demo |
| `taxTotal` | from tax engine |
| `customerDecision / At / Comment / Version` | portal accept/decline |
| `commerciallyFrozenAt / By` | finalize |
| `financeLockedAt / By` | lock |
| `activeNegotiationId` | pointer |
| `indexes` | [status, createdAt], [customerId] |

### QuoteLine (`df_quote_lines`)

| Field | Type / notes |
| --- | --- |
| `quoteId` | cascade |
| `productId` | restrict |
| `quantity, listPrice, discountPercent, unitCost` | pricing snapshot |
| `recommendedFromId` | nullable recommendation source |

### QuoteApproval (`df_quote_approvals`)

| Field | Type / notes |
| --- | --- |
| `chainId, stepOrder, roleKey, label` | copied from chain |
| `status` | pending \| approved \| rejected \| skipped \| invalidated |
| `actorId, decidedAt, decision, reason` | decision audit |

### QuoteFulfillmentSplit (`df_quote_fulfillment_splits`)

| Field | Type / notes |
| --- | --- |
| `quoteLineId, warehouseId, quantity` | allocation |

### QuoteBackorder (`df_quote_backorders`)

| Field | Type / notes |
| --- | --- |
| `quoteId, product/line, quantity` | unfilled remainder |

### QuoteBillingSchedule (`df_quote_billing_schedules`)

| Field | Type / notes |
| --- | --- |
| `one-time vs recurring` | status scheduled \| invoiced \| cancelled |
| `frequency / dates` | from billing-engine PERIOD_DAYS |

### QuoteRevision (`df_quote_revisions`)

| Field | Type / notes |
| --- | --- |
| `snapshot + materialChange flag` | reapproval evidence |

### DfAnomaly (`df_anomalies`)

| Field | Type / notes |
| --- | --- |
| `type, severity, entityType, entityId, quoteId` | detector output |
| `status, resolution, resolverId` | disposition |
| `detectedAt, updatedAt` | timestamps |

### DfNegotiationRequest (`df_negotiation_requests`)

| Field | Type / notes |
| --- | --- |
| `note, requestedDiscountPercent, requestedTargetAmount, requestedLines JSON` | customer intent |
| `status` | see encyclopedia |
| `responseNote, respondedBy, respondedAt` | staff reply |
| `quoteVersion` | version at request |

### DfQuoteEmailDelivery (`df_quote_email_deliveries`)

| Field | Type / notes |
| --- | --- |
| `eventType` | prelim_invoice \| final_invoice |
| `status` | pending \| not_configured \| sent \| failed |
| `idempotencyKey` | dealflow:quote:{id}:{event}:{stamp} |
| `payload` | QuoteEmailDocument JSON |
| `recipientEmail, provider, errorMessage, sentAt` | delivery metadata |

Kit tables also exist for notifications, documents, copilot, automation, RAG, search, analytics, and kit anomalies. They are unused by the DealFlow golden path when those flags are off.

## Seed catalog reference

Stable UUIDs from `modules/problem/src/dealflow/defaults.ts`. Demo seed (`DEMO_MODE=true`) loads these plus presentation history from `presentation-book.ts`.

### Seed customers

| id | Name | Email | Persisted tier |
| --- | --- | --- | --- |
| `11111111-1111-4111-8111-111111111111` | Northwind Retail | `demo.user@example.com` | standard |
| `22222222-2222-4222-8222-222222222222` | Globex Manufacturing | `buying@globex.example` | standard |
| `33333333-3333-4333-8333-333333333333` | Initech Strategic | `deals@initech.example` | standard |

Presentation book adds many additional named customers (Reliance Retail, Tata Steel, etc.) **only** in demo seed. Those emails are seed fixtures, not live companies using this software.

### Seed products

| SKU | Name | Category | List | Cost | Billing |
| --- | --- | --- | ---: | ---: | --- |
| HW-CORE-1 | Core Gateway | hardware | 4000 | 2200 | one_time |
| HW-EDGE-2 | Edge Sensor Pack | hardware | 1500 | 800 | one_time |
| SW-CTRL-1 | Control Suite | software | 2400 | 400 | recurring monthly |
| SW-ANALYTICS | Analytics Add-on | software | 900 | 150 | recurring monthly |
| SVC-PREMIUM | Premium Success Plan | services | 600 | 120 | recurring yearly |

IDs: `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1` … `aaa5` in SKU order.

### Seed warehouses

| Name | Cost/unit | id suffix |
| --- | ---: | --- |
| West DC | 18 | `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1` |
| East DC | 25 | `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2` |

### Seed stock (Core Gateway and others)

| Warehouse | Product | On hand | Incoming |
| --- | --- | ---: | ---: |
| West | Core Gateway | 4 | 6 |
| East | Core Gateway | 3 | 0 |
| West | Edge Sensor | 10 | 0 |
| East | Edge Sensor | 2 | 0 |
| Both | Control Suite | 50 | 0 |
| Both | Analytics | 50 | 0 |
| Both | Premium Success | 20 | 0 |

Available Core Gateway for a fresh seed: 4 + 3 = 7. A qty-8 line yields backorder **1**.

### Seed policies

| Name | Match | Warn | Approve | Reject | Margin cap | Priority |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Platinum customer | tier platinum | 12 | 20 | 40 | 70 | 10 |
| Gold customer | tier gold | 8 | 12 | 30 | 55 | 20 |
| Software category | category software | 8 | 15 | 35 | 80 | 30 |
| Default ceiling | none | 3 | 5 | 25 | 40 | 100 |

Northwind `standard` + hardware uses **Default ceiling**. A 5% hardware line is at the approval threshold of that policy even when the staff role ceiling allows 5%.

### Seed quantity breaks

| Name | Product | Qty | Kind | Value |
| --- | --- | --- | --- | ---: |
| Core Gateway 1–9 list | HW-CORE-1 | 1–9 | fixed | 4000 |
| Core Gateway 10–49 volume | HW-CORE-1 | 10–49 | fixed | 3700 |
| Core Gateway 50+ contract | HW-CORE-1 | 50+ | fixed | 3400 |
| Edge Sensor 10+ volume | HW-EDGE-2 | 10+ | fixed | 1350 |

### Seed relations

| From | To | Kind | Reason |
| --- | --- | --- | --- |
| Core Gateway | Edge Sensor Pack | cross_sell | Edge sensors complete gateway deployments |
| Control Suite | Analytics Add-on | upsell | Analytics increases recurring software attach |

### Presentation portal

| Constant | Value |
| --- | --- |
| `PRESENTATION_PORTAL_TOKEN` | `df-demo-portal-token-northwind-0001` |
| `PRESENTATION_QUOTE_ID` | `ffffffff-ffff-4fff-8fff-fffffffffff1` |
| Quote number | DF-00001 (draft catalog quote) |

Do not use DF-00001 as the golden-path quote you submit, lock, and split unless you intend to consume the presentation book’s stock story. Create a **new** Northwind quote for the eleven-step demo.

## Engine formulas with worked numbers

### Line net

`lineNet = listPrice × quantity × (1 − discountPercent/100)`

Core Gateway ×8 @ 5%: `4000 × 8 × 0.95 = 30400`.

Control Suite ×1 @ 5%: `2400 × 1 × 0.95 = 2280`.

### Quote rollup (two lines, no tax)

| | List | Net | Discount $ |
| --- | ---: | ---: | ---: |
| Hardware | 32000 | 30400 | 1600 |
| Software | 2400 | 2280 | 120 |
| Total | 34400 | 32680 | 1720 |

`blendedDiscountPercent = 1720 / 34400 × 100 ≈ 5.00`.

### Line decision vs Default ceiling

Hardware 5% vs warn 3 / approve 5 / reject 25 → **approval_required** (hits approvalPercent).

Software 5% vs Software category warn 8 / approve 15 → **allowed** (below warning).

Staff write of 8% hardware: role cap 5% with exceedAction `block` → **403**, no persist, regardless of policy.

Manager replace to 10% hardware: role cap 10% → persists **10%**, not 15%.

Worked manager hardware line: `4000 × 8 × 0.90 = 28800`. Software unchanged 2280. List still 34400. Discount $ = 34400 − 31080 = 3320. Blended ≈ 9.65%.

### Risk score sketch (illustrative of the formula, not a guaranteed UI screenshot)

```text
risk = clamp(0, 100,
  blendedDiscountPercent * 2.5
  + average(marginErosionPercent) * 0.4
  + warningCount * 8
  + approvalLineCount * 15
  + rejectedCount * 40
)
```

Two warning-level lines force quote decision `approval_required` even if blended is modest (`cumulativeWarningLimit = 2`).

### Margin erosion

Cost Core Gateway 2200, list 4000, discount 5%: net unit 3800. Margin vs list depends on the engine’s exact marginErosionPercent definition in `discount-engine.ts` (compare net to cost/list as implemented). If erosion ≥ `maxMarginImpactPercent` (40% default policy), the line escalates to `approval_required` unless already `rejected`.

### Quantity break selection

Qty 8 matches Core Gateway 1–9 list (fixed 4000), not 10–49 (3700). Qty 10 would reprice unit to 3700 before discount.

### Loyalty

| Won purchases | Loyalty API tier | Bonus % | Persisted customer.tier |
| ---: | --- | ---: | --- |
| 0–1 | new | 0 | standard |
| 2–4 | gold | 5 | gold |
| ≥5 | platinum | 10 | platinum |

Ceiling = min(maxCommercialDiscountPercent, roleMax + bonus) when stacking enabled. Strategic stored tier maps to platinum bonus in `normalizeCustomerTier`.

### Tax

Default `taxRatePercent = 0` → `taxTotal = 0`, `grandTotal = netTotal`. If governance tax is 10% and both lines taxable: `taxTotal = round(32680 * 0.10, 2) = 3268`, grand 35948.

### Fulfillment consume

Available West Core Gateway = max(0, 4 − 0) = 4. East = 3. Plan qty 8 → allocate 4+3, backorder 1. Lock decrements on-hand and reserved on the 7 allocated units, not the backorder row.

### Billing split

Hardware nets → one-time `dueToday` component. Control Suite monthly recurring → `recurringMonthly`. Premium Success yearly → `recurringYearly` / annual rollup in `hybridCommercials`. Quarterly SKUs contribute monthly equivalent `/ 3`.

### Material change

Δ blended ≥ 2 percentage points **or** |Δ net| / previousNet ≥ 0.10. Example: blended 5% → 8% is +3pp → material. Net 32680 → 29412 (10% down) is material on the ratio rule.

### Email idempotency

`dealflow:quote:{quoteId}:prelim_invoice:prelim` vs `…:final_invoice:{financeLockedAt|vN}`. Repeat lock with same stamp should not double-send.

### PDF

A4 595×842, Helvetica, customer-safe lines (SKU, qty, unit, discount, net, billing label). No risk score on the page.

## Quote status encyclopedia

| Status | Meaning | Typical entry | Typical next | Mutate commercials? |
| --- | --- | --- | --- | --- |
| `draft` | Staff building | createQuote | negotiation, manager_review, or unusual assess paths | Yes |
| `customer_negotiation` | Buyer request open | portal negotiations | manager_review, finalized, draft | Yes |
| `manager_review` | Escalated | send-to-manager | customer_negotiation, finalized | Yes |
| `finalized` | Frozen | finalize | approval_required | No (frozen stamp) |
| `approval_required` | Chain pending | submit | approved, rejected, draft | No |
| `approved` | Chain complete | last decide | confirmed (lock) | No until new revision |
| `confirmed` | Finance locked | lock | fulfillment, billing, completed | No |
| `fulfillment` | Planning/shipping | plan | billing, completed | No |
| `billing` | Schedules exist | generateBilling | completed | No |
| `completed` | Closed | complete | none | No |
| `rejected` | Failed/voided | reject/void | draft | Yes (rejected is mutable per canMutateCommercials) |

`canMutateCommercials`: draft, rejected, customer_negotiation, manager_review.

`isOpenForPlanning`: confirmed, fulfillment.

`isOpenForBilling`: those plus billing.

`isCommerciallyLocked`: financeLockedAt set **or** confirmed/fulfillment/billing/completed.

Delete: draft, rejected. Void: customer_negotiation, manager_review, approval_required, approved, finalized.

Illegal transitions throw `CONFLICT` via `assertTransition`.

## Negotiation status encyclopedia

| Status | Meaning |
| --- | --- |
| `open` | Customer submitted; staff has not finished |
| `in_review` | Staff responded in_review |
| `sent_to_manager` | Escalated |
| `manager_revised` | Manager changed commercials |
| `returned_to_customer` | Sent back for confirm |
| `accepted` | Request accepted |
| `rejected` | Request rejected |
| `resolved` | Closed without the other terminals |
| `agreed` | Linked to agree-to-final |
| `withdrawn` | Cancelled by process |

Portal confirmation is blocked while a request is open, in review, or with the manager. That is a service rule, not a frontend-only disable.

Request types on lines: `question`, `quantity_change`, `product_change`, `removal`, `pricing`, `discount`, `general`.

Line actions: `add`, `remove`, `update`.

## Error encyclopedia

Envelope error codes from `@hackathon/api-contract` `ERROR_CODES`:

| Code | Typical HTTP | DealFlow example |
| --- | ---: | --- |
| `VALIDATION_ERROR` | 400 | discount 101; token length 10; empty governance patch |
| `AUTHENTICATION_ERROR` | 401 | expired access JWT; missing cookie/bearer |
| `AUTHORIZATION_ERROR` | 403 | staff approve; staff lock; staff 8% write; customer `/quotes` list |
| `NOT_FOUND` | 404 | bad quote UUID that does not exist; unknown portal token |
| `FEATURE_DISABLED` | 404 | SSE when FEATURE_REALTIME false |
| `CONFLICT` | 409 | expectedVersion mismatch; bad status transition; insufficient stock override |
| `RATE_LIMIT` | 429 | public portal hammering; login brute force |
| `EXTERNAL_SERVICE_ERROR` | 502-ish via AppError | provider failure (email/Odoo) when enabled |
| `DATABASE_ERROR` | 500 class | Prisma connectivity (sanitized) |
| `TIMEOUT` | 504 class | bounded provider timeout |
| `NOT_READY` | 503 | GET /ready |
| `INTERNAL_ERROR` | 500 | unhandled; no stack in body |

Login: unknown email and wrong password share one 401 message. Disabled account with correct password: 403 Account is disabled.

Portal: unknown token is 404, not 401, because there is no session.

## Staff page operator manual

### `/login`

**Module file.** `modules/problem/frontend/dealflow/../ — actually frontend/src/pages/LoginPage.tsx`

**Purpose.** Sales operations sign-in. Demo chips when FEATURE demo snapshot says demo mode.

**APIs commonly used**

- POST /api/v1/auth/login
- GET /api/v1/features
- GET /api/v1/auth/me

**Permissions (UX + API).** Public

**Empty / error.** Pending redirect if already authenticated via homePathForUser.

**Pitfalls.** Customers land on /account. Rate limit after 5 failures except seeded demo emails in DEMO_MODE.

### `/register`

**Module file.** `modules/problem/frontend/dealflow/— frontend/src/pages/RegisterPage.tsx`

**Purpose.** Public signup as user + DfCustomer.

**APIs commonly used**

- POST /api/v1/auth/register

**Permissions (UX + API).** Public

**Empty / error.** Validation errors from Zod via envelope.

**Pitfalls.** Never grants staff. AUTH_DEFAULT_ROLE=user.

### `/forgot-password`

**Module file.** `modules/problem/frontend/dealflow/— frontend/src/pages/ForgotPasswordPage.tsx`

**Purpose.** OTP reset when FEATURE_OTP=true.

**APIs commonly used**

- POST /api/v1/auth/password-reset/request
- POST /api/v1/auth/password-reset/confirm

**Permissions (UX + API).** Public

**Empty / error.** Same success if email unknown.

**Pitfalls.** Requires OTP feature and a delivery mock or provider.

### `/account`

**Module file.** `modules/problem/frontend/dealflow/CustomerAccountPage.tsx`

**Purpose.** Buyer list of quotations with portal tokens.

**APIs commonly used**

- GET /api/v1/dealflow/me/quotes

**Permissions (UX + API).** Authenticated customer

**Empty / error.** EmptyState when no quotes.

**Pitfalls.** demo.user cannot open /dealflow even if they guess the URL (SessionGate / canAccessInternalDealflow).

### `/portal/:token`

**Module file.** `modules/problem/frontend/dealflow/PortalPage.tsx`

**Purpose.** Isolated commercial quote. Outside AppLayout.

**APIs commonly used**

- GET /portal/:token
- PATCH /portal/:token
- POST /portal/:token/negotiations
- POST /portal/:token/agree
- POST /portal/:token/decision
- GET /portal/:token/pdf

**Permissions (UX + API).** Token only

**Empty / error.** 404 page when token invalid.

**Pitfalls.** If you see riskScore in the network response, that is a regression in toPortalView.

### `/dealflow`

**Module file.** `modules/problem/frontend/dealflow/DashboardPage.tsx`

**Purpose.** Live open value, approvals waiting, risk derived from listQuotes.

**APIs commonly used**

- GET /quotes
- SSE dashboard

**Permissions (UX + API).** quotes.read

**Empty / error.** Zeros when book empty (production seed without demo data).

**Pitfalls.** Numbers are computed, not a snapshot table.

### `/dealflow/quotes`

**Module file.** `modules/problem/frontend/dealflow/QuotesListPage.tsx`

**Purpose.** Create and open quotations. DataTable pagination.

**APIs commonly used**

- GET /quotes
- POST /quotes
- GET /catalog

**Permissions (UX + API).** read + write to create

**Empty / error.** Empty table with create action.

**Pitfalls.** Pick Northwind for golden path. Copy **this** quote’s portal URL.

### `/dealflow/quotes/:quoteId`

**Module file.** `modules/problem/frontend/dealflow/QuoteWorkspacePage.tsx`

**Purpose.** Lines, assess, negotiate, finalize, submit, approve (if permitted), lock, recommend, fulfill, bill, PDF, audit.

**APIs commonly used**

- GET /quotes/:id
- line CRUD
- assess
- submit
- decide
- lock
- recommendations
- pdf

**Permissions (UX + API).** write / approve / lock as applicable

**Empty / error.** ErrorState if 404.

**Pitfalls.** expectedVersion: refresh if 409. Staff Submit only after Finalize.

### `/dealflow/negotiations`

**Module file.** `modules/problem/frontend/dealflow/NegotiationsPage.tsx`

**Purpose.** Queue of customer requests across quotes.

**APIs commonly used**

- GET quotes + negotiations
- respond
- send-to-manager

**Permissions (UX + API).** read/write

**Empty / error.** Empty when no open requests.

**Pitfalls.** Do not try to apply 8% as staff; send to manager.

### `/dealflow/approvals`

**Module file.** `modules/problem/frontend/dealflow/ApprovalsPage.tsx`

**Purpose.** Quotes waiting on a chain step.

**APIs commonly used**

- GET /quotes

**Permissions (UX + API).** approve to decide

**Empty / error.** Empty queue is valid.

**Pitfalls.** Staff can see some queues via read but decide returns 403.

### `/dealflow/approvals/:quoteId`

**Module file.** `modules/problem/frontend/dealflow/ApprovalDetailPage.tsx`

**Purpose.** Risk, chain, decide with reason.

**APIs commonly used**

- GET /quotes/:id
- POST …/decide

**Permissions (UX + API).** quotes.approve + step permission

**Empty / error.** No pending step → nothing to decide.

**Pitfalls.** Reason is required (min 1 character).

### `/dealflow/fulfillment`

**Module file.** `modules/problem/frontend/dealflow/FulfillmentPage.tsx`

**Purpose.** Stock overview and history of planned quotes.

**APIs commonly used**

- GET /catalog
- GET /quotes

**Permissions (UX + API).** read; write for planning

**Empty / error.** No confirmed quotes yet.

**Pitfalls.** Plan after finance lock.

### `/dealflow/fulfillment/:quoteId`

**Module file.** `modules/problem/frontend/dealflow/FulfillmentDetailPage.tsx`

**Purpose.** Suggested split, overrides, complete deal, vendor contact.

**APIs commonly used**

- POST fulfillment/plan
- POST vendor-contact
- POST complete

**Permissions (UX + API).** fulfillment.write / quotes.write

**Empty / error.** Override conflict if qty exceeds available.

**Pitfalls.** West 4 East 3 backorder 1 on seeded Core Gateway ×8.

### `/dealflow/subscriptions`

**Module file.** `modules/problem/frontend/dealflow/BillingPages.tsx`

**Purpose.** Recurring schedules list.

**APIs commonly used**

- GET /quotes

**Permissions (UX + API).** read

**Empty / error.** Empty until generateBilling.

**Pitfalls.** Not a payment processor.

### `/dealflow/subscriptions/:quoteId`

**Module file.** `modules/problem/frontend/dealflow/CommercialDetailPages.tsx BillingDetailPage`

**Purpose.** Recurring lines and cancel.

**APIs commonly used**

- POST billing/generate
- POST billing/:id/cancel

**Permissions (UX + API).** billing.write

**Empty / error.** Generate first.

**Pitfalls.** expectedVersion on cancel.

### `/dealflow/invoices`

**Module file.** `modules/problem/frontend/dealflow/BillingPages.tsx InvoicesPage`

**Purpose.** One-time schedules.

**APIs commonly used**

- GET /quotes

**Permissions (UX + API).** read

**Empty / error.** Empty until generate.

**Pitfalls.** “Invoice” here is a schedule record, not AR cash.

### `/dealflow/invoices/:quoteId`

**Module file.** `modules/problem/frontend/dealflow/CommercialDetailPages.tsx InvoiceDetailPage`

**Purpose.** One-time detail.

**APIs commonly used**

- POST billing/generate

**Permissions (UX + API).** billing.write

**Empty / error.** Need lock + generate.

**Pitfalls.** Provisional/final emails are separate from this page.

### `/dealflow/health`

**Module file.** `modules/problem/frontend/dealflow/InsightsPages.tsx DealHealthPage`

**Purpose.** Scores from health-engine over live quotes.

**APIs commonly used**

- GET /quotes

**Permissions (UX + API).** read

**Empty / error.** Healthy empty book or N/A factors.

**Pitfalls.** Not FEATURE_ANALYTICS.

### `/dealflow/reports`

**Module file.** `modules/problem/frontend/dealflow/InsightsPages.tsx ReportsPage`

**Purpose.** Book metrics from the same live list.

**APIs commonly used**

- GET /quotes

**Permissions (UX + API).** read

**Empty / error.** Zeros without quotes.

**Pitfalls.** No separate reports table.

### `/dealflow/anomalies`

**Module file.** `modules/problem/frontend/dealflow/AnomalyCenterPage.tsx`

**Purpose.** Rule exceptions; resolve/ignore.

**APIs commonly used**

- GET /anomalies
- POST /anomalies/:id/disposition

**Permissions (UX + API).** quotes.read

**Empty / error.** No rows.

**Pitfalls.** Not kit z-score engine.

### `/dealflow/assistant`

**Module file.** `modules/problem/frontend/dealflow/AssistantPage.tsx`

**Purpose.** Contextual insights from assessment, stock, catalog relations (intelligence.ts).

**APIs commonly used**

- GET /quotes/:id
- GET recommendations
- GET catalog

**Permissions (UX + API).** read

**Empty / error.** Pick a quote.

**Pitfalls.** Not Gemini pricing.

### `/dealflow/catalog`

**Module file.** `modules/problem/frontend/dealflow/InsightsPages.tsx CatalogPage`

**Purpose.** SKUs and navigation to policies.

**APIs commonly used**

- GET /catalog
- POST/PATCH products

**Permissions (UX + API).** catalog.read; products.write to edit SKUs

**Empty / error.** Empty catalog only if seed skipped.

**Pitfalls.** Policies write still needs catalog.write.

### `/dealflow/catalog/products/:productId`

**Module file.** `modules/problem/frontend/dealflow/CatalogDetailPages.tsx ProductDetailPage`

**Purpose.** Stock, breaks, activate, audit.

**APIs commonly used**

- PATCH products
- PUT stock
- GET /audit?resource=catalog

**Permissions (UX + API).** products.write / audit.read

**Empty / error.** Unknown id error.

**Pitfalls.** Deactivate vs delete: FK to quote lines.

### `/dealflow/catalog/policies`

**Module file.** `modules/problem/frontend/dealflow/CatalogDetailPages.tsx DiscountPoliciesPage`

**Purpose.** Policies and chains.

**APIs commonly used**

- POST/PATCH/DELETE policies and chains

**Permissions (UX + API).** catalog.write

**Empty / error.** Need admin.

**Pitfalls.** Priority and specificity both matter.

### `/dealflow/settings`

**Module file.** `modules/problem/frontend/dealflow/SettingsPage.tsx + SettingsGovernanceForms.tsx + CatalogEditors.tsx`

**Purpose.** Quantity breaks, role ranges, governance, warehouses.

**APIs commonly used**

- PUT quantity-breaks
- PUT role-authorities
- PATCH governance

**Permissions (UX + API).** catalog.write

**Empty / error.** Forms disabled without permission.

**Pitfalls.** Saving empty governance patch 400.

### Kit pages (not golden path)

| Route | Flag | Notes |
| --- | --- | --- |
| `/` Foundation | always | Kit status |
| `/dashboard` | always | Platform dashboard placeholder layout |
| `/ui` | always | Component gallery |
| `/notifications` | notifications | Inbox |
| `/copilot` | copilot | Untrusted AI |
| `/intents` | intents | NL actions |
| `/problem-intelligence` | problemIntelligence | Statement analysis |
| `/capability-recommendations` | capabilityRecommendations | Advisory |
| `/project-planning` | projectPlanning | Config, no codegen |
| `/project-generator` | projectGenerator | Overlay writer |
| `/rag` | rag | Off in .env.example |
| `/search` | search | Off |
| `/analytics` | analytics | Off |
| `/automations` | automation | Kit rules |
| `/realtime` | realtime | SSE debugger UI |

Command palette (`Ctrl/Cmd+K`) indexes `appNavGroups` in `frontend/src/layouts/nav.ts`.

## Frontend client map

All functions live in `modules/problem/frontend/dealflow/api.ts` unless noted. `ROOT = /api/v1/dealflow`. Tokens are access JWTs except portal helpers.

| Function | HTTP |
| --- | --- |
| `getDealflowManifest` | GET /api/v1/problem |
| `getDealflowCatalog` | GET /catalog |
| `listQuotes` | GET /quotes |
| `listMyQuotes` | GET /me/quotes |
| `getQuote` | GET /quotes/:id |
| `createQuote` | POST /quotes |
| `addQuoteLine` | POST /quotes/:id/lines |
| `updateQuoteLine` | PATCH /quotes/:id/lines/:lineId |
| `removeQuoteLine` | DELETE /quotes/:id/lines/:lineId |
| `replaceQuantityBreaks` | PUT /catalog/quantity-breaks |
| `replaceRoleAuthorities` | PUT /catalog/role-authorities |
| `updateGovernance` | PATCH /catalog/governance |
| `assessQuote` | POST /quotes/:id/assess |
| `submitQuote` | POST /quotes/:id/submit |
| `decideApproval` | POST …/approvals/:approvalId/decide |
| `startNegotiation` | POST /quotes/:id/negotiate |
| `listNegotiations` | GET /quotes/:id/negotiations |
| `createNegotiation` | POST /quotes/:id/negotiations |
| `respondToNegotiation` | POST …/negotiations/:nid/respond |
| `sendToManager` | POST send-to-manager (optional nid) |
| `reviseAsManager` | POST /quotes/:id/revise |
| `returnRevisedQuote` | POST /return (optional nid) |
| `finalizeQuote` | POST /finalize |
| `lockQuote` | POST /lock |
| `agreeToFinal` | POST /agree |
| `upsertProduct` | POST or PATCH /catalog/products |
| `listProductAudit` | GET /api/v1/audit?resource=catalog |
| `upsertStock` | PUT /catalog/stock |
| `upsertPolicy` | POST/PATCH /catalog/policies |
| `upsertChain` | POST/PATCH /catalog/chains |
| `getRecommendations` | GET /quotes/:id/recommendations |
| `applyRecommendation` | POST /quotes/:id/recommendations |
| `listAnomalies` | GET /anomalies |
| `disposeAnomaly` | POST /anomalies/:id/disposition |
| `decidePortalQuote` | POST /portal/:token/decision |
| `downloadCustomerQuotePdf` | GET /quotes/:id/pdf blob |
| `portalQuotePdfHref` | URL helper |
| `planFulfillment` | POST /fulfillment/plan |
| `generateBilling` | POST /billing/generate |
| `cancelBilling` | POST /billing/:scheduleId/cancel |
| `confirmQuote` | POST /confirm (lock alias) |
| `completeQuote` | POST /complete |
| `deleteQuote` | DELETE /quotes/:id |
| `voidQuote` | POST /void |
| `deleteProduct` | DELETE /catalog/products/:id |
| `deletePolicy` | DELETE /catalog/policies/:id |
| `deleteChain` | DELETE /catalog/chains/:id |
| `deleteWarehouse` | DELETE /catalog/warehouses/:id |
| `upsertCustomer` | POST/PATCH /catalog/customers |
| `deleteCustomer` | DELETE /catalog/customers/:id |
| `upsertWarehouse` | POST/PATCH /catalog/warehouses |
| `deleteStock` | DELETE /catalog/stock/:w/:p |
| `upsertRelation` | POST/PATCH /catalog/relations |
| `deleteRelation` | DELETE /catalog/relations/:id |
| `contactVendor` | POST /vendor-contact |
| `getPortalQuote` | GET /portal/:token |
| `applyPortalChange` | PATCH /portal/:token |
| `createPortalNegotiation` | POST /portal/:token/negotiations |
| `agreePortalQuote` | POST /portal/:token/agree |
| `listQuoteAudit` | GET /api/v1/audit?resource=quote |

Shared HTTP helper: `frontend/src/services/api.ts` (`apiGet`, `apiRequest`). Base URL `import.meta.env.VITE_API_URL` (empty → same origin / Vite proxy). Credentials include cookies.

## Click-level golden path

Assume hybrid stack is running and seed completed with DEMO_MODE=true. Password is always `demo-password`.

| Step | Action |
| ---: | --- |
| 1 | Open http://localhost:5173/login |
| 2 | Click Sales Representative chip or type demo.staff@example.com |
| 3 | Submit login; land on /dealflow |
| 4 | Open Quotations |
| 5 | New quotation → customer Northwind Retail |
| 6 | Add product Core Gateway, quantity 8, discount 5 |
| 7 | Add product Control Suite, quantity 1, discount 5 |
| 8 | Confirm list ≈ 34400 and net ≈ 32680 (tax 0) |
| 9 | Copy the portal link shown for this quote (not the DF-00001 demo token) |
| 10 | Optional: try discount 8 on hardware → error toast 403 |
| 11 | Logout |
| 12 | Open the portal URL in the same or a private window |
| 13 | Change a quantity or add a line comment and counter-discount 8% |
| 14 | Submit request; status Under Negotiation |
| 15 | Login staff again |
| 16 | Open Customer negotiations |
| 17 | Open the request; respond in_review or note the ceiling |
| 18 | Send to Manager |
| 19 | Logout; login demo.manager@example.com |
| 20 | Open the quote; set hardware discount 10; save/revise |
| 21 | Return to customer if the UI offers Return |
| 22 | Logout; open portal; Confirm quotation on the new version |
| 23 | Login manager; Finalize |
| 24 | Logout; login staff; Submit |
| 25 | Login manager; Approvals detail; Approve step 1 with a reason |
| 26 | Logout; login demo.finance@example.com |
| 27 | Approve remaining finance/final steps if present |
| 28 | Lock |
| 29 | Login staff; add recommended Edge Sensor Pack |
| 30 | Fulfillment detail; accept West 4 / East 3 / backorder 1 |
| 31 | Generate billing; open Invoices and Subscriptions |
| 32 | Optional: GET portal PDF and staff PDF |
| 33 | Optional: inspect GET /api/v1/dealflow/portal/:token JSON for omitted riskScore |

If Core Gateway available is not 7, re-seed. If login is rate-limited, wait 15 minutes or confirm DEMO_MODE.

Admin `demo.admin@example.com` can complete manager and finance approval steps because `canActOnRole` returns true for admin. Discount writes still do not become 40%.

## curl session

Unix-style. Replace cookies vs `-H Authorization` as needed. Do not log tokens.

```bash
# Health
curl -sS http://localhost:5000/health
curl -sS http://localhost:5000/ready

# Features
curl -sS http://localhost:5000/api/v1/features

# Login staff
curl -sS -c cookies.txt -H "Content-Type: application/json" \
  -d '{"email":"demo.staff@example.com","password":"demo-password"}' \
  http://localhost:5000/api/v1/auth/login
```

Capture `data.tokens.accessToken` as `STAFF`.

```bash
export STAFF="<paste>"
curl -sS -H "Authorization: Bearer $STAFF" http://localhost:5000/api/v1/auth/me
curl -sS -H "Authorization: Bearer $STAFF" http://localhost:5000/api/v1/dealflow/catalog
curl -sS -H "Authorization: Bearer $STAFF" http://localhost:5000/api/v1/dealflow/quotes
```

```bash
# Create quote (customerId from catalog Northwind)
curl -sS -H "Authorization: Bearer $STAFF" -H "Content-Type: application/json" \
  -d '{"customerId":"11111111-1111-4111-8111-111111111111"}' \
  http://localhost:5000/api/v1/dealflow/quotes
```

```bash
# Add hardware line (quote id and version from create)
curl -sS -H "Authorization: Bearer $STAFF" -H "Content-Type: application/json" \
  -d '{"productId":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","quantity":8,"discountPercent":5,"expectedVersion":1}' \
  http://localhost:5000/api/v1/dealflow/quotes/<QUOTE_ID>/lines
```

```bash
# Forbidden 8%
curl -sS -H "Authorization: Bearer $STAFF" -H "Content-Type: application/json" \
  -d '{"discountPercent":8,"expectedVersion":2}' \
  http://localhost:5000/api/v1/dealflow/quotes/<QUOTE_ID>/lines/<LINE_ID>
```

Expect `success: false` and `AUTHORIZATION_ERROR`.

```bash
# Portal
curl -sS http://localhost:5000/api/v1/dealflow/portal/<PORTAL_TOKEN>

curl -sS -H "Content-Type: application/json" \
  -d '{"expectedVersion":2,"note":"Please consider 8%","requestedDiscountPercent":8}' \
  http://localhost:5000/api/v1/dealflow/portal/<PORTAL_TOKEN>/negotiations
```

```bash
# Manager login
curl -sS -H "Content-Type: application/json" \
  -d '{"email":"demo.manager@example.com","password":"demo-password"}' \
  http://localhost:5000/api/v1/auth/login
```

```bash
# Finance lock (after approved)
curl -sS -H "Authorization: Bearer $FINANCE" -H "Content-Type: application/json" \
  -d '{"expectedVersion":7}' \
  http://localhost:5000/api/v1/dealflow/quotes/<QUOTE_ID>/lock
```

```bash
# PDF
curl -sS -H "Authorization: Bearer $STAFF" -H "Accept: application/pdf" \
  -o quote.pdf http://localhost:5000/api/v1/dealflow/quotes/<QUOTE_ID>/pdf
```

Logout:

```bash
curl -sS -H "Content-Type: application/json" -H "Authorization: Bearer $STAFF" \
  -d '{"refreshToken":"<refresh>"}' \
  http://localhost:5000/api/v1/auth/logout
```

## PowerShell session

```powershell
Invoke-RestMethod http://localhost:5000/health
Invoke-RestMethod http://localhost:5000/ready

$login = Invoke-RestMethod -Method Post -Uri http://localhost:5000/api/v1/auth/login -ContentType application/json -Body (@{
  email = 'demo.staff@example.com'
  password = 'demo-password'
} | ConvertTo-Json)
$staff = $login.data.tokens.accessToken
$headers = @{ Authorization = "Bearer $staff" }
Invoke-RestMethod -Headers $headers http://localhost:5000/api/v1/dealflow/catalog
```

Copy env file:

```powershell
Copy-Item .env.example .env
Copy-Item .env.test.example .env.test
```

If `cp` is not an alias, do not use Unix `cp`. Docker commands are the same (`docker compose`).

Stop port conflicts:

```powershell
Get-NetTCPConnection -LocalPort 5000,5173 -ErrorAction SilentlyContinue | Format-Table
```

## Test inventory

Run from repo root unless noted. DealFlow-focused files:

| File | What it guards |
| --- | --- |
| `modules/problem/src/dealflow/discount-engine.test.ts` | Policy match, blended, risk, decisions |
| `modules/problem/src/dealflow/loyalty.test.ts` | Tiers, stacking, admin fallback ceiling |
| `modules/problem/src/dealflow/pricing-engine.test.ts` | Quantity breaks |
| `modules/problem/src/dealflow/tax-engine.test.ts` | Taxable skip, rounding |
| `modules/problem/src/dealflow/billing-engine.test.ts` | Hybrid commercials, schedules |
| `modules/problem/src/dealflow/health-engine.test.ts` | Score factors |
| `modules/problem/src/dealflow/anomaly-engine.test.ts` | Detectors |
| `modules/problem/src/dealflow/portal-view.test.ts` | Stripped keys absent |
| `modules/problem/src/dealflow/quote-pdf.test.ts` | PDF bytes / labels |
| `modules/problem/src/dealflow/customer-email.test.ts` | Document + idempotency key |
| `modules/problem/src/dealflow/governance-config.test.ts` | Defaults / patch merge |
| `modules/problem/src/dealflow/presentation-book.test.ts` | Stable token / book shape |
| `modules/problem/src/dealflow/service.test.ts` | Orchestration, 403 ceilings, lock, negotiation |
| `modules/problem/src/module.test.ts` | Module register contract |
| `modules/problem/frontend/dealflow/DealflowPage.test.tsx` | Staff pages render with fixtures |
| `modules/problem/frontend/dealflow/CustomerAccountPage.test.tsx` | Account isolation |
| `modules/problem/frontend/dealflow/intelligence.test.ts` | Assistant insights |
| `frontend/src/problem.test.ts` | Shim exports |
| `frontend/src/lib/rbac.test.ts` | homePathForUser / canAccessInternalDealflow |
| `frontend/src/pages/LoginPage.test.tsx` | Demo chips / remap |
| `backend/tests/problem.http.test.ts` | HTTP DealFlow + portal |
| `backend/src/problem/customer-email.test.ts` | Host email wiring |
| `backend/src/rbac/catalog-merge.test.ts` | finance/operations merge |
| `backend/src/realtime/realtime.hub.test.ts` | dealflow payload delivery |

Kit tests (auth, jobs, notifications, etc.) live under `backend/src/**/*.test.ts` and `backend/tests/**/*.test.ts`. They mock Odoo/AI/email/SMS/storage.

```bash
npm test -w @hackathon/problem
npm test -w backend
npm test -w frontend
npm run test:e2e
```

## Migration index

Directory: `database/prisma/migrations/`. Apply with `npm run db:migrate` (`migrate deploy`).

| Folder | Topic |
| --- | --- |
| `20260828120000_init` | Kit users/roles foundation |
| `20260828160000_auth_refresh_tokens` | Refresh families |
| `20260828193000_document_intelligence` | Documents |
| `20260828220000_document_permissions` | Document RBAC |
| `20260828230000_stored_objects` | Object store |
| `20260828240000_copilot_audit` | Copilot + audit |
| `20260828250000_automation` | Automation |
| `20260828260000_notification_engine` | Notifications |
| `20260829100000_stored_files` | Files |
| `20260829140000_audit_observability` | Audit extras |
| `20260830080000_rag` | RAG (flag off in demo) |
| `20260830094000_anomaly` | Kit anomaly |
| `20260904120000_search` | Search |
| `20260904200000_analytics` | Analytics |
| `20260905080000_dealflow` | Initial df_* |
| `20260906020000_dealflow_governance` | Governance / authorities / breaks |
| `20260906030000_dealflow_ops_intelligence` | Health/anomaly ops |
| `20260906040000_dealflow_commercial_workflow` | Negotiation/freeze/lock workflow |
| `20260906050000_dealflow_customer_emails` | Email deliveries |
| `20260906060000_dealflow_negotiation_response` | Response fields |

Never edit applied SQL in place on a shared database; add a new migration.

## Source file map

### DealFlow backend

| File | Responsibility |
| --- | --- |
| `index.ts` | Package export |
| `constants.ts` | Module id |
| `types.ts` | Domain types + DEFAULT_GOVERNANCE |
| `errors.ts` | forbidden / conflict / invalid |
| `lifecycle.ts` | Status graph |
| `defaults.ts` | Seed catalog |
| `presentation-book.ts` | Demo history + portal token |
| `loyalty.ts` | Ceilings and tiers |
| `pricing-engine.ts` | Quantity breaks |
| `discount-engine.ts` | Policy, risk, assessment |
| `approval-engine.ts` | Steps, canActOnRole, decide |
| `fulfillment-engine.ts` | Split / backorder / available |
| `billing-engine.ts` | Hybrid schedules |
| `tax-engine.ts` | Quote tax |
| `recommendation-engine.ts` | Relation suggest |
| `health-engine.ts` | Deal health score |
| `anomaly-engine.ts` | Quote exceptions |
| `governance-config.ts` | Load/merge config |
| `portal-view.ts` | DTO strip |
| `customer-email.ts` | Prelim/final documents |
| `quote-pdf.ts` | pdf-lib renderer |
| `store.ts` | Memory store (tests) |
| `prisma-store.ts` | PostgreSQL store |
| `service.ts` | Orchestration |
| `routes.ts` | HTTP |
| `schemas.ts` | Zod |
| `jobs.ts` | Odoo sync job registration |
| `capability.ts` | Capability metadata |

### DealFlow frontend

| File | Responsibility |
| --- | --- |
| `api.ts` | HTTP client |
| `types.ts` | View models |
| `hooks.ts` | Data hooks |
| `format.ts` | Money/status labels |
| `components.tsx` | Shared DealFlow UI |
| `intelligence.ts` | Assistant rules |
| `test-fixtures.ts` | Tests |
| `*Page.tsx` | Routes in `frontend/index.ts` |

### Platform (selected)

| Path | Responsibility |
| --- | --- |
| `backend/src/app.ts` | createApp composition |
| `backend/src/problem/load.ts` | Runtime require problem module |
| `backend/src/problem/create-host.ts` | Host adapters |
| `backend/src/auth/` | JWT, password, cookies |
| `backend/src/rbac/` | Catalog, merge, middleware |
| `backend/src/security/` | Helmet, CORS, CSRF, SSRF, rate limit |
| `backend/src/jobs/` | Queue |
| `backend/src/realtime/` | SSE hub |
| `backend/src/notifications/` | Channels + templates |
| `backend/src/integrations/ai/` | Gemini + mock |
| `backend/src/integrations/odoo/` | JSON-2 adapter |
| `packages/api-contract/` | Envelopes, paths, flags |
| `frontend/src/auth/AuthProvider.tsx` | Session |
| `frontend/src/services/api.ts` | Fetch wrapper |
| `frontend/src/ui/` | Design system |

## Environment catalog complete

The following restates `docs/environment.md` for operators who only open the README. Secrets are placeholders. Full column semantics (Used by / Secret?) remain in that doc.

### Application

| Variable | Default / example |
| --- | --- |
| NODE_ENV | development |
| PORT | 5000 |
| HOST | 0.0.0.0 |
| APP_NAME | DealFlow360 |
| APP_URL | http://localhost:5000 |
| FRONTEND_URL | example file may list 5174; Vite serves **5173**; CORS lists both |
| LOG_LEVEL | info |
| SHUTDOWN_TIMEOUT_MS | 10000 |
| REQUEST_BODY_LIMIT | 1mb |
| VITE_API_URL | empty |
| API_PROXY_TARGET | http://localhost:5000 |
| SEED_ON_START | true in Compose |

### Data stores

| Variable | Notes |
| --- | --- |
| DATABASE_URL | Host 5433 / Compose postgres:5432 |
| DATABASE_POOL_MAX | 10 |
| DATABASE_POOL_TIMEOUT_SECONDS | 10 |
| POSTGRES_USER / PASSWORD / DB | Compose only; local placeholders |
| REDIS_URL | localhost:6379 / redis:6379 |

### Auth

| Variable | Notes |
| --- | --- |
| JWT_ACCESS_SECRET / JWT_REFRESH_SECRET | 32+ chars in production; placeholders locally |
| JWT_ACCESS_EXPIRES_IN | 15m |
| JWT_REFRESH_EXPIRES_IN | 7d |
| JWT_ISSUER / JWT_AUDIENCE | hackathon-starter-kit / …-api |
| AUTH_PASSWORD_* | min 8, bcrypt 12, complexity flags false |
| AUTH_DEFAULT_ROLE | user |
| AUTH_LOGIN_RATE_LIMIT_* | 5 email / 20 IP / 15m |
| AUTH_COOKIE_ENABLED | true |
| AUTH_COOKIE_SAMESITE | lax |
| OTP_* | digits 6, ttl 10m; OTP_HASH_SECRET required in prod when OTP on |

### Jobs

| Variable | Notes |
| --- | --- |
| JOB_MAX_ATTEMPTS | 3 |
| JOB_BACKOFF_MS | 200 |
| JOB_TIMEOUT_MS | 60000 |
| JOBS_PROCESS | false on Compose API; true on worker; unset for npm run dev |
| SCHEDULER_ENABLED | follows FEATURE_AUTOMATION |
| SCHEDULER_INTERVAL | 1m |
| SCHEDULER_POLL | 1s |

### Email / SMS / storage

| Variable | Demo truth |
| --- | --- |
| EMAIL_ENABLED | false |
| EMAIL_PROVIDER | smtp (mock when demo) |
| SMTP_* / RESEND_API_KEY / BREVO_API_KEY | empty |
| SMS_ENABLED / FEATURE_SMS | false |
| STORAGE_PROVIDER | local |
| STORAGE_SIGNING_SECRET | dedicated, not JWT |
| AWS_* | empty unless S3 |

### Security / CORS

| Variable | Demo truth |
| --- | --- |
| RATE_LIMIT_ENABLED | true |
| TRUST_PROXY | false (1 only behind nginx profile) |
| CORS_ORIGINS | 5173, 5174, 8080 localhost/127.0.0.1 |
| DEMO_MODE | true locally; false in production |
| ALLOW_DEMO_IN_PRODUCTION | never on a real tenant |

### Flags (`.env.example`)

| Flag | Value |
| --- | --- |
| FEATURE_AI | true (mock without key) |
| FEATURE_ODOO | false |
| FEATURE_AUTOMATION | true |
| FEATURE_NOTIFICATIONS | true |
| FEATURE_OTP | true |
| FEATURE_SMS | false |
| FEATURE_S3 | false |
| FEATURE_RAG | false |
| FEATURE_SEARCH | false |
| FEATURE_ANALYTICS | false |
| FEATURE_COPILOT | true |
| FEATURE_INTENTS | true |
| FEATURE_PROBLEM_INTELLIGENCE | true |
| FEATURE_CAPABILITY_RECOMMENDATIONS | true |
| FEATURE_PROJECT_PLANNING | true |
| FEATURE_PROJECT_GENERATOR | true |
| FEATURE_ANOMALY_DETECTION | false |
| FEATURE_REALTIME | true |
| FEATURE_PDF | true |

Odoo/AI extra knobs (`ODOO_TIMEOUT_MS`, `AI_MAX_OUTPUT_TOKENS`, RAG/search/analytics/anomaly/realtime numeric settings) are documented in `docs/environment.md` and remain optional. They are not required for the golden path.

CI/CD GitHub `vars`/`secrets` (`IMAGE_REGISTRY`, `DEPLOY_PROVIDER`, `HEALTHCHECK_URL`, …) are not loaded by `backend/src/config`. See [docs/ci-cd.md](docs/ci-cd.md).

## Judge and demo runbook

### Time box

| Minute | Goal |
| ---: | --- |
| 0–5 | Clone, npm install, deps:up, migrate, seed, npm run dev |
| 5–7 | /health and /ready; login staff |
| 7–20 | Golden path through lock |
| 20–25 | Show portal JSON missing risk; show 403 staff lock |
| 25–30 | Fulfillment split + hybrid billing |

### Talking points that match the code

1. PostgreSQL is the system of record.
2. Role ceilings are 403, not warnings.
3. Customer requests do not silently change price.
4. Manager replace, not stack.
5. Finalize then submit.
6. Finance lock consumes allocated stock.
7. Email mock is not `sent`.
8. AI is not on the price path.
9. Odoo is off.
10. No payments.

### What not to claim

- Live sale.order ids
- Card capture
- WCAG certification
- Production APM
- Screenshots that are not in git
- Awards

## Extended FAQ

### Why does staff 5% still need approval?

Default ceiling approvalPercent is 5% for unmatched hardware. Role ceiling and policy are different gates: role blocks writes; policy decides chain.

### Why did my chain have three steps?

Risk ≥ 70 or blended ≥ 20 selects Sales Manager → Finance → Final. Two approval-required lines can lift risk.

### Why is tax zero?

DEFAULT_GOVERNANCE.taxRatePercent is 0 until an admin patches governance.

### Can I use Yarn?

No. engine-strict npm only.

### Can I run without Docker?

Only if you provide Postgres 16 and Redis yourself and retarget URLs. Not the documented path.

### Why 5433?

Avoids native Postgres on 5432, especially on Windows.

### Why is FRONTEND_URL 5174 in the example file?

CORS allowlist includes 5174. Vite is 5173. Both are allowed.

### Does completeQuote collect money?

No.

### Does vendor-contact email a vendor?

The typed client result is delivered:false channel audit.

### Can operations users log in?

Role exists in merge; no demo user; seed deletes demo.operations@example.com.

### Is DF-00001 the golden path?

No. Isolation token only.

### Why 409 after lock when editing lines?

isCommerciallyLocked. Clone/revise path required for material commercial change.

### Why PDF is not JSON?

Binary stream with Content-Type application/pdf.

### Can I point VITE_API_URL at production from a laptop SPA?

You can, but CORS and cookies must match. Default is empty proxy.

### Does FEATURE_NOTIFICATIONS=false block customer emails?

DealFlow uses host.notifications.sendCustomerEmail; kit side effects may differ. Golden path still writes df_quote_email_deliveries. Keep flags as in .env.example for the judged demo.

### Is Redis optional on a laptop?

Ready checks skip unconfigured Redis, but production requires it. Compose hybrid sets REDIS_URL.

### What is JOBS_PROCESS on the API container?

false — the worker consumes. Local npm run dev leaves it unset so the API can consume.

### Can I enable Odoo mid-demo?

Not without credentials and flags. Health will fail if enabled without a server. Leave it false.

### Where are bcrypt costs in tests?

Tests use cost 4; runtime default 12; production min 10.

### How do I reset the book?

npm run db:seed (destructive to demo operational data as implemented by seed). db:reset is migrate reset --force.

### More operator questions

#### How do I add a SKU as staff?

Catalog write products.write: POST /catalog/products. Cannot change policies.

#### How do I change the 2pp material rule?

PATCH governance materialDiscountDeltaPp as admin.

#### How do I turn off loyalty stacking?

PATCH allowLoyaltyStacking false.

#### How do I inspect SSE?

GET /api/v1/realtime/events?channels=dashboard with Authorization. Browser uses fetch stream, not EventSource.

#### How do I run only DealFlow unit tests?

npm test -w @hackathon/problem

#### How do I see Prisma SQL?

LOG_LEVEL debug is not a Prisma query logger; NODE_ENV=test quiets Prisma. Use Prisma tracing only if you add it — not documented as default.

#### How do I backup local Docker Postgres?

pg_dump against localhost:5433; volume is docker-data/postgres. Treat as local only.

#### How do I avoid seeding on Compose?

SEED_ON_START=false

#### How do I create a production .env?

Copy example, set DEMO_MODE=false, unique JWT/storage secrets, real DATABASE_URL/REDIS_URL, CORS https origins, FEATURE_ODOO as intended.

#### How do I verify portal isolation in code?

portal-view.test.ts and problem.http.test.ts

---

End of extended handbook. Return to [Quick Start](#-quick-start), [API Reference](#-api-reference), or [Golden Demo](#-golden-demo).
