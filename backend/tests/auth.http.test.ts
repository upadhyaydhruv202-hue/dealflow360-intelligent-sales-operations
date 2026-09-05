import jwt from 'jsonwebtoken';
import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { ERROR_CODES } from '../src/constants';
import { createDatabaseClient, type DatabaseClient } from '../src/lib/database';
import { AUTH_TEST_ENV } from './helpers/auth';
import {
  describeDatabase,
  disconnectTestPrisma,
  getTestRepositories,
  resetDatabase,
} from './helpers/database';

const logger = pino({ level: 'silent' });
const VALID_PASSWORD = 'correct-horse';

function authConfig(overrides: Record<string, string> = {}) {
  return loadConfig({
    ...AUTH_TEST_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    ...overrides,
  });
}

describe('Auth HTTP (no database)', () => {
  const app = createApp({
    config: loadConfig(AUTH_TEST_ENV),
    logger,
  }).app;

  it('rejects a protected endpoint without a bearer token', async () => {
    const response = await request(app).get('/api/v1/auth/me');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHENTICATION_ERROR);
    expect(response.body.error.message).toBe('Authentication required');
  });

  it('rejects a malformed bearer token', async () => {
    const response = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer not-a-jwt');
    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Invalid or malformed token');
  });

  it('rejects an expired access token', async () => {
    const expired = jwt.sign(
      { type: 'access', role: 'user', exp: Math.floor(Date.now() / 1000) - 60 },
      AUTH_TEST_ENV.JWT_ACCESS_SECRET,
      {
        algorithm: 'HS256',
        subject: '00000000-0000-0000-0000-000000000001',
        issuer: AUTH_TEST_ENV.JWT_ISSUER,
        audience: AUTH_TEST_ENV.JWT_AUDIENCE,
        jwtid: 'expired-jti',
      },
    );

    const response = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${expired}`);
    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Token has expired');
  });
});

describeDatabase('Auth HTTP', () => {
  let database!: DatabaseClient;
  let app!: ReturnType<typeof createApp>['app'];

  beforeAll(() => {
    database = createDatabaseClient({
      url: process.env.DATABASE_URL as string,
      poolMax: 5,
      poolTimeoutSeconds: 10,
    });
    app = createApp({
      config: authConfig(),
      logger,
      database,
    }).app;
  });

  beforeEach(async () => {
    await resetDatabase();
    await getTestRepositories().roles.create({
      name: 'user',
      description: 'Standard application access',
    });
  });

  afterAll(async () => {
    await database.close();
    await disconnectTestPrisma();
  });

  it('registers a user and returns tokens without a password hash', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'Ada@Example.com',
      password: VALID_PASSWORD,
      displayName: 'Ada Lovelace',
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe('ada@example.com');
    expect(response.body.data.user.roles).toEqual(['user']);
    expect(response.body.data.user.permissions).toEqual([]);
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
    expect(response.body.data.tokens.tokenType).toBe('Bearer');
    expect(response.body.data.tokens.accessToken).toEqual(expect.any(String));
    expect(response.body.data.tokens.refreshToken).toEqual(expect.any(String));
  });

  it('rejects duplicate registration', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'same@example.com',
      password: VALID_PASSWORD,
      displayName: 'Same',
    });

    const response = await request(app).post('/api/v1/auth/register').send({
      email: 'same@example.com',
      password: VALID_PASSWORD,
      displayName: 'Same',
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe(ERROR_CODES.CONFLICT);
    expect(response.body.error.message).toBe('An account with this email already exists');
  });

  it('logs in with valid credentials', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'login@example.com',
      password: VALID_PASSWORD,
      displayName: 'Login User',
    });

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'login@example.com',
      password: VALID_PASSWORD,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe('login@example.com');
    expect(response.body.data.tokens.accessToken).toEqual(expect.any(String));
  });

  it('does not reveal whether an email exists on invalid password', async () => {
    await request(app).post('/api/v1/auth/register').send({
      email: 'known@example.com',
      password: VALID_PASSWORD,
      displayName: 'Known',
    });

    const unknown = await request(app).post('/api/v1/auth/login').send({
      email: 'missing@example.com',
      password: VALID_PASSWORD,
    });
    const wrong = await request(app).post('/api/v1/auth/login').send({
      email: 'known@example.com',
      password: 'wrong-password',
    });

    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error.message).toBe('Invalid email or password');
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('returns the current user from a protected endpoint', async () => {
    const registered = await request(app).post('/api/v1/auth/register').send({
      email: 'me@example.com',
      password: VALID_PASSWORD,
      displayName: 'Me',
    });

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registered.body.data.tokens.accessToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.user.email).toBe('me@example.com');
    expect(response.body.data.user).not.toHaveProperty('passwordHash');
  });

  it('rotates refresh tokens and rejects the previous token', async () => {
    const registered = await request(app).post('/api/v1/auth/register').send({
      email: 'refresh@example.com',
      password: VALID_PASSWORD,
      displayName: 'Refresh',
    });
    const original = registered.body.data.tokens.refreshToken as string;

    const rotated = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: original });
    expect(rotated.status).toBe(200);
    expect(rotated.body.data.tokens.refreshToken).not.toBe(original);

    const reuse = await request(app).post('/api/v1/auth/refresh').send({ refreshToken: original });
    expect(reuse.status).toBe(401);
    expect(reuse.body.error.message).toBe('Refresh token has been revoked');

    const afterReuse = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: rotated.body.data.tokens.refreshToken });
    expect(afterReuse.status).toBe(401);
  });

  it('revokes a refresh family on logout', async () => {
    const registered = await request(app).post('/api/v1/auth/register').send({
      email: 'logout@example.com',
      password: VALID_PASSWORD,
      displayName: 'Logout',
    });
    const refreshToken = registered.body.data.tokens.refreshToken as string;
    const accessToken = registered.body.data.tokens.accessToken as string;

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });
    expect(logout.status).toBe(200);
    expect(logout.body.data.revoked).toBe(true);

    const refresh = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(refresh.status).toBe(401);

    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);
    expect(me.status).toBe(401);
    expect(me.body.error.message).toBe('Token has been revoked');
  });

  it('rejects login for a disabled account after a correct password', async () => {
    const registered = await request(app).post('/api/v1/auth/register').send({
      email: 'disabled@example.com',
      password: VALID_PASSWORD,
      displayName: 'Disabled',
    });

    await getTestRepositories().users.update(registered.body.data.user.id, { status: 'disabled' });

    const response = await request(app).post('/api/v1/auth/login').send({
      email: 'disabled@example.com',
      password: VALID_PASSWORD,
    });

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
    expect(response.body.error.message).toBe('Account is disabled');
  });

  it('rate limits repeated login attempts', async () => {
    const limitedApp = createApp({
      config: authConfig({
        RATE_LIMIT_ENABLED: 'true',
        AUTH_LOGIN_RATE_LIMIT_MAX: '1',
        AUTH_LOGIN_IP_RATE_LIMIT_MAX: '100',
        AUTH_LOGIN_RATE_LIMIT_WINDOW: '15m',
      }),
      logger,
      database,
    }).app;

    await request(limitedApp).post('/api/v1/auth/register').send({
      email: 'limited@example.com',
      password: VALID_PASSWORD,
      displayName: 'Limited',
    });

    const first = await request(limitedApp).post('/api/v1/auth/login').send({
      email: 'limited@example.com',
      password: 'wrong-password',
    });
    const second = await request(limitedApp).post('/api/v1/auth/login').send({
      email: 'limited@example.com',
      password: 'wrong-password',
    });

    expect(first.status).toBe(401);
    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe(ERROR_CODES.RATE_LIMIT);
  });

  it('does not rate-limit seeded demo accounts when DEMO_MODE is on', async () => {
    const demoApp = createApp({
      config: authConfig({
        DEMO_MODE: 'true',
        RATE_LIMIT_ENABLED: 'true',
        AUTH_LOGIN_RATE_LIMIT_MAX: '1',
        AUTH_LOGIN_IP_RATE_LIMIT_MAX: '1',
        AUTH_LOGIN_RATE_LIMIT_WINDOW: '15m',
      }),
      logger,
      database,
    }).app;

    await request(demoApp).post('/api/v1/auth/register').send({
      email: 'demo.staff@example.com',
      password: VALID_PASSWORD,
      displayName: 'Demo Staff',
    });

    const wrong = await request(demoApp).post('/api/v1/auth/login').send({
      email: 'demo.staff@example.com',
      password: 'wrong-password',
    });
    const again = await request(demoApp).post('/api/v1/auth/login').send({
      email: 'demo.staff@example.com',
      password: 'wrong-password',
    });
    const ok = await request(demoApp).post('/api/v1/auth/login').send({
      email: 'demo.staff@example.com',
      password: VALID_PASSWORD,
    });

    expect(wrong.status).toBe(401);
    expect(again.status).toBe(401);
    expect(ok.status).toBe(200);
    expect(ok.body.data.tokens.accessToken).toEqual(expect.any(String));
    expect(ok.body.data.user.email).toBe('demo.staff@example.com');
  });

  it('still rate-limits seeded demo emails when DEMO_MODE is off', async () => {
    const productionLike = createApp({
      config: authConfig({
        DEMO_MODE: 'false',
        RATE_LIMIT_ENABLED: 'true',
        AUTH_LOGIN_RATE_LIMIT_MAX: '1',
        AUTH_LOGIN_IP_RATE_LIMIT_MAX: '100',
        AUTH_LOGIN_RATE_LIMIT_WINDOW: '15m',
      }),
      logger,
      database,
    }).app;

    await request(productionLike).post('/api/v1/auth/register').send({
      email: 'demo.staff@example.com',
      password: VALID_PASSWORD,
      displayName: 'Demo Staff',
    });

    const first = await request(productionLike).post('/api/v1/auth/login').send({
      email: 'demo.staff@example.com',
      password: 'wrong-password',
    });
    const second = await request(productionLike).post('/api/v1/auth/login').send({
      email: 'demo.staff@example.com',
      password: 'wrong-password',
    });

    expect(first.status).toBe(401);
    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe(ERROR_CODES.RATE_LIMIT);
  });

  it('sets httpOnly session cookies and refreshes from the refresh cookie', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/register').send({
      email: 'cookie@example.com',
      password: VALID_PASSWORD,
      displayName: 'Cookie',
    });

    const login = await agent
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .send({
        email: 'cookie@example.com',
        password: VALID_PASSWORD,
      });
    expect(login.status).toBe(200);
    const setCookie = ([] as string[]).concat(login.headers['set-cookie'] ?? []);
    expect(setCookie.some((value) => /hsk_access=/.test(value) && /HttpOnly/i.test(value))).toBe(true);
    expect(setCookie.some((value) => /hsk_refresh=/.test(value) && /HttpOnly/i.test(value))).toBe(true);

    const me = await agent.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('cookie@example.com');

    const refreshed = await agent
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:5173')
      .send({});
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.tokens.accessToken).toEqual(expect.any(String));
  });

  it('rejects cookie-only mutating requests from an untrusted origin and still allows Bearer', async () => {
    const agent = request.agent(app);
    const registered = await agent.post('/api/v1/auth/register').send({
      email: 'csrf@example.com',
      password: VALID_PASSWORD,
      displayName: 'Csrf',
    });
    const refreshToken = registered.body.data.tokens.refreshToken as string;

    const csrf = await agent.post('/api/v1/auth/logout').send({});
    expect(csrf.status).toBe(403);
    expect(csrf.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);

    const bearer = await request(app).post('/api/v1/auth/refresh').send({ refreshToken });
    expect(bearer.status).toBe(200);
  });
});
