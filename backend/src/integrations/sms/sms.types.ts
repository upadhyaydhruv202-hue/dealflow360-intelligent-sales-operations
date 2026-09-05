import { JOB_NAMES } from '../../constants';

export const SMS_SEND_JOB = JOB_NAMES.SMS_SEND;

export interface SendSmsInput {
  to: string;
  text: string;
  idempotencyKey?: string;
}

export interface SentSms {
  id: string;
  to: string;
  provider: 'mock' | 'http';
}

export interface SmsProvider {
  readonly name: 'mock' | 'http';
  send(input: SendSmsInput): Promise<SentSms>;
}
