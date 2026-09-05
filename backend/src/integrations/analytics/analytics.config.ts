import { ANALYTICS, type AnalyticsProviderName } from '../../constants';
import { isFeatureEnabled } from '../../features';
import type { AppConfig } from '../../types/config';

export interface AnalyticsRuntimeConfig {
  enabled: boolean;
  provider: AnalyticsProviderName;
  maxRangeDays: number;
  maxSeriesPoints: number;
  maxExportRows: number;
}

export function isAnalyticsEnabled(config: Pick<AppConfig, 'features'>): boolean {
  return isFeatureEnabled(config, 'analytics');
}

export function resolveAnalyticsRuntimeConfig(config: AppConfig): AnalyticsRuntimeConfig {
  const requested = config.analytics.provider;
  const provider: AnalyticsProviderName =
    requested === 'postgres' || requested === 'memory'
      ? requested
      : resolveDefaultAnalyticsProvider(config);

  return {
    enabled: isAnalyticsEnabled(config),
    provider,
    maxRangeDays: config.analytics.maxRangeDays,
    maxSeriesPoints: config.analytics.maxSeriesPoints,
    maxExportRows: config.analytics.maxExportRows,
  };
}

export function resolveDefaultAnalyticsProvider(
  config: Pick<AppConfig, 'databaseUrl'>,
): AnalyticsProviderName {
  return config.databaseUrl ? 'postgres' : 'memory';
}

export const ANALYTICS_DEFAULTS = {
  provider: ANALYTICS.DEFAULT_PROVIDER,
  maxRangeDays: ANALYTICS.DEFAULT_MAX_RANGE_DAYS,
  maxSeriesPoints: ANALYTICS.DEFAULT_SERIES_POINTS,
  maxExportRows: ANALYTICS.DEFAULT_EXPORT_ROWS,
} as const;
