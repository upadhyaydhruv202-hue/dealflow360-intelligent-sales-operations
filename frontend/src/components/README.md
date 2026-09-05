# Components

Feature-specific UI lives here. The reusable visual system is `frontend/src/ui` — see [docs/ui.md](../../../docs/ui.md).

Keep problem-specific screens in `pages/` or under `modules/problem` when a dedicated frontend slice is required.

* `NotificationList` — in-app notification items, unread styling, and mark-read
* `NotificationBell` — unread badge and inbox dropdown
* `NotificationPreferences` — per-category channel toggles
* `CopilotChat` — re-exports the kit chat transcript

`/notifications` is a page for inbox history, mark-read, and preference management.
`/automations` is a page for listing rules, creating invoice-reminder and scheduled-tick examples, and emitting a demo event.
`/login` signs in through `AuthProvider`. `/ui` is the component gallery. `/dashboard` is a slot-based placeholder layout.
