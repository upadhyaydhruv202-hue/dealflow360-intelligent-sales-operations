import { inflateSync } from 'node:zlib';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { NotificationService } from '../../notifications';
import { ExternalServiceError, ValidationError } from '../../errors';
import { createJobQueue } from '../../jobs/queue';
import { LocalStorageProvider } from '../storage/providers/local.provider';
import { StorageService } from '../storage/storage.service';
import type { StorageProvider, StoragePutInput, StoredObject } from '../storage/storage.types';
import type { EmailService } from '../email';
import type { PdfDocumentSpec } from '../pdf/pdf.renderer';
import { splitReportData } from './report.integrity';
import { ReportRegistry } from './report.registry';
import { createReportService, type ReportServiceOptions } from './report.service';
import { REPORT_GENERATE_JOB } from './report.types';

function pdfText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const chunks: string[] = [];
  const streamPattern = /stream\r?\n([\s\S]*?)endstream/g;
  let match = streamPattern.exec(raw);
  while (match) {
    const payload = Buffer.from(match[1] ?? '', 'latin1');
    try {
      chunks.push(inflateSync(payload).toString('latin1'));
    } catch {
      try {
        chunks.push(inflateSync(payload.subarray(2)).toString('latin1'));
      } catch {
        chunks.push(payload.toString('latin1'));
      }
    }
    match = streamPattern.exec(raw);
  }
  return decodePdfHex(chunks.join('\n'));
}

function decodePdfHex(source: string): string {
  return source.replace(/<([0-9A-Fa-f]+)>/g, (_match, hex: string) => {
    const pairs = hex.match(/.{1,2}/g) ?? [];
    return pairs.map((pair) => String.fromCharCode(Number.parseInt(pair, 16))).join('');
  });
}

async function setup(overrides: Partial<ReportServiceOptions> = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hsk-report-'));
  const storage = new StorageService(new LocalStorageProvider(root), {
    appUrl: 'http://localhost:5000',
    secret: 'test-secret',
  });
  const jobs = createJobQueue();
  const service = createReportService({
    storage,
    jobs,
    ...overrides,
  });
  return { root, storage, jobs, service };
}

