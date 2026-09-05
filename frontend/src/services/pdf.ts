import { API_PATHS } from '@hackathon/api-contract';

import { apiRequest } from './api';
import type { SignedDownload } from './files';

export interface GeneratePdfInput {
  title: string;
  sections?: Array<{ heading?: string; lines: string[] }>;
  filename?: string;
  async?: boolean;
}

export interface GeneratedPdf {
  key: string;
  size: number;
  contentType: 'application/pdf';
  filename: string;
  download?: SignedDownload;
}

export interface QueuedPdf {
  queued: true;
  key: string;
  filename: string;
  jobId: string;
}

export function generatePdf(input: GeneratePdfInput, token: string) {
  return apiRequest<GeneratedPdf | QueuedPdf>(API_PATHS.pdf.generate, {
    method: 'POST',
    token,
    body: input,
  });
}
