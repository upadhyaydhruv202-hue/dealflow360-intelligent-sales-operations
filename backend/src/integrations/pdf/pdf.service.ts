import { randomUUID } from 'node:crypto';

import { JOBS } from '../../constants';
import type { JobQueue } from '../../jobs/queue';
import { parseWithSchema } from '../../schemas/parse';
import type { StorageService } from '../storage/storage.service';
import { renderPdfDocument, simplePdfSpec } from './pdf.renderer';
import { generatePdfInputSchema, pdfGenerateJobPayloadSchema } from './pdf.schemas';
import { PDF_GENERATE_JOB, type GeneratePdfInput, type GeneratedPdf } from './pdf.types';

export interface PdfServiceOptions {
  storage: StorageService;
  jobs?: JobQueue | null;
  onGenerated?: (event: { key: string; filename: string; title: string }) => void | Promise<void>;
}

export class PdfService {
  private readonly storage: StorageService;
  private readonly jobs: JobQueue | null;
  private readonly onGenerated?: (event: { key: string; filename: string; title: string }) => void | Promise<void>;

  constructor(options: PdfServiceOptions) {
    this.storage = options.storage;
    this.jobs = options.jobs ?? null;
    this.onGenerated = options.onGenerated;
  }

  registerJobs(): void {
    this.jobs?.process(PDF_GENERATE_JOB, async (payload) => {
      const job = parseWithSchema(pdfGenerateJobPayloadSchema, payload, {
        source: 'job',
        message: 'Invalid PDF job payload',
      });
      await this.renderAndStore(job, job.storageKey);
    });
  }

  async generate(input: GeneratePdfInput & { userId?: string }): Promise<GeneratedPdf | { queued: true; key: string; filename: string; jobId: string }> {
    const parsed = parseWithSchema(generatePdfInputSchema, input, { source: 'body', message: 'Invalid PDF request' });
    const filename = parsed.filename ?? `${slug(parsed.title)}.pdf`;
    const key = `pdfs/${randomUUID()}/${filename}`;

    if (parsed.async && this.jobs) {
      const jobId = await this.jobs.enqueue(
        PDF_GENERATE_JOB,
        { ...parsed, storageKey: key },
        {
          attempts: JOBS.DEFAULT_ATTEMPTS,
          backoffMs: JOBS.DEFAULT_BACKOFF_MS,
          timeoutMs: JOBS.DEFAULT_TIMEOUT_MS,
          createdBy: input.userId,
        },
      );
      return { queued: true, key, filename, jobId };
    }

    return this.renderAndStore(parsed, key);
  }

  private async renderAndStore(input: GeneratePdfInput, key: string): Promise<GeneratedPdf> {
    const filename = key.split('/').pop() ?? 'document.pdf';
    const body = await renderPdfDocument(simplePdfSpec(input));
    const stored = await this.storage.put({
      key,
      body,
      contentType: 'application/pdf',
    });

    const generated: GeneratedPdf = {
      key: stored.key,
      size: stored.size,
      contentType: 'application/pdf',
      filename,
    };

    await this.onGenerated?.({ key: generated.key, filename, title: input.title });
    return generated;
  }
}

export function createPdfService(options: PdfServiceOptions): PdfService {
  const service = new PdfService(options);
  service.registerJobs();
  return service;
}

function slug(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return cleaned || 'document';
}
