-- CreateEnum
CREATE TYPE "AnomalySeverity" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "AnomalyExplanationStatus" AS ENUM ('generated', 'skipped', 'failed', 'unavailable');

-- CreateTable
CREATE TABLE "anomaly_findings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "metric" TEXT NOT NULL,
    "anomaly" BOOLEAN NOT NULL,
    "severity" "AnomalySeverity" NOT NULL,
    "change" DOUBLE PRECISION,
    "evidence" JSONB NOT NULL,
    "explanation" TEXT NOT NULL,
    "recommended_action" TEXT NOT NULL,
    "explanation_status" "AnomalyExplanationStatus" NOT NULL,
    "series" JSONB NOT NULL,
    "metadata" JSONB NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "anomaly_findings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "anomaly_findings_metric_created_at_idx" ON "anomaly_findings"("metric", "created_at");

-- CreateIndex
CREATE INDEX "anomaly_findings_created_by_created_at_idx" ON "anomaly_findings"("created_by", "created_at");

-- CreateIndex
CREATE INDEX "anomaly_findings_anomaly_created_at_idx" ON "anomaly_findings"("anomaly", "created_at");

-- AddForeignKey
ALTER TABLE "anomaly_findings" ADD CONSTRAINT "anomaly_findings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Check constraints
ALTER TABLE "anomaly_findings" ADD CONSTRAINT "anomaly_findings_metric_len_check" CHECK (
    char_length(metric) BETWEEN 1 AND 64
);

ALTER TABLE "anomaly_findings" ADD CONSTRAINT "anomaly_findings_explanation_len_check" CHECK (
    char_length(explanation) BETWEEN 0 AND 4000
);

ALTER TABLE "anomaly_findings" ADD CONSTRAINT "anomaly_findings_recommended_action_len_check" CHECK (
    char_length(recommended_action) BETWEEN 0 AND 2000
);
