CREATE TYPE "public"."department_type" AS ENUM('income', 'expense', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."financial_type" AS ENUM('income', 'expense');--> statement-breakpoint
CREATE TYPE "public"."partner_type" AS ENUM('client', 'supplier', 'both');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'active', 'paused', 'completed', 'cancelled', 'archived');--> statement-breakpoint
CREATE TYPE "public"."transaction_source" AS ENUM('manual', 'bank_import', 'cashflow_import', 'invoice_import', 'adjustment');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('validated', 'draft', 'cancelled');--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "financial_type" NOT NULL,
	"division_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(160) NOT NULL,
	"type" "department_type" NOT NULL,
	"color" varchar(64),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "divisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"department_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" varchar(160) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_currency" char(3) NOT NULL,
	"to_currency" char(3) DEFAULT 'MUR' NOT NULL,
	"rate_e10" bigint NOT NULL,
	"effective_date" date NOT NULL,
	CONSTRAINT "exchange_rates_rate_e10_check" CHECK ("exchange_rates"."rate_e10" > 0)
);
--> statement-breakpoint
CREATE TABLE "financial_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"role_slug" varchar(160) DEFAULT '' NOT NULL,
	"percentage_bp" integer NOT NULL,
	"amount_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_allocations_percentage_bp_check" CHECK ("financial_allocations"."percentage_bp" >= 0 and "financial_allocations"."percentage_bp" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "partner_type" DEFAULT 'client' NOT NULL,
	"email" text,
	"phone" text,
	"address" text,
	"tax_id" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_budget_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"type" "financial_type" NOT NULL,
	"planned_amount_minor" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "project_budget_lines_planned_amount_minor_check" CHECK ("project_budget_lines"."planned_amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "project_departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"expected_bp" integer,
	CONSTRAINT "project_departments_expected_bp_check" CHECK ("project_departments"."expected_bp" is null or ("project_departments"."expected_bp" >= 0 and "project_departments"."expected_bp" <= 10000))
);
--> statement-breakpoint
CREATE TABLE "project_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"person_name" text NOT NULL,
	"role" text
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "project_status" DEFAULT 'draft' NOT NULL,
	"state" text DEFAULT 'draft' NOT NULL,
	"state_changed_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"owner_department_id" uuid,
	"partner_id" uuid,
	"event_start_date" date,
	"event_end_date" date,
	"venue" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_cost_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_category_id" uuid NOT NULL,
	"target_department_id" uuid NOT NULL,
	"percentage_bp" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "shared_cost_rules_percentage_bp_check" CHECK ("shared_cost_rules"."percentage_bp" >= 0 and "shared_cost_rules"."percentage_bp" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_date" timestamp with time zone NOT NULL,
	"type" "financial_type" NOT NULL,
	"status" "transaction_status" DEFAULT 'draft' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" text,
	"category_id" uuid,
	"partner_id" uuid,
	"project_id" uuid,
	"amount_minor" bigint NOT NULL,
	"original_amount_minor" bigint,
	"original_currency" char(3),
	"exchange_rate_e10" bigint,
	"vat_applicable" boolean DEFAULT false NOT NULL,
	"vat_rate_bp" integer,
	"vat_amount_minor" bigint DEFAULT 0 NOT NULL,
	"total_amount_minor" bigint DEFAULT 0 NOT NULL,
	"payment_method" text,
	"notes" text,
	"source" "transaction_source" DEFAULT 'manual' NOT NULL,
	"external_id" text,
	"created_by_user_id" text,
	"approved_by_user_id" text,
	"approved_at" timestamp with time zone,
	"is_fully_reconciled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transactions_vat_rate_bp_check" CHECK ("transactions"."vat_rate_bp" is null or ("transactions"."vat_rate_bp" >= 0 and "transactions"."vat_rate_bp" <= 10000))
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "divisions" ADD CONSTRAINT "divisions_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "financial_allocations" ADD CONSTRAINT "financial_allocations_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "financial_allocations" ADD CONSTRAINT "financial_allocations_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_budget_lines" ADD CONSTRAINT "project_budget_lines_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_budget_lines" ADD CONSTRAINT "project_budget_lines_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_departments" ADD CONSTRAINT "project_departments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_departments" ADD CONSTRAINT "project_departments_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_department_id_departments_id_fk" FOREIGN KEY ("owner_department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "shared_cost_rules" ADD CONSTRAINT "shared_cost_rules_source_category_id_categories_id_fk" FOREIGN KEY ("source_category_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "shared_cost_rules" ADD CONSTRAINT "shared_cost_rules_target_department_id_departments_id_fk" FOREIGN KEY ("target_department_id") REFERENCES "public"."departments"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "categories_type_idx" ON "categories" USING btree ("type");--> statement-breakpoint
CREATE INDEX "categories_division_id_idx" ON "categories" USING btree ("division_id");--> statement-breakpoint
CREATE INDEX "categories_is_active_idx" ON "categories" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_slug_unique" ON "departments" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "departments_type_idx" ON "departments" USING btree ("type");--> statement-breakpoint
CREATE INDEX "departments_is_active_idx" ON "departments" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "divisions_department_slug_unique" ON "divisions" USING btree ("department_id","slug");--> statement-breakpoint
CREATE INDEX "divisions_department_id_idx" ON "divisions" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "divisions_is_active_idx" ON "divisions" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_rates_currency_date_unique" ON "exchange_rates" USING btree ("from_currency","to_currency","effective_date");--> statement-breakpoint
CREATE INDEX "exchange_rates_effective_date_idx" ON "exchange_rates" USING btree ("effective_date");--> statement-breakpoint
CREATE INDEX "financial_allocations_transaction_id_idx" ON "financial_allocations" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "financial_allocations_department_id_idx" ON "financial_allocations" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "partners_type_idx" ON "partners" USING btree ("type");--> statement-breakpoint
CREATE INDEX "partners_is_active_idx" ON "partners" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "project_budget_lines_project_category_type_unique" ON "project_budget_lines" USING btree ("project_id","category_id","type");--> statement-breakpoint
CREATE INDEX "project_budget_lines_project_id_idx" ON "project_budget_lines" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_budget_lines_category_id_idx" ON "project_budget_lines" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_departments_project_department_unique" ON "project_departments" USING btree ("project_id","department_id");--> statement-breakpoint
CREATE INDEX "project_departments_project_id_idx" ON "project_departments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_departments_department_id_idx" ON "project_departments" USING btree ("department_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_members_project_person_unique" ON "project_members" USING btree ("project_id","person_name");--> statement-breakpoint
CREATE INDEX "project_members_project_id_idx" ON "project_members" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("status");--> statement-breakpoint
CREATE INDEX "projects_state_idx" ON "projects" USING btree ("state");--> statement-breakpoint
CREATE INDEX "projects_is_active_idx" ON "projects" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "projects_owner_department_id_idx" ON "projects" USING btree ("owner_department_id");--> statement-breakpoint
CREATE INDEX "projects_partner_id_idx" ON "projects" USING btree ("partner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shared_cost_rules_source_target_unique" ON "shared_cost_rules" USING btree ("source_category_id","target_department_id");--> statement-breakpoint
CREATE INDEX "shared_cost_rules_source_category_id_idx" ON "shared_cost_rules" USING btree ("source_category_id");--> statement-breakpoint
CREATE INDEX "shared_cost_rules_target_department_id_idx" ON "shared_cost_rules" USING btree ("target_department_id");--> statement-breakpoint
CREATE INDEX "transactions_transaction_date_idx" ON "transactions" USING btree ("transaction_date");--> statement-breakpoint
CREATE INDEX "transactions_type_idx" ON "transactions" USING btree ("type");--> statement-breakpoint
CREATE INDEX "transactions_status_idx" ON "transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "transactions_category_id_idx" ON "transactions" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "transactions_partner_id_idx" ON "transactions" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "transactions_project_id_idx" ON "transactions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "transactions_external_id_idx" ON "transactions" USING btree ("external_id");
