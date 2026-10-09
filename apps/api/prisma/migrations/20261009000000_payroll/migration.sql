-- CreateEnum
CREATE TYPE "PayItemKind" AS ENUM ('ALLOWANCE', 'DEDUCTION');

-- AlterTable
ALTER TABLE "employees" ADD COLUMN     "tax_table_id" UUID;

-- CreateTable
CREATE TABLE "tax_tables" (
    "id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_brackets" (
    "id" UUID NOT NULL,
    "tax_table_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "up_to" DECIMAL(12,2),
    "rate" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_brackets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_insurance_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "rate" DECIMAL(5,2) NOT NULL,
    "cap" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_insurance_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_pay_items" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "kind" "PayItemKind" NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_pay_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_brackets_tax_table_id_position_key" ON "tax_brackets"("tax_table_id", "position");

-- CreateIndex
CREATE INDEX "employee_pay_items_employee_id_position_idx" ON "employee_pay_items"("employee_id", "position");

-- CreateIndex
CREATE INDEX "employees_tax_table_id_idx" ON "employees"("tax_table_id");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_tax_table_id_fkey" FOREIGN KEY ("tax_table_id") REFERENCES "tax_tables"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_brackets" ADD CONSTRAINT "tax_brackets_tax_table_id_fkey" FOREIGN KEY ("tax_table_id") REFERENCES "tax_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employee_pay_items" ADD CONSTRAINT "employee_pay_items_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- HAND-WRITTEN (not expressible in schema.prisma) --------------------------

-- Table names unique, case-insensitive.
CREATE UNIQUE INDEX "tax_tables_name_lower_key" ON "tax_tables"(lower("name"));

-- At most one default table (the service keeps at least one).
CREATE UNIQUE INDEX "tax_tables_one_default_key" ON "tax_tables"("is_default") WHERE "is_default";

-- Value checks.
ALTER TABLE "tax_brackets"
  ADD CONSTRAINT "tax_brackets_rate_check" CHECK ("rate" >= 0 AND "rate" <= 100),
  ADD CONSTRAINT "tax_brackets_up_to_check" CHECK ("up_to" IS NULL OR "up_to" > 0),
  ADD CONSTRAINT "tax_brackets_position_check" CHECK ("position" >= 0);

ALTER TABLE "social_insurance_settings"
  ADD CONSTRAINT "social_insurance_settings_single_row_check" CHECK ("id" = 1),
  ADD CONSTRAINT "social_insurance_settings_rate_check" CHECK ("rate" >= 0 AND "rate" <= 100),
  ADD CONSTRAINT "social_insurance_settings_cap_check" CHECK ("cap" IS NULL OR "cap" > 0);

ALTER TABLE "employee_pay_items"
  ADD CONSTRAINT "employee_pay_items_amount_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "employee_pay_items_position_check" CHECK ("position" >= 0);
