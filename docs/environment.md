# Environment variables

This is the authoritative catalog of environment variables discovered from the repository (config schema, Docker, Vite, workers, tests, and GitHub Actions). Do not invent names that are not listed here.

Copy [`.env.example`](../.env.example) to `.env` for local development. Optional templates:

| File | Purpose |
| --- | --- |
| [`.env.example`](../.env.example) | Local development and Compose |
| [`.env.test.example`](../.env.test.example) | Copy to `.env.test` for backend tests (`hackathon_test`) |
| [`.env.demo.example`](../.env.demo.example) | Safe demo: mock AI/email/SMS/OTP, no paid providers |

Never commit `.env`, `.env.test`, or `.env.demo`. Never put real secrets in `*.example` files.

How values are loaded: [configuration.md](configuration.md). Feature flags: [features.md](features.md). CI/CD GitHub settings: [ci-cd.md](ci-cd.md).

## Public frontend vs server-only secrets

**Public frontend config** is limited to `VITE_API_URL`. Vite only exposes `import.meta.env.VITE_*` to the browser. The frontend Dockerfile bakes that one build-arg into the SPA.

**Server-only secrets** (JWT keys, API keys, SMTP passwords, AWS keys, Odoo keys, database URLs) are loaded by `backend/src/config`, Prisma, the worker, and Compose. They must never be given a `VITE_` prefix.

`API_PROXY_TARGET` is used only by the Vite **dev server** (`frontend/vite.config.ts`). It is not `VITE_`-prefixed and is not shipped in the production SPA.

## Required vs optional

**Always required in production** (`NODE_ENV=production`):

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_ACCESS_SECRET` (32+ characters)
- `JWT_REFRESH_SECRET` (32+ characters)
- `STORAGE_SIGNING_SECRET` (32+ characters)
- `AUTH_BCRYPT_COST` at least `10` (default `12` already satisfies this)

**Required in production when OTP is enabled:** `OTP_HASH_SECRET` (32+ characters).

**Required in development whenever `DATABASE_URL` is set** (non-test): `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET`.

**Required when a feature is enabled** — see each group below (Odoo, Gemini, email, HTTP SMS, S3).

Everything else has a schema default and can be omitted.

Local Compose also interpolates `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `SEED_ON_START`, and JWT placeholders. Those are not production secrets.

## How to disable features

Set the matching flag to `false` (or omit it; missing flags default to **off** except `FEATURE_PDF`, which defaults to **on**).

| To disable | Set |
| --- | --- |
| AI, documents LLM, copilot/intents/RAG answers | `FEATURE_AI=false` and `AI_ENABLED=false` |
| Odoo | `FEATURE_ODOO=false` and `ODOO_ENABLED=false` |
| Automation HTTP + event matching | `FEATURE_AUTOMATION=false` |
| Extra notification side effects | `FEATURE_NOTIFICATIONS=false` (inbox HTTP still works if the database is configured) |
| OTP and password-reset OTP | `FEATURE_OTP=false` |
| SMS | `FEATURE_SMS=false` and `SMS_ENABLED=false` |
| S3 | `FEATURE_S3=false` and `STORAGE_PROVIDER=local` (or `postgres`) |
| RAG | `FEATURE_RAG=false` |
| Search | `FEATURE_SEARCH=false` |
| Analytics | `FEATURE_ANALYTICS=false` |
| Copilot | `FEATURE_COPILOT=false` |
| Intents | `FEATURE_INTENTS=false` |
| Problem intelligence | `FEATURE_PROBLEM_INTELLIGENCE=false` |
| Capability recommendations | `FEATURE_CAPABILITY_RECOMMENDATIONS=false` |
| Project planning | `FEATURE_PROJECT_PLANNING=false` |
| Project generator | `FEATURE_PROJECT_GENERATOR=false` |
| Anomaly engine | `FEATURE_ANOMALY_DETECTION=false` |
| Real-time SSE | `FEATURE_REALTIME=false` in the registry; DealFlow360 `.env.example` sets `true` |
| PDF/report HTTP | `FEATURE_PDF=false` (jobs/automation can still render PDFs) |
| Email sending | `EMAIL_ENABLED=false` |
| Scheduler ticks | `SCHEDULER_ENABLED=false` |
| Job consumers in this process | `JOBS_PROCESS=false` |
| Demo mode | `DEMO_MODE=false` (defaults to on when `NODE_ENV` is not `production`) |

## Legend

| Column | Meaning |
| --- | --- |
| Required? | When the process refuses to start or the feature cannot run without it |
| Default | Value when the variable is omitted (`backend/src/config/schema.ts`) |
| Example | Safe placeholder from `.env.example` (not a real secret) |
| Used by | Code that reads it |
| Secret? | Treat as credential; do not log, commit, or expose to the frontend |
| Local? | Typical local/dev value |
| Production? | Whether production should set it |

---

## Application

