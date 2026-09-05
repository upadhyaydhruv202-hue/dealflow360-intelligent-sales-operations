import { z } from 'zod';

import { PAGINATION } from '../../constants';
import { ODOO_DEFAULTS } from './odoo.config';

export const odooModelNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[a-z][a-z0-9._]*$/, 'Odoo model names must be lowercase technical names');

export const odooMethodNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, 'Odoo method names must be public lowercase identifiers');

export const odooCapabilityNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9._-]*$/, 'Capability names must be lowercase dotted identifiers');

export const odooIdSchema = z.number().int().positive();

export const odooIdsSchema = z.array(odooIdSchema).min(1).max(500);

export const odooFieldNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, 'Odoo field names must be lowercase identifiers');

export const odooFieldsSchema = z.array(odooFieldNameSchema).max(80);

export const odooDomainOperatorSchema = z
  .string()
  .min(1)
  .max(16)
  .regex(/^(=|!=|>|>=|<|<=|like|ilike|in|not in|=like|=ilike|child_of|parent_of|any|not any)$/);

export const odooDomainLeafSchema = z.tuple([z.string().min(1).max(64), odooDomainOperatorSchema, z.unknown()]);

export const odooDomainTermSchema = z.union([z.enum(['&', '|', '!']), odooDomainLeafSchema]);

export const odooDomainSchema = z.array(odooDomainTermSchema).max(100);

export const odooOrderSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9_,. ]+$/i, 'Order must be a comma-separated field list');

export const odooContextSchema = z.record(z.string().min(1).max(64), z.unknown()).optional();

export const odooValsSchema = z.record(z.string().min(1).max(64), z.unknown()).refine(
  (value) => Object.keys(value).length > 0,
  { message: 'Write values cannot be empty' },
);

export const odooValsListSchema = z.array(odooValsSchema).min(1).max(100);

const paginationLimits = {
  page: z.number().int().min(1).default(PAGINATION.DEFAULT_PAGE),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(ODOO_DEFAULTS.maxPageSize)
    .default(ODOO_DEFAULTS.defaultPageSize),
};

export const odooSearchInputSchema = z.object({
  model: odooModelNameSchema,
  domain: odooDomainSchema.default([]),
  offset: z.number().int().min(0).max(1_000_000).optional(),
  limit: z.number().int().min(1).max(ODOO_DEFAULTS.maxPageSize).optional(),
  order: odooOrderSchema.optional(),
  context: odooContextSchema,
});

export const odooSearchReadInputSchema = odooSearchInputSchema.extend({
  fields: odooFieldsSchema.optional(),
});

export const odooPagedSearchReadInputSchema = odooSearchReadInputSchema
  .omit({ offset: true, limit: true })
  .extend({
    page: paginationLimits.page,
    pageSize: paginationLimits.pageSize,
    includeTotal: z.boolean().optional(),
  });

export const odooReadInputSchema = z.object({
  model: odooModelNameSchema,
  ids: odooIdsSchema,
  fields: odooFieldsSchema.optional(),
  load: z.string().max(32).nullable().optional(),
  context: odooContextSchema,
});

export const odooCreateInputSchema = z.object({
  model: odooModelNameSchema,
  values: odooValsListSchema,
  context: odooContextSchema,
});

export const odooWriteInputSchema = z.object({
  model: odooModelNameSchema,
  ids: odooIdsSchema,
  values: odooValsSchema,
  context: odooContextSchema,
});

export const odooUnlinkInputSchema = z.object({
  model: odooModelNameSchema,
  ids: odooIdsSchema,
  context: odooContextSchema,
});

export const odooCallMethodInputSchema = z.object({
  model: odooModelNameSchema,
  method: odooMethodNameSchema,
  ids: z.array(odooIdSchema).max(500).optional(),
  params: z.record(z.string().min(1).max(64), z.unknown()).optional(),
  context: odooContextSchema,
});

export const odooCapabilitySchema = z.object({
  name: odooCapabilityNameSchema,
  model: odooModelNameSchema,
  methods: z.array(odooMethodNameSchema).min(1).max(20),
  permission: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[a-z][a-z0-9._]*$/),
  risk: z.enum(['low', 'high']).default('low'),
  requiresConfirmation: z.boolean().optional(),
  allowedFields: odooFieldsSchema.optional(),
});

export const odooExecuteInputSchema = z.object({
  capability: odooCapabilityNameSchema,
  method: odooMethodNameSchema,
  ids: z.array(odooIdSchema).max(500).optional(),
  params: z.record(z.string().min(1).max(64), z.unknown()).optional(),
  context: odooContextSchema,
  confirmed: z.boolean().optional(),
});

export const odooCacheOptionSchema = z.object({
  ttlMs: z.number().int().min(1).max(300_000),
  key: z.string().min(1).max(256).optional(),
});

export const odooBatchOptionSchema = z.object({
  chunkSize: z.number().int().min(1).max(200).default(ODOO_DEFAULTS.batchSize),
});

export type OdooSearchInput = z.input<typeof odooSearchInputSchema>;
export type OdooSearchReadInput = z.input<typeof odooSearchReadInputSchema>;
export type OdooPagedSearchReadInput = z.input<typeof odooPagedSearchReadInputSchema>;
export type OdooReadInput = z.input<typeof odooReadInputSchema>;
export type OdooCreateInput = z.input<typeof odooCreateInputSchema>;
export type OdooWriteInput = z.input<typeof odooWriteInputSchema>;
export type OdooUnlinkInput = z.input<typeof odooUnlinkInputSchema>;
export type OdooCallMethodInput = z.input<typeof odooCallMethodInputSchema>;
export type OdooCapabilityDefinition = z.output<typeof odooCapabilitySchema>;
export type OdooExecuteInput = z.input<typeof odooExecuteInputSchema>;
export type OdooCacheOption = z.input<typeof odooCacheOptionSchema>;
export type OdooBatchOption = z.input<typeof odooBatchOptionSchema>;
export type OdooRecord = Record<string, unknown> & { id?: number };
