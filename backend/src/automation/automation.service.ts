import { AUTOMATION, AUTOMATION_OPERATORS } from '../constants';
import { FeatureDisabledError, ValidationError } from '../errors';
import type { DomainEvent, EventBus } from '../events';
import { eventIdFor } from '../events';
import type { JobQueue } from '../jobs/queue';
import { parseWithSchema } from '../schemas/parse';
import { isDemoMode, isFeatureEnabled } from '../features';
import type { AppConfig } from '../types/config';
import type { AppLogger } from '../utils/logger';
import type { AuditService } from '../audit/audit.service';
import type { AuthenticatedUser } from '../auth/types';
import { registerDefaultAutomation } from './actions';
import { AutomationEngine } from './automation.engine';
import { createMemoryAutomationStore } from './automation.memory';
import { assertCanEnable, validateAutomationRule } from './automation.policy';
import { createAutomationRegistries, type AutomationRegistries } from './automation.registry';
import { emitAutomationEventBodySchema } from './automation.schemas';
import type {
  AutomationCatalog,
  AutomationStore,
  CreateAutomationRuleInput,
  UpdateAutomationRuleInput,
} from './automation.types';
import type { BuiltinAutomationActionDeps } from './actions/builtin';

export function isAutomationEnabled(config: AppConfig): boolean {
  return isFeatureEnabled(config, 'automation');
}

export interface AutomationServiceOptions {
  config: AppConfig;
  logger: AppLogger;
  store: AutomationStore;
  jobs: JobQueue;
  registries?: AutomationRegistries;
  events?: EventBus | null;
  audit?: AuditService | null;
  actionDeps?: Omit<BuiltinAutomationActionDeps, 'recordUpdaters' | 'allowedJobs'>;
  onExecutionUpdated?: (event: {
    executionId: string;
    ruleId: string;
    status: string;
    trigger: string;
    attempt: number;
    errorMessage?: string | null;
  }) => void;
}

export class AutomationService {
  readonly engine: AutomationEngine;
  readonly registries: AutomationRegistries;
  private readonly events: EventBus | null;

  constructor(private readonly options: AutomationServiceOptions) {
    this.registries = options.registries ?? createAutomationRegistries();
    this.events = options.events ?? null;
    this.engine = new AutomationEngine({
      store: options.store,
      registries: this.registries,
      jobs: options.jobs,
      logger: options.logger,
      audit: options.audit,
      demoMode: isDemoMode(options.config),
      onExecutionUpdated: options.onExecutionUpdated,
    });
  }

  get enabled(): boolean {
    return isAutomationEnabled(this.options.config);
  }

  register(): void {
    if (this.options.actionDeps) {
      registerDefaultAutomation(this.registries, {
        ...this.options.actionDeps,
        recordUpdaters: this.registries.recordUpdaters,
        allowedJobs: this.registries.allowedJobs,
      });
      if (isDemoMode(this.options.config) && !this.registries.recordUpdaters.has('demo.invoice')) {
        this.registries.recordUpdaters.register({
          resource: 'demo.invoice',
          handler: async (input) => ({ id: input.id, ...input.data, updated: true }),
        });
      }
    }
    this.engine.registerJobs();
    this.events?.onAny(async (event) => {
      await this.engine.handleEvent(event);
    });
  }

  catalog(): AutomationCatalog {
    this.assertReady();
    return {
      triggers: this.registries.triggers.list(),
      operators:
        this.registries.operators.list().length > 0
          ? this.registries.operators.list()
          : AUTOMATION_OPERATORS,
      actions: this.registries.actions.descriptors(),
    };
  }

  listRules(query?: { page?: number; pageSize?: number; trigger?: string; enabled?: boolean }) {
    this.assertReady();
    return this.options.store.listRules(query);
  }

  getRule(id: string) {
    this.assertReady();
    return this.options.store.getRule(id);
  }

  async createRule(input: CreateAutomationRuleInput, actor?: AuthenticatedUser) {
    this.assertReady();
    const source = input.source ?? 'manual';
    const enabledRequested = source === 'ai' ? false : Boolean(input.enabled);
    validateAutomationRule(
      {
        trigger: input.trigger,
        conditions: input.conditions ?? [],
        actions: input.actions,
        allowDestructive: input.allowDestructive ?? false,
        source,
      },
      this.registries,
      actor,
    );

    const created = await this.options.store.createRule({
      ...input,
      source,
      enabled: false,
      createdById: actor?.id ?? input.createdById,
    });

    if (enabledRequested) {
      return this.enableRule(created.id, actor);
    }

    await this.auditRule('created', created, actor);
    return created;
  }

