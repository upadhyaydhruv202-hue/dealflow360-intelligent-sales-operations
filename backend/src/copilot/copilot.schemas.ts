import { z } from 'zod';

import { COPILOT } from '../constants';
import { idSchema, paginationQuerySchema } from '../schemas/common';
import { COPILOT_MESSAGE_ROLES, COPILOT_RISK_LEVELS, COPILOT_TOOL_STATUSES } from './copilot.types';

export const copilotToolNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z][a-zA-Z0-9]*$/, 'Tool names must be camelCase identifiers');

export const copilotChatBodySchema = z
  .object({
    message: z.string().trim().min(1).max(COPILOT.MAX_MESSAGE_CHARS).optional(),
    conversationId: idSchema.optional(),
    confirm: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.confirm && !value.message) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['message'],
        message: 'Message is required unless confirming a pending action',
      });
    }
  });

export const copilotConversationParamsSchema = z.object({
  id: idSchema,
});

export const copilotConversationListQuerySchema = paginationQuerySchema;

export const copilotPlanSchema = z.object({
  intent: z.enum(['answer', 'tool', 'clarify']),
  reply: z.string().trim().min(1).max(COPILOT.MAX_MESSAGE_CHARS),
  tools: z
    .array(
      z.object({
        name: copilotToolNameSchema,
        arguments: z.record(z.string(), z.unknown()).default({}),
      }),
    )
    .max(COPILOT.MAX_TOOLS_PER_TURN)
    .default([]),
  confidence: z.number().min(0).max(1),
  evidence: z.string().trim().min(1).max(2_000).optional(),
});

export const copilotToolExecutionSchema = z.object({
  name: copilotToolNameSchema,
  arguments: z.record(z.string(), z.unknown()),
  status: z.enum(COPILOT_TOOL_STATUSES),
  riskLevel: z.enum(COPILOT_RISK_LEVELS),
  result: z.unknown().optional(),
  error: z.string().max(500).optional(),
});

export const copilotStoredToolCallsSchema = z.array(copilotToolExecutionSchema).max(COPILOT.MAX_TOOLS_PER_TURN);

export const copilotMessageRoleSchema = z.enum(COPILOT_MESSAGE_ROLES);

export type CopilotChatBody = z.infer<typeof copilotChatBodySchema>;
export type CopilotPlanOutput = z.infer<typeof copilotPlanSchema>;
