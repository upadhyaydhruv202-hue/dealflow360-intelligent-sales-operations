-- AlterEnum
ALTER TYPE "DfCustomerTier" ADD VALUE IF NOT EXISTS 'platinum';

-- AlterEnum
ALTER TYPE "DfQuoteStatus" ADD VALUE IF NOT EXISTS 'manager_review';
ALTER TYPE "DfQuoteStatus" ADD VALUE IF NOT EXISTS 'finalized';

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DfNegotiationStatus" AS ENUM ('open', 'sent_to_manager', 'manager_revised', 'returned_to_customer', 'agreed', 'withdrawn');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "df_products" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "df_products" ADD COLUMN IF NOT EXISTS "tax_category" TEXT;
ALTER TABLE "df_products" ADD COLUMN IF NOT EXISTS "tax_rate_percent" DOUBLE PRECISION;
ALTER TABLE "df_products" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "df_discount_policies" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "df_discount_policies" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "df_approval_chains" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "df_governance_config" ADD COLUMN IF NOT EXISTS "max_commercial_discount_percent" DOUBLE PRECISION NOT NULL DEFAULT 25;
ALTER TABLE "df_governance_config" ADD COLUMN IF NOT EXISTS "allow_loyalty_stacking" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "df_quotes" ADD COLUMN IF NOT EXISTS "commercially_frozen_at" TIMESTAMP(3);
ALTER TABLE "df_quotes" ADD COLUMN IF NOT EXISTS "commercially_frozen_by" UUID;
ALTER TABLE "df_quotes" ADD COLUMN IF NOT EXISTS "finance_locked_at" TIMESTAMP(3);
ALTER TABLE "df_quotes" ADD COLUMN IF NOT EXISTS "finance_locked_by" UUID;
ALTER TABLE "df_quotes" ADD COLUMN IF NOT EXISTS "active_negotiation_id" UUID;

CREATE TABLE IF NOT EXISTS "df_negotiation_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quote_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_role" TEXT,
    "requested_discount_percent" DOUBLE PRECISION,
    "requested_target_amount" DOUBLE PRECISION,
    "requested_lines" JSONB NOT NULL DEFAULT '[]',
    "note" TEXT NOT NULL,
    "status" "DfNegotiationStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "df_negotiation_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "df_negotiation_requests_quote_id_created_at_idx" ON "df_negotiation_requests"("quote_id", "created_at");
CREATE INDEX IF NOT EXISTS "df_negotiation_requests_customer_id_idx" ON "df_negotiation_requests"("customer_id");
CREATE INDEX IF NOT EXISTS "df_negotiation_requests_status_idx" ON "df_negotiation_requests"("status");

DO $$ BEGIN
  ALTER TABLE "df_negotiation_requests" ADD CONSTRAINT "df_negotiation_requests_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "df_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "df_negotiation_requests" ADD CONSTRAINT "df_negotiation_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "df_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
