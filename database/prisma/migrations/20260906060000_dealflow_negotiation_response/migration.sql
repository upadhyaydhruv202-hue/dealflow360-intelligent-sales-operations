DO $$ BEGIN
  ALTER TYPE "DfNegotiationStatus" ADD VALUE IF NOT EXISTS 'in_review';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "DfNegotiationStatus" ADD VALUE IF NOT EXISTS 'accepted';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "DfNegotiationStatus" ADD VALUE IF NOT EXISTS 'rejected';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "DfNegotiationStatus" ADD VALUE IF NOT EXISTS 'resolved';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "df_negotiation_requests" ADD COLUMN IF NOT EXISTS "quote_version" INTEGER;
ALTER TABLE "df_negotiation_requests" ADD COLUMN IF NOT EXISTS "response_note" TEXT;
ALTER TABLE "df_negotiation_requests" ADD COLUMN IF NOT EXISTS "responded_by" UUID;
ALTER TABLE "df_negotiation_requests" ADD COLUMN IF NOT EXISTS "responded_at" TIMESTAMP(3);
