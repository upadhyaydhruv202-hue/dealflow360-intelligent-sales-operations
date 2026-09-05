# Security

This starter kit includes reusable hardening for a typical hackathon API. It is **not** a claim that the application is fully secure. Treat the controls as a baseline, then review them against the problem statement, threat model, and deployment.

## Assumptions

* The API is reached over HTTPS in production (Helmet HSTS only runs when `NODE_ENV=production`).
* `TRUST_PROXY` defaults to **false**. Set `TRUST_PROXY=1` only behind a reverse proxy that **overwrites** `X-Forwarded-For` (the optional nginx Compose profile). Do not enable it when clients can reach the API port directly.
* Browser sessions use httpOnly `hsk_access` / `hsk_refresh` cookies (default `AUTH_COOKIE_ENABLED=true`, `SameSite=Lax`) plus an in-memory access token for `Authorization: Bearer`. JSON tokens remain in login/refresh bodies for non-browser clients.
* Cookie-only mutating requests must send a trusted `Origin` or `Referer`. Bearer requests skip that CSRF check.
* Redis is required in production. In-memory rate-limit, KV, and revocation stores are refused when `NODE_ENV=production`.
* Odoo, SMS, SMTP, and AI base URLs are operator-configured, not chosen by end users. User-controlled URLs (notification and automation webhooks) go through SSRF checks, including DNS pinning on connect when undici is available.
* Copilot tools, Odoo capabilities, and automation actions are allowlisted in code. Problem-specific tools must use the same registries.

## HTTP controls

| Control | Behavior |
| --- | --- |
| Headers | Helmet CSP `default-src 'none'`, frame deny, `nosniff`, no referrer, HSTS in production |
| CORS | `CORS_ORIGINS` allowlist only. `*` is rejected. Credentials are allowed for listed origins |
| CSRF | Cookie-only POST/PUT/PATCH/DELETE require `Origin`/`Referer` in `CORS_ORIGINS`, `APP_URL`, or `FRONTEND_URL` |
| Cookies | httpOnly session cookies; `Secure` in production; `SameSite=Lax` by default (`none` forces `Secure`) |
| Body size | `REQUEST_BODY_LIMIT` (default `1mb`) for JSON and urlencoded bodies |
| Uploads | Multer memory storage, one file, purpose-specific MIME/magic-byte checks, path-safe filenames |
| Errors | Operational `AppError` messages are sanitized. Unhandled errors return a generic 500 with no stack |

Health and readiness stay outside `/api/v1` and are not rate-limited, so probes are not starved by API traffic. Readiness error strings are sanitized. Durable audit events are listed at `GET /api/v1/audit` for callers with `audit.read`. See [audit.md](audit.md) and [observability.md](observability.md).

## Rate-limit categories

`RATE_LIMIT_ENABLED` (default `true`) turns the abstraction on. Redis backs counters when a Redis client is configured. Production **does not** fall back to in-memory stores.

| Category | Default | Key | Typical routes |
| --- | --- | --- | --- |
| Public APIs | 60 / 1m | IP | `GET /api/v1`, register, refresh, logout |
| Authentication | 20 / 15m | IP | register, refresh, logout |
| Login brute force | 5 / email and 20 / IP per 15m | email + IP | `POST /auth/login` (`DEMO_MODE` skips this only for seeded `demo.*@example.com` accounts) |
| OTP | 5 / destination and 20 / IP per 15m | destination + IP | OTP request/verify |
| Password reset brute force | 5 / email and 20 / IP per 15m | email + IP | password-reset request/confirm |
| Authenticated APIs | 120 / 1m | user | All Bearer-protected routes |
| Admin APIs | 30 / 1m | user | RBAC catalog writes/reads |
| AI | 20 / 1m | user | `/ai/*`, `/copilot/*`, `/intents/*`, `/rag/*`, `/anomalies/*` |
| File upload | 10 / 15m | user | `POST /files`, `POST /documents/analyze` |

