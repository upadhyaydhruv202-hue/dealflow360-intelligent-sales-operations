import { describe, expect, it } from 'vitest';

import { sanitizeErrorDetails, sanitizeErrorMessage } from './sanitize';

describe('error sanitization', () => {
  it('redacts secrets and filesystem paths in messages', () => {
    expect(sanitizeErrorMessage('failed at D:\\Projects\\hackathon-starter-kit\\src\\app.ts')).toContain(
      '[path]',
    );
    expect(sanitizeErrorMessage('failed at D:\\Projects\\hackathon-starter-kit\\src\\app.ts')).not.toContain(
      'hackathon-starter-kit',
    );
    expect(sanitizeErrorMessage('api_key=abcd1234')).toBe('[Redacted]');
  });

  it('redacts sensitive keys in details objects and arrays', () => {
    expect(
      sanitizeErrorDetails({
        password: 'hunter2',
        apiKey: 'secret',
        field: 'email',
        nested: { token: 'abc', path: '/Users/gigabyte/.env', otp: '123456' },
      }),
    ).toEqual({
      password: '[Redacted]',
      apiKey: '[Redacted]',
      field: 'email',
      nested: { token: '[Redacted]', path: '[path]', otp: '[Redacted]' },
    });

    expect(
      sanitizeErrorDetails([{ path: 'body.email', message: 'Invalid email', code: 'invalid_string' }]),
    ).toEqual([{ path: 'body.email', message: 'Invalid email', code: 'invalid_string' }]);
  });
});
