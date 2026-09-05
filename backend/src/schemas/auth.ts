import { z } from 'zod';

import { emailSchema } from './common';

export {
  parseAiOutput,
  parseBody,
  parseConfig,
  parseFileMetadata,
  parseHeaders,
  parseParams,
  parseProviderResponse,
  parseQuery,
  parseRequest,
} from './parse';

export const registerBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
  displayName: z.string().trim().min(1).max(120),
  companyName: z.string().trim().min(1).max(160).optional(),
});

export const loginBodySchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
});

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1).optional(),
});

export const passwordResetRequestBodySchema = z.object({
  email: emailSchema,
});

export const passwordResetConfirmBodySchema = z.object({
  email: emailSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, 'OTP must be 4 to 8 digits'),
  password: z.string().min(1).max(72),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type RefreshBody = z.infer<typeof refreshBodySchema>;
export type PasswordResetRequestBody = z.infer<typeof passwordResetRequestBodySchema>;
export type PasswordResetConfirmBody = z.infer<typeof passwordResetConfirmBodySchema>;
