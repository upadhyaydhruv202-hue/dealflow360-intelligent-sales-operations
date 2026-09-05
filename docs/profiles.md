# Project profiles

Named, composable sets of platform capabilities. A profile does **not** contain business logic, turn on `FEATURE_*`, or generate a project. It is a shortcut over the capability catalog.

Profiles are **optional**. A problem may select capabilities directly with `resolveCapabilities`. Use a profile only when the shortcut matches the work.

```text
resolveProfiles({ profiles, selected, includeOptional })
  → expand includes (inheritance)
  → union declared capabilities + extras
  → compatibility / maturity / combination checks
  → resolveCapabilities(composed)
```

No AI, Odoo, email, Kubernetes, or WebSocket services are constructed.

## Not a duplicate of existing registries

| Registry | Purpose |
| --- | --- |
| `FEATURE_REGISTRY` | Runtime `FEATURE_*` on/off switches |
| Capability catalog | What the kit provides |
| `resolveCapabilities` | Validate an explicit capability set |
| This catalog (`backend/src/capabilities/profiles`) | Named compositions of those capabilities |

A profile never replaces flags. After you like a composed set, still set `FEATURE_*` and env for the process you will run.

## Shipped profiles

| Profile | Maturity | Composes |
| --- | --- | --- |
| Basic Web | stable | Auth, RBAC, Postgres, UI kit, CI |
| AI Application | stable | Basic Web + AI toolkit, guardrails, AI UI (optional: copilot, intents, RAG, problem intelligence) |
| Odoo Application | stable | Basic Web + Odoo JSON-2 |
| Document Intelligence | stable | AI Application + documents, storage, jobs |
| Automation | stable | Basic Web + events, jobs, workflows, scheduler, notifications, email |
| Analytics | stable | Basic Web + analytics queries, dashboard, charts, reports, PDF |
| Integration-Heavy | stable | Basic Web + Odoo, email, SMS, storage, webhooks, OTP |
| Real-Time | beta | Events, jobs, notifications, scheduler, optional SSE (`FEATURE_REALTIME`). **Not WebSockets.** |
| Data-Heavy | stable | Jobs, storage, reports, Redis. Optional `search` on PostgreSQL. **Not a second database.** |
| Offline/Resilient | beta | Jobs, events, local storage, demo mocks. **Not a PWA/sync engine.** |
| Cloud-Native | experimental | Docker Compose, GitHub Actions, observability. **Not Kubernetes.** |
| Enterprise Application | enterprise | Basic Web + automation + analytics + audit + OTP |

Profiles **include** other profiles instead of copying capability lists. Enterprise includes Basic Web, Automation, and Analytics. Document Intelligence includes AI Application, which includes Basic Web.

Do not treat Cloud-Native or Offline/Resilient as implemented infrastructure. They only name capabilities that already exist (or, for Kubernetes, an experimental unimplemented mode). Real-Time includes optional SSE; it still does not open WebSockets or start a separate realtime service.

## Maturity

`experimental` · `beta` · `stable` · `enterprise` · `deprecated`

Same vocabulary as capabilities. Catalog capabilities stay `stable` / `beta` / `experimental`; none are marked `enterprise`. The Enterprise Application **profile** uses `enterprise` maturity to mark that composition.

`resolveProfiles` warns on `experimental` and `deprecated`. Pass `allowMaturities` to turn disallowed maturities into errors.

## Versions

| Concept | Where | Default |
| --- | --- | --- |
| Platform version | kit / `PLATFORM_VERSION` | `0.1.0` (root `package.json`) |
| Capability version | each capability `version` | `CAPABILITY_VERSION` |
| Profile version | each profile `version` | `PROFILE_VERSION` |
| Plugin version | `definePlatformPlugin({ version })` | `PLUGIN_VERSION` when omitted |

Constraints use npm-style ranges (`^0.1.0`, `>=0.1.0 <1.0.0`, `||`). A profile may constrain:

* platform version
* capability versions (checked only when that capability is composed)
* included profile versions
* plugin versions (checked only when that plugin is present)

`requiredPlugins` fails if the named plugin is missing from the resolve input.

## Resolver rules

* **Not mandatory.** `profiles` may be omitted. Direct `selected` capability names still work.
* **Never silently enable.** Optional profile extras are skipped unless `includeOptional: true`. Required capability dependencies are **not** auto-added unless `closeDependencies: true`.
* **Deterministic.** Profile names, composed capabilities, and issues are sorted. Input shuffle does not change the result.
* **Compose, then validate.** The composed name list is passed to `resolveCapabilities` (conflicts, missing deps, architecture/deployment modes, env/infra/providers).
* **No process probing.** Callers pass `platformVersion`, `plugins`, `environment`, `infrastructure`, and `providers`.

Unsupported combinations include:

* a profile whose `architectureCompatibility` / `deploymentCompatibility` does not include the requested mode (for example Basic Web + Kubernetes)
* `incompatibleWith` rules (Cloud-Native + `deployment.kubernetes`)
* profile-level `conflicts` / `conflictingProfiles`
* version mismatches
* maturities excluded by `allowMaturities`

```ts
import { resolveProfiles, assertProfileResolution, PROFILE_NAMES } from './capabilities';

const byCapabilities = resolveProfiles({
  selected: ['auth', 'database', 'infrastructure.postgres'],
});

const byProfile = resolveProfiles({
  profiles: [PROFILE_NAMES.aiApplication],
  selected: ['storage'],
});

if (!byProfile.valid) {
  // inspect byProfile.issues; do not enable FEATURE_* here
}

assertProfileResolution(byProfile);
byProfile.composed; // union of Basic Web + AI toolkit + storage
byProfile.capabilityResolution.ordered; // topological order of that set
```

`includeOptional: true` adds each profile's `optionalCapabilities`. That can make Cloud-Native invalid (it optionally names unimplemented Kubernetes).

## Public interface

| Helper | Role |
| --- | --- |
| `listPlatformProfiles()` / `PLATFORM_PROFILES` | Shipped catalog |
| `createPlatformProfileRegistry()` | Registry preloaded with the catalog |
| `ProfileRegistry.register` | Validate and add one profile; duplicates fail |
| `resolveProfiles(input)` / `registry.resolve` | Compose + validate |
| `assertProfileResolution(result)` | Throw `ValidationError` when `valid` is false |
| `GET /api/v1/capabilities` | Public snapshot includes `profiles` and `versions` |

## Tests

* profile resolution, inheritance, conflicts, dependencies (`backend/src/capabilities/profiles/resolve.test.ts`)
* version compatibility and unsupported combinations (same file)
* registry validation (`registry.test.ts`)
* plugin version (`plugins.test.ts`)
* HTTP snapshot (`backend/tests/capabilities.http.test.ts`)

## Limitations

* Profiles do not generate a project, write `.env`, or enable feature flags. The [capability recommendation engine](capability-recommendations.md) may suggest a profile; the [project planning](project-planning.md) wizard records the human choice and validates it. The [project generator](project-generator.md) consumes the approved configuration.
* Cloud-Native does not install a cluster. Real-Time does not open WebSockets. Offline/Resilient does not add a service worker.
* `GET /api/v1/capabilities` is informational. RBAC and feature flags remain authoritative for access.
