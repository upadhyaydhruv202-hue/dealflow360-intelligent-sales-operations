import { createCopilotToolRegistry, type CopilotToolRegistry } from '../copilot.registry';
import { registerBuiltinCopilotTools, type BuiltinCopilotToolDeps } from './builtin';
import { registerDemoCopilotTools } from './demo';

export function createDefaultCopilotRegistry(
  deps: BuiltinCopilotToolDeps & { demoMode?: boolean },
): CopilotToolRegistry {
  const registry = createCopilotToolRegistry();
  registerBuiltinCopilotTools(registry, deps);
  if (deps.demoMode) {
    registerDemoCopilotTools(registry);
  }
  return registry;
}

export { registerBuiltinCopilotTools } from './builtin';
export { registerDemoCopilotTools, resetDemoCopilotData } from './demo';
