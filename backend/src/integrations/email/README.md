# Email

Transactional email behind `EmailService`. Controllers and problem modules never import Nodemailer, Resend, or Brevo SDKs.

* Demo mode, tests, and `EMAIL_PROVIDER=mock` record messages in memory and do not deliver.
* `EMAIL_ENABLED=true` with `EMAIL_PROVIDER=smtp|resend|brevo` sends through that adapter.
* Templates live in `templates/` and are independent of hackathon business logic.
* Job name: `email.send`

See `docs/email.md`.
