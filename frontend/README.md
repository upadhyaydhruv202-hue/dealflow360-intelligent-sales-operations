# Frontend

React + Vite + Tailwind + React Router.

The foundation UI is a single home page that displays API health and readiness. Feature screens belong in `src/pages`. Hackathon-specific UI should stay out of reusable components unless it is genuinely generic.

`src/lib/rbac.ts` can hide privileged controls from the UI. Backend authorization remains authoritative.

Development proxies `/health`, `/ready`, and `/api` to `API_PROXY_TARGET` (default `http://localhost:5000`). Docker Compose serves a production SPA image that proxies those paths to the `backend` service. See `docs/docker.md`.
