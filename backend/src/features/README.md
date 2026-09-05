# Feature flags and demo mode

Env-based flags so a new hackathon can turn capabilities on or off. There is no remote flag service.

Server evaluation is authoritative. The frontend may hide navigation from `GET /api/v1/features`; that is UX only.

```ts
import { isFeatureEnabled, isDemoMode, requireFeature } from '../features';

if (isFeatureEnabled(config, 'copilot')) { /* register routes */ }
if (isFeatureEnabled(config, 'intents')) { /* register intent engine */ }
if (isFeatureEnabled(config, 'problemIntelligence')) { /* register problem analyzer */ }
if (isFeatureEnabled(config, 'capabilityRecommendations')) { /* register recommendation engine */ }
if (isFeatureEnabled(config, 'projectPlanning')) { /* register project planning */ }
if (isFeatureEnabled(config, 'projectGenerator')) { /* register project generator */ }
if (isDemoMode(config)) { /* mock OTP, email, SMS, optional AI */ }
requireFeature(config, 'odoo'); // throws FEATURE_DISABLED
requireEnabledService(service, 'copilot'); // throws FEATURE_DISABLED when the service was not constructed
```

`FEATURE_NAMES` is imported from `@hackathon/api-contract`. See [docs/features.md](../../../docs/features.md) and [docs/api-contract.md](../../../docs/api-contract.md) for the registry (name, default, dependencies, purpose).
