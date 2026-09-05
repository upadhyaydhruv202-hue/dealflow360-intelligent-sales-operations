# Platform composition and plugins

API and worker processes share the same service graph in `createApp` / `createBackgroundWorker`. Phase 02 introduced a thin plugin helper so extras register through one contract:

```text
definePlatformPlugin({ name, version?, capabilities?, register(ctx) })
```

`createApp` and `createBackgroundWorker` accept optional `plugins` and call `bindPlatformPlugins` after domain registries exist and before the problem module loads.

## Plugins

A plugin may:

* declare **static** `capabilities` (discoverable without constructing AI, Odoo, or other services)
* `register(ctx)` onto existing registries: copilot tools, intents, Odoo allowlist, automation, reports, jobs, events

A plugin must not:

* import provider SDKs
* bypass `OdooService.execute`
* replace `FEATURE_REGISTRY`, `OdooCapabilityRegistry`, copilot, intent, or automation registries

Plugin names are lowercase dotted identifiers. Plugin versions are semver and default to `PLUGIN_VERSION`. Duplicates fail boot.

## Capability catalog

The canonical machine-readable catalog is `backend/src/capabilities`. `resolveCapabilities` validates an explicit selection (graph, topological order, conflicts, modes, env/infra/providers) and never enables capabilities on its own. Optional project profiles (`resolveProfiles`) compose that catalog; they are not required. Feature flags stay in `FEATURE_REGISTRY`. Job names stay in `JOB_NAMES`. See [capabilities.md](../../docs/capabilities.md), [profiles.md](../../docs/profiles.md), and [composition.md](../../docs/composition.md).

Plugin `version` is semver and defaults to `PLUGIN_VERSION` (`0.1.0`) when omitted.
