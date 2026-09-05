import { describe, expect, it } from 'vitest';

import { AuthorizationError, TimeoutError, ValidationError } from '../errors';
import { isRetryableJobError, UnretryableError } from './retry';

describe('isRetryableJobError', () => {
  it('retries timeouts and unknown failures', () => {
    expect(isRetryableJobError(new TimeoutError('timed out'))).toBe(true);
    expect(isRetryableJobError(new Error('ECONNRESET'))).toBe(true);
  });

  it('does not retry validation, authz, or UnretryableError', () => {
    expect(isRetryableJobError(new ValidationError('bad'))).toBe(false);
    expect(isRetryableJobError(new AuthorizationError())).toBe(false);
    expect(isRetryableJobError(new UnretryableError('do not retry'))).toBe(false);
    expect(isRetryableJobError({ retryable: false })).toBe(false);
  });
});
