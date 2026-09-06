import pino from 'pino';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { ERROR_CODES } from '../src/constants';
import { createBackgroundWorker } from '../src/jobs/runtime';
import { createDatabaseClient, type DatabaseClient } from '../src/lib/database';
import { loadProblemModule } from '../src/problem';
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
const DEALFLOW_JOB_NAME = 'dealflow.odoo.sync';
const VALID_PASSWORD = 'correct-horse';

function buildApp() {
  const config = loadConfig({
    NODE_ENV: 'test',
    APP_NAME: 'DealFlow360',
  });

  return createApp({
    config,
    logger,
  });
}

describe('problem module HTTP registration', () => {
  it('exposes the DealFlow360 manifest without authentication', async () => {
    const { app, problemModule } = buildApp();
    expect(problemModule?.id).toBe(loadProblemModule().id);

    const response = await request(app).get('/api/v1/problem');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: {
        id: 'dealflow',
        replaceable: false,
        jobName: DEALFLOW_JOB_NAME,
      },
    });
  });

  it('protects quote reads with authentication', async () => {
    const { app } = buildApp();
    const response = await request(app).get('/api/v1/dealflow/quotes');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHENTICATION_ERROR);
  });

  it('protects quote writes with authentication', async () => {
    const { app } = buildApp();
    const response = await request(app).post('/api/v1/dealflow/quotes').send({});

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHENTICATION_ERROR);
  });
});

describe('problem module worker registration', () => {
  it('registers the DealFlow360 job processor on createApp', async () => {
    const { jobs } = buildApp();
    const jobId = await jobs.enqueue(DEALFLOW_JOB_NAME, {});
    await jobs.waitForIdle();
    const status = await jobs.getJob(jobId);

    expect(status?.type).toBe(DEALFLOW_JOB_NAME);
    expect(status?.status).toBe('completed');
    await jobs.close();
  });

  it('registers the DealFlow360 job processor on the background worker', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      APP_NAME: 'DealFlow360',
    });
    const worker = createBackgroundWorker({ config, logger });
    const jobId = await worker.jobs.enqueue(DEALFLOW_JOB_NAME, {});
    await worker.jobs.waitForIdle();
    const status = await worker.jobs.getJob(jobId);

    expect(status?.status).toBe('completed');
    await worker.close();
  });
});

