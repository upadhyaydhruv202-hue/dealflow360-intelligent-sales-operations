import type { PaginatedResult, PaginationInput } from '../repositories/query';

export interface AuditRecordInput {
  userId?: string;
  actorId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  request?: unknown;
  metadata?: unknown;
  status?: string;
  requestId?: string;
  ip?: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export interface AuditEventRecord {
  id: string;
  userId?: string;
  actorId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  request: unknown;
  metadata: unknown;
  status: string;
  requestId?: string;
  ip?: string;
  oldValue?: unknown;
  newValue?: unknown;
  createdAt: Date;
}

export interface AuditEventView {
  id: string;
  actorId: string | null;
  action: string;
  resource: string | null;
  resourceId: string | null;
  timestamp: string;
  requestId: string | null;
  ip: string | null;
  metadata: unknown;
  oldValue: unknown;
  newValue: unknown;
  status: string;
}

export interface AuditListQuery extends PaginationInput {
  actorId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  requestId?: string;
  from?: Date;
  to?: Date;
}

export interface AuditStore {
  record(input: AuditEventRecord): Promise<void>;
  list?(query: AuditListQuery): Promise<PaginatedResult<AuditEventRecord>>;
}

export function toAuditEventView(event: AuditEventRecord): AuditEventView {
  const actorId = event.actorId ?? event.userId ?? null;
  const metadata = event.metadata ?? event.request ?? {};

  return {
    id: event.id,
    actorId,
    action: event.action,
    resource: event.resource ?? null,
    resourceId: event.resourceId ?? null,
    timestamp: event.createdAt.toISOString(),
    requestId: event.requestId ?? null,
    ip: event.ip ?? null,
    metadata,
    oldValue: event.oldValue ?? null,
    newValue: event.newValue ?? null,
    status: event.status,
  };
}
