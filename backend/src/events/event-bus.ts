import { randomUUID } from 'node:crypto';

import { getRequestId } from '../utils/request-context';
import type { AppLogger } from '../utils/logger';
import type { DomainEvent, DomainEventHandler, DomainEventInput } from './events.types';

export class EventBus {
  private readonly specific = new Map<string, DomainEventHandler[]>();
  private readonly any: DomainEventHandler[] = [];

  constructor(private readonly logger?: AppLogger) {}

  on(type: string, handler: DomainEventHandler): () => void {
    const list = this.specific.get(type) ?? [];
    list.push(handler);
    this.specific.set(type, list);
    return () => {
      const current = this.specific.get(type) ?? [];
      this.specific.set(
        type,
        current.filter((item) => item !== handler),
      );
    };
  }

  onAny(handler: DomainEventHandler): () => void {
    this.any.push(handler);
    return () => {
      const index = this.any.indexOf(handler);
      if (index >= 0) {
        this.any.splice(index, 1);
      }
    };
  }

  async emit(input: DomainEventInput): Promise<DomainEvent> {
    const event: DomainEvent = {
      id: input.id?.trim() || randomUUID(),
      type: input.type,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      payload: input.payload ?? {},
      actor: input.actor,
      requestId: input.requestId ?? getRequestId(),
    };

    const handlers = [...(this.specific.get(event.type) ?? []), ...this.any];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (error) {
        this.logger?.warn(
          {
            err: error,
            eventType: event.type,
            eventId: event.id,
            requestId: event.requestId,
          },
          'Event handler failed',
        );
      }
    }

    return event;
  }
}

export function createEventBus(logger?: AppLogger): EventBus {
  return new EventBus(logger);
}

export function eventIdFor(type: string, key: string): string {
  const safeKey = key.replace(/[^a-zA-Z0-9._:-]/g, '-').slice(0, 80);
  return `${type}:${safeKey}`.slice(0, 128);
}
