-- DealFlow360 operational tables. Governance lives in Postgres; Odoo ids are optional.

CREATE TYPE "DfCustomerTier" AS ENUM ('standard', 'silver', 'gold', 'strategic');
CREATE TYPE "DfBillingType" AS ENUM ('one_time', 'recurring');
CREATE TYPE "DfBillingFrequency" AS ENUM ('monthly', 'quarterly', 'yearly');
CREATE TYPE "DfQuoteStatus" AS ENUM ('draft', 'approval_required', 'approved', 'customer_negotiation', 'confirmed', 'fulfillment', 'billing', 'completed', 'rejected');
CREATE TYPE "DfDiscountDecision" AS ENUM ('allowed', 'warning', 'approval_required', 'rejected');
CREATE TYPE "DfApprovalStatus" AS ENUM ('pending', 'approved', 'rejected', 'skipped', 'invalidated');
CREATE TYPE "DfBillingStatus" AS ENUM ('scheduled', 'invoiced', 'cancelled');
CREATE TYPE "DfRelationKind" AS ENUM ('upsell', 'cross_sell');

CREATE TABLE "df_customers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tier" "DfCustomerTier" NOT NULL DEFAULT 'standard',
    "odoo_partner_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "df_customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "df_products" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "list_price" DOUBLE PRECISION NOT NULL,
    "cost" DOUBLE PRECISION NOT NULL,
    "billing_type" "DfBillingType" NOT NULL,
    "billing_frequency" "DfBillingFrequency",
    "odoo_product_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "df_products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "df_product_relations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "recommended_product_id" UUID NOT NULL,
    "kind" "DfRelationKind" NOT NULL,
    "reason" TEXT NOT NULL,
    "promotion" TEXT,
    "min_quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "df_product_relations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "df_warehouses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "fulfillment_cost_per_unit" DOUBLE PRECISION NOT NULL,
    "odoo_warehouse_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "df_warehouses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "df_stock_levels" (
    "warehouse_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity_on_hand" DOUBLE PRECISION NOT NULL,
    "reserved" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "df_stock_levels_pkey" PRIMARY KEY ("warehouse_id","product_id")
);

CREATE TABLE "df_discount_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "customer_tier" "DfCustomerTier",
    "product_category" TEXT,
    "warning_percent" DOUBLE PRECISION NOT NULL,
    "approval_percent" DOUBLE PRECISION NOT NULL,
    "reject_percent" DOUBLE PRECISION NOT NULL,
    "max_margin_impact_percent" DOUBLE PRECISION NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "df_discount_policies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "df_approval_chains" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "min_risk_score" DOUBLE PRECISION NOT NULL,
    "min_blended_discount_percent" DOUBLE PRECISION NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "df_approval_chains_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "df_approval_chain_steps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chain_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "role_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "df_approval_chain_steps_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "df_quotes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "number" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "owner_id" UUID,
    "status" "DfQuoteStatus" NOT NULL DEFAULT 'draft',
    "list_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "net_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cost_total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "margin_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "blended_discount_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "risk_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "assessment_decision" "DfDiscountDecision" NOT NULL DEFAULT 'allowed',
    "required_chain_id" UUID,
    "portal_token" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "odoo_sale_order_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "df_quotes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "df_quote_lines" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quote_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "list_price" DOUBLE PRECISION NOT NULL,
    "discount_percent" DOUBLE PRECISION NOT NULL,
    "unit_cost" DOUBLE PRECISION NOT NULL,
    "recommended_from_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "df_quote_lines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "df_quote_approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quote_id" UUID NOT NULL,
    "chain_id" UUID NOT NULL,
    "step_order" INTEGER NOT NULL,
    "role_key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "DfApprovalStatus" NOT NULL DEFAULT 'pending',
    "actor_id" UUID,
    "decided_at" TIMESTAMP(3),
    "decision" TEXT,
    "reason" TEXT,
    "previous_values" JSONB,
    "new_values" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "df_quote_approvals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "df_quote_fulfillment_splits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quote_id" UUID NOT NULL,
    "quote_line_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit_fulfillment_cost" DOUBLE PRECISION NOT NULL,
    "is_backorder" BOOLEAN NOT NULL DEFAULT false,
    "is_manual_override" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "df_quote_fulfillment_splits_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "df_quote_backorders" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quote_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "df_quote_backorders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "df_quote_billing_schedules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quote_id" UUID NOT NULL,
    "quote_line_id" UUID NOT NULL,
    "billing_type" "DfBillingType" NOT NULL,
    "frequency" "DfBillingFrequency",
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "DfBillingStatus" NOT NULL DEFAULT 'scheduled',
    "next_billing_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "proration_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refund_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "odoo_invoice_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "df_quote_billing_schedules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "df_quote_revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "quote_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "material_change" BOOLEAN NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "df_quote_revisions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "df_products_sku_key" ON "df_products"("sku");
