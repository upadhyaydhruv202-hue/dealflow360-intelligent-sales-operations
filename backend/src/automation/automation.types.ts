import type { z } from 'zod';

import type { AuthenticatedUser } from '../auth/types';
import type { DomainEvent } from '../events';
import type { PaginatedResult, PaginationInput } from '../repositories/query';
import {
  AUTOMATION_BUILTIN_ACTIONS,
  AUTOMATION_BUILTIN_TRIGGERS,
  AUTOMATION_OPERATORS,
} from '../constants';

export const AUTOMATION_RULE_SOURCES = ['manual', 'ai'] as const;
export type AutomationRuleSource = (typeof AUTOMATION_RULE_SOURCES)[number];

export const AUTOMATION_EXECUTION_STATUSES = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'skipped',
] as const;
export type AutomationExecutionStatus = (typeof AUTOMATION_EXECUTION_STATUSES)[number];

export type AutomationOperator = (typeof AUTOMATION_OPERATORS)[number];
export type AutomationBuiltinTrigger = (typeof AUTOMATION_BUILTIN_TRIGGERS)[number];
export type AutomationBuiltinAction = (typeof AUTOMATION_BUILTIN_ACTIONS)[number];

export interface AutomationCondition {
  field: string;
  operator: string;
  value?: unknown;
}

export type AutomationAction = {
  type: string;
} & Record<string, unknown>;

export interface AutomationRuleRecord {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  priority: number;
  trigger: string;
  conditions: AutomationCondition[];
  actions: AutomationAction[];
  source: AutomationRuleSource;
  allowDestructive: boolean;
  validatedAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationActionRunRecord {
  id: string;
  executionId: string;
  actionIndex: number;
  actionType: string;
  status: AutomationExecutionStatus;
  attempt: number;
  result: unknown;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AutomationExecutionRecord {
  id: string;
  ruleId: string;
  eventId: string;
  trigger: string;
  status: AutomationExecutionStatus;
  attempt: number;
  maxAttempts: number;
  payload: Record<string, unknown>;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  actionRuns?: AutomationActionRunRecord[];
}

export interface CreateAutomationRuleInput {
  name: string;
  description?: string;
  enabled?: boolean;
  priority?: number;
  trigger: string;
  conditions?: AutomationCondition[];
  actions: AutomationAction[];
  source?: AutomationRuleSource;
  allowDestructive?: boolean;
  createdById?: string;
}

export interface UpdateAutomationRuleInput {
  name?: string;
  description?: string | null;
  priority?: number;
  trigger?: string;
  conditions?: AutomationCondition[];
  actions?: AutomationAction[];
  allowDestructive?: boolean;
}

export interface AutomationRuleListInput extends PaginationInput {
  trigger?: string;
  enabled?: boolean;
}

export interface AutomationExecutionListInput extends PaginationInput {
  ruleId?: string;
  status?: AutomationExecutionStatus;
  trigger?: string;
}

export interface CreateExecutionInput {
  ruleId: string;
  eventId: string;
  trigger: string;
  payload: Record<string, unknown>;
  maxAttempts?: number;
}

export interface UpsertActionRunInput {
  executionId: string;
  actionIndex: number;
  actionType: string;
  status: AutomationExecutionStatus;
  attempt: number;
  result?: unknown;
  errorMessage?: string | null;
}

export interface AutomationStore {
  createRule(input: CreateAutomationRuleInput): Promise<AutomationRuleRecord>;
  updateRule(id: string, patch: UpdateAutomationRuleInput): Promise<AutomationRuleRecord>;
  getRule(id: string): Promise<AutomationRuleRecord>;
  listRules(query?: AutomationRuleListInput): Promise<PaginatedResult<AutomationRuleRecord>>;
  listEnabledRulesByTrigger(trigger: string): Promise<AutomationRuleRecord[]>;
  setRuleEnabled(id: string, enabled: boolean, validatedAt?: Date | null): Promise<AutomationRuleRecord>;

  createExecution(input: CreateExecutionInput): Promise<AutomationExecutionRecord | 'duplicate'>;
  getExecution(id: string): Promise<AutomationExecutionRecord>;
  updateExecution(
    id: string,
    patch: Partial<
      Pick<
        AutomationExecutionRecord,
        'status' | 'attempt' | 'errorMessage' | 'startedAt' | 'finishedAt'
      >
    >,
  ): Promise<AutomationExecutionRecord>;
  listExecutions(query?: AutomationExecutionListInput): Promise<PaginatedResult<AutomationExecutionRecord>>;
  upsertActionRun(input: UpsertActionRunInput): Promise<AutomationActionRunRecord>;
}

export interface AutomationTriggerDefinition {
  name: string;
  description: string;
}

export interface AutomationActionContext {
  event: DomainEvent;
  rule: AutomationRuleRecord;
  execution: AutomationExecutionRecord;
  actor?: AuthenticatedUser;
  demoMode: boolean;
}

export interface AutomationActionDefinition<TInput = Record<string, unknown>> {
  type: string;
  description: string;
  requiredPermission: string;
  destructive: boolean;
  inputSchema: z.ZodType<TInput>;
  handler: (input: TInput, context: AutomationActionContext) => Promise<unknown> | unknown;
}

export function defineAutomationAction<TInput = Record<string, unknown>>(
  action: AutomationActionDefinition<TInput>,
): AutomationActionDefinition<TInput> {
  return action;
}

/** Heterogeneous registry entry. Each action is still validated with its own Zod schema at execution. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mixed action input types are erased at the registry boundary
export type RegisteredAutomationAction = AutomationActionDefinition<any>;

export interface AutomationActionDescriptor {
  type: string;
  description: string;
  requiredPermission: string;
  destructive: boolean;
  arguments: Record<string, string>;
}

export type ConditionEvaluator = (fieldValue: unknown, compareValue: unknown) => boolean;

export interface RecordUpdater {
  resource: string;
  handler: (
    input: { id: string; data: Record<string, unknown> },
    context: AutomationActionContext,
  ) => Promise<unknown> | unknown;
}

export interface AutomationCatalog {
  triggers: AutomationTriggerDefinition[];
  operators: readonly string[];
  actions: AutomationActionDescriptor[];
}
