-- AlterTable
ALTER TABLE "audit_events" ADD COLUMN "resource_id" TEXT;
ALTER TABLE "audit_events" ADD COLUMN "ip" TEXT;
ALTER TABLE "audit_events" ADD COLUMN "old_value" JSONB;
ALTER TABLE "audit_events" ADD COLUMN "new_value" JSONB;

-- CreateIndex
CREATE INDEX "audit_events_resource_created_at_idx" ON "audit_events"("resource", "created_at");
CREATE INDEX "audit_events_created_at_idx" ON "audit_events"("created_at");

-- Check constraints
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_resource_id_len_check" CHECK (
    resource_id IS NULL OR char_length(resource_id) BETWEEN 1 AND 128
);

ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_ip_len_check" CHECK (
    ip IS NULL OR char_length(ip) BETWEEN 1 AND 64
);
