import { SCHEDULER } from '../constants';
import type { DomainEvent, EventBus } from '../events';
import { eventIdFor } from '../events';
import type { AppConfig } from '../types/config';
import type { Closable } from '../types/lifecycle';
import type { AppLogger } from '../utils/logger';
import { assertValidCron, matchesCron } from './cron';
import type { SchedulerLock } from './lock';
import type { RegisteredSchedule, ScheduleDefinition } from './scheduler.types';

export function isSchedulerEnabled(config: AppConfig): boolean {
  return config.scheduler.enabled;
}

export interface SchedulerOptions {
  config: AppConfig;
  events: EventBus;
  logger?: AppLogger;
  now?: () => Date;
  schedules?: ScheduleDefinition[];
  lock?: SchedulerLock | null;
}

export class Scheduler implements Closable {
  readonly name = 'scheduler';
  private readonly definitions = new Map<string, RegisteredSchedule>();
  private readonly lastSlot = new Map<string, number>();
  private readonly clock: () => Date;
  private timer: NodeJS.Timeout | null = null;
  private closed = false;
  private started = false;

  constructor(private readonly options: SchedulerOptions) {
    this.clock = options.now ?? (() => new Date());
    if (options.config.scheduler.intervalMs > 0) {
      this.register({
        name: SCHEDULER.DEFAULT_NAME,
        intervalMs: options.config.scheduler.intervalMs,
        trigger: SCHEDULER.DEFAULT_TRIGGER,
      });
    }
    for (const schedule of options.schedules ?? []) {
      this.register(schedule);
    }
  }

  get enabled(): boolean {
    return isSchedulerEnabled(this.options.config);
  }

  get running(): boolean {
    return this.started && !this.closed;
  }

  list(): Array<Pick<RegisteredSchedule, 'name' | 'intervalMs' | 'cron' | 'trigger'>> {
    return [...this.definitions.values()].map((schedule) => ({
      name: schedule.name,
      intervalMs: schedule.intervalMs,
      cron: schedule.cron,
      trigger: schedule.trigger,
    }));
  }

  register(definition: ScheduleDefinition): RegisteredSchedule {
    const name = definition.name.trim();
    if (!SCHEDULER.NAME_PATTERN.test(name)) {
      throw new Error(
        `Schedule name "${definition.name}" must start with a letter and use only letters, digits, '.', '_' or '-'`,
      );
    }
    if (this.definitions.has(name)) {
      throw new Error(`Schedule "${name}" is already registered`);
    }

    const hasInterval = definition.intervalMs !== undefined;
    const hasCron = Boolean(definition.cron?.trim());
    if (hasInterval === hasCron) {
      throw new Error(`Schedule "${name}" must set exactly one of intervalMs or cron`);
    }

    let intervalMs: number | undefined;
    let cron: string | undefined;
    if (hasInterval) {
      const value = definition.intervalMs ?? 0;
      if (!Number.isInteger(value) || value < 1) {
        throw new Error(`Schedule "${name}" intervalMs must be a positive integer`);
      }
      intervalMs = value;
    } else {
      cron = assertValidCron(definition.cron ?? '');
    }

    const trigger = (definition.trigger ?? SCHEDULER.DEFAULT_TRIGGER).trim();
    if (!trigger) {
      throw new Error(`Schedule "${name}" trigger must not be empty`);
    }

    const registered: RegisteredSchedule = {
      name,
      intervalMs,
      cron,
      trigger,
      payload: { ...definition.payload },
      buildPayload: definition.buildPayload,
    };
    this.definitions.set(name, registered);

    if (this.started) {
      const slot = this.resolveSlot(registered, this.clock());
      if (slot !== undefined) {
        this.lastSlot.set(name, slot);
      }
    }

    return registered;
  }

  start(): void {
    if (!this.enabled || this.closed || this.started) {
      return;
    }

    const now = this.clock();
    for (const schedule of this.definitions.values()) {
      const slot = this.resolveSlot(schedule, now);
      if (slot !== undefined) {
        this.lastSlot.set(schedule.name, slot);
      }
    }

    const pollMs = this.options.config.scheduler.pollMs;
    if (pollMs > 0) {
      this.timer = setInterval(() => {
        void this.tick().catch((error: unknown) => {
          this.options.logger?.warn({ err: error }, 'Scheduler tick failed');
        });
      }, pollMs);
      this.timer.unref();
    }

    this.started = true;
    this.options.logger?.info(
      {
        schedules: this.list().map((item) => item.name),
        pollMs,
        intervalMs: this.options.config.scheduler.intervalMs,
      },
      'Scheduler started',
    );
  }

  async tick(at?: Date): Promise<DomainEvent[]> {
    if (!this.enabled || this.closed) {
      return [];
    }

    const now = at ?? this.clock();
    const fired: DomainEvent[] = [];

    for (const schedule of this.definitions.values()) {
      const slot = this.resolveSlot(schedule, now);
      if (slot === undefined || this.lastSlot.get(schedule.name) === slot) {
        continue;
      }

      this.lastSlot.set(schedule.name, slot);
      if (this.options.lock) {
        const ttlMs = schedule.intervalMs ?? 60_000;
        try {
          const acquired = await this.options.lock.tryAcquire(`${schedule.name}:${slot}`, ttlMs);
          if (!acquired) {
            continue;
          }
        } catch (error) {
          this.options.logger?.warn({ err: error, schedule: schedule.name }, 'Scheduler lock failed; skipping tick');
          continue;
        }
      }
      const extra = schedule.buildPayload ? await schedule.buildPayload(now) : {};
      const event = await this.options.events.emit({
        type: schedule.trigger,
        id: eventIdFor(schedule.trigger, `${schedule.name}:${new Date(slot).toISOString()}`),
        occurredAt: now.toISOString(),
        payload: {
          schedule: schedule.name,
          slot: new Date(slot).toISOString(),
          firedAt: now.toISOString(),
          ...schedule.payload,
          ...extra,
        },
      });
      fired.push(event);
    }

    return fired;
  }

  async close(): Promise<void> {
    this.closed = true;
    this.started = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private resolveSlot(schedule: RegisteredSchedule, now: Date): number | undefined {
    if (schedule.intervalMs) {
      return Math.floor(now.getTime() / schedule.intervalMs) * schedule.intervalMs;
    }
    if (schedule.cron && matchesCron(schedule.cron, now)) {
      return Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        now.getUTCHours(),
        now.getUTCMinutes(),
      );
    }
    return undefined;
  }
}

export function createScheduler(options: SchedulerOptions): Scheduler {
  return new Scheduler(options);
}
