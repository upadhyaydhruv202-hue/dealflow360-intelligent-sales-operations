# Redis

Redis is optional infrastructure for fast, short-lived data in local and test environments. PostgreSQL remains the primary business database. Production requires `REDIS_URL` so rate limits, OTP, token revocation, and job queues are shared.

When `REDIS_URL` is unset, the same interfaces fall back to in-process memory (and a file queue for jobs). Local/demo mode keeps working.

## Uses

| Use | Interface | Notes |
| --- | --- | --- |
| Background queues | BullMQ via `createJobQueue({ redisUrl })` | See [jobs.md](jobs.md) |
| Cache | `CacheService` | JSON get/set with TTL. Also backs optional Odoo read cache |
| Rate limiting | `createRateLimitStore` | Login brute-force; memory store if Redis is absent |
| Short-lived temporary data | `KvStore` / `CacheService` | TTL keys only |
| OTP state | `OtpRepository` / `OtpStore` | Stores a hash, never the code. Consumed on success |
| Intent confirmations | `KvIntentConfirmationStore` | High-risk intent tokens (TTL 10 minutes). `SET NX` consume so a token runs once |
| Copilot confirmations | `KvCopilotConfirmationStore` | High-risk copilot tool pending records (TTL 10 minutes). `SET NX` consume |
| Idempotency keys | `IdempotencyStore` | `begin` / `complete` / `release` so emails and similar work are not duplicated |
| Optional realtime fan-out | Redis pub/sub channel `hackathon:realtime` | Only when `FEATURE_REALTIME` is on. Lets the worker reach API SSE connections. See [realtime.md](realtime.md) |

Do not persist orders, users, or other business records in Redis.

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `REDIS_URL` | unset | Readiness skips Redis when unset. Host-based dev uses `redis://localhost:6379`; Compose overrides this to `redis://redis:6379` inside API and worker containers. |
| `JOB_MAX_ATTEMPTS` | `3` | Queue default when a job does not override |
| `JOB_BACKOFF_MS` | `200` | Exponential backoff base |
| `JOB_TIMEOUT_MS` | `60000` | Per-attempt timeout |

## Public interface

```ts
const kv = createKvStore(redis); // RedisClient or MemoryKvStore
const cache = new CacheService(kv);
const idempotency = new IdempotencyStore(kv);
const otp = new OtpStore(kv);

await cache.setJson('report:1', summary, 60_000);
await idempotency.begin('email:welcome-1');
await otp.put('login', email, code);
await otp.verify('login', email, code); // true once, then consumed
```

`FEATURE_OTP` enables the OTP HTTP API (`POST /api/v1/auth/otp/request` and `/otp/verify`). Challenges are hashed in KV. See [otp.md](otp.md). The lower-level `OtpStore` helper remains for simple put/verify use.

## Tests

Memory KV, cache, idempotency, and OTP hashing are unit-tested without a live Redis server.

When `REDIS_URL` is set, `backend/tests/redis` and `backend/tests/queues` run against Redis (KV, cache, idempotency, BullMQ retries/timeouts). CI starts Redis for those suites. See [testing.md](testing.md).
