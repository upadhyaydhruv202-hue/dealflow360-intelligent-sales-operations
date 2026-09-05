import { describe, expect, it } from 'vitest';
import pino from 'pino';

import { loadConfig } from '../../config';
import { ERROR_CODES } from '../../constants';
import { AuthorizationError, FeatureDisabledError, ValidationError } from '../../errors';
import { AuditService, createMemoryAuditStore } from '../../audit';
import { PERMISSIONS } from '../../rbac/catalog';
import { createAnalyticsService } from './analytics.service';
import { createMemoryAnalyticsProvider } from './providers/memory.provider';
import {
  createAnalyticsRegistry,
  DEMO_ANALYTICS_DASHBOARD,
  DEMO_EVENTS_KPI,
  DEMO_VALUE_KPI,
} from './analytics.registry';

const silentLogger = pino({ level: 'silent' });

function actor(permissions: string[] = [PERMISSIONS.ANALYTICS_READ, PERMISSIONS.ANALYTICS_WRITE, PERMISSIONS.ANALYTICS_EXPORT]) {
  return { id: '11111111-1111-1111-1111-111111111111', permissions };
}

function build(env: Record<string, string> = {}) {
  const config = loadConfig({
    NODE_ENV: 'test',
    FEATURE_ANALYTICS: 'true',
    ANALYTICS_PROVIDER: 'memory',
    DEMO_MODE: 'true',
    ...env,
  });
  const analytics = createAnalyticsService({
    config,
    logger: silentLogger,
    provider: createMemoryAnalyticsProvider(),
    registry: createAnalyticsRegistry([DEMO_EVENTS_KPI, DEMO_VALUE_KPI], [DEMO_ANALYTICS_DASHBOARD]),
    audit: new AuditService(createMemoryAuditStore()),
    seedDemo: env.SEED_DEMO !== 'false',
  });
  return { analytics, config };
}