| Variable | Purpose | Required? | Default | Example | Used by | Secret? | Local? | Production? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `NODE_ENV` | Runtime mode | No | `development` | `development` | API, worker, Prisma log, demo resolver | No | `development` | `production` |
| `PORT` | HTTP listen port | No | `5000` | `5000` | API | No | Yes | Yes |
| `HOST` | Bind address | No | `0.0.0.0` | `0.0.0.0` | API | No | Yes | Yes |
| `APP_NAME` | Process/log name | No | `DealFlow360` | `DealFlow360` | API, worker logger | No | Yes | Yes |
| `APP_URL` | Public API origin | No | `http://localhost:5000` | `http://localhost:5000` | API (links, health metadata) | No | Yes | Set to the public API URL |
| `FRONTEND_URL` | SPA origin | No | `http://localhost:5173` | `http://localhost:5173` | API | No | Yes | Set to the public SPA URL |
| `LOG_LEVEL` | pino level | No | `info` | `info` | API, worker | No | Yes | Yes (`info` or `warn`) |
| `SHUTDOWN_TIMEOUT_MS` | Forced-exit timeout | No | `10000` | `10000` | API, worker | No | Yes | Yes |
| `REQUEST_BODY_LIMIT` | Express JSON/urlencoded limit | No | `1mb` | `1mb` | API | No | Yes | Yes |
| `VITE_API_URL` | Public API base URL baked into the SPA | No | empty (proxy `/api`) | empty | Vite build, frontend `api.ts`, frontend Dockerfile, CD build-arg | No | Empty | Empty if nginx proxies `/api`; otherwise the public API origin |
| `API_PROXY_TARGET` | Vite dev-server proxy target | No | `http://localhost:5000` | unset | `frontend/vite.config.ts`; frontend Dockerfile development stage sets `http://backend:5000` | No | Optional | No (production frontend image does not run Vite) |
| `SEED_ON_START` | API container runs Prisma seed after migrate | No | `false` in entrypoint; Compose default `true` | `true` | `infra/docker/backend-entrypoint.cjs` | No | Yes | Usually `false` |

`VITEST` is set by the test runner (not an app setting). Prisma quiets query logs when `NODE_ENV=test` or `VITEST` is set.

---

## Database

| Variable | Purpose | Required? | Default | Example | Used by | Secret? | Local? | Production? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DATABASE_URL` | PostgreSQL connection string | Production always; Prisma migrate/seed; integration tests | unset | `postgresql://postgres:postgres@localhost:5433/hackathon` | API, worker, Prisma, tests, `db:test:prepare` | Yes (may embed a password) | Host port **5433** | Required; use a managed URL, not the Compose placeholder |
| `DATABASE_POOL_MAX` | Prisma `connection_limit` | No | `10` | `10` | API Prisma client | No | Yes | Tune to the pooler |
| `DATABASE_POOL_TIMEOUT_SECONDS` | Prisma `pool_timeout` | No | `10` | `10` | API Prisma client | No | Yes | Yes |
| `POSTGRES_USER` | Compose Postgres user | Compose interpolation only | `postgres` | `postgres` | `infra/docker-compose.yml` | Weak local credential | Yes | Do not reuse; production DB is not this Compose service |
| `POSTGRES_PASSWORD` | Compose Postgres password | Compose interpolation only | `postgres` | `postgres` | `infra/docker-compose.yml` | Yes (local placeholder) | Yes | Never in production |
| `POSTGRES_DB` | Compose database name | Compose interpolation only | `hackathon` | `hackathon` | `infra/docker-compose.yml` | No | Yes | N/A |

Compose **overrides** `DATABASE_URL` inside API/worker containers to `postgresql://…@postgres:5432/…`. Host Node uses localhost:5433.

---

## Redis

| Variable | Purpose | Required? | Default | Example | Used by | Secret? | Local? | Production? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `REDIS_URL` | Redis connection | Production always | unset | `redis://localhost:6379` | API, worker, BullMQ, KV, rate limits, OTP, Compose redis healthcheck | Yes if the URL has a password | `redis://localhost:6379` | Required |

Compose overrides container `REDIS_URL` to `redis://redis:6379`. Integration tests that need Redis uncomment it in `.env.test`.

---

## Authentication

