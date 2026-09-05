export const OTP_PURPOSES = ['login', 'verification', 'password-reset', 'generic'] as const;
export type OtpPurpose = (typeof OTP_PURPOSES)[number];

export const OTP_CHANNELS = ['email', 'sms'] as const;
export type OtpChannel = (typeof OTP_CHANNELS)[number];

export const OTP_DELIVERY_PROVIDERS = ['email', 'sms', 'mock'] as const;
export type OtpDeliveryProviderName = (typeof OTP_DELIVERY_PROVIDERS)[number];

export interface OtpRecord {
  id: string;
  purpose: OtpPurpose;
  destination: string;
  channel: OtpChannel;
  codeHash: string;
  digits: number;
  attempts: number;
  maxAttempts: number;
  expiresAt: number;
  consumedAt: number | null;
  createdAt: number;
  lastSentAt: number;
}

export interface OtpRequestInput {
  destination: string;
  channel?: OtpChannel;
  purpose?: OtpPurpose;
}

export interface OtpVerifyInput {
  destination: string;
  purpose?: OtpPurpose;
  code: string;
}

export interface OtpRequestResult {
  destination: string;
  channel: OtpChannel;
  purpose: OtpPurpose;
  expiresInSeconds: number;
  resendAvailableInSeconds: number;
  digits: number;
}

export interface OtpVerifyResult {
  verified: true;
  destination: string;
  purpose: OtpPurpose;
}

export type OtpVerifyFailureReason = 'not_found' | 'expired' | 'consumed' | 'max_attempts' | 'mismatch';

export interface OtpCodeGenerator {
  generate(digits: number): string;
}

export interface OtpDeliveryMessage {
  destination: string;
  purpose: OtpPurpose;
  channel: OtpChannel;
  code: string;
  expiresInMinutes: number;
  challengeId: string;
}

export interface OtpDeliveryProvider {
  readonly name: OtpDeliveryProviderName;
  send(input: OtpDeliveryMessage): Promise<{ id: string }>;
}
