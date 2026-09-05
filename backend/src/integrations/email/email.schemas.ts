import { z } from 'zod';

import { emailSchema, requestIdSchema } from '../../schemas/common';
import { EMAIL_TEMPLATE_IDS } from './email.types';

const emailVariableValueSchema = z.union([z.string().max(2_000), z.number(), z.boolean()]);

export const emailAttachmentSchema = z.object({
  filename: z
    .string()
    .trim()
    .min(1)
    .max(255)
    .regex(/^[^\\/]+$/, 'Attachment filename must not contain path separators'),
  content: z.string().min(1).max(2_800_000),
  contentType: z.string().trim().min(1).max(128).optional(),
  cid: z.string().trim().min(1).max(128).optional(),
});

export const sendEmailInputSchema = z
  .object({
    to: z.union([emailSchema, z.array(emailSchema).min(1).max(20)]),
    subject: z.string().trim().min(1).max(200).optional(),
    text: z.string().trim().min(1).max(20_000).optional(),
    html: z.string().trim().min(1).max(50_000).optional(),
    template: z.enum(EMAIL_TEMPLATE_IDS).optional(),
    variables: z.record(z.string().min(1).max(64), emailVariableValueSchema).optional(),
    attachments: z.array(emailAttachmentSchema).max(5).optional(),
    replyTo: emailSchema.optional(),
    idempotencyKey: z.string().trim().min(1).max(128).optional(),
    requestId: requestIdSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.template && (!value.subject || !value.text)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide a template or both subject and text',
        path: value.subject ? ['text'] : ['subject'],
      });
    }
  });

export const emailSendJobPayloadSchema = sendEmailInputSchema;

export const generateEmailContentInputSchema = z.object({
  purpose: z.string().trim().min(1).max(120),
  verifiedFacts: z.record(z.string().min(1).max(64), emailVariableValueSchema).refine(
    (facts) => Object.keys(facts).length > 0,
    { message: 'verifiedFacts must include at least one application-verified value' },
  ),
  tone: z.enum(['neutral', 'friendly', 'formal', 'empathetic']).optional(),
  audience: z.string().trim().min(1).max(200).optional(),
  extraContext: z.string().trim().min(1).max(4_000).optional(),
  template: z.enum(EMAIL_TEMPLATE_IDS).optional(),
});

export const generatedEmailContentSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  preview: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1).max(16_000),
  warnings: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  confidence: z.number().min(0).max(1),
  requiresReview: z.boolean(),
});
