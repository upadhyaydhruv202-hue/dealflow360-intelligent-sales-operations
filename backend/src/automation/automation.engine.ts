import { AUTOMATION } from '../constants';
import { AuthorizationError, ValidationError } from '../errors';
import { sanitizeErrorDetails, sanitizeErrorMessage } from '../errors/sanitize';
import type { DomainEvent } from '../events';
import type { JobQueue } from '../jobs/queue';
import { hasPermission } from '../rbac/authorize';
import { parseWithSchema } from '../schemas/parse';
import type { AppLogger } from '../utils/logger';
import type { AuditService } from '../audit/audit.service';
import { matchesConditions } from './automation.conditions';
import type { AutomationRegistries } from './automation.registry';
import { automationExecuteJobPayloadSchema } from './automation.schemas';
import type {
  AutomationAction,
  AutomationExecutionRecord,
  AutomationRuleRecord,
  AutomationStore,
} from './automation.types';

export interface AutomationEngineOptions {
  store: AutomationStore;
  registries: AutomationRegistries;
  jobs: JobQueue;
  logger: AppLogger;
  audit?: AuditService | null;
  demoMode: boolean;
  onExecutionUpdated?: (event: {
    executionId: string;
    ruleId: string;
    status: string;
    trigger: string;
    attempt: number;
    errorMessage?: string | null;
  }) => void;
}

export class AutomationEngine {
  constructor(private readonly options: AutomationEngineOptions) {}

  registerJobs(): void {
    this.options.jobs.process(AUTOMATION.EXECUTE_JOB, async (payload) => {
      const job = parseWithSchema(automationExecuteJobPayloadSchema, payload, {
        source: 'job',
        message: 'Invalid automation job payload',
      });
      await this.runExecution(job.executionId, job.actor);
    });
  }

  async handleEvent(event: DomainEvent): Promise<{ matched: number; queued: number; skipped: number }> {
    const rules = await this.options.store.listEnabledRulesByTrigger(event.type);
    let queued = 0;
    let skipped = 0;

    for (const rule of rules) {
      let matches = false;
      try {
        matches = matchesConditions(rule.conditions, event.payload, this.options.registries.operators);
      } catch (error) {
        this.options.logger.warn(
          { err: error, ruleId: rule.id, eventId: event.id, trigger: event.type },
          'Automation condition evaluation failed',
        );
        skipped += 1;
        continue;
      }

      if (!matches) {
        skipped += 1;
        continue;
      }

      const created = await this.options.store.createExecution({
        ruleId: rule.id,
        eventId: event.id,
        trigger: event.type,
        payload: event.payload,
        maxAttempts: AUTOMATION.JOB_ATTEMPTS,
      });

      if (created === 'duplicate') {
        skipped += 1;
        continue;
      }

      this.emitExecution(created);

      await this.options.jobs.enqueue(
        AUTOMATION.EXECUTE_JOB,
        { executionId: created.id, actor: event.actor },
        {
          attempts: created.maxAttempts,
          backoffMs: AUTOMATION.JOB_BACKOFF_MS,
          jobId: `automation.execute:${created.id}`,
        },
      );
      queued += 1;
    }

    return { matched: rules.length, queued, skipped };
  }

