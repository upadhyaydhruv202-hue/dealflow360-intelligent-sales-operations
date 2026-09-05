import type { AnalyticsRepository } from '../../../repositories/analytics.repository';
import type {
  AnalyticsProvider,
  ProviderAnalyticsWindow,
  ProviderBreakdownQuery,
  ProviderBreakdownResult,
  ProviderSnapshotResult,
  ProviderTimeseriesQuery,
  ProviderTimeseriesResult,
  StoredAnalyticsFact,
} from '../analytics.types';

export class PostgresAnalyticsProvider implements AnalyticsProvider {
  readonly name = 'postgres' as const;

  constructor(private readonly facts: AnalyticsRepository) {}

  ingest(facts: readonly StoredAnalyticsFact[]): Promise<number> {
    return this.facts.ingest(facts);
  }

  snapshot(query: ProviderAnalyticsWindow): Promise<ProviderSnapshotResult> {
    return this.facts.snapshot(query);
  }

  timeseries(query: ProviderTimeseriesQuery): Promise<ProviderTimeseriesResult> {
    return this.facts.timeseries(query);
  }

  breakdown(query: ProviderBreakdownQuery): Promise<ProviderBreakdownResult> {
    return this.facts.breakdown(query);
  }
}

export function createPostgresAnalyticsProvider(facts: AnalyticsRepository): PostgresAnalyticsProvider {
  return new PostgresAnalyticsProvider(facts);
}
