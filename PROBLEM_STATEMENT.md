# Problem Statement

Filled for the completed DealFlow360 product. Golden path: [README.md](README.md#demo-workflow).

## Problem

Sales teams need one workspace that prices a mixed hardware + subscription quote, explains discount risk in business language, routes the right approvers, splits warehouse fulfillment (including backorder), generates hybrid billing, and lets the customer negotiate without seeing internal controls.

## Users

- Sales staff (create, submit, fulfill, bill, confirm)
- Sales manager (first approval step)
- Finance / final approver (admin in the seeded demo)
- Customer (token portal only)

## Actors

`demo.staff@example.com`, `demo.manager@example.com`, `demo.admin@example.com`, portal token holder. Customer login `demo.user@example.com` cannot open the staff workspace.

## Pain Points

Discount given without a visible ceiling, unclear who must approve, inventory shown as a single warehouse, one blended invoice for one-time and recurring, customer seeing internal risk/audit.

## Current Workflow

Implemented in `modules/problem` against PostgreSQL. FEATURE_ODOO is off; confirmation is local.

## Proposed Workflow

See README **Demo Workflow**: quote → discount violation → approval → upsell → warehouse split → hybrid billing → portal negotiation → re-approval → confirm → audit.

## Functional Requirements

MVP implemented: quotations, policy-based discounts, risk reasons + required chain, approvals, material-change re-approval, fulfillment split, backorder, one-time vs recurring billing, portal isolation, audit.

Out of scope in this build: live Odoo writes, payment collection, portal comments, delivery-date APIs.

## Non-Functional Requirements

Backend-authoritative RBAC. No secrets in the frontend. Standardized `/api/v1` envelopes. Demo mode must not behave as production.

## Odoo Modules

None required. Optional future: Odoo 19 JSON-2 via the existing allowlisted adapter (`FEATURE_ODOO`).

## Odoo Models

Not used while `FEATURE_ODOO=false`. Do not invent sale.order or invoice IDs.

## New Application Entities

Prisma `df_*` tables: customers, products, warehouses, stock, policies, chains, quotes, lines, assessments, approvals, fulfillment, billing, revisions, audit.

## AI Opportunities

Optional kit AI (mock when `DEMO_MODE` and no Gemini key). DealFlow pricing/approvals do not require a live LLM.

## Automation Opportunities

Kit jobs/Redis exist for email, PDF, and sync. The golden path does not require the worker process.

## Notification Requirements

Staff see API toasts. Portal is token-based. No payment or Odoo confirmation emails are sent by default.

## Reporting Requirements

Deal Health and Reports pages read live quote data. PDF kit remains available behind `FEATURE_PDF`.

## File/Document Requirements

None for the golden path. Kit storage stays local unless S3 is enabled.

## External Integrations

Odoo (disabled). Gemini (optional, mock fallback). Email/SMS off in `.env.example`.

## Authentication

JWT + seeded demo passwords (`demo-password`). Portal uses an unguessable token, not the customer JWT, for quote access.

## Authorization

`dealflow.*` permissions. Staff cannot approve. Customers cannot list staff quotes. Portal view strips risk, approvals, fulfillment internals, and audit.

## Security Requirements

No Odoo/Gemini keys in React. Unknown portal tokens 404. Do not weaken portal isolation for the demo.

## Expected Output

A judge can complete the golden path on seeded data without live Odoo or payments.

## Success Criteria

Discount → limit → variance → why → who is visible. Warehouse available = on-hand − reserved. Billing separates one-time and recurring. Negotiation recreates approvals on the server.
