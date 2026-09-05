import IORedis from 'ioredis';

import { REALTIME } from '../constants';
import type { AppLogger } from '../utils/logger';
import { realtimeTransportEnvelopeSchema } from './realtime.schemas';
import type { RealtimeTransport, RealtimeTransportEnvelope } from './realtime.types';

function createConnection(url: string): IORedis {
  return new IORedis(url, {
    maxRetriesPerRequest: 1,
    connectTimeout: 3000,
    lazyConnect: true,
    enableOfflineQueue: false,
  });
}

async function ensureConnected(redis: IORedis): Promise<void> {
  if (redis.status !== 'ready' && redis.status !== 'connecting' && redis.status !== 'connect') {
    await redis.connect();
  }
}

export function createRedisRealtimeTransport(
  url: string,
  logger?: AppLogger,
  channel = REALTIME.REDIS_CHANNEL,
): RealtimeTransport {
  const publisher = createConnection(url);
  const subscriber = createConnection(url);
  let handler: ((envelope: RealtimeTransportEnvelope) => void) | undefined;

  subscriber.on('message', (_channel, message) => {
    if (!handler) {
      return;
    }
    try {
      const parsed = realtimeTransportEnvelopeSchema.safeParse(JSON.parse(message));
      if (!parsed.success) {
        return;
      }
      handler(parsed.data);
    } catch (error) {
      logger?.warn({ err: error }, 'Ignored invalid realtime Redis payload');
    }
  });

  return {
    async publish(envelope) {
      try {
        await ensureConnected(publisher);
        await publisher.publish(channel, JSON.stringify(envelope));
      } catch (error) {
        logger?.warn({ err: error }, 'Failed to publish realtime event to Redis');
      }
    },
    async subscribe(next) {
      handler = next;
      try {
        await ensureConnected(subscriber);
        await subscriber.subscribe(channel);
      } catch (error) {
        logger?.warn({ err: error }, 'Failed to subscribe to realtime Redis channel');
      }
    },
    async close() {
      handler = undefined;
      subscriber.disconnect();
      publisher.disconnect();
    },
  };
}
