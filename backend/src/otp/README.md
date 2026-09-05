# OTP

Reusable one-time passcode issuance and verification.

* Hashed storage (HMAC-SHA256), never plaintext
* Configurable digits, expiry, max attempts, and resend cooldown
* User/IP rate limits on the HTTP endpoints
* One-time use; the challenge is invalidated after success
* Delivery adapters: email, SMS, mock
* SMS is optional. Email works without an SMS provider.

Demo/test never delivers a real message. `OTP_PROVIDER=mock` is forbidden in production unless `DEMO_MODE=true`.

See `docs/otp.md`.
