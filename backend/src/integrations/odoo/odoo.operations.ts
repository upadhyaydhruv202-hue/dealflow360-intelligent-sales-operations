import { parseWithSchema } from '../../schemas/parse';
import type { OdooClient } from './odoo.client';
import {
  odooBatchOptionSchema,
  odooCallMethodInputSchema,
  odooCreateInputSchema,
  odooPagedSearchReadInputSchema,
  odooReadInputSchema,
  odooSearchInputSchema,
  odooSearchReadInputSchema,
  odooUnlinkInputSchema,
  odooWriteInputSchema,
  type OdooCallMethodInput,
  type OdooCreateInput,
  type OdooPagedSearchReadInput,
  type OdooReadInput,
  type OdooRecord,
  type OdooSearchInput,
  type OdooSearchReadInput,
  type OdooUnlinkInput,
  type OdooWriteInput,
} from './odoo.schemas';

export interface OdooPage<T> {
  page: number;
  pageSize: number;
  records: T[];
  hasNext: boolean;
  total?: number;
}

export class OdooOperations {
  constructor(private readonly client: OdooClient) {}

  async search(input: OdooSearchInput): Promise<number[]> {
    const parsed = parseWithSchema(odooSearchInputSchema, input, {
      source: 'provider',
      message: 'Invalid Odoo search arguments',
    });

    return this.client.call<number[]>({
      model: parsed.model,
      method: 'search',
      body: compactBody({
        domain: parsed.domain,
        offset: parsed.offset,
        limit: parsed.limit,
        order: parsed.order,
        context: parsed.context,
      }),
      idempotent: true,
    });
  }

  async searchRead<T extends OdooRecord = OdooRecord>(input: OdooSearchReadInput): Promise<T[]> {
    const parsed = parseWithSchema(odooSearchReadInputSchema, input, {
      source: 'provider',
      message: 'Invalid Odoo search_read arguments',
    });

    return this.client.call<T[]>({
      model: parsed.model,
      method: 'search_read',
      body: compactBody({
        domain: parsed.domain,
        fields: parsed.fields,
        offset: parsed.offset,
        limit: parsed.limit,
        order: parsed.order,
        context: parsed.context,
      }),
      idempotent: true,
    });
  }

  async searchReadPaged<T extends OdooRecord = OdooRecord>(
    input: OdooPagedSearchReadInput,
  ): Promise<OdooPage<T>> {
    const parsed = parseWithSchema(odooPagedSearchReadInputSchema, input, {
      source: 'provider',
      message: 'Invalid Odoo pagination arguments',
    });
    const offset = (parsed.page - 1) * parsed.pageSize;
    const [records, total] = await Promise.all([
      this.searchRead<T>({
        model: parsed.model,
        domain: parsed.domain,
        fields: parsed.fields,
        order: parsed.order,
        context: parsed.context,
        offset,
        limit: parsed.pageSize + 1,
      }),
      parsed.includeTotal
        ? this.client.call<number>({
            model: parsed.model,
            method: 'search_count',
            body: compactBody({
              domain: parsed.domain,
              context: parsed.context,
            }),
            idempotent: true,
          })
        : Promise.resolve(undefined),
    ]);

    const hasNext = records.length > parsed.pageSize;
    if (hasNext) {
      records.pop();
    }

    return {
      page: parsed.page,
      pageSize: parsed.pageSize,
      records,
      hasNext,
      total,
    };
  }

  async read<T extends OdooRecord = OdooRecord>(input: OdooReadInput): Promise<T[]> {
    const parsed = parseWithSchema(odooReadInputSchema, input, {
      source: 'provider',
      message: 'Invalid Odoo read arguments',
    });

    return this.client.call<T[]>({
      model: parsed.model,
      method: 'read',
      body: compactBody({
        ids: parsed.ids,
        fields: parsed.fields,
        load: parsed.load,
        context: parsed.context,
      }),
      idempotent: true,
    });
  }

  async create(input: OdooCreateInput): Promise<number[]> {
    const parsed = parseWithSchema(odooCreateInputSchema, input, {
      source: 'provider',
      message: 'Invalid Odoo create arguments',
    });

    const result = await this.client.call<number | number[]>({
      model: parsed.model,
      method: 'create',
      body: compactBody({
        vals_list: parsed.values,
        context: parsed.context,
      }),
      idempotent: false,
    });

    return Array.isArray(result) ? result : [result];
  }

  async write(input: OdooWriteInput): Promise<boolean> {
    const parsed = parseWithSchema(odooWriteInputSchema, input, {
      source: 'provider',
      message: 'Invalid Odoo write arguments',
    });

    return this.client.call<boolean>({
      model: parsed.model,
      method: 'write',
      body: compactBody({
        ids: parsed.ids,
        vals: parsed.values,
        context: parsed.context,
      }),
      idempotent: false,
    });
  }

  async unlink(input: OdooUnlinkInput): Promise<boolean> {
    const parsed = parseWithSchema(odooUnlinkInputSchema, input, {
      source: 'provider',
      message: 'Invalid Odoo unlink arguments',
    });

    return this.client.call<boolean>({
      model: parsed.model,
      method: 'unlink',
      body: compactBody({
        ids: parsed.ids,
        context: parsed.context,
      }),
      idempotent: false,
    });
  }

  async callMethod<T = unknown>(input: OdooCallMethodInput): Promise<T> {
    const parsed = parseWithSchema(odooCallMethodInputSchema, input, {
      source: 'provider',
      message: 'Invalid Odoo method call arguments',
    });

    return this.client.call<T>({
      model: parsed.model,
      method: parsed.method,
      body: compactBody({
        ids: parsed.ids,
        context: parsed.context,
        ...parsed.params,
      }),
    });
  }

  async readBatched<T extends OdooRecord = OdooRecord>(
    input: OdooReadInput,
    options?: { chunkSize?: number },
  ): Promise<T[]> {
    const parsed = parseWithSchema(odooReadInputSchema, input, {
      source: 'provider',
      message: 'Invalid Odoo read arguments',
    });
    const { chunkSize } = parseWithSchema(odooBatchOptionSchema, options ?? {}, {
      source: 'provider',
      message: 'Invalid Odoo batch options',
    });

    const records: T[] = [];
    for (const ids of chunk(parsed.ids, chunkSize)) {
      const batch = await this.read<T>({ ...parsed, ids });
      records.push(...batch);
    }

    return records;
  }

  async createBatched(input: OdooCreateInput, options?: { chunkSize?: number }): Promise<number[]> {
    const parsed = parseWithSchema(odooCreateInputSchema, input, {
      source: 'provider',
      message: 'Invalid Odoo create arguments',
    });
    const { chunkSize } = parseWithSchema(odooBatchOptionSchema, options ?? {}, {
      source: 'provider',
      message: 'Invalid Odoo batch options',
    });

    const ids: number[] = [];
    for (const values of chunk(parsed.values, chunkSize)) {
      const created = await this.create({ ...parsed, values });
      ids.push(...created);
    }

    return ids;
  }
}

function compactBody(body: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => value !== undefined),
  );
}

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    batches.push(items.slice(index, index + size));
  }
  return batches;
}