If the store fails, production **fails closed** (`RATE_LIMIT_FAIL_CLOSED` defaults to true when `NODE_ENV=production`). Development and test fail open so a local Redis outage does not block work.

## Authentication and authorization

Protected `/api/v1` routes run `authenticate()` then RBAC (`requirePermission` / `authorizeRole`). `authenticate()` accepts `Authorization: Bearer` **or** the `hsk_access` cookie. Public auth routes are register, login, refresh, logout, OTP, and password reset.

Password reset (`FEATURE_OTP=true`):

1. `POST /api/v1/auth/password-reset/request` `{ "email": "ada@example.com" }` always returns the same envelope whether the account exists.
2. `POST /api/v1/auth/password-reset/confirm` `{ "email", "code", "password" }` verifies the `password-reset` OTP, updates the hash, and revokes refresh tokens **and access tokens** issued before the reset.

Logout revokes the refresh-token family and clears session cookies. When `Authorization: Bearer` or an access cookie is present, that access token's `jti` is denylisted until it would have expired. Keep `JWT_ACCESS_EXPIRES_IN` short so a stolen access token without a matching logout still ages out quickly.

## External requests

User-controlled URLs are validated before fetch:

* `http` / `https` only
* no embedded credentials
* ports 80 and 443 only
* loopback, private, link-local, CGNAT, metadata, and `.internal` / `.localhost` hosts blocked
* DNS lookup of hostnames; any resolved address that is private/loopback is blocked
* connect DNS pinned to the first validated address via Node's HTTP(S) agent `lookup` (TLS SNI still uses the original hostname)
* `redirect: 'error'`
* timeout (webhook defaults are 5s)

Operator-configured URLs (Odoo, SMS HTTP gateway, email providers) require `http`/`https` and a timeout but may target private hosts for on-prem hackathon setups.

## AI and Odoo

AI output is untrusted text/JSON. It is schema-validated and never executed as SQL, shell, or arbitrary Odoo methods:

```text
AI → validated tool request → authorization → execution → audit
```

Copilot can only invoke registered tools; names such as `executeSql` and `shell` cannot be registered. High-risk AI actions require an application confirmation flag (`confirmed: true`); a `confirm` field inside tool arguments is ignored.

Odoo user-triggered and problem-module writes must follow:

```text
Application RBAC → capability authorization → validation → risk/confirmation → Odoo adapter → Odoo
```

`OdooService.create` / `write` / `unlink` / `callMethod` require an `OdooAuthContext` and delegate to `execute()`. `service.operations` is not a public backdoor. Ungated JSON-2 helpers remain on `OdooOperations` for tests only. Odoo credentials never leave the server. See [odoo.md](odoo.md) and [ai-guardrails.md](ai-guardrails.md).

## Secrets

* Do not commit `.env`, key files, or `credentials.json`.
* Production refuses to start without required secrets, including a dedicated `STORAGE_SIGNING_SECRET` (never the JWT access secret). OTP enabled in production also requires `OTP_HASH_SECRET`. See [environment.md](environment.md) and [configuration.md](configuration.md).
* Production refuses `DEMO_MODE=true` unless `ALLOW_DEMO_IN_PRODUCTION=true`. Mock AI, email, SMS, and OTP providers still require demo mode. Do not enable either flag on a real production host. See [features.md](features.md).
* `npm run security:secrets` scans tracked files for private keys and assigned provider secrets.
* `npm run security:audit` runs `npm audit --omit=dev`.
* GitHub Actions uses repository/environment **Secrets** and **Variables** only. Workflows do not hardcode credentials. CD authenticates to GHCR with `GITHUB_TOKEN` (or `REGISTRY_USERNAME` / `REGISTRY_PASSWORD`) and can use OIDC (`id-token: write`) instead of long-lived cloud keys. See [ci-cd.md](ci-cd.md).

## Phase 03 before / after

