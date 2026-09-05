import { ANOMALY } from '../constants';
import { mean, percentChange, roundTo } from './anomaly.stats';
import { maxSeverity, runDetectors } from './anomaly.detectors';
import type { AnomalyRuntimeConfig } from './anomaly.config';
import type {
  AnomalyDetectorConfig,
  AnomalyEvidence,
  DetectionVerdict,
  DetectorResult,
  MetricPoint,
} from './anomaly.types';

export function normalizePoints(points: MetricPoint[] | number[]): MetricPoint[] {
  if (points.length === 0) {
    return [];
  }

  if (typeof points[0] === 'number') {
    return (points as number[]).map((value, index) => ({ t: String(index + 1), value }));
  }

  return (points as MetricPoint[]).map((point, index) => ({
    t: point.t ?? String(index + 1),
    value: point.count === undefined ? point.value : point.count,
    count: point.count,
  }));
}

export function valuesFromPoints(points: MetricPoint[]): number[] {
  return points.map((point) => point.value);
}

export function combineDetectors(
  values: number[],
  results: DetectorResult[],
  runtime?: Pick<AnomalyRuntimeConfig, 'zScoreMinSamples'>,
): DetectionVerdict {
  const considered = results.filter((item) => !item.skipped);
  const fired = considered.filter((item) => item.fired);
  const skipped = results
    .filter((item) => item.skipped && item.skipReason && item.skipReason !== 'disabled')
    .map((item) => ({ name: item.name, reason: item.skipReason as string }));

  const latest = values[values.length - 1] as number;
  const previous = values.length >= 2 ? (values[values.length - 2] as number) : null;
  const percentResult = results.find((item) => item.name === 'percentChange' && item.change !== undefined);
  const computedChange =
    percentResult?.change ??
    (previous === null ? null : percentChange(latest, previous));
  const change = computedChange === null || computedChange === undefined ? null : roundTo(computedChange);
  const baseline =
    percentResult && typeof percentResult.details.baseline === 'number'
      ? percentResult.details.baseline
      : previous === null
        ? mean(values.slice(0, -1))
        : previous;

  const insufficientData = considered.length === 0;
  const sampleSize = values.length;
  const minSamples = runtime?.zScoreMinSamples ?? ANOMALY.DEFAULT_ZSCORE_MIN_SAMPLES;
  const sufficientSample = sampleSize >= minSamples;

  const evidence: AnomalyEvidence = {
    sampleSize,
    latest,
    baseline: baseline === null || baseline === undefined ? null : roundTo(baseline, 4),
    change,
    fired: fired.map((item) => item.name),
    skipped,
    detectors: results,
    sufficientSample,
    claimsStatisticalSignificance: false,
    insufficientData,
  };

  if (insufficientData) {
    return {
      anomaly: false,
      severity: 'NONE',
      change,
      evidence,
    };
  }

  return {
    anomaly: fired.length > 0,
    severity: fired.length > 0 ? maxSeverity(fired.map((item) => item.severity)) : 'NONE',
    change,
    evidence,
  };
}

export function detectAnomaly(
  values: number[],
  config: AnomalyDetectorConfig | undefined,
  runtime: AnomalyRuntimeConfig,
): DetectionVerdict {
  return combineDetectors(values, runDetectors(values, config, runtime), runtime);
}
