# Security

Reusable HTTP and integration hardening. Auth-specific password hashing and JWT verification stay in `backend/src/auth`.

## Controls

* **Headers** — Helmet with an API CSP (`default-src 'none'`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, HSTS in production
* **CORS** — explicit origin allowlist, credentials enabled, `*` rejected
* **CSRF** — cookie-only mutating requests require a trusted `Origin` or `Referer`
* **Body limits** — `REQUEST_BODY_LIMIT` (JSON/urlencoded) plus per-upload byte caps
* **Rate limiting** — Redis when a Redis client is configured. Production refuses in-memory fallback. Separate policies for authentication, OTP, AI, file upload, public APIs, authenticated APIs, and admin APIs. Login, OTP, and password reset also have identity+IP brute-force limits
* **Cookies** — httpOnly `hsk_access` / `hsk_refresh` via `secureCookieOptions()`. JSON tokens remain in auth responses for API clients
* **Trust proxy** — `TRUST_PROXY` (default false). Set `1` only behind a stripping reverse proxy
* **SSRF** — `assertSafeExternalUrl` / `fetchExternal` for user-controlled URLs (webhooks). Timeouts, `redirect: 'error'`, hostname checks, DNS private/loopback blocks, and connect DNS pinning via Node HTTP(S) agent `lookup`
* **Secrets** — production startup checks plus `npm run security:secrets`. Storage signing and OTP hashing do not reuse the JWT access secret
* **Errors** — stack traces and secrets are never returned to clients

Do not use feature flags to bypass these controls. Residual risks: `docs/security.md`.
