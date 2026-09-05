# Reusable React UI

Presentational React + Tailwind components for hackathon screens. They work in this Vite app and in any standard React SPA. They do not use Next.js APIs, do not call Odoo, and do not contain business rules.

Import from `frontend/src/ui`:

```tsx
import { Button, DataTable, PageContainer, DashboardLayout } from '../ui';
```

## Architecture

```text
Page
 → layout (AppShell, PageContainer)
 → visual components (Button, DataTable, Modal, …)
 → page/service callbacks
 → services/api.ts
 → /api/v1
```

Visual components receive data and callbacks as props. Pages and `frontend/src/services` own URLs, auth tokens, and domain mapping.

## Theme and toasts

`ThemeProvider` and `ToastProvider` wrap the app in `App.tsx`. Theme preference is stored in `localStorage` under `hsk.theme` (`light` | `dark` | `system`). The document `class="dark"` drives Tailwind tokens.

Use context only for these globals:

* color scheme
* toast stack
* auth session (`AuthProvider`)
* feature flags (`FeatureProvider`, UX only)
* optional `ApiClientProvider`

Do not put table sort, modal open state, or form fields in context.

## API client

`createApiClient` in `frontend/src/services/api.ts` is the HTTP abstraction. Components must not hardcode backend URLs.

```ts
import { API_PATHS } from '@hackathon/api-contract';

const client = createApiClient({
  baseUrl: import.meta.env.VITE_API_URL ?? '',
  getToken: () => memoryAccessToken,
});

const items = await client.get(API_PATHS.features);
```

Existing helpers `apiGet` / `apiRequest` remain. `VITE_API_URL` stays empty locally so Vite/nginx can proxy `/api`, `/health`, and `/ready`. Domain helpers include `auth` (with `register`), `jobs`, `files`, `pdf`, `reports`, and optional `realtime` (SSE via `fetch`, not `EventSource`). File **upload** is multipart; send `FormData` with `fetch` rather than the JSON client.

## Layout

| Component | Role |
| --- | --- |
| `AppShell` | Sidebar + topbar + skip link |
| `Sidebar` / `SidebarNavLink` | Primary navigation (router adapter is separate from the shell) |
| `Topbar` | Menu, theme toggle, actions |
| `Breadcrumb` | Trail |
| `PageContainer` | Title, description, width |
| `ResponsiveGrid` | 1–4 column grid |

## Primitives and overlays

Button, Input, Select, Checkbox, RadioGroup, Badge, Card, Alert, Tooltip, Skeleton, Tabs, Modal, Drawer, Dropdown, Toast.

Modal and drawer close on Escape, restore focus, and lock body scroll. Tabs and dropdowns support arrow keys.

## Data and states

`DataTable`, `Pagination`, `Search`, `FilterPanel`, `EmptyState`, `ErrorState`, `LoadingState`.

Tables accept generic rows. Sorting can be local (no `onSortChange`) or controlled by the page for server-side sort.

## Dashboard

`DashboardLayout` is slot-based: `kpis`, `charts`, `activity`, `notifications`, `table`. `KpiCard`, `ChartArea`, `SimpleBarChart`, `SimpleLineChart`, `ActivityFeed`, `NotificationPanel`, and `TableSection` render whatever the page passes. `/dashboard` is a placeholder page, not product data. When `FEATURE_REALTIME` is on, the dashboard page may prepend allowlisted live events; polling and placeholders still work when it is off. See [realtime.md](realtime.md).

`SimpleBarChart` and `SimpleLineChart` are SVG charts so the kit does not require Recharts or Chart.js. Pass a different child into `ChartArea` if a hackathon needs a heavier library.

## AI UI

`AiActionButton`, `AiResponseCard`, `AiConfidenceBadge`, `EvidencePanel`, `AiLoadingState`, `ToolActivityIndicator`, and `CopilotChat`.

These render validated assistant output. They do not execute tools, SQL, or Odoo methods. Copilot talks to `/api/v1/copilot/*` through `frontend/src/services/copilot.ts`. Business actions talk to `/api/v1/intents/*` through `frontend/src/services/intents.ts`. Problem statement intelligence talks to `/api/v1/problem-intelligence/analyze` through `frontend/src/services/problem-intelligence.ts`. Capability recommendations talk to `/api/v1/capability-recommendations/recommend` through `frontend/src/services/capability-recommendations.ts`. Anomaly insights talk to `/api/v1/anomalies/*` through `frontend/src/services/anomaly.ts`.

## Auth UI

`LoginForm` is presentational. `AuthProvider` (global session only) calls `POST /api/v1/auth/login` with credentials included, keeps the access token in memory, sets httpOnly cookies from the API, and persists only known user fields. `/login` is the sign-in page and redirects home once a session exists. Copilot, business actions, problem intelligence, project planning, notifications, and automations use `SessionGate` instead of a pasted JWT.

Do not log tokens or passwords. Demo seed credentials are documented in [database.md](database.md), not hardcoded into `LoginForm`.

## Accessibility

* Native controls where possible (`input`, `select`, `button`)
* Labels, `aria-invalid`, dialog `aria-modal`
* Visible focus rings
* Skip link in `AppShell`
* `prefers-reduced-motion` disables decorative animation

## Demo routes

| Path | Purpose |
| --- | --- |
| `/ui` | Component gallery |
| `/dashboard` | Slot layout with placeholder metrics |
| `/login` | Sign in (session used by Copilot, notifications, automations) |
| `/problem-intelligence` | Problem statement → structured spec (gated by `FEATURE_PROBLEM_INTELLIGENCE`) |
| `/capability-recommendations` | Structured analysis → advisory modules (gated by `FEATURE_CAPABILITY_RECOMMENDATIONS`) |
| `/project-planning` | Problem → selection → validated Project Configuration (gated by `FEATURE_PROJECT_PLANNING`) |
| `/project-generator` | Approved configuration → isolated overlay (gated by `FEATURE_PROJECT_GENERATOR`) |
| `/rag` | Optional RAG (gated by `FEATURE_RAG`) |
| `/search` | Optional keyword / full-text search (gated by `FEATURE_SEARCH`) |
| `/analytics` | Optional KPI / time-series dashboards (gated by `FEATURE_ANALYTICS`) |
| `/realtime` | Optional SSE live status (gated by `FEATURE_REALTIME`) |

Problem-specific screens register from `modules/problem/frontend` (`problemNav`, `problemRoutes`). Compose this UI kit; do not fork primitives into the problem folder.
