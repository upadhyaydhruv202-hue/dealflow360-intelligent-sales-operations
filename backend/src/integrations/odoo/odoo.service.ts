import type { AuthenticatedUser } from '../../auth/types';
import { AUDIT_ACTIONS, JOB_NAMES, JOBS } from '../../constants';
import { AuthorizationError, ExternalServiceError, ValidationError } from '../../errors';
import type { AuditService } from '../../audit/audit.service';
import { UnretryableError } from '../../jobs/retry';
import type { JobQueue } from '../../jobs/queue';
import { odooSyncJobPayloadSchema } from '../../jobs/job.schemas';
import { sanitizeErrorMessage } from '../../errors/sanitize';
import { assertPermission } from '../../rbac/authorize';
import { parseWithSchema } from '../../schemas/parse';
import type { AppConfig } from '../../types/config';
import type { DependencyCheck } from '../../types/health';
import type { AppLogger } from '../../utils/logger';
import { buildOdooCacheKey, type OdooCacheStore } from './odoo.cache';
import { OdooCapabilityRegistry, type OdooCapability } from './odoo.capabilities';
import { OdooClient, type OdooFetch, type OdooSleeper } from './odoo.client';
import {
  isIdempotentOdooMethod,
  ODOO_PROVIDER,
  resolveOdooRuntimeConfig,
  type OdooRuntimeConfig,
} from './odoo.config';
import { OdooOperations, type OdooPage } from './odoo.operations';
import {
  odooCacheOptionSchema,
  odooExecuteInputSchema,
  type OdooCacheOption,
  type OdooCallMethodInput,
  type OdooCreateInput,
  type OdooExecuteInput,
  type OdooPagedSearchReadInput,
  type OdooReadInput,
  type OdooRecord,
  type OdooSearchInput,
  type OdooSearchReadInput,
  type OdooUnlinkInput,
  type OdooWriteInput,
} from './odoo.schemas';

export const ODOO_SYNC_JOB = JOB_NAMES.ODOO_SYNC;

export interface OdooServiceOptions {
  config: AppConfig;
  logger: AppLogger;
  capabilities?: OdooCapabilityRegistry;
  cache?: OdooCacheStore | null;
  fetchImpl?: OdooFetch;
  sleep?: OdooSleeper;
  runtime?: OdooRuntimeConfig;
  client?: OdooClient | null;
  jobs?: JobQueue | null;
  audit?: AuditService | null;
}

export interface OdooExecuteOptions extends OdooExecuteInput {
  user?: AuthenticatedUser;
  internal?: boolean;
  model?: string;
}

export interface OdooAuthContext {
  capability: string;
  user?: AuthenticatedUser;
  internal?: boolean;
  confirmed?: boolean;
}

export class OdooService {
  readonly runtime: OdooRuntimeConfig;
  readonly capabilities: OdooCapabilityRegistry;
  private readonly client: OdooClient | null;
  private readonly operationsInstance: OdooOperations | null;
  private readonly cache: OdooCacheStore | null;
  private readonly logger: AppLogger;
  private readonly jobs: JobQueue | null;
  private readonly audit: AuditService | null;

  constructor(options: OdooServiceOptions) {
    this.runtime = options.runtime ?? resolveOdooRuntimeConfig(options.config);
    this.logger = options.logger;
    this.capabilities = options.capabilities ?? new OdooCapabilityRegistry();
    this.cache = options.cache ?? null;
    this.jobs = options.jobs ?? null;
    this.audit = options.audit ?? null;
    this.client =
      options.client === undefined
        ? this.runtime.ready
          ? new OdooClient({
              config: this.runtime,
              logger: options.logger,
              fetchImpl: options.fetchImpl,
              sleep: options.sleep,
            })
          : null
        : options.client;
    this.operationsInstance = this.client ? new OdooOperations(this.client) : null;
  }

  get enabled(): boolean {
    return this.runtime.enabled;
  }

  get ready(): boolean {
    return this.runtime.ready && Boolean(this.client);
  }

  registerJobs(): void {
    this.jobs?.process(ODOO_SYNC_JOB, async (payload) => {
      const job = parseWithSchema(odooSyncJobPayloadSchema, payload, {
        source: 'job',
        message: 'Invalid Odoo sync job payload',
      });
      if (!isIdempotentOdooMethod(job.method)) {
        throw new UnretryableError('odoo.sync only allows idempotent Odoo methods');
      }
      await this.execute({ ...job, internal: true });
    });
  }

