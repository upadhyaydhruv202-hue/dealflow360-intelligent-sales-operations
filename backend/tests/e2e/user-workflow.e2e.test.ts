import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';

import { createApp } from '../../src/app';
import { loadConfig } from '../../src/config';
import { ERROR_CODES } from '../../src/constants';
import { createDatabaseClient, type DatabaseClient } from '../../src/lib/database';
import { ROLES } from '../../src/rbac/catalog';
import { seedRbacCatalog } from '../../src/rbac/seed-catalog';
import { TEST_PASSWORD } from '../factories';
import { AUTH_TEST_ENV } from '../helpers/auth';
import {
  describeDatabase,
  disconnectTestPrisma,
  getTestPrisma,
  getTestRepositories,
  hasDatabaseUrl,
  resetDatabase,
} from '../helpers/database';
import { authHeader, loginSession, registerSession } from '../helpers/http';

if (!hasDatabaseUrl()) {
  throw new Error(
    'E2E tests require DATABASE_URL. Copy .env.test.example to .env.test and run npm run db:test:prepare.',
  );
}

describeDatabase('E2E: register → authorize → automate → notify → audit', () => {
  let database!: DatabaseClient;
  let app!: ReturnType<typeof createApp>['app'];
  let jobs!: ReturnType<typeof createApp>['jobs'];

  beforeAll(() => {
    database = createDatabaseClient({
      url: process.env.DATABASE_URL as string,
      poolMax: 5,
      poolTimeoutSeconds: 10,
    });
    const created = createApp({
      config: loadConfig({
        ...AUTH_TEST_ENV,
        DATABASE_URL: process.env.DATABASE_URL,
        AUTH_DEFAULT_ROLE: ROLES.USER,
        DEMO_MODE: 'true',
        FEATURE_AUTOMATION: 'true',
        FEATURE_NOTIFICATIONS: 'true',
        SCHEDULER_ENABLED: 'false',
        RATE_LIMIT_ENABLED: 'false',
      }),
      logger: pino({ level: 'silent' }),
      database,
    });
    app = created.app;
    jobs = created.jobs;
  });

  beforeEach(async () => {
    await resetDatabase();
    await seedRbacCatalog(getTestPrisma());
  });

  afterAll(async () => {
    await jobs.close();
    await database.close();
    await disconnectTestPrisma();
  });

  it('walks a representative workflow including failure modes', async () => {
    const invalid = await registerSession(app, 'bad@example.com', { password: 'short' });
    expect(invalid.status).toBe(400);
    expect(invalid.response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);

    const registered = await registerSession(app, 'owner@example.com');
    expect(registered.status).toBe(201);
    expect(registered.user?.roles).toEqual([ROLES.USER]);
    const userToken = registered.tokens?.accessToken as string;
    const userId = registered.user?.id as string;

    const me = await request(app).get('/api/v1/auth/me').set(authHeader(userToken));
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('owner@example.com');

    const denied = await request(app)
      .post('/api/v1/automations/rules')
      .set(authHeader(userToken))
      .send({
        name: 'Remind late invoices',
        trigger: 'webhook.received',
        enabled: true,
        actions: [{ type: 'createAuditLog', action: 'automation.denied' }],
      });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);

    const role = await getTestRepositories().roles.findByNameOrThrow(ROLES.MANAGER);
    await getTestRepositories().roles.assignUser(userId, role.id);

    const relogin = await loginSession(app, 'owner@example.com', TEST_PASSWORD);
    expect(relogin.status).toBe(200);
    const managerToken = relogin.tokens?.accessToken as string;

    const created = await request(app)
      .post('/api/v1/automations/rules')
      .set(authHeader(managerToken))
      .send({
        name: 'On webhook',
        trigger: 'webhook.received',
        enabled: true,
        actions: [{ type: 'createAuditLog', action: 'automation.webhook.received' }],
      });
    expect(created.status).toBe(201);
    expect(created.body.data.enabled).toBe(true);

    const eventId = 'webhook.received:e2e-1';
    const payload = { userId, title: 'Invoice overdue', body: 'Pay within 7 days' };
    const emitted = await request(app)
      .post('/api/v1/automations/events')
      .set(authHeader(managerToken))
      .send({ trigger: 'webhook.received', eventId, payload });
    expect(emitted.status).toBe(202);
    await jobs.waitForIdle();

    const duplicateEvent = await request(app)
      .post('/api/v1/automations/events')
      .set(authHeader(managerToken))
      .send({ trigger: 'webhook.received', eventId, payload });
    expect(duplicateEvent.status).toBe(202);
    await jobs.waitForIdle();

    const executions = await request(app)
      .get('/api/v1/automations/executions')
      .set(authHeader(managerToken));
    expect(executions.status).toBe(200);
    expect(executions.body.data.items).toHaveLength(1);
    expect(executions.body.data.items[0].status).toBe('succeeded');

    const sent = await request(app)
      .post('/api/v1/notifications/send')
      .set(authHeader(managerToken))
      .send({
        channel: 'in_app',
        recipient: { userId },
        template: 'generic',
        data: { title: 'Welcome', body: 'E2E notification' },
        idempotencyKey: 'e2e:welcome:1',
      });
    expect(sent.status).toBe(201);

    const duplicateNotice = await request(app)
      .post('/api/v1/notifications/send')
      .set(authHeader(managerToken))
      .send({
        channel: 'in_app',
        recipient: { userId },
        template: 'generic',
        data: { title: 'Welcome', body: 'E2E notification' },
        idempotencyKey: 'e2e:welcome:1',
      });
    expect(duplicateNotice.status).toBe(200);
    expect(duplicateNotice.body.data.reason).toBe('duplicate');

    const inbox = await request(app).get('/api/v1/notifications').set(authHeader(userToken));
    expect(inbox.status).toBe(200);
    expect(inbox.body.data.items).toHaveLength(1);

    const audit = await request(app).get('/api/v1/audit?pageSize=20').set(authHeader(managerToken));
    expect(audit.status).toBe(200);
    expect(audit.body.data.items.length).toBeGreaterThan(0);
  });
});
