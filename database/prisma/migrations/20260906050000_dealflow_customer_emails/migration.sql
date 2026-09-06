-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DfQuoteEmailEvent" AS ENUM ('prelim_invoice', 'final_invoice');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DfQuoteEmailStatus" AS ENUM ('pending', 'not_configured', 'sent', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "df_quote_email_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quote_id" UUID NOT NULL,
    "event_type" "DfQuoteEmailEvent" NOT NULL,
    "quote_version" INTEGER NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "status" "DfQuoteEmailStatus" NOT NULL DEFAULT 'pending',
    "idempotency_key" TEXT NOT NULL,
    "notification_delivery_id" UUID,
    "provider" TEXT,
    "provider_message_id" TEXT,
    "error_message" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "df_quote_email_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "df_quote_email_deliveries_idempotency_key_key" ON "df_quote_email_deliveries"("idempotency_key");
CREATE INDEX IF NOT EXISTS "df_quote_email_deliveries_quote_id_event_type_idx" ON "df_quote_email_deliveries"("quote_id", "event_type");
CREATE INDEX IF NOT EXISTS "df_quote_email_deliveries_status_created_at_idx" ON "df_quote_email_deliveries"("status", "created_at");

DO $$ BEGIN
  ALTER TABLE "df_quote_email_deliveries" ADD CONSTRAINT "df_quote_email_deliveries_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "df_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
