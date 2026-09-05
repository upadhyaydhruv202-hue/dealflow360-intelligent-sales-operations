import { createIntentRegistry, type IntentRegistry } from '../intents.registry';
import { registerDemoIntents } from './demo';
import type { RegisteredIntent } from '../intents.types';

export function createDefaultIntentRegistry(options: {
  demoMode?: boolean;
  extra?: readonly RegisteredIntent[];
} = {}): IntentRegistry {
  const registry = createIntentRegistry();
  if (options.demoMode) {
    registerDemoIntents(registry);
  }
  for (const intent of options.extra ?? []) {
    registry.register(intent);
  }
  return registry;
}

export { registerDemoIntents, resetDemoIntentData } from './demo';