| Variable | Purpose | Required? | Default | Example | Used by | Secret? | Local? | Production? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `JWT_ACCESS_SECRET` | Sign access tokens | Production; also when `DATABASE_URL` is set outside test | unset | `local-dev-access-secret-change-me-32b` | API | Yes | Placeholder only | Required, 32+ random bytes |
| `JWT_REFRESH_SECRET` | Sign refresh tokens | Same as access | unset | `local-dev-refresh-secret-change-me-32` | API | Yes | Placeholder only | Required, 32+ random bytes |
| `JWT_ACCESS_EXPIRES_IN` | Access TTL | No | `15m` | `15m` | API | No | Yes | Keep short |
| `JWT_REFRESH_EXPIRES_IN` | Refresh TTL | No | `7d` | `7d` | API | No | Yes | Yes |
| `JWT_ISSUER` | JWT `iss` | No | `hackathon-starter-kit` | `hackathon-starter-kit` | API | No | Yes | Yes |
| `JWT_AUDIENCE` | JWT `aud` | No | `hackathon-starter-kit-api` | `hackathon-starter-kit-api` | API | No | Yes | Yes |
| `AUTH_PASSWORD_MIN_LENGTH` | Password policy | No | `8` | `8` | API | No | Yes | Often raise |
| `AUTH_PASSWORD_MAX_LENGTH` | Password policy (bcrypt cap) | No | `72` | `72` | API | No | Yes | Yes |
| `AUTH_PASSWORD_REQUIRE_UPPERCASE` | Policy flag | No | `false` | `false` | API | No | Yes | Optional |
| `AUTH_PASSWORD_REQUIRE_LOWERCASE` | Policy flag | No | `false` | `false` | API | No | Yes | Optional |
| `AUTH_PASSWORD_REQUIRE_NUMBER` | Policy flag | No | `false` | `false` | API | No | Yes | Optional |
| `AUTH_PASSWORD_REQUIRE_SPECIAL` | Policy flag | No | `false` | `false` | API | No | Yes | Optional |
| `AUTH_BCRYPT_COST` | Hash cost | Production min `10` | `12` | `12` | API | No | `12`; tests use `4` | `10`–`15` |
| `AUTH_DEFAULT_ROLE` | Role assigned on register | No | `user` | `user` | API | No | Yes | Yes |
| `AUTH_LOGIN_RATE_LIMIT_MAX` | Per-email login attempts | No | `5` | `5` | API | No | Yes | Yes |
| `AUTH_LOGIN_IP_RATE_LIMIT_MAX` | Per-IP login attempts | No | `20` | `20` | API | No | Yes | Yes |
| `AUTH_LOGIN_RATE_LIMIT_WINDOW` | Login window | No | `15m` | `15m` | API | No | Yes | Yes |
| `AUTH_COOKIE_ENABLED` | Set httpOnly session cookies | No | `true` | `true` | API | No | Yes | Yes |
| `AUTH_COOKIE_SAMESITE` | Cookie SameSite | No | `lax` | `lax` | API | No | Yes | `lax` unless you have a documented cross-site SPA |
| `OTP_PROVIDER` | `auto` or `mock` | No | `auto` | `auto` | API | No | `auto` or `mock` | `auto`; `mock` only with demo mode |
| `OTP_DIGITS` | Code length | No | `6` | `6` | API | No | Yes | Yes |
| `OTP_TTL` | Code lifetime | No | `10m` | `10m` | API | No | Yes | Yes |
| `OTP_MAX_ATTEMPTS` | Verify attempts | No | `5` | `5` | API | No | Yes | Yes |
| `OTP_RESEND_COOLDOWN` | Resend throttle | No | `60s` | `60s` | API | No | Yes | Yes |
| `OTP_RATE_LIMIT_MAX` | Per-destination OTP requests | No | `5` | `5` | API | No | Yes | Yes |
| `OTP_IP_RATE_LIMIT_MAX` | Per-IP OTP requests | No | `20` | `20` | API | No | Yes | Yes |
| `OTP_RATE_LIMIT_WINDOW` | OTP window | No | `15m` | `15m` | API | No | Yes | Yes |
| `OTP_HASH_SECRET` | HMAC for stored OTP hashes | Production when `FEATURE_OTP=true` | isolated dev fallback, never JWT | unset | API | Yes | Optional | Required, 32+ when OTP is on |

OTP HTTP is off unless `FEATURE_OTP=true`. See [otp.md](otp.md).

---

## Odoo

Enabled when `ODOO_ENABLED=true` or `FEATURE_ODOO=true`. See [odoo.md](odoo.md).

