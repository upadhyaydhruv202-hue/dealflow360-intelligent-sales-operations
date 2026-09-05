import { API_PATHS } from '@hackathon/api-contract';

import { apiGet, apiRequest } from './api';
import type { SignedDownload } from './files';

export interface ReportTypeInfo {
  type: string;
  title?: string;
  description?: string;
}

export interface GenerateReportInput {
  type: string;
  data: Record<string, unknown>;
  options?: { filename?: string; async?: boolean };
}

export interface GeneratedReport {
  key: string;
  size: number;
  contentType: 'application/pdf';
  filename: string;
  type: string;
  title: string;
  download?: SignedDownload;
}

export interface QueuedReport {
  jobId: string;
  status: string;
}

export function listReportTypes(token: string) {
  return apiGet<{ types: ReportTypeInfo[] }>(API_PATHS.reports.types, token);
}

export function generateReport(input: GenerateReportInput, token: string) {
  return apiRequest<GeneratedReport | QueuedReport>(API_PATHS.reports.generate, {
    method: 'POST',
    token,
    body: input,
  });
}