  async enqueueSync(
    input: OdooExecuteInput,
    options: { jobId?: string } = {},
  ): Promise<string> {
    if (!this.jobs) {
      throw new ExternalServiceError('Job queue is not configured', { provider: 'jobs' });
    }

    const parsed = parseWithSchema(odooSyncJobPayloadSchema, input, {
      source: 'job',
      message: 'Invalid Odoo sync job payload',
    });
    if (!isIdempotentOdooMethod(parsed.method)) {
      throw new UnretryableError('odoo.sync only allows idempotent Odoo methods');
    }

    return this.jobs.enqueue(ODOO_SYNC_JOB, parsed, {
      attempts: JOBS.DEFAULT_ATTEMPTS,
      backoffMs: JOBS.DEFAULT_BACKOFF_MS,
      timeoutMs: JOBS.DEFAULT_TIMEOUT_MS,
      retryable: true,
      jobId: options.jobId,
    });
  }

  /**
   * Low-level operations are not a public backdoor. User-triggered and
   * problem-module writes must use `execute()` (RBAC → capability → validation).
   * Tests that need the JSON-2 adapter should construct `OdooOperations` directly.
   */
  get operations(): never {
    throw new AuthorizationError('Direct Odoo operations are not allowed; use execute() with a registered capability', {
      provider: 'odoo',
    });
  }

  async ping(): Promise<void> {
    const check = await this.checkConnectivity();
    if (!check.healthy) {
      throw new ExternalServiceError(check.error ?? 'Odoo is unavailable', {
        provider: ODOO_PROVIDER,
      });
    }
  }

