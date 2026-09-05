import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { afterEach, describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../auth/types';
import { loadConfig } from '../config';
import { ERROR_CODES } from '../constants';
import { createEventBus } from '../events';
import { InMemoryJobQueue } from '../jobs';
import { errorHandler } from '../middleware/error-handler';
import { requestIdMiddleware } from '../middleware/request-id';
import { ROLES } from '../rbac/catalog';
import { createProblemHost } from './create-host';
import { loadProblemModule } from './load';
import { applyProblemModule } from './register';

const logger = pino({ level: 'silent' });
const DEALFLOW_JOB_NAME = 'dealflow.odoo.sync';

function actor(permissions: string[]): AuthenticatedUser {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'user@example.com',
    displayName: 'Test',
    status: 'active',
    role: ROLES.USER,
    roles: [ROLES.USER],
    permissions,
  };
}

function passthrough(_req: express.Request, _res: express.Response, next: express.NextFunction) {
  next();
}

function buildApp(currentUser?: AuthenticatedUser) {
  const app = express();
  const jobs = new InMemoryJobQueue(logger);
  app.use(express.json());
  app.use(requestIdMiddleware);
  applyProblemModule(
    createProblemHost({
      stage: 'api',
      config: loadConfig({ NODE_ENV: 'test', APP_NAME: 'DealFlow360' }),
      logger,
      jobs,
      events: createEventBus(logger),
      app,
      http: {
        authenticate: (req, _res, next) => {
          if (currentUser) {
            req.user = currentUser;
          }
          next();
        },
        publicRateLimit: passthrough,
        authenticatedRateLimit: passthrough,
      },
    }),
    loadProblemModule(),
  );
  app.use(errorHandler(logger, false));
  return { app, jobs };
}

describe('problem host HTTP', () => {
  let jobs: InMemoryJobQueue | undefined;

  afterEach(async () => {
    await jobs?.close();
    jobs = undefined;
  });

  it('allows dealflow.quotes.read and denies a caller without it', async () => {
    const allowed = buildApp(actor(['dealflow.quotes.read']));
    const denied = buildApp(actor([]));
    jobs = allowed.jobs;

    const ok = await request(allowed.app).get('/api/v1/dealflow/quotes');
    const forbidden = await request(denied.app).get('/api/v1/dealflow/quotes');

    expect(ok.status).toBe(200);
    expect(ok.body.success).toBe(true);
    expect(Array.isArray(ok.body.data)).toBe(true);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
    await denied.jobs.close();
  });

  it('validates quote payloads and runs the DealFlow360 sync job', async () => {
    const created = buildApp(actor(['dealflow.quotes.write', 'dealflow.quotes.read']));
    jobs = created.jobs;

    const invalid = await request(created.app).post('/api/v1/dealflow/quotes').send({ customerId: 'nope' });
    expect(invalid.status).toBe(400);
    expect(invalid.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);

    const jobId = await created.jobs.enqueue(DEALFLOW_JOB_NAME, {});
    await created.jobs.waitForIdle();
    const status = await created.jobs.getJob(jobId);
    expect(status?.status).toBe('completed');
  });
});
