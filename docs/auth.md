# Authentication

Reusable email/password authentication with JWT access tokens and rotating refresh tokens.

Future hackathons should call the public HTTP API and `authenticate()` middleware. Do not copy or fork the token, password, or refresh-token internals into problem-specific modules.

## Purpose

Identify the current user. Authorization (RBAC) is a separate module that builds on `req.user`.

## Architecture

```text
POST /api/v1/auth/login
        │
        ▼
   AuthController  (HTTP + zod)
        │
        ▼
    AuthService    (password policy, account status, token rotation)
        │
        ├── PasswordService (bcrypt)
        ├── TokenService (JWT)
        └── Repositories → PostgreSQL
```

Authenticated request:

```text
Authorization: Bearer <access-token>
        │
        ▼
  authenticate()
        │
        ├── verify JWT (signature, expiry, type, issuer, audience)
        ├── load user
        ├── reject disabled / inactive accounts
        └── attach req.user
```

## Public HTTP API

Prefix: `/api/v1/auth`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/register` | No | Create an account and issue tokens |
| POST | `/login` | No | Verify credentials and issue tokens |
| POST | `/refresh` | No | Rotate a refresh token |
| POST | `/logout` | No | Revoke the refresh-token family. When `Authorization: Bearer` is sent, denylist that access token |
| GET | `/me` | Bearer access token | Current user |
| POST | `/otp/request` | No | Issue an OTP (see [otp.md](otp.md)) |
| POST | `/otp/verify` | No | Verify an OTP; login purpose issues tokens for an existing user |
| POST | `/password-reset/request` | No | Send a password-reset OTP (same response if the email is unknown) |
| POST | `/password-reset/confirm` | No | Verify the OTP, set a new password, revoke refresh and access tokens |

Register / login / refresh success `data`:

```json
{
  "user": {
    "id": "uuid",
    "email": "ada@example.com",
    "displayName": "Ada Lovelace",
    "status": "active",
    "role": "user",
    "roles": ["user"],
    "permissions": ["notifications.read"]
  },
  "tokens": {
    "accessToken": "<jwt>",
    "refreshToken": "<jwt>",
    "tokenType": "Bearer",
    "expiresIn": 900
  }
}
```

Password hashes are never returned. Login failures for unknown emails and wrong passwords use the same `401` message: `Invalid email or password`.

Disabled accounts that present a correct password receive `403 Account is disabled`.

## Protecting routes

```ts
import { authenticate } from '../auth';
import { requirePermission } from '../rbac';

