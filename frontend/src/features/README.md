# Feature flags (frontend)

UX-only. The API still enforces flags.

`FeatureProvider` loads `GET /api/v1/features` and hides Copilot/Actions/Problem intelligence/Recommendations/Project planning/Project generator/RAG/Anomalies/Realtime/Automations nav when those flags are off. Direct URLs show an empty state. That is not a security control.

```ts
const { isEnabled, isDemo, ready } = useFeatures();
if (isEnabled('copilot')) { /* show chat */ }
if (isEnabled('intents')) { /* show business actions */ }
```

`FEATURE_NAMES` comes from `@hackathon/api-contract`. See [docs/features.md](../../../docs/features.md) and [docs/api-contract.md](../../../docs/api-contract.md).
