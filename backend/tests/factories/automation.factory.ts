import { randomUUID } from 'node:crypto';

import type { Repositories } from '../../src/repositories';
import type { CreateAutomationRuleInput } from '../../src/automation/automation.types';
import { uniqueLabel } from './sequence';

export function buildAutomationRule(overrides: Partial<CreateAutomationRuleInput> = {}): CreateAutomationRuleInput {
  return {
    name: overrides.name ?? `Factory rule ${uniqueLabel('')}`,
    description: overrides.description ?? 'Reusable automation fixture',
    enabled: overrides.enabled ?? false,
    priority: overrides.priority ?? 100,
    trigger: overrides.trigger ?? 'webhook.received',
    conditions: overrides.conditions ?? [],
    actions: overrides.actions ?? [{ type: 'recordNote' }],
    source: overrides.source ?? 'manual',
    allowDestructive: overrides.allowDestructive ?? false,
    createdById: overrides.createdById,
  };
}

export async function createAutomationRule(
  repos: Repositories,
  overrides: Partial<CreateAutomationRuleInput> = {},
) {
  return repos.automation.createRule(buildAutomationRule(overrides));
}

export function buildAutomationEvent(overrides: { eventId?: string; trigger?: string; payload?: Record<string, unknown> } = {}) {
  const trigger = overrides.trigger ?? 'webhook.received';
  return {
    type: trigger,
    id: overrides.eventId ?? `${trigger}:${randomUUID()}`,
    payload: overrides.payload ?? { source: 'factory' },
  };
}
