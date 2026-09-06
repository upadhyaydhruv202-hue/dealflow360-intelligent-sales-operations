# Hackathon module selection

DealFlow360 (this repository). Flags below match `.env.example` unless noted. Restart after `.env` changes. Confirm `GET /api/v1/features`.

Flags: [docs/features.md](docs/features.md). Capability catalog: [docs/capabilities.md](docs/capabilities.md).

## Golden path (one sentence)

Sales Rep quote → customer negotiation note → Manager revise/finalize → existing approval engine → provisional customer email → Finance lock → final bill email → fulfillment and hybrid billing.

## ENABLED

| Capability | Flag / notes | Why |
| --- | --- | --- |
| Auth + JWT | Always with `DATABASE_URL` | Login and portal are separate |
| RBAC | Always; DealFlow keys in `modules/problem` | Staff / manager / admin / user |
| PostgreSQL | `DATABASE_URL` | Quotes, stock, approvals |
| Validation / security / audit | Always | Backend-authoritative |
| UI kit + DealFlow pages | Always | `/dealflow`, `/portal/:token` |
| Demo mode | `DEMO_MODE=true` | Seeded users and mock fallbacks |
| AI toolkit | `FEATURE_AI=true` (mock without key) | Kit default; not required for pricing |
| Copilot / intents / problem intel / planning / generator | On in `.env.example` | Kit demo surfaces; not the golden path |
| Automation / notifications / OTP | On in `.env.example` | Kit defaults |
| PDF / reports | `FEATURE_PDF` (default on) | Kit |
| Background jobs | Queue always; Redis via Compose | Optional worker for DealFlow demo |
| Real-time SSE | `FEATURE_REALTIME=true` | Live DealFlow quote/approval/billing/anomaly updates |

## DISABLED (on purpose)

| Capability | Flag |
| --- | --- |
| Odoo | `FEATURE_ODOO=false` / `ODOO_ENABLED=false` |
| RAG | `FEATURE_RAG=false` |
| Search | `FEATURE_SEARCH=false` |
| Analytics | `FEATURE_ANALYTICS=false` |
| Anomaly insights | `FEATURE_ANOMALY_DETECTION=false` |
| SMS | `FEATURE_SMS=false` |
| S3 | `FEATURE_S3=false` / `STORAGE_PROVIDER=local` |
| Nginx profile | Compose `--profile nginx` (not started by default) |

## `.env` snippet

```bash
FEATURE_ODOO=false
FEATURE_AI=true
FEATURE_AUTOMATION=true
FEATURE_NOTIFICATIONS=true
FEATURE_OTP=true
FEATURE_SMS=false
FEATURE_S3=false
FEATURE_RAG=false
FEATURE_SEARCH=false
FEATURE_ANALYTICS=false
FEATURE_COPILOT=true
FEATURE_INTENTS=true
FEATURE_PROBLEM_INTELLIGENCE=true
FEATURE_CAPABILITY_RECOMMENDATIONS=true
FEATURE_PROJECT_PLANNING=true
FEATURE_PROJECT_GENERATOR=true
FEATURE_ANOMALY_DETECTION=false
FEATURE_REALTIME=true
FEATURE_PDF=true
DEMO_MODE=true
```