  async checkConnectivity(): Promise<DependencyCheck> {
    if (!this.runtime.enabled) {
      return { configured: false, healthy: true, skipped: true };
    }

    if (!this.runtime.ready || !this.client) {
      return {
        configured: true,
        healthy: false,
        skipped: false,
        error: 'Odoo is enabled but ODOO_BASE_URL, ODOO_DATABASE, and ODOO_API_KEY are required',
      };
    }

    const started = Date.now();

    try {
      await this.client.ping();
      return {
        configured: true,
        healthy: true,
        skipped: false,
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      return {
        configured: true,
        healthy: false,
        skipped: false,
        latencyMs: Date.now() - started,
        error: sanitizeErrorMessage(error instanceof Error ? error.message : 'Odoo connectivity check failed'),
      };
    }
  }

  async search(input: OdooSearchInput): Promise<number[]> {
    return this.requireOperations().search(input);
  }

  async searchRead<T extends OdooRecord = OdooRecord>(
    input: OdooSearchReadInput,
    cache?: OdooCacheOption,
  ): Promise<T[]> {
    return this.cachedRead(`search_read:${input.model}`, input, cache, () =>
      this.requireOperations().searchRead<T>(input),
    );
  }

  async searchReadPaged<T extends OdooRecord = OdooRecord>(
    input: OdooPagedSearchReadInput,
  ): Promise<OdooPage<T>> {
    return this.requireOperations().searchReadPaged<T>(input);
  }

  async read<T extends OdooRecord = OdooRecord>(
    input: OdooReadInput,
    cache?: OdooCacheOption,
  ): Promise<T[]> {
    return this.cachedRead(`read:${input.model}`, input, cache, () => this.requireOperations().read<T>(input));
  }

  async create(input: OdooCreateInput & OdooAuthContext): Promise<number[]> {
    return this.execute({
      capability: requireOdooCapability(input),
      method: 'create',
      params: { values: input.values },
      context: input.context,
      user: input.user,
      internal: input.internal,
      confirmed: input.confirmed,
      model: input.model,
    });
  }

  async write(input: OdooWriteInput & OdooAuthContext): Promise<boolean> {
    return this.execute({
      capability: requireOdooCapability(input),
      method: 'write',
      ids: input.ids,
      params: { values: input.values },
      context: input.context,
      user: input.user,
      internal: input.internal,
      confirmed: input.confirmed,
      model: input.model,
    });
  }

  async unlink(input: OdooUnlinkInput & OdooAuthContext): Promise<boolean> {
    return this.execute({
      capability: requireOdooCapability(input),
      method: 'unlink',
      ids: input.ids,
      context: input.context,
      user: input.user,
      internal: input.internal,
      confirmed: input.confirmed,
      model: input.model,
    });
  }

  async callMethod<T = unknown>(input: OdooCallMethodInput & OdooAuthContext): Promise<T> {
    return this.execute({
      capability: requireOdooCapability(input),
      method: input.method,
      ids: input.ids,
      params: input.params,
      context: input.context,
      user: input.user,
      internal: input.internal,
      confirmed: input.confirmed,
      model: input.model,
    });
  }

  async execute<T = unknown>(input: OdooExecuteOptions): Promise<T> {
    const parsed = parseWithSchema(odooExecuteInputSchema, input, {
      source: 'body',
      message: 'Invalid Odoo execution request',
    });
    const capability = this.capabilities.require(parsed.capability);
    this.capabilities.assertMethodAllowed(capability, parsed.method);

    if (input.model && input.model !== capability.model) {
      throw new AuthorizationError('Odoo model does not match capability', {
        provider: 'odoo',
        capability: capability.name,
        model: input.model,
      });
    }

    if (!input.internal) {
      assertPermission(input.user, capability.permission);
    }

    if (capability.requiresConfirmation && parsed.confirmed !== true) {
      throw new ValidationError('Confirmation is required for this Odoo action', [
        {
          path: 'confirmed',
          message: `Capability "${capability.name}" requires an explicit confirmation flag`,
          code: 'custom',
        },
      ]);
    }

    const params = restrictParams(capability, parsed.params);
    const operations = this.requireOperations();

    switch (parsed.method) {
      case 'search':
        return operations.search({
          model: capability.model,
          domain: asDomain(params.domain),
          offset: asNumber(params.offset),
          limit: asNumber(params.limit),
          order: asString(params.order),
          context: parsed.context,
        }) as Promise<T>;
      case 'search_read':
        return operations.searchRead({
          model: capability.model,
          domain: asDomain(params.domain),
          fields: asStringArray(params.fields),
          offset: asNumber(params.offset),
          limit: asNumber(params.limit),
          order: asString(params.order),
          context: parsed.context,
        }) as Promise<T>;
      case 'search_count':
        return operations.callMethod({
          model: capability.model,
          method: 'search_count',
          params: { domain: params.domain ?? [] },
          context: parsed.context,
        });
      case 'read':
        return operations.read({
          model: capability.model,
          ids: parsed.ids ?? asIdArray(params.ids),
          fields: asStringArray(params.fields),
          context: parsed.context,
        }) as Promise<T>;
      case 'create': {
        const ids = await operations.create({
          model: capability.model,
          values: asValsList(params.values ?? params.vals_list),
          context: parsed.context,
        });
        await this.recordOdooAudit({
          action: AUDIT_ACTIONS.ODOO_RECORD_CREATED,
          model: capability.model,
          ids,
          values: params.values ?? params.vals_list,
          actorId: input.user?.id,
        });
        return ids as T;
      }
      case 'write': {
        const ids = parsed.ids ?? asIdArray(params.ids);
        const updated = await operations.write({
          model: capability.model,
          ids,
          values: asVals(params.values ?? params.vals),
          context: parsed.context,
        });
        await this.recordOdooAudit({
          action: AUDIT_ACTIONS.ODOO_RECORD_UPDATED,
          model: capability.model,
          ids,
          values: params.values ?? params.vals,
          actorId: input.user?.id,
        });
        return updated as T;
      }
      case 'unlink': {
        const ids = parsed.ids ?? asIdArray(params.ids);
        const removed = await operations.unlink({
          model: capability.model,
          ids,
          context: parsed.context,
        });
        await this.recordOdooAudit({
          action: AUDIT_ACTIONS.ODOO_RECORD_DELETED,
          model: capability.model,
          ids,
          actorId: input.user?.id,
        });
        return removed as T;
      }
      default: {
        const result = await operations.callMethod<T>({
          model: capability.model,
          method: parsed.method,
          ids: parsed.ids,
          params,
          context: parsed.context,
        });
        await this.recordOdooAudit({
          action: AUDIT_ACTIONS.ODOO_METHOD_CALLED,
          model: capability.model,
          ids: parsed.ids,
          actorId: input.user?.id,
          method: parsed.method,
        });
        return result;
      }
    }
  }

  private async recordOdooAudit(input: {
    action: string;
    model: string;
    ids: number[] | undefined;
    values?: unknown;
    actorId?: string;
    method?: string;
  }): Promise<void> {
    const resourceId = input.ids?.length ? String(input.ids[0]) : undefined;
    await this.audit?.record({
      actorId: input.actorId,
      action: input.action,
      resource: input.model,
      resourceId,
      metadata: {
        model: input.model,
        ids: input.ids,
        method: input.method,
        fields: odooValueFields(input.values),
      },
      status: 'succeeded',
    });
  }

  private requireOperations(): OdooOperations {
    if (!this.runtime.enabled) {
      throw new ExternalServiceError('Odoo integration is disabled', { provider: ODOO_PROVIDER });
    }

    if (!this.operationsInstance) {
      throw new ExternalServiceError('Odoo is not configured', { provider: ODOO_PROVIDER });
    }

    return this.operationsInstance;
  }

  private async cachedRead<T>(
    label: string,
    payload: unknown,
    cache: OdooCacheOption | undefined,
    loader: () => Promise<T>,
  ): Promise<T> {
    if (!cache || !this.cache) {
      return loader();
    }

    const option = parseWithSchema(odooCacheOptionSchema, cache, {
      source: 'config',
      message: 'Invalid Odoo cache options',
    });
    const key = buildOdooCacheKey(label, 'read', payload, option);

    try {
      const hit = await this.cache.get<T>(key);
      if (hit !== undefined) {
        return hit;
      }
    } catch (error) {
      this.logger.warn(
        { provider: ODOO_PROVIDER, error: error instanceof Error ? error.message : 'cache get failed' },
        'Odoo cache read failed',
      );
    }

    const value = await loader();

    try {
      await this.cache.set(key, value, option.ttlMs);
    } catch (error) {
      this.logger.warn(
        { provider: ODOO_PROVIDER, error: error instanceof Error ? error.message : 'cache set failed' },
        'Odoo cache write failed',
      );
    }

    return value;
  }
}

export function createOdooService(options: OdooServiceOptions): OdooService {
  const service = new OdooService(options);
  service.registerJobs();
  return service;
}

function requireOdooCapability(input: OdooAuthContext): string {
  const capability = input.capability?.trim();
  if (!capability) {
    throw new AuthorizationError('Odoo capability is required', { provider: 'odoo' });
  }

  return capability;
}

function odooValueFields(values: unknown): string[] | undefined {
  if (Array.isArray(values)) {
    const keys = new Set<string>();
    for (const item of values) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        for (const key of Object.keys(item)) {
          keys.add(key);
        }
      }
    }
    return keys.size > 0 ? [...keys] : undefined;
  }

  if (values && typeof values === 'object') {
    const keys = Object.keys(values);
    return keys.length > 0 ? keys : undefined;
  }

  return undefined;
}

