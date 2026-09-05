import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, expect, it } from 'vitest';

import { BullMqJobQueue } from '../../src/jobs/bullmq.queue';
import { describeRedis, getTestRedisUrl } from '../helpers/redis';

describeRedis('BullMQ queue integration', () => {
  let queue: BullMqJobQueue;

  beforeAll(() => {
    queue = new BullMqJobQueue({
      redisUrl: getTestRedisUrl(),
      queueName: `hsk-test-${randomUUID()}`,
      defaultAttempts: 3,
      defaultBackoffMs: 10,
      defaultTimeoutMs: 2_000,
    });
  });

  afterAll(async () => {
    await queue.close();
  });

  it('processes a job, retries a transient failure, and ignores duplicate job ids', async () => {
    let attempts = 0;
    queue.process('demo', async () => {
      attempts += 1;
      if (attempts < 2) {
        throw new Error('temporary redis worker failure');
      }
    });

    const jobId = `demo-${randomUUID()}`;
    const first = await queue.enqueue('demo', { n: 1 }, { jobId, attempts: 3, backoffMs: 10 });
    const duplicate = await queue.enqueue('demo', { n: 2 }, { jobId, attempts: 3, backoffMs: 10 });
    expect(first).toBe(jobId);
    expect(duplicate).toBe(jobId);

    await queue.waitForIdle();
    expect(attempts).toBe(2);
    await expect(queue.getJob(jobId)).resolves.toMatchObject({ status: 'completed' });
  }, 20_000);

  it('times out a hanging handler', async () => {
    queue.process('slow', async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    const jobId = await queue.enqueue('slow', { ok: true }, { timeoutMs: 20, attempts: 1, backoffMs: 1 });
    await queue.waitForIdle();
    const status = await queue.getJob(jobId);
    expect(status?.status).toBe('failed');
    expect(status?.error).toEqual(expect.any(String));
  }, 20_000);
});
