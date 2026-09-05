# Capability registry

Canonical **machine-readable** catalog of what this kit provides. It describes capabilities; it does not construct them.

```text
discoverCapabilities({ config, plugins })
  → PLATFORM_CAPABILITIES + plugin.capabilities
  → enabled flags from env / provider selection

resolveCapabilities({ selected, architectureMode, deploymentMode, environment, infrastructure, providers })
  → dependency graph
  → topological order of the explicit selection
  → validation issues (never auto-enables anything)

resolveProfiles({ profiles, selected })
  → optional profile includes (inheritance)
  → union of declared capabilities + extras
  → resolveCapabilities(composed)
```

No AI, Odoo, email, or other services are constructed. Profiles are optional; you may still pass capability names directly to `resolveCapabilities`.

## Not a duplicate of existing registries

| Registry | Purpose |
| --- | --- |
| This catalog (`backend/src/capabilities`) | Platform capability metadata |
| Dependency resolver (`resolveCapabilities`) | Graph, order, and validation of an **explicit** selection |
| Project profiles (`resolveProfiles`) | Optional named compositions of that catalog. See [profiles.md](profiles.md) |
| `FEATURE_REGISTRY` | Runtime `FEATURE_*` on/off switches |
| `OdooCapabilityRegistry` | Allowlisted Odoo model/method pairs |
| Copilot / intent / automation / report / channel registries | Runtime tool, intent, action, template, and adapter instances |

Do not register Odoo `partners.read`-style allowlist entries here. Do not replace `FEATURE_*` with this catalog. Discovery can still report copilot enabled while AI is off (not an AND-gate). The resolver is stricter: if you select `copilot` without `ai`, that is a missing-dependency error — it does not turn AI on.

## Kinds

| Kind | Examples |
| --- | --- |
| `application` | auth, ai, copilot, automation |
| `infrastructure` | postgres, redis, docker, GitHub Actions |
| `adapter` | Gemini, SMTP, S3, Odoo JSON-2 |
| `architecture-mode` | modular monolith (default); microservices is experimental and unimplemented |
| `deployment-mode` | local-hybrid, docker-compose; Kubernetes is experimental and unimplemented |

## Maturity

`experimental` · `beta` · `stable` · `enterprise` · `deprecated`

Shipped READY modules are **stable**. Optional RAG/anomaly are stable and off by default. DealFlow360 (`problem.dealflow`) occupies the problem slot. Unbuilt modes (Kubernetes, extra Node services) are **experimental**. Capability entries are not marked **enterprise**; the Enterprise Application **profile** is.

## Versions

| Concept | Constant / field | Role |
| --- | --- | --- |
| Platform version | `PLATFORM_VERSION` | Kit version; profile compatibility target |
| Capability version | each `capability.version` (default `CAPABILITY_VERSION`) | Catalog entry version |
| Profile version | each `profile.version` (default `PROFILE_VERSION`) | Profile catalog entry version |
| Plugin version | `plugin.version` (default `PLUGIN_VERSION`) | `definePlatformPlugin` semver |

All four use strict `major.minor.patch` with optional prerelease (no leading `v`). Profiles may declare ranges against them; see [profiles.md](profiles.md).

## Metadata

Each entry includes name, version, kind, category, maturity, dependencies, optional dependencies, conflicts, environment / infrastructure / provider requirements, permissions, architecture and deployment compatibility, frontend/backend availability, worker and database requirements, tests, and documentation.

## Dependency resolver

The resolver is for **profiles**, **problem analysis**, **recommendations**, **project planning**, and **project generation**. It does not generate a project by itself.

It reads Phase 05 metadata:

| Field | Resolver treatment |
| --- | --- |
| `dependencies` | Must already be in `selected`. Missing names are errors. They are **not** added. |
| `optionalDependencies` | Recorded on the graph and listed as `optionalMissing`. Not errors. |
| `conflicts` | Error when both names are selected (reported once, sorted). |
| `environmentRequirements` | Checked only when `environment` is passed (including `{}`). |
| `infrastructureRequirements` | All must be listed when `infrastructure` is passed (AND). |
| `providerRequirements` | At least one must match when `providers` is passed (OR). |
| `architectureCompatibility` | Must include the requested `architectureMode` (default: modular monolith). |
| `deploymentCompatibility` | Must include the requested `deploymentMode` (default: local-hybrid). |

Detection:

* missing dependencies (direct required names that were not selected)
* circular required dependencies (canonical cycle, including unselected closure members)
* conflicts
* unsupported or unregistered architecture modes
* unsupported or unregistered deployment modes
* missing environment variables
* unavailable providers
* missing infrastructure tokens

Rules:

* **Deterministic.** `selected`, `ordered`, `required`, `missing`, graph nodes/edges, and issues are sorted with a fixed name order. Input shuffle does not change the result. Topological ties pick the lexicographically smallest ready name.
* **Never silently enable.** `selected` and `ordered` contain only names the caller passed (unknown names dropped from `ordered`). `required` / `missing` are reports, not an enablement list. Default-enabled catalog entries are not pulled in. Unselected dependencies do not contribute env/provider/infra checks.
* **No process probing.** The resolver does not read `process.env`, detect Docker, or infer providers from `AppConfig`. Callers pass snapshots.
* Environment, infrastructure, and provider checks are skipped when those inputs are omitted, so the recommendation engine can inspect the graph before a profile exists.

