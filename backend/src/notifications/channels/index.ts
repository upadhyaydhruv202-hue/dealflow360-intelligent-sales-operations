import type { EmailService } from '../../integrations/email';
import type { SmsService } from '../../integrations/sms';
import type { NotificationRepository } from '../../repositories/notification.repository';
import { shouldMockExternalIntegrations } from '../../features';
import type { AppConfig } from '../../types/config';
import { EmailChannelAdapter } from './email.adapter';
import { InAppChannelAdapter } from './in-app.adapter';
import { PushChannelAdapter, MockPushProvider } from './push.adapter';
import { ChannelAdapterRegistry } from './registry';
import { SmsChannelAdapter } from './sms.adapter';
import { HttpWebhookProvider, MockWebhookProvider, WebhookChannelAdapter } from './webhook.adapter';

export function createDefaultChannelRegistry(options: {
  notifications: NotificationRepository;
  email?: EmailService | null;
  sms?: SmsService | null;
  config?: AppConfig;
  fetchImpl?: typeof fetch;
  pushProvider?: MockPushProvider;
  webhookProvider?: MockWebhookProvider;
}): ChannelAdapterRegistry {
  const demoOrTest = !options.config || shouldMockExternalIntegrations(options.config);
  const registry = new ChannelAdapterRegistry();
  registry.register(new InAppChannelAdapter(options.notifications));
  registry.register(new EmailChannelAdapter(options.email ?? null));
  registry.register(new SmsChannelAdapter(options.sms ?? null));
  registry.register(new PushChannelAdapter(options.pushProvider ?? new MockPushProvider()));
  registry.register(
    new WebhookChannelAdapter(
      options.webhookProvider ??
        (demoOrTest
          ? new MockWebhookProvider()
          : new HttpWebhookProvider({ fetchImpl: options.fetchImpl })),
    ),
  );
  return registry;
}

export { ChannelAdapterRegistry } from './registry';
export { EmailChannelAdapter } from './email.adapter';
export { InAppChannelAdapter } from './in-app.adapter';
export { SmsChannelAdapter } from './sms.adapter';
export { PushChannelAdapter, MockPushProvider } from './push.adapter';
export {
  WebhookChannelAdapter,
  MockWebhookProvider,
  HttpWebhookProvider,
} from './webhook.adapter';
