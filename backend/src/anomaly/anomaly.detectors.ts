import { type AnomalyDetectorName, type AnomalySeverityName } from '../constants';
import type { AnomalyRuntimeConfig } from './anomaly.config';
import { lastWindow, linearSlope, mean, percentChange, priorWindow, roundTo, sampleStdev, zScore } from './anomaly.stats';
import type {
  AnomalyDetectorConfig,
  DetectorResult,
  FrequencyDetectorConfig,
  MovingAverageDetectorConfig,
  PercentChangeDetectorConfig,
  ThresholdDetectorConfig,
  TrendDetectorConfig,
  ZScoreDetectorConfig,
} from './anomaly.types';

const SEVERITY_RANK: Record<AnomalySeverityName, number> = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
};

export function severityAtLeast(left: AnomalySeverityName, right: AnomalySeverityName): boolean {
  return SEVERITY_RANK[left] >= SEVERITY_RANK[right];
}

export function maxSeverity(values: AnomalySeverityName[]): AnomalySeverityName {
  return values.reduce<AnomalySeverityName>(
    (highest, current) => (SEVERITY_RANK[current] > SEVERITY_RANK[highest] ? current : highest),
    'NONE',
  );
}

function result(
  name: AnomalyDetectorName,
  options: Omit<DetectorResult, 'name'>,
): DetectorResult {
  return { name, ...options };
}

function skipped(name: AnomalyDetectorName, reason: string): DetectorResult {
  return result(name, {
    fired: false,
    skipped: true,
    skipReason: reason,
    severity: 'NONE',
    details: { reason },
  });
}

function disabled(name: AnomalyDetectorName): DetectorResult {
  return skipped(name, 'disabled');
}

function pctSeverity(
  absPct: number,
  low: number,
  medium: number,
  high: number,
): AnomalySeverityName {
  if (absPct >= high) {
    return 'HIGH';
  }
  if (absPct >= medium) {
    return 'MEDIUM';
  }
  if (absPct >= low) {
    return 'LOW';
  }
  return 'NONE';
}

export function runThresholdDetector(
  values: number[],
  config: ThresholdDetectorConfig | undefined,
): DetectorResult {
  if (config?.enabled === false) {
    return disabled('threshold');
  }
  if (config?.min === undefined && config?.max === undefined) {
    return skipped('threshold', 'no min or max configured');
  }
  if (values.length < 1) {
    return skipped('threshold', 'need at least 1 observation');
  }

  const latest = values[values.length - 1] as number;
  const below = config.min !== undefined && latest < config.min;
  const above = config.max !== undefined && latest > config.max;
  if (!below && !above) {
    return result('threshold', {
      fired: false,
      skipped: false,
      severity: 'NONE',
      details: { latest, min: config.min ?? null, max: config.max ?? null },
    });
  }

  const bound = below ? (config.min as number) : (config.max as number);
  const excessPct = percentChange(latest, bound);
  const absExcess = excessPct === null ? 0 : Math.abs(excessPct);
  const severity: AnomalySeverityName = absExcess >= 20 ? 'HIGH' : absExcess >= 10 ? 'MEDIUM' : 'LOW';

  return result('threshold', {
    fired: true,
    skipped: false,
    severity,
    change: excessPct === null ? undefined : roundTo(excessPct),
    details: {
      latest,
      min: config.min ?? null,
      max: config.max ?? null,
      direction: below ? 'belowMin' : 'aboveMax',
    },
  });
}

export function runPercentChangeDetector(
  values: number[],
  config: PercentChangeDetectorConfig | undefined,
  runtime: AnomalyRuntimeConfig,
): DetectorResult {
  if (config?.enabled === false) {
    return disabled('percentChange');
  }

  const window = config?.window ?? 1;
  const low = config?.lowPct ?? runtime.percentChangeLow;
  const medium = config?.mediumPct ?? runtime.percentChangeMedium;
  const high = config?.highPct ?? runtime.percentChangeHigh;

  if (window < 1 || values.length < window * 2) {
    return skipped(
      'percentChange',
      `need at least ${window * 2} observations for window ${window}`,
    );
  }

  const currentMean = mean(lastWindow(values, window));
  const baselineMean = mean(priorWindow(values, window));
  if (currentMean === null || baselineMean === null) {
    return skipped('percentChange', 'unable to compute window means');
  }

  const change = percentChange(currentMean, baselineMean);
  if (change === null) {
    return skipped('percentChange', 'baseline is zero; percent change is undefined');
  }

  const rounded = roundTo(change);
  const severity = pctSeverity(Math.abs(change), low, medium, high);
  return result('percentChange', {
    fired: severity !== 'NONE',
    skipped: false,
    severity,
    change: rounded,
    details: {
      window,
      current: roundTo(currentMean, 4),
      baseline: roundTo(baselineMean, 4),
      change: rounded,
      lowPct: low,
      mediumPct: medium,
      highPct: high,
    },
  });
}

