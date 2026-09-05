import { randomUUID } from 'node:crypto';

import { AUDIT_ACTIONS, REPORTS } from '../../constants';
import { ExternalServiceError, ValidationError } from '../../errors';
import type { AuditService } from '../../audit/audit.service';
import type { EmailService } from '../email';
import type { JobQueue } from '../../jobs/queue';
import { parseWithSchema } from '../../schemas/parse';
import type { NotificationService } from '../../notifications';
import { renderPdfDocument, type PdfDocumentSpec } from '../pdf/pdf.renderer';
import { assertStorageKey } from '../storage/storage.keys';
import type { StorageService } from '../storage/storage.service';
import { createDefaultReportRegistry, type ReportRegistry } from './report.registry';
import { generateReportInputSchema, reportGenerateJobPayloadSchema } from './report.schemas';
import {
  REPORT_GENERATE_JOB,
  type GenerateReportInput,
  type GenerateReportResult,
  type GeneratedReport,
  type QueuedReport,
  type ReportRenderOptions,
} from './report.types';

export interface ReportGeneratedEvent {
  key: string;
  filename: string;
  title: string;
  type: string;
  userId?: string;
}

export interface ReportServiceOptions {
  storage: StorageService;
  jobs?: JobQueue | null;
  notifications?: NotificationService | null;
  email?: EmailService | null;
  registry?: ReportRegistry;
  render?: (spec: PdfDocumentSpec) => Promise<Buffer>;
  appName?: string;
  onGenerated?: (event: ReportGeneratedEvent) => void | Promise<void>;
  audit?: AuditService | null;
}

export class ReportService {
  private readonly storage: StorageService;
  private readonly jobs: JobQueue | null;
  private readonly notifications?: NotificationService | null;
  private readonly email?: EmailService | null;
  private readonly registry: ReportRegistry;
  private readonly render: (spec: PdfDocumentSpec) => Promise<Buffer>;
  private readonly appName: string;
  private readonly onGenerated?: (event: ReportGeneratedEvent) => void | Promise<void>;
  private readonly audit: AuditService | null;

  constructor(options: ReportServiceOptions) {
    this.storage = options.storage;
    this.jobs = options.jobs ?? null;
    this.notifications = options.notifications;
    this.email = options.email;
    this.registry = options.registry ?? createDefaultReportRegistry();
    this.render = options.render ?? renderPdfDocument;
    this.appName = options.appName ?? 'Hackathon Starter Kit';
    this.onGenerated = options.onGenerated;
    this.audit = options.audit ?? null;
  }

  getRegistry(): ReportRegistry {
    return this.registry;
  }

  listTypes() {
    return this.registry.list();
  }

  registerJobs(): void {
    this.jobs?.process(REPORT_GENERATE_JOB, async (payload) => {
      const job = parseWithSchema(reportGenerateJobPayloadSchema, payload, {
        source: 'job',
        message: 'Invalid report job payload',
      });
      await this.renderStoreAndNotify(
        {
          type: job.type,
          data: job.data,
          options: job.options,
          userId: job.userId,
        },
        assertReportStorageKey(job.storageKey),
      );
    });
  }

  async generateReport(input: GenerateReportInput): Promise<GenerateReportResult> {
    const parsed = parseWithSchema(generateReportInputSchema, input, {
      source: 'body',
      message: 'Invalid report request',
    });
    const options = parsed.options ?? {};
    const template = this.registry.getTemplate(parsed.type);
    const dataset = await this.registry.resolveDataset(parsed.type, parsed.data, input.userId);
    const filename = options.filename ?? `${slug(dataset.title || template.type)}.pdf`;
    const key = `reports/${randomUUID()}/${filename}`;
    const request: GenerateReportInput = {
      type: parsed.type,
      data: parsed.data,
      options,
      userId: input.userId,
    };

    const useAsync = options.async !== false && Boolean(this.jobs);
    if (useAsync && this.jobs) {
      const jobId = await this.jobs.enqueue(
        REPORT_GENERATE_JOB,
        { ...parsed, storageKey: key, userId: input.userId },
        {
          attempts: REPORTS.JOB_ATTEMPTS,
          backoffMs: REPORTS.JOB_BACKOFF_MS,
          timeoutMs: REPORTS.JOB_TIMEOUT_MS,
        },
      );
      const queued: QueuedReport = { jobId, status: 'queued', key, filename, type: parsed.type };
      return queued;
    }

    return this.renderStoreAndNotify(request, key, dataset);
  }

