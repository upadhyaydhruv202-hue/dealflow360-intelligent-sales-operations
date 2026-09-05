# Auth

Authentication lives here: password hashing, JWT access/refresh tokens, `authenticate()` middleware, login/password-reset brute-force limits, and password reset via OTP.

HTTP routes are `/api/v1/auth/*`, including OTP request/verify and password reset. Problem-specific modules should consume that API and the middleware. Do not reimplement password, token, or OTP handling.

OTP implementation lives in `backend/src/otp`. See [docs/otp.md](../../../docs/otp.md) and [docs/auth.md](../../../docs/auth.md).

Authorization is a separate module: [rbac](../rbac/README.md) and [docs/rbac.md](../../../docs/rbac.md).

See [docs/auth.md](../../../docs/auth.md).
