import { Prisma, type PrismaClient } from '@prisma/client';

import { type AnalyticsAggregation, type AnalyticsGranularity } from '../constants';
import { mapPrismaError } from '../lib/prisma-error';
import { withTransaction } from '../lib/transaction';
import { roundMetric } from '../integrations/analytics/analytics.time';
import type {
  AnalyticsFilter,
  AnalyticsSeriesPoint,
  ProviderAnalyticsWindow,
  ProviderBreakdownQuery,
  ProviderBreakdownResult,
  ProviderSnapshotResult,
  ProviderTimeseriesQuery,
  ProviderTimeseriesResult,
  StoredAnalyticsFact,
} from '../integrations/analytics/analytics.types';
import type { DbClient } from './types';

interface AggregateRow {
  value: number | string | null;
  samples: number | bigint | string;
}

interface SeriesRow extends AggregateRow {
  bucket: Date | string;
}

interface BreakdownRow extends AggregateRow {
  key: string | null;
}

export class AnalyticsRepository {
  constructor(private readonly db: DbClient) {}

  async ingest(facts: readonly StoredAnalyticsFact[]): Promise<number> {
    if (facts.length === 0) {
      return 0;
    }
    try {
      if ('$transaction' in this.db) {
        await withTransaction(this.db as PrismaClient, async (tx) => {
          await writeFacts(tx, facts);
        });
      } else {
        await writeFacts(this.db, facts);
      }
      return facts.length;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async snapshot(query: ProviderAnalyticsWindow): Promise<ProviderSnapshotResult> {
    const where = buildWhere(query);
    const rows = await this.db.$queryRaw<AggregateRow[]>`
      SELECT ${aggregateExpr(query.aggregation)} AS value, COUNT(*)::bigint AS samples
      FROM analytics_facts f
      WHERE ${where}
    `;
    return toAggregate(rows[0]);
  }

  async timeseries(query: ProviderTimeseriesQuery): Promise<ProviderTimeseriesResult> {
    const where = buildWhere(query);
    const bucket = truncExpr(query.granularity);
    const [countRows, rows] = await Promise.all([
      this.db.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM (
          SELECT ${bucket} AS bucket
          FROM analytics_facts f
          WHERE ${where}
          GROUP BY 1
        ) series
      `,
      this.db.$queryRaw<SeriesRow[]>`
        SELECT
          ${bucket} AS bucket,
          ${aggregateExpr(query.aggregation)} AS value,
          COUNT(*)::bigint AS samples
        FROM analytics_facts f
        WHERE ${where}
        GROUP BY 1
        ORDER BY 1 ASC
        LIMIT ${query.take} OFFSET ${query.skip}
      `,
    ]);

    return {
      totalItems: Number(countRows[0]?.count ?? 0),
      points: rows.map((row) => toPoint(row)),
    };
  }

  async breakdown(query: ProviderBreakdownQuery): Promise<ProviderBreakdownResult> {
    const where = buildWhere(query);
    const keyExpr = Prisma.sql`COALESCE(f.dimensions ->> ${query.groupBy}, '')`;
    const [countRows, rows] = await Promise.all([
      this.db.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(*)::bigint AS count FROM (
          SELECT ${keyExpr} AS key
          FROM analytics_facts f
          WHERE ${where}
          GROUP BY 1
        ) grouped
      `,
      this.db.$queryRaw<BreakdownRow[]>`
        SELECT
          ${keyExpr} AS key,
          ${aggregateExpr(query.aggregation)} AS value,
          COUNT(*)::bigint AS samples
        FROM analytics_facts f
        WHERE ${where}
        GROUP BY 1
        ORDER BY 2 DESC, 1 ASC
        LIMIT ${query.take} OFFSET ${query.skip}
      `,
    ]);

    return {
      totalItems: Number(countRows[0]?.count ?? 0),
      rows: rows.map((row) => ({
        key: row.key ?? '',
        value: roundMetric(Number(row.value ?? 0)),
        samples: Number(row.samples ?? 0),
      })),
    };
  }
}

async function writeFacts(db: DbClient, facts: readonly StoredAnalyticsFact[]): Promise<void> {
  for (const fact of facts) {
    await db.analyticsFact.upsert({
      where: {
        source_eventId: {
          source: fact.source,
          eventId: fact.eventId,
        },
      },
      create: {
        id: fact.id,
        kpiKey: fact.kpiKey,
        source: fact.source,
        eventId: fact.eventId,
        occurredAt: fact.occurredAt,
        ownerId: fact.ownerId,
        value: fact.value,
        dimensions: fact.dimensions,
      },
      update: {
        kpiKey: fact.kpiKey,
        occurredAt: fact.occurredAt,
        ownerId: fact.ownerId,
        value: fact.value,
        dimensions: fact.dimensions,
      },
    });
  }
}

function buildWhere(query: ProviderAnalyticsWindow): Prisma.Sql {
  const clauses: Prisma.Sql[] = [
    Prisma.sql`f.kpi_key = ${query.kpiKey}`,
    Prisma.sql`f.occurred_at >= ${query.from}`,
    Prisma.sql`f.occurred_at < ${query.to}`,
  ];

  if (query.ownerScoped) {
    if (!query.ownerId) {
      clauses.push(Prisma.sql`FALSE`);
    } else {
      clauses.push(Prisma.sql`f.owner_id = ${query.ownerId}::uuid`);
    }
  }

  for (const filter of query.filters) {
    clauses.push(filterClause(filter));
  }

  return Prisma.join(clauses, ' AND ');
}

function filterClause(filter: AnalyticsFilter): Prisma.Sql {
  const field = filter.field;
  if (filter.operator === 'eq') {
    return Prisma.sql`f.dimensions @> ${JSON.stringify({ [field]: filter.value })}::jsonb`;
  }
  if (filter.operator === 'neq') {
    return Prisma.sql`NOT (f.dimensions @> ${JSON.stringify({ [field]: filter.value })}::jsonb)`;
  }
  if (filter.operator === 'in' && Array.isArray(filter.value)) {
    const values = filter.value.map((item) => String(item));
    return Prisma.sql`f.dimensions ->> ${field} = ANY(${values}::text[])`;
  }
  if (filter.operator === 'gte' && typeof filter.value === 'number') {
    return Prisma.sql`(f.dimensions ->> ${field})::numeric >= ${filter.value}`;
  }
  if (filter.operator === 'lte' && typeof filter.value === 'number') {
    return Prisma.sql`(f.dimensions ->> ${field})::numeric <= ${filter.value}`;
  }
  return Prisma.sql`TRUE`;
}

function aggregateExpr(aggregation: AnalyticsAggregation): Prisma.Sql {
  if (aggregation === 'count') {
    return Prisma.sql`COUNT(*)::double precision`;
  }
  if (aggregation === 'sum') {
    return Prisma.sql`COALESCE(SUM(f.value), 0)`;
  }
  if (aggregation === 'avg') {
    return Prisma.sql`COALESCE(AVG(f.value), 0)`;
  }
  if (aggregation === 'min') {
    return Prisma.sql`COALESCE(MIN(f.value), 0)`;
  }
  return Prisma.sql`COALESCE(MAX(f.value), 0)`;
}

function truncExpr(granularity: AnalyticsGranularity): Prisma.Sql {
  if (granularity === 'hour') {
    return Prisma.sql`(date_trunc('hour', f.occurred_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`;
  }
  if (granularity === 'week') {
    return Prisma.sql`(date_trunc('week', f.occurred_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`;
  }
  if (granularity === 'month') {
    return Prisma.sql`(date_trunc('month', f.occurred_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`;
  }
  return Prisma.sql`(date_trunc('day', f.occurred_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')`;
}

function toAggregate(row: AggregateRow | undefined): ProviderSnapshotResult {
  return {
    value: roundMetric(Number(row?.value ?? 0)),
    samples: Number(row?.samples ?? 0),
  };
}

function toPoint(row: SeriesRow): AnalyticsSeriesPoint {
  const bucket = row.bucket instanceof Date ? row.bucket : new Date(row.bucket);
  return {
    bucket: bucket.toISOString(),
    value: roundMetric(Number(row.value ?? 0)),
    samples: Number(row.samples ?? 0),
  };
}
