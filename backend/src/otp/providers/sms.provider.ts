import { ExternalServiceError } from '../../errors';
import type { SmsService } from '../../integrations/sms';
import type { OtpDeliveryMessage, OtpDeliveryProvider } from '../otp.types';

export class SmsOtpProvider implements OtpDeliveryProvider {
  readonly name = 'sms';

  constructor(private readonly sms: SmsService | null) {}

  async send(input: OtpDeliveryMessage): Promise<{ id: string }> {
    if (!this.sms?.ready) {
      throw new ExternalServiceError('SMS is not configured', { provider: 'sms' });
    }

    const sent = await this.sms.send({
      to: input.destination,
      text: `Your verification code is ${input.code}. It expires in ${input.expiresInMinutes} minutes. Do not share this code.`,
      idempotencyKey: `otp:${input.challengeId}`,
    });

    return { id: 'queued' in sent ? sent.jobId : sent.id };
  }
}
