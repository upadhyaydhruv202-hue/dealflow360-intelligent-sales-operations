import { describe, expect, it, vi } from 'vitest';

import { loadConfig } from '../config';
import { MockEmailProvider } from '../integrations/email/providers/mock.provider';
import { createEmailService } from '../integrations/email/email.service';
import { createCustomerEmailSender, isCustomerEmailDeliverable } from './customer-email';

describe('customer email adapter', () => {
  it('does not treat demo mock email as delivered', () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      DEMO_MODE: 'true',
      EMAIL_ENABLED: 'false',
    });
    const email = createEmailService({
      config,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
      provider: new MockEmailProvider(),
    });
    expect(isCustomerEmailDeliverable(config, email)).toBe(false);
  });

  it('records not_configured instead of sending through the mock provider', async () => {
    const config = loadConfig({
      NODE_ENV: 'development',
      DEMO_MODE: 'true',
      EMAIL_ENABLED: 'false',
    });
    const provider = new MockEmailProvider();
    const email = createEmailService({
      config,
      logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } as never,
      provider,
    });
    const send = createCustomerEmailSender({ config, email, notifications: null });
    const result = await send({
      to: 'buyer@example.com',
      subject: 'Provisional quotation DF-00001 — awaiting Finance lock',
      text: 'Awaiting Finance lock.',
      idempotencyKey: 'dealflow:quote:q1:prelim_invoice:freeze',
      quoteId: '11111111-1111-4111-8111-111111111111',
      eventType: 'prelim_invoice',
    });
    expect(result.status).toBe('not_configured');
    expect(provider.sent).toHaveLength(0);
  });

  it('allows a real SMTP provider only outside demo/test', () => {
    const config = loadConfig({
      NODE_ENV: 'production',
      DEMO_MODE: 'false',
      EMAIL_ENABLED: 'true',
      EMAIL_PROVIDER: 'smtp',
      SMTP_HOST: 'smtp.example.com',
      EMAIL_FROM: 'billing@example.com',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      STORAGE_SIGNING_SECRET: 'c'.repeat(32),
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/hackathon',
      REDIS_URL: 'redis://localhost:6379',
    });
    expect(
      isCustomerEmailDeliverable(config, { providerName: 'smtp' } as ReturnType<typeof createEmailService>),
    ).toBe(true);
    expect(
      isCustomerEmailDeliverable(config, { providerName: 'mock' } as ReturnType<typeof createEmailService>),
    ).toBe(false);
  });
});
