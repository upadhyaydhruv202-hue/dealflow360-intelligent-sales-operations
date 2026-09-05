# Scheduler

Emits domain events on an interval or UTC cron. The automation engine matches those events like any other trigger. This folder does not execute actions.

```text
Scheduler.tick
  → EventBus.emit({ type: 'scheduled', id: scheduled:{name}:{slot}, payload })
  → AutomationEngine (if FEATURE_AUTOMATION is on)
```

The API process owns the clock. Duplicate ticks from multiple API replicas are safe because automation executions are idempotent on `(ruleId, eventId)`.

Hackathons register extra schedules with `scheduler.register({ name, intervalMs | cron, trigger?, payload? })`. Do not add JavaScript conditions or arbitrary command execution here.

See `docs/scheduler.md`.
