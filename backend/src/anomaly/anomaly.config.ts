import { ANOMALY } from '../constants';
import { isFeatureEnabled } from '../features';
import type { AppConfig } from '../types/config';

export interface AnomalyRuntimeConfig {
  enabled: boolean;
  zScoreMinSamples: number;
  zScoreThreshold: number;
  zScoreHigh: number;
  percentChangeLow: number;
  percentChangeMedium: number;
  percentChangeHigh: number;
  movingAverageWindow: number;
  movingAverageDeviationPct: number;
  trendWindow: number;
  trendMinSlope: number;
  frequencyMinSamples: number;
  maxPoints: number;
  explain: boolean;
}

export function isAnomalyEnabled(config: Pick<AppConfig, 'features'>): boolean {
  return isFeatureEnabled(config, 'anomalyDetection');
}

export function resolveAnomalyRuntimeConfig(config: AppConfig): AnomalyRuntimeConfig {
  return {
    enabled: isAnomalyEnabled(config),
    zScoreMinSamples: config.anomaly.zScoreMinSamples,
    zScoreThreshold: config.anomaly.zScoreThreshold,
    zScoreHigh: config.anomaly.zScoreHigh,
    percentChangeLow: config.anomaly.percentChangeLow,
    percentChangeMedium: config.anomaly.percentChangeMedium,
    percentChangeHigh: config.anomaly.percentChangeHigh,
    movingAverageWindow: config.anomaly.movingAverageWindow,
    movingAverageDeviationPct: config.anomaly.movingAverageDeviationPct,
    trendWindow: config.anomaly.trendWindow,
    trendMinSlope: ANOMALY.DEFAULT_TREND_MIN_SLOPE,
    frequencyMinSamples: config.anomaly.zScoreMinSamples,
    maxPoints: config.anomaly.maxPoints,
    explain: config.anomaly.explain,
  };
}
