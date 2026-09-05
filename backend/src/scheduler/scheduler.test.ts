import { describe, expect, it } from 'vitest';

import { loadConfig } from '../config';
import { createEventBus, eventIdFor } from '../events';
import { silentLogger } from '../integrations/ai/ai.test-helpers';
import { MemoryKvStore } from '../lib/kv';
import { createSchedulerLock } from './lock';
import { createScheduler } from './scheduler';

function config(overrides: Record<string, string> = {}) {
  return loadConfig({
    NODE_ENV: 'test',
    FEATURE_AUTOMATION: 'true',
    SCHEDULER_INTERVAL: '1m',
    SCHEDULER_POLL: '1s',
    ...overrides,
  });
}

describe('scheduler', () => {
  it('emits a stable scheduled tick per interval slot', async () => {
    const events = createEventBus();
    const received: string[] = [];
    events.on('scheduled', (event) => {
      received.push(event.id);
    });

    const scheduler = createScheduler({
      config: config(),
      events,
      logger: silentLogger,
      now: () => new Date(60_000),
    });

    const first = await scheduler.tick();
    const again = await scheduler.tick();
    const nextSlot = await scheduler.tick(new Date(120_000));

    expect(first).toHaveLength(1);
    expect(again).toHaveLength(0);
    expect(nextSlot).toHaveLength(1);
    expect(first[0].type).toBe('scheduled');
    expect(first[0].payload).toMatchObject({
      schedule: 'tick',
      slot: '1970-01-01T00:01:00.000Z',
    });
    expect(first[0].id).toBe(eventIdFor('scheduled', 'tick:1970-01-01T00:01:00.000Z'));
    expect(received).toEqual([first[0].id, nextSlot[0].id]);
  });

  it('does not fire the current slot after start aligns', async () => {
    const events = createEventBus();
    let now = 60_000;
    const scheduler = createScheduler({
      config: config({ SCHEDULER_POLL: '0s' }),
      events,
      logger: silentLogger,
      now: () => new Date(now),
    });

    scheduler.start();
    expect(await scheduler.tick()).toHaveLength(0);

    now = 120_000;
    expect(await scheduler.tick()).toHaveLength(1);
    await scheduler.close();
    expect(scheduler.running).toBe(false);
  });

  it('fires a named cron schedule in UTC', async () => {
    const events = createEventBus();
    const scheduler = createScheduler({
      config: config({ SCHEDULER_INTERVAL: '0s' }),
      events,
      logger: silentLogger,
    });
    scheduler.register({ name: 'hourly', cron: '0 * * * *' });

    const miss = await scheduler.tick(new Date('2026-08-28T12:01:00.000Z'));
    const hit = await scheduler.tick(new Date('2026-08-28T13:00:30.000Z'));

    expect(miss).toHaveLength(0);
    expect(hit).toHaveLength(1);
    expect(hit[0].payload.schedule).toBe('hourly');
    expect(hit[0].payload.slot).toBe('2026-08-28T13:00:00.000Z');
  });

  it('uses a shared lock so only one replica emits a slot', async () => {
    const kv = new MemoryKvStore();
    const lock = createSchedulerLock(kv);
    const at = new Date(60_000);
    const eventsA = createEventBus();
    const eventsB = createEventBus();
    const replicaA = createScheduler({
      config: config(),
      events: eventsA,
      logger: silentLogger,
      now: () => at,
      lock,
    });
    const replicaB = createScheduler({
      config: config(),
      events: eventsB,
      logger: silentLogger,
      now: () => at,
      lock,
    });

    expect(await replicaA.tick(at)).toHaveLength(1);
    expect(await replicaB.tick(at)).toHaveLength(0);
  });

  it('skips the tick when the lock store fails', async () => {
    const events = createEventBus();
    const scheduler = createScheduler({
      config: config(),
      events,
      logger: silentLogger,
      now: () => new Date(60_000),
      lock: {
        async tryAcquire() {
          throw new Error('redis unavailable');
        },
      },
    });

    expect(await scheduler.tick()).toHaveLength(0);
  });

  it('merges static and built payload onto a custom trigger', async () => {
    const events = createEventBus();
    const scheduler = createScheduler({
      config: config({ SCHEDULER_INTERVAL: '0s' }),
      events,
      logger: silentLogger,
    });
    scheduler.register({
      name: 'overdue-scan',
      intervalMs: 3_600_000,
      trigger: 'invoice.overdue',
      payload: { source: 'scheduler' },
      buildPayload: () => ({ daysOverdue: 10 }),
    });

    const [event] = await scheduler.tick(new Date(3_600_000));
    expect(event.type).toBe('invoice.overdue');
    expect(event.payload).toMatchObject({
      schedule: 'overdue-scan',
      source: 'scheduler',
      daysOverdue: 10,
    });
  });

  it('does not emit when disabled', async () => {
    const events = createEventBus();
    const scheduler = createScheduler({
      config: config({ SCHEDULER_ENABLED: 'false', FEATURE_AUTOMATION: 'false' }),
      events,
      logger: silentLogger,
    });

    expect(scheduler.enabled).toBe(false);
    expect(await scheduler.tick(new Date(60_000))).toHaveLength(0);
  });

  it('rejects invalid registrations', () => {
    const scheduler = createScheduler({
      config: config({ SCHEDULER_INTERVAL: '0s' }),
      events: createEventBus(),
      logger: silentLogger,
    });

    expect(() => scheduler.register({ name: 'bad name', intervalMs: 1000 })).toThrow(/Schedule name/);
    expect(() => scheduler.register({ name: 'both', intervalMs: 1000, cron: '* * * * *' })).toThrow(
      /exactly one/,
    );
    expect(() => scheduler.register({ name: 'neither' })).toThrow(/exactly one/);
    expect(() => scheduler.register({ name: 'cron', cron: '99 * * * *' })).toThrow(/Invalid cron field/);
  });
});
