import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';

import { AuthenticationError } from '../errors';
import { TokenService } from './jwt';

const tokens = new TokenService({
  accessSecret: 'test-access-secret-not-for-production-32',
  refreshSecret: 'test-refresh-secret-not-for-production-32',
  accessExpiresIn: '15m',
  refreshExpiresIn: '7d',
  issuer: 'test-issuer',
  audience: 'test-audience',
});

describe('TokenService', () => {
  it('signs and verifies access tokens with minimal claims', () => {
    const token = tokens.signAccess({ userId: 'user-1', role: 'admin' });
    const claims = tokens.verifyAccess(token);

    expect(claims.sub).toBe('user-1');
    expect(claims.type).toBe('access');
    expect(claims.role).toBe('admin');
    expect(claims.iss).toBe('test-issuer');
    expect(claims.aud).toBe('test-audience');
    expect(claims.tvn).toBe(0);
    expect(claims).not.toHaveProperty('email');
    expect(claims).not.toHaveProperty('password');
  });

  it('rejects a refresh token used as an access token', () => {
    const refresh = tokens.signRefresh({ userId: 'user-1', role: 'user' });
    expect(() => tokens.verifyAccess(refresh)).toThrow(AuthenticationError);
    expect(() => tokens.verifyAccess(refresh)).toThrow(/Invalid or malformed token|Invalid token type/);
  });

  it('rejects expired tokens', () => {
    const expired = jwt.sign(
      { type: 'access', role: 'member', exp: Math.floor(Date.now() / 1000) - 60 },
      'test-access-secret-not-for-production-32',
      {
        algorithm: 'HS256',
        subject: 'user-1',
        issuer: 'test-issuer',
        audience: 'test-audience',
        jwtid: 'expired-jti',
      },
    );

    expect(() => tokens.verifyAccess(expired)).toThrow(AuthenticationError);
    expect(() => tokens.verifyAccess(expired)).toThrow(/Token has expired/);
  });

  it('rejects malformed tokens', () => {
    expect(() => tokens.verifyAccess('not-a-jwt')).toThrow(/Invalid or malformed token/);
  });
});
