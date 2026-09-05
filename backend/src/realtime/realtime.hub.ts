import { randomUUID } from 'node:crypto';

import type { AuthenticatedUser } from '../auth/types';
import { RateLimitError } from '../errors';
import { REALTIME } from '../constants';
import { canDeliverRealtimeEvent } from './realtime.channels';
import type { RealtimeChannel, RealtimeEvent, RealtimeSubscriber } from './realtime.types';

export interface RealtimeHubOptions {
  maxConnections?: number;
  maxConnectionsPerUser?: number;
}

export class RealtimeHub {
  private readonly subscribers = new Map<string, RealtimeSubscriber>();
  private readonly maxConnections: number;
  private readonly maxConnectionsPerUser: number;

  constructor(options: RealtimeHubOptions = {}) {
    this.maxConnections = options.maxConnections ?? REALTIME.MAX_CONNECTIONS;
    this.maxConnectionsPerUser = options.maxConnectionsPerUser ?? REALTIME.MAX_CONNECTIONS_PER_USER;
  }

  get size(): number {
    return this.subscribers.size;
  }

  subscribe(input: {
    user: AuthenticatedUser;
    channels: readonly RealtimeChannel[];
    send: (event: RealtimeEvent) => void;
    id?: string;
  }): { id: string; unsubscribe: () => void } {
    const userConnections = [...this.subscribers.values()].filter((item) => item.user.id === input.user.id);
    if (userConnections.length >= this.maxConnectionsPerUser) {
      throw new RateLimitError('Too many realtime connections for this user', {
        max: this.maxConnectionsPerUser,
      });
    }
    if (this.subscribers.size >= this.maxConnections) {
      throw new RateLimitError('Too many realtime connections', { max: this.maxConnections });
    }

    const id = input.id?.trim() || randomUUID();
    const subscriber: RealtimeSubscriber = {
      id,
      user: input.user,
      channels: new Set(input.channels),
      send: input.send,
    };
    this.subscribers.set(id, subscriber);

    return {
      id,
      unsubscribe: () => {
        this.subscribers.delete(id);
      },
    };
  }

  publish(event: RealtimeEvent): void {
    for (const subscriber of this.subscribers.values()) {
      if (!this.matches(subscriber, event)) {
        continue;
      }
      try {
        subscriber.send(event);
      } catch {
        this.subscribers.delete(subscriber.id);
      }
    }
  }

  close(): void {
    this.subscribers.clear();
  }

  private matches(subscriber: RealtimeSubscriber, event: RealtimeEvent): boolean {
    if (subscriber.channels.has(event.channel)) {
      return canDeliverRealtimeEvent(event, subscriber.user);
    }

    if (subscriber.channels.has('dashboard') && event.channel !== 'dashboard') {
      return canDeliverRealtimeEvent(event, subscriber.user);
    }

    return false;
  }
}
