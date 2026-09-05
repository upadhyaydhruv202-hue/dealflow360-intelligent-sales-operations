import { AuthorizationError } from '../../../errors';
import { parseWithSchema } from '../../../schemas/parse';
import type { OdooService } from '../odoo.service';
import { odooModelNameSchema, type OdooRecord } from '../odoo.schemas';
import type {
  AdapterCallMethodInput,
  AdapterCreateInput,
  AdapterPagedSearchReadInput,
  AdapterReadInput,
  AdapterSearchInput,
  AdapterSearchReadInput,
  AdapterUnlinkInput,
  AdapterWriteInput,
  OdooCallerContext,
  OdooModelAdapter,
} from './types';

export interface OdooModelAdapterOptions {
  model: string;
  service: OdooService;
  readCapability: string;
  writeCapability?: string;
}

export function createOdooModelAdapter<TRecord extends OdooRecord = OdooRecord>(
  options: OdooModelAdapterOptions,
): OdooModelAdapter<TRecord> {
  const resolvedModel = parseWithSchema(odooModelNameSchema, options.model, {
    source: 'config',
    message: 'Invalid Odoo adapter model',
  });

  const auth = (input: OdooCallerContext) => ({
    user: input.user,
    internal: input.internal,
    confirmed: input.confirmed,
  });

  const requireWrite = () => {
    if (!options.writeCapability) {
      throw new AuthorizationError('Odoo write capability is not configured for this adapter', {
        provider: 'odoo',
        model: resolvedModel,
      });
    }

    return options.writeCapability;
  };

  return {
    model: resolvedModel,
    search: (input: AdapterSearchInput = {}) =>
      options.service.execute({
        capability: options.readCapability,
        method: 'search',
        params: {
          domain: input.domain,
          offset: input.offset,
          limit: input.limit,
          order: input.order,
        },
        context: input.context,
        model: resolvedModel,
        ...auth(input),
      }),
    searchRead: (input: AdapterSearchReadInput = {}) =>
      options.service.execute({
        capability: options.readCapability,
        method: 'search_read',
        params: {
          domain: input.domain,
          fields: input.fields,
          offset: input.offset,
          limit: input.limit,
          order: input.order,
        },
        context: input.context,
        model: resolvedModel,
        ...auth(input),
      }),
    searchReadPaged: async (input: AdapterPagedSearchReadInput = {}) => {
      const page = input.page ?? 1;
      const pageSize = input.pageSize ?? 20;
      const offset = (page - 1) * pageSize;
      const records = await options.service.execute<TRecord[]>({
        capability: options.readCapability,
        method: 'search_read',
        params: {
          domain: input.domain,
          fields: input.fields,
          offset,
          limit: pageSize + 1,
          order: input.order,
        },
        context: input.context,
        model: resolvedModel,
        ...auth(input),
      });
      const hasNext = records.length > pageSize;
      const pageRecords = hasNext ? records.slice(0, pageSize) : records;
      let total: number | undefined;
      if (input.includeTotal) {
        total = await options.service.execute<number>({
          capability: options.readCapability,
          method: 'search_count',
          params: { domain: input.domain },
          context: input.context,
          model: resolvedModel,
          ...auth(input),
        });
      }

      return {
        page,
        pageSize,
        records: pageRecords,
        hasNext,
        total,
      };
    },
    read: (input: AdapterReadInput) =>
      options.service.execute({
        capability: options.readCapability,
        method: 'read',
        ids: input.ids,
        params: { fields: input.fields },
        context: input.context,
        model: resolvedModel,
        ...auth(input),
      }),
    create: (input: AdapterCreateInput) =>
      options.service.create({
        model: resolvedModel,
        values: input.values,
        context: input.context,
        capability: requireWrite(),
        ...auth(input),
      }),
    write: (input: AdapterWriteInput) =>
      options.service.write({
        model: resolvedModel,
        ids: input.ids,
        values: input.values,
        context: input.context,
        capability: requireWrite(),
        ...auth(input),
      }),
    unlink: (input: AdapterUnlinkInput) =>
      options.service.unlink({
        model: resolvedModel,
        ids: input.ids,
        context: input.context,
        capability: requireWrite(),
        ...auth(input),
      }),
    callMethod: <T = unknown>(input: AdapterCallMethodInput) =>
      options.service.callMethod<T>({
        model: resolvedModel,
        method: input.method,
        ids: input.ids,
        params: input.params,
        context: input.context,
        capability: requireWrite(),
        ...auth(input),
      }),
  };
}