| Variable | Purpose | Required? | Default | Example | Used by | Secret? | Local? | Production? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ODOO_ENABLED` | Alias for Odoo feature | No | `false` | `false` | API | No | Off unless integrating | When using Odoo |
| `ODOO_BASE_URL` | Odoo origin | When Odoo is enabled (production check) | unset | empty | API Odoo client | No | Empty | Required if enabled |
| `ODOO_DATABASE` | Odoo DB name | When enabled | unset | empty | API | No | Empty | Required if enabled |
| `ODOO_API_KEY` | Odoo JSON-2 API key | When enabled | unset | empty | API | Yes | Empty | Required if enabled |
| `ODOO_TIMEOUT_MS` | HTTP timeout | No | `15000` | `15000` | API | No | Yes | Yes |
| `ODOO_MAX_RETRIES` | Retries | No | `2` | `2` | API | No | Yes | Yes |
| `ODOO_RETRY_BASE_MS` | Backoff base | No | `200` | `200` | API | No | Yes | Yes |

---

## AI

Enabled when `AI_ENABLED=true` or `FEATURE_AI=true`. Demo/test without `GEMINI_API_KEY` uses the mock provider. See [ai.md](ai.md).

| Variable | Purpose | Required? | Default | Example | Used by | Secret? | Local? | Production? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `AI_ENABLED` | Alias for AI feature | No | `false` | `true` (local demo) | API, worker | No | Often on | Only if the product uses AI |
| `AI_PROVIDER` | `gemini` or `mock` | No | `gemini` | `gemini` | API | No | `gemini` or `mock` | `gemini` unless demo is explicitly allowed |
| `AI_MODEL` | Override model id | No | unset (`gemini-2.5-flash` for Gemini) | empty | API | No | Optional | Optional |
| `GEMINI_API_KEY` | Gemini credential | Production when AI is on and provider is `gemini` | unset | empty | API | Yes | Empty → mock in demo | Required if Gemini is used |
| `AI_TIMEOUT_MS` | Provider timeout | No | `30000` | `30000` | API | No | Yes | Yes |
| `AI_MAX_OUTPUT_TOKENS` | Generation cap | No | `4096` | `4096` | API | No | Yes | Yes |
| `AI_TEMPERATURE` | Sampling | No | `0.2` | `0.2` | API | No | Yes | Yes |
| `AI_MAX_RETRIES` | Retries | No | `2` | `2` | API | No | Yes | Yes |
| `AI_RETRY_BASE_MS` | Backoff base | No | `200` | `200` | API | No | Yes | Yes |

RAG (only when `FEATURE_RAG=true`): [rag.md](rag.md).

| Variable | Purpose | Required? | Default | Example | Used by | Secret? | Local? | Production? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `RAG_VECTOR_STORE` | `memory` or `postgres` | No | `postgres` if `DATABASE_URL` else `memory` | commented | API, worker | No | Optional | Prefer `postgres` |
| `RAG_CHUNK_SIZE` | Chunk size | No | `800` | commented | API | No | Optional | Optional |
| `RAG_CHUNK_OVERLAP` | Overlap | No | `120` | commented | API | No | Optional | Optional |
| `RAG_TOP_K` | Retrieve K | No | `5` | commented | API | No | Optional | Optional |
| `RAG_MIN_SCORE` | Score floor | No | `0.28` | commented | API | No | Optional | Optional |
| `RAG_MAX_CONTEXT_CHARS` | Context budget | No | `12000` | commented | API | No | Optional | Optional |
| `RAG_MAX_DOCUMENT_CHARS` | Index cap | No | `100000` | commented | API | No | Optional | Optional |
| `RAG_MAX_CHUNKS_PER_DOCUMENT` | Chunk cap | No | `200` | commented | API | No | Optional | Optional |
| `RAG_ASYNC_THRESHOLD_CHARS` | Async index threshold | No | `20000` | commented | API | No | Optional | Optional |

Search (only when `FEATURE_SEARCH=true`): [search.md](search.md). Elasticsearch is not implemented; keep using `SearchService`.
Analytics (only when `FEATURE_ANALYTICS=true`): [analytics.md](analytics.md). Warehouses are not implemented; keep using `AnalyticsService`.

| Variable | Purpose | Required? | Default | Example | Used by | Secret? | Local? | Production? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `SEARCH_PROVIDER` | `postgres` or `memory` | No | `postgres` if `DATABASE_URL` else `memory` | commented | API, worker | No | Optional | Prefer `postgres` |
| `SEARCH_FUZZY_THRESHOLD` | Trigram similarity floor | No | `0.3` | commented | API | No | Optional | Optional |
| `ANALYTICS_PROVIDER` | `postgres` or `memory` | No | `postgres` if `DATABASE_URL` else `memory` | commented | API, worker | No | Optional | Prefer `postgres` |
| `ANALYTICS_MAX_RANGE_DAYS` | Max query window | No | `90` | commented | API | No | Optional | Optional |
| `ANALYTICS_MAX_SERIES_POINTS` | Max time-series buckets | No | `366` | commented | API | No | Optional | Optional |
| `ANALYTICS_MAX_EXPORT_ROWS` | Max export rows | No | `1000` | commented | API | No | Optional | Optional |

Anomaly engine (only when `FEATURE_ANOMALY_DETECTION=true`): [anomaly.md](anomaly.md).

| Variable | Purpose | Required? | Default | Example | Used by | Secret? | Local? | Production? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `ANOMALY_ZSCORE_MIN_SAMPLES` | Min points for z-score | No | `8` | commented | API | No | Optional | Optional |
| `ANOMALY_ZSCORE_THRESHOLD` | Z-score flag | No | `2` | commented | API | No | Optional | Optional |
| `ANOMALY_ZSCORE_HIGH` | High severity z-score | No | `3` | commented | API | No | Optional | Optional |
| `ANOMALY_PERCENT_CHANGE_LOW` | % change low | No | `10` | commented | API | No | Optional | Optional |
| `ANOMALY_PERCENT_CHANGE_MEDIUM` | % change medium | No | `15` | commented | API | No | Optional | Optional |
| `ANOMALY_PERCENT_CHANGE_HIGH` | % change high | No | `20` | commented | API | No | Optional | Optional |
| `ANOMALY_MOVING_AVERAGE_WINDOW` | MA window | No | `5` | commented | API | No | Optional | Optional |
| `ANOMALY_MOVING_AVERAGE_DEVIATION_PCT` | MA deviation % | No | `15` | commented | API | No | Optional | Optional |
| `ANOMALY_TREND_WINDOW` | Trend window | No | `5` | commented | API | No | Optional | Optional |
| `ANOMALY_MAX_POINTS` | Series cap | No | `500` | commented | API | No | Optional | Optional |
| `ANOMALY_EXPLAIN` | Optional AI explanation | No | `true` | commented | API | No | Optional | Optional |

Realtime SSE (only when `FEATURE_REALTIME=true`): [realtime.md](realtime.md). REST polling stays available when the flag is off.

| Variable | Purpose | Required? | Default | Example | Used by | Secret? | Local? | Production? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `REALTIME_HEARTBEAT` | SSE comment interval | No | `15s` | commented | API | No | Optional | Optional |
| `REALTIME_MAX_CONNECTIONS` | Process connection cap | No | `200` | commented | API | No | Optional | Optional |
| `REALTIME_MAX_CONNECTIONS_PER_USER` | Per-user connection cap | No | `5` | commented | API | No | Optional | Optional |

---

## Email

Sending is off unless `EMAIL_ENABLED=true`. Demo/test uses the mock provider. See [email.md](email.md).

| Variable | Purpose | Required? | Default | Example | Used by | Secret? | Local? | Production? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `EMAIL_ENABLED` | Turn on sending | No | `false` | `false` | API, worker | No | Usually off | When sending mail |
| `EMAIL_PROVIDER` | `smtp`, `resend`, `brevo`, `mock` | No | `smtp` | `smtp` | API | No | `smtp` or `mock` | Real provider; `mock` only with demo |
| `EMAIL_FROM` | From address | When email is enabled (or `SMTP_FROM`) | unset | empty | API | No | Empty | Required if enabled |
| `EMAIL_TIMEOUT_MS` | Provider timeout | No | `10000` | `10000` | API | No | Yes | Yes |
| `SMTP_HOST` | SMTP host | Production when email + SMTP | unset | empty | API | No | Empty | Required for SMTP |
| `SMTP_PORT` | SMTP port | No | `587` | `587` | API | No | Yes | Yes |
| `SMTP_USER` | SMTP username | No | unset | empty | API | Yes | Empty | If the server requires auth |
| `SMTP_PASSWORD` | SMTP password | No | unset | empty | API | Yes | Empty | If the server requires auth |
| `SMTP_FROM` | Fallback From | Same as `EMAIL_FROM` | unset | empty | API | No | Empty | Optional if `EMAIL_FROM` is set |
| `RESEND_API_KEY` | Resend | Production when provider is `resend` | unset | empty | API | Yes | Empty | Required for Resend |
| `BREVO_API_KEY` | Brevo | Production when provider is `brevo` | unset | empty | API | Yes | Empty | Required for Brevo |

---

## SMS

Enabled when `SMS_ENABLED=true` or `FEATURE_SMS=true`. See [sms.md](sms.md).

| Variable | Purpose | Required? | Default | Example | Used by | Secret? | Local? | Production? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `SMS_ENABLED` | Alias for SMS feature | No | `false` | `false` | API | No | Off | When sending SMS |
| `SMS_PROVIDER` | `mock` or `http` | No | `mock` | `mock` | API | No | `mock` | `http` unless demo |
| `SMS_API_KEY` | HTTP SMS credential | Production when provider is `http` | unset | empty | API | Yes | Empty | Required for `http` |
| `SMS_FROM` | Sender id | No | unset | empty | API | No | Empty | Usually required by the gateway |
| `SMS_HTTP_URL` | Gateway URL | Production when provider is `http` | unset | empty | API | No | Empty | Required for `http` |
| `SMS_TIMEOUT_MS` | Timeout | No | `10000` | `10000` | API | No | Yes | Yes |

---

## Storage

Document intelligence size limits live here because they share the upload path. See [storage.md](storage.md) and [documents.md](documents.md).

| Variable | Purpose | Required? | Default | Example | Used by | Secret? | Local? | Production? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `STORAGE_PROVIDER` | `local`, `s3`, or `postgres` | No | `local` | `local` | API, worker | No | `local` | `s3` or `postgres` for multi-host |
| `STORAGE_LOCAL_DIR` | Disk directory (relative to backend package) | No | `storage` | `storage` | API | No | Yes | If using `local` |
| `STORAGE_MAX_BYTES` | Upload cap | No | `10485760` | `10485760` | API | No | Yes | Yes |
| `STORAGE_SIGNED_URL_EXPIRES` | Signed URL TTL (seconds) | No | `300` | `300` | API | No | Yes | Yes |
| `STORAGE_SIGNING_SECRET` | HMAC for local/postgres signed URLs | Production always | isolated dev fallback, never JWT | `local-dev-storage-signing-secret-change-me` | API | Yes | Placeholder only | Required, 32+ random bytes |
| `DOCUMENT_MAX_BYTES` | Document upload cap | No | `10485760` | `10485760` | API | No | Yes | Yes |
| `DOCUMENT_MAX_TEXT_CHARS` | Extracted text cap | No | `100000` | `100000` | API | No | Yes | Yes |
| `DOCUMENT_CONFIDENCE_THRESHOLD` | Extraction confidence | No | `0.7` | `0.7` | API | No | Yes | Yes |
| `DOCUMENT_ASYNC_THRESHOLD_BYTES` | Async analysis threshold | No | `1048576` | `1048576` | API | No | Yes | Yes |
| `AWS_REGION` | S3 region | No | unset (`us-east-1` on the S3 client) | `us-east-1` | API | No | Optional | When using S3 |
| `AWS_ACCESS_KEY_ID` | S3 key | Production when S3 is enabled | unset | empty | API | Yes | Empty | Required for S3 |
| `AWS_SECRET_ACCESS_KEY` | S3 secret | Production when S3 is enabled | unset | empty | API | Yes | Empty | Required for S3 |
| `AWS_S3_BUCKET` | Bucket name | Production when S3 is enabled | unset | empty | API | No | Empty | Required for S3 |

S3 is enabled when `STORAGE_PROVIDER=s3` or `FEATURE_S3=true`.

---

## PDF

PDF has no provider credentials. Rendering is in-process. Disable HTTP with `FEATURE_PDF=false`. See [pdf.md](pdf.md) and [reports.md](reports.md).

| Variable | Purpose | Required? | Default | Example | Used by | Secret? | Local? | Production? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FEATURE_PDF` | PDF generate and report HTTP | No | `true` (registry) | `true` | API | No | On | On unless you want those routes off |

