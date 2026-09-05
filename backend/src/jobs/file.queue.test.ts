import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createJobQueue } from './queue';
import { FileJobQueue } from './file.queue';

describe('FileJobQueue', () => {
  let root = '';

  afterEach(async () => {
    if (root) {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('shares work between two queue instances on disk', async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'hsk-jobs-'));
    const producer = new FileJobQueue({ jobsDir: root, pollMs: 20 });
    const worker = new FileJobQueue({ jobsDir: root, pollMs: 20 });
    const seen: string[] = [];
    worker.process('demo', async (payload) => {
      seen.push(String(payload.value));
    });

    await producer.enqueue('demo', { value: 'hello' });
    await worker.waitForIdle();
    expect(seen).toEqual(['hello']);
    await producer.close();
    await worker.close();
  });

  it('retries a failed file-backed job', async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'hsk-jobs-'));
    const queue = new FileJobQueue({ jobsDir: root, pollMs: 20 });
    let attempts = 0;
    queue.process('demo', async () => {
      attempts += 1;
      if (attempts < 2) {
        throw new Error('temporary');
      }
    });
    await queue.enqueue('demo', { ok: true }, { attempts: 3, backoffMs: 0 });
    await queue.waitForIdle();
    expect(attempts).toBe(2);
    await queue.close();
  });

  it('records status for a completed job', async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'hsk-jobs-'));
    const queue = new FileJobQueue({ jobsDir: root, pollMs: 20 });
    queue.process('demo', async () => undefined);
    const jobId = await queue.enqueue('demo', { ok: true }, { jobId: 'file-demo-1' });
    await queue.waitForIdle();
    await expect(queue.getJob(jobId)).resolves.toMatchObject({
      jobId: 'file-demo-1',
      type: 'demo',
      status: 'completed',
    });
    const duplicate = await queue.enqueue('demo', { ok: true }, { jobId: 'file-demo-1' });
    expect(duplicate).toBe('file-demo-1');
    await queue.close();
  });
});

describe('createJobQueue', () => {
  it('uses a file backend when jobsDir is set', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'hsk-jobs-'));
    const queue = createJobQueue({ jobsDir: root });
    expect(queue.backend).toBe('file');
    await queue.close();
    await rm(root, { recursive: true, force: true });
  });
});