describeDatabase('problem module permissions and validation', () => {
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
      }),
      logger,
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

  async function register(email: string) {
    const response = await request(app).post('/api/v1/auth/register').send({
      email,
      password: VALID_PASSWORD,
      displayName: email.split('@')[0],
    });
    expect(response.status).toBe(201);
    return response.body.data as {
      user: { id: string; permissions: string[] };
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

  it('seeds DealFlow360 permissions into the catalog', async () => {
    const permission = await getTestPrisma().permission.findUnique({
      where: { key: 'dealflow.quotes.read' },
    });
    expect(permission?.key).toBe('dealflow.quotes.read');
  });

  it('allows STAFF to read quotes and denies USER', async () => {
    const user = await register('problem-user@example.com');
    const staff = await register('problem-staff@example.com');
    await assignRole(staff.user.id, ROLES.STAFF);

    const denied = await request(app)
      .get('/api/v1/dealflow/quotes')
      .set(authHeader(user.tokens.accessToken));
    const allowed = await request(app)
      .get('/api/v1/dealflow/quotes')
      .set(authHeader(staff.tokens.accessToken));

    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
    expect(allowed.status).toBe(200);
    expect(Array.isArray(allowed.body.data)).toBe(true);
  });

  it('rejects invalid quote bodies for MANAGER', async () => {
    const manager = await register('problem-manager@example.com');
    await assignRole(manager.user.id, ROLES.MANAGER);

    const invalid = await request(app)
      .post('/api/v1/dealflow/quotes')
      .set(authHeader(manager.tokens.accessToken))
      .send({ customerId: 1 });

    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('lets finance read quotes and billing routes but not catalog write', async () => {
    const finance = await register('problem-finance@example.com');
    await assignRole(finance.user.id, 'finance');

    const quotes = await request(app)
      .get('/api/v1/dealflow/quotes')
      .set(authHeader(finance.tokens.accessToken));
    const governance = await request(app)
      .patch('/api/v1/dealflow/catalog/governance')
      .set(authHeader(finance.tokens.accessToken))
      .send({ taxRatePercent: 8 });
    const create = await request(app)
      .post('/api/v1/dealflow/quotes')
      .set(authHeader(finance.tokens.accessToken))
      .send({ customerId: '11111111-1111-4111-8111-111111111111' });

    expect(quotes.status).toBe(200);
    expect(governance.status).toBe(403);
    expect(create.status).toBe(403);
  });

  it('lets operations read quotes and denies billing and catalog write', async () => {
    const operations = await register('problem-operations@example.com');
    await assignRole(operations.user.id, 'operations');

    const quotes = await request(app)
      .get('/api/v1/dealflow/quotes')
      .set(authHeader(operations.tokens.accessToken));
    const billing = await request(app)
      .post('/api/v1/dealflow/quotes/11111111-1111-4111-8111-111111111111/billing/generate')
      .set(authHeader(operations.tokens.accessToken))
      .send({ expectedVersion: 1 });
    const governance = await request(app)
      .patch('/api/v1/dealflow/catalog/governance')
      .set(authHeader(operations.tokens.accessToken))
      .send({ taxRatePercent: 8 });

    expect(quotes.status).toBe(200);
    expect(billing.status).toBe(403);
    expect(governance.status).toBe(403);
  });

  it('hard-rejects staff discounts over 5% and finance-locks without the lock permission', async () => {
    const { seedDealflowCatalog } = await import('../../database/prisma/seed-dealflow.js');
    const { DEFAULT_CUSTOMERS, DEFAULT_PRODUCTS } = await import('../../modules/problem/src/dealflow/defaults.js');
    await seedDealflowCatalog(getTestPrisma(), { includePresentationData: true });

    const staff = await register('problem-staff-cap@example.com');
    await assignRole(staff.user.id, ROLES.STAFF);

    const overCap = await request(app)
      .post('/api/v1/dealflow/quotes')
      .set(authHeader(staff.tokens.accessToken))
      .send({
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 6 }],
      });
    expect(overCap.status).toBe(403);

    const created = await request(app)
      .post('/api/v1/dealflow/quotes')
      .set(authHeader(staff.tokens.accessToken))
      .send({
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 0 }],
      });
    expect(created.status).toBe(201);

    const lockDenied = await request(app)
      .post(`/api/v1/dealflow/quotes/${created.body.data.id}/lock`)
      .set(authHeader(staff.tokens.accessToken))
      .send({ expectedVersion: created.body.data.version });
    expect(lockDenied.status).toBe(403);

    const submitEarly = await request(app)
      .post(`/api/v1/dealflow/quotes/${created.body.data.id}/submit`)
      .set(authHeader(staff.tokens.accessToken));
    expect(submitEarly.status).toBe(409);
  });

  it('persists a catalog product for configuration writers', async () => {
    const admin = await register('problem-admin-catalog@example.com');
    await assignRole(admin.user.id, ROLES.ADMIN);
    const created = await request(app)
      .post('/api/v1/dealflow/catalog/products')
      .set(authHeader(admin.tokens.accessToken))
      .send({
        sku: 'HW-HTTP-1',
        name: 'HTTP Gateway',
        category: 'hardware',
        listPrice: 1200,
        cost: 400,
        billingType: 'one_time',
        description: 'Created over HTTP',
      });
    expect(created.status).toBe(201);
    expect(created.body.data.sku).toBe('HW-HTTP-1');
  });

  it('lets staff create products but not discount policies, and rejects duplicate SKUs', async () => {
    const { seedDealflowCatalog } = await import('../../database/prisma/seed-dealflow.js');
    const { DEFAULT_WAREHOUSES } = await import('../../modules/problem/src/dealflow/defaults.js');
    await seedDealflowCatalog(getTestPrisma(), { includePresentationData: true });

    const staff = await register('problem-staff-product@example.com');
    await assignRole(staff.user.id, ROLES.STAFF);

    const created = await request(app)
      .post('/api/v1/dealflow/catalog/products')
      .set(authHeader(staff.tokens.accessToken))
      .send({
        sku: 'EA-2026-001',
        name: 'Enterprise Analytics',
        category: 'analytics',
        listPrice: 5000,
        cost: 800,
        billingType: 'recurring',
        billingFrequency: 'monthly',
        taxCategory: 'saas',
        taxRatePercent: 8,
        stock: [{ warehouseId: DEFAULT_WAREHOUSES[0].id, quantityOnHand: 12 }],
      });
    expect(created.status).toBe(201);
    expect(created.body.data.sku).toBe('EA-2026-001');
    expect(created.body.data.billingType).toBe('recurring');

    const duplicate = await request(app)
      .post('/api/v1/dealflow/catalog/products')
      .set(authHeader(staff.tokens.accessToken))
      .send({
        sku: 'EA-2026-001',
        name: 'Enterprise Analytics 2',
        category: 'analytics',
        listPrice: 5000,
        cost: 800,
        billingType: 'recurring',
        billingFrequency: 'monthly',
      });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.message).toBe('SKU already exists. Please use a unique SKU.');

    const policy = await request(app)
      .post('/api/v1/dealflow/catalog/policies')
      .set(authHeader(staff.tokens.accessToken))
      .send({
        name: 'Unauthorized 20%',
        warningPercent: 20,
        approvalPercent: 20,
        rejectPercent: 40,
        maxMarginImpactPercent: 40,
        priority: 1,
      });
    expect(policy.status).toBe(403);
  });

  it('lets staff delete unused products and draft quotes, and refuses unsafe deletes', async () => {
    const { seedDealflowCatalog } = await import('../../database/prisma/seed-dealflow.js');
    const { DEFAULT_CUSTOMERS, DEFAULT_POLICIES, DEFAULT_PRODUCTS } = await import('../../modules/problem/src/dealflow/defaults.js');
    await seedDealflowCatalog(getTestPrisma(), { includePresentationData: true });

    const staff = await register('problem-staff-delete@example.com');
    await assignRole(staff.user.id, ROLES.STAFF);

    const unused = await request(app)
      .post('/api/v1/dealflow/catalog/products')
      .set(authHeader(staff.tokens.accessToken))
      .send({
        sku: 'DEL-UNUSED-1',
        name: 'Disposable SKU',
        category: 'hardware',
        listPrice: 100,
        cost: 40,
        billingType: 'one_time',
      });
    expect(unused.status).toBe(201);

    const deletedProduct = await request(app)
      .delete(`/api/v1/dealflow/catalog/products/${unused.body.data.id}`)
      .set(authHeader(staff.tokens.accessToken));
    expect(deletedProduct.status).toBe(200);
    expect(deletedProduct.body.data.deleted).toBe(true);

    const draft = await request(app)
      .post('/api/v1/dealflow/quotes')
      .set(authHeader(staff.tokens.accessToken))
      .send({
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 0 }],
      });
    expect(draft.status).toBe(201);

    const usedProduct = await request(app)
      .delete(`/api/v1/dealflow/catalog/products/${DEFAULT_PRODUCTS[0].id}`)
      .set(authHeader(staff.tokens.accessToken));
    expect(usedProduct.status).toBe(409);
    expect(usedProduct.body.error.message).toBe('Product is used on quotations. Archive it instead.');

    const deletedQuote = await request(app)
      .delete(`/api/v1/dealflow/quotes/${draft.body.data.id}`)
      .set(authHeader(staff.tokens.accessToken))
      .send({ expectedVersion: draft.body.data.version });
    expect(deletedQuote.status).toBe(200);
    expect(deletedQuote.body.data.deleted).toBe(true);

    const negotiable = await request(app)
      .post('/api/v1/dealflow/quotes')
      .set(authHeader(staff.tokens.accessToken))
      .send({
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 1, discountPercent: 0 }],
      });
    expect(negotiable.status).toBe(201);

    const opened = await request(app)
      .post(`/api/v1/dealflow/quotes/${negotiable.body.data.id}/negotiate`)
      .set(authHeader(staff.tokens.accessToken));
    expect(opened.status).toBe(200);

    const cannotDelete = await request(app)
      .delete(`/api/v1/dealflow/quotes/${negotiable.body.data.id}`)
      .set(authHeader(staff.tokens.accessToken))
      .send({ expectedVersion: opened.body.data.version });
    expect(cannotDelete.status).toBe(409);
    expect(cannotDelete.body.error.message).toBe('This quotation cannot be deleted. Void it instead.');

    const voided = await request(app)
      .post(`/api/v1/dealflow/quotes/${negotiable.body.data.id}/void`)
      .set(authHeader(staff.tokens.accessToken))
      .send({ expectedVersion: opened.body.data.version });
    expect(voided.status).toBe(200);
    expect(voided.body.data.status).toBe('rejected');

    const policy = await request(app)
      .delete(`/api/v1/dealflow/catalog/policies/${DEFAULT_POLICIES[0].id}`)
      .set(authHeader(staff.tokens.accessToken));
    expect(policy.status).toBe(403);

    const createdCustomer = await request(app)
      .post('/api/v1/dealflow/catalog/customers')
      .set(authHeader(staff.tokens.accessToken))
      .send({ name: 'Contoso Retail', email: 'buying@contoso.example', tier: 'gold' });
    expect(createdCustomer.status).toBe(201);

    const blockedCustomer = await request(app)
      .delete(`/api/v1/dealflow/catalog/customers/${DEFAULT_CUSTOMERS[0].id}`)
      .set(authHeader(staff.tokens.accessToken));
    expect(blockedCustomer.status).toBe(409);

    const deletedCustomer = await request(app)
      .delete(`/api/v1/dealflow/catalog/customers/${createdCustomer.body.data.id}`)
      .set(authHeader(staff.tokens.accessToken));
    expect(deletedCustomer.status).toBe(200);
    expect(deletedCustomer.body.data.deleted).toBe(true);

    const admin = await register('problem-admin-records@example.com');
    await assignRole(admin.user.id, ROLES.ADMIN);
    const warehouse = await request(app)
      .post('/api/v1/dealflow/catalog/warehouses')
      .set(authHeader(admin.tokens.accessToken))
      .send({ name: 'Overflow DC', fulfillmentCostPerUnit: 12 });
    expect(warehouse.status).toBe(201);
    const renamed = await request(app)
      .patch('/api/v1/dealflow/catalog/warehouses')
      .set(authHeader(admin.tokens.accessToken))
      .send({ id: warehouse.body.data.id, name: 'Overflow DC East', fulfillmentCostPerUnit: 14 });
    expect(renamed.status).toBe(200);
    expect(renamed.body.data.name).toBe('Overflow DC East');
  });

  it('walks portal submit → under negotiation → staff cap → manager return → customer confirm', async () => {
    const { seedDealflowCatalog } = await import('../../database/prisma/seed-dealflow.js');
    const { DEFAULT_CUSTOMERS, DEFAULT_PRODUCTS } = await import('../../modules/problem/src/dealflow/defaults.js');
    await seedDealflowCatalog(getTestPrisma(), { includePresentationData: true });

    const staff = await register('problem-staff-nego@example.com');
    const manager = await register('problem-manager-nego@example.com');
    await assignRole(staff.user.id, ROLES.STAFF);
    await assignRole(manager.user.id, ROLES.MANAGER);

    const created = await request(app)
      .post('/api/v1/dealflow/quotes')
      .set(authHeader(staff.tokens.accessToken))
      .send({
        customerId: DEFAULT_CUSTOMERS[0].id,
        lines: [{ productId: DEFAULT_PRODUCTS[0].id, quantity: 8, discountPercent: 0 }],
      });
    expect(created.status).toBe(201);

    const token = created.body.data.portalToken as string;
    const lineId = created.body.data.lines[0].id as string;

    const portalSent = await request(app).get(`/api/v1/dealflow/portal/${token}`);
    expect(portalSent.status).toBe(200);
    expect(portalSent.body.data.status).toBe('draft');
    expect(portalSent.body.data).not.toHaveProperty('approvals');
    expect(portalSent.body.data).not.toHaveProperty('ownerId');
    expect(portalSent.body.data).not.toHaveProperty('customerEmails');

    const submitted = await request(app).post(`/api/v1/dealflow/portal/${token}/negotiations`).send({
      expectedVersion: created.body.data.version,
      note: 'Requesting 8% discount for increasing quantity to 20.',
      requestedDiscountPercent: 8,
      requestedLines: [
        {
          lineId,
          quantity: 20,
          discountPercent: 8,
          action: 'update',
          requestType: 'discount',
          comment: 'Volume increase',
          originalQuantity: 8,
          originalDiscountPercent: 0,
        },
      ],
    });
    expect(submitted.status).toBe(201);
    expect(submitted.body.data.status).toBe('customer_negotiation');
    expect(submitted.body.data.lines[0].quantity).toBe(20);
    expect(submitted.body.data.lines[0].discountPercent).toBe(0);
    expect(submitted.body.data.negotiations[0].requestedDiscountPercent).toBe(8);

    const confirmTooSoon = await request(app)
      .post(`/api/v1/dealflow/portal/${token}/agree`)
      .send({ expectedVersion: submitted.body.data.version });
    expect(confirmTooSoon.status).toBe(409);

    const overCap = await request(app)
      .patch(`/api/v1/dealflow/quotes/${created.body.data.id}/lines/${lineId}`)
      .set(authHeader(staff.tokens.accessToken))
      .send({ discountPercent: 8, expectedVersion: submitted.body.data.version });
    expect(overCap.status).toBe(403);

    const escalated = await request(app)
      .post(`/api/v1/dealflow/quotes/${created.body.data.id}/send-to-manager`)
      .set(authHeader(staff.tokens.accessToken))
      .send({ expectedVersion: submitted.body.data.version });
    expect(escalated.status).toBe(200);
    expect(escalated.body.data.status).toBe('manager_review');

    const confirmWhileEscalated = await request(app)
      .post(`/api/v1/dealflow/portal/${token}/agree`)
      .send({ expectedVersion: escalated.body.data.version });
    expect(confirmWhileEscalated.status).toBe(409);

    const returned = await request(app)
      .post(`/api/v1/dealflow/quotes/${created.body.data.id}/return`)
      .set(authHeader(manager.tokens.accessToken))
      .send({ expectedVersion: escalated.body.data.version });
    expect(returned.status).toBe(200);
    expect(returned.body.data.status).toBe('customer_negotiation');

    const confirmed = await request(app)
      .post(`/api/v1/dealflow/portal/${token}/agree`)
      .send({ expectedVersion: returned.body.data.version });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.customerDecision).toBe('accepted');
    expect(confirmed.body.data.negotiations.at(-1).status).toBe('agreed');
  });
});