  private async renderStoreAndNotify(
    input: GenerateReportInput,
    key: string,
    resolved?: Awaited<ReturnType<ReportRegistry['resolveDataset']>>,
  ): Promise<GeneratedReport> {
    const options = input.options ?? {};
    const dataset = resolved ?? (await this.registry.resolveDataset(input.type, input.data, input.userId));
    const template = this.registry.getTemplate(input.type);
    const spec = template.build(dataset, options);
    const filename = key.split('/').pop() ?? `${slug(dataset.title)}.pdf`;
    const storageKey = assertReportStorageKey(key);

    let body: Buffer;
    try {
      body = await this.render(spec);
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      throw new ExternalServiceError('PDF renderer failed', {
        provider: 'pdf',
        cause: error instanceof Error ? error.message : 'unknown',
      });
    }

    let stored;
    try {
      stored = await this.storage.put({
        key: storageKey,
        body,
        contentType: 'application/pdf',
      });
    } catch (error) {
      throw new ExternalServiceError('Report storage failed', {
        provider: 'storage',
        cause: error instanceof Error ? error.message : 'unknown',
      });
    }

    const generated: GeneratedReport = {
      key: stored.key,
      size: stored.size,
      contentType: 'application/pdf',
      filename,
      type: input.type,
      title: dataset.title,
    };

    await this.afterGenerated(generated, options, input.userId, body);
    return generated;
  }

  private async afterGenerated(
    generated: GeneratedReport,
    options: ReportRenderOptions,
    userId: string | undefined,
    body: Buffer,
  ): Promise<void> {
    await this.onGenerated?.({
      key: generated.key,
      filename: generated.filename,
      title: generated.title,
      type: generated.type,
      userId,
    });
    await this.audit?.record({
      actorId: userId,
      action: AUDIT_ACTIONS.REPORT_GENERATED,
      resource: 'report',
      resourceId: generated.key,
      metadata: { type: generated.type, filename: generated.filename, title: generated.title },
      status: 'succeeded',
    });

    const download = await this.safeDownloadUrl(generated.key);

    if (options.notify && userId && this.notifications) {
      try {
        await this.notifications.notify({
          userId,
          type: 'success',
          title: 'Report ready',
          body: `Your report "${generated.title}" is ready.`,
          category: 'reports',
          idempotencyKey: `report-ready:${generated.key}`,
        });
      } catch {
        // Report is already stored; delivery failure must not fail the job.
      }
    }

    if (options.email && this.email?.ready) {
      try {
        await this.email.sendEmail({
          to: options.email,
          template: 'report-ready',
          variables: {
            displayName: 'there',
            title: generated.title,
            downloadUrl: download?.url ?? generated.key,
            appName: this.appName,
          },
          attachments: this.shouldAttach(body)
            ? [
                {
                  filename: generated.filename,
                  content: body.toString('base64'),
                  contentType: 'application/pdf',
                },
              ]
            : undefined,
          idempotencyKey: `report-email:${generated.key}`,
        });
      } catch {
        // Report is already stored; delivery failure must not fail the job.
      }
    }
  }

  private async safeDownloadUrl(key: string) {
    try {
      return await this.storage.signDownload(key, REPORTS.SIGNED_URL_SECONDS);
    } catch {
      return undefined;
    }
  }

  private shouldAttach(body: Buffer): boolean {
    return body.length > 0 && body.length <= REPORTS.EMAIL_ATTACH_MAX_BYTES;
  }
}

export function createReportService(options: ReportServiceOptions): ReportService {
  const service = new ReportService(options);
  service.registerJobs();
  return service;
}

export function isQueuedReport(result: GenerateReportResult): result is QueuedReport {
  return 'status' in result && result.status === 'queued';
}

function slug(value: string): string {
  const cleaned = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  return cleaned || 'report';
}

function assertReportStorageKey(key: string): string {
  const safe = assertStorageKey(key);
  if (!safe.startsWith('reports/')) {
    throw new ValidationError('Invalid report storage key', [
      { path: 'storageKey', message: 'Report files must be stored under reports/', code: 'custom' },
    ]);
  }
  return safe;
}
