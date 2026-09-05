import { describe, expect, it } from 'vitest';

import { TimeoutError, ValidationError } from '../errors';
import { createJobQueue, InMemoryJobQueue } from './queue';
import { JOB_NAMES } from '../constants';
import { MemoryKvStore } from '../lib/kv';
import { registerCleanupJob } from './cleanup';

describe('InMemoryJobQueue', () => {
  it('retries a failed handler and then succeeds', async () => {
    const queue = new InMemoryJobQueue();
    let attempts = 0;
    queue.process('demo', async () => {
      attempts += 1;
      if (attempts < 2) {
        throw new Error('temporary');
      }
    });

    const jobId = await queue.enqueue('demo', { documentId: '1' }, { attempts: 3, backoffMs: 0 });
    await queue.waitForIdle();
    expect(attempts).toBe(2);
    const status = await queue.getJob(jobId);
    expect(status?.status).toBe('completed');
    expect(status?.attempts).toBe(2);
    expect(status?.progress).toBe(100);
  });

  it('does not retry validation errors', async () => {
    const queue = new InMemoryJobQueue();
    let attempts = 0;
    queue.process('demo', async () => {
      attempts += 1;
      throw new ValidationError('bad payload');
    });

    const jobId = await queue.enqueue('demo', { ok: true }, { attempts: 5, backoffMs: 0 });
    await queue.waitForIdle();
    expect(attempts).toBe(1);
    await expect(queue.getJob(jobId)).resolves.toMatchObject({ status: 'failed' });
  });

  it('times out a hanging handler', async () => {
    const queue = new InMemoryJobQueue();
    queue.process('demo', async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    const jobId = await queue.enqueue('demo', { ok: true }, { timeoutMs: 5, attempts: 1 });
    await queue.waitForIdle();
    const status = await queue.getJob(jobId);
    expect(status?.status).toBe('failed');
    expect(status?.error).toMatch(/timed out/i);
  });

  it('does not duplicate a job with the same jobId', async () => {
    const queue = new InMemoryJobQueue();
    let runs = 0;
    queue.process('demo', async () => {
      runs += 1;
    });

    const first = await queue.enqueue('demo', { n: 1 }, { jobId: 'demo-1' });
    const second = await queue.enqueue('demo', { n: 2 }, { jobId: 'demo-1' });
    await queue.waitForIdle();
    expect(first).toBe('demo-1');
    expect(second).toBe('demo-1');
    expect(runs).toBe(1);
  });

  it('attaches a request id to the payload', async () => {
    const queue = new InMemoryJobQueue();
    let seen: string | undefined;
    queue.process('demo', async (payload) => {
      seen = payload.requestId;
    });
    await queue.enqueue('demo', { hello: 'world' });
    await queue.waitForIdle();
    expect(seen).toEqual(expect.any(String));
  });

  it('stores createdBy from payload.userId for status reads', async () => {
    const queue = new InMemoryJobQueue();
    queue.process('demo', async () => undefined);
    const jobId = await queue.enqueue('demo', { userId: 'user-42' });
    await queue.waitForIdle();
    await expect(queue.getJob(jobId)).resolves.toMatchObject({ createdBy: 'user-42' });
    await queue.close();
  });

  it('closes after in-flight work finishes and rejects new enqueue', async () => {
    const queue = new InMemoryJobQueue();
    queue.process('demo', async () => undefined);
    await queue.enqueue('demo', { ok: true });
    await queue.close();
    await expect(queue.enqueue('demo', { later: true })).rejects.toMatchObject({
      message: 'Job queue is closed',
    });
  });

  it('records progress updates', async () => {
    const queue = new InMemoryJobQueue();
    queue.process('demo', async (_payload, job) => {
      await job.updateProgress(40);
    });
    const jobId = await queue.enqueue('demo', { ok: true });
    await queue.waitForIdle();
    await expect(queue.getJob(jobId)).resolves.toMatchObject({ progress: 100, status: 'completed' });
  });

  it('notifies an optional status listener without breaking the job', async () => {
    const seen: string[] = [];
    const queue = new InMemoryJobQueue(undefined, {
      onStatus: (record) => {
        seen.push(record.status);
      },
    });
    queue.process('demo', async () => undefined);
    await queue.enqueue('demo', { ok: true });
    await queue.waitForIdle();
    expect(seen).toEqual(expect.arrayContaining(['queued', 'processing', 'completed']));
  });
});

describe('createJobQueue', () => {
  it('uses an in-memory backend when Redis is not configured', () => {
    const queue = createJobQueue();
    expect(queue).toBeInstanceOf(InMemoryJobQueue);
    expect(queue.backend).toBe('memory');
  });
});

describe('cleanup job', () => {
  it('prunes expired kv entries and old statuses', async () => {
    const queue = new InMemoryJobQueue();
    const kv = new MemoryKvStore();
    registerCleanupJob(queue, kv);
    await kv.set('tmp:old', '1', 1);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const jobId = await queue.enqueue(JOB_NAMES.CLEANUP, { maxAgeMs: 1 });
    await queue.waitForIdle();
    await expect(queue.getJob(jobId)).resolves.toMatchObject({ status: 'completed' });
    expect(await kv.get('tmp:old')).toBeNull();
  });
});

describe('timeout error type', () => {
  it('is retryable so a later attempt can succeed', async () => {
    const queue = new InMemoryJobQueue();
    let attempts = 0;
    queue.process('demo', async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new TimeoutError('slow', { provider: 'jobs' });
      }
    });
    await queue.enqueue('demo', { ok: true }, { attempts: 2, backoffMs: 0 });
    await queue.waitForIdle();
    expect(attempts).toBe(2);
  });
});
