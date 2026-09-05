import bcrypt from 'bcryptjs';

import { ValidationError } from '../errors';
import type { AppConfig } from '../types/config';

export type PasswordPolicy = AppConfig['auth']['password'];

const SPECIAL_CHAR = /[^A-Za-z0-9]/;

export class PasswordService {
  private dummyHashPromise: Promise<string> | undefined;

  constructor(private readonly policy: PasswordPolicy) {}

  validate(password: string): void {
    const requirements: string[] = [];

    if (password.length < this.policy.minLength) {
      requirements.push(`at least ${this.policy.minLength} characters`);
    }

    if (password.length > this.policy.maxLength) {
      requirements.push(`at most ${this.policy.maxLength} characters`);
    }

    if (this.policy.requireUppercase && !/[A-Z]/.test(password)) {
      requirements.push('an uppercase letter');
    }

    if (this.policy.requireLowercase && !/[a-z]/.test(password)) {
      requirements.push('a lowercase letter');
    }

    if (this.policy.requireNumber && !/\d/.test(password)) {
      requirements.push('a number');
    }

    if (this.policy.requireSpecial && !SPECIAL_CHAR.test(password)) {
      requirements.push('a special character');
    }

    if (requirements.length > 0) {
      throw new ValidationError('Password does not meet policy requirements', { requirements });
    }
  }

  async hash(password: string): Promise<string> {
    this.validate(password);
    return bcrypt.hash(password, this.policy.bcryptCost);
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, passwordHash);
    } catch {
      return false;
    }
  }

  async verifyUnknown(password: string): Promise<void> {
    const dummyHash = await this.getDummyHash();
    await this.verify(password, dummyHash);
  }

  private getDummyHash(): Promise<string> {
    if (!this.dummyHashPromise) {
      this.dummyHashPromise = bcrypt.hash('timing-safe-dummy', this.policy.bcryptCost);
    }

    return this.dummyHashPromise;
  }
}