CREATE INDEX "df_products_category_idx" ON "df_products"("category");
CREATE INDEX "df_product_relations_product_id_idx" ON "df_product_relations"("product_id");
CREATE INDEX "df_discount_policies_priority_idx" ON "df_discount_policies"("priority");
CREATE INDEX "df_approval_chains_priority_idx" ON "df_approval_chains"("priority");
CREATE UNIQUE INDEX "df_approval_chain_steps_chain_id_step_order_key" ON "df_approval_chain_steps"("chain_id", "step_order");
CREATE UNIQUE INDEX "df_quotes_number_key" ON "df_quotes"("number");
CREATE UNIQUE INDEX "df_quotes_portal_token_key" ON "df_quotes"("portal_token");
CREATE INDEX "df_quotes_status_created_at_idx" ON "df_quotes"("status", "created_at");
CREATE INDEX "df_quotes_customer_id_idx" ON "df_quotes"("customer_id");
CREATE INDEX "df_quote_lines_quote_id_idx" ON "df_quote_lines"("quote_id");
CREATE INDEX "df_quote_approvals_quote_id_step_order_idx" ON "df_quote_approvals"("quote_id", "step_order");
CREATE INDEX "df_quote_fulfillment_splits_quote_id_idx" ON "df_quote_fulfillment_splits"("quote_id");
CREATE INDEX "df_quote_backorders_quote_id_product_id_idx" ON "df_quote_backorders"("quote_id", "product_id");
CREATE INDEX "df_quote_billing_schedules_quote_id_idx" ON "df_quote_billing_schedules"("quote_id");
CREATE INDEX "df_quote_revisions_quote_id_version_idx" ON "df_quote_revisions"("quote_id", "version");

ALTER TABLE "df_product_relations" ADD CONSTRAINT "df_product_relations_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "df_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "df_product_relations" ADD CONSTRAINT "df_product_relations_recommended_product_id_fkey" FOREIGN KEY ("recommended_product_id") REFERENCES "df_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "df_stock_levels" ADD CONSTRAINT "df_stock_levels_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "df_warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "df_stock_levels" ADD CONSTRAINT "df_stock_levels_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "df_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "df_approval_chain_steps" ADD CONSTRAINT "df_approval_chain_steps_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "df_approval_chains"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "df_quotes" ADD CONSTRAINT "df_quotes_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "df_customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "df_quotes" ADD CONSTRAINT "df_quotes_required_chain_id_fkey" FOREIGN KEY ("required_chain_id") REFERENCES "df_approval_chains"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "df_quote_lines" ADD CONSTRAINT "df_quote_lines_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "df_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "df_quote_lines" ADD CONSTRAINT "df_quote_lines_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "df_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "df_quote_approvals" ADD CONSTRAINT "df_quote_approvals_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "df_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "df_quote_approvals" ADD CONSTRAINT "df_quote_approvals_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "df_approval_chains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "df_quote_fulfillment_splits" ADD CONSTRAINT "df_quote_fulfillment_splits_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "df_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "df_quote_fulfillment_splits" ADD CONSTRAINT "df_quote_fulfillment_splits_quote_line_id_fkey" FOREIGN KEY ("quote_line_id") REFERENCES "df_quote_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "df_quote_fulfillment_splits" ADD CONSTRAINT "df_quote_fulfillment_splits_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "df_warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "df_quote_backorders" ADD CONSTRAINT "df_quote_backorders_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "df_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "df_quote_billing_schedules" ADD CONSTRAINT "df_quote_billing_schedules_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "df_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "df_quote_billing_schedules" ADD CONSTRAINT "df_quote_billing_schedules_quote_line_id_fkey" FOREIGN KEY ("quote_line_id") REFERENCES "df_quote_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "df_quote_revisions" ADD CONSTRAINT "df_quote_revisions_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "df_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
