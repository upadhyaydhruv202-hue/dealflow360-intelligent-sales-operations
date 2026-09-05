import { factsToEntries } from './report.integrity';
import type { PdfBlock, PdfDocumentSpec, ReportDataset, ReportRenderOptions, ReportTemplate } from './report.types';

const AI_DISCLAIMER = 'AI-generated narrative - not verified source data';

export function createBuiltinTemplates(): ReportTemplate[] {
  return [simpleTemplate(), tableTemplate(), summaryTemplate(), documentTemplate()];
}

function simpleTemplate(): ReportTemplate {
  return {
    type: 'simple',
    description: 'Title and text sections. Use for notes, certificates cover pages, and short summaries.',
    requiredFactKeys: ['title'],
    build(dataset, options) {
      const blocks: PdfBlock[] = [{ type: 'heading', text: dataset.title, level: 1 }];
      if (dataset.subtitle) {
        blocks.push({ type: 'paragraph', text: dataset.subtitle });
      }
      for (const section of dataset.sections) {
        if (section.heading) {
          blocks.push({ type: 'heading', text: section.heading, level: 2 });
        }
        for (const line of section.lines) {
          blocks.push({ type: 'paragraph', text: line });
        }
        blocks.push({ type: 'spacer', height: 8 });
      }
      appendNarrative(blocks, dataset);
      return documentSpec(dataset, options, blocks);
    },
  };
}

function tableTemplate(): ReportTemplate {
  return {
    type: 'table',
    description: 'Title plus a data table. Use for exports, line items, and tabular analytics.',
    requiredFactKeys: ['title', 'columns', 'rows'],
    build(dataset, options) {
      const blocks: PdfBlock[] = [{ type: 'heading', text: dataset.title, level: 1 }];
      if (dataset.subtitle) {
        blocks.push({ type: 'paragraph', text: dataset.subtitle });
      }
      appendFacts(blocks, dataset, 'Source data');
      if (dataset.table) {
        blocks.push({
          type: 'table',
          title: dataset.table.title,
          columns: dataset.table.columns,
          rows: dataset.table.rows,
        });
      }
      appendNarrative(blocks, dataset);
      return documentSpec(dataset, options, blocks);
    },
  };
}

function summaryTemplate(): ReportTemplate {
  return {
    type: 'summary',
    description: 'Verified key/value facts with an optional labeled AI narrative. Facts are never overwritten.',
    requiredFactKeys: ['title', 'facts'],
    build(dataset, options) {
      const blocks: PdfBlock[] = [{ type: 'heading', text: dataset.title, level: 1 }];
      if (dataset.subtitle) {
        blocks.push({ type: 'paragraph', text: dataset.subtitle });
      }
      appendFacts(blocks, dataset, 'Verified source data');
      appendNarrative(blocks, dataset);
      return documentSpec(dataset, options, blocks);
    },
  };
}

function documentTemplate(): ReportTemplate {
  return {
    type: 'document',
    description: 'Generic layout: facts, table, optional bar chart, and a labeled AI narrative. Suitable for invoices, certificates, and analytics exports.',
    requiredFactKeys: ['title'],
    build(dataset, options) {
      const blocks: PdfBlock[] = [{ type: 'heading', text: dataset.title, level: 1 }];
      if (dataset.subtitle) {
        blocks.push({ type: 'paragraph', text: dataset.subtitle });
      }
      for (const section of dataset.sections) {
        if (section.heading) {
          blocks.push({ type: 'heading', text: section.heading, level: 2 });
        }
        for (const line of section.lines) {
          blocks.push({ type: 'paragraph', text: line });
        }
      }
      appendFacts(blocks, dataset, 'Verified source data');
      if (dataset.table) {
        blocks.push({
          type: 'table',
          title: dataset.table.title ?? 'Details',
          columns: dataset.table.columns,
          rows: dataset.table.rows,
        });
      }
      if (dataset.chart) {
        blocks.push({
          type: 'chart',
          title: dataset.chart.title ?? 'Chart',
          labels: dataset.chart.labels,
          values: dataset.chart.values,
        });
      }
      appendNarrative(blocks, dataset);
      return documentSpec(dataset, options, blocks);
    },
  };
}

function appendFacts(blocks: PdfBlock[], dataset: ReportDataset, title: string): void {
  const entries = factsToEntries(dataset.facts);
  if (entries.length === 0) {
    return;
  }
  blocks.push({ type: 'facts', title, entries });
}

function appendNarrative(blocks: PdfBlock[], dataset: ReportDataset): void {
  if (!dataset.narrative?.text) {
    return;
  }
  blocks.push({
    type: 'narrative',
    title: 'AI-generated narrative',
    text: dataset.narrative.text,
    disclaimer: AI_DISCLAIMER,
  });
}

function documentSpec(
  dataset: ReportDataset,
  options: ReportRenderOptions,
  blocks: PdfBlock[],
): PdfDocumentSpec {
  return {
    title: dataset.title,
    subtitle: dataset.subtitle,
    metadata: {
      title: dataset.title,
      author: options.metadata?.author,
      subject: options.metadata?.subject ?? dataset.subtitle,
      createdAt: new Date().toISOString(),
      keywords: options.metadata?.keywords,
    },
    header: {
      text: options.header ?? dataset.title,
      timestamp: options.timestamp !== false,
    },
    footer: {
      text: options.footer,
      pageNumbers: options.pageNumbers !== false,
    },
    blocks,
  };
}
