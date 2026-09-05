-- Generic analytics facts. KPI definitions live in code (AnalyticsRegistry), not in this table.
-- Query path is always kpi_key + occurred_at range. Do not aggregate this table without those predicates.

CREATE TABLE "analytics_facts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "kpi_key" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "owner_id" UUID,
    "value" DOUBLE PRECISION NOT NULL,
    "dimensions" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_facts_pkey" PRIMARY KEY ("id")
);

-- Idempotent ingest: one fact per (source, event_id).
CREATE UNIQUE INDEX "analytics_facts_source_event_id_key" ON "analytics_facts"("source", "event_id");

-- Primary aggregation path: equality on kpi_key plus a bounded occurred_at range, then date_trunc.
CREATE INDEX "analytics_facts_kpi_key_occurred_at_idx" ON "analytics_facts"("kpi_key", "occurred_at");

-- Source-scoped maintenance and demo seed lookups.
CREATE INDEX "analytics_facts_source_occurred_at_idx" ON "analytics_facts"("source", "occurred_at");

-- Owner-scoped KPIs filter owner_id together with time. Partial index skips shared (NULL) rows.
CREATE INDEX "analytics_facts_owner_id_occurred_at_idx" ON "analytics_facts"("owner_id", "occurred_at") WHERE "owner_id" IS NOT NULL;

-- Equality filters use jsonb @> (jsonb_path_ops). Do not ILIKE/contains on dimensions.
CREATE INDEX "analytics_facts_dimensions_idx" ON "analytics_facts" USING GIN ("dimensions" jsonb_path_ops);

ALTER TABLE "analytics_facts" ADD CONSTRAINT "analytics_facts_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "analytics_facts" ADD CONSTRAINT "analytics_facts_kpi_key_check" CHECK (
    char_length(kpi_key) BETWEEN 1 AND 64
    AND kpi_key ~ '^[a-z][a-z0-9._-]*$'
);

ALTER TABLE "analytics_facts" ADD CONSTRAINT "analytics_facts_source_check" CHECK (
    char_length(source) BETWEEN 1 AND 64
    AND source ~ '^[a-z][a-z0-9._-]*$'
);

ALTER TABLE "analytics_facts" ADD CONSTRAINT "analytics_facts_event_id_check" CHECK (
    char_length(event_id) BETWEEN 1 AND 128
);

ALTER TABLE "analytics_facts" ADD CONSTRAINT "analytics_facts_value_check" CHECK (
    value = value
    AND value BETWEEN -1000000000000::double precision AND 1000000000000::double precision
);