  async runExecution(
    executionId: string,
    actor?: DomainEvent['actor'],
  ): Promise<AutomationExecutionRecord> {
    const execution = await this.options.store.getExecution(executionId);
    if (execution.status === 'succeeded') {
      return execution;
    }

    const rule = await this.options.store.getRule(execution.ruleId);
    const started = await this.options.store.updateExecution(executionId, {
      status: 'running',
      attempt: execution.attempt + 1,
      startedAt: execution.startedAt ?? new Date(),
      errorMessage: null,
    });
    this.emitExecution(started);

    const event: DomainEvent = {
      id: execution.eventId,
      type: execution.trigger,
      occurredAt: execution.createdAt.toISOString(),
      payload: execution.payload,
      actor,
    };

    try {
      for (let index = 0; index < rule.actions.length; index += 1) {
        const existing = started.actionRuns?.find((run) => run.actionIndex === index);
        if (existing?.status === 'succeeded') {
          continue;
        }
        await this.runAction(rule, started, event, rule.actions[index], index);
      }

      const completed = await this.options.store.updateExecution(executionId, {
        status: 'succeeded',
        finishedAt: new Date(),
        errorMessage: null,
      });
      this.emitExecution(completed);
      await this.audit('succeeded', rule, completed);
      return completed;
    } catch (error) {
      const message = sanitizeErrorMessage(error instanceof Error ? error.message : 'Automation action failed');
      const failed = await this.options.store.updateExecution(executionId, {
        status: 'failed',
        finishedAt: new Date(),
        errorMessage: message,
      });
      this.emitExecution(failed);
      await this.audit('failed', rule, failed, message);
      throw error;
    }
  }

  private async runAction(
    rule: AutomationRuleRecord,
    execution: AutomationExecutionRecord,
    event: DomainEvent,
    action: AutomationAction,
    index: number,
  ): Promise<void> {
    const registered = this.options.registries.actions.get(action.type);
    if (!registered) {
      throw new ValidationError('Unknown automation action', [
        { path: `actions.${index}.type`, message: `Action "${action.type}" is not registered`, code: 'custom' },
      ]);
    }

    if (registered.destructive && !rule.allowDestructive) {
      throw new ValidationError('Destructive actions require explicit policy', [
        { path: 'allowDestructive', message: `Action "${action.type}" is destructive`, code: 'custom' },
      ]);
    }

    if (event.actor && !hasPermission(event.actor, registered.requiredPermission)) {
      throw new AuthorizationError('The event actor is not allowed to run this automation action', {
        requiredPermissions: [registered.requiredPermission],
        action: action.type,
      });
    }

    const parsed = parseWithSchema(registered.inputSchema, action, {
      source: 'job',
      message: `Invalid configuration for action "${action.type}"`,
    });

    const attempt = (execution.actionRuns?.find((run) => run.actionIndex === index)?.attempt ?? 0) + 1;
    await this.options.store.upsertActionRun({
      executionId: execution.id,
      actionIndex: index,
      actionType: action.type,
      status: 'running',
      attempt,
    });

    try {
      const result = await registered.handler(parsed, {
        event: { ...event, actor: event.actor },
        rule,
        execution,
        actor: event.actor,
        demoMode: this.options.demoMode,
      });
      await this.options.store.upsertActionRun({
        executionId: execution.id,
        actionIndex: index,
        actionType: action.type,
        status: 'succeeded',
        attempt,
        result: sanitizeErrorDetails(result) ?? null,
        errorMessage: null,
      });
    } catch (error) {
      const message = sanitizeErrorMessage(error instanceof Error ? error.message : 'Action failed');
      await this.options.store.upsertActionRun({
        executionId: execution.id,
        actionIndex: index,
        actionType: action.type,
        status: 'failed',
        attempt,
        errorMessage: message,
      });
      throw error;
    }
  }

  private emitExecution(execution: AutomationExecutionRecord): void {
    try {
      this.options.onExecutionUpdated?.({
        executionId: execution.id,
        ruleId: execution.ruleId,
        status: execution.status,
        trigger: execution.trigger,
        attempt: execution.attempt,
        errorMessage: execution.errorMessage,
      });
    } catch {
      // Automation must not fail because a realtime listener threw.
    }
  }

  private async audit(
    status: string,
    rule: AutomationRuleRecord,
    execution: AutomationExecutionRecord,
    error?: string,
  ): Promise<void> {
    await this.options.audit?.record({
      action: AUTOMATION.AUDIT_EXECUTE,
      resource: 'automation',
      resourceId: execution.id,
      status,
      request: {
        ruleId: rule.id,
        executionId: execution.id,
        trigger: execution.trigger,
        eventId: execution.eventId,
        error,
      },
    });
  }
}