| Finding | Before | After | Residual |
| --- | --- | --- | --- |
| Odoo privileged writes | `create`/`write`/`unlink`/`callMethod` and `service.operations` bypassed `execute()` | Writes require capability + RBAC + confirmation via `execute()`; `operations` getter throws | Ungated **read** helpers still exist for trusted server code with hardcoded models |
| Signed downloads | Possession of HMAC URL was enough | User-bound URLs include `uid` and require matching auth (or `admin.settings`) | PDF/report links **without** `uid` remain bearer-of-link until expiry |
| Storage signing secret | Fell back to `JWT_ACCESS_SECRET` | Dedicated `STORAGE_SIGNING_SECRET`; production requires 32+ chars; dev uses an isolated constant | Operators must not copy the JWT secret into this variable |
| JWT in `localStorage` | SPA persisted access + refresh tokens | HttpOnly cookies + in-memory access token; legacy keys cleared | XSS on the SPA origin can still use cookies or steal the in-memory access token |
| SSRF DNS TOCTOU | Lookup then connect could rebind | Pin connect DNS to the validated address via Node HTTP(S) agent `lookup`; `redirect: 'error'` | Custom `fetchImpl` must honor `pinnedAddress`; IPv6/happy-eyeballs edges remain |
| Trust proxy | Production always `trust proxy = 1` | `TRUST_PROXY` env; default **false** | Mis-setting `1` without a stripping proxy still allows IP spoofing |
| Multi-replica scheduler | Per-process last-slot only | KV `setNx` lock per `schedule:slot`; lock errors skip the tick | TTL lock is not leader election; restart still skips the current slot |
| In-memory security stores | Silent fallback if Redis missing | Production `createKvStore` / `createRateLimitStore` throw without Redis | Dev/test still use memory |
| Authz boundaries | Download unauthenticated; no cookie CSRF | Optional auth on uid-bound downloads; Origin check for cookie-only mutations | Cross-site cookie use still needs a correct `SameSite` and proxy setup |
| Privileged audit | `callMethod` and file delete unaudited | `ODOO_METHOD_CALLED`, `FILE_DELETED` | Not every internal read is audited |

## Residual risks

* This kit is **not fully secure**. The table above is a delta, not a certification.
* XSS on the SPA origin can still drive cookie-authenticated requests and read the in-memory access token. Helmet CSP is **API-oriented**; the SPA’s CSP is nginx’s job.
* Signed PDF/report URLs without `uid` remain possession-based until expiry. HMAC format `v2` invalidates older download links.
* SSRF pinning does not cover every resolver/IPv6 path. Custom fetch implementations must honor `pinnedAddress` or they will resolve DNS again.
* Scheduler lock is per-slot TTL, not a true leader election.
* `trust proxy` misconfiguration still lets clients spoof `X-Forwarded-For` and bypass IP rate limits.
* Access JWT denylist still needs Bearer or an access cookie on logout. Keep `JWT_ACCESS_EXPIRES_IN` short.
* Odoo **read** helpers (`search` / `searchRead` / `read`) remain ungated for trusted server code.
* Dependency audit findings change over time. As of 2026-08-29, `npm audit --omit=dev --audit-level=high` reports:
  * **high** `deepmerge-ts` via the Prisma CLI (`prisma` / `@prisma/config`). The advertised fix is a breaking Prisma downgrade; wait for an upstream Prisma release instead of `npm audit fix --force`.
  * **moderate** `react-router` / `react-router-dom` (open redirect / SSR hydration). Not in the API process. Upgrade when a compatible 7.18+ release is adopted.
* Demo mode and mock providers reduce realism; they must never be enabled in a real production tenant without an explicit decision.
* Compose interpolates local-dev JWT and storage-signing placeholders when those vars are unset or empty in `.env`. Replace them before any shared environment.

## Tests

See `backend/tests/security.http.test.ts`, `backend/src/security/*.test.ts`, `backend/tests/auth.http.test.ts`, and `backend/tests/storage.http.test.ts` for unauthorized access, cookie CSRF, signed-download uid binding, forbidden roles, brute force, malformed tokens, oversized uploads, malicious filenames, unauthorized AI tools, and categorized rate limits.
