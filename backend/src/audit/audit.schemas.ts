import { z } from 'zod';

import { AUDIT } from '../constants';
import { idSchema, paginationQuerySchema, requestIdSchema } from '../schemas/common';

function firstQueryValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

function blankToUndefined(value: unknown): unknown {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }

  return value;
}

function optionalQuery(schema: z.ZodTypeAny) {
  return z.preprocess((value) => {
    const normalized = blankToUndefined(firstQueryValue(value));
    return typeof normalized === 'string' ? normalized.trim() : normalized;
  }, schema.optional());
}

export const auditListQuerySchema = paginationQuerySchema.extend({
  actorId: optionalQuery(idSchema),
  action: optionalQuery(z.string().min(1).max(AUDIT.MAX_ACTION_CHARS)),
  resource: optionalQuery(z.string().min(1).max(AUDIT.MAX_RESOURCE_CHARS)),
  resourceId: optionalQuery(z.string().min(1).max(AUDIT.MAX_RESOURCE_ID_CHARS)),
  requestId: optionalQuery(requestIdSchema),
  from: optionalQuery(z.coerce.date()),
  to: optionalQuery(z.coerce.date()),
});

export type AuditListQueryInput = z.infer<typeof auditListQuerySchema>;
