import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import pino from 'pino';
import request from 'supertest';

import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { ERROR_CODES } from '../src/constants';
import { createDatabaseClient, type DatabaseClient } from '../src/lib/database';
import { PERMISSIONS, ROLES } from '../src/rbac/catalog';
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
  });
}

describeDatabase('RBAC HTTP', () => {
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

  it('rejects unauthenticated access to protected catalog routes', async () => {
    const response = await request(app).get('/api/v1/roles');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHENTICATION_ERROR);
  });

  it('allows a user with roles.read and denies a user without it', async () => {
    const standard = await register('user@example.com');
    const manager = await register('manager@example.com');
    await assignRole(manager.user.id, ROLES.MANAGER);

    const denied = await request(app).get('/api/v1/roles').set(authHeader(standard.tokens.accessToken));
    const allowed = await request(app).get('/api/v1/roles').set(authHeader(manager.tokens.accessToken));

    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
    expect(allowed.status).toBe(200);
    expect(allowed.body.data.roles.map((role: { name: string }) => role.name)).toEqual(
      expect.arrayContaining([ROLES.ADMIN, ROLES.MANAGER, ROLES.STAFF, ROLES.USER]),
    );
  });

  it('allows ADMIN to manage the catalog and denies STAFF writes', async () => {
    const admin = await register('admin@example.com');
    const staff = await register('staff@example.com');
    await assignRole(admin.user.id, ROLES.ADMIN);
    await assignRole(staff.user.id, ROLES.STAFF);

    const created = await request(app)
      .post('/api/v1/permissions')
      .set(authHeader(admin.tokens.accessToken))
      .send({ key: 'inventory.approve', description: 'Approve inventory adjustments' });
    const forbidden = await request(app)
      .post('/api/v1/permissions')
      .set(authHeader(staff.tokens.accessToken))
      .send({ key: 'supplier.read', description: 'Read suppliers' });

    expect(created.status).toBe(201);
    expect(created.body.data.permission.key).toBe('inventory.approve');
    expect(forbidden.status).toBe(403);
  });

  it('unions permissions across multiple roles', async () => {
    const session = await register('multi@example.com');
    await assignRole(session.user.id, ROLES.STAFF);

    const me = await request(app).get('/api/v1/auth/me').set(authHeader(session.tokens.accessToken));

    expect(me.status).toBe(200);
    expect(me.body.data.user.roles).toEqual([ROLES.STAFF, ROLES.USER].sort());
    expect(me.body.data.user.permissions).toEqual(
      expect.arrayContaining([PERMISSIONS.NOTIFICATIONS_READ, PERMISSIONS.ODOO_READ]),
    );
    expect(me.body.data.user.permissions).not.toContain(PERMISSIONS.ODOO_WRITE);

    const catalog = await request(app).get('/api/v1/roles').set(authHeader(session.tokens.accessToken));
    expect(catalog.status).toBe(403);
  });

  it('lets a logged-in USER use the app without Odoo write access', async () => {
    const session = await register('app-user@example.com');
    const me = await request(app).get('/api/v1/auth/me').set(authHeader(session.tokens.accessToken));
    const write = await request(app)
      .post('/api/v1/permissions')
      .set(authHeader(session.tokens.accessToken))
      .send({ key: 'odoo.sync', description: 'not granted by login' });

    expect(me.status).toBe(200);
    expect(me.body.data.user.roles).toEqual([ROLES.USER]);
    expect(me.body.data.user.permissions).not.toContain(PERMISSIONS.ODOO_WRITE);
    expect(me.body.data.user.permissions).not.toContain(PERMISSIONS.ODOO_READ);
    expect(write.status).toBe(403);
  });

  it('assigns a newly created permission to a role', async () => {
    const admin = await register('grantor@example.com');
    await assignRole(admin.user.id, ROLES.ADMIN);

    await request(app)
      .post('/api/v1/permissions')
      .set(authHeader(admin.tokens.accessToken))
      .send({ key: 'student.write', description: 'Update student records' });

    const assigned = await request(app)
      .post(`/api/v1/roles/${ROLES.STAFF}/permissions`)
      .set(authHeader(admin.tokens.accessToken))
      .send({ key: 'student.write' });

    expect(assigned.status).toBe(200);
    expect(assigned.body.data).toEqual({ role: ROLES.STAFF, permission: 'student.write' });

    const staff = await register('teacher@example.com');
    await assignRole(staff.user.id, ROLES.STAFF);
    const me = await request(app).get('/api/v1/auth/me').set(authHeader(staff.tokens.accessToken));
    expect(me.body.data.user.permissions).toContain('student.write');
  });

  it('assigns a role to a user through the privileged API', async () => {
    const admin = await register('role-admin@example.com');
    const target = await register('role-target@example.com');
    await assignRole(admin.user.id, ROLES.ADMIN);

    const assigned = await request(app)
      .post(`/api/v1/users/${target.user.id}/roles`)
      .set(authHeader(admin.tokens.accessToken))
      .send({ role: 'MANAGER' });

    expect(assigned.status).toBe(200);
    expect(assigned.body.data.roles).toEqual(expect.arrayContaining([ROLES.MANAGER, ROLES.USER]));
  });
});
