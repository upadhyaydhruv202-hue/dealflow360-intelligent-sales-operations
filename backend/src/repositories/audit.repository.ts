import type { Prisma } from '@prisma/client';

import { mapPrismaError } from '../lib/prisma-error';
import { parsePagination, toPaginatedResult } from './query';
import type { DbClient } from './types';
import type { AuditEventRecord, AuditListQuery, AuditStore } from '../audit/audit.types';

export class AuditRepository implements AuditStore {
  constructor(private readonly db: DbClient) {}

  async record(input: AuditEventRecord): Promise<void> {
    try {
      await this.db.auditEvent.create({
        data: {
          id: input.id,
          userId: input.userId ?? input.actorId ?? null,
          action: input.action,
          resource: input.resource ?? null,
          resourceId: input.resourceId ?? null,
          request: (input.request ?? input.metadata ?? {}) as Prisma.InputJsonValue,
          status: input.status,
          requestId: input.requestId ?? null,
          ip: input.ip ?? null,
          oldValue:
            input.oldValue === undefined || input.oldValue === null
              ? undefined
              : (input.oldValue as Prisma.InputJsonValue),
          newValue:
            input.newValue === undefined || input.newValue === null
              ? undefined
              : (input.newValue as Prisma.InputJsonValue),
          createdAt: input.createdAt,
        },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async list(query: AuditListQuery) {
    try {
      const pagination = parsePagination(query);
      const where = toWhere(query);
      const [rows, totalItems] = await Promise.all([
        this.db.auditEvent.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: pagination.skip,
          take: pagination.take,
        }),
        this.db.auditEvent.count({ where }),
      ]);

      return toPaginatedResult(rows.map(toRecord), pagination, totalItems);
    } catch (error) {
      mapPrismaError(error);
    }
  }
}

function toWhere(query: AuditListQuery): Prisma.AuditEventWhereInput {
  const createdAt: Prisma.DateTimeFilter = {};
  if (query.from) {
    createdAt.gte = query.from;
  }
  if (query.to) {
    createdAt.lte = query.to;
  }

  return {
    userId: query.actorId,
    action: query.action,
    resource: query.resource,
    resourceId: query.resourceId,
    requestId: query.requestId,
    createdAt: Object.keys(createdAt).length > 0 ? createdAt : undefined,
  };
}

function toRecord(row: {
  id: string;
  userId: string | null;
  action: string;
  resource: string | null;
  resourceId: string | null;
  request: Prisma.JsonValue;
  status: string;
  requestId: string | null;
  ip: string | null;
  oldValue: Prisma.JsonValue | null;
  newValue: Prisma.JsonValue | null;
  createdAt: Date;
}): AuditEventRecord {
  return {
    id: row.id,
    userId: row.userId ?? undefined,
    actorId: row.userId ?? undefined,
    action: row.action,
    resource: row.resource ?? undefined,
    resourceId: row.resourceId ?? undefined,
    request: row.request,
    metadata: row.request,
    status: row.status,
    requestId: row.requestId ?? undefined,
    ip: row.ip ?? undefined,
    oldValue: row.oldValue ?? undefined,
    newValue: row.newValue ?? undefined,
    createdAt: row.createdAt,
  };
}
