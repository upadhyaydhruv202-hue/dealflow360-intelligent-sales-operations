import type { AnalyticsAggregation } from '../../../constants';
import { aggregateValues, roundMetric, truncateUtc } from '../analytics.time';
import type {
  AnalyticsDimensionValue,
  AnalyticsFilter,
  AnalyticsProvider,
  AnalyticsSeriesPoint,
  ProviderAnalyticsWindow,
  ProviderBreakdownQuery,
  ProviderBreakdownResult,
  ProviderSnapshotResult,
  ProviderTimeseriesQuery,
  ProviderTimeseriesResult,
  StoredAnalyticsFact,
} from '../analytics.types';

export class MemoryAnalyticsProvider implements AnalyticsProvider {
  readonly name = 'memory' as const;
  private readonly facts = new Map<string, StoredAnalyticsFact>();

  async ingest(facts: readonly StoredAnalyticsFact[]): Promise<number> {
    for (const fact of facts) {
      this.facts.set(`${fact.source}:${fact.eventId}`, { ...fact });
    }
    return facts.length;
  }

  async snapshot(query: ProviderAnalyticsWindow): Promise<ProviderSnapshotResult> {
    const matched = this.select(query);
    return {
      value: roundMetric(aggregateValues(valuesOf(matched, query.aggregation), query.aggregation)),
      samples: matched.length,
    };
  }

  async timeseries(query: ProviderTimeseriesQuery): Promise<ProviderTimeseriesResult> {
    const buckets = new Map<string, StoredAnalyticsFact[]>();
    for (const fact of this.select(query)) {
      const bucket = truncateUtc(fact.occurredAt, query.granularity).toISOString();
      const current = buckets.get(bucket) ?? [];
      current.push(fact);
      buckets.set(bucket, current);
    }

    const points: AnalyticsSeriesPoint[] = [...buckets.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([bucket, facts]) => ({
        bucket,
        value: roundMetric(aggregateValues(valuesOf(facts, query.aggregation), query.aggregation)),
        samples: facts.length,
      }));

    return {
      totalItems: points.length,
      points: points.slice(query.skip, query.skip + query.take),
    };
  }

  async breakdown(query: ProviderBreakdownQuery): Promise<ProviderBreakdownResult> {
    const groups = new Map<string, StoredAnalyticsFact[]>();
    for (const fact of this.select(query)) {
      const key = stringifyDimension(fact.dimensions[query.groupBy]);
      const current = groups.get(key) ?? [];
      current.push(fact);
      groups.set(key, current);
    }

    const rows = [...groups.entries()]
      .map(([key, facts]) => ({
        key,
        value: roundMetric(aggregateValues(valuesOf(facts, query.aggregation), query.aggregation)),
        samples: facts.length,
      }))
      .sort((left, right) => right.value - left.value || left.key.localeCompare(right.key));

    return {
      totalItems: rows.length,
      rows: rows.slice(query.skip, query.skip + query.take),
    };
  }

  private select(query: ProviderAnalyticsWindow): StoredAnalyticsFact[] {
    return [...this.facts.values()].filter((fact) => matchesWindow(fact, query));
  }
}

export function createMemoryAnalyticsProvider(): MemoryAnalyticsProvider {
  return new MemoryAnalyticsProvider();
}

function valuesOf(facts: readonly StoredAnalyticsFact[], aggregation: AnalyticsAggregation): number[] {
  if (aggregation === 'count') {
    return facts.map(() => 1);
  }
  return facts.map((fact) => fact.value);
}

function stringifyDimension(value: AnalyticsDimensionValue | undefined): string {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value);
}

function matchesWindow(fact: StoredAnalyticsFact, query: ProviderAnalyticsWindow): boolean {
  if (fact.kpiKey !== query.kpiKey) {
    return false;
  }
  if (fact.occurredAt < query.from || fact.occurredAt >= query.to) {
    return false;
  }
  if (query.ownerScoped && fact.ownerId !== query.ownerId) {
    return false;
  }
  return query.filters.every((filter) => matchesFilter(fact.dimensions, filter));
}

function matchesFilter(
  dimensions: Record<string, AnalyticsDimensionValue>,
  filter: AnalyticsFilter,
): boolean {
  const current = dimensions[filter.field];
  if (filter.operator === 'eq') {
    return current === filter.value || (filter.value === null && (current === undefined || current === null));
  }
  if (filter.operator === 'neq') {
    return current !== filter.value;
  }
  if (filter.operator === 'in' && Array.isArray(filter.value)) {
    return filter.value.some((item) => item === current);
  }
  if (typeof current === 'number' && typeof filter.value === 'number') {
    if (filter.operator === 'gte') {
      return current >= filter.value;
    }
    if (filter.operator === 'lte') {
      return current <= filter.value;
    }
  }
  return false;
}