  async updateRule(id: string, patch: UpdateAutomationRuleInput, actor?: AuthenticatedUser) {
    this.assertReady();
    const current = await this.options.store.getRule(id);
    const nextTrigger = patch.trigger ?? current.trigger;
    const nextConditions = patch.conditions ?? current.conditions;
    const nextActions = patch.actions ?? current.actions;
    const nextAllow = patch.allowDestructive ?? current.allowDestructive;
    validateAutomationRule(
      {
        trigger: nextTrigger,
        conditions: nextConditions,
        actions: nextActions,
        allowDestructive: nextAllow,
        source: current.source,
      },
      this.registries,
      actor,
    );
    const updated = await this.options.store.updateRule(id, patch);
    if (current.enabled) {
      if (current.source === 'ai') {
        const disabled = await this.options.store.setRuleEnabled(id, false, null);
        await this.auditRule('updated', disabled, actor);
        return disabled;
      }
      return this.enableRule(id, actor);
    }
    await this.auditRule('updated', updated, actor);
    return updated;
  }

  async validateRule(id: string, actor?: AuthenticatedUser) {
    this.assertReady();
    const rule = await this.options.store.getRule(id);
    validateAutomationRule(
      {
        trigger: rule.trigger,
        conditions: rule.conditions,
        actions: rule.actions,
        allowDestructive: rule.allowDestructive,
        source: rule.source,
      },
      this.registries,
      actor,
    );
    const validated = await this.options.store.setRuleEnabled(id, rule.enabled, new Date());
    await this.auditRule('validated', validated, actor);
    return validated;
  }

  async enableRule(id: string, actor?: AuthenticatedUser) {
    this.assertReady();
    const rule = await this.options.store.getRule(id);
    if (rule.source === 'ai') {
      assertCanEnable(rule);
    }
    validateAutomationRule(
      {
        trigger: rule.trigger,
        conditions: rule.conditions,
        actions: rule.actions,
        allowDestructive: rule.allowDestructive,
        source: rule.source,
      },
      this.registries,
      actor,
    );
    const enabled = await this.options.store.setRuleEnabled(id, true, new Date());
    await this.auditRule('enabled', enabled, actor);
    return enabled;
  }

  async disableRule(id: string, actor?: AuthenticatedUser) {
    this.assertReady();
    const disabled = await this.options.store.setRuleEnabled(id, false);
    await this.auditRule('disabled', disabled, actor);
    return disabled;
  }

  listExecutions(query?: {
    page?: number;
    pageSize?: number;
    ruleId?: string;
    status?: 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped';
    trigger?: string;
  }) {
    this.assertReady();
    return this.options.store.listExecutions(query);
  }

  getExecution(id: string) {
    this.assertReady();
    return this.options.store.getExecution(id);
  }

  async emitEvent(
    input: { trigger: string; eventId?: string; payload?: Record<string, unknown> },
    actor?: AuthenticatedUser,
  ): Promise<DomainEvent> {
    this.assertReady();
    const parsed = parseWithSchema(emitAutomationEventBodySchema, input, {
      source: 'body',
      message: 'Invalid automation event',
    });
    if (!this.registries.triggers.has(parsed.trigger)) {
      throw new ValidationError('Unknown automation trigger', [
        {
          path: 'trigger',
          message: `Trigger "${parsed.trigger}" is not registered`,
          code: 'custom',
        },
      ]);
    }

    const eventInput = {
      type: parsed.trigger,
      id: parsed.eventId ?? eventIdFor(parsed.trigger, JSON.stringify(parsed.payload).slice(0, 48)),
      payload: parsed.payload,
      actor,
    };

    if (this.events) {
      return this.events.emit(eventInput);
    }

    const event: DomainEvent = {
      id: eventInput.id,
      type: eventInput.type,
      occurredAt: new Date().toISOString(),
      payload: eventInput.payload ?? {},
      actor,
    };
    await this.engine.handleEvent(event);
    return event;
  }

  private assertReady(): void {
    if (!this.enabled) {
      throw new FeatureDisabledError('automation');
    }
  }

  private async auditRule(
    status: string,
    rule: { id: string; trigger: string },
    actor?: AuthenticatedUser,
  ) {
    await this.options.audit?.record({
      userId: actor?.id,
      action: AUTOMATION.AUDIT_RULE,
      resource: 'automation',
      status,
      request: { ruleId: rule.id, trigger: rule.trigger },
    });
  }
}

export function createAutomationService(options: AutomationServiceOptions): AutomationService {
  const service = new AutomationService(options);
  service.register();
  return service;
}

export function createTestAutomationService(
  options: Omit<AutomationServiceOptions, 'store'> & {
    store?: AutomationStore;
  },
): AutomationService {
  return createAutomationService({
    ...options,
    store: options.store ?? createMemoryAutomationStore(),
  });
}
