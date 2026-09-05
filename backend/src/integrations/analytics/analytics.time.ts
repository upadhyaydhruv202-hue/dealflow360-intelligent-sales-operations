import { ANALYTICS, type AnalyticsGranularity } from '../../constants';
import { ValidationError } from '../../errors';

export interface AnalyticsWindow {
  from: Date;
  to: Date;
}

export function parseOccurredAt(value: Date | string, field = 'occurredAt'): Date {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('Invalid timestamp', { field });
  }
  return date;
}

export function maxRangeDaysFor(granularity: AnalyticsGranularity, configuredMax: number): number {
  const byGranularity: Record<AnalyticsGranularity, number> = {
    hour: ANALYTICS.HOUR_MAX_RANGE_DAYS,
    day: ANALYTICS.DAY_MAX_RANGE_DAYS,
    week: ANALYTICS.WEEK_MAX_RANGE_DAYS,
    month: ANALYTICS.MONTH_MAX_RANGE_DAYS,
  };
  return Math.min(configuredMax, byGranularity[granularity]);
}

export function resolveQueryWindow(input: {
  from?: Date | string;
  to?: Date | string;
  granularity?: AnalyticsGranularity;
  maxRangeDays: number;
}): AnalyticsWindow {
  // Default `to` is exclusive. Nudge 1ms ahead so a fact ingested as `now` is still included.
  const to = input.to === undefined ? new Date(Date.now() + 1) : parseOccurredAt(input.to, 'to');
  const defaultFrom = new Date(to.getTime() - ANALYTICS.DEFAULT_RANGE_DAYS * 24 * 60 * 60 * 1000);
  const from = input.from === undefined ? defaultFrom : parseOccurredAt(input.from, 'from');
  if (from.getTime() >= to.getTime()) {
    throw new ValidationError('Analytics from must be earlier than to', {
      from: from.toISOString(),
      to: to.toISOString(),
    });
  }

  const maxDays = maxRangeDaysFor(input.granularity ?? 'day', input.maxRangeDays);
  const spanDays = (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
  if (spanDays > maxDays) {
    throw new ValidationError('Analytics time range is too large for this query', {
      days: Number(spanDays.toFixed(2)),
      maxDays,
      granularity: input.granularity ?? 'day',
      hint: 'Narrow from/to or use a coarser granularity. Unbounded aggregations are not allowed.',
    });
  }

  return { from, to };
}

export function truncateUtc(date: Date, granularity: AnalyticsGranularity): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const hour = date.getUTCHours();

  if (granularity === 'hour') {
    return new Date(Date.UTC(year, month, day, hour, 0, 0, 0));
  }
  if (granularity === 'day') {
    return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  }
  if (granularity === 'month') {
    return new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  }

  const start = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  const weekday = start.getUTCDay();
  const isoOffset = weekday === 0 ? 6 : weekday - 1;
  start.setUTCDate(start.getUTCDate() - isoOffset);
  return start;
}

export function aggregateValues(
  values: readonly number[],
  aggregation: 'count' | 'sum' | 'avg' | 'min' | 'max',
): number {
  if (aggregation === 'count') {
    return values.length;
  }
  if (values.length === 0) {
    return 0;
  }
  if (aggregation === 'sum') {
    return values.reduce((sum, value) => sum + value, 0);
  }
  if (aggregation === 'avg') {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }
  if (aggregation === 'min') {
    return Math.min(...values);
  }
  return Math.max(...values);
}

export function roundMetric(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Number(value.toFixed(6));
}