---

## Jobs

| Variable | Purpose | Required? | Default | Example | Used by | Secret? | Local? | Production? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `JOB_MAX_ATTEMPTS` | Default attempts | No | `3` | `3` | API, worker | No | Yes | Yes |
| `JOB_BACKOFF_MS` | Exponential backoff base | No | `200` | `200` | API, worker | No | Yes | Yes |
| `JOB_TIMEOUT_MS` | Per-attempt timeout | No | `60000` | `60000` | API, worker | No | Yes | Yes |
| `JOBS_PROCESS` | Register queue consumers in this process | No | `true` | commented; Compose sets `false` on API, `true` on worker | API vs worker | No | Unset for `npm run dev` | `false` on API replicas, `true` on worker |
| `SCHEDULER_ENABLED` | Clock that emits `scheduled` events | No | follows `FEATURE_AUTOMATION` | commented | API | No | Optional | Optional |
| `SCHEDULER_INTERVAL` | Default tick schedule (`0s` disables) | No | `1m` | `1m` | API | No | Yes | Yes |
| `SCHEDULER_POLL` | How often due schedules are checked | No | `1s` | `1s` | API | No | Yes | Yes |

---

## Security

| Variable | Purpose | Required? | Default | Example | Used by | Secret? | Local? | Production? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `RATE_LIMIT_ENABLED` | Categorized rate limits | No | `true` | `true` | API | No | Yes | Yes |
| `RATE_LIMIT_FAIL_CLOSED` | Reject when the store fails | No | `true` in production, `false` otherwise | empty | API | No | Optional | Prefer `true` |
| `RATE_LIMIT_AUTH_MAX` / `RATE_LIMIT_AUTH_WINDOW` | Register, refresh, logout | No | `20` / `15m` | same | API | No | Yes | Yes |
| `RATE_LIMIT_AI_MAX` / `RATE_LIMIT_AI_WINDOW` | AI and copilot | No | `20` / `1m` | same | API | No | Yes | Yes |
| `RATE_LIMIT_UPLOAD_MAX` / `RATE_LIMIT_UPLOAD_WINDOW` | File and document uploads | No | `10` / `15m` | same | API | No | Yes | Yes |
| `RATE_LIMIT_PUBLIC_MAX` / `RATE_LIMIT_PUBLIC_WINDOW` | Unauthenticated `/api/v1` | No | `60` / `1m` | same | API | No | Yes | Yes |
| `RATE_LIMIT_AUTHENTICATED_MAX` / `RATE_LIMIT_AUTHENTICATED_WINDOW` | Bearer APIs | No | `120` / `1m` | same | API | No | Yes | Yes |
| `RATE_LIMIT_ADMIN_MAX` / `RATE_LIMIT_ADMIN_WINDOW` | RBAC catalog | No | `30` / `1m` | same | API | No | Yes | Yes |
| `AUTH_PASSWORD_RESET_RATE_LIMIT_MAX` | Per email | No | `5` | `5` | API | No | Yes | Yes |
| `AUTH_PASSWORD_RESET_IP_RATE_LIMIT_MAX` | Per IP | No | `20` | `20` | API | No | Yes | Yes |
| `AUTH_PASSWORD_RESET_RATE_LIMIT_WINDOW` | Window | No | `15m` | `15m` | API | No | Yes | Yes |
| `TRUST_PROXY` | Express `trust proxy` | No | `false` | `false` or `1` behind nginx | API | No | `false` | `1` only behind a stripping proxy |

