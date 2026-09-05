import { randomUUID } from 'node:crypto';

import { ANALYTICS } from '../../constants';
import {
  AuthorizationError,
  FeatureDisabledError,
  ValidationError,
} from '../../errors';
import { parsePagination, toPaginatedResult } from '../../repositories/query';
import type { AnalyticsRepository } from '../../repositories/analytics.repository';
import type { AuditService } from '../../audit/audit.service';
import type { AppConfig } from '../../types/config';
import type { AppLogger } from '../../utils/logger';
import { resolveAnalyticsRuntimeConfig, type AnalyticsRuntimeConfig } from './analytics.config';
import { buildDemoAnalyticsFacts } from './analytics.demo';
import { renderAnalyticsExport } from './analytics.export';
import { parseOccurredAt, resolveQueryWindow } from './analytics.time';
import { createMemoryAnalyticsProvider } from './providers/memory.provider';
import { createPostgresAnalyticsProvider } from './providers/postgres.provider';
import {
  createAnalyticsRegistry,
  DEMO_ANALYTICS_DASHBOARD,
  DEMO_EVENTS_KPI,
  DEMO_VALUE_KPI,
  AnalyticsRegistry,
} from './analytics.registry';
import type {
  AnalyticsActor,
  AnalyticsDashboardDefinition,
  AnalyticsDashboardView,
  AnalyticsExportInput,
  AnalyticsExportResult,
  AnalyticsFactInput,
  AnalyticsFilter,
  AnalyticsKpiDefinition,
  AnalyticsProvider,
  AnalyticsQueryInput,
  AnalyticsQueryResult,
  StoredAnalyticsFact,
} from './analytics.types';

export interface AnalyticsServiceOptions {
  config: AppConfig;
  logger: AppLogger;
  provider?: AnalyticsProvider;
  registry?: AnalyticsRegistry;
  facts?: AnalyticsRepository | null;
  audit?: AuditService | null;
  seedDemo?: boolean;
  runtime?: AnalyticsRuntimeConfig;
}

export class AnalyticsService {
  readonly runtime: AnalyticsRuntimeConfig;
  private readonly provider: AnalyticsProvider;
  private readonly registry: AnalyticsRegistry;
  private readonly audit: AuditService | null;
  private readonly logger: AppLogger;
  private readonly seedDemo: boolean;
  private demoReady: Promise<void> | null = null;

  constructor(options: AnalyticsServiceOptions) {
    this.runtime = options.runtime ?? resolveAnalyticsRuntimeConfig(options.config);
    this.logger = options.logger;
    this.audit = options.audit ?? null;
    this.registry =
      options.registry ?? createAnalyticsRegistry([DEMO_EVENTS_KPI, DEMO_VALUE_KPI], [DEMO_ANALYTICS_DASHBOARD]);
    this.seedDemo = options.seedDemo ?? options.config.demoMode;
    this.provider =
      options.provider ??
      defaultProvider({
        runtime: this.runtime,
        facts: options.facts ?? null,
        logger: options.logger,
      });
  }

  get enabled(): boolean {
    return this.runtime.enabled;
  }

  get providerName(): AnalyticsProvider['name'] {
    return this.provider.name;
  }

  registerKpi(definition: AnalyticsKpiDefinition): void {
    this.registry.registerKpi(definition);
  }

  registerDashboard(definition: AnalyticsDashboardDefinition): void {
    this.registry.registerDashboard(definition);
  }

  async listKpis(actor: AnalyticsActor) {
    this.assertReady();
    await this.ensureDemoFacts();
    return {
      provider: this.provider.name,
      kpis: this.registry
        .listKpis()
        .filter((kpi) => hasPermission(actor, kpi.permission))
        .map((kpi) => this.registry.summarizeKpi(kpi)),
    };
  }

  async listDashboards(actor: AnalyticsActor) {
    this.assertReady();
    await this.ensureDemoFacts();
    return {
      provider: this.provider.name,
      dashboards: this.registry
        .listDashboards()
        .filter((dashboard) => hasPermission(actor, dashboard.permission))
        .map((dashboard) => this.registry.summarizeDashboard(dashboard)),
    };
  }

