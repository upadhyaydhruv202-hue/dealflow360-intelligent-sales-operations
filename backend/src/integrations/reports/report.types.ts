import { JOB_NAMES, REPORT_TYPES, type ReportTypeName } from '../../constants';
import type { PdfBlock, PdfDocumentSpec, PdfHeaderFooter, PdfMetadata } from '../pdf/pdf.renderer';

export const REPORT_GENERATE_JOB = JOB_NAMES.REPORT_GENERATE;

export { REPORT_TYPES };
export type { ReportTypeName };

export interface ReportNarrative {
  text: string;
  source: 'ai';
  generatedAt?: string;
}

export interface ReportTable {
  title?: string;
  columns: string[];
  rows: string[][];
}

export interface ReportChart {
  title?: string;
  labels: string[];
  values: number[];
}

export interface ReportSection {
  heading?: string;
  lines: string[];
}

export interface ReportDataset {
  title: string;
  subtitle?: string;
  facts: Record<string, string>;
  narrative: ReportNarrative | null;
  table: ReportTable | null;
  chart: ReportChart | null;
  sections: ReportSection[];
}

export interface ReportRenderOptions {
  filename?: string;
  header?: string;
  footer?: string;
  pageNumbers?: boolean;
  timestamp?: boolean;
  metadata?: PdfMetadata;
  async?: boolean;
  notify?: boolean;
  email?: string;
}

export interface GenerateReportInput {
  type: string;
  data: Record<string, unknown>;
  options?: ReportRenderOptions;
  userId?: string;
}

export interface GeneratedReport {
  key: string;
  size: number;
  contentType: 'application/pdf';
  filename: string;
  type: string;
  title: string;
}

export interface QueuedReport {
  jobId: string;
  status: 'queued';
  key: string;
  filename: string;
  type: string;
}

export type GenerateReportResult = GeneratedReport | QueuedReport;

export interface ReportTemplate {
  type: string;
  description: string;
  requiredFactKeys: string[];
  build(dataset: ReportDataset, options: ReportRenderOptions): PdfDocumentSpec;
}

export interface ReportDataProviderContext {
  type: string;
  data: Record<string, unknown>;
  userId?: string;
}

export type ReportDataProvider = (context: ReportDataProviderContext) => Promise<ReportDataset> | ReportDataset;

export interface ReportTypeInfo {
  type: string;
  description: string;
  requiredFactKeys: string[];
  hasDataProvider: boolean;
}

export type { PdfBlock, PdfDocumentSpec, PdfHeaderFooter, PdfMetadata };