---

## CORS

| Variable | Purpose | Required? | Default | Example | Used by | Secret? | Local? | Production? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `CORS_ORIGINS` | Comma-separated allowed origins | Schema requires a non-empty string | `http://localhost:5173` | `http://localhost:5173,http://localhost:8080` | API | No | Include Vite and optional nginx `:8080` | Explicit https origins only. `*` is rejected |

---

## Feature flags

Missing flags default to **false** except `FEATURE_PDF` (**true**). `.env.example` turns common local-demo flags on. Aliases: `AI_ENABLED`, `ODOO_ENABLED`, `SMS_ENABLED`; `STORAGE_PROVIDER=s3` also enables S3.

| Variable | Purpose | Required? | Default | Example | Used by | Secret? | Local? | Production? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FEATURE_AI` | LLM toolkit and document intelligence | No | `false` | `true` | API, worker | No | Demo on | Only if needed |
| `FEATURE_ODOO` | Odoo JSON-2 | No | `false` | `false` | API | No | Off | Only if needed |
| `FEATURE_AUTOMATION` | Workflows and automation HTTP | No | `false` | `true` | API, worker | No | Demo on | Only if needed |
| `FEATURE_NOTIFICATIONS` | Extra notification side effects | No | `false` | `true` | API | No | Demo on | Optional |
| `FEATURE_OTP` | OTP HTTP and password reset | No | `false` | `true` | API | No | Demo on | Only if needed |
| `FEATURE_SMS` | SMS channel | No | `false` | `false` | API | No | Off | Only if needed |
| `FEATURE_S3` | Require AWS S3 secrets | No | `false` | `false` | API | No | Off | With S3 |
| `FEATURE_RAG` | Semantic search | No | `false` | `false` | API, worker | No | Off | Only if needed |
| `FEATURE_SEARCH` | Keyword / full-text search | No | `false` | `false` | API, worker | No | Off | Only if needed |
| `FEATURE_ANALYTICS` | KPIs, time-series, dashboards, exports | No | `false` | `false` | API, worker | No | Off | Only if needed |
| `FEATURE_COPILOT` | Copilot HTTP/UI | No | `false` | `true` | API | No | Demo on | Only if needed |
| `FEATURE_INTENTS` | Natural-language actions | No | `false` | `true` | API | No | Demo on | Only if needed |
| `FEATURE_PROBLEM_INTELLIGENCE` | Problem-statement analysis | No | `false` | `true` | API | No | Demo on | Only if needed |
| `FEATURE_CAPABILITY_RECOMMENDATIONS` | Advisory capability recommendations | No | `false` | `true` | API | No | Demo on | Only if needed |
| `FEATURE_PROJECT_PLANNING` | Project planning and validated Project Configuration | No | `false` | `true` | API | No | Demo on | Only if needed |
| `FEATURE_PROJECT_GENERATOR` | Deterministic project overlay from an approved configuration | No | `false` | `true` | API | No | Demo on | Only if needed |
| `FEATURE_ANOMALY_DETECTION` | Anomaly HTTP | No | `false` | `false` | API | No | Off | Only if needed |
| `FEATURE_REALTIME` | Allowlisted SSE live status | No | `false` in the feature registry; `true` in DealFlow360 `.env.example` | `true` | API, worker | No | On | **`true` for DealFlow360** so quote/approval/billing/anomaly updates push over SSE |
| `FEATURE_PDF` | PDF/report HTTP | No | `true` | `true` | API | No | On | On unless disabled |

Copilot, intents, problem intelligence, and RAG also need a ready AI provider at runtime (`FEATURE_AI` / `AI_ENABLED`).

---

## Demo mode

| Variable | Purpose | Required? | Default | Example | Used by | Secret? | Local? | Production? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `DEMO_MODE` | Mock outbound providers; optional demo seed users | No | `true` when `NODE_ENV` is not `production` | `true` | API, seed | No | `true` | `false` on real tenants |
| `ALLOW_DEMO_IN_PRODUCTION` | Permit demo when `NODE_ENV=production` | Required **in addition** to `DEMO_MODE=true` in production | `false` | commented `false` | API | No | Unset | **Never** on a real tenant |

Production refuses `AI_PROVIDER=mock`, `EMAIL_PROVIDER=mock`, `SMS_PROVIDER=mock`, and `OTP_PROVIDER=mock` unless demo mode is allowed that way.

---

## CI/CD

These are **not** loaded by `backend/src/config`. They are GitHub Actions variables/secrets or script env. Do not put application JWT/Odoo/AI/SMTP/AWS keys in workflow YAML. See [ci-cd.md](ci-cd.md).

### GitHub variables (`vars`)

| Variable | Purpose | Required? | Default | Example | Used by | Secret? | Local? | Production? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `IMAGE_REGISTRY` | Registry host | No | `ghcr.io` | `ghcr.io` | CD prepare | No | No | Optional override |
| `IMAGE_PREFIX` | `prefix/backend` and `prefix/frontend` | No | `ghcr.io/<lowercase repo>` | — | CD prepare | No | No | Optional |
| `VITE_API_URL` | Frontend image build-arg | No | empty | empty | CD frontend build | No | Same as app | Empty if the edge proxies `/api` |
| `DEPLOY_PROVIDER` | `none`, `webhook`, or `command` | No | `none` | `none` | `infra/scripts/deploy.mjs` | No | No | Set when applying a release |
| `DEPLOY_COMMAND` | Shell for `command` provider | When provider is `command` | unset | — | `deploy.mjs` | Treat as sensitive | No | If using `command` |
| `DEPLOY_WEBHOOK_TIMEOUT_MS` | Webhook POST timeout | No | `15000` | `15000` | `deploy.mjs` | No | No | Optional |
| `DEPLOY_URL` | Shown on the GitHub Environment | No | unset | `https://app.example.com` | CD environment url | No | No | Optional |
| `HEALTHCHECK_URL` | Post-deploy `/health` | Required for `webhook`/`command` if no ready URL | unset | `https://api.example.com/health` | `infra/scripts/healthcheck.mjs` | No | No | Required after a remote apply |
| `READYCHECK_URL` | Post-deploy `/ready` | Same | unset | `https://api.example.com/ready` | `healthcheck.mjs` | No | No | Recommended |
| `HEALTHCHECK_RETRIES` | Probe attempts | No | `12` | `12` | `healthcheck.mjs` | No | No | Optional |
| `HEALTHCHECK_INTERVAL_MS` | Delay between attempts | No | `5000` | `5000` | `healthcheck.mjs` | No | No | Optional |
| `HEALTHCHECK_TIMEOUT_MS` | Per-probe timeout | No | `5000` | `5000` | `healthcheck.mjs` | No | No | Optional |
| `CD_AUTO_DEPLOY` | Deploy after CI on `main` | No | unset (off) | `true` | CD workflow | No | No | Staging only recommended |
| `CD_AUTO_ENVIRONMENT` | Auto-deploy target | No | `staging` | `staging` | CD workflow | No | No | Do not point at production casually |
| `AUDIT_CONTINUE_ON_ERROR` | `npm audit` gate | No | unset (continue) | `false` to fail | CI | No | No | Optional |