describe('ReportService', () => {
  const temps: string[] = [];

  afterEach(async () => {
    while (temps.length > 0) {
      const root = temps.pop();
      if (root) {
        await rm(root, { recursive: true, force: true });
      }
    }
  });

  async function create(overrides: Parameters<typeof setup>[0] = {}) {
    const ctx = await setup(overrides);
    temps.push(ctx.root);
    return ctx;
  }

  it('renders a simple report and stores a PDF', async () => {
    const { service, storage } = await create();
    const result = await service.generateReport({
      type: 'simple',
      data: {
        title: 'Weekly notes',
        sections: [{ heading: 'Status', lines: ['All systems operational.'] }],
      },
      options: { async: false },
    });

    expect(result).not.toHaveProperty('status');
    if ('status' in result) {
      return;
    }
    expect(result.type).toBe('simple');
    expect(result.contentType).toBe('application/pdf');
    expect(result.key.startsWith('reports/')).toBe(true);
    const bytes = await storage.get(result.key);
    expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdfText(bytes)).toContain('Weekly notes');
  });

  it('renders a table report', async () => {
    const { service, storage } = await create();
    const result = await service.generateReport({
      type: 'table',
      data: {
        title: 'Export',
        columns: ['Item', 'Qty'],
        rows: [
          ['Widget', 3],
          ['Gadget', 1],
        ],
      },
      options: { async: false, header: 'Acme', footer: 'Confidential' },
    });

    if ('status' in result) {
      throw new Error('expected a stored report');
    }
    const bytes = await storage.get(result.key);
    const text = pdfText(bytes);
    expect(text).toContain('Export');
    expect(text).toContain('Widget');
    expect(text).toContain('Acme');
    expect(text).toContain('Confidential');
  });

  it('rejects missing table data', async () => {
    const { service } = await create();
    await expect(
      service.generateReport({
        type: 'table',
        data: { title: 'Empty export' },
        options: { async: false },
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('keeps AI narrative out of verified facts', async () => {
    const split = splitReportData({
      title: 'Revenue',
      facts: { total: '100' },
      narrative: 'Revenue was 999 according to the model.',
    });
    expect(split.remainder.facts).toEqual({ total: '100' });
    expect(split.narrative?.text).toContain('999');
    expect(JSON.stringify(split.remainder)).not.toContain('999');

    const { service, storage } = await create();
    const result = await service.generateReport({
      type: 'summary',
      data: {
        title: 'Revenue',
        facts: { total: '100' },
        narrative: 'Revenue was 999 according to the model.',
      },
      options: { async: false },
    });
    if ('status' in result) {
      throw new Error('expected a stored report');
    }
    const text = pdfText(await storage.get(result.key));
    expect(text).toContain('100');
    expect(text).toContain('999');
    expect(text).toContain('AI-generated');
    expect(text).toContain('not verified source data');
  });

  it('surfaces renderer failure', async () => {
    const { service } = await create({
      render: async () => {
        throw new Error('draw failed');
      },
    });
    await expect(
      service.generateReport({
        type: 'simple',
        data: { title: 'Broken' },
        options: { async: false },
      }),
    ).rejects.toSatisfy(
      (error) => error instanceof ExternalServiceError && (error.details as { provider?: string }).provider === 'pdf',
    );
  });

  it('surfaces storage failure', async () => {
    const failing: StorageProvider = {
      name: 'fail',
      async put(_input: StoragePutInput): Promise<StoredObject> {
        throw new Error('disk full');
      },
      async get() {
        return Buffer.from([]);
      },
      async delete() {},
    };
    const storage = new StorageService(failing);
    const service = createReportService({ storage });
    await expect(
      service.generateReport({
        type: 'simple',
        data: { title: 'Unstored' },
        options: { async: false },
      }),
    ).rejects.toSatisfy(
      (error) =>
        error instanceof ExternalServiceError && (error.details as { provider?: string }).provider === 'storage',
    );
  });

  it('records background job failure after renderer errors', async () => {
    const { service, jobs } = await create({
      render: async () => {
        throw new Error('draw failed');
      },
    });
    const result = await service.generateReport({
      type: 'simple',
      data: { title: 'Queued fail' },
      options: { async: true },
    });
    expect(result).toMatchObject({ status: 'queued', jobId: expect.any(String) });
    await jobs.waitForIdle();
    if (!('jobId' in result)) {
      throw new Error('expected a job id');
    }
    const status = await jobs.getJob(result.jobId);
    expect(status?.status).toBe('failed');
  });

  it('rejects a report job whose storage key leaves the reports prefix', async () => {
    const { jobs } = await create();
    const jobId = await jobs.enqueue(REPORT_GENERATE_JOB, {
      type: 'simple',
      data: { title: 'Escape' },
      storageKey: 'pdfs/escape.pdf',
    });
    await jobs.waitForIdle();
    const status = await jobs.getJob(jobId);
    expect(status?.status).toBe('failed');
  });

  it('enqueues report.generate and completes it', async () => {
    const { service, jobs, storage } = await create();
    const result = await service.generateReport({
      type: 'simple',
      data: { title: 'Queued ok', sections: [{ lines: ['Later'] }] },
    });
    expect(result).toMatchObject({ status: 'queued' });
    await jobs.waitForIdle();
    if (!('key' in result)) {
      throw new Error('expected a storage key');
    }
    const bytes = await storage.get(result.key);
    expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('notifies and emails when a report is ready', async () => {
    const notified: unknown[] = [];
    const emailed: unknown[] = [];
    const { service } = await create({
      notifications: {
        notify: async (input: unknown) => {
          notified.push(input);
          return { queued: false };
        },
      } as unknown as NotificationService,
      email: {
        ready: true,
        sendEmail: async (input: unknown) => {
          emailed.push(input);
          return { id: '1', to: ['ops@example.com'], subject: 'ready', provider: 'mock' };
        },
      } as unknown as EmailService,
    });

    await service.generateReport({
      type: 'simple',
      data: { title: 'Notify me' },
      options: { async: false, notify: true, email: 'ops@example.com' },
      userId: '11111111-1111-4111-8111-111111111111',
    });

    expect(notified).toHaveLength(1);
    expect(emailed).toHaveLength(1);
    expect(JSON.stringify(emailed[0])).toContain('report-ready');
  });

  it('lets a hackathon register a report type and data provider', async () => {
    const registry = new ReportRegistry();
    registry.registerTemplate({
      type: 'status-card',
      description: 'Generic status snapshot',
      requiredFactKeys: ['title', 'status'],
      build(dataset) {
        return {
          title: dataset.title,
          header: { timestamp: true },
          footer: { pageNumbers: true },
          blocks: [
            { type: 'heading', text: dataset.title, level: 1 },
            { type: 'facts', entries: [{ key: 'status', value: dataset.facts.status }] },
          ],
        } satisfies PdfDocumentSpec;
      },
    });
    registry.registerDataProvider('status-card', ({ data }) => ({
      title: String(data.title ?? 'Status'),
      facts: { status: 'verified-ok' },
      narrative: null,
      table: null,
      chart: null,
      sections: [],
    }));

    const { service, storage } = await create({ registry });
    const result = await service.generateReport({
      type: 'status-card',
      data: { title: 'Probe', status: 'from-request-ignored' },
      options: { async: false },
    });
    if ('status' in result) {
      throw new Error('expected a stored report');
    }
    const text = pdfText(await storage.get(result.key));
    expect(text).toContain('verified-ok');
    expect(text).not.toContain('from-request-ignored');
  });
});
