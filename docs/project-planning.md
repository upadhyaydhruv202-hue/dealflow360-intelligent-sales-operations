# Project planning and capability selection

Frontend wizard plus backend validation that turns a problem statement and a human capability selection into a **Project Configuration** object.

The frontend is UX only. The backend is authoritative. The [project generator](project-generator.md) consumes the approved object and must re-validate it. This module does **not** generate a project, write `.env`, enable `FEATURE_*`, or construct services.

See `backend/src/project-planning/`.

## Purpose

Input: a problem statement (paste or text upload) and/or an explicit catalog selection.

Output: a schema-versioned Project Configuration with:

* extracted requirements (when problem intelligence ran)
* recommended capabilities and why (advisory)
* dependencies and conflicts
* human-selected capabilities, profile, architecture mode, and deployment mode
* backend validation of existence, dependencies, conflicts, compatibility, and feature-flag availability
* `approved: true` only after `POST /approve` succeeds

`generatedNothing` is always true. `generation.allowed` and `generation.attempted` are always false.

## Architecture

```text
POST /api/v1/project-planning/analyze
  → authenticate + AI rate limit + projects.plan
  → optional ProblemIntelligenceService
  → recommendCapabilities (pure; does not enable flags)
  → buildProjectConfiguration (draft)

POST /api/v1/project-planning/validate
  → authenticate + projects.plan
  → ignore client approved / resolved / generatedNothing
  → resolveProfiles + resolveCapabilities
  → Project Configuration (draft | invalid)

POST /api/v1/project-planning/approve
  → same validation
  → 400 if invalid or empty
  → approved Project Configuration (no code generation)
```

```text
Problem statement
  → extracted requirements
  → advisory recommendations (why, dependencies, conflicts)
  → human select / deselect + profile + architecture + deployment
  → backend-validated Project Configuration
  → [Project generator](project-generator.md)
```

Do not trust checkbox state from React. The API ignores `approved`, `resolved`, and `generatedNothing` on the body.

## Configuration

| Variable | Default | Notes |
| --- | --- | --- |
| `FEATURE_PROJECT_PLANNING` | `false` | Turns the HTTP API and `/project-planning` UI on. Does **not** require `FEATURE_AI` |

Optional: `FEATURE_PROBLEM_INTELLIGENCE` + AI for extracted requirements. The recommendation engine is a pure function and does not need `FEATURE_CAPABILITY_RECOMMENDATIONS`.

Permission: `projects.plan` (manager and admin after seed).

## Public interface

```ts
import { buildProjectConfiguration, assertApprovedConfiguration } from './project-planning';

const draft = buildProjectConfiguration(
  { capabilities: ['auth', 'database', 'infrastructure.postgres'] },
  { intent: 'validate' },
);

const approved = buildProjectConfiguration(
  { capabilities: ['auth', 'database', 'infrastructure.postgres'] },
  { intent: 'approve', userId },
);

assertApprovedConfiguration(approved);
```

| Method | Path | Auth |
| --- | --- | --- |
| POST | `/api/v1/project-planning/analyze` | Bearer + `projects.plan` (AI rate limit) |
| POST | `/api/v1/project-planning/validate` | Bearer + `projects.plan` |
| POST | `/api/v1/project-planning/approve` | Bearer + `projects.plan` |

Analyze body: `{ "statement": "...", "title": "optional" }`.

Validate/approve body: `{ "capabilities": [], "profiles": [], "architectureMode": "...", "deploymentMode": "...", "includeOptional": false, "closeDependencies": false, "statement": "optional", "analysis": {} }`.

The JSON envelope is `{ success, data }`. Analyze `data` includes `analysis`, `recommendations`, and `configuration`. Validate/approve `data` is the Project Configuration.

## Validation (backend)

| Check | Behavior |
| --- | --- |
| Permissions | `projects.plan` on every route |
| Capability existence | Unknown names are errors. They are not created |
| Dependencies | Missing required names are errors unless `closeDependencies: true` (explicit request to close the set) |
| Conflicts | Both sides selected → error. Catalog conflicts are listed even when the other side is off |
| Compatibility | Architecture/deployment modes must be registered and supported by selected capabilities/profiles |
| Unimplemented modes | `architecture.microservices` and `deployment.kubernetes` cannot be approved |
| Feature availability | Maps selected capabilities to `FEATURE_*`. Currently-off flags are informational, not enablement. Unknown flag names are warnings |
| Profiles | Optional. An explicit capability list wins over profile members (deselection works). Empty capabilities + a profile applies the composed set |

Environment variables and live providers are **not** probed. This is a plan, not a running process.

## Safety

| Control | Behavior |
| --- | --- |
| UX only | Frontend hide/show does not authorize |
| No enablement | Process `FEATURE_*` is not mutated |
| No generation | No git, filesystem, Docker, or Kubernetes apply path |
| Advisory recommendations | Reasons come from the deterministic engine or human selection notes |
| Audit | `project.planning.analyzed` / `project.planning.approved` store counts, modes, and digest — not the statement |

The approved object includes `integrity.digest` (SHA-256 of the resolved selection). The generator must still run `buildProjectConfiguration` / `assertApprovedConfiguration`. Do not treat the digest as a substitute for validation.

## Tests

* Closed auth stack, unknown names, missing dependencies, `closeDependencies`, unimplemented modes, profile compose vs deselect, feature availability, shuffled input, approve/refuse (`engine.test.ts`)
* Body schema strips `approved` / `resolved` (`schemas.test.ts`)
* Service analyze/validate/approve and disabled flag (`service.test.ts`)
* HTTP: success, `projects.plan` denied, missing body, invalid approve, feature disabled (`backend/tests/project-planning.http.test.ts`)
* UI: analyze → requirements → recommendations → selection → validate → approve (`frontend/src/pages/ProjectPlanningPage.test.tsx`)

## Limitations

* Uploading a file only reads `.txt` / `.md` in the browser. PDFs are not parsed here (use document intelligence).
* Keyword recommendations can miss unfamiliar wording. Humans still select.
* Approving a configuration does not start generation. Use [project-generator.md](project-generator.md) (`FEATURE_PROJECT_GENERATOR`).
* `GET /api/v1/features` remaining off does not stop a human from copying names into `HACKATHON_MODULES.md`.

## Manual verification

1. Set `FEATURE_PROJECT_PLANNING=true`. Restart the API. AI is optional.
2. Sign in as manager/admin (`projects.plan`).
3. Open http://localhost:5173/project-planning.
4. Paste or upload a statement. Analyze. Confirm extracted requirements (or an empty mappings note if problem intelligence is off).
5. Confirm recommended capabilities include reasons, dependencies, and conflicts. Elasticsearch / Kubernetes should not be selected.
6. Change checkboxes, pick a profile, pick architecture and deployment. Validate.
7. Confirm the review shows the backend-resolved architecture. Approve.
8. Confirm the response has `approved: true`, `generatedNothing: true`, and `generation.attempted: false`.
9. Confirm `GET /api/v1/audit` (as a role with `audit.read`) has `project.planning.approved` without the statement text.
