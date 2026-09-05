# Events

In-process domain events. Services emit named payloads; the automation engine (and later notifications or audit) subscribe without coupling to HTTP.

```text
Service
  → EventBus.emit({ type, payload, id? })  (awaits subscribers)
  → AutomationEngine.handleEvent
  → matching rules → jobs → actions
```

Hackathons emit custom types after registering the trigger on the automation engine. The scheduler emits `scheduled` ticks; do not put problem-specific subscribers in this folder.

Handler failures are logged and skipped so other subscribers still run. Unit tests live in `event-bus.test.ts`.
