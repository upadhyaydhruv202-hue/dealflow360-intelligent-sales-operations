import { EventEmitter } from 'node:events';

import { describe, expect, it } from 'vitest';

import { loadConfig } from '../config';
import { FeatureDisabledError } from '../errors';
import { PERMISSIONS, ROLES } from '../rbac/catalog';
import type { AuthenticatedUser } from '../auth/types';
import { RealtimeHub } from './realtime.hub';
import { createRealtimeService } from './realtime.service';
import type { RealtimeTransportEnvelope } from './realtime.types';

function actor(permissions: string[]): AuthenticatedUser {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'manager@example.com',
    displayName: 'Manager',
    status: 'active',
    role: ROLES.MANAGER,
    roles: [ROLES.MANAGER],
    permissions,
  };
}

describe('RealtimeService', () => {
  it('stays silent when FEATURE_REALTIME is off', async () => {
    const service = createRealtimeService({
      config: loadConfig({ NODE_ENV: 'test', FEATURE_REALTIME: 'false' }),
    });
    expect(() => service.listChannels(actor([PERMISSIONS.JOBS_READ]))).toThrow(FeatureDisabledError);
    await expect(
      service.publish({
        channel: 'jobs',
        type: 'job.updated',
        payload: { jobId: 'job-1' },
      }),
    ).resolves.toMatchObject({ channel: 'jobs' });
  });

  it('lists only allowlisted channels the caller may use', () => {
    const service = createRealtimeService({
      config: loadConfig({ NODE_ENV: 'test', FEATURE_REALTIME: 'true' }),
    });
    const listed = service.listChannels(actor([PERMISSIONS.NOTIFICATIONS_READ]));
    expect(listed.channels.map((item) => item.name)).toEqual(['notifications', 'dashboard']);
  });

  it('does not re-broadcast its own Redis messages', async () => {
    const delivered: string[] = [];
    const hub = new RealtimeHub();
    let captured: ((envelope: RealtimeTransportEnvelope) => void) | undefined;
    let published: RealtimeTransportEnvelope | undefined;
    const service = createRealtimeService({
      config: loadConfig({ NODE_ENV: 'test', FEATURE_REALTIME: 'true' }),
      hub,
      subscribeRedis: true,
      transport: {
        async publish(envelope) {
          published = envelope;
        },
        async subscribe(handler) {
          captured = handler;
        },
        async close() {
          return;
        },
      },
    });

    hub.subscribe({
      user: actor([PERMISSIONS.NOTIFICATIONS_READ]),
      channels: ['notifications'],
      send: (event) => delivered.push(event.id),
    });

    const event = await service.publish({
      channel: 'notifications',
      type: 'notification.created',
      audience: { userId: '11111111-1111-1111-1111-111111111111' },
      payload: { id: 'n1' },
    });
    expect(delivered).toEqual([event.id]);
    expect(published?.event.id).toBe(event.id);

    captured?.({
      sourceId: published?.sourceId ?? 'self',
      event: { ...event, id: 'dup' },
    });
    expect(delivered).toEqual([event.id]);

    captured?.({
      sourceId: 'other-process',
      event: { ...event, id: 'from-worker' },
    });
    expect(delivered).toEqual([event.id, 'from-worker']);
  });

  it('writes SSE ready and job updates to the response', async () => {
    const service = createRealtimeService({
      config: loadConfig({ NODE_ENV: 'test', FEATURE_REALTIME: 'true' }),
    });
    const res = new FakeSseResponse();
    const connected = service.connect(actor([PERMISSIONS.JOBS_READ]), res as never, ['jobs']);

    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.output()).toContain('event: ready');

    await service.publishJob({
      jobId: 'job-live',
      type: 'pdf.generate',
      status: 'processing',
      attempts: 1,
      createdAt: new Date().toISOString(),
      progress: 40,
      createdBy: '11111111-1111-1111-1111-111111111111',
    });

    expect(res.output()).toContain('event: job.updated');
    expect(res.output()).toContain('job-live');
    expect(res.output()).not.toContain('createdBy');

    res.emit('close');
    await connected;
    await service.close();
  });
});

class FakeSseResponse extends EventEmitter {
  statusCode = 200;
  headers: Record<string, string> = {};
  chunks: string[] = [];
  writableEnded = false;
  socket = {
    setTimeout() {
      return undefined;
    },
    setNoDelay() {
      return undefined;
    },
  };

  status(code: number) {
    this.statusCode = code;
    return this;
  }

  setHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }

  flushHeaders() {
    return undefined;
  }

  write(chunk: string) {
    this.chunks.push(chunk);
    return true;
  }

  output() {
    return this.chunks.join('');
  }
}
