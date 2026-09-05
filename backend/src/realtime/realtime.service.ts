import { randomUUID } from 'node:crypto';

import type { Response } from 'express';

import type { AuthenticatedUser } from '../auth/types';
import { FeatureDisabledError } from '../errors';
import { REALTIME } from '../constants';
import type { Closable } from '../types/lifecycle';
import type { AppConfig } from '../types/config';
import type { AppLogger } from '../utils/logger';
import type { JobStatusRecord } from '../jobs/queue.types';
import { listAuthorizedChannelInfo, resolveRequestedChannels } from './realtime.channels';
import { RealtimeHub } from './realtime.hub';
import {
  eventFromAutomationStatus,
  eventFromDocumentStatus,
  eventFromInAppCreated,
  eventsFromJobStatus,
} from './realtime.publish';
import { createRedisRealtimeTransport } from './realtime.redis';
import { writeRealtimeEvent, writeSseComment, writeSseEvent, writeSseHeaders } from './realtime.sse';
import type {
  AutomationStatusEvent,
  DocumentStatusEvent,
  InAppCreatedEvent,
  RealtimeEvent,
  RealtimeEventInput,
  RealtimeTransport,
} from './realtime.types';

export interface RealtimeServiceOptions {
  config: AppConfig;
  logger?: AppLogger;
  redisUrl?: string;
  subscribeRedis?: boolean;
  transport?: RealtimeTransport | null;
  hub?: RealtimeHub;
}

export class RealtimeService implements Closable {
  readonly name = 'realtime';
  private readonly sourceId = randomUUID();
  private readonly hub: RealtimeHub;
  private readonly transport: RealtimeTransport | null;
  private readonly heartbeatMs: number;
  private readonly logger?: AppLogger;
  private readonly enabled: boolean;
  private closed = false;

  constructor(options: RealtimeServiceOptions) {
    this.logger = options.logger;
    this.enabled = options.config.features.realtime === true;
    this.heartbeatMs = options.config.realtime.heartbeatMs || REALTIME.HEARTBEAT_MS;
    this.hub =
      options.hub ??
      new RealtimeHub({
        maxConnections: options.config.realtime.maxConnections,
        maxConnectionsPerUser: options.config.realtime.maxConnectionsPerUser,
      });
    this.transport =
      options.transport === undefined
        ? options.redisUrl
          ? createRedisRealtimeTransport(options.redisUrl, options.logger)
          : null
        : options.transport;

    if (this.enabled && this.transport && options.subscribeRedis !== false) {
      void this.transport.subscribe((envelope) => {
        if (envelope.sourceId === this.sourceId) {
          return;
        }
        this.hub.publish(envelope.event);
      });
    }
  }

  listChannels(user: AuthenticatedUser) {
    this.assertEnabled();
    return { channels: listAuthorizedChannelInfo(user) };
  }

  async connect(
    user: AuthenticatedUser,
    res: Response,
    requestedChannels: readonly string[],
  ): Promise<void> {
    this.assertEnabled();
    const channels = resolveRequestedChannels(user, requestedChannels);
    const connection = this.hub.subscribe({
      user,
      channels,
      send: (event) => writeRealtimeEvent(res, event),
    });

    writeSseHeaders(res);
    writeSseEvent(res, {
      event: 'ready',
      retryMs: 5_000,
      data: {
        connectionId: connection.id,
        channels,
        heartbeatSeconds: Math.round(this.heartbeatMs / 1000),
      },
    });

    const heartbeat = setInterval(() => {
      writeSseComment(res);
    }, this.heartbeatMs);
    heartbeat.unref?.();

    this.logger?.info(
      { userId: user.id, connectionId: connection.id, channels },
      'Realtime SSE connected',
    );

    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) {
          return;
        }
        settled = true;
        clearInterval(heartbeat);
        connection.unsubscribe();
        resolve();
      };
      res.on('close', done);
      res.on('finish', done);
      res.on('error', done);
    });
  }

  publishJob(record: JobStatusRecord): void {
    for (const event of eventsFromJobStatus(record)) {
      void this.publish(event);
    }
  }

  publishNotification(input: InAppCreatedEvent): void {
    void this.publish(eventFromInAppCreated(input));
  }

  publishAutomation(input: AutomationStatusEvent): void {
    void this.publish(eventFromAutomationStatus(input));
  }

  publishDocument(input: DocumentStatusEvent): void {
    void this.publish(eventFromDocumentStatus(input));
  }

  async publish(input: RealtimeEventInput): Promise<RealtimeEvent> {
    const event: RealtimeEvent = {
      id: input.id?.trim() || randomUUID(),
      channel: input.channel,
      type: input.type,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      payload: input.payload ?? {},
      audience: input.audience,
    };

    if (!this.enabled || this.closed) {
      return event;
    }

    this.hub.publish(event);

    if (this.transport) {
      await this.transport.publish({ sourceId: this.sourceId, event });
    }

    return event;
  }

  async close(): Promise<void> {
    this.closed = true;
    this.hub.close();
    await this.transport?.close();
  }

  private assertEnabled(): void {
    if (!this.enabled) {
      throw new FeatureDisabledError('realtime');
    }
  }
}

export function createRealtimeService(options: RealtimeServiceOptions): RealtimeService {
  return new RealtimeService(options);
}
