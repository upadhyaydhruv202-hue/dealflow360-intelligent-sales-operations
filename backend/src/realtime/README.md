# Optional real-time (SSE)

Server-Sent Events for allowlisted live status. Off unless `FEATURE_REALTIME=true`. REST polling stays the default.

```text
Job / notification / automation / document
  → RealtimeService.publish (sanitized payload)
  → in-process hub
  → optional Redis pub/sub (API ↔ worker)
  → GET /api/v1/realtime/events
```

WebSockets are not used. The kit’s use cases are server-to-client (job progress, inbox, dashboard, automation, document processing). SSE reuses Express, JWT/cookie auth, and RBAC. There is no extra Node service.

See [docs/realtime.md](../../../docs/realtime.md).
