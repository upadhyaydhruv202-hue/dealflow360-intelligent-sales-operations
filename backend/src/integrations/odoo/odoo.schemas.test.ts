import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../errors';
import { parseWithSchema } from '../../schemas/parse';
import {
  odooCallMethodInputSchema,
  odooCreateInputSchema,
  odooDomainSchema,
  odooExecuteInputSchema,
  odooSearchInputSchema,
} from './odoo.schemas';

describe('Odoo schemas', () => {
  it('accepts a valid search payload', () => {
    expect(
      parseWithSchema(odooSearchInputSchema, {
        model: 'res.partner',
        domain: [['is_company', '=', true], '&', ['name', 'ilike', 'ada']],
        limit: 10,
      }),
    ).toMatchObject({
      model: 'res.partner',
      limit: 10,
    });
  });

  it('rejects invalid models, private methods, and empty writes', () => {
    expect(() => parseWithSchema(odooSearchInputSchema, { model: 'ResPartner' })).toThrow(ValidationError);
    expect(() =>
      parseWithSchema(odooCallMethodInputSchema, { model: 'res.partner', method: '_create' }),
    ).toThrow(ValidationError);
    expect(() =>
      parseWithSchema(odooCreateInputSchema, { model: 'res.partner', values: [] }),
    ).toThrow(ValidationError);
    expect(() => parseWithSchema(odooDomainSchema, [['name', 'DROP TABLE', 1]])).toThrow();
  });

  it('rejects user execution payloads that omit a capability', () => {
    expect(() =>
      parseWithSchema(odooExecuteInputSchema, {
        method: 'search',
        params: { domain: [] },
      }),
    ).toThrow(ValidationError);
  });
});
