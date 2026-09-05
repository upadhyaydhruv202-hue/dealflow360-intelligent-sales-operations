import { SEARCH, type SearchProviderName } from '../../constants';
import { isFeatureEnabled } from '../../features';
import type { AppConfig } from '../../types/config';

export interface SearchRuntimeConfig {
  enabled: boolean;
  provider: SearchProviderName;
  fuzzyThreshold: number;
}

export function isSearchEnabled(config: Pick<AppConfig, 'features'>): boolean {
  return isFeatureEnabled(config, 'search');
}

export function resolveSearchRuntimeConfig(config: AppConfig): SearchRuntimeConfig {
  const requested = config.search.provider;
  const provider: SearchProviderName =
    requested === 'postgres' || requested === 'memory'
      ? requested
      : resolveDefaultSearchProvider(config);

  return {
    enabled: isSearchEnabled(config),
    provider,
    fuzzyThreshold: config.search.fuzzyThreshold,
  };
}

export function resolveDefaultSearchProvider(
  config: Pick<AppConfig, 'databaseUrl'>,
): SearchProviderName {
  return config.databaseUrl ? 'postgres' : 'memory';
}

export const SEARCH_DEFAULTS = {
  provider: SEARCH.DEFAULT_PROVIDER,
  fuzzyThreshold: SEARCH.DEFAULT_FUZZY_THRESHOLD,
} as const;
