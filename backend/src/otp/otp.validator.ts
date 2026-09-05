import type { OtpRecord, OtpVerifyFailureReason } from './otp.types';
import { otpHashesEqual } from './otp.hash';

export interface OtpEvaluation {
  ok: boolean;
  reason?: OtpVerifyFailureReason;
  record?: OtpRecord;
}

export function evaluateOtpRecord(
  record: OtpRecord | null,
  candidateHash: string,
  now: number,
): OtpEvaluation {
  if (!record) {
    return { ok: false, reason: 'not_found' };
  }

  if (record.consumedAt) {
    return { ok: false, reason: 'consumed', record };
  }

  if (record.expiresAt <= now) {
    return { ok: false, reason: 'expired', record };
  }

  if (record.attempts >= record.maxAttempts) {
    return { ok: false, reason: 'max_attempts', record };
  }

  if (!otpHashesEqual(record.codeHash, candidateHash)) {
    return { ok: false, reason: 'mismatch', record };
  }

  return { ok: true, record };
}
