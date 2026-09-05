import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { ExternalServiceError, ValidationError } from '../../errors';
import { loadConfig } from '../../config';
import { createJobQueue } from '../../jobs/queue';
import { MemoryDocumentRepository } from '../../../tests/helpers/memory-documents';
import { silentLogger } from '../ai/ai.test-helpers';
import { createAiService } from '../ai/ai.service';
import { MockAiProvider } from '../ai/providers/mock.provider';
import { LocalStorageProvider } from '../storage/providers/local.provider';
import { StorageService } from '../storage/storage.service';
import { createDocumentIntelligenceService } from './document.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';

function textFile(contents = 'Invoice 99 from Acme. Total 40.00 USD.') {
  const buffer = Buffer.from(contents, 'utf8');
  return {
    originalname: 'invoice.txt',
    mimetype: 'text/plain',
    size: buffer.length,
    buffer,
    fieldname: 'file',
  };
}

describe('DocumentIntelligenceService', () => {
  let root = '';

  afterEach(async () => {
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  });

  async function setup(provider = new MockAiProvider()) {
    root = await mkdtemp(path.join(os.tmpdir(), 'hsk-docs-'));
    const config = loadConfig({
      NODE_ENV: 'test',
      AI_ENABLED: 'true',
      AI_PROVIDER: 'mock',
      DEMO_MODE: 'true',
      DOCUMENT_CONFIDENCE_THRESHOLD: '0.7',
      DOCUMENT_ASYNC_THRESHOLD_BYTES: '10485760',
      STORAGE_LOCAL_DIR: root,
    });
    const jobs = createJobQueue();
    const documents = new MemoryDocumentRepository();
    const service = createDocumentIntelligenceService({
      config,
      logger: silentLogger,
      documents,
      storage: new StorageService(new LocalStorageProvider(root)),
      ai: createAiService({ config, logger: silentLogger, provider }),
      jobs,
    });
    return { service, provider, jobs, documents };
  }

  it('extracts structured fields from a valid text document', async () => {
    const { service, provider, documents } = await setup();
    provider.enqueue(
      JSON.stringify({
        fields: { invoiceNumber: '99', total: '40.00', vendor: 'Acme' },
        missingFields: [],
        confidence: 0.92,
        warnings: [],
        requiresReview: false,
      }),
    );

    const result = await service.analyze({
      userId: USER_ID,
      file: textFile(),
      documentType: 'invoice',
      fields: ['invoiceNumber', 'total', 'vendor'],
    });

    expect(result).toMatchObject({
      documentType: 'invoice',
      fields: { invoiceNumber: '99', total: '40.00', vendor: 'Acme' },
      confidence: 0.92,
      requiresReview: false,
      status: 'completed',
    });
    const stored = await documents.findById(result.id);
    expect(stored?.storageKey).toBe(`documents/${USER_ID}/${result.id}/${stored?.storedFilename}`);
    expect(stored?.storageKey).not.toBe('pending');
  });

  it('rejects unsupported files before calling AI', async () => {
    const { service, provider } = await setup();
    await expect(
      service.analyze({
        userId: USER_ID,
        file: {
          originalname: 'notes.gif',
          mimetype: 'image/gif',
          size: 4,
          buffer: Buffer.from('GIF8'),
        },
        documentType: 'generic',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(provider).toBeTruthy();
  });

  it('returns requiresReview for low-confidence output and does not invent missing values', async () => {
    const { service, provider } = await setup();
    provider.enqueue(
      JSON.stringify({
        fields: { invoiceNumber: null, total: 'invented' },
        missingFields: ['total'],
        confidence: 0.2,
        warnings: ['The total was not readable'],
        requiresReview: false,
      }),
    );

    const result = await service.analyze({
      userId: USER_ID,
      file: textFile(),
      documentType: 'invoice',
      fields: ['invoiceNumber', 'total'],
    });

    expect(result.requiresReview).toBe(true);
    expect(result.status).toBe('needs_review');
    expect(result.fields.invoiceNumber).toBeNull();
    expect(result.fields.total).toBeNull();
    expect(result.missingFields).toEqual(expect.arrayContaining(['invoiceNumber', 'total']));
  });

  it('surfaces AI failures after marking the document failed', async () => {
    const { service, provider } = await setup();
    provider.enqueue(new ExternalServiceError('Gemini is unavailable', { provider: 'mock' }));

    await expect(
      service.analyze({
        userId: USER_ID,
        file: textFile(),
        documentType: 'generic',
        fields: ['title'],
      }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('rejects malformed AI output', async () => {
    const { service, provider } = await setup();
    provider.enqueue('not-json');
    provider.enqueue('still-not-json');

    await expect(
      service.analyze({
        userId: USER_ID,
        file: textFile(),
        documentType: 'generic',
        fields: ['title'],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('retries a failed background analysis job', async () => {
    const { service, provider, jobs } = await setup();
    provider.enqueue(new ExternalServiceError('temporary', { provider: 'mock' }));
    provider.enqueue(
      JSON.stringify({
        fields: { title: 'Quarterly report' },
        missingFields: [],
        confidence: 0.88,
        warnings: [],
        requiresReview: false,
      }),
    );

    const queued = await service.analyze({
      userId: USER_ID,
      file: textFile(),
      documentType: 'report',
      fields: ['title'],
      async: true,
    });
    expect(queued.status).toBe('processing');
    await jobs.waitForIdle();

    const result = await service.getResult(queued.id, USER_ID);
    expect(result.status).toBe('completed');
    expect(result.fields.title).toBe('Quarterly report');
  });
});