describe('AnalyticsService (memory provider)', () => {
  it('aggregates, filters, and paginates a time series', async () => {
    const { analytics } = build({ SEED_DEMO: 'false' });
    await analytics.ingest(
      [
        {
          kpi: 'kit.demo.events',
          eventId: 'a',
          occurredAt: '2026-09-01T10:00:00.000Z',
          value: 1,
          dimensions: { status: 'open', category: 'ops' },
        },
        {
          kpi: 'kit.demo.events',
          eventId: 'b',
          occurredAt: '2026-09-01T18:00:00.000Z',
          value: 1,
          dimensions: { status: 'closed', category: 'ops' },
        },
        {
          kpi: 'kit.demo.events',
          eventId: 'c',
          occurredAt: '2026-09-02T10:00:00.000Z',
          value: 1,
          dimensions: { status: 'open', category: 'support' },
        },
      ],
      actor(),
    );

    const snapshot = await analytics.query({
      kpi: 'kit.demo.events',
      kind: 'snapshot',
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-09-03T00:00:00.000Z',
      filters: [{ field: 'status', operator: 'eq', value: 'open' }],
      actor: actor([PERMISSIONS.ANALYTICS_READ]),
    });
    expect(snapshot.provider).toBe('memory');
    expect(snapshot.snapshot?.value).toBe(2);
    expect(snapshot.snapshot?.samples).toBe(2);

    const series = await analytics.query({
      kpi: 'kit.demo.events',
      kind: 'timeseries',
      granularity: 'day',
      from: '2026-09-01T00:00:00.000Z',
      to: '2026-09-03T00:00:00.000Z',
      pageSize: 1,
      actor: actor([PERMISSIONS.ANALYTICS_READ]),
    });
    expect(series.points).toHaveLength(1);
    expect(series.meta.totalItems).toBe(2);
    expect(series.meta.hasNextPage).toBe(true);
    expect(series.points?.[0]?.samples).toBe(2);
  });

  it('groups breakdown rows and exports csv', async () => {
    const { analytics } = build();
    const breakdown = await analytics.query({
      kpi: 'kit.demo.events',
      kind: 'breakdown',
      groupBy: 'status',
      actor: actor([PERMISSIONS.ANALYTICS_READ]),
    });
    expect(breakdown.rows?.length).toBeGreaterThan(0);
    expect(breakdown.rows?.every((row) => row.key === 'open' || row.key === 'closed')).toBe(true);

    const exported = await analytics.export({
      kpi: 'kit.demo.events',
      kind: 'breakdown',
      groupBy: 'status',
      format: 'csv',
      actor: actor(),
    });
    expect(exported.format).toBe('csv');
    expect(exported.content).toContain('key,value,samples');
    expect(exported.contentType).toBe('text/csv');
  });

  it('evaluates the demo dashboard', async () => {
    const { analytics } = build();
    const view = await analytics.evaluateDashboard({
      name: 'kit.demo',
      actor: actor([PERMISSIONS.ANALYTICS_READ]),
    });
    expect(view.widgets).toHaveLength(4);
    expect(view.widgets[0]?.result.snapshot?.samples).toBeGreaterThan(0);
    expect(view.widgets.some((widget) => widget.type === 'timeseries' && (widget.result.points?.length ?? 0) > 0)).toBe(
      true,
    );
  });

  it('scopes owner KPIs to the caller', async () => {
    const { analytics } = build({ SEED_DEMO: 'false' });
    analytics.registerKpi({
      name: 'kit.test.owned',
      aggregation: 'sum',
      permission: 'analytics.read',
      writePermission: 'analytics.write',
      ownerScoped: true,
      httpWritable: true,
      dimensions: { status: { type: 'keyword', filterable: true, groupable: true } },
    });
    const owner = actor();
    const other = { id: '22222222-2222-2222-2222-222222222222', permissions: owner.permissions };
    const occurredAt = '2026-09-01T12:00:00.000Z';
    await analytics.ingest(
      [{ kpi: 'kit.test.owned', occurredAt, value: 9, eventId: 'mine' }],
      owner,
    );
    await analytics.ingest(
      [{ kpi: 'kit.test.owned', occurredAt, value: 4, eventId: 'theirs' }],
      other,
    );

    const window = { from: '2026-08-28T00:00:00.000Z', to: '2026-09-04T00:00:00.000Z' };
    const mine = await analytics.query({ kpi: 'kit.test.owned', ...window, actor: owner });
    const theirs = await analytics.query({ kpi: 'kit.test.owned', ...window, actor: other });
    expect(mine.snapshot?.value).toBe(9);
    expect(theirs.snapshot?.value).toBe(4);
  });

  it('rejects unknown filter fields and oversized ranges', async () => {
    const { analytics } = build({ SEED_DEMO: 'false' });
    await expect(
      analytics.query({
        kpi: 'kit.demo.events',
        filters: [{ field: 'revenue', operator: 'eq', value: 1 }],
        actor: actor([PERMISSIONS.ANALYTICS_READ]),
      }),
    ).rejects.toMatchObject({ code: ERROR_CODES.VALIDATION_ERROR });

    await expect(
      analytics.query({
        kpi: 'kit.demo.events',
        kind: 'timeseries',
        granularity: 'hour',
        from: '2026-01-01T00:00:00.000Z',
        to: '2026-03-01T00:00:00.000Z',
        actor: actor([PERMISSIONS.ANALYTICS_READ]),
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('denies callers without analytics.read', async () => {
    const { analytics } = build();
    await expect(analytics.query({ kpi: 'kit.demo.events', actor: actor([]) })).rejects.toBeInstanceOf(
      AuthorizationError,
    );
  });

  it('stays disabled unless FEATURE_ANALYTICS is on', async () => {
    const { analytics } = build({ FEATURE_ANALYTICS: 'false', SEED_DEMO: 'false' });
    await expect(analytics.query({ kpi: 'kit.demo.events', actor: actor() })).rejects.toBeInstanceOf(
      FeatureDisabledError,
    );
  });

  it('blocks HTTP ingest for KPIs that are not httpWritable', async () => {
    const { analytics } = build({ SEED_DEMO: 'false' });
    analytics.registerKpi({
      name: 'kit.test.internal',
      aggregation: 'count',
      permission: 'analytics.read',
      writePermission: 'analytics.write',
      httpWritable: false,
      dimensions: {},
    });
    await expect(
      analytics.ingest(
        [{ kpi: 'kit.test.internal', occurredAt: new Date().toISOString(), value: 1 }],
        actor(),
        { viaHttp: true },
      ),
    ).rejects.toBeInstanceOf(AuthorizationError);
    await expect(
      analytics.ingest(
        [{ kpi: 'kit.test.internal', occurredAt: new Date().toISOString(), value: 1, eventId: 'internal-1' }],
        actor(),
      ),
    ).resolves.toMatchObject({ ingested: 1 });
  });
});
