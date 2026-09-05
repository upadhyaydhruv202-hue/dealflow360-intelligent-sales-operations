import { ApiClientError, getApiErrorMessage } from '../services/api';

export const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.';
export const LOGIN_RATE_LIMIT_MESSAGE = 'Too many login attempts. Try again later.';
export const DEMO_LOGIN_RATE_LIMIT_MESSAGE =
  'Too many attempts for this demo account. Please wait a few minutes or use another seeded demo account.';

export function toLoginErrorMessage(error: unknown, options: { demoMode?: boolean } = {}): string {
  if (error instanceof ApiClientError) {
    if (error.statusCode === 429) {
      return options.demoMode === true ? DEMO_LOGIN_RATE_LIMIT_MESSAGE : LOGIN_RATE_LIMIT_MESSAGE;
    }
    if (error.statusCode === 401) {
      return INVALID_CREDENTIALS_MESSAGE;
    }
  }

  const fallback = getApiErrorMessage(error, 'Sign in failed');
  if (/too many login|too many attempts/i.test(fallback)) {
    return options.demoMode === true ? DEMO_LOGIN_RATE_LIMIT_MESSAGE : LOGIN_RATE_LIMIT_MESSAGE;
  }
  if (/invalid email or password/i.test(fallback)) {
    return INVALID_CREDENTIALS_MESSAGE;
  }
  return fallback;
}

export function remapLoginError(message: string | undefined, demoMode: boolean): string | undefined {
  if (!message) {
    return undefined;
  }
  if (/too many login|too many attempts/i.test(message)) {
    return demoMode ? DEMO_LOGIN_RATE_LIMIT_MESSAGE : LOGIN_RATE_LIMIT_MESSAGE;
  }
  if (/invalid email or password/i.test(message)) {
    return INVALID_CREDENTIALS_MESSAGE;
  }
  return message;
}
