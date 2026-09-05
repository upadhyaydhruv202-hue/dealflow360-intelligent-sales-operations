import { randomInt } from 'node:crypto';

import type { OtpCodeGenerator } from './otp.types';

export class CryptoOtpGenerator implements OtpCodeGenerator {
  generate(digits: number): string {
    const max = 10 ** digits;
    return String(randomInt(0, max)).padStart(digits, '0');
  }
}

export class FixedOtpGenerator implements OtpCodeGenerator {
  constructor(private readonly code: string) {}

  generate(digits: number): string {
    void digits;
    return this.code;
  }
}
