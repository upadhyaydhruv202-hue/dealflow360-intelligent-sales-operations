# Project planning

Human-driven capability selection that produces a **validated Project Configuration**. Frontend is UX only. The backend re-validates existence, dependencies, conflicts, compatibility, and feature-flag availability.

This module does **not** generate a project, write `.env`, enable `FEATURE_*`, or construct services.

```text
statement / catalog selection
  → optional problem intelligence
  → advisory recommendations (pure engine)
  → human select / deselect
  → resolveProfiles + resolveCapabilities
  → Project Configuration (draft | invalid | approved)
```

Phase 11 consumes the approved object and must re-validate it. The [project generator](../../../docs/project-generator.md) performs that step. Do not trust a blob from the browser.

See `docs/project-planning.md`.
