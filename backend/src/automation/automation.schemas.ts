import { z } from 'zod';

import { AUTOMATION, AUTOMATION_OPERATORS } from '../constants';
import { idSchema, paginationQuerySchema } from '../schemas/common';
import { AUTOMATION_EXECUTION_STATUSES, AUTOMATION_RULE_SOURCES } from './automation.types';

export const automationTriggerNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z][a-z0-9._-]*$/, 'Trigger names must be lowercase dotted identifiers');

export const automationActionTypeSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z][a-zA-Z0-9]*$/, 'Action types must be camelCase identifiers');

export const automationFieldPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$/, 'Condition fields must be dotted identifiers');

export const automationOperatorSchema = z.string().trim().min(1).max(32);

export const automationConditionSchema = z.object({
  field: automationFieldPathSchema,
  operator: automationOperatorSchema,
  value: z.unknown().optional(),
});

export const automationActionSchema = z
  .object({
    type: automationActionTypeSchema,
  })
  .passthrough();

export const createAutomationRuleBodySchema = z.object({
  name: z.string().trim().min(1).max(AUTOMATION.MAX_NAME_CHARS),
  description: z.string().trim().min(1).max(AUTOMATION.MAX_DESCRIPTION_CHARS).optional(),
  enabled: z.boolean().optional(),
  priority: z.number().int().min(0).max(10_000).optional(),
  trigger: automationTriggerNameSchema,
  conditions: z.array(automationConditionSchema).max(AUTOMATION.MAX_CONDITIONS).optional(),
  actions: z.array(automationActionSchema).min(1).max(AUTOMATION.MAX_ACTIONS),
  source: z.enum(AUTOMATION_RULE_SOURCES).optional(),
  allowDestructive: z.boolean().optional(),
});

export const updateAutomationRuleBodySchema = z
  .object({
    name: z.string().trim().min(1).max(AUTOMATION.MAX_NAME_CHARS).optional(),
    description: z.string().trim().min(1).max(AUTOMATION.MAX_DESCRIPTION_CHARS).nullable().optional(),
    priority: z.number().int().min(0).max(10_000).optional(),
    trigger: automationTriggerNameSchema.optional(),
    conditions: z.array(automationConditionSchema).max(AUTOMATION.MAX_CONDITIONS).optional(),
    actions: z.array(automationActionSchema).min(1).max(AUTOMATION.MAX_ACTIONS).optional(),
    allowDestructive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'At least one field is required' });

export const automationRuleParamsSchema = z.object({
  id: idSchema,
});

export const automationRuleListQuerySchema = paginationQuerySchema.extend({
  trigger: automationTriggerNameSchema.optional(),
  enabled: z.preprocess((value) => {
    if (value === undefined || value === '') {
      return undefined;
    }
    if (value === true || value === 'true' || value === '1') {
      return true;
    }
    if (value === false || value === 'false' || value === '0') {
      return false;
    }
    return value;
  }, z.boolean().optional()),
});

export const automationExecutionListQuerySchema = paginationQuerySchema.extend({
  ruleId: idSchema.optional(),
  status: z.enum(AUTOMATION_EXECUTION_STATUSES).optional(),
  trigger: automationTriggerNameSchema.optional(),
});

export const emitAutomationEventBodySchema = z.object({
  trigger: automationTriggerNameSchema,
  eventId: z.string().trim().min(1).max(AUTOMATION.MAX_EVENT_ID_CHARS).optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const automationWebhookBodySchema = z.object({
  eventId: z.string().trim().min(1).max(AUTOMATION.MAX_EVENT_ID_CHARS).optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export const automationActorSchema = z.object({
  id: idSchema,
  email: z.string().email(),
  displayName: z.string().min(1).max(120),
  status: z.enum(['active', 'invited', 'disabled']),
  role: z.string().min(1).max(64),
  roles: z.array(z.string().min(1).max(64)).max(20),
  permissions: z.array(z.string().min(1).max(64)).max(100),
});

export const automationExecuteJobPayloadSchema = z.object({
  executionId: idSchema,
  actor: automationActorSchema.optional(),
});

export const builtinOperatorSchema = z.enum(AUTOMATION_OPERATORS);

export type CreateAutomationRuleBody = z.infer<typeof createAutomationRuleBodySchema>;
export type UpdateAutomationRuleBody = z.infer<typeof updateAutomationRuleBodySchema>;
export type EmitAutomationEventBody = z.infer<typeof emitAutomationEventBodySchema>;
