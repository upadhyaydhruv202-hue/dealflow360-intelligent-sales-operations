import { randomUUID } from 'node:crypto';

import { AUDIT } from '../constants';
import { DatabaseError } from '../errors';
import { parsePagination, toPaginatedResult, type PaginatedResult } from '../repositories/query';
import { getAuditContext } from '../utils/request-context';
import type { AppLogger } from '../utils/logger';
import { redactAuditValue } from './audit.redact';
import type {
  AuditEventRecord,
  AuditEventView,
  AuditListQuery,
  AuditRecordInput,
  AuditStore,
} from './audit.types';
import { toAuditEventView } from './audit.types';

const ACTOR_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function clip(value: string | undefined, max: number): string | undefined {
  if (!value) {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed.slice(0, max);
}

function asActorId(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !ACTOR_ID_PATTERN.test(trimmed)) {
    return undefined;
  }

  return trimmed;
}

export class AuditService {
  readonly records: AuditEventRecord[] = [];

  constructor(
    private readonly store?: AuditStore | null,
    private readonly logger?: Pick<AppLogger, 'warn'> | null,
  ) {}

  async record(input: AuditRecordInput): Promise<void> {
    try {
      const event = this.normalize(input);
      this.records.push(event);
      await this.store?.record(event);
    } catch (error) {
      this.logger?.warn({ err: error, action: input.action }, 'Audit persist failed');
    }
  }

  async list(query: AuditListQuery = {}): Promise<PaginatedResult<AuditEventView>> {
    if (!this.store?.list) {
      throw new DatabaseError('Audit store is not configured');
    }

    const result = await this.store.list(query);
    return {
      items: result.items.map(toAuditEventView),
      meta: result.meta,
    };
  }

  private normalize(input: AuditRecordInput): AuditEventRecord {
    const context = getAuditContext();
    const actorId = asActorId(input.actorId ?? input.userId ?? context.actorId);
    const metadata = redactAuditValue(input.metadata ?? input.request) ?? {};
    const createdAt = new Date();

    return {
      id: randomUUID(),
      userId: actorId,
      actorId,
      action: clip(input.action, AUDIT.MAX_ACTION_CHARS) ?? 'unknown',
      resource: clip(input.resource, AUDIT.MAX_RESOURCE_CHARS),
      resourceId: clip(input.resourceId, AUDIT.MAX_RESOURCE_ID_CHARS),
      request: metadata,
      metadata,
      status: clip(input.status, AUDIT.MAX_STATUS_CHARS) ?? 'succeeded',
      requestId: clip(input.requestId ?? context.requestId, 128),
      ip: clip(input.ip ?? context.ip, AUDIT.MAX_IP_CHARS),
      oldValue: input.oldValue === undefined ? undefined : redactAuditValue(input.oldValue),
      newValue: input.newValue === undefined ? undefined : redactAuditValue(input.newValue),
      createdAt,
    };
  }
}

export function createMemoryAuditStore(): AuditStore & { events: AuditEventRecord[] } {
  const events: AuditEventRecord[] = [];
  return {
    events,
    async record(input) {
      events.push(input);
    },
    async list(query) {
      const pagination = parsePagination(query);
      const filtered = events.filter((event) => matchesQuery(event, query));
      const sorted = [...filtered].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
      const items = sorted.slice(pagination.skip, pagination.skip + pagination.take);
      return toPaginatedResult(items, pagination, sorted.length);
    },
  };
}

function matchesQuery(event: AuditEventRecord, query: AuditListQuery): boolean {
  const actorId = event.actorId ?? event.userId;
  if (query.actorId && actorId !== query.actorId) {
    return false;
  }
  if (query.action && event.action !== query.action) {
    return false;
  }
  if (query.resource && event.resource !== query.resource) {
    return false;
  }
  if (query.resourceId && event.resourceId !== query.resourceId) {
    return false;
  }
  if (query.requestId && event.requestId !== query.requestId) {
    return false;
  }
  if (query.from && event.createdAt < query.from) {
    return false;
  }
  if (query.to && event.createdAt > query.to) {
    return false;
  }
  return true;
}
