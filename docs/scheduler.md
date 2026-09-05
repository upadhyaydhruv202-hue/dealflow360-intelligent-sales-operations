# Scheduler

A generic clock for the event bus. It emits `scheduled` (or a registered trigger) on an interval or UTC cron. The automation engine then matches rules the same way it matches `user.created`.

The scheduler does not run actions, SQL, or shell commands.

```text
Scheduler tick
  → EventBus.emit({ type, id, payload })
  → AutomationEngine (when FEATURE_AUTOMATION is on)
```

The API process owns the clock. Close it on graceful shutdown. Tests call `scheduler.tick(date)` with an injected clock; they do not wait on real timers.

## Enable

| Variable | Default | Notes |
| --- | --- | --- |
| `SCHEDULER_ENABLED` | follows `FEATURE_AUTOMATION` | Set `false` to keep automation without ticks; set `true` to emit without the engine |
| `SCHEDULER_INTERVAL` | `1m` | Default schedule name `tick`. Use `0s` to skip that schedule |
| `SCHEDULER_POLL` | `1s` | How often due schedules are checked. `0s` disables the timer (manual `tick` only) |

## Payload

Each tick emits:

```json
{
  "schedule": "tick",
  "slot": "2026-08-28T12:00:00.000Z",
  "firedAt": "2026-08-28T12:00:00.412Z"
}
```

`eventId` is `scheduled:{name}:{slot}` so retries do not create duplicate executions. Multiple API replicas share a KV `setNx` lock (`scheduler:lock:{name}:{slot}`). If the lock store errors, the tick is skipped (fail closed). Automation rules should still be idempotent.

Example rule:

```json
{
  "name": "Hourly audit",
  "trigger": "scheduled",
  "enabled": true,
  "conditions": [{ "field": "schedule", "operator": "equals", "value": "tick" }],
  "actions": [{ "type": "createAuditLog", "action": "scheduler.tick" }]
}
```

## Extending

```ts
scheduler.register({
  name: 'hourly',
  cron: '0 * * * *',
});

scheduler.register({
  name: 'overdue-scan',
  intervalMs: 3_600_000,
  trigger: 'invoice.overdue',
  payload: { source: 'scheduler' },
  buildPayload: () => ({ daysOverdue: 10 }),
});
```

Cron is five UTC fields: `minute hour day-of-month month day-of-week`. Supported tokens: `*`, `n`, `a-b`, `a,b`, `*/n`, `a-b/n`. Weekday `7` is Sunday.

Register extra schedules from problem modules (`modules/problem`). Pass them into `createApp({ schedules })` or call `scheduler.register` on the returned context. Do not put problem-specific clocks inside `backend/src/scheduler`.

## Tests

Unit tests cover interval slots, cron matching, alignment on start, disabled mode, custom triggers, and invalid registrations. HTTP tests do not start the timer (`NODE_ENV=test`).

## Limitations

* In-memory last-slot tracking; a process restart skips the current slot instead of catching up
* Distributed lock is per-slot TTL via KV `setNx`, not a leader election
* Cron is UTC only
