import { MockAiProvider } from '../../src/integrations/ai/providers/mock.provider';
import { MockEmailProvider } from '../../src/integrations/email/providers/mock.provider';
import { MockSmsProvider } from '../../src/integrations/sms/providers/mock.provider';
import { MemoryFileStore } from '../../src/integrations/storage/storage.memory';
import { MockOtpProvider } from '../../src/otp/providers/mock.provider';
import { MockPushProvider, MockWebhookProvider } from '../../src/notifications/channels';

/**
 * Central re-exports of in-process mocks so CI never needs paid SaaS keys.
 *
 * Prefer these over live Odoo, Gemini, SMTP, SMS, or S3 in unit and HTTP tests.
 */
export { MockAiProvider } from '../../src/integrations/ai/providers/mock.provider';
export {
  aiTestConfig,
  createTestService as createTestAiService,
  silentLogger,
} from '../../src/integrations/ai/ai.test-helpers';
export { MockEmailProvider } from '../../src/integrations/email/providers/mock.provider';
export { MockSmsProvider } from '../../src/integrations/sms/providers/mock.provider';
export { MockOtpProvider } from '../../src/otp/providers/mock.provider';
export { MemoryFileStore } from '../../src/integrations/storage/storage.memory';
export {
  actor as odooActor,
  createTestClient as createTestOdooClient,
  createTestService as createTestOdooService,
} from '../../src/integrations/odoo/odoo.test-helpers';
export { MockPushProvider, MockWebhookProvider } from '../../src/notifications/channels';

export function createExternalMocks() {
  return {
    ai: new MockAiProvider(),
    email: new MockEmailProvider(),
    sms: new MockSmsProvider(),
    otp: new MockOtpProvider(),
    files: new MemoryFileStore(),
    push: new MockPushProvider(),
    webhook: new MockWebhookProvider(),
  };
}

export function createRejectingFetch(message = 'External API unavailable'): typeof fetch {
  return (async () => {
    throw new Error(message);
  }) as typeof fetch;
}
