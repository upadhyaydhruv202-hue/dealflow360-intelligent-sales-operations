# SMS

Reusable transactional SMS. Call `SmsService` from services and jobs. Do not import Twilio, Vonage, or other vendor SDKs from controllers or `modules/problem`.

## Providers

| Mode | Behavior |
| --- | --- |
| Demo / test / `SMS_PROVIDER=mock` | Records the message in memory |
| `SMS_ENABLED=true` or `FEATURE_SMS=true` + `SMS_PROVIDER=http` | POSTs JSON to `SMS_HTTP_URL` |

Job name: `sms.send`. Use `{ async: true }` to enqueue.

The notification engine uses `SmsService.deliver()` from `SmsChannelAdapter` so a notification is not double-queued.

## Public interface

```ts
await sms.send({ to: '+15551234567', text, idempotencyKey? })
await sms.send({ ...input }, { async: true })
```

`to` must be E.164. `idempotencyKey` skips a second deliver (Redis when configured, otherwise in-process). Async send returns `{ queued: true, jobId }`.

## Configuration

| Variable | Default |
| --- | --- |
| `SMS_ENABLED` | `false` (also enabled by `FEATURE_SMS`) |
| `SMS_PROVIDER` | `mock` (`mock` or `http`) |
| `SMS_FROM` | unset |
| `SMS_API_KEY` | required in production for `http` |
| `SMS_HTTP_URL` | required in production for `http` |
| `SMS_TIMEOUT_MS` | `10000` |

Demo mode never delivers to a real gateway. In production, `SMS_PROVIDER=mock` is allowed only with `DEMO_MODE=true`.

To add Twilio (or another vendor), implement `SmsProvider` and select it from config. Do not call the vendor from `NotificationService`.

## Tests

Mock the provider. Do not call a real SMS gateway.
