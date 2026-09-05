import type { Prisma } from '@prisma/client';

import { ConflictError, NotFoundError } from '../errors';
import { mapPrismaError } from '../lib/prisma-error';
import {
  parsePagination,
  parseSort,
  toPaginatedResult,
  toPrismaOrderBy,
} from './query';
import type { DbClient } from './types';
import type {
  AutomationAction,
  AutomationActionRunRecord,
  AutomationCondition,
  AutomationExecutionRecord,
  AutomationRuleRecord,
  AutomationStore,
  CreateAutomationRuleInput,
  CreateExecutionInput,
  UpdateAutomationRuleInput,
  UpsertActionRunInput,
} from '../automation/automation.types';

export const AUTOMATION_RULE_SORT_FIELDS = ['priority', 'createdAt', 'updatedAt', 'name'] as const;
export const AUTOMATION_EXECUTION_SORT_FIELDS = ['createdAt', 'updatedAt', 'status'] as const;

export class AutomationRepository implements AutomationStore {
  constructor(private readonly db: DbClient) {}

  async createRule(input: CreateAutomationRuleInput): Promise<AutomationRuleRecord> {
    try {
      const record = await this.db.automationRule.create({
        data: {
          name: input.name,
          description: input.description ?? null,
          enabled: input.enabled ?? false,
          priority: input.priority ?? 100,
          trigger: input.trigger,
          conditions: (input.conditions ?? []) as unknown as Prisma.InputJsonValue,
          actions: input.actions as unknown as Prisma.InputJsonValue,
          source: input.source ?? 'manual',
          allowDestructive: input.allowDestructive ?? false,
          createdById: input.createdById ?? null,
        },
      });
      return toRule(record);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async updateRule(id: string, patch: UpdateAutomationRuleInput): Promise<AutomationRuleRecord> {
    await this.getRule(id);
    try {
      const record = await this.db.automationRule.update({
        where: { id },
        data: {
          name: patch.name,
          description: patch.description === undefined ? undefined : patch.description,
          priority: patch.priority,
          trigger: patch.trigger,
          conditions: patch.conditions as Prisma.InputJsonValue | undefined,
          actions: patch.actions as Prisma.InputJsonValue | undefined,
          allowDestructive: patch.allowDestructive,
          validatedAt: null,
        },
      });
      return toRule(record);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async getRule(id: string): Promise<AutomationRuleRecord> {
    try {
      const record = await this.db.automationRule.findUnique({ where: { id } });
      if (!record) {
        throw new NotFoundError('Automation rule not found');
      }
      return toRule(record);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async listRules(query?: { page?: number; pageSize?: number; trigger?: string; enabled?: boolean }) {
    const pagination = parsePagination(query ?? {});
    const sort = parseSort({}, AUTOMATION_RULE_SORT_FIELDS, 'priority', 'asc');
    const where = {
      ...(query?.trigger ? { trigger: query.trigger } : {}),
      ...(query?.enabled === undefined ? {} : { enabled: query.enabled }),
    };

    try {
      const [items, totalItems] = await Promise.all([
        this.db.automationRule.findMany({
          where,
          orderBy: [toPrismaOrderBy(sort), { createdAt: 'asc' }],
          skip: pagination.skip,
          take: pagination.take,
        }),
        this.db.automationRule.count({ where }),
      ]);
      return toPaginatedResult(items.map(toRule), pagination, totalItems);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async listEnabledRulesByTrigger(trigger: string): Promise<AutomationRuleRecord[]> {
    try {
      const items = await this.db.automationRule.findMany({
        where: { trigger, enabled: true },
        orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      });
      return items.map(toRule);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async setRuleEnabled(id: string, enabled: boolean, validatedAt?: Date | null): Promise<AutomationRuleRecord> {
    await this.getRule(id);
    try {
      const record = await this.db.automationRule.update({
        where: { id },
        data: {
          enabled,
          ...(validatedAt === undefined ? {} : { validatedAt }),
        },
      });
      return toRule(record);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async createExecution(input: CreateExecutionInput): Promise<AutomationExecutionRecord | 'duplicate'> {
    try {
      const record = await this.db.automationExecution.create({
        data: {
          ruleId: input.ruleId,
          eventId: input.eventId,
          trigger: input.trigger,
          status: 'queued',
          maxAttempts: input.maxAttempts ?? 3,
          payload: input.payload as Prisma.InputJsonValue,
        },
        include: { actionRuns: { orderBy: { actionIndex: 'asc' } } },
      });
      return toExecution(record);
    } catch (error) {
      if (error instanceof ConflictError) {
        return 'duplicate';
      }
      try {
        mapPrismaError(error);
      } catch (mapped) {
        if (mapped instanceof ConflictError) {
          return 'duplicate';
        }
        throw mapped;
      }
    }
  }

  async getExecution(id: string): Promise<AutomationExecutionRecord> {
    try {
      const record = await this.db.automationExecution.findUnique({
        where: { id },
        include: { actionRuns: { orderBy: { actionIndex: 'asc' } } },
      });
      if (!record) {
        throw new NotFoundError('Automation execution not found');
      }
      return toExecution(record);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async updateExecution(
    id: string,
    patch: Partial<Pick<AutomationExecutionRecord, 'status' | 'attempt' | 'errorMessage' | 'startedAt' | 'finishedAt'>>,
  ): Promise<AutomationExecutionRecord> {
    try {
      const record = await this.db.automationExecution.update({
        where: { id },
        data: {
          status: patch.status,
          attempt: patch.attempt,
          errorMessage: patch.errorMessage === undefined ? undefined : patch.errorMessage,
          startedAt: patch.startedAt,
          finishedAt: patch.finishedAt,
        },
        include: { actionRuns: { orderBy: { actionIndex: 'asc' } } },
      });
      return toExecution(record);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async listExecutions(query?: {
    page?: number;
    pageSize?: number;
    ruleId?: string;
    status?: AutomationExecutionRecord['status'];
    trigger?: string;
  }) {
    const pagination = parsePagination(query ?? {});
    const sort = parseSort({}, AUTOMATION_EXECUTION_SORT_FIELDS, 'createdAt', 'desc');
    const where = {
      ...(query?.ruleId ? { ruleId: query.ruleId } : {}),
      ...(query?.status ? { status: query.status } : {}),
      ...(query?.trigger ? { trigger: query.trigger } : {}),
    };

    try {
      const [items, totalItems] = await Promise.all([
        this.db.automationExecution.findMany({
          where,
          orderBy: toPrismaOrderBy(sort),
          skip: pagination.skip,
          take: pagination.take,
          include: { actionRuns: { orderBy: { actionIndex: 'asc' } } },
        }),
        this.db.automationExecution.count({ where }),
      ]);
      return toPaginatedResult(items.map(toExecution), pagination, totalItems);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async upsertActionRun(input: UpsertActionRunInput): Promise<AutomationActionRunRecord> {
    try {
      const record = await this.db.automationActionRun.upsert({
        where: {
          executionId_actionIndex: {
            executionId: input.executionId,
            actionIndex: input.actionIndex,
          },
        },
        update: {
          status: input.status,
          attempt: input.attempt,
          result: (input.result ?? undefined) as Prisma.InputJsonValue | undefined,
          errorMessage: input.errorMessage === undefined ? undefined : input.errorMessage,
        },
        create: {
          executionId: input.executionId,
          actionIndex: input.actionIndex,
          actionType: input.actionType,
          status: input.status,
          attempt: input.attempt,
          result: (input.result ?? undefined) as Prisma.InputJsonValue | undefined,
          errorMessage: input.errorMessage ?? null,
        },
      });
      return toActionRun(record);
    } catch (error) {
      mapPrismaError(error);
    }
  }
}

function toRule(record: {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  priority: number;
  trigger: string;
  conditions: Prisma.JsonValue;
  actions: Prisma.JsonValue;
  source: 'manual' | 'ai';
  allowDestructive: boolean;
  validatedAt: Date | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AutomationRuleRecord {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    enabled: record.enabled,
    priority: record.priority,
    trigger: record.trigger,
    conditions: asConditions(record.conditions),
    actions: asActions(record.actions),
    source: record.source,
    allowDestructive: record.allowDestructive,
    validatedAt: record.validatedAt,
    createdById: record.createdById,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toExecution(record: {
  id: string;
  ruleId: string;
  eventId: string;
  trigger: string;
  status: AutomationExecutionRecord['status'];
  attempt: number;
  maxAttempts: number;
  payload: Prisma.JsonValue;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  actionRuns?: Array<{
    id: string;
    executionId: string;
    actionIndex: number;
    actionType: string;
    status: AutomationExecutionRecord['status'];
    attempt: number;
    result: Prisma.JsonValue;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
}): AutomationExecutionRecord {
  return {
    id: record.id,
    ruleId: record.ruleId,
    eventId: record.eventId,
    trigger: record.trigger,
    status: record.status,
    attempt: record.attempt,
    maxAttempts: record.maxAttempts,
    payload: asObject(record.payload),
    errorMessage: record.errorMessage,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    actionRuns: record.actionRuns?.map(toActionRun),
  };
}

function toActionRun(record: {
  id: string;
  executionId: string;
  actionIndex: number;
  actionType: string;
  status: AutomationExecutionRecord['status'];
  attempt: number;
  result: Prisma.JsonValue;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AutomationActionRunRecord {
  return {
    id: record.id,
    executionId: record.executionId,
    actionIndex: record.actionIndex,
    actionType: record.actionType,
    status: record.status,
    attempt: record.attempt,
    result: record.result,
    errorMessage: record.errorMessage,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function asConditions(value: Prisma.JsonValue): AutomationCondition[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => isCondition(item)) as AutomationCondition[];
}

function isCondition(value: unknown): value is AutomationCondition {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'field' in value &&
      'operator' in value &&
      typeof (value as AutomationCondition).field === 'string' &&
      typeof (value as AutomationCondition).operator === 'string',
  );
}

function asActions(value: Prisma.JsonValue): AutomationAction[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item) => isAction(item)) as AutomationAction[];
}

function isAction(value: unknown): value is AutomationAction {
  return Boolean(value && typeof value === 'object' && 'type' in value && typeof (value as AutomationAction).type === 'string');
}

function asObject(value: Prisma.JsonValue): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}
