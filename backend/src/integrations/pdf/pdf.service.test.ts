import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createJobQueue } from '../../jobs/queue';
import { LocalStorageProvider } from '../storage/providers/local.provider';
import { StorageService } from '../storage/storage.service';
import { createPdfService } from './pdf.service';

describe('PdfService', () => {
  let root = '';

  afterEach(async () => {
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('renders a PDF and stores it', async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'hsk-pdf-'));
    const storage = new StorageService(new LocalStorageProvider(root), {
      appUrl: 'http://localhost:5000',
      secret: 'test-secret',
    });
    const pdf = createPdfService({ storage });
    const result = await pdf.generate({
      title: 'Incident report',
      sections: [{ heading: 'Summary', lines: ['All systems operational.'] }],
    });

    expect(result).not.toHaveProperty('queued');
    if ('queued' in result) {
      return;
    }
    expect(result.contentType).toBe('application/pdf');
    expect(result.key.startsWith('pdfs/')).toBe(true);
    const bytes = await storage.get(result.key);
    expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('invokes onGenerated after a successful render', async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'hsk-pdf-'));
    const storage = new StorageService(new LocalStorageProvider(root), {
      appUrl: 'http://localhost:5000',
      secret: 'test-secret',
    });
    const events: Array<{ key: string; filename: string; title: string }> = [];
    const pdf = createPdfService({
      storage,
      onGenerated: (event) => {
        events.push(event);
      },
    });
    const result = await pdf.generate({
      title: 'Invoice pack',
      filename: 'pack.pdf',
      sections: [{ lines: ['Done'] }],
    });

    expect('queued' in result).toBe(false);
    if ('queued' in result) {
      return;
    }
    expect(events).toEqual([
      { key: result.key, filename: 'pack.pdf', title: 'Invoice pack' },
    ]);
  });

  it('enqueues pdf.generate when async is true', async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'hsk-pdf-'));
    const storage = new StorageService(new LocalStorageProvider(root), {
      appUrl: 'http://localhost:5000',
      secret: 'test-secret',
    });
    const jobs = createJobQueue();
    const pdf = createPdfService({ storage, jobs });
    const result = await pdf.generate({
      title: 'Queued report',
      sections: [{ lines: ['Later'] }],
      async: true,
    });

    expect(result).toMatchObject({ queued: true, jobId: expect.any(String) });
    await jobs.waitForIdle();
    if (!('key' in result)) {
      throw new Error('expected a storage key');
    }
    const bytes = await storage.get(result.key);
    expect(bytes.subarray(0, 4).toString()).toBe('%PDF');
  });
});
