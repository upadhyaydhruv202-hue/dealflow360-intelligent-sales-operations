import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../config';
import { ExternalServiceError } from '../../errors';
import { createJobQueue } from '../../jobs/queue';
import { silentLogger } from '../ai/ai.test-helpers';
import { createEmailService } from './email.service';
import { MockEmailProvider } from './providers/mock.provider';

describe('EmailService', () => {
  it('records mail with the mock provider in demo mode', async () => {
    const provider = new MockEmailProvider();
    const service = createEmailService({
      config: loadConfig({ NODE_ENV: 'test', DEMO_MODE: 'true' }),
      logger: silentLogger,
      provider,
    });

    const result = await service.send({
      to: 'ada@example.com',
      subject: 'Hello',
      text: 'Welcome to the starter kit',
    });

    expect(result).toMatchObject({ subject: 'Hello', provider: 'mock' });
    expect(provider.sent).toHaveLength(1);
  });

  it('skips a duplicate idempotency key', async () => {
    const provider = new MockEmailProvider();
    const service = createEmailService({
      config: loadConfig({ NODE_ENV: 'test', DEMO_MODE: 'true' }),
      logger: silentLogger,
      provider,
    });

    await service.send({
      to: 'ada@example.com',
      subject: 'Hello',
      text: 'Once',
      idempotencyKey: 'welcome-1',
    });
    await service.send({
      to: 'ada@example.com',
      subject: 'Hello',
      text: 'Twice',
      idempotencyKey: 'welcome-1',
    });
    expect(provider.sent).toHaveLength(1);
  });

  it('enqueues email.send when async is true', async () => {
    const provider = new MockEmailProvider();
    const jobs = createJobQueue();
    const service = createEmailService({
      config: loadConfig({ NODE_ENV: 'test', DEMO_MODE: 'true' }),
      logger: silentLogger,
      provider,
      jobs,
    });

    const result = await service.send(
      { to: 'ada@example.com', subject: 'Hello', text: 'Queued' },
      { async: true },
    );

    expect(result).toMatchObject({ queued: true, jobId: expect.any(String) });
    await jobs.waitForIdle();
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]?.subject).toBe('Hello');
  });

  it('rejects send when email is disabled outside demo mode', async () => {
    const service = createEmailService({
      config: loadConfig({ NODE_ENV: 'test', DEMO_MODE: 'false', EMAIL_ENABLED: 'false' }),
      logger: silentLogger,
    });

    await expect(
      service.send({ to: 'ada@example.com', subject: 'Hello', text: 'Nope' }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('renders a reusable template through sendEmail', async () => {
    const provider = new MockEmailProvider();
    const service = createEmailService({
      config: loadConfig({ NODE_ENV: 'test', DEMO_MODE: 'true', APP_NAME: 'Starter Kit' }),
      logger: silentLogger,
      provider,
    });

    const result = await service.sendEmail({
      to: 'ada@example.com',
      template: 'welcome',
      variables: { displayName: 'Ada' },
    });

    expect(result).toMatchObject({ subject: 'Welcome to Starter Kit', provider: 'mock' });
    expect(provider.messages[0]?.text).toContain('Ada');
    expect(provider.messages[0]?.text).not.toContain('{{displayName}}');
  });
});
