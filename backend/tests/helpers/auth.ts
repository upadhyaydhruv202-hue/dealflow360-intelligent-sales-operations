export { TEST_PASSWORD } from '../factories/constants';

export const AUTH_TEST_ENV = {
  NODE_ENV: 'test',
  APP_NAME: 'DealFlow360',
  JWT_ACCESS_SECRET: 'test-access-secret-not-for-production-32',
  JWT_REFRESH_SECRET: 'test-refresh-secret-not-for-production-32',
  JWT_ACCESS_EXPIRES_IN: '15m',
  JWT_REFRESH_EXPIRES_IN: '7d',
  JWT_ISSUER: 'test-issuer',
  JWT_AUDIENCE: 'test-audience',
  AUTH_BCRYPT_COST: '4',
  AUTH_PASSWORD_MIN_LENGTH: '8',
  AUTH_DEFAULT_ROLE: 'user',
  RATE_LIMIT_ENABLED: 'false',
  FEATURE_PDF: 'true',
} as const;