export function runMovingAverageDetector(
  values: number[],
  config: MovingAverageDetectorConfig | undefined,
  runtime: AnomalyRuntimeConfig,
): DetectorResult {
  if (config?.enabled === false) {
    return disabled('movingAverage');
  }

  const window = config?.window ?? runtime.movingAverageWindow;
  const deviationPct = config?.deviationPct ?? runtime.movingAverageDeviationPct;
  if (values.length < window + 1) {
    return skipped('movingAverage', `need at least ${window + 1} observations for window ${window}`);
  }

  const latest = values[values.length - 1] as number;
  const sma = mean(values.slice(-(window + 1), -1));
  if (sma === null) {
    return skipped('movingAverage', 'unable to compute moving average');
  }

  const change = percentChange(latest, sma);
  if (change === null) {
    return skipped('movingAverage', 'moving average is zero; percent deviation is undefined');
  }

  const rounded = roundTo(change);
  const abs = Math.abs(change);
  const fired = abs >= deviationPct;
  const severity = fired ? pctSeverity(abs, deviationPct, deviationPct * 1.5, deviationPct * 2) : 'NONE';

  return result('movingAverage', {
    fired,
    skipped: false,
    severity,
    change: rounded,
    details: {
      window,
      latest,
      sma: roundTo(sma, 4),
      deviationPct: rounded,
      thresholdPct: deviationPct,
    },
  });
}

export function runFrequencyDetector(
  values: number[],
  config: FrequencyDetectorConfig | undefined,
  runtime: AnomalyRuntimeConfig,
): DetectorResult {
  if (config?.enabled === false) {
    return disabled('frequency');
  }

  if (values.some((value) => value < 0)) {
    return skipped('frequency', 'frequency requires non-negative counts');
  }

  const latest = values[values.length - 1] as number;
  if (config?.expectedMin !== undefined || config?.expectedMax !== undefined) {
    const below = config.expectedMin !== undefined && latest < config.expectedMin;
    const above = config.expectedMax !== undefined && latest > config.expectedMax;
    if (!below && !above) {
      return result('frequency', {
        fired: false,
        skipped: false,
        severity: 'NONE',
        details: {
          latest,
          expectedMin: config.expectedMin ?? null,
          expectedMax: config.expectedMax ?? null,
        },
      });
    }

    const bound = below ? (config.expectedMin as number) : (config.expectedMax as number);
    const change = percentChange(latest, bound);
    const abs = change === null ? 0 : Math.abs(change);
    return result('frequency', {
      fired: true,
      skipped: false,
      severity: abs >= 50 ? 'HIGH' : abs >= 25 ? 'MEDIUM' : 'LOW',
      change: change === null ? undefined : roundTo(change),
      details: {
        latest,
        expectedMin: config.expectedMin ?? null,
        expectedMax: config.expectedMax ?? null,
        direction: below ? 'belowExpected' : 'aboveExpected',
      },
    });
  }

  const minSamples = config?.minSamples ?? runtime.frequencyMinSamples;
  const baseline = values.slice(0, -1);
  if (baseline.length < minSamples) {
    return skipped('frequency', `need at least ${minSamples} prior counts`);
  }

  const average = mean(baseline);
  const stdev = sampleStdev(baseline);
  if (average === null || stdev === null || stdev === 0) {
    return skipped('frequency', 'prior counts have no variation');
  }

  const z = zScore(latest, average, stdev);
  if (z === null) {
    return skipped('frequency', 'unable to compute frequency z-score');
  }

  const threshold = config?.zThreshold ?? runtime.zScoreThreshold;
  const abs = Math.abs(z);
  const fired = abs >= threshold;
  const severity: AnomalySeverityName = !fired
    ? 'NONE'
    : abs >= runtime.zScoreHigh
      ? 'HIGH'
      : abs >= threshold + 0.5
        ? 'MEDIUM'
        : 'LOW';

  return result('frequency', {
    fired,
    skipped: false,
    severity,
    score: roundTo(z, 2),
    change: percentChange(latest, average) === null ? undefined : roundTo(percentChange(latest, average) as number),
    details: {
      latest,
      baselineMean: roundTo(average, 4),
      baselineStdev: roundTo(stdev, 4),
      zScore: roundTo(z, 2),
      threshold,
      descriptiveOnly: true,
    },
  });
}

