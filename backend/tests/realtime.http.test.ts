import { createServer, get as httpGet } from 'node:http';
import type { AddressInfo } from 'node:net';

import express from 'express';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../src/auth/types';
import { loadConfig } from '../src/config';
import { API_PREFIX, ERROR_CODES } from '../src/constants';
import { RealtimeController } from '../src/controllers/realtime.controller';
import { errorHandler, requestIdMiddleware } from '../src/middleware';
import { PERMISSIONS, ROLES } from '../src/rbac/catalog';
import { createRealtimeService } from '../src/realtime';
import { createRealtimeRouter } from '../src/routes/realtime.routes';

function actor(permissions: string[], id = '11111111-1111-1111-1111-111111111111'): AuthenticatedUser {
  return {
    id,
    email: 'staff@example.com',
    displayName: 'Staff',
    status: 'active',
    role: ROLES.STAFF,
    roles: [ROLES.STAFF],
    permissions,
  };
}

function buildApp(
  permissions: string[],
  env: Record<string, string> = { FEATURE_REALTIME: 'true' },
) {
  const config = loadConfig({ NODE_ENV: 'test', ...env });
  const realtime = config.features.realtime ? createRealtimeService({ config }) : null;
  const app = express();
  app.use(requestIdMiddleware);
  app.use(express.json());
  app.use(
    API_PREFIX,
    createRealtimeRouter({
      controller: new RealtimeController(realtime),
      authenticate: (req, _res, next) => {
        req.user = actor(permissions);
        next();
      },
    }),
  );
  app.use(errorHandler(pino({ level: 'silent' }), false));
  return { app, realtime };
}

describe('Realtime HTTP (authenticated, no Redis)', () => {
  it('returns FEATURE_DISABLED when the flag is off', async () => {
    const { app } = buildApp([PERMISSIONS.JOBS_READ], { FEATURE_REALTIME: 'false' });
    const response = await request(app).get('/api/v1/realtime/channels');
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe(ERROR_CODES.FEATURE_DISABLED);
  });

  it('lists allowlisted channels for the caller', async () => {
    const { app } = buildApp([PERMISSIONS.JOBS_READ, PERMISSIONS.NOTIFICATIONS_READ]);
    const response = await request(app).get('/api/v1/realtime/channels');
    expect(response.status).toBe(200);
    expect(response.body.data.channels.map((item: { name: string }) => item.name)).toEqual([
      'jobs',
      'notifications',
      'dashboard',
    ]);
  });

  it('rejects unknown event channels', async () => {
    const { app } = buildApp([PERMISSIONS.JOBS_READ]);
    const response = await request(app).get('/api/v1/realtime/events').query({ channels: 'user.created' });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
  });

  it('rejects unauthorized channels', async () => {
    const { app } = buildApp([PERMISSIONS.NOTIFICATIONS_READ]);
    const response = await request(app).get('/api/v1/realtime/events').query({ channels: 'jobs' });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe(ERROR_CODES.AUTHORIZATION_ERROR);
  });

  it('streams an allowlisted job event to the owner', async () => {
    const { app, realtime } = buildApp([PERMISSIONS.JOBS_READ]);
    const server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = server.address() as AddressInfo;

    try {
      const body = await new Promise<string>((resolve, reject) => {
        let settled = false;
        const succeed = (value: string) => {
          if (settled) {
            return;
          }
          settled = true;
          resolve(value);
        };
        const fail = (error: Error) => {
          if (settled || (error as NodeJS.ErrnoException).code === 'ECONNRESET') {
            return;
          }
          settled = true;
          reject(error);
        };
        const req = httpGet(
          {
            hostname: '127.0.0.1',
            port,
            path: '/api/v1/realtime/events?channels=jobs',
            headers: { Accept: 'text/event-stream' },
          },
          (res) => {
            expect(res.headers['content-type']).toMatch(/text\/event-stream/);
            let data = '';
            let published = false;
            res.setEncoding('utf8');
            res.on('data', (chunk: string) => {
              data += chunk;
              if (!published && data.includes('event: ready')) {
                published = true;
                void realtime?.publishJob({
                  jobId: 'job-live',
                  type: 'pdf.generate',
                  status: 'processing',
                  attempts: 1,
                  createdAt: new Date().toISOString(),
                  progress: 40,
                  createdBy: '11111111-1111-1111-1111-111111111111',
                });
              }
              if (data.includes('event: job.updated')) {
                req.destroy();
                succeed(data);
              }
            });
            res.on('error', fail);
          },
        );
        req.on('error', fail);
      });

      expect(body).toContain('event: job.updated');
      expect(body).toContain('job-live');
      expect(body).not.toContain('createdBy');
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
      await realtime?.close();
    }
  });
});