  async getDashboard(name: string, actor: AnalyticsActor) {
    this.assertReady();
    const dashboard = this.registry.getDashboard(name);
    this.assertPermission(actor, dashboard.permission, 'Missing permission to read this dashboard', {
      dashboard: name,
    });
    return {
      provider: this.provider.name,
      dashboard: {
        ...this.registry.summarizeDashboard(dashboard),
        widgets: dashboard.widgets,
      },
    };
  }

  async evaluateDashboard(
    input: {
      name: string;
      from?: Date | string;
      to?: Date | string;
      granularity?: AnalyticsQueryInput['granularity'];
      filters?: AnalyticsFilter[];
      actor: AnalyticsActor;
    },
  ): Promise<AnalyticsDashboardView> {
    this.assertReady();
    await this.ensureDemoFacts();
    const dashboard = this.registry.getDashboard(input.name);
    this.assertPermission(input.actor, dashboard.permission, 'Missing permission to read this dashboard', {
      dashboard: input.name,
    });

    const widgets = [];
    let from = '';
    let to = '';
    for (const widget of dashboard.widgets) {
      const kind = widget.type === 'kpi' ? 'snapshot' : widget.type;
      const result = await this.query({
        kpi: widget.kpi,
        kind,
        from: input.from,
        to: input.to,
        granularity: widget.granularity ?? input.granularity ?? 'day',
        groupBy: widget.groupBy,
        filters: input.filters,
        page: 1,
        pageSize: ANALYTICS.DEFAULT_PAGE_SIZE,
        take: Math.min(this.runtime.maxSeriesPoints, ANALYTICS.MAX_SERIES_POINTS),
        actor: input.actor,
      });
      from = result.from;
      to = result.to;
      widgets.push({
        id: widget.id,
        type: widget.type,
        title: widget.title ?? widget.kpi,
        kpi: widget.kpi,
        result,
      });
    }

    return {
      provider: this.provider.name,
      dashboard: { ...this.registry.summarizeDashboard(dashboard), title: dashboard.title },
      from,
      to,
      widgets,
    };
  }