export function runTrendDetector(
  values: number[],
  config: TrendDetectorConfig | undefined,
  runtime: AnomalyRuntimeConfig,
): DetectorResult {
  if (config?.enabled === false) {
    return disabled('trend');
  }

  const window = config?.window ?? runtime.trendWindow;
  const minSlope = config?.minSlope ?? runtime.trendMinSlope;
  if (values.length < window * 2) {
    return skipped('trend', `need at least ${window * 2} observations for window ${window}`);
  }

  const previous = priorWindow(values, window);
  const recent = lastWindow(values, window);
  const slopePrev = linearSlope(previous);
  const slopeRecent = linearSlope(recent);
  if (slopePrev === null || slopeRecent === null) {
    return skipped('trend', 'unable to compute window slopes');
  }

  const flipped = slopePrev * slopeRecent < 0;
  const strongEnough = Math.abs(slopePrev) >= minSlope && Math.abs(slopeRecent) >= minSlope;
  const fired = flipped && strongEnough;
  const steepness = Math.abs(slopePrev) === 0 ? 0 : Math.abs(slopeRecent) / Math.abs(slopePrev);
  const severity: AnomalySeverityName = !fired ? 'NONE' : steepness >= 2 ? 'HIGH' : 'MEDIUM';

  return result('trend', {
    fired,
    skipped: false,
    severity,
    details: {
      window,
      slopePrevious: roundTo(slopePrev, 4),
      slopeRecent: roundTo(slopeRecent, 4),
      signFlip: flipped,
      minSlope,
    },
  });
}

export function runZScoreDetector(
  values: number[],
  config: ZScoreDetectorConfig | undefined,
  runtime: AnomalyRuntimeConfig,
): DetectorResult {
  if (config?.enabled === false) {
    return disabled('zScore');
  }

  const minSamples = config?.minSamples ?? runtime.zScoreMinSamples;
  const threshold = config?.threshold ?? runtime.zScoreThreshold;
  const highThreshold = config?.highThreshold ?? runtime.zScoreHigh;
  const latest = values[values.length - 1] as number;
  const baseline = values.slice(0, -1);

  if (baseline.length < minSamples) {
    return skipped(
      'zScore',
      `need at least ${minSamples} baseline observations; z-score is not reported as statistically significant`,
    );
  }

  const average = mean(baseline);
  const stdev = sampleStdev(baseline);
  if (average === null || stdev === null || stdev === 0) {
    return skipped('zScore', 'baseline has no variation');
  }

  const z = zScore(latest, average, stdev);
  if (z === null) {
    return skipped('zScore', 'unable to compute z-score');
  }

  const abs = Math.abs(z);
  const fired = abs >= threshold;
  const severity: AnomalySeverityName = !fired
    ? 'NONE'
    : abs >= highThreshold
      ? 'HIGH'
      : abs >= (threshold + highThreshold) / 2
        ? 'MEDIUM'
        : 'LOW';

  return result('zScore', {
    fired,
    skipped: false,
    severity,
    score: roundTo(z, 2),
    change: percentChange(latest, average) === null ? undefined : roundTo(percentChange(latest, average) as number),
    details: {
      latest,
      baselineMean: roundTo(average, 4),
      baselineStdev: roundTo(stdev, 4),
      baselineSize: baseline.length,
      zScore: roundTo(z, 2),
      threshold,
      highThreshold,
      descriptiveOnly: true,
    },
  });
}

export function runDetectors(
  values: number[],
  config: AnomalyDetectorConfig | undefined,
  runtime: AnomalyRuntimeConfig,
): DetectorResult[] {
  return [
    runThresholdDetector(values, config?.threshold),
    runPercentChangeDetector(values, config?.percentChange, runtime),
    runMovingAverageDetector(values, config?.movingAverage, runtime),
    runFrequencyDetector(values, config?.frequency, runtime),
    runTrendDetector(values, config?.trend, runtime),
    runZScoreDetector(values, config?.zScore, runtime),
  ];
}
