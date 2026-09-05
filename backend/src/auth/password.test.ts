import { describe, expect, it } from 'vitest';

import { ValidationError } from '../errors';
import { PasswordService } from './password';

const policy = {
  minLength: 8,
  maxLength: 72,
  requireUppercase: false,
  requireLowercase: false,
  requireNumber: false,
  requireSpecial: false,
  bcryptCost: 4,
};

describe('PasswordService', () => {
  const passwords = new PasswordService(policy);

  it('hashes and verifies a password without storing plaintext', async () => {
    const hash = await passwords.hash('correct-horse');
    expect(hash).not.toContain('correct-horse');
    expect(hash.startsWith('$2')).toBe(true);
    expect(await passwords.verify('correct-horse', hash)).toBe(true);
    expect(await passwords.verify('wrong-password', hash)).toBe(false);
  });

  it('enforces the configured password policy without echoing the password', () => {
    const strict = new PasswordService({
      ...policy,
      requireUppercase: true,
      requireNumber: true,
    });

    try {
      strict.validate('short');
      throw new Error('expected ValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError);
      const details = (error as ValidationError).details;
      expect(JSON.stringify(details)).not.toContain('short');
      expect(Array.isArray(details) ? undefined : details.requirements).toEqual(
        expect.arrayContaining(['at least 8 characters', 'an uppercase letter', 'a number']),
      );
    }
  });
});
