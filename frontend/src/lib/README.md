# Lib

Frontend helpers that are not React-specific (formatting, constants, feature-flag clients) live here.

Shared API envelopes, `/api/v1` paths, and `FEATURE_NAMES` come from `@hackathon/api-contract`, not from copies under `lib/`.

`rbac.ts` is UX-only. Hide buttons with `hasPermission` / `hasRole`; the API still enforces authorization.
