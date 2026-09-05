import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../config';
import { ExternalServiceError } from '../../errors';
import { createJobQueue } from '../../jobs/queue';
import { createSmsService } from './sms.service';
import { MockSmsProvider } from './providers/mock.provider';

describe('SmsService', () => {
  it('records messages with the mock provider', async () => {
    const provider = new MockSmsProvider();
    const service = createSmsService({
      config: loadConfig({ NODE_ENV: 'test', DEMO_MODE: 'true' }),
      provider,
    });

    const result = await service.send({ to: '+15551234567', text: 'Hello' });
    expect(result).toMatchObject({ to: '+15551234567', provider: 'mock' });
    expect(provider.sent).toHaveLength(1);
  });

  it('skips a duplicate idempotency key', async () => {
    const provider = new MockSmsProvider();
    const service = createSmsService({
      config: loadConfig({ NODE_ENV: 'test', DEMO_MODE: 'true' }),
      provider,
    });

    await service.send({ to: '+15551234567', text: 'Once', idempotencyKey: 'otp-1' });
    await service.send({ to: '+15551234567', text: 'Twice', idempotencyKey: 'otp-1' });
    expect(provider.sent).toHaveLength(1);
  });

  it('enqueues sms.send when async is true', async () => {
    const provider = new MockSmsProvider();
    const jobs = createJobQueue();
    const service = createSmsService({
      config: loadConfig({ NODE_ENV: 'test', DEMO_MODE: 'true' }),
      provider,
      jobs,
    });

    const result = await service.send({ to: '+15551234567', text: 'Queued' }, { async: true });
    expect(result).toMatchObject({ queued: true, jobId: expect.any(String) });
    await jobs.waitForIdle();
    expect(provider.sent).toHaveLength(1);
  });

  it('rejects send when SMS is disabled outside demo mode', async () => {
    const service = createSmsService({
      config: loadConfig({ NODE_ENV: 'test', DEMO_MODE: 'false', SMS_ENABLED: 'false', FEATURE_SMS: 'false' }),
    });

    await expect(service.send({ to: '+15551234567', text: 'Nope' })).rejects.toBeInstanceOf(ExternalServiceError);
  });
});