  async query(input: AnalyticsQueryInput): Promise<AnalyticsQueryResult> {
    this.assertReady();
    await this.ensureDemoFacts();

    const kpi = this.registry.getKpi(input.kpi);
    this.assertPermission(input.actor, kpi.permission, 'Missing permission to query this KPI', { kpi: kpi.name });

    const kind = input.kind ?? 'snapshot';
    const granularity = input.granularity ?? 'day';
    const window = resolveQueryWindow({
      from: input.from,
      to: input.to,
      granularity: kind === 'timeseries' ? granularity : 'day',
      maxRangeDays: this.runtime.maxRangeDays,
    });
    const filters = this.normalizeFilters(kpi, input.filters ?? []);
    const pagination = parsePagination({ page: input.page, pageSize: input.pageSize });
    const take = Math.min(input.take ?? pagination.take, this.runtime.maxSeriesPoints);
    const skip = input.take !== undefined ? 0 : pagination.skip;
    const pageParams = input.take !== undefined ? { ...pagination, page: 1, pageSize: take, skip: 0, take } : { ...pagination, take, skip };
    const groupBy = kind === 'breakdown' ? this.requireGroupBy(kpi, input.groupBy) : undefined;
    const providerQuery = {
      kpiKey: kpi.name,
      from: window.from,
      to: window.to,
      ownerId: input.actor.id,
      ownerScoped: kpi.ownerScoped === true,
      filters,
      aggregation: kpi.aggregation,
    };

    if (kind === 'timeseries') {
      const result = await this.provider.timeseries({
        ...providerQuery,
        granularity,
        skip: pageParams.skip,
        take: pageParams.take,
      });
      const page = toPaginatedResult(result.points, pageParams, result.totalItems);
      return {
        provider: this.provider.name,
        kind,
        kpi: kpi.name,
        aggregation: kpi.aggregation,
        unit: kpi.unit,
        from: window.from.toISOString(),
        to: window.to.toISOString(),
        granularity,
        points: page.items,
        meta: page.meta,
      };
    }

    if (kind === 'breakdown') {
      const result = await this.provider.breakdown({
        ...providerQuery,
        groupBy: groupBy as string,
        skip: pageParams.skip,
        take: pageParams.take,
      });
      const page = toPaginatedResult(result.rows, pageParams, result.totalItems);
      return {
        provider: this.provider.name,
        kind,
        kpi: kpi.name,
        aggregation: kpi.aggregation,
        unit: kpi.unit,
        from: window.from.toISOString(),
        to: window.to.toISOString(),
        groupBy,
        rows: page.items,
        meta: page.meta,
      };
    }

    const snapshot = await this.provider.snapshot(providerQuery);
    return {
      provider: this.provider.name,
      kind: 'snapshot',
      kpi: kpi.name,
      aggregation: kpi.aggregation,
      unit: kpi.unit,
      from: window.from.toISOString(),
      to: window.to.toISOString(),
      snapshot: {
        kpi: kpi.name,
        aggregation: kpi.aggregation,
        unit: kpi.unit,
        from: window.from.toISOString(),
        to: window.to.toISOString(),
        value: snapshot.value,
        samples: snapshot.samples,
      },
      meta: {
        page: 1,
        pageSize: 1,
        totalItems: 1,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };
  }

  async export(input: AnalyticsExportInput): Promise<AnalyticsExportResult> {
    this.assertReady();
    await this.ensureDemoFacts();
    const kpi = this.registry.getKpi(input.kpi);
    const permission = kpi.exportPermission ?? 'analytics.export';
    this.assertPermission(input.actor, permission, 'Missing permission to export this KPI', { kpi: kpi.name });

    const format = input.format ?? 'csv';
    const query = await this.query({
      ...input,
      page: 1,
      pageSize: ANALYTICS.DEFAULT_PAGE_SIZE,
      take: Math.min(this.runtime.maxExportRows, ANALYTICS.MAX_EXPORT_ROWS),
    });
    const rendered = renderAnalyticsExport(query, format);
    await this.audit?.record({
      action: ANALYTICS.AUDIT_EXPORT,
      resource: 'analytics',
      resourceId: kpi.name,
      userId: input.actor.id,
      status: 'success',
      metadata: { kpi: kpi.name, kind: query.kind, format, provider: this.provider.name },
    });
    return {
      provider: this.provider.name,
      format,
      filename: rendered.filename,
      contentType: rendered.contentType,
      content: rendered.content,
      query,
    };
  }

  async ingest(
    facts: readonly AnalyticsFactInput[],
    actor: AnalyticsActor,
    options: { viaHttp?: boolean } = {},
  ): Promise<{ ingested: number; kpis: string[] }> {
    this.assertReady();
    await this.ensureDemoFacts();
    if (facts.length === 0) {
      throw new ValidationError('At least one analytics fact is required');
    }
    if (facts.length > ANALYTICS.MAX_INGEST_BATCH) {
      throw new ValidationError('Analytics ingest batch is too large', { max: ANALYTICS.MAX_INGEST_BATCH });
    }

    const stored = facts.map((fact) => this.toStoredFact(fact, actor, options.viaHttp === true));
    const ingested = await this.provider.ingest(stored);
    const kpis = [...new Set(stored.map((fact) => fact.kpiKey))].sort();
    await this.audit?.record({
      action: ANALYTICS.AUDIT_INGEST,
      resource: 'analytics',
      resourceId: kpis.join(','),
      userId: actor.id,
      status: 'success',
      metadata: { count: ingested, kpis, provider: this.provider.name },
    });
    return { ingested, kpis };
  }

  private toStoredFact(input: AnalyticsFactInput, actor: AnalyticsActor, viaHttp = false): StoredAnalyticsFact {
    const kpi = this.registry.getKpi(input.kpi);
    const permission = kpi.writePermission ?? kpi.permission;
    this.assertPermission(actor, permission, 'Missing permission to ingest this KPI', { kpi: kpi.name });
    if (viaHttp && !kpi.httpWritable) {
      throw new AuthorizationError('This analytics KPI is not writable over HTTP', { kpi: kpi.name });
    }

    const dimensions = input.dimensions ?? {};
    for (const key of Object.keys(dimensions)) {
      if (!kpi.dimensions[key]) {
        throw new ValidationError('Unknown analytics dimension', {
          field: key,
          allowed: Object.keys(kpi.dimensions),
        });
      }
    }

    const value = input.value ?? 1;
    if (!Number.isFinite(value) || value < ANALYTICS.MIN_VALUE || value > ANALYTICS.MAX_VALUE) {
      throw new ValidationError('Analytics value is out of range', { kpi: kpi.name });
    }

    return {
      id: randomUUID(),
      kpiKey: kpi.name,
      source: input.source ?? kpi.name,
      eventId: input.eventId?.trim() || randomUUID(),
      occurredAt: parseOccurredAt(input.occurredAt),
      ownerId: kpi.ownerScoped ? input.ownerId ?? actor.id : input.ownerId ?? null,
      value,
      dimensions,
    };
  }

  private normalizeFilters(kpi: AnalyticsKpiDefinition, filters: AnalyticsFilter[]): AnalyticsFilter[] {
    const allowed = new Map(
      Object.entries(kpi.dimensions).filter(([, field]) => field.filterable !== false),
    );
    return filters.map((filter) => {
      if (!allowed.has(filter.field)) {
        throw new ValidationError('Unknown analytics filter field', {
          field: filter.field,
          allowed: [...allowed.keys()],
        });
      }
      if (filter.operator === 'in' && !Array.isArray(filter.value)) {
        throw new ValidationError('Filter operator in requires an array', { field: filter.field });
      }
      return filter;
    });
  }

  private requireGroupBy(kpi: AnalyticsKpiDefinition, groupBy: string | undefined): string {
    if (!groupBy) {
      throw new ValidationError('Breakdown queries require groupBy', { kpi: kpi.name });
    }
    const field = kpi.dimensions[groupBy];
    if (!field?.groupable) {
      throw new ValidationError('Unknown analytics groupBy field', {
        field: groupBy,
        allowed: Object.entries(kpi.dimensions)
          .filter(([, item]) => item.groupable)
          .map(([name]) => name),
      });
    }
    return groupBy;
  }

  private assertReady(): void {
    if (!this.runtime.enabled) {
      throw new FeatureDisabledError('analytics');
    }
  }

  private assertPermission(
    actor: AnalyticsActor,
    permission: string,
    message: string,
    details: Record<string, unknown>,
  ): void {
    if (!hasPermission(actor, permission)) {
      throw new AuthorizationError(message, { permission, ...details });
    }
  }

  private async ensureDemoFacts(): Promise<void> {
    if (!this.seedDemo) {
      return;
    }
    this.demoReady ??= this.seedDemoFacts();
    await this.demoReady;
  }

  private async seedDemoFacts(): Promise<void> {
    const actor: AnalyticsActor = {
      id: '00000000-0000-0000-0000-000000000000',
      permissions: ['analytics.write'],
    };
    const stored = buildDemoAnalyticsFacts().map((fact) => this.toStoredFact(fact, actor, false));
    await this.provider.ingest(stored);
    this.logger.debug(
      { count: stored.length, source: ANALYTICS.DEMO_SOURCE },
      'Seeded demo analytics facts',
    );
  }
}

export function createAnalyticsService(options: AnalyticsServiceOptions): AnalyticsService {
  return new AnalyticsService(options);
}

function defaultProvider(options: {
  runtime: AnalyticsRuntimeConfig;
  facts: AnalyticsRepository | null;
  logger: AppLogger;
}): AnalyticsProvider {
  if (options.runtime.provider === 'postgres' && options.facts) {
    return createPostgresAnalyticsProvider(options.facts);
  }

  if (options.runtime.provider === 'postgres' && !options.facts) {
    options.logger.warn(
      'ANALYTICS_PROVIDER=postgres requires a database; using the in-memory analytics provider for this process',
    );
  }

  return createMemoryAnalyticsProvider();
}

function hasPermission(actor: AnalyticsActor, permission: string): boolean {
  return actor.permissions.includes(permission);
}
