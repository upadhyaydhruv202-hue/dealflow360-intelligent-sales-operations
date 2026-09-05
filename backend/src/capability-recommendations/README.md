# Capability recommendation engine

Deterministic, advisory mapping from a **structured problem-statement analysis** to platform capabilities, profiles, adapters, infrastructure, and architecture/deployment modes.

```text
Structured analysis (spec + mappings)
 → signal detection (catalog names + keywords)
 → baseline Basic Web + justified extras
 → never-select policy (Kafka, Elasticsearch, microservices, Kubernetes)
 → required-dependency closure (not optional extras)
 → default adapters (mocks / local / JSON-2)
 → named profiles as shortcuts
 → resolveCapabilities (validate, do not enable)
```

The engine does not call AI, write `.env`, enable `FEATURE_*`, or generate a project. Human selection remains authoritative.

See `docs/capability-recommendations.md`.
