-- Editable quantity breaks, role authority, and governance thresholds.

CREATE TYPE "DfQuantityAdjustmentKind" AS ENUM ('fixed', 'percent');
CREATE TYPE "DfAuthorityExceedAction" AS ENUM ('allow', 'approval', 'block');

CREATE TABLE "df_quantity_breaks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "product_id" UUID NOT NULL,
    "customer_tier" "DfCustomerTier",
    "min_quantity" DOUBLE PRECISION NOT NULL,
    "max_quantity" DOUBLE PRECISION,
    "adjustment_kind" "DfQuantityAdjustmentKind" NOT NULL,
    "adjustment_value" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "df_quantity_breaks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "df_role_authorities" (
    "role_key" TEXT NOT NULL,
    "max_discount_percent" DOUBLE PRECISION NOT NULL,
    "min_margin_percent" DOUBLE PRECISION NOT NULL,
    "max_price_override_percent" DOUBLE PRECISION NOT NULL,
    "can_negotiate" BOOLEAN NOT NULL DEFAULT true,
    "exceed_action" "DfAuthorityExceedAction" NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "df_role_authorities_pkey" PRIMARY KEY ("role_key")
);

CREATE TABLE "df_governance_config" (
    "id" UUID NOT NULL,
    "cumulative_warning_limit" DOUBLE PRECISION NOT NULL,
    "material_discount_delta_pp" DOUBLE PRECISION NOT NULL,
    "material_total_delta_ratio" DOUBLE PRECISION NOT NULL,
    "high_value_net_total" DOUBLE PRECISION NOT NULL,
    "max_approval_levels" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "df_governance_config_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "df_quantity_breaks_product_id_min_quantity_idx" ON "df_quantity_breaks"("product_id", "min_quantity");

ALTER TABLE "df_quantity_breaks" ADD CONSTRAINT "df_quantity_breaks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "df_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
