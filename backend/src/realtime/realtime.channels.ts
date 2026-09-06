import type { AuthenticatedUser } from '../auth/types';
import { PERMISSIONS } from '../rbac/catalog';
import { hasAnyPermission, hasPermission } from '../rbac/authorize';
import { canReadJobStatus } from '../jobs/job.service';
import { AuthorizationError, ValidationError } from '../errors';
import type { RealtimeChannel, RealtimeChannelInfo, RealtimeEvent } from './realtime.types';
import { REALTIME_CHANNEL_NAMES } from './realtime.types';

const CHANNEL_CATALOG: readonly RealtimeChannelInfo[] = [
  {
    name: 'jobs',
    description: 'Background job status and progress for jobs the caller may read',
    permission: PERMISSIONS.JOBS_READ,
  },
  {
    name: 'notifications',
    description: 'In-app notifications for the signed-in user',
    permission: PERMISSIONS.NOTIFICATIONS_READ,
  },
  {
    name: 'dashboard',
    description: 'Aggregated live status for jobs, notifications, automation, and documents the caller may see',
    permission: `${PERMISSIONS.JOBS_READ} | ${PERMISSIONS.NOTIFICATIONS_READ} | ${PERMISSIONS.AUTOMATIONS_READ} | ${PERMISSIONS.DOCUMENTS_READ}`,
  },
  {
    name: 'automation',
    description: 'Automation execution status',
    permission: PERMISSIONS.AUTOMATIONS_READ,
  },
  {
    name: 'documents',
    description: 'Document and AI processing status for the caller’s documents',
    permission: PERMISSIONS.DOCUMENTS_READ,
  },
];

const CHANNEL_BY_NAME = new Map(CHANNEL_CATALOG.map((item) => [item.name, item]));

export function listRealtimeChannelCatalog(): RealtimeChannelInfo[] {
  return [...CHANNEL_CATALOG];
}

export function isRealtimeChannel(value: string): value is RealtimeChannel {
  return (REALTIME_CHANNEL_NAMES as readonly string[]).includes(value);
}

export function permissionForChannel(channel: RealtimeChannel): string {
  if (channel === 'dashboard') {
    return PERMISSIONS.JOBS_READ;
  }
  return CHANNEL_BY_NAME.get(channel)?.permission ?? PERMISSIONS.JOBS_READ;
}

export function canSubscribeToChannel(user: AuthenticatedUser, channel: RealtimeChannel): boolean {
  if (channel === 'dashboard') {
    return hasAnyPermission(
      user,
      PERMISSIONS.JOBS_READ,
      PERMISSIONS.NOTIFICATIONS_READ,
      PERMISSIONS.AUTOMATIONS_READ,
      PERMISSIONS.DOCUMENTS_READ,
    );
  }

  return hasPermission(user, permissionForChannel(channel));
}

export function authorizedRealtimeChannels(user: AuthenticatedUser): RealtimeChannel[] {
  return REALTIME_CHANNEL_NAMES.filter((channel) => canSubscribeToChannel(user, channel));
}

export function listAuthorizedChannelInfo(user: AuthenticatedUser): RealtimeChannelInfo[] {
  return CHANNEL_CATALOG.filter((item) => canSubscribeToChannel(user, item.name));
}

export function resolveRequestedChannels(
  user: AuthenticatedUser,
  requested: readonly string[],
): RealtimeChannel[] {
  if (requested.length === 0) {
    return authorizedRealtimeChannels(user);
  }

  const unique: RealtimeChannel[] = [];
  for (const raw of requested) {
    if (!isRealtimeChannel(raw)) {
      throw new ValidationError('Unknown realtime channel', [
        {
          path: 'channels',
          message: `"${raw}" is not an allowlisted realtime channel`,
          code: 'custom',
        },
      ]);
    }
    if (!unique.includes(raw)) {
      unique.push(raw);
    }
  }

  const denied = unique.filter((channel) => !canSubscribeToChannel(user, channel));
  if (denied.length > 0) {
    throw new AuthorizationError('You are not allowed to subscribe to one or more realtime channels', {
      channels: denied,
      requiredPermissions: denied.map((channel) => permissionForChannel(channel)),
    });
  }

  return unique;
}

export function canDeliverRealtimeEvent(event: RealtimeEvent, user: AuthenticatedUser): boolean {
  if (event.channel === 'dashboard') {
    if (event.payload.kind === 'dealflow' || event.payload.source === 'dealflow') {
      return canSubscribeToChannel(user, 'dashboard');
    }
    return canDeliverRealtimeEvent({ ...event, channel: sourceChannelForDashboard(event) }, user);
  }

  if (!canSubscribeToChannel(user, event.channel)) {
    return false;
  }

  if (event.channel === 'automation') {
    return true;
  }

  if (event.channel === 'jobs') {
    return canReadJobStatus({ createdBy: event.audience?.userId }, user);
  }

  if (event.channel === 'notifications' || event.channel === 'documents') {
    return event.audience?.userId === user.id;
  }

  return false;
}

function sourceChannelForDashboard(event: RealtimeEvent): RealtimeChannel {
  const kind = event.payload.kind;
  if (kind === 'job') {
    return 'jobs';
  }
  if (kind === 'notification') {
    return 'notifications';
  }
  if (kind === 'automation') {
    return 'automation';
  }
  if (kind === 'document') {
    return 'documents';
  }
  return 'jobs';
}
