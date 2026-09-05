import {
  AuthenticationError,
  ExternalServiceError,
  RateLimitError,
  ValidationError,
} from '../errors';
import type { EmailService } from '../integrations/email';
import type { SmsService } from '../integrations/sms';
import { MemoryKvStore } from '../lib/kv';
import type { KvStore } from '../lib/kv';
import { parseWithSchema } from '../schemas/parse';
import { isDemoMode } from '../features';
import type { AppConfig } from '../types/config';
import type { AppLogger } from '../utils/logger';
import { CryptoOtpGenerator } from './otp.generator';
import { hashOtp, normalizeDestination } from './otp.hash';
import { OtpRepository } from './otp.repository';
import { otpRequestBodySchema, otpVerifyBodySchema } from './otp.schemas';
import type {
  OtpChannel,
  OtpCodeGenerator,
  OtpDeliveryProvider,
  OtpPurpose,
  OtpRequestInput,
  OtpRequestResult,
  OtpVerifyInput,
  OtpVerifyResult,
} from './otp.types';
import { evaluateOtpRecord } from './otp.validator';
import { EmailOtpProvider } from './providers/email.provider';
import { MockOtpProvider } from './providers/mock.provider';
import { SmsOtpProvider } from './providers/sms.provider';

export interface OtpServiceOptions {
  config: AppConfig;
  logger: AppLogger;
  kv?: KvStore;
  repository?: OtpRepository;
  generator?: OtpCodeGenerator;
  email?: EmailService | null;
  sms?: SmsService | null;
  providers?: Partial<Record<'email' | 'sms' | 'mock', OtpDeliveryProvider>>;
  now?: () => number;
}

export class OtpService {
  private readonly repository: OtpRepository;
  private readonly generator: OtpCodeGenerator;
  private readonly now: () => number;
  private readonly hashSecret: string;
  private readonly digits: number;
  private readonly ttlMs: number;
  private readonly maxAttempts: number;
  private readonly resendCooldownMs: number;
  private readonly forceMock: boolean;
  private readonly emailProvider: OtpDeliveryProvider;
  private readonly smsProvider: OtpDeliveryProvider;
  private readonly mockProvider: OtpDeliveryProvider;
  private readonly logger: AppLogger;

  constructor(options: OtpServiceOptions) {
    this.now = options.now ?? Date.now;
    this.repository = options.repository ?? new OtpRepository(options.kv ?? new MemoryKvStore(), this.now);
    this.generator = options.generator ?? new CryptoOtpGenerator();
    this.hashSecret = options.config.otp.hashSecret;
    this.digits = options.config.otp.digits;
    this.ttlMs = options.config.otp.ttlMs;
    this.maxAttempts = options.config.otp.maxAttempts;
    this.resendCooldownMs = options.config.otp.resendCooldownMs;
    this.forceMock = options.config.otp.provider === 'mock' || isDemoMode(options.config);
    this.logger = options.logger;
    this.mockProvider = options.providers?.mock ?? new MockOtpProvider();
    this.emailProvider = options.providers?.email ?? new EmailOtpProvider(options.email ?? null);
    this.smsProvider = options.providers?.sms ?? new SmsOtpProvider(options.sms ?? null);
  }

