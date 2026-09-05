import { ANALYTICS } from '../../constants';
import { ValidationError } from '../../errors';
import { analyticsKpiNameSchema } from './analytics.schemas';
import type {
  AnalyticsDashboardDefinition,
  AnalyticsDashboardSummary,
  AnalyticsKpiDefinition,
  AnalyticsKpiSummary,
} from './analytics.types';

export class AnalyticsRegistry {
  private readonly kpis = new Map<string, AnalyticsKpiDefinition>();
  private readonly dashboards = new Map<string, AnalyticsDashboardDefinition>();

  registerKpi(definition: AnalyticsKpiDefinition): void {
    const name = analyticsKpiNameSchema.parse(definition.name);
    if (this.kpis.has(name)) {
      throw new ValidationError('Analytics KPI is already registered', { kpi: name });
    }
    if (!definition.aggregation) {
      throw new ValidationError('Analytics KPI must declare an aggregation', { kpi: name });
    }
    this.kpis.set(name, { ...definition, name });
  }

  registerDashboard(definition: AnalyticsDashboardDefinition): void {
    const name = analyticsKpiNameSchema.parse(definition.name);
    if (this.dashboards.has(name)) {
      throw new ValidationError('Analytics dashboard is already registered', { dashboard: name });
    }
    if (definition.widgets.length === 0) {
      throw new ValidationError('Analytics dashboard must declare widgets', { dashboard: name });
    }
    for (const widget of definition.widgets) {
      if (!this.kpis.has(widget.kpi)) {
        throw new ValidationError('Dashboard widget references an unknown KPI', {
          dashboard: name,
          widget: widget.id,
          kpi: widget.kpi,
        });
      }
      if (widget.type === 'breakdown' && !widget.groupBy) {
        throw new ValidationError('Breakdown widgets need groupBy', { dashboard: name, widget: widget.id });
      }
    }
    this.dashboards.set(name, { ...definition, name });
  }

  getKpi(name: string): AnalyticsKpiDefinition {
    const kpi = this.kpis.get(name);
    if (!kpi) {
      throw new ValidationError('Unknown analytics KPI', { kpi: name });
    }
    return kpi;
  }

  getDashboard(name: string): AnalyticsDashboardDefinition {
    const dashboard = this.dashboards.get(name);
    if (!dashboard) {
      throw new ValidationError('Unknown analytics dashboard', { dashboard: name });
    }
    return dashboard;
  }

  listKpis(): AnalyticsKpiDefinition[] {
    return [...this.kpis.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  listDashboards(): AnalyticsDashboardDefinition[] {
    return [...this.dashboards.values()].sort((left, right) => left.name.localeCompare(right.name));
  }

  summarizeKpi(definition: AnalyticsKpiDefinition): AnalyticsKpiSummary {
    return {
      name: definition.name,
      summary: definition.summary,
      unit: definition.unit,
      aggregation: definition.aggregation,
      ownerScoped: definition.ownerScoped === true,
      httpWritable: definition.httpWritable === true,
      filterableFields: Object.entries(definition.dimensions)
        .filter(([, field]) => field.filterable !== false)
        .map(([name]) => name),
      groupableFields: Object.entries(definition.dimensions)
        .filter(([, field]) => field.groupable)
        .map(([name]) => name),
    };
  }

  summarizeDashboard(definition: AnalyticsDashboardDefinition): AnalyticsDashboardSummary {
    return {
      name: definition.name,
      title: definition.title,
      summary: definition.summary,
      widgets: definition.widgets.length,
    };
  }
}

export function createAnalyticsRegistry(
  kpis: readonly AnalyticsKpiDefinition[] = [],
  dashboards: readonly AnalyticsDashboardDefinition[] = [],
): AnalyticsRegistry {
  const registry = new AnalyticsRegistry();
  for (const kpi of kpis) {
    registry.registerKpi(kpi);
  }
  for (const dashboard of dashboards) {
    registry.registerDashboard(dashboard);
  }
  return registry;
}

const DEMO_DIMENSIONS = {
  status: { type: 'keyword' as const, filterable: true, groupable: true },
  category: { type: 'keyword' as const, filterable: true, groupable: true },
};

export const DEMO_EVENTS_KPI: AnalyticsKpiDefinition = {
  name: ANALYTICS.DEMO_EVENTS_KPI,
  summary: 'Count of generic demo events. Not a problem-specific business metric.',
  aggregation: 'count',
  unit: 'events',
  permission: 'analytics.read',
  writePermission: 'analytics.write',
  exportPermission: 'analytics.export',
  ownerScoped: false,
  httpWritable: true,
  dimensions: DEMO_DIMENSIONS,
};

export const DEMO_VALUE_KPI: AnalyticsKpiDefinition = {
  name: ANALYTICS.DEMO_VALUE_KPI,
  summary: 'Sum of generic demo values. Replace from modules/problem for a real statement.',
  aggregation: 'sum',
  unit: 'units',
  permission: 'analytics.read',
  writePermission: 'analytics.write',
  exportPermission: 'analytics.export',
  ownerScoped: false,
  httpWritable: true,
  dimensions: DEMO_DIMENSIONS,
};

export const DEMO_ANALYTICS_DASHBOARD: AnalyticsDashboardDefinition = {
  name: ANALYTICS.DEMO_DASHBOARD,
  title: 'Demo analytics',
  summary: 'Reusable dashboard slots over registered demo KPIs. Hackathon metrics belong under modules/problem.',
  permission: 'analytics.read',
  widgets: [
    { id: 'events', type: 'kpi', kpi: ANALYTICS.DEMO_EVENTS_KPI, title: 'Events' },
    { id: 'value', type: 'kpi', kpi: ANALYTICS.DEMO_VALUE_KPI, title: 'Value' },
    {
      id: 'events-over-time',
      type: 'timeseries',
      kpi: ANALYTICS.DEMO_EVENTS_KPI,
      title: 'Events over time',
      granularity: 'day',
    },
    {
      id: 'events-by-status',
      type: 'breakdown',
      kpi: ANALYTICS.DEMO_EVENTS_KPI,
      title: 'Events by status',
      groupBy: 'status',
    },
  ],
};
