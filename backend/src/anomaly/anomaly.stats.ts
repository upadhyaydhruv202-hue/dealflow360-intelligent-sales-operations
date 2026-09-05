export function roundTo(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
}

export function sampleStdev(values: number[]): number | null {
  if (values.length < 2) {
    return null;
  }

  const average = mean(values);
  if (average === null) {
    return null;
  }

  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function zScore(value: number, average: number, stdev: number): number | null {
  if (!Number.isFinite(value) || !Number.isFinite(average) || !Number.isFinite(stdev) || stdev === 0) {
    return null;
  }

  return (value - average) / stdev;
}

export function percentChange(current: number, baseline: number): number | null {
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) {
    return null;
  }

  if (baseline === 0) {
    return current === 0 ? 0 : null;
  }

  return ((current - baseline) / Math.abs(baseline)) * 100;
}

export function linearSlope(values: number[]): number | null {
  const n = values.length;
  if (n < 2) {
    return null;
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (let index = 0; index < n; index += 1) {
    const y = values[index];
    if (y === undefined || !Number.isFinite(y)) {
      return null;
    }
    sumX += index;
    sumY += y;
    sumXY += index * y;
    sumXX += index * index;
  }

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) {
    return null;
  }

  return (n * sumXY - sumX * sumY) / denominator;
}

export function lastWindow(values: number[], window: number): number[] {
  return values.slice(-window);
}

export function priorWindow(values: number[], window: number): number[] {
  return values.slice(-window * 2, -window);
}
