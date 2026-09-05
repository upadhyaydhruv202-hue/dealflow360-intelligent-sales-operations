# Project generator

Deterministic overlay generator. It consumes an **approved Project Configuration**, re-validates it, and writes an isolated project under `generated/projects/<slug>/`.

It does **not** modify starter-kit source, provider internals, or the kit `.env`. AI recommendations are not an install or shell channel.

```text
Problem statement
  → Analysis
  → Recommendation
  → Human approval
  → Dependency resolution
  → Project Configuration
  → Generator
  → Generated project
  → Validation
```

See `docs/project-generator.md`.
