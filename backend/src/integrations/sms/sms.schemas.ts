import { z } from 'zod';

import { e164PhoneSchema, requestIdSchema } from '../../schemas/common';

export const sendSmsInputSchema = z.object({
  to: e164PhoneSchema,
  text: z.string().trim().min(1).max(1600),
  idempotencyKey: z.string().trim().min(1).max(128).optional(),
});

export const smsSendJobPayloadSchema = sendSmsInputSchema.extend({
  requestId: requestIdSchema.optional(),
});
