import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { AUDIT_ACTIONS, ERROR_CODES } from '../src/constants';
import { createDatabaseClient, type DatabaseClient } from '../src/lib/database';
import { FixedOtpGenerator } from '../src/otp';
import { ROLES } from '../src/rbac/catalog';
import { seedRbacCatalog } from '../src/rbac/seed-catalog';
import { AUTH_TEST_ENV } from './helpers/auth';
import {
  describeDatabase,
  disconnectTestPrisma,
  getTestPrisma,
  getTestRepositories,
  resetDatabase,
} from './helpers/database';

const logger = pino({ level: 'silent' });
const VALID_PASSWORD = 'correct-horse';

function authConfig() {
  return loadConfig({
    ...AUTH_TEST_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_DEFAULT_ROLE: ROLES.USER,
    FEATURE_OTP: 'true',
    OTP_PROVIDER: 'mock',
    OTP_RESEND_COOLDOWN: '0s',
  });
}

describeDatabase('Audit HTTP', () => {
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
      otpGenerator: new FixedOtpGenerator('123456'),
    }).app;
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedRbacCatalog(getTestPrisma());
  });

  afterAll(async () => {
    await database.close();
    await disconnectTestPrisma();
  });

  async function register(email: string) {
    const response = await request(app).post('/api/v1/auth/register').send({
      email,
      password: VALID_PASSWORD,
      displayName: email.split('@')[0],
    });
    expect(response.status).toBe(201);
    return response.body.data as {
      user: { id: string; roles: string[]; permissions: string[] };
      tokens: { accessToken: string };
    };
  }

  async function assignRole(userId: string, role: string) {
    const roleRecord = await getTestRepositories().roles.findByNameOrThrow(role);
    await getTestRepositories().roles.assignUser(userId, roleRecord.id);
  }

  function authHeader(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  it('rejects unauthenticated access', async () => {
    const response = await request(app).get('/api/v1/audit');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHENTICATION_ERROR);
  });

  it('denies a user without audit.read and allows a manager', async () => {
    const standard = await register('user@example.com');
    const manager = await register('manager@example.com');
    await assignRole(manager.user.id, ROLES.MANAGER);

    const denied = await request(app).get('/api/v1/audit').set(authHeader(standard.tokens.accessToken));
    const allowed = await request(app).get('/api/v1/audit').set(authHeader(manager.tokens.accessToken));

    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.items.length).toBeGreaterThan(0);
  });

  it('records user.created and user.login without secrets, and supports filters plus pagination', async () => {
    const admin = await register('admin@example.com');
    await assignRole(admin.user.id, ROLES.ADMIN);
    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'admin@example.com',
      password: VALID_PASSWORD,
    });
    expect(login.status).toBe(200);

    const listed = await request(app)
      .get('/api/v1/audit')
      .set(authHeader(admin.tokens.accessToken))
      .query({ page: 1, pageSize: 1 });

    expect(listed.status).toBe(200);
    expect(listed.body.meta).toMatchObject({ page: 1, pageSize: 1, hasNextPage: true });
    expect(listed.body.data.items[0]).toMatchObject({
      actorId: admin.user.id,
      action: expect.any(String),
      timestamp: expect.any(String),
    });
    expect(JSON.stringify(listed.body)).not.toMatch(/correct-horse|passwordHash|accessToken/i);

    const created = await request(app)
      .get('/api/v1/audit')
      .set(authHeader(admin.tokens.accessToken))
      .query({ action: AUDIT_ACTIONS.USER_CREATED, actorId: admin.user.id });
    expect(created.body.data.items).toHaveLength(1);
    expect(created.body.data.items[0]).toMatchObject({
      action: AUDIT_ACTIONS.USER_CREATED,
      resource: 'user',
      resourceId: admin.user.id,
      metadata: { email: 'admin@example.com' },
    });

    const logins = await request(app)
      .get('/api/v1/audit')
      .set(authHeader(admin.tokens.accessToken))
      .query({ action: AUDIT_ACTIONS.USER_LOGIN, actorId: admin.user.id });
    expect(logins.body.data.items.length).toBeGreaterThanOrEqual(1);

    const emptyRange = await request(app)
      .get('/api/v1/audit')
      .set(authHeader(admin.tokens.accessToken))
      .query({ from: new Date(Date.now() + 86_400_000).toISOString() });
    expect(emptyRange.body.data.items).toEqual([]);
  });

  it('records password reset and RBAC catalog mutations without secrets', async () => {
    const admin = await register('admin-audit@example.com');
    await assignRole(admin.user.id, ROLES.ADMIN);

    const created = await request(app)
      .post('/api/v1/permissions')
      .set(authHeader(admin.tokens.accessToken))
      .send({ key: 'inventory.approve', description: 'Approve inventory adjustments' });
    expect(created.status).toBe(201);

    const assigned = await request(app)
      .post(`/api/v1/roles/${ROLES.STAFF}/permissions`)
      .set(authHeader(admin.tokens.accessToken))
      .send({ key: 'inventory.approve' });
    expect(assigned.status).toBe(200);

    const requested = await request(app)
      .post('/api/v1/auth/password-reset/request')
      .send({ email: 'admin-audit@example.com' });
    expect(requested.status).toBe(200);
    const confirmed = await request(app).post('/api/v1/auth/password-reset/confirm').send({
      email: 'admin-audit@example.com',
      code: '123456',
      password: 'brand-new-password',
    });
    expect(confirmed.status).toBe(200);

    const next = await request(app).post('/api/v1/auth/login').send({
      email: 'admin-audit@example.com',
      password: 'brand-new-password',
    });
    expect(next.status).toBe(200);
    const accessToken = next.body.data.tokens.accessToken as string;

    const listed = await request(app)
      .get('/api/v1/audit')
      .set(authHeader(accessToken))
      .query({ resource: 'user' });
    expect(JSON.stringify(listed.body)).not.toMatch(/brand-new-password|123456|passwordHash/i);

    const resets = await request(app)
      .get('/api/v1/audit')
      .set(authHeader(accessToken))
      .query({ action: AUDIT_ACTIONS.USER_PASSWORD_RESET, actorId: admin.user.id });
    expect(resets.body.data.items).toHaveLength(1);
    expect(resets.body.data.items[0]).toMatchObject({
      action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
      resource: 'user',
      resourceId: admin.user.id,
    });

    const permissions = await request(app)
      .get('/api/v1/audit')
      .set(authHeader(accessToken))
      .query({ action: AUDIT_ACTIONS.PERMISSION_CREATED });
    expect(permissions.body.data.items).toHaveLength(1);
    expect(permissions.body.data.items[0]).toMatchObject({
      action: AUDIT_ACTIONS.PERMISSION_CREATED,
      resource: 'permission',
      metadata: { key: 'inventory.approve' },
    });

    const grants = await request(app)
      .get('/api/v1/audit')
      .set(authHeader(accessToken))
      .query({ action: AUDIT_ACTIONS.ROLE_PERMISSION_ASSIGNED });
    expect(grants.body.data.items).toHaveLength(1);
    expect(grants.body.data.items[0]).toMatchObject({
      action: AUDIT_ACTIONS.ROLE_PERMISSION_ASSIGNED,
      resource: 'role',
      metadata: { role: ROLES.STAFF, permission: 'inventory.approve' },
    });
  });
});