```ts
import { resolveCapabilities, assertCapabilityResolution } from './capabilities';

const resolution = resolveCapabilities({
  selected: ['auth', 'database', 'infrastructure.postgres'],
  architectureMode: 'architecture.modular-monolith',
  deploymentMode: 'deployment.local-hybrid',
  environment: { DATABASE_URL: 'postgres://…', JWT_ACCESS_SECRET: '…', JWT_REFRESH_SECRET: '…' },
  infrastructure: ['postgres'],
});

if (!resolution.valid) {
  // inspect resolution.issues; do not enable missing names here
}

assertCapabilityResolution(resolution); // throws ValidationError when invalid
resolution.ordered; // ['infrastructure.postgres', 'database', 'auth']
```

`requiredClosure(graph, names)` and `buildCapabilityGraph(capabilities)` are the primitives later stages should reuse. A project generator must pass an explicit closed selection; it must not treat `missing` as an automatic include list.

## Public interface

| Helper | Role |
| --- | --- |
| `discoverCapabilities(options)` | Catalog + plugin metadata; no service graph |
| `createPlatformCapabilityRegistry()` | Registry preloaded with the catalog |
| `createPlatformProfileRegistry()` | Registry preloaded with optional project profiles |
| `CapabilityRegistry.register` | Validate and add one entry; duplicates fail |
| `registry.discover(config)` | Snapshot with `enabled` |
| `registry.graph()` / `buildCapabilityGraph` | Deterministic dependency graph |
| `resolveCapabilities(input)` / `registry.resolve` | Validate an explicit selection |
| `assertCapabilityResolution(result)` | Throw `ValidationError` when `valid` is false |
| `resolveProfiles(input)` / `ProfileRegistry.resolve` | Optional profile composition; see [profiles.md](profiles.md) |
| `definePlatformPlugin({ name, version, capabilities, register })` | Phase 02 plugin contract (version defaults to `PLUGIN_VERSION`) |
| `GET /api/v1/capabilities` | Public snapshot: capabilities, profiles, and version constants (no secrets) |

```ts
import { discoverCapabilities, resolveCapabilities, resolveProfiles } from './capabilities';
import { loadConfig } from './config';

const snapshot = discoverCapabilities({ config: loadConfig(process.env) });
const resolution = resolveCapabilities({ selected: ['rbac', 'auth', 'database', 'infrastructure.postgres'] });
const fromProfile = resolveProfiles({ selected: ['rbac', 'auth', 'database', 'infrastructure.postgres'] });
```

`enabled` follows `FEATURE_*` for flagged application capabilities, selected providers for adapters, and `defaultEnabled` otherwise. Copilot can be enabled while AI is off — the same as `FEATURE_REGISTRY` (not an AND-gate).

## Plugins

```ts
definePlatformPlugin({
  name: 'hackathon.inventory',
  version: '0.1.0',
  capabilities: [inventoryCapability],
  register(ctx) {
    ctx.registries.copilot?.register(tool);
  },
});
```

Static `capabilities` are discoverable without calling `register()`. `createApp({ plugins })` and `createBackgroundWorker({ plugins })` apply them after domain registries exist.

Problem modules may declare `capabilities` on `problemModule`. DealFlow360 registers `problem.dealflow`.

## Tests

* registration, duplicates, metadata validation, version validation (`backend/src/capabilities/registry.test.ts`)
* discovery and disabled flags (`discover.test.ts`)
* plugin registration (`plugins.test.ts`)
* dependency graph, topological order, resolver issues, catalog integrity (`resolve.test.ts`)
* profile resolution, inheritance, conflicts, versions (`profiles/resolve.test.ts`)
* HTTP snapshot (`backend/tests/capabilities.http.test.ts`)
* problem-statement intelligence (`backend/src/problem-intelligence`, `backend/tests/problem-intelligence.http.test.ts`)
* capability recommendations (`backend/src/capability-recommendations`, `backend/tests/capability-recommendations.http.test.ts`)
* project planning (`backend/src/project-planning`, `backend/tests/project-planning.http.test.ts`)
* project generator (`backend/src/project-generator`, `backend/tests/project-generator.http.test.ts`)

## Limitations

* Problem analysis (`problem.intelligence`) classifies requirements against this catalog. The recommendation engine (`capability.recommendations`) proposes an advisory selection. Project planning (`project.planning`) validates a human selection into a Project Configuration. The project generator (`project.generator`) consumes an approved configuration and writes an isolated overlay. Profiles and the resolver remain the shared contract.
* Listing Kubernetes or microservices as experimental does not implement them. The resolver will still reject selections that are incompatible with the requested modes.
* Profiles are optional metadata. They do not enable `FEATURE_*` or construct services.
* `GET /api/v1/capabilities` is informational. RBAC and feature flags remain authoritative for access.