  async request(input: OtpRequestInput): Promise<OtpRequestResult> {
    const parsed = parseWithSchema(otpRequestBodySchema, input, {
      source: 'body',
      message: 'Invalid OTP request',
    });
    const purpose = parsed.purpose;
    const channel = parsed.channel;
    const destination = normalizeDestination(parsed.destination);
    const existing = await this.repository.get(purpose, destination);

    if (existing && !existing.consumedAt) {
      const waitMs = existing.lastSentAt + this.resendCooldownMs - this.now();
      if (waitMs > 0) {
        throw new RateLimitError('Wait before requesting another code', {
          retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)),
        });
      }
    }

    const code = this.generator.generate(this.digits);
    if (!new RegExp(`^\\d{${this.digits}}$`).test(code)) {
      throw new ValidationError('OTP generator produced an invalid code');
    }

    const record = await this.repository.create({
      purpose,
      destination,
      channel,
      codeHash: hashOtp(this.hashSecret, purpose, destination, code),
      digits: this.digits,
      maxAttempts: this.maxAttempts,
      expiresAt: this.now() + this.ttlMs,
      lastSentAt: this.now(),
    });

    try {
      await this.deliver({
        destination,
        purpose,
        channel,
        code,
        expiresInMinutes: Math.max(1, Math.round(this.ttlMs / 60_000)),
        challengeId: record.id,
      });
    } catch (error) {
      await this.repository.delete(purpose, destination);
      this.logger.warn({ err: error, purpose, channel }, 'OTP delivery failed');
      if (error instanceof ExternalServiceError) {
        throw error;
      }
      throw new ExternalServiceError('Failed to deliver OTP', { provider: channel });
    }

    this.logger.info({ purpose, channel, destination }, 'OTP requested');

    return this.toRequestResult(purpose, channel, destination);
  }

  describeRequest(input: OtpRequestInput): OtpRequestResult {
    const parsed = parseWithSchema(otpRequestBodySchema, input, {
      source: 'body',
      message: 'Invalid OTP request',
    });
    return this.toRequestResult(parsed.purpose, parsed.channel, normalizeDestination(parsed.destination));
  }

  async verify(input: OtpVerifyInput): Promise<OtpVerifyResult> {
    const parsed = parseWithSchema(otpVerifyBodySchema, input, {
      source: 'body',
      message: 'Invalid OTP verification',
    });
    const purpose = parsed.purpose;
    const destination = normalizeDestination(parsed.destination);
    const record = await this.repository.get(purpose, destination);
    const candidateHash = hashOtp(this.hashSecret, purpose, destination, parsed.code);
    const evaluation = evaluateOtpRecord(record, candidateHash, this.now());

    if (!evaluation.ok || !evaluation.record) {
      if (evaluation.reason === 'mismatch' && evaluation.record) {
        await this.repository.incrementAttempts(evaluation.record);
      }
      throw this.verifyError(evaluation.reason);
    }

    const consumed = await this.repository.consume(evaluation.record);
    if (!consumed) {
      throw this.verifyError('consumed');
    }
    this.logger.info({ purpose, destination }, 'OTP verified');

    return {
      verified: true,
      destination,
      purpose,
    };
  }

  private async deliver(input: {
    destination: string;
    purpose: OtpPurpose;
    channel: OtpChannel;
    code: string;
    expiresInMinutes: number;
    challengeId: string;
  }): Promise<void> {
    const provider = this.providerFor(input.channel);
    await provider.send(input);
  }

  private providerFor(channel: OtpChannel): OtpDeliveryProvider {
    if (this.forceMock) {
      return this.mockProvider;
    }
    return channel === 'sms' ? this.smsProvider : this.emailProvider;
  }

  private toRequestResult(purpose: OtpPurpose, channel: OtpChannel, destination: string): OtpRequestResult {
    return {
      destination,
      channel,
      purpose,
      expiresInSeconds: Math.ceil(this.ttlMs / 1000),
      resendAvailableInSeconds: Math.ceil(this.resendCooldownMs / 1000),
      digits: this.digits,
    };
  }

  private verifyError(reason: string | undefined): Error {
    switch (reason) {
      case 'expired':
        return new AuthenticationError('OTP has expired');
      case 'consumed':
        return new AuthenticationError('OTP has already been used');
      case 'max_attempts':
        return new AuthenticationError('Too many incorrect OTP attempts');
      default:
        return new AuthenticationError('Invalid or expired OTP');
    }
  }
}

export function createOtpService(options: OtpServiceOptions): OtpService {
  return new OtpService(options);
}
