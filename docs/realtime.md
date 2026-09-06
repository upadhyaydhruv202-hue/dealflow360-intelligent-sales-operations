# Optional real-time (SSE)

Server-to-client live status for allowlisted channels. The module is **off by default**. REST polling remains the default and keeps working when the flag is off.

Enable `FEATURE_REALTIME=true` when the product needs push updates (job progress, inbox, dashboard, automation, long-running document/AI processing, or DealFlow360 quote/approval/billing/anomaly changes). DealFlow360’s `.env.example` turns this on so staff workspaces refresh from SSE instead of a manual reload.

See `backend/src/realtime/` and `frontend/src/services/realtime.ts`.

## Why SSE, not WebSockets

| Option | Fit for this kit |
| --- | --- |
| **SSE (chosen)** | One-way server → browser. Reuses Express, JWT/cookie `authenticate()`, and RBAC. No extra npm package. No extra Node service. |
| WebSockets | Bidirectional. Useful for chat fan-in or client-originated frames. The kit’s examples are status pushes, which SSE already covers. |

Do not add Socket.IO, `ws`, or a realtime microservice unless a statement truly needs client-to-server streaming.

## Architecture

```text
Job / notification / automation / document status
  → RealtimeService.publish* (sanitized payload)
  → in-process hub (audience + permission filters)
  → optional Redis pub/sub (`hackathon:realtime`) so the worker can reach API connections
  → GET /api/v1/realtime/events (text/event-stream)
  → React fetch + ReadableStream (Bearer token; not EventSource)
```

```text
Controller (authenticate + zod channels query)
        │
        ▼
RealtimeService.connect / listChannels
        │
        ├── allowlisted channels (jobs, notifications, dashboard, automation, documents)
        ├── RealtimeHub
        └── optional Redis transport (API ↔ worker). Skip own sourceId on receive.
```

Unknown channel names, `*`, and EventBus types (`user.created`, …) are rejected. `dashboard` is a **subscription alias**: it receives the same allowlisted source events the caller could already subscribe to. It is not a dump of the EventBus.

## Enable

| Variable | Default | Notes |
| --- | --- | --- |
| `FEATURE_REALTIME` | `false` in the feature registry; `true` in DealFlow360 `.env.example` | Turns SSE HTTP, publishers, optional Redis fan-out, and the `/realtime` UI on. Production DealFlow360 should set `true`. |
| `REALTIME_HEARTBEAT` | `15s` | SSE comment interval so proxies keep the socket |
| `REALTIME_MAX_CONNECTIONS` | `200` | Process-wide cap |
| `REALTIME_MAX_CONNECTIONS_PER_USER` | `5` | Per authenticated user |
| `REDIS_URL` | unset | When set, the API subscribes and both API and worker publish. Without Redis, only in-process subscribers see events |

The worker publishes with `subscribeRedis: false` so it does not open a second SSE hub. Poll `GET /api/v1/jobs/:jobId` and the notification list when this flag is off.

## HTTP API

Prefix `/api/v1`. Bearer token or session cookie required. No query-string tokens.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/realtime/channels` | Allowlisted channels the caller may subscribe to |
| GET | `/realtime/events?channels=jobs,notifications` | SSE stream. Omit `channels` to subscribe to every channel the caller is allowed to use |

Disabled flag → `FEATURE_DISABLED` (404). Unknown channel → `VALIDATION_ERROR` (400). Channel the caller cannot use → `AUTHORIZATION_ERROR` (403). Connection caps → `RATE_LIMITED`.

SSE frames:

* `event: ready` — `connectionId`, authorized `channels`, `heartbeatSeconds`
* named events: `job.updated`, `notification.created`, `automation.updated`, `document.updated`
* comments (`: ping`) for heartbeat

Headers: `text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`.

Payloads are sanitized (public job status, no job `createdBy` or raw job payload, no automation event payload, no document text).

## Authorization

No new RBAC key. Existing permissions apply to both the HTTP connection and each delivered event.

| Channel | Subscribe with | Delivery filter |
| --- | --- | --- |
| `jobs` | `jobs.read` | Same as `GET /jobs/:jobId` (`canReadJobStatus`: owner or admin; no owner → any `jobs.read`) |
| `notifications` | `notifications.read` | `audience.userId` is the caller |
| `documents` | `documents.read` | same user |
| `automation` | `automations.read` | all such callers (no execution payload) |
| `dashboard` | any of the above | same filters on the **source** event; DealFlow `kind=dealflow` events are delivered to any caller who may subscribe to `dashboard` |

A notifications-only user who subscribes to `dashboard` still does not receive other users’ jobs. DealFlow360 publishes `dashboard.updated` with `{ kind: 'dealflow', source: 'dealflow', event, quoteId }` after quote, approval, fulfillment, billing, negotiation, and anomaly writes.

The staff UI (`useQuotes` / `useQuote` / `useCatalog` / `useAnomalies`) subscribes to `dashboard` only when the flag is on and reloads those REST resources. It does not poll and does not invent numbers.

## Frontend

`subscribeRealtime` uses `fetch` with `Authorization: Bearer` so the access token is not placed in the URL. `EventSource` cannot set that header.

`useRealtime` reconnects after transient failures and stops on 401/403/404. `/realtime` is gated by `FeatureGate`. Notifications, dashboard, and automations pages subscribe only when the flag is on; they still load through REST.

Vite proxies `/api/v1/realtime` with a one-hour timeout. Nginx locations for `/api/v1/realtime/` disable buffering (`infra/nginx/proxy.conf`, `infra/nginx/frontend.conf`).

## Tests

* Channel allowlist, unknown/`*` channels, unauthorized channel, owner vs other-user delivery
* Hub dashboard projection and connection caps
* Service silent when the flag is off; skip own Redis `sourceId`
* HTTP: flag off, list channels, validation, 403, SSE `job.updated`
* Frontend client path + SSE parse; nav hidden unless the flag is on

## Limitations

* Optional. Off by default. Not required for jobs, notifications, or automation.
* Server → client only. Clients cannot publish on the socket.
* Not a generic EventBus websocket. Channels are a fixed allowlist.
* Cross-process delivery needs Redis. A single API process without Redis only notifies its own connections.
* Connection counts are per process, not a cluster-wide lease.
* SSE is not replayed from an event log. After reconnect, poll REST if you need current state.
