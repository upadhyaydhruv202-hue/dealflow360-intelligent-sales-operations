# Email

Reusable transactional email. Call `EmailService` from services and jobs. Do not import Nodemailer, Resend, or Brevo from controllers or `modules/problem`.

## Providers

| Mode | Behavior |
| --- | --- |
| Demo / test / `EMAIL_PROVIDER=mock` | Records the message in memory |
| `EMAIL_ENABLED=true` + `EMAIL_PROVIDER=smtp` | Sends through SMTP |
| `EMAIL_ENABLED=true` + `EMAIL_PROVIDER=resend` | POST to Resend |
| `EMAIL_ENABLED=true` + `EMAIL_PROVIDER=brevo` | POST to Brevo |

Job name: `email.send`. Use `{ async: true }` to enqueue.

In production, `EMAIL_PROVIDER=mock` is allowed only when `DEMO_MODE=true`. Demo mode never delivers real mail.

## Public interface

```ts
await email.sendEmail({ to, subject, template, variables, attachments })
await email.send({ to, subject, text, html?, replyTo?, idempotencyKey? })
await email.send({ ...input }, { async: true })
await email.generateEmailContent({ purpose, verifiedFacts, tone? })
```

`sendEmail` is an alias of `send`. Provide either a `template` or both `subject` and `text`.

`idempotencyKey` skips a second deliver (Redis when configured, otherwise in-process). Async send returns `{ queued: true, jobId }`.

## Templates

Templates live in `backend/src/integrations/email/templates` and stay independent of hackathon business logic.

| Id | Typical variables |
| --- | --- |
| `welcome` | `displayName`, `appName` |
| `verification` | `displayName`, `verificationUrl`, `expiresInMinutes` |
| `password-reset` | `displayName`, `resetUrl`, `expiresInMinutes` |
| `otp` | `code`, `expiresInMinutes` |
| `notification` | `subject`, `body` |
| `report-ready` | `displayName`, `title`, `downloadUrl` |
| `alert` | `title`, `body`, `severity` |

`appName` is filled from config when omitted.

## AI email generation

`generateEmailContent()` drafts wording from **verified application facts**. It does not send mail.

* Secret keys (`otp`, `code`, `password`, `token`, `secret`, `apiKey`) are never sent to the model.
* Transaction values must come from `verifiedFacts`. The helper interpolates them after generation and appends any missing public facts.
* If the model invents numbers that were not in `verifiedFacts`, a warning is added.
* `requiresReview` is always `true`. Do not auto-send the result.
* If AI is disabled, a static template is rendered from the same facts.

## Configuration

| Variable | Default |
| --- | --- |
| `EMAIL_ENABLED` | `false` |
| `EMAIL_PROVIDER` | `smtp` (`smtp`, `resend`, `brevo`, or `mock`) |
| `EMAIL_FROM` / `SMTP_FROM` | required in production when enabled |
| `EMAIL_TIMEOUT_MS` | `10000` (Resend/Brevo) |
| `SMTP_HOST` / `SMTP_PORT` | required for `smtp` |
| `SMTP_USER` / `SMTP_PASSWORD` | optional SMTP auth |
| `RESEND_API_KEY` | required for `resend` in production |
| `BREVO_API_KEY` | required for `brevo` in production |

## Tests

Mock the provider. Do not call a real SMTP, Resend, or Brevo endpoint.
