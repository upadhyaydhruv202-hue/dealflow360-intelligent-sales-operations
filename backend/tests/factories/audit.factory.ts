import { randomUUID } from 'node:crypto';

import { AUDIT_ACTIONS } from '../../src/constants';
import type { AuditEventRecord } from '../../src/audit/audit.types';
import type { Repositories } from '../../src/repositories';

export function buildAuditEvent(overrides: Partial<AuditEventRecord> = {}): AuditEventRecord {
  const userId = overrides.userId ?? overrides.actorId;
  return {
    id: overrides.id ?? randomUUID(),
    userId,
    actorId: overrides.actorId ?? userId,
    action: overrides.action ?? AUDIT_ACTIONS.USER_LOGIN,
    resource: overrides.resource ?? 'user',
    resourceId: overrides.resourceId ?? userId ?? randomUUID(),
    request: overrides.request ?? overrides.metadata ?? { source: 'factory' },
    metadata: overrides.metadata ?? overrides.request ?? { source: 'factory' },
    status: overrides.status ?? 'succeeded',
    requestId: overrides.requestId ?? `req-${randomUUID()}`,
    ip: overrides.ip ?? '203.0.113.8',
    oldValue: overrides.oldValue,
    newValue: overrides.newValue,
    createdAt: overrides.createdAt ?? new Date(),
  };
}

export async function createAuditEvent(repos: Repositories, overrides: Partial<AuditEventRecord> = {}) {
  const record = buildAuditEvent(overrides);
  await repos.audit.record(record);
  return record;
}
