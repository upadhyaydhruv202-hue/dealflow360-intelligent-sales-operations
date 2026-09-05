import { ValidationError } from '../../errors';
import { parseWithSchema } from '../../schemas/parse';
import {
  reportChartSchema,
  reportFactRecordSchema,
  reportNarrativeSchema,
  reportSectionSchema,
  reportTableSchema,
} from './report.schemas';
import type {
  ReportChart,
  ReportDataset,
  ReportNarrative,
  ReportSection,
  ReportTable,
} from './report.types';

export const NARRATIVE_KEYS = ['narrative', 'aiNarrative', 'aiSummary', 'generatedNarrative'] as const;

const STRUCTURAL_KEYS = new Set([
  'title',
  'subtitle',
  'facts',
  'table',
  'columns',
  'rows',
  'chart',
  'sections',
  'header',
  'footer',
  ...NARRATIVE_KEYS,
]);

export function splitReportData(data: Record<string, unknown>): {
  remainder: Record<string, unknown>;
  narrative: ReportNarrative | null;
} {
  const remainder = { ...data };
  let narrative: ReportNarrative | null = null;

  for (const key of NARRATIVE_KEYS) {
    if (!(key in remainder) || remainder[key] === undefined || remainder[key] === null) {
      continue;
    }
    const parsed = parseNarrative(remainder[key]);
    delete remainder[key];
    if (parsed) {
      narrative = parsed;
    }
  }

  return { remainder, narrative };
}

export function parseNarrative(value: unknown): ReportNarrative | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const parsed = parseWithSchema(reportNarrativeSchema, value, {
    source: 'body',
    message: 'Invalid AI narrative',
  });
  if (typeof parsed === 'string') {
    return { text: parsed, source: 'ai' };
  }
  return { text: parsed.text, source: 'ai', generatedAt: parsed.generatedAt };
}

export function mergeVerifiedFacts(
  verified: Record<string, string>,
  incoming: Record<string, string>,
): Record<string, string> {
  return { ...incoming, ...verified };
}

export function stringifyFactValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return JSON.stringify(value);
}

export function factsToEntries(facts: Record<string, string>): Array<{ key: string; value: string }> {
  return Object.entries(facts)
    .filter(([key]) => !STRUCTURAL_KEYS.has(key))
    .map(([key, value]) => ({ key, value }));
}

export function parseInlineDataset(data: Record<string, unknown>): ReportDataset {
  const { remainder, narrative } = splitReportData(data);
  const factsObject =
    remainder.facts && typeof remainder.facts === 'object' && !Array.isArray(remainder.facts)
      ? (remainder.facts as Record<string, unknown>)
      : {};
  const parsedFacts = parseWithSchema(reportFactRecordSchema, flattenFacts({ ...remainder, ...factsObject }), {
    source: 'body',
    message: 'Invalid report facts',
  });
  const facts = Object.fromEntries(
    Object.entries(parsedFacts)
      .filter(([key]) => !STRUCTURAL_KEYS.has(key) || key === 'title' || key === 'subtitle')
      .map(([key, value]) => [key, stringifyFactValue(value)]),
  );

  const title = firstString(remainder.title, facts.title) || 'Report';
  const subtitle = firstString(remainder.subtitle, facts.subtitle) || undefined;

  return {
    title,
    subtitle,
    facts,
    narrative,
    table: parseTable(remainder),
    chart: parseChart(remainder),
    sections: parseSections(remainder),
  };
}

export function requireFactKeys(dataset: ReportDataset, keys: string[], type: string): void {
  const missing = keys.filter((key) => {
    if (key === 'title') {
      return !dataset.title.trim();
    }
    if (key === 'columns') {
      return !dataset.table || dataset.table.columns.length === 0;
    }
    if (key === 'rows') {
      return !dataset.table || dataset.table.rows.length === 0;
    }
    if (key === 'facts') {
      return factsToEntries(dataset.facts).length === 0;
    }
    const value = dataset.facts[key];
    return value === undefined || value.trim() === '';
  });
  if (missing.length === 0) {
    return;
  }
  throw new ValidationError('Report is missing required source data', [
    ...missing.map((path) => ({
      path: `data.${path}`,
      message: `Missing required field "${path}" for report type "${type}"`,
      code: 'custom',
    })),
  ]);
}

function parseTable(data: Record<string, unknown>): ReportTable | null {
  if (data.table && typeof data.table === 'object') {
    const parsed = parseWithSchema(reportTableSchema, data.table, { source: 'body', message: 'Invalid report table' });
    return {
      title: parsed.title,
      columns: parsed.columns,
      rows: parsed.rows.map((row) => row.map((cell) => stringifyFactValue(cell))),
    };
  }
  if (Array.isArray(data.columns) && Array.isArray(data.rows)) {
    const parsed = parseWithSchema(
      reportTableSchema,
      { columns: data.columns, rows: data.rows, title: data.tableTitle },
      { source: 'body', message: 'Invalid report table' },
    );
    return {
      title: parsed.title,
      columns: parsed.columns,
      rows: parsed.rows.map((row) => row.map((cell) => stringifyFactValue(cell))),
    };
  }
  return null;
}

function parseChart(data: Record<string, unknown>): ReportChart | null {
  if (!data.chart || typeof data.chart !== 'object') {
    return null;
  }
  const parsed = parseWithSchema(reportChartSchema, data.chart, { source: 'body', message: 'Invalid report chart' });
  const length = Math.min(parsed.labels.length, parsed.values.length);
  return {
    title: parsed.title,
    labels: parsed.labels.slice(0, length),
    values: parsed.values.slice(0, length),
  };
}

function parseSections(data: Record<string, unknown>): ReportSection[] {
  if (!Array.isArray(data.sections)) {
    return [];
  }
  return data.sections.map((section, index) =>
    parseWithSchema(reportSectionSchema, section, {
      source: 'body',
      message: `Invalid report section at index ${index}`,
    }),
  );
}

function flattenFacts(input: Record<string, unknown>): Record<string, unknown> {
  const facts: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (STRUCTURAL_KEYS.has(key) && key !== 'title' && key !== 'subtitle') {
      continue;
    }
    if (value !== undefined && (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null)) {
      facts[key] = value;
    }
  }
  return facts;
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}
