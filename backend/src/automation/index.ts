export { createAutomationService, AutomationService, isAutomationEnabled } from './automation.service';
export type { AutomationServiceOptions } from './automation.service';
export { AutomationEngine } from './automation.engine';
export { createMemoryAutomationStore } from './automation.memory';
export {
  createAutomationRegistries,
  AutomationTriggerRegistry,
  AutomationActionRegistry,
} from './automation.registry';
export type { AutomationRegistries } from './automation.registry';
export { defineAutomationAction } from './automation.types';
export { createBuiltinConditionRegistry, matchesConditions } from './automation.conditions';
export { registerDefaultAutomation, registerBuiltinActions } from './actions';
export { registerBuiltinTriggers } from './triggers/builtin';
export {
  createAutomationRuleBodySchema,
  updateAutomationRuleBodySchema,
  emitAutomationEventBodySchema,
} from './automation.schemas';
export type {
  AutomationAction,
  AutomationCatalog,
  AutomationCondition,
  AutomationRuleRecord,
  AutomationStore,
  RegisteredAutomationAction,
} from './automation.types';
