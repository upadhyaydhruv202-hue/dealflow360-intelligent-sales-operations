# Automation

Generic trigger → condition → action engine.

Hackathons register triggers, optional condition operators, and actions, then create rules. Do not put problem-specific workflows in this folder.

```text
EventBus.emit
  → match enabled rules (priority, then createdAt)
  → declarative conditions (no JavaScript)
  → enqueue automation.execute
  → ordered actions with retries, idempotency, and audit
```

See `docs/automation.md`.
