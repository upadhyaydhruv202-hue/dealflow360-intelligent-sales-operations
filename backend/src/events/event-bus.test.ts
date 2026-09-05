import { describe, expect, it, vi } from 'vitest';

import { createEventBus, eventIdFor } from './event-bus';

describe('EventBus', () => {
  it('delivers to type-specific handlers and onAny, then supports unsubscribe', async () => {
    const bus = createEventBus();
    const typed = vi.fn();
    const any = vi.fn();

    const offTyped = bus.on('user.created', typed);
    const offAny = bus.onAny(any);

    const first = await bus.emit({
      type: 'user.created',
      id: 'user.created:1',
      payload: { userId: 'u1' },
    });

    expect(first).toMatchObject({
      id: 'user.created:1',
      type: 'user.created',
      payload: { userId: 'u1' },
    });
    expect(typed).toHaveBeenCalledTimes(1);
    expect(any).toHaveBeenCalledTimes(1);

    offTyped();
    offAny();
    await bus.emit({ type: 'user.created', payload: { userId: 'u2' } });
    expect(typed).toHaveBeenCalledTimes(1);
    expect(any).toHaveBeenCalledTimes(1);
  });

  it('isolates handler failures so later subscribers still run', async () => {
    const warn = vi.fn();
    const bus = createEventBus({ warn } as never);
    const later = vi.fn();

    bus.on('order.created', async () => {
      throw new Error('subscriber failed');
    });
    bus.on('order.created', later);

    await bus.emit({ type: 'order.created', payload: { orderId: 'o1' } });

    expect(later).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'order.created' }),
      'Event handler failed',
    );
  });

  it('assigns an id when the emitter omits one', async () => {
    const bus = createEventBus();
    const event = await bus.emit({ type: 'scheduled', payload: { schedule: 'tick' } });
    expect(event.id.length).toBeGreaterThan(0);
    expect(event.occurredAt).toEqual(expect.any(String));
  });
});

describe('eventIdFor', () => {
  it('keeps a stable prefix and strips unsafe characters', () => {
    expect(eventIdFor('report.completed', 'pdfs/abc.pdf')).toBe('report.completed:pdfs-abc.pdf');
    expect(eventIdFor('user.created', 'a'.repeat(200)).length).toBeLessThanOrEqual(128);
  });
});
