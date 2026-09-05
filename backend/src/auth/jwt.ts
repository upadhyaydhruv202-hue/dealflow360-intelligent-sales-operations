import { randomUUID } from 'node:crypto';

import jwt, { type JwtPayload, type SignOptions, type VerifyOptions } from 'jsonwebtoken';

import { ERROR_CODES } from '../constants';
import { AppError, AuthenticationError } from '../errors';
import { parseDurationToSeconds } from '../lib/duration';
import type { AppConfig } from '../types/config';
import type { AccessTokenClaims, RefreshTokenClaims, TokenType } from './types';

export interface TokenServiceOptions {
  accessSecret: string;
  refreshSecret: string;
  accessExpiresIn: string;
  refreshExpiresIn: string;
  issuer: string;
  audience: string;
}

export function createTokenServiceFromConfig(config: AppConfig): TokenService {
  return new TokenService({
    accessSecret: requireJwtSecret(config.jwt.accessSecret, 'JWT_ACCESS_SECRET'),
    refreshSecret: requireJwtSecret(config.jwt.refreshSecret, 'JWT_REFRESH_SECRET'),
    accessExpiresIn: config.jwt.accessExpiresIn,
    refreshExpiresIn: config.jwt.refreshExpiresIn,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
}

export function requireJwtSecret(secret: string | undefined, name: string): string {
  if (!secret) {
    throw new AppError(ERROR_CODES.INTERNAL_ERROR, `${name} is not configured`, 500);
  }

  return secret;
}

export class TokenService {
  readonly accessExpiresInSeconds: number;
  readonly refreshExpiresInSeconds: number;

  constructor(private readonly options: TokenServiceOptions) {
    this.accessExpiresInSeconds = parseDurationToSeconds(options.accessExpiresIn);
    this.refreshExpiresInSeconds = parseDurationToSeconds(options.refreshExpiresIn);
  }

  signAccess(input: { userId: string; role: string; jti?: string; tvn?: number }): string {
    return this.sign('access', input.userId, input.role, input.jti ?? randomUUID(), input.tvn ?? 0);
  }

  signRefresh(input: { userId: string; role: string; jti?: string }): string {
    return this.sign('refresh', input.userId, input.role, input.jti ?? randomUUID());
  }

  verifyAccess(token: string): AccessTokenClaims {
    const claims = this.verify(token, 'access');
    return claims as AccessTokenClaims;
  }

  verifyRefresh(token: string): RefreshTokenClaims {
    const claims = this.verify(token, 'refresh');
    return claims as RefreshTokenClaims;
  }

  private sign(type: TokenType, userId: string, role: string, jti: string, tvn = 0): string {
    const secret = type === 'access' ? this.options.accessSecret : this.options.refreshSecret;
    const expiresIn = type === 'access' ? this.options.accessExpiresIn : this.options.refreshExpiresIn;

    const signOptions: SignOptions = {
      algorithm: 'HS256',
      subject: userId,
      expiresIn: expiresIn as SignOptions['expiresIn'],
      issuer: this.options.issuer,
      audience: this.options.audience,
      jwtid: jti,
    };

    const payload = type === 'access' ? { type, role, tvn } : { type, role };
    return jwt.sign(payload, secret, signOptions);
  }

  private verify(token: string, expectedType: TokenType): AccessTokenClaims | RefreshTokenClaims {
    const secret = expectedType === 'access' ? this.options.accessSecret : this.options.refreshSecret;
    const verifyOptions: VerifyOptions = {
      algorithms: ['HS256'],
      issuer: this.options.issuer,
      audience: this.options.audience,
    };

    let payload: JwtPayload;
    try {
      const decoded = jwt.verify(token, secret, verifyOptions);
      if (typeof decoded === 'string' || !decoded) {
        throw new AuthenticationError('Invalid or malformed token');
      }
      payload = decoded;
    } catch (error) {
      throw mapJwtError(error);
    }

    if (payload.type !== expectedType) {
      throw new AuthenticationError('Invalid token type');
    }

    if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
      throw new AuthenticationError('Invalid or malformed token');
    }

    if (typeof payload.jti !== 'string' || payload.jti.length === 0) {
      throw new AuthenticationError('Invalid or malformed token');
    }

    if (typeof payload.role !== 'string' || payload.role.length === 0) {
      throw new AuthenticationError('Invalid or malformed token');
    }

    if (typeof payload.iss !== 'string' || typeof payload.aud !== 'string') {
      throw new AuthenticationError('Invalid or malformed token');
    }

    if (typeof payload.iat !== 'number' || typeof payload.exp !== 'number') {
      throw new AuthenticationError('Invalid or malformed token');
    }

    if (expectedType === 'access') {
      return {
        sub: payload.sub,
        type: 'access',
        role: payload.role,
        jti: payload.jti,
        iss: payload.iss,
        aud: Array.isArray(payload.aud) ? payload.aud[0] : payload.aud,
        iat: payload.iat,
        exp: payload.exp,
        tvn: readTokenVersion(payload.tvn),
      };
    }

    return {
      sub: payload.sub,
      type: 'refresh',
      role: payload.role,
      jti: payload.jti,
      iss: payload.iss,
      aud: Array.isArray(payload.aud) ? payload.aud[0] : payload.aud,
      iat: payload.iat,
      exp: payload.exp,
    };
  }
}

function readTokenVersion(value: unknown): number {
  if (value === undefined) {
    return 0;
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new AuthenticationError('Invalid or malformed token');
  }
  return value;
}

function mapJwtError(error: unknown): AuthenticationError {
  if (error instanceof AuthenticationError) {
    return error;
  }

  if (error instanceof jwt.TokenExpiredError) {
    return new AuthenticationError('Token has expired');
  }

  if (error instanceof jwt.NotBeforeError) {
    return new AuthenticationError('Invalid or malformed token');
  }

  if (error instanceof jwt.JsonWebTokenError) {
    return new AuthenticationError('Invalid or malformed token');
  }

  return new AuthenticationError('Invalid or malformed token');
}
