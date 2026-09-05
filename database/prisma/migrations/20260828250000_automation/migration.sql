-- CreateEnum
CREATE TYPE "AutomationRuleSource" AS ENUM ('manual', 'ai');

-- CreateEnum
CREATE TYPE "AutomationExecutionStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'skipped');

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "trigger" TEXT NOT NULL,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "source" "AutomationRuleSource" NOT NULL DEFAULT 'manual',
    "allow_destructive" BOOLEAN NOT NULL DEFAULT false,
    "validated_at" TIMESTAMP(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_executions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rule_id" UUID NOT NULL,
    "event_id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "status" "AutomationExecutionStatus" NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "payload" JSONB NOT NULL,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_action_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "execution_id" UUID NOT NULL,
    "action_index" INTEGER NOT NULL,
    "action_type" TEXT NOT NULL,
    "status" "AutomationExecutionStatus" NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "result" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_action_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automation_rules_trigger_enabled_priority_idx" ON "automation_rules"("trigger", "enabled", "priority");

-- CreateIndex
CREATE INDEX "automation_rules_created_at_idx" ON "automation_rules"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "automation_executions_rule_id_event_id_key" ON "automation_executions"("rule_id", "event_id");

-- CreateIndex
CREATE INDEX "automation_executions_status_created_at_idx" ON "automation_executions"("status", "created_at");

-- CreateIndex
CREATE INDEX "automation_executions_trigger_created_at_idx" ON "automation_executions"("trigger", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "automation_action_runs_execution_id_action_index_key" ON "automation_action_runs"("execution_id", "action_index");

-- CreateIndex
CREATE INDEX "automation_action_runs_execution_id_created_at_idx" ON "automation_action_runs"("execution_id", "created_at");

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_action_runs" ADD CONSTRAINT "automation_action_runs_execution_id_fkey" FOREIGN KEY ("execution_id") REFERENCES "automation_executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_name_len_check" CHECK (
    char_length(name) BETWEEN 1 AND 120
);

ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_description_len_check" CHECK (
    description IS NULL OR char_length(description) BETWEEN 1 AND 500
);

ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_trigger_len_check" CHECK (
    char_length(trigger) BETWEEN 1 AND 64
);

ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_priority_check" CHECK (
    priority BETWEEN 0 AND 10000
);

ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_event_id_len_check" CHECK (
    char_length(event_id) BETWEEN 1 AND 128
);

ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_trigger_len_check" CHECK (
    char_length(trigger) BETWEEN 1 AND 64
);

ALTER TABLE "automation_executions" ADD CONSTRAINT "automation_executions_attempt_check" CHECK (
    attempt >= 0 AND max_attempts BETWEEN 1 AND 10
);

ALTER TABLE "automation_action_runs" ADD CONSTRAINT "automation_action_runs_action_type_len_check" CHECK (
    char_length(action_type) BETWEEN 1 AND 64
);

ALTER TABLE "automation_action_runs" ADD CONSTRAINT "automation_action_runs_action_index_check" CHECK (
    action_index >= 0
);
