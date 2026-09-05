# Notifications

Provider-agnostic notification engine.

```text
Business Event
  → NotificationService.sendNotification()
    → Channel Adapter
      → Provider
```

Channels: `email`, `in_app`, `sms`, `push`, `webhook`. Not every provider must be enabled.

Application logic must never import Resend, SMTP, Brevo, Twilio, FCM, or other vendor SDKs. Register a new adapter instead. See `docs/notifications.md`.