function restrictParams(
  capability: OdooCapability,
  params: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!params) {
    return {};
  }

  if (!capability.allowedFields || capability.allowedFields.length === 0) {
    return params;
  }

  const allowed = new Set(capability.allowedFields);
  const next = { ...params };

  if (Array.isArray(next.fields)) {
    next.fields = next.fields.filter((field) => typeof field === 'string' && allowed.has(field));
  }

  if (next.values && typeof next.values === 'object' && !Array.isArray(next.values)) {
    next.values = pickAllowed(next.values as Record<string, unknown>, allowed);
  }

  if (next.vals && typeof next.vals === 'object' && !Array.isArray(next.vals)) {
    next.vals = pickAllowed(next.vals as Record<string, unknown>, allowed);
  }

  if (Array.isArray(next.vals_list)) {
    next.vals_list = next.vals_list.map((row) =>
      row && typeof row === 'object' && !Array.isArray(row)
        ? pickAllowed(row as Record<string, unknown>, allowed)
        : row,
    );
  }

  if (Array.isArray(next.values) && next.values.every((row) => row && typeof row === 'object')) {
    next.values = next.values.map((row) => pickAllowed(row as Record<string, unknown>, allowed));
  }

  return next;
}

function pickAllowed(values: Record<string, unknown>, allowed: Set<string>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(values).filter(([key]) => allowed.has(key)));
}

function asDomain(value: unknown): OdooSearchInput['domain'] {
  return Array.isArray(value) ? (value as OdooSearchInput['domain']) : [];
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? (value as string[])
    : undefined;
}

function asIdArray(value: unknown): number[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every((item) => typeof item === 'number')) {
    throw new ValidationError('Odoo ids are required', [
      { path: 'ids', message: 'Provide a non-empty array of positive integers', code: 'custom' },
    ]);
  }

  return value;
}

function asVals(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length === 0) {
    throw new ValidationError('Odoo write values are required', [
      { path: 'values', message: 'Provide a non-empty values object', code: 'custom' },
    ]);
  }

  return value as Record<string, unknown>;
}

function asValsList(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ValidationError('Odoo create values are required', [
      { path: 'values', message: 'Provide a non-empty values list', code: 'custom' },
    ]);
  }

  return value as Record<string, unknown>[];
}
