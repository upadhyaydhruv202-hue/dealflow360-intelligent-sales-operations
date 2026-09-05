-- AlterTable
ALTER TABLE "df_stock_levels" ADD COLUMN "incoming" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "df_products" ADD COLUMN "taxable" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "df_governance_config" ADD COLUMN "tax_rate_percent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "df_governance_config" ADD COLUMN "stale_quote_days" DOUBLE PRECISION NOT NULL DEFAULT 7;
ALTER TABLE "df_governance_config" ADD COLUMN "unusual_discount_percent" DOUBLE PRECISION NOT NULL DEFAULT 25;
ALTER TABLE "df_governance_config" ADD COLUMN "large_deal_net_total" DOUBLE PRECISION NOT NULL DEFAULT 50000;

-- AlterTable
ALTER TABLE "df_quotes" ADD COLUMN "tax_total" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "df_quotes" ADD COLUMN "customer_decision" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "df_quotes" ADD COLUMN "customer_decision_at" TIMESTAMP(3);
ALTER TABLE "df_quotes" ADD COLUMN "customer_decision_comment" TEXT;
ALTER TABLE "df_quotes" ADD COLUMN "customer_decision_version" INTEGER;

-- CreateTable
CREATE TABLE "df_anomalies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "quote_id" UUID,
    "description" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolution" TEXT,
    "resolver_id" TEXT,
    "detected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "df_anomalies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "df_anomalies_status_detected_at_idx" ON "df_anomalies"("status", "detected_at");
CREATE INDEX "df_anomalies_entity_type_entity_id_idx" ON "df_anomalies"("entity_type", "entity_id");
CREATE INDEX "df_anomalies_quote_id_idx" ON "df_anomalies"("quote_id");

-- AddForeignKey
ALTER TABLE "df_anomalies" ADD CONSTRAINT "df_anomalies_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "df_quotes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
