import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../auth/types';
import { AuthorizationError, RateLimitError, ValidationError } from '../errors';
import { PERMISSIONS, ROLES } from '../rbac/catalog';
import { canDeliverRealtimeEvent, resolveRequestedChannels } from './realtime.channels';
import { RealtimeHub } from './realtime.hub';
import type { RealtimeEvent } from './realtime.types';

function user(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    email: 'user@example.com',
    displayName: 'User',
    status: 'active',
    role: ROLES.USER,
    roles: [ROLES.USER],
    permissions: [PERMISSIONS.NOTIFICATIONS_READ],
    ...overrides,
  };
}

function event(overrides: Partial<RealtimeEvent> = {}): RealtimeEvent {
  return {
    id: 'evt-1',
    channel: 'notifications',
    type: 'notification.created',
    occurredAt: '2026-01-01T00:00:00.000Z',
    payload: { id: 'n1', title: 'Hello' },
    audience: { userId: '11111111-1111-1111-1111-111111111111' },
    ...overrides,
  };
}

describe('realtime channels', () => {
  it('rejects unknown and wildcard channels', () => {
    const actor = user({ permissions: [PERMISSIONS.JOBS_READ] });
    expect(() => resolveRequestedChannels(actor, ['*'])).toThrow(ValidationError);
    expect(() => resolveRequestedChannels(actor, ['user.created'])).toThrow(ValidationError);
    expect(() => resolveRequestedChannels(actor, ['jobs', 'not-a-channel'])).toThrow(ValidationError);
  });

  it('rejects channels the caller cannot subscribe to', () => {
    const actor = user();
    expect(() => resolveRequestedChannels(actor, ['jobs'])).toThrow(AuthorizationError);
  });

  it('does not deliver another user’s notifications', () => {
    const actor = user();
    expect(
      canDeliverRealtimeEvent(
        event({ audience: { userId: '22222222-2222-2222-2222-222222222222' } }),
        actor,
      ),
    ).toBe(false);
    expect(canDeliverRealtimeEvent(event(), actor)).toBe(true);
  });

  it('delivers owned jobs to the owner and not to another staff user', () => {
    const owner = user({
      permissions: [PERMISSIONS.JOBS_READ],
      roles: [ROLES.STAFF],
      role: ROLES.STAFF,
    });
    const other = user({
      id: '22222222-2222-2222-2222-222222222222',
      permissions: [PERMISSIONS.JOBS_READ],
      roles: [ROLES.STAFF],
      role: ROLES.STAFF,
    });
    const job = event({
      channel: 'jobs',
      type: 'job.updated',
      audience: { userId: owner.id },
      payload: { jobId: 'job-1', status: 'processing' },
    });
    expect(canDeliverRealtimeEvent(job, owner)).toBe(true);
    expect(canDeliverRealtimeEvent(job, other)).toBe(false);
  });
});

describe('RealtimeHub', () => {
  it('delivers only to matching subscribers', () => {
    const hub = new RealtimeHub();
    const received: RealtimeEvent[] = [];
    hub.subscribe({
      user: user(),
      channels: ['notifications'],
      send: (item) => received.push(item),
    });
    hub.publish(event());
    hub.publish(
      event({
        channel: 'jobs',
        type: 'job.updated',
        audience: { userId: '11111111-1111-1111-1111-111111111111' },
      }),
    );
    expect(received).toHaveLength(1);
    expect(received[0]?.channel).toBe('notifications');
  });

  it('projects allowlisted events onto a dashboard subscription', () => {
    const hub = new RealtimeHub();
    const received: RealtimeEvent[] = [];
    hub.subscribe({
      user: user(),
      channels: ['dashboard'],
      send: (item) => received.push(item),
    });
    hub.publish(event());
    expect(received).toHaveLength(1);
    expect(received[0]?.type).toBe('notification.created');
  });

  it('does not project other users’ jobs onto a notifications-only dashboard', () => {
    const hub = new RealtimeHub();
    const received: RealtimeEvent[] = [];
    hub.subscribe({
      user: user(),
      channels: ['dashboard'],
      send: (item) => received.push(item),
    });
    hub.publish(
      event({
        channel: 'jobs',
        type: 'job.updated',
        audience: { userId: '22222222-2222-2222-2222-222222222222' },
        payload: { jobId: 'secret-job' },
      }),
    );
    expect(received).toEqual([]);
  });

  it('limits connections per user', () => {
    const hub = new RealtimeHub({ maxConnectionsPerUser: 1, maxConnections: 10 });
    const actor = user();
    hub.subscribe({ user: actor, channels: ['notifications'], send: () => undefined });
    expect(() =>
      hub.subscribe({ user: actor, channels: ['notifications'], send: () => undefined }),
    ).toThrow(RateLimitError);
  });
});
