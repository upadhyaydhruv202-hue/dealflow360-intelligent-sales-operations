import { describe, expect, it } from 'vitest';

import { linearSlope, mean, percentChange, roundTo, sampleStdev, zScore } from './anomaly.stats';

describe('anomaly stats', () => {
  it('computes mean and sample standard deviation', () => {
    expect(mean([2, 4, 4, 4, 5, 5, 7, 9])).toBe(5);
    expect(roundTo(sampleStdev([2, 4, 4, 4, 5, 5, 7, 9]) ?? 0, 4)).toBe(2.1381);
  });

  it('returns null for insufficient samples', () => {
    expect(mean([])).toBeNull();
    expect(sampleStdev([1])).toBeNull();
    expect(zScore(1, 0, 0)).toBeNull();
    expect(percentChange(10, 0)).toBeNull();
    expect(linearSlope([1])).toBeNull();
  });

  it('computes percent change and z-score', () => {
    expect(roundTo(percentChange(76.6, 100) as number)).toBe(-23.4);
    expect(roundTo(zScore(10, 4, 2) as number)).toBe(3);
  });

  it('computes a linear slope for an increasing series', () => {
    expect(roundTo(linearSlope([1, 2, 3, 4, 5]) as number, 4)).toBe(1);
  });
});
