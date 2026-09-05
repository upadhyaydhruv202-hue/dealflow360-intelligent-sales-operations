import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../src/auth/types';
import { API_PREFIX, ERROR_CODES } from '../src/constants';
import { OdooController } from '../src/controllers/odoo.controller';
import type { OdooService } from '../src/integrations/odoo';
import { errorHandler, requestIdMiddleware } from '../src/middleware';
import { PERMISSIONS } from '../src/rbac/catalog';
import { createOdooRouter } from '../src/routes/odoo.routes';

function actor(permissions: string[]): AuthenticatedUser {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'staff@example.com',
    displayName: 'Staff',
    status: 'active',
    role: 'staff',
    roles: ['staff'],
    permissions,
  };
}

function buildOdooApp(options: {
  permissions?: string[];
  service?: OdooService | null;
} = {}) {
  const permissions = options.permissions ?? [PERMISSIONS.ODOO_READ];
  const service =
    options.service === undefined
      ? ({
          checkConnectivity: async () => ({
            configured: true,
            healthy: true,
            skipped: false,
            latencyMs: 12,
          }),
        } as OdooService)
      : options.service;
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(
    API_PREFIX,
    createOdooRouter({
      controller: new OdooController(service),
      authenticate: (req, _res, next) => {
        req.user = actor(permissions);
        next();
      },
    }),
  );
  app.use(errorHandler(pino({ level: 'silent' }), false));
  return app;
}

describe('Odoo HTTP', () => {
  it('allows odoo.read to read health when the adapter is healthy', async () => {
    const response = await request(buildOdooApp()).get('/api/v1/odoo/health');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      configured: true,
      healthy: true,
      skipped: false,
    });
  });

  it('denies callers without odoo.read', async () => {
    const response = await request(buildOdooApp({ permissions: [] })).get('/api/v1/odoo/health');
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
  });

  it('returns 503 when the configured adapter is unhealthy', async () => {
    const app = buildOdooApp({
      service: {
        checkConnectivity: async () => ({
          configured: true,
          healthy: false,
          skipped: false,
          error: 'Invalid apikey',
        }),
      } as OdooService,
    });
    const response = await request(app).get('/api/v1/odoo/health');
    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe(ERROR_CODES.NOT_READY);
    expect(response.body.error.details.check.healthy).toBe(false);
  });

  it('reports skipped when Odoo is not wired', async () => {
    const response = await request(buildOdooApp({ service: null })).get('/api/v1/odoo/health');
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      configured: false,
      healthy: true,
      skipped: true,
    });
  });
});
