import type {
  AnalyticsBreakdownRow,
  AnalyticsExportFormat,
  AnalyticsQueryResult,
  AnalyticsSeriesPoint,
} from './analytics.types';

export function renderAnalyticsExport(
  result: AnalyticsQueryResult,
  format: AnalyticsExportFormat,
): { filename: string; contentType: string; content: string } {
  const stamp = result.from.slice(0, 10);
  if (format === 'json') {
    return {
      filename: `${result.kpi}-${result.kind}-${stamp}.json`,
      contentType: 'application/json',
      content: `${JSON.stringify(serializeExportPayload(result), null, 2)}\n`,
    };
  }

  return {
    filename: `${result.kpi}-${result.kind}-${stamp}.csv`,
    contentType: 'text/csv',
    content: toCsv(result),
  };
}

function serializeExportPayload(result: AnalyticsQueryResult) {
  if (result.kind === 'snapshot') {
    return {
      kind: result.kind,
      kpi: result.kpi,
      aggregation: result.aggregation,
      from: result.from,
      to: result.to,
      value: result.snapshot?.value ?? 0,
      samples: result.snapshot?.samples ?? 0,
    };
  }
  if (result.kind === 'timeseries') {
    return {
      kind: result.kind,
      kpi: result.kpi,
      aggregation: result.aggregation,
      from: result.from,
      to: result.to,
      granularity: result.granularity,
      points: result.points ?? [],
    };
  }
  return {
    kind: result.kind,
    kpi: result.kpi,
    aggregation: result.aggregation,
    from: result.from,
    to: result.to,
    groupBy: result.groupBy,
    rows: result.rows ?? [],
  };
}

function toCsv(result: AnalyticsQueryResult): string {
  if (result.kind === 'snapshot') {
    return csvTable(
      ['kpi', 'aggregation', 'from', 'to', 'value', 'samples'],
      [
        [
          result.kpi,
          result.aggregation,
          result.from,
          result.to,
          String(result.snapshot?.value ?? 0),
          String(result.snapshot?.samples ?? 0),
        ],
      ],
    );
  }
  if (result.kind === 'timeseries') {
    return csvTable(
      ['bucket', 'value', 'samples'],
      (result.points ?? []).map((point: AnalyticsSeriesPoint) => [
        point.bucket,
        String(point.value),
        String(point.samples),
      ]),
    );
  }
  return csvTable(
    ['key', 'value', 'samples'],
    (result.rows ?? []).map((row: AnalyticsBreakdownRow) => [row.key, String(row.value), String(row.samples)]),
  );
}

function csvTable(headers: string[], rows: string[][]): string {
  const lines = [headers.map(escapeCsv).join(','), ...rows.map((row) => row.map(escapeCsv).join(','))];
  return `${lines.join('\n')}\n`;
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
