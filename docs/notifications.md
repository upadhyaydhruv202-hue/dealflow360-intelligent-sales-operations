# Notifications

Provider-agnostic multi-channel notifications.

```text
Business Event
  → NotificationService.sendNotification()
    → preference check + template render
    → Channel Adapter
      → Provider
```

Application logic must never import Resend, SMTP, Brevo, Twilio, FCM, or other vendor SDKs. Those belong behind adapters.

Optional live inbox updates use allowlisted SSE (`FEATURE_REALTIME`, channel `notifications`). List and unread-count HTTP remain the default. See [realtime.md](realtime.md).

## Channels

| Channel | Adapter | Default provider | Enable |
| --- | --- | --- | --- |
| `in_app` | `InAppChannelAdapter` | PostgreSQL inbox | always when the database is configured |
| `email` | `EmailChannelAdapter` | `EmailService` (SMTP or mock) | `EMAIL_ENABLED` / demo mode |
| `sms` | `SmsChannelAdapter` | `SmsService` (HTTP or mock) | `SMS_ENABLED` / `FEATURE_SMS` / demo mode |
| `push` | `PushChannelAdapter` | in-memory mock | always (swap the provider to add FCM/APNs) |
| `webhook` | `WebhookChannelAdapter` | mock in demo/test; HTTPS POST otherwise | always |

Not every provider must be enabled. A missing or disabled provider fails that channel without affecting the others.

## Public interface

```ts
await notifications.sendNotification({
  channel: 'email',
  recipient: { userId, email, phone, deviceToken, url },
  template: 'order-updated',
  data: { orderId: 'A-1', status: 'shipped' },
  priority: 'high',
  metadata: { source: 'orders' },
  category: 'order_updates',
  idempotencyKey: 'order.updated:A-1',
})
```

`notify({ userId, title, body, email?, async? })` remains for in-app (and optional email) callers such as document analysis, automation, and copilot.

## Status

Each outbound send is a `notification_deliveries` row:

`queued` → `processing` → `sent` | `failed` | `retrying`

High and critical priority deliver inline when possible. Normal and low enqueue `notification.dispatch`. Transient provider errors retry through the job queue. Validation errors, disabled channels, and provider 4xx responses are not retried.

## Templates

Built-in ids: `generic`, `welcome`, `document-analyzed`, `order-updated`, `quote-prelim-invoice`, `quote-final-invoice`, `invoice-reminder`, `security-alert`, `report-ready`, `marketing`.

Strings use `{{field}}` interpolation from `data`. Register another template on the registry:

```ts
templates.register({
  id: 'ticket-assigned',
  category: 'order_updates',
  title: 'Ticket {{ticketId}} assigned',
  body: '{{assignee}} was assigned ticket {{ticketId}}.',
  emailSubject: 'Ticket {{ticketId}} assigned',
  sms: 'Ticket {{ticketId}} assigned to {{assignee}}.',
})
```

## In-app inbox

PostgreSQL `notifications` rows. Users can list history, filter unread, mark one read, or mark all read.

## Preferences

Users choose whether a category is enabled on a channel. Default is enabled when no row exists.

Categories: `order_updates`, `security_alerts`, `reports`, `marketing`, `system`.

`security_alerts` cannot be disabled.

## Priority

`low` | `normal` | `high` | `critical`

High and critical skip the queue unless `async: true`. They also use more retry attempts. In-app notifications deliver inline unless `async: true`.

## Idempotency

Pass `idempotencyKey` (for example the business event id). A second send with the same key returns the existing delivery and does not contact the provider again.

## HTTP API

Prefix `/api/v1`. Bearer token required.

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/notifications` | `notifications.read` |
| GET | `/notifications/unread-count` | `notifications.read` |
| GET | `/notifications/preferences` | `notifications.read` |
| PUT | `/notifications/preferences` | `notifications.read` |
| GET | `/notifications/deliveries/:id` | `notifications.write` |
| POST | `/notifications/send` | `notifications.write` |
| POST | `/notifications` | `notifications.write` (legacy in-app `notify`) |
| POST | `/notifications/:id/read` | `notifications.read` |
| POST | `/notifications/read-all` | `notifications.read` |

`POST /notifications/send` body: `{ channel, recipient, template, data?, priority?, metadata?, category?, idempotencyKey?, async? }`.

List query: `page`, `pageSize`, `unreadOnly`.

When `FEATURE_NOTIFICATIONS=true`, document analysis also writes an in-app notification for the uploader.

Job name: `notification.dispatch`. SMS uses `sms.send` when `SmsService.send(..., { async: true })` is called directly.

## Frontend

* `NotificationList` — history and mark-read
* `NotificationBell` — unread badge and dropdown
* `NotificationPreferences` — category/channel toggles
* `/notifications` — inbox page (sign in at `/login`)

## Adding a channel or provider

1. Add a provider that implements the channel's send interface (see `MockSmsProvider`, `MockPushProvider`, `HttpSmsProvider`). Do not import a vendor SDK into services or controllers.
2. Wrap it in a `ChannelAdapter` with `channel` and `send(message)`.
3. Register it in `createDefaultChannelRegistry` (or call `channels.register` from `modules/problem`).
4. If the channel needs configuration, add env vars to `backend/src/config` and `.env.example`.
5. Add a mock-provider test for success, failure, and (if queued) retry.
6. Document the channel here.

Example: a future Twilio SMS provider implements `SmsProvider.send` and is selected from `SMS_PROVIDER`. `NotificationService` and React never mention Twilio.

Successful deliveries write `notification.sent` audit events (no message body secrets) and increment `notification.delivery` metrics. See [audit.md](audit.md) and [observability.md](observability.md).

## DealFlow360 customer quotation emails

Triggered only by backend commercial events — never by opening a page.

| Event | When | Document |
| --- | --- | --- |
| `prelim_invoice` | Manager approval of the negotiated quotation (or auto-approve after finalize) | Provisional / raw invoice. Awaiting Finance lock |
| `final_invoice` | Finance Manager lock (`dealflow.quotes.lock`) | Final bill, payable amount, recurring totals |

Records are stored in PostgreSQL:

- `df_quote_email_deliveries` — quote ID, event type, recipient, version, status, error, payload
- `notification_deliveries` — kit delivery row with the same idempotency key (`dealflow:quote:{id}:{event}:{freeze-or-lock-stamp}`)

Status is `not_configured` / pending when `EMAIL_ENABLED` is off or the provider is mock/demo. The UI must not show those as sent. Customer payloads omit margin, risk, approval-chain internals, and audit data. PDFs are generated from the live quotation aggregate.

## Tests

External providers are mocked. Coverage includes a valid send, provider failure, retry, disabled preference, invalid recipient, and duplicate idempotency key.