router.get('/reports', authenticate({ tokenService, users }), requirePermission('reports.generate'), controller.list);
```

`createApp` already mounts this on `GET /api/v1/auth/me`. Other modules should reuse the same factory with the shared `TokenService` and `UserRepository`.

`req.user` contains `{ id, email, displayName, status, role, roles, permissions }`. Use `roles` and `permissions` from this object after `authenticate()`; do not authorize from the JWT `role` claim. See [rbac.md](rbac.md).

## JWT

Access and refresh tokens are HS256 JWTs with separate secrets. Claims are minimal:

```json
{
  "sub": "user-id",
  "type": "access",
  "role": "admin",
  "jti": "uuid",
  "iss": "hackathon-starter-kit",
  "aud": "hackathon-starter-kit-api",
  "iat": 1710000000,
  "exp": 1710000900
}
```

Do not put email, names, or other personal data in tokens.

Refresh tokens are stored as SHA-256 hashes. On refresh, the previous row is revoked and a new token is issued (rotation). Reuse of a revoked token revokes the entire family.

Logout revokes the family for that login session. When the request includes `Authorization: Bearer`, that access token is denylisted.

## Password security

bcrypt (via `bcryptjs`) with a configurable cost factor. Default cost is **12**. Production refuses a cost below **10**.

Policy is configuration, not hardcoded in controllers:

| Variable | Default |
| --- | --- |
| `AUTH_PASSWORD_MIN_LENGTH` | `8` |
| `AUTH_PASSWORD_MAX_LENGTH` | `72` (bcrypt limit) |
| `AUTH_PASSWORD_REQUIRE_UPPERCASE` | `false` |
| `AUTH_PASSWORD_REQUIRE_LOWERCASE` | `false` |
| `AUTH_PASSWORD_REQUIRE_NUMBER` | `false` |
| `AUTH_PASSWORD_REQUIRE_SPECIAL` | `false` |
| `AUTH_BCRYPT_COST` | `12` (`4` in tests) |

## Rate limiting

Login, OTP, and password reset use identity+IP brute-force limits. Register/refresh/logout use the authentication category. Other APIs use separate public, authenticated, admin, AI, and upload policies. See [security.md](security.md).

Keys for login:

* per IP (`AUTH_LOGIN_IP_RATE_LIMIT_MAX`, default 20 / window)
* per email (`AUTH_LOGIN_RATE_LIMIT_MAX`, default 5 / window)

Window: `AUTH_LOGIN_RATE_LIMIT_WINDOW` (default `15m`).

When `DEMO_MODE=true`, login brute-force limits are skipped **only** for the seeded demo emails (`demo.staff@example.com`, `demo.manager@example.com`, `demo.finance@example.com`, `demo.admin@example.com`, `demo.user@example.com`). There is no Operations demo account. Password validation, JWT issuance, and RBAC are unchanged. Arbitrary accounts stay limited. Production (`DEMO_MODE=false`) keeps the defaults.

Local reset (destructive): `npm run db:reset` drops the database, migrates, and re-seeds those demo users. Restarting the API process also clears in-memory rate-limit counters; Redis-backed counters persist until the window expires unless you flush Redis locally.

Uses Redis when the Redis client is available; otherwise an in-memory store. Production fails closed if the store is down (`RATE_LIMIT_FAIL_CLOSED`). Set `RATE_LIMIT_ENABLED=false` to disable.

## Configuration

| Variable | Required in production | Default |
| --- | --- | --- |
| `JWT_ACCESS_SECRET` | Yes, 32+ characters | unset |
| `JWT_REFRESH_SECRET` | Yes, 32+ characters | unset |
| `JWT_ACCESS_EXPIRES_IN` | No | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` |
| `JWT_ISSUER` | No | `hackathon-starter-kit` |
| `JWT_AUDIENCE` | No | `hackathon-starter-kit-api` |
| `AUTH_COOKIE_ENABLED` | No | `true` (httpOnly access + refresh cookies) |
| `AUTH_COOKIE_SAMESITE` | No | `lax` (`strict` or `none`; `none` forces Secure) |
| `AUTH_DEFAULT_ROLE` | No | `user` (assigned on register when the role exists) |

Durations use compact units: `15m`, `7d`, `30s`, `1h`.

Generate local secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Database

Users already have a unique index on `email`. Refresh tokens live in `refresh_tokens` with a unique hash index plus `user_id`, `family_id`, and `expires_at` indexes.

## Tests

* password hashing and policy
* JWT sign/verify, expiry, malformed tokens, token type
* registration, duplicate email, login, invalid password
* protected `GET /me`, expired and malformed bearer tokens
* refresh rotation, reuse revocation, logout
* disabled account
* login, OTP, and password-reset brute-force limits
* categorized public / authenticated / admin / AI / upload rate limits

## Frontend

`LoginForm` is presentational. `AuthProvider` calls `POST /api/v1/auth/login` with `credentials: 'include'`, keeps the access token **in memory**, and persists only known `AuthUser` fields. Legacy `hsk.accessToken` / `hsk.refreshToken` keys are cleared. On boot the SPA calls `POST /auth/refresh` with cookies to refill memory. Sign-in UI: `/login`. See [ui.md](ui.md).

JSON tokens remain in the login/refresh body for API clients. Cookie-only mutating requests need a trusted `Origin` (see [security.md](security.md)).

## Limitations

* Access tokens are denylisted on logout when Bearer or an access cookie is sent, and after password reset via an access-token version bump. Keep `JWT_ACCESS_EXPIRES_IN` short.
* Refresh-token cleanup of expired rows is not a background job
* In-memory rate limits are per process (refused in production without Redis)
* XSS on the SPA origin can still use httpOnly cookies and steal the in-memory access token. See [security.md](security.md).
