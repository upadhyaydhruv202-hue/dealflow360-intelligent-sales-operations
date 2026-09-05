# OTP

Reusable one-time passcodes for login, verification, and password-reset style flows. Problem modules should call `OtpService` or the HTTP API. They must not hash, store, or log codes themselves.

SMS is an optional delivery adapter. Email works without SMS.

## Architecture

```text
POST /api/v1/auth/otp/request
        │
        ▼
   AuthController  (HTTP + zod + rate limit)
        │
        ▼
     OtpService
        ├── OtpGenerator   (crypto random digits)
        ├── OtpRepository  (hashed challenge in Redis/memory KV)
        ├── OtpValidator   (expiry, attempts, one-time use)
        └── Delivery adapter (email | sms | mock)
```

## Public HTTP API

Prefix: `/api/v1/auth`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/otp/request` | No | Issue a hashed OTP and deliver it |
| POST | `/otp/verify` | No | Check a code once; login purpose issues tokens for an existing user |

Request:

```json
{
  "destination": "ada@example.com",
  "channel": "email",
  "purpose": "login"
}
```

`channel` is `email` (default) or `sms`. `purpose` is `login`, `verification`, `password-reset`, or `generic`.

Success `data` never includes the code:

```json
{
  "destination": "ada@example.com",
  "channel": "email",
  "purpose": "login",
  "expiresInSeconds": 600,
  "resendAvailableInSeconds": 60,
  "digits": 6
}
```

Verify:

```json
{
  "destination": "ada@example.com",
  "purpose": "login",
  "code": "123456"
}
```

This module verifies the code. For `purpose: "login"` and an existing active account, verify also issues the same JWT session as password login. Unknown emails still receive a success response on request (no mail is sent) so accounts are not enumerated. Other purposes only return `{ verified: true }`.

Password reset also has dedicated routes that use `purpose: "password-reset"`: `POST /api/v1/auth/password-reset/request` and `/password-reset/confirm`. See [auth.md](auth.md).

Do not auto-create accounts from OTP. Disabled accounts that submit a valid login OTP receive `403 Account is disabled`.

## Security

* Codes are HMAC-SHA256 hashed. Plaintext is not stored.
* Configurable digits (4–8), expiry, max attempts, and resend cooldown.
* HTTP rate limits per destination and per IP.
* A successful verify consumes the challenge. Reuse fails.
* A new request replaces any previous unconsumed code after the cooldown.
* Delivery failures delete the challenge so a code that never arrived cannot be used.
* OTPs are never returned by the API and must not be logged.

`OTP_PROVIDER=mock` is allowed in production only when `DEMO_MODE=true`. Demo/test delivery goes through mock email/SMS or the mock OTP adapter. It never calls a real gateway.

## Providers

| Channel | Adapter | When |
| --- | --- | --- |
| `email` | `EmailOtpProvider` → `EmailService` | Default. Uses the `otp` email template |
| `sms` | `SmsOtpProvider` → `SmsService` | Optional. Requires SMS to be configured |
| `mock` | `MockOtpProvider` | Tests / `OTP_PROVIDER=mock` |

Do not add Twilio to `OtpService`. Implement `SmsProvider` instead.

## Configuration

| Variable | Default |
| --- | --- |
| `FEATURE_OTP` | `false` (`.env.example` sets `true`) |
| `OTP_PROVIDER` | `auto` (`auto` or `mock`) |
| `OTP_DIGITS` | `6` |
| `OTP_TTL` | `10m` |
| `OTP_MAX_ATTEMPTS` | `5` |
| `OTP_RESEND_COOLDOWN` | `60s` |
| `OTP_RATE_LIMIT_MAX` | `5` per destination / window |
| `OTP_IP_RATE_LIMIT_MAX` | `20` per IP / window |
| `OTP_RATE_LIMIT_WINDOW` | `15m` |
| `OTP_HASH_SECRET` | dedicated HMAC; required in production when OTP is enabled |

Storage uses the same Redis-or-memory `KvStore` as cache and idempotency. See [redis.md](redis.md).

## Tests

Covered without a live Redis or SMS vendor:

* valid OTP
* incorrect OTP
* expired OTP
* reused OTP
* too many attempts
* resend throttling
* provider failure
* HTTP rate limiting
* login OTP issues JWTs for an existing user and does not enumerate unknown emails

## Limitations

* Verify for `purpose: "login"` issues JWTs when an active account exists. Other purposes only confirm the code. Accounts are never created from OTP.
* In-memory KV and rate limits are per process when Redis is unset.
* Email/SMS bodies in mock providers may contain the code in process memory for tests. Production logs still redact `otp` / `otpCode`.
