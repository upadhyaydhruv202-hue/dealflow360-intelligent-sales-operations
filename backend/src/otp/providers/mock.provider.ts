import { randomUUID } from 'node:crypto';

import type { OtpDeliveryMessage, OtpDeliveryProvider } from '../otp.types';

export class MockOtpProvider implements OtpDeliveryProvider {
  readonly name = 'mock';
  readonly deliveries: Array<{ id: string; destination: string; purpose: string; channel: string }> = [];
  failNext = false;

  async send(input: OtpDeliveryMessage): Promise<{ id: string }> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('OTP delivery provider failed');
    }

    const id = randomUUID();
    this.deliveries.push({
      id,
      destination: input.destination,
      purpose: input.purpose,
      channel: input.channel,
    });
    return { id };
  }
}
