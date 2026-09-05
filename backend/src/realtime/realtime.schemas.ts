import { z } from 'zod';

import { REALTIME_CHANNELS } from '../constants';
import { REALTIME_EVENT_TYPES } from './realtime.types';

export const realtimeChannelSchema = z.enum(REALTIME_CHANNELS);

export const realtimeChannelsQuerySchema = z.object({
  channels: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => {
      if (!value) {
        return [];
      }
      return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
    }),
});

export const realtimeEventSchema = z.object({
  id: z.string().trim().min(1).max(128),
  channel: realtimeChannelSchema,
  type: z.enum(REALTIME_EVENT_TYPES),
  occurredAt: z.string().min(1).max(40),
  payload: z.record(z.unknown()).default({}),
  audience: z
    .object({
      userId: z.string().trim().min(1).max(128).optional(),
    })
    .optional(),
});

export const realtimeTransportEnvelopeSchema = z.object({
  sourceId: z.string().trim().min(1).max(128),
  event: realtimeEventSchema,
});
