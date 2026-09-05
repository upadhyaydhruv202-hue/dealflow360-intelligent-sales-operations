import type { Prisma } from '@prisma/client';

import { NotFoundError } from '../errors';
import { mapPrismaError } from '../lib/prisma-error';
import { parsePagination, toPaginatedResult } from './query';
import type { AnomalyInsight, AnomalyStore, AnomalyStoreListQuery } from '../anomaly/anomaly.types';
import type { DbClient } from './types';

export class AnomalyRepository implements AnomalyStore {
  constructor(private readonly db: DbClient) {}

  async save(finding: AnomalyInsight): Promise<AnomalyInsight> {
    try {
      const row = await this.db.anomalyFinding.create({
        data: {
          id: finding.id,
          metric: finding.metric,
          anomaly: finding.anomaly,
          severity: finding.severity,
          change: finding.change,
          evidence: finding.evidence as unknown as Prisma.InputJsonValue,
          explanation: finding.explanation,
          recommendedAction: finding.recommendedAction,
          explanationStatus: finding.explanationStatus,
          series: (finding.series ?? []) as unknown as Prisma.InputJsonValue,
          metadata: (finding.metadata ?? {}) as unknown as Prisma.InputJsonValue,
          createdBy: asUserId(finding.createdBy),
        },
      });
      return toInsight(row);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async get(id: string): Promise<AnomalyInsight | null> {
    try {
      const row = await this.db.anomalyFinding.findUnique({ where: { id } });
      return row ? toInsight(row) : null;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async getOrThrow(id: string): Promise<AnomalyInsight> {
    const finding = await this.get(id);
    if (!finding) {
      throw new NotFoundError('Anomaly finding not found', { id });
    }
    return finding;
  }

  async list(query: AnomalyStoreListQuery) {
    try {
      const pagination = parsePagination(query);
      const where: Prisma.AnomalyFindingWhereInput = {
        ...(query.metric ? { metric: query.metric } : {}),
        ...(query.anomaly === undefined ? {} : { anomaly: query.anomaly }),
        ...(query.createdBy ? { createdBy: query.createdBy } : {}),
      };
      const [rows, totalItems] = await Promise.all([
        this.db.anomalyFinding.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: pagination.skip,
          take: pagination.take,
        }),
        this.db.anomalyFinding.count({ where }),
      ]);
      return toPaginatedResult(rows.map(toInsight), pagination, totalItems);
    } catch (error) {
      mapPrismaError(error);
    }
  }
}

interface AnomalyFindingRow {
  id: string;
  metric: string;
  anomaly: boolean;
  severity: AnomalyInsight['severity'];
  change: number | null;
  evidence: unknown;
  explanation: string | null;
  recommendedAction: string | null;
  explanationStatus: AnomalyInsight['explanationStatus'];
  series: unknown;
  metadata: unknown;
  createdBy: string | null;
  createdAt: Date;
}

function toInsight(row: AnomalyFindingRow): AnomalyInsight {
  return {
    id: row.id,
    metric: row.metric,
    anomaly: row.anomaly,
    severity: row.severity,
    change: row.change,
    evidence: row.evidence as AnomalyInsight['evidence'],
    explanation: row.explanation ?? '',
    recommendedAction: row.recommendedAction ?? '',
    explanationStatus: row.explanationStatus,
    series: Array.isArray(row.series) ? (row.series as AnomalyInsight['series']) : [],
    metadata: asMetadata(row.metadata),
    createdAt: row.createdAt.toISOString(),
    createdBy: row.createdBy ?? undefined,
  };
}

function asMetadata(value: unknown): AnomalyInsight['metadata'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  const metadata: NonNullable<AnomalyInsight['metadata']> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean' || entry === null) {
      metadata[key] = entry;
    }
  }
  return metadata;
}

function asUserId(value: string | undefined): string | undefined {
  if (!value || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    return undefined;
  }

  return value;
}
