-- CreateEnum
CREATE TYPE "NotificationCategory" AS ENUM ('order_updates', 'security_alerts', 'reports', 'marketing', 'system');

-- CreateEnum
CREATE TYPE "NotificationPriority" AS ENUM ('low', 'normal', 'high', 'critical');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('email', 'in_app', 'sms', 'push', 'webhook');

-- CreateEnum
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('queued', 'processing', 'sent', 'failed', 'retrying');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "category" "NotificationCategory" NOT NULL DEFAULT 'system';
ALTER TABLE "notifications" ADD COLUMN "priority" "NotificationPriority" NOT NULL DEFAULT 'normal';
ALTER TABLE "notifications" ADD COLUMN "metadata" JSONB;
ALTER TABLE "notifications" ADD COLUMN "delivery_id" UUID;

-- CreateTable
CREATE TABLE "notification_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationDeliveryStatus" NOT NULL,
    "priority" "NotificationPriority" NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "template" TEXT NOT NULL,
    "recipient" JSONB NOT NULL,
    "data" JSONB NOT NULL,
    "metadata" JSONB,
    "user_id" UUID,
    "idempotency_key" TEXT,
    "error_message" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "provider" TEXT,
    "provider_message_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "category" "NotificationCategory" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_delivery_id_key" ON "notifications"("delivery_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_deliveries_idempotency_key_key" ON "notification_deliveries"("idempotency_key");

-- CreateIndex
CREATE INDEX "notification_deliveries_status_created_at_idx" ON "notification_deliveries"("status", "created_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_user_id_created_at_idx" ON "notification_deliveries"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notification_deliveries_channel_status_idx" ON "notification_deliveries"("channel", "status");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_category_channel_key" ON "notification_preferences"("user_id", "category", "channel");

-- CreateIndex
CREATE INDEX "notification_preferences_user_id_idx" ON "notification_preferences"("user_id");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "notification_deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_deliveries" ADD CONSTRAINT "notification_deliveries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
