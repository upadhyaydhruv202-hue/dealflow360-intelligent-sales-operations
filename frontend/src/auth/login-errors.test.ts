import { describe, expect, it } from 'vitest';

import { ApiClientError } from '../services/api';
import {
  DEMO_LOGIN_RATE_LIMIT_MESSAGE,
  INVALID_CREDENTIALS_MESSAGE,
  LOGIN_RATE_LIMIT_MESSAGE,
  remapLoginError,
  toLoginErrorMessage,
} from './login-errors';

describe('toLoginErrorMessage', () => {
  it('maps invalid credentials without revealing whether the email exists', () => {
    const error = new ApiClientError('nope', 401);
    expect(toLoginErrorMessage(error)).toBe(INVALID_CREDENTIALS_MESSAGE);
  });

  it('keeps a generic rate-limit message outside demo mode', () => {
    const error = new ApiClientError('Too many login attempts. Try again later.', 429);
    expect(toLoginErrorMessage(error)).toBe(LOGIN_RATE_LIMIT_MESSAGE);
    expect(toLoginErrorMessage(error, { demoMode: false })).toBe(LOGIN_RATE_LIMIT_MESSAGE);
  });

  it('uses the demo rate-limit copy only when demo mode is on', () => {
    const error = new ApiClientError('Too many login attempts. Try again later.', 429);
    expect(toLoginErrorMessage(error, { demoMode: true })).toBe(DEMO_LOGIN_RATE_LIMIT_MESSAGE);
  });

  it('remaps stored login errors for the demo page without leaking extra detail', () => {
    expect(remapLoginError(LOGIN_RATE_LIMIT_MESSAGE, true)).toBe(DEMO_LOGIN_RATE_LIMIT_MESSAGE);
    expect(remapLoginError(LOGIN_RATE_LIMIT_MESSAGE, false)).toBe(LOGIN_RATE_LIMIT_MESSAGE);
    expect(remapLoginError('Invalid email or password', false)).toBe(INVALID_CREDENTIALS_MESSAGE);
  });
});
