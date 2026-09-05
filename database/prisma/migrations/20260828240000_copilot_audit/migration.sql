-- CreateEnum
CREATE TYPE "CopilotMessageRole" AS ENUM ('user', 'assistant');

-- CreateTable
CREATE TABLE "copilot_conversations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "copilot_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copilot_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "conversation_id" UUID NOT NULL,
    "role" "CopilotMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "tool_calls" JSONB,
    "confidence" DOUBLE PRECISION,
    "evidence" TEXT,
    "error_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copilot_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "request" JSONB NOT NULL,
    "status" TEXT NOT NULL,
    "request_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "copilot_conversations_user_id_updated_at_idx" ON "copilot_conversations"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "copilot_messages_conversation_id_created_at_idx" ON "copilot_messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_user_id_created_at_idx" ON "audit_events"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_action_created_at_idx" ON "audit_events"("action", "created_at");

-- AddForeignKey
ALTER TABLE "copilot_conversations" ADD CONSTRAINT "copilot_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copilot_messages" ADD CONSTRAINT "copilot_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "copilot_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "copilot_messages" ADD CONSTRAINT "copilot_messages_content_len_check" CHECK (
    char_length(content) BETWEEN 1 AND 8000
);

ALTER TABLE "copilot_messages" ADD CONSTRAINT "copilot_messages_evidence_len_check" CHECK (
    evidence IS NULL OR char_length(evidence) BETWEEN 1 AND 2000
);

ALTER TABLE "copilot_messages" ADD CONSTRAINT "copilot_messages_error_code_len_check" CHECK (
    error_code IS NULL OR char_length(error_code) BETWEEN 1 AND 64
);

ALTER TABLE "copilot_messages" ADD CONSTRAINT "copilot_messages_confidence_check" CHECK (
    confidence IS NULL OR (confidence >= 0 AND confidence <= 1)
);

ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_action_len_check" CHECK (
    char_length(action) BETWEEN 1 AND 128
);

ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_resource_len_check" CHECK (
    resource IS NULL OR char_length(resource) BETWEEN 1 AND 64
);

ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_status_len_check" CHECK (
    char_length(status) BETWEEN 1 AND 64
);

ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_request_id_len_check" CHECK (
    request_id IS NULL OR char_length(request_id) BETWEEN 1 AND 128
);
