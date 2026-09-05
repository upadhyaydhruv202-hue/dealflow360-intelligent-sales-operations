import { API_PATHS } from '@hackathon/api-contract';

import { apiGet, apiRequest } from './api';

export interface AutomationCondition {
  field: string;
  operator: string;
  value?: unknown;
}

export interface AutomationAction {
  type: string;
  [key: string]: unknown;
}

export interface AutomationRule {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  priority: number;
  trigger: string;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  source: 'manual' | 'ai';
  allowDestructive: boolean;
  validatedAt: string | null;
}

export interface AutomationExecution {
  id: string;
  ruleId: string;
  eventId: string;
  trigger: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped';
  attempt: number;
  errorMessage: string | null;
}

export interface AutomationCatalog {
  triggers: Array<{ name: string; description: string }>;
  operators: string[];
  actions: Array<{ type: string; description: string; destructive: boolean; requiredPermission: string }>;
}

export function getAutomationCatalog(token: string): Promise<AutomationCatalog> {
  return apiGet<AutomationCatalog>(API_PATHS.automations.catalog, token);
}

export function listAutomationRules(token: string): Promise<{ items: AutomationRule[] }> {
  return apiGet<{ items: AutomationRule[] }>(API_PATHS.automations.rules, token);
}

export function createAutomationRule(
  input: {
    name: string;
    trigger: string;
    conditions?: AutomationCondition[];
    actions: AutomationAction[];
    enabled?: boolean;
    allowDestructive?: boolean;
  },
  token: string,
): Promise<AutomationRule> {
  return apiRequest<AutomationRule>(API_PATHS.automations.rules, {
    method: 'POST',
    token,
    body: input,
  });
}

export function setAutomationRuleEnabled(id: string, enabled: boolean, token: string): Promise<AutomationRule> {
  return apiRequest<AutomationRule>(
    enabled ? API_PATHS.automations.enableRule(id) : API_PATHS.automations.disableRule(id),
    {
      method: 'POST',
      token,
    },
  );
}

export function emitAutomationEvent(
  input: { trigger: string; eventId?: string; payload?: Record<string, unknown> },
  token: string,
): Promise<{ id: string; type: string }> {
  return apiRequest(API_PATHS.automations.events, {
    method: 'POST',
    token,
    body: input,
  });
}

export function listAutomationExecutions(token: string): Promise<{ items: AutomationExecution[] }> {
  return apiGet<{ items: AutomationExecution[] }>(API_PATHS.automations.executions, token);
}
