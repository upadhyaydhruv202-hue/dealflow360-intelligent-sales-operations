import { describe, expect, it } from 'vitest';

import { loadConfig } from '../config';
import { resolveAnomalyRuntimeConfig } from './anomaly.config';
import {
  runFrequencyDetector,
  runMovingAverageDetector,
  runPercentChangeDetector,
  runThresholdDetector,
  runTrendDetector,
  runZScoreDetector,
} from './anomaly.detectors';
import {
  FREQUENCY_SPIKE,
  HIGH_DROP_SALES,
  INSUFFICIENT_POINTS,
  LOW_DROP_SALES,
  STABLE_SALES,
  TREND_REVERSAL,
} from './fixtures';

function runtime() {
  return resolveAnomalyRuntimeConfig(
    loadConfig({ NODE_ENV: 'test', FEATURE_ANOMALY_DETECTION: 'true' }),
  );
}

describe('anomaly detectors', () => {
  it('does not fire on a stable series', () => {
    const config = runtime();
    expect(runPercentChangeDetector(STABLE_SALES, undefined, config).fired).toBe(false);
    expect(runMovingAverageDetector(STABLE_SALES, undefined, config).fired).toBe(false);
    expect(runZScoreDetector(STABLE_SALES, undefined, config).fired).toBe(false);
    expect(runTrendDetector(STABLE_SALES, undefined, config).fired).toBe(false);
    expect(runFrequencyDetector(STABLE_SALES, undefined, config).fired).toBe(false);
    expect(runThresholdDetector(STABLE_SALES, { min: 50, max: 150 }).fired).toBe(false);
  });

  it('flags a high percent-change drop', () => {
    const result = runPercentChangeDetector(HIGH_DROP_SALES, undefined, runtime());
    expect(result.fired).toBe(true);
    expect(result.severity).toBe('HIGH');
    expect(result.change).toBe(-23.4);
  });

  it('flags a low percent-change drop', () => {
    const result = runPercentChangeDetector(LOW_DROP_SALES, undefined, runtime());
    expect(result.fired).toBe(true);
    expect(result.severity).toBe('LOW');
  });

  it('skips z-score without enough baseline observations', () => {
    const result = runZScoreDetector(INSUFFICIENT_POINTS, undefined, runtime());
    expect(result.skipped).toBe(true);
    expect(result.fired).toBe(false);
    expect(result.skipReason).toMatch(/baseline observations/i);
  });

  it('does not treat z-score as a significance test even with enough points', () => {
    const result = runZScoreDetector(HIGH_DROP_SALES, undefined, runtime());
    expect(result.fired).toBe(true);
    expect(result.details.descriptiveOnly).toBe(true);
  });

  it('flags a threshold breach', () => {
    const result = runThresholdDetector([80, 90, 201], { max: 150 });
    expect(result.fired).toBe(true);
    expect(result.severity).toBe('HIGH');
  });

  it('flags unusual frequency', () => {
    const result = runFrequencyDetector(FREQUENCY_SPIKE, undefined, runtime());
    expect(result.fired).toBe(true);
    expect(result.severity).toBe('HIGH');
  });

  it('flags a trend reversal', () => {
    const result = runTrendDetector(TREND_REVERSAL, { window: 4, minSlope: 0.5 }, runtime());
    expect(result.fired).toBe(true);
  });

  it('flags a moving-average deviation', () => {
    const result = runMovingAverageDetector(HIGH_DROP_SALES, undefined, runtime());
    expect(result.fired).toBe(true);
  });
});
