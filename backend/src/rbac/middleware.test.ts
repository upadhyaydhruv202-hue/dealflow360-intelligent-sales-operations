import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../auth/types';
import { ERROR_CODES } from '../constants';
import { errorHandler } from '../middleware/error-handler';
import { requestIdMiddleware } from '../middleware/request-id';
import { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, ROLES } from './catalog';
import { authorizeRole, requirePermission } from './middleware';

const logger = pino({ level: 'silent' });

function actor(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'user@example.com',
    displayName: 'Test',
    status: 'active',
    role: ROLES.USER,
    roles: [ROLES.USER],
    permissions: [...DEFAULT_ROLE_PERMISSIONS[ROLES.USER]],
    ...overrides,
  };
}

function buildApp(currentUser?: AuthenticatedUser) {
  const app = express();
  app.use(requestIdMiddleware);
  app.use((req, _res, next) => {
    if (currentUser) {
      req.user = currentUser;
    }
    next();
  });
  app.get('/admin', authorizeRole('ADMIN'), (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/staff-or-admin', authorizeRole('STAFF', 'ADMIN'), (_req, res) => {
    res.json({ ok: true });
  });
  app.get('/reports', requirePermission('reports.generate'), (_req, res) => {
    res.json({ ok: true });
  });
  app.post('/odoo', requirePermission('odoo.write'), (_req, res) => {
    res.json({ ok: true });
  });
  app.post('/inventory/approve', requirePermission('inventory.approve'), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler(logger, false));
  return app;
}

describe('RBAC middleware', () => {
  it('rejects unauthenticated access', async () => {
    const response = await request(buildApp()).get('/admin');
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHENTICATION_ERROR);
  });

  it('allows the correct role and denies a missing role', async () => {
    const allowed = await request(buildApp(actor({ roles: [ROLES.ADMIN], role: ROLES.ADMIN }))).get(
      '/admin',
    );
    const denied = await request(buildApp(actor())).get('/admin');

    expect(allowed.status).toBe(200);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
  });

  it('allows a user who has any of several accepted roles', async () => {
    const staff = await request(buildApp(actor({ roles: [ROLES.STAFF], role: ROLES.STAFF }))).get(
      '/staff-or-admin',
    );
    expect(staff.status).toBe(200);
  });

  it('allows the correct permission and denies a missing permission', async () => {
    const manager = actor({
      role: ROLES.MANAGER,
      roles: [ROLES.MANAGER],
      permissions: [...DEFAULT_ROLE_PERMISSIONS[ROLES.MANAGER]],
    });
    const allowed = await request(buildApp(manager)).get('/reports');
    const denied = await request(buildApp(actor())).get('/reports');

    expect(allowed.status).toBe(200);
    expect(denied.status).toBe(403);
  });

  it('does not let an authenticated USER modify Odoo records', async () => {
    const response = await request(buildApp(actor())).post('/odoo');
    expect(response.status).toBe(403);
    expect(response.body.error.details.requiredPermissions).toEqual(['odoo.write']);
  });

  it('authorizes a newly added permission without middleware changes', async () => {
    const staff = actor({
      roles: [ROLES.STAFF, ROLES.USER],
      permissions: [PERMISSIONS.NOTIFICATIONS_READ, 'inventory.approve'],
    });
    const allowed = await request(buildApp(staff)).post('/inventory/approve');
    const denied = await request(
      buildApp(
        actor({
          role: ROLES.ADMIN,
          roles: [ROLES.ADMIN],
          permissions: [...DEFAULT_ROLE_PERMISSIONS[ROLES.ADMIN]],
        }),
      ),
    ).post('/inventory/approve');

    expect(allowed.status).toBe(200);
    expect(denied.status).toBe(403);
  });
});
