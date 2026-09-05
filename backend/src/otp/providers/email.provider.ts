import { ExternalServiceError } from '../../errors';
import type { EmailService } from '../../integrations/email';
import type { OtpDeliveryMessage, OtpDeliveryProvider } from '../otp.types';

export class EmailOtpProvider implements OtpDeliveryProvider {
  readonly name = 'email';

  constructor(private readonly email: EmailService | null) {}

  async send(input: OtpDeliveryMessage): Promise<{ id: string }> {
    if (!this.email?.ready) {
      throw new ExternalServiceError('Email is not configured', { provider: 'email' });
    }

    const sent = await this.email.send({
      to: input.destination,
      template: 'otp',
      variables: {
        code: input.code,
        purpose: input.purpose,
        expiresInMinutes: input.expiresInMinutes,
      },
      idempotencyKey: `otp:${input.challengeId}`,
    });

    return { id: 'queued' in sent ? sent.jobId : sent.id };
  }
}
