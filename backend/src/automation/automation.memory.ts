import { randomUUID } from 'node:crypto';

import { NotFoundError } from '../errors';
import { parsePagination, toPaginatedResult } from '../repositories/query';
import type {
  AutomationActionRunRecord,
  AutomationExecutionRecord,
  AutomationRuleRecord,
  AutomationStore,
  CreateAutomationRuleInput,
  CreateExecutionInput,
  UpdateAutomationRuleInput,
  UpsertActionRunInput,
} from './automation.types';

interface MemoryExecution extends AutomationExecutionRecord {
  actionRuns: AutomationActionRunRecord[];
}

export function createMemoryAutomationStore(): AutomationStore & {
  rules: Map<string, AutomationRuleRecord>;
  executions: Map<string, MemoryExecution>;
} {
  const rules = new Map<string, AutomationRuleRecord>();
  const executions = new Map<string, MemoryExecution>();

  return {
    rules,
    executions,

    async createRule(input: CreateAutomationRuleInput) {
      const now = new Date();
      const record: AutomationRuleRecord = {
        id: randomUUID(),
        name: input.name,
        description: input.description ?? null,
        enabled: input.enabled ?? false,
        priority: input.priority ?? 100,
        trigger: input.trigger,
        conditions: input.conditions ?? [],
        actions: input.actions,
        source: input.source ?? 'manual',
        allowDestructive: input.allowDestructive ?? false,
        validatedAt: null,
        createdById: input.createdById ?? null,
        createdAt: now,
        updatedAt: now,
      };
      rules.set(record.id, record);
      return cloneRule(record);
    },

    async updateRule(id: string, patch: UpdateAutomationRuleInput) {
      const current = requireRule(rules, id);
      const next: AutomationRuleRecord = {
        ...current,
        ...patch,
        description: patch.description === undefined ? current.description : patch.description,
        conditions: patch.conditions ?? current.conditions,
        actions: patch.actions ?? current.actions,
        validatedAt: null,
        updatedAt: new Date(),
      };
      rules.set(id, next);
      return cloneRule(next);
    },

    async getRule(id: string) {
      return cloneRule(requireRule(rules, id));
    },

    async listRules(query) {
      const pagination = parsePagination(query ?? {});
      let items = [...rules.values()];
      if (query?.trigger) {
        items = items.filter((item) => item.trigger === query.trigger);
      }
      if (query?.enabled !== undefined) {
        items = items.filter((item) => item.enabled === query.enabled);
      }
      items.sort((left, right) => {
        if (left.priority !== right.priority) {
          return left.priority - right.priority;
        }
        return left.createdAt.getTime() - right.createdAt.getTime();
      });
      return toPaginatedResult(
        items.slice(pagination.skip, pagination.skip + pagination.take).map(cloneRule),
        pagination,
        items.length,
      );
    },

    async listEnabledRulesByTrigger(trigger: string) {
      return [...rules.values()]
        .filter((item) => item.enabled && item.trigger === trigger)
        .sort((left, right) => {
          if (left.priority !== right.priority) {
            return left.priority - right.priority;
          }
          return left.createdAt.getTime() - right.createdAt.getTime();
        })
        .map(cloneRule);
    },

    async setRuleEnabled(id: string, enabled: boolean, validatedAt?: Date | null) {
      const current = requireRule(rules, id);
      const next: AutomationRuleRecord = {
        ...current,
        enabled,
        validatedAt: validatedAt === undefined ? current.validatedAt : validatedAt,
        updatedAt: new Date(),
      };
      rules.set(id, next);
      return cloneRule(next);
    },

    async createExecution(input: CreateExecutionInput) {
      const duplicate = [...executions.values()].find(
        (item) => item.ruleId === input.ruleId && item.eventId === input.eventId,
      );
      if (duplicate) {
        return 'duplicate';
      }

      const now = new Date();
      const record: MemoryExecution = {
        id: randomUUID(),
        ruleId: input.ruleId,
        eventId: input.eventId,
        trigger: input.trigger,
        status: 'queued',
        attempt: 0,
        maxAttempts: input.maxAttempts ?? 3,
        payload: input.payload,
        errorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
        actionRuns: [],
      };
      executions.set(record.id, record);
      return cloneExecution(record);
    },

    async getExecution(id: string) {
      return cloneExecution(requireExecution(executions, id));
    },

    async updateExecution(id, patch) {
      const current = requireExecution(executions, id);
      const next: MemoryExecution = {
        ...current,
        ...patch,
        updatedAt: new Date(),
      };
      executions.set(id, next);
      return cloneExecution(next);
    },

    async listExecutions(query) {
      const pagination = parsePagination(query ?? {});
      let items = [...executions.values()];
      if (query?.ruleId) {
        items = items.filter((item) => item.ruleId === query.ruleId);
      }
      if (query?.status) {
        items = items.filter((item) => item.status === query.status);
      }
      if (query?.trigger) {
        items = items.filter((item) => item.trigger === query.trigger);
      }
      items.sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
      return toPaginatedResult(
        items.slice(pagination.skip, pagination.skip + pagination.take).map(cloneExecution),
        pagination,
        items.length,
      );
    },

    async upsertActionRun(input: UpsertActionRunInput) {
      const execution = requireExecution(executions, input.executionId);
      const now = new Date();
      const existing = execution.actionRuns.find((item) => item.actionIndex === input.actionIndex);
      const record: AutomationActionRunRecord = existing
        ? {
            ...existing,
            status: input.status,
            attempt: input.attempt,
            result: input.result ?? existing.result,
            errorMessage: input.errorMessage === undefined ? existing.errorMessage : input.errorMessage,
            updatedAt: now,
          }
        : {
            id: randomUUID(),
            executionId: input.executionId,
            actionIndex: input.actionIndex,
            actionType: input.actionType,
            status: input.status,
            attempt: input.attempt,
            result: input.result ?? null,
            errorMessage: input.errorMessage ?? null,
            createdAt: now,
            updatedAt: now,
          };
      if (existing) {
        Object.assign(existing, record);
      } else {
        execution.actionRuns.push(record);
      }
      return { ...record };
    },
  };
}

function requireRule(rules: Map<string, AutomationRuleRecord>, id: string): AutomationRuleRecord {
  const record = rules.get(id);
  if (!record) {
    throw new NotFoundError('Automation rule not found');
  }
  return record;
}

function requireExecution(
  executions: Map<string, MemoryExecution>,
  id: string,
): MemoryExecution {
  const record = executions.get(id);
  if (!record) {
    throw new NotFoundError('Automation execution not found');
  }
  return record;
}

function cloneRule(record: AutomationRuleRecord): AutomationRuleRecord {
  return {
    ...record,
    conditions: record.conditions.map((item) => ({ ...item })),
    actions: record.actions.map((item) => ({ ...item })),
  };
}

function cloneExecution(record: MemoryExecution): AutomationExecutionRecord {
  return {
    ...record,
    payload: { ...record.payload },
    actionRuns: record.actionRuns.map((item) => ({ ...item })),
  };
}