### GitHub secrets (`secrets`)

| Variable | Purpose | Required? | Default | Example | Used by | Secret? | Local? | Production? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `GITHUB_TOKEN` | Automatic; GHCR push | Provided by GitHub | — | — | CD login | Yes | No | Automatic |
| `REGISTRY_USERNAME` | Custom registry user | If not using GHCR defaults | unset (actor) | — | CD login | Yes | No | Custom registry |
| `REGISTRY_PASSWORD` | Custom registry token | If not using `GITHUB_TOKEN` | unset | — | CD login | Yes | No | Custom registry |
| `DEPLOY_WEBHOOK_URL` | Apply webhook | When `DEPLOY_PROVIDER=webhook` | unset | — | `deploy.mjs` | Yes | No | If using webhook |
| `DEPLOY_WEBHOOK_TOKEN` | Optional Bearer | No | unset | — | `deploy.mjs` | Yes | No | Optional |

### Injected by the CD workflow (not repository settings)

| Variable | Purpose | Used by |
| --- | --- | --- |
| `DEPLOY_ENVIRONMENT` | `staging` or `production` | `deploy.mjs` payload |
| `BACKEND_IMAGE` / `FRONTEND_IMAGE` | Image coordinates | `deploy.mjs` |
| `GIT_SHA` | Revision | `deploy.mjs` |
| `GITHUB_REPOSITORY` | `owner/repo` | `deploy.mjs` (GitHub-provided) |

### Local smoke (Compose validation)

| Variable | Purpose | Required? | Default | Example | Used by | Secret? | Local? | Production? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `SMOKE_API_URL` | Smoke API base | No | `http://127.0.0.1:5000` | unset | `infra/scripts/smoke.mjs` | No | Optional | No |
| `SMOKE_FRONTEND_URL` | Smoke SPA base | No | `http://127.0.0.1:5173` | unset | `smoke.mjs` | No | Optional | No |

CI Verify also sets `DATABASE_URL` and `REDIS_URL` for the service containers (test credentials `postgres`/`hackathon_test`, not production).

---

## Runtime notes (not application config)

| Name | Where | Notes |
| --- | --- | --- |
| `PATH` | `backend-entrypoint.cjs` | Prepends `node_modules/.bin` |
| `VITEST` | Vitest | Quiets Prisma logs in tests |
| `NODE_ENV` in Dockerfiles | backend image | `development` or `production` stage |

---

## Tests

`backend/tests/infra/env-catalog.test.ts` asserts:

- Every key in `envSchema` appears in `.env.example`
- `.env.example` extra keys are only the documented Compose/Vite names
- The frontend bundle surface is `VITE_API_URL` only
- No secret name is `VITE_`-prefixed
