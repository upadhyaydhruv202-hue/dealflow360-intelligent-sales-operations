import { z } from 'zod';

import { INTENTS } from '../constants';

export const intentNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[A-Z][A-Z0-9_]*$/, 'Intent names must be SCREAMING_SNAKE_CASE identifiers');

export const intentExecuteBodySchema = z
  .object({
    utterance: z.string().trim().min(1).max(INTENTS.MAX_UTTERANCE_CHARS).optional(),
    confirm: z.boolean().optional(),
    confirmationToken: z.string().uuid().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.confirm) {
      if (!value.confirmationToken) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['confirmationToken'],
          message: 'A confirmation token is required to confirm a pending action',
        });
      }
      return;
    }

    if (!value.utterance) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['utterance'],
        message: 'Utterance is required unless confirming a pending action',
      });
    }
  });

export const intentExtractSchema = z.object({
  intent: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Z][A-Z0-9_]*$/, 'Intent must be UNKNOWN or a SCREAMING_SNAKE_CASE name'),
  input: z.record(z.string(), z.unknown()).default({}),
  confidence: z.number().min(0).max(1),
  evidence: z.string().trim().min(1).max(2_000).optional(),
  ambiguous: z.boolean().default(false),
  candidates: z.array(intentNameSchema).max(8).default([]),
  clarification: z.string().trim().min(1).max(500).optional(),
});

export type IntentExecuteBody = z.infer<typeof intentExecuteBodySchema>;
export type IntentExtractOutput = z.infer<typeof intentExtractSchema>;
