import { z } from 'zod';

import { e164PhoneSchema, emailSchema } from '../schemas/common';
import { OTP_CHANNELS, OTP_PURPOSES } from './otp.types';

const otpCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{4,8}$/, 'OTP must be 4 to 8 digits');

export const otpRequestBodySchema = z
  .object({
    destination: z.string().trim().min(1).max(254),
    channel: z.enum(OTP_CHANNELS).default('email'),
    purpose: z.enum(OTP_PURPOSES).default('login'),
  })
  .superRefine((value, ctx) => {
    if (value.channel === 'email') {
      const parsed = emailSchema.safeParse(value.destination);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Destination must be a valid email when channel is email',
          path: ['destination'],
        });
      }
      return;
    }

    const parsed = e164PhoneSchema.safeParse(value.destination);
    if (!parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Destination must be E.164 when channel is sms',
        path: ['destination'],
      });
    }
  });

export const otpVerifyBodySchema = z.object({
  destination: z.string().trim().min(1).max(254),
  purpose: z.enum(OTP_PURPOSES).default('login'),
  code: otpCodeSchema,
});
