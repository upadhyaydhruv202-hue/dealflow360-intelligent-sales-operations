import { JOB_NAMES } from '../../constants';

export const PDF_GENERATE_JOB = JOB_NAMES.PDF_GENERATE;
export const REPORT_GENERATE_JOB = JOB_NAMES.REPORT_GENERATE;

export interface PdfSection {
  heading?: string;
  lines: string[];
}

export interface GeneratePdfInput {
  title: string;
  sections?: PdfSection[];
  filename?: string;
  async?: boolean;
}

export interface GeneratedPdf {
  key: string;
  size: number;
  contentType: 'application/pdf';
  filename: string;
}
