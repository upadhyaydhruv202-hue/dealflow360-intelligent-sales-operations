import { describe, expect, it } from 'vitest';

import { loadConfig } from '../config';
import { resolveAnomalyRuntimeConfig } from './anomaly.config';
import { detectAnomaly } from './anomaly.engine';
import { HIGH_DROP_SALES, INSUFFICIENT_POINTS, LOW_DROP_SALES, STABLE_SALES } from './fixtures';

function runtime() {
  return resolveAnomalyRuntimeConfig(
    loadConfig({ NODE_ENV: 'test', FEATURE_ANOMALY_DETECTION: 'true' }),
  );
}

describe('anomaly engine', () => {
  it('reports no anomaly on a stable series', () => {
    const verdict = detectAnomaly(STABLE_SALES, undefined, runtime());
    expect(verdict.anomaly).toBe(false);
    expect(verdict.severity).toBe('NONE');
    expect(verdict.evidence.claimsStatisticalSignificance).toBe(false);
  });

  it('reports a low anomaly from percent change only', () => {
    const verdict = detectAnomaly(LOW_DROP_SALES, { zScore: { enabled: false }, frequency: { enabled: false }, movingAverage: { enabled: false }, trend: { enabled: false } }, runtime());
    expect(verdict.anomaly).toBe(true);
    expect(verdict.severity).toBe('LOW');
    expect(verdict.evidence.fired).toContain('percentChange');
  });

  it('reports a high anomaly with measured change separate from narrative', () => {
    const verdict = detectAnomaly(HIGH_DROP_SALES, undefined, runtime());
    expect(verdict.anomaly).toBe(true);
    expect(verdict.severity).toBe('HIGH');
    expect(verdict.change).toBe(-23.4);
    expect(verdict.evidence.claimsStatisticalSignificance).toBe(false);
    expect(verdict.evidence.fired.length).toBeGreaterThan(0);
  });

  it('does not mark a series as a sufficient sample below the configured z-score floor', () => {
    const verdict = detectAnomaly(STABLE_SALES, undefined, { ...runtime(), zScoreMinSamples: 20 });
    expect(verdict.evidence.sampleSize).toBe(10);
    expect(verdict.evidence.sufficientSample).toBe(false);
    expect(verdict.evidence.claimsStatisticalSignificance).toBe(false);
  });

  it('does not report a z-score anomaly when data is insufficient', () => {
    const verdict = detectAnomaly(
      INSUFFICIENT_POINTS,
      {
        threshold: { enabled: false },
        percentChange: { enabled: false },
        movingAverage: { enabled: false },
        frequency: { enabled: false },
        trend: { enabled: false },
        zScore: { enabled: true },
      },
      runtime(),
    );
    expect(verdict.anomaly).toBe(false);
    expect(verdict.evidence.insufficientData).toBe(true);
    expect(verdict.evidence.skipped.some((item) => item.name === 'zScore')).toBe(true);
    expect(verdict.evidence.claimsStatisticalSignificance).toBe(false);
  });
});
