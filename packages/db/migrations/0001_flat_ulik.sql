CREATE TYPE "public"."distribution_allocation_status" AS ENUM('preview', 'posted', 'void', 'error');--> statement-breakpoint
CREATE TYPE "public"."distribution_balance_movement_type" AS ENUM('opening', 'period', 'adjustment', 'carry_forward');--> statement-breakpoint
CREATE TYPE "public"."distribution_calculation_status" AS ENUM('pending', 'calculated', 'error', 'excluded');--> statement-breakpoint
CREATE TYPE "public"."distribution_contract_status" AS ENUM('draft', 'active', 'paused', 'expired', 'terminated', 'archived');--> statement-breakpoint
CREATE TYPE "public"."distribution_cost_term_status" AS ENUM('draft', 'active', 'satisfied', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."distribution_identity_status" AS ENUM('pending', 'linked', 'rejected', 'archived');--> statement-breakpoint
CREATE TYPE "public"."distribution_import_status" AS ENUM('draft', 'processing', 'completed', 'failed', 'void');--> statement-breakpoint
CREATE TYPE "public"."distribution_issue_severity" AS ENUM('info', 'warning', 'error');--> statement-breakpoint
CREATE TYPE "public"."distribution_mapping_status" AS ENUM('unmapped', 'matched', 'suspense', 'ignored');--> statement-breakpoint
CREATE TYPE "public"."distribution_payment_status" AS ENUM('recorded', 'edited', 'void', 'reconciled');--> statement-breakpoint
CREATE TYPE "public"."distribution_royalty_rule_status" AS ENUM('draft', 'active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."distribution_statement_status" AS ENUM('draft', 'locked', 'sent', 'paid', 'void');--> statement-breakpoint
CREATE TABLE "artists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"default_payee_id" uuid,
	"default_split_contract_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" varchar(160) NOT NULL,
	"entity_id" text NOT NULL,
	"action" varchar(160) NOT NULL,
	"actor_user_id" text,
	"before" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"after" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calculation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid,
	"status" "distribution_calculation_status" DEFAULT 'pending' NOT NULL,
	"reconciliation_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alias_text" text NOT NULL,
	"artist_id" uuid,
	"payee_id" uuid,
	"label_id" uuid,
	"release_id" uuid,
	"track_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_cost_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"payee_id" uuid,
	"amount" numeric(28, 10) NOT NULL,
	"currency" char(3) NOT NULL,
	"recoupable" boolean DEFAULT true NOT NULL,
	"recovery_method" varchar(160) NOT NULL,
	"recovery_param" numeric(12, 6),
	"status" "distribution_cost_term_status" DEFAULT 'draft' NOT NULL,
	"scope_type" varchar(80),
	"scope_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"raw_text" text NOT NULL,
	"extracted_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contract_scopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"scope_type" varchar(80) NOT NULL,
	"scope_id" text NOT NULL,
	"territory" varchar(80),
	"dsp" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_number" varchar(160),
	"title" text NOT NULL,
	"status" "distribution_contract_status" DEFAULT 'draft' NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"signed_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "earning_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"earning_id" uuid NOT NULL,
	"calculation_run_id" uuid NOT NULL,
	"payee_id" uuid NOT NULL,
	"contract_id" uuid,
	"track_id" uuid,
	"gross_amount" numeric(28, 10) NOT NULL,
	"original_gross_amount" numeric(28, 10) NOT NULL,
	"fx_rate" numeric(24, 10),
	"gross_share" numeric(28, 10) NOT NULL,
	"recoupment_applied" numeric(28, 10) NOT NULL,
	"net_payable" numeric(28, 10) NOT NULL,
	"split_percentage" numeric(12, 6) NOT NULL,
	"currency" char(3) NOT NULL,
	"original_currency" char(3) NOT NULL,
	"status" "distribution_allocation_status" DEFAULT 'preview' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "earning_allocations_split_percentage_check" CHECK ("earning_allocations"."split_percentage" >= 0 and "earning_allocations"."split_percentage" <= 100)
);
--> statement-breakpoint
CREATE TABLE "earning_track_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"earning_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"confidence" numeric(12, 6) NOT NULL,
	"status" "distribution_mapping_status" DEFAULT 'matched' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "earning_track_matches_confidence_check" CHECK ("earning_track_matches"."confidence" >= 0 and "earning_track_matches"."confidence" <= 100)
);
--> statement-breakpoint
CREATE TABLE "expense_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cost_term_id" uuid NOT NULL,
	"payee_id" uuid NOT NULL,
	"statement_id" uuid,
	"calculation_run_id" uuid,
	"amount_applied" numeric(28, 10) NOT NULL,
	"currency" char(3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_currency" char(3) NOT NULL,
	"to_currency" char(3) NOT NULL,
	"rate" numeric(24, 10) NOT NULL,
	"effective_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fx_rates_rate_check" CHECK ("fx_rates"."rate" > 0)
);
--> statement-breakpoint
CREATE TABLE "identity_link" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payee_id" uuid NOT NULL,
	"office_partner_id" uuid NOT NULL,
	"confidence" numeric(12, 6) NOT NULL,
	"status" "distribution_identity_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identity_link_confidence_check" CHECK ("identity_link"."confidence" >= 0 and "identity_link"."confidence" <= 100)
);
--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(160) NOT NULL,
	"file_name" text NOT NULL,
	"status" "distribution_import_status" DEFAULT 'draft' NOT NULL,
	"imported_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"raw_import_row_id" uuid,
	"severity" "distribution_issue_severity" NOT NULL,
	"code" varchar(160) NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"default_split_pct" numeric(5, 2),
	"payee_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "labels_default_split_pct_check" CHECK ("labels"."default_split_pct" is null or ("labels"."default_split_pct" >= 0 and "labels"."default_split_pct" <= 100))
);
--> statement-breakpoint
CREATE TABLE "mapping_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"source" varchar(160) NOT NULL,
	"conditions_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"target_track_id" uuid,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mapping_stats_by_batch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"matched_rows" integer DEFAULT 0 NOT NULL,
	"suspense_rows" integer DEFAULT 0 NOT NULL,
	"ignored_rows" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mapping_stats_by_batch_counts_check" CHECK ("mapping_stats_by_batch"."total_rows" >= 0 and "mapping_stats_by_batch"."matched_rows" >= 0 and "mapping_stats_by_batch"."suspense_rows" >= 0 and "mapping_stats_by_batch"."ignored_rows" >= 0)
);
--> statement-breakpoint
CREATE TABLE "normalized_earnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"raw_import_row_id" uuid,
	"dsp" varchar(160) NOT NULL,
	"gross_amount" numeric(28, 10) NOT NULL,
	"quantity" numeric(24, 6) NOT NULL,
	"currency" char(3) NOT NULL,
	"isrc" varchar(32),
	"upc" varchar(32),
	"raw_title" text,
	"raw_artist" text,
	"raw_label" text,
	"mapping_status" "distribution_mapping_status" DEFAULT 'unmapped' NOT NULL,
	"calculation_status" "distribution_calculation_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payee_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payee_id" uuid NOT NULL,
	"statement_id" uuid,
	"currency" char(3) NOT NULL,
	"opening_balance" numeric(28, 10) NOT NULL,
	"period_net" numeric(28, 10) NOT NULL,
	"closing_balance" numeric(28, 10) NOT NULL,
	"movement_type" "distribution_balance_movement_type" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"linked_artist_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_currency" char(3) DEFAULT 'MUR' NOT NULL,
	"payment_method" text,
	"tax_info" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payee_id" uuid NOT NULL,
	"amount" numeric(28, 10) NOT NULL,
	"currency" char(3) NOT NULL,
	"exchange_rate" numeric(24, 10),
	"status" "distribution_payment_status" DEFAULT 'recorded' NOT NULL,
	"paid_at" timestamp with time zone,
	"reference" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raw_import_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"row_number" integer NOT NULL,
	"raw_data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "raw_import_rows_row_number_check" CHECK ("raw_import_rows"."row_number" > 0)
);
--> statement-breakpoint
CREATE TABLE "releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"upc" varchar(32),
	"label_id" uuid,
	"label_name" text,
	"release_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "royalty_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" uuid NOT NULL,
	"payee_id" uuid NOT NULL,
	"percentage" numeric(12, 6) NOT NULL,
	"scope_type" varchar(80),
	"scope_id" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"effective_from" date,
	"effective_to" date,
	"recoupable" boolean DEFAULT true NOT NULL,
	"status" "distribution_royalty_rule_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "royalty_rules_percentage_check" CHECK ("royalty_rules"."percentage" >= 0 and "royalty_rules"."percentage" <= 100)
);
--> statement-breakpoint
CREATE TABLE "statement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"statement_id" uuid NOT NULL,
	"earning_allocation_id" uuid,
	"track_id" uuid,
	"gross_share" numeric(28, 10) NOT NULL,
	"recoupment_applied" numeric(28, 10) NOT NULL,
	"net_payable" numeric(28, 10) NOT NULL,
	"quantity" numeric(24, 6) NOT NULL,
	"currency" char(3) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statement_payment_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"statement_id" uuid NOT NULL,
	"payment_id" uuid NOT NULL,
	"amount_applied" numeric(28, 10) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payee_id" uuid NOT NULL,
	"calculation_run_id" uuid,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"currency" char(3) NOT NULL,
	"gross_total" numeric(28, 10) NOT NULL,
	"recoupment_total" numeric(28, 10) NOT NULL,
	"net_payable" numeric(28, 10) NOT NULL,
	"amount_due" numeric(28, 10) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "distribution_statement_status" DEFAULT 'draft' NOT NULL,
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suspense_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"earning_id" uuid,
	"amount" numeric(28, 10) NOT NULL,
	"currency" char(3) NOT NULL,
	"reason_code" varchar(160) NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "track_contributors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"artist_id" uuid NOT NULL,
	"role" varchar(160) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"isrc" varchar(32),
	"release_id" uuid,
	"version_title" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artists" ADD CONSTRAINT "artists_default_payee_id_payees_id_fk" FOREIGN KEY ("default_payee_id") REFERENCES "public"."payees"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "artists" ADD CONSTRAINT "artists_default_split_contract_id_contracts_id_fk" FOREIGN KEY ("default_split_contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "calculation_runs" ADD CONSTRAINT "calculation_runs_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "catalog_aliases" ADD CONSTRAINT "catalog_aliases_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "catalog_aliases" ADD CONSTRAINT "catalog_aliases_payee_id_payees_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."payees"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "catalog_aliases" ADD CONSTRAINT "catalog_aliases_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "catalog_aliases" ADD CONSTRAINT "catalog_aliases_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "catalog_aliases" ADD CONSTRAINT "catalog_aliases_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "contract_cost_terms" ADD CONSTRAINT "contract_cost_terms_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "contract_cost_terms" ADD CONSTRAINT "contract_cost_terms_payee_id_payees_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."payees"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "contract_extractions" ADD CONSTRAINT "contract_extractions_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "contract_scopes" ADD CONSTRAINT "contract_scopes_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "earning_allocations" ADD CONSTRAINT "earning_allocations_earning_id_normalized_earnings_id_fk" FOREIGN KEY ("earning_id") REFERENCES "public"."normalized_earnings"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "earning_allocations" ADD CONSTRAINT "earning_allocations_calculation_run_id_calculation_runs_id_fk" FOREIGN KEY ("calculation_run_id") REFERENCES "public"."calculation_runs"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "earning_allocations" ADD CONSTRAINT "earning_allocations_payee_id_payees_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."payees"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "earning_allocations" ADD CONSTRAINT "earning_allocations_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "earning_allocations" ADD CONSTRAINT "earning_allocations_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "earning_track_matches" ADD CONSTRAINT "earning_track_matches_earning_id_normalized_earnings_id_fk" FOREIGN KEY ("earning_id") REFERENCES "public"."normalized_earnings"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "earning_track_matches" ADD CONSTRAINT "earning_track_matches_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expense_applications" ADD CONSTRAINT "expense_applications_cost_term_id_contract_cost_terms_id_fk" FOREIGN KEY ("cost_term_id") REFERENCES "public"."contract_cost_terms"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expense_applications" ADD CONSTRAINT "expense_applications_payee_id_payees_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."payees"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expense_applications" ADD CONSTRAINT "expense_applications_statement_id_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."statements"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "expense_applications" ADD CONSTRAINT "expense_applications_calculation_run_id_calculation_runs_id_fk" FOREIGN KEY ("calculation_run_id") REFERENCES "public"."calculation_runs"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "identity_link" ADD CONSTRAINT "identity_link_payee_id_payees_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."payees"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "identity_link" ADD CONSTRAINT "identity_link_office_partner_id_partners_id_fk" FOREIGN KEY ("office_partner_id") REFERENCES "public"."partners"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "import_issues" ADD CONSTRAINT "import_issues_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "import_issues" ADD CONSTRAINT "import_issues_raw_import_row_id_raw_import_rows_id_fk" FOREIGN KEY ("raw_import_row_id") REFERENCES "public"."raw_import_rows"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_payee_id_payees_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."payees"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "mapping_rules" ADD CONSTRAINT "mapping_rules_target_track_id_tracks_id_fk" FOREIGN KEY ("target_track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "mapping_stats_by_batch" ADD CONSTRAINT "mapping_stats_by_batch_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "normalized_earnings" ADD CONSTRAINT "normalized_earnings_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "normalized_earnings" ADD CONSTRAINT "normalized_earnings_raw_import_row_id_raw_import_rows_id_fk" FOREIGN KEY ("raw_import_row_id") REFERENCES "public"."raw_import_rows"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payee_balances" ADD CONSTRAINT "payee_balances_payee_id_payees_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."payees"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payee_balances" ADD CONSTRAINT "payee_balances_statement_id_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."statements"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payee_id_payees_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."payees"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "raw_import_rows" ADD CONSTRAINT "raw_import_rows_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "releases" ADD CONSTRAINT "releases_label_id_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."labels"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "royalty_rules" ADD CONSTRAINT "royalty_rules_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "royalty_rules" ADD CONSTRAINT "royalty_rules_payee_id_payees_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."payees"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_statement_id_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."statements"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_earning_allocation_id_earning_allocations_id_fk" FOREIGN KEY ("earning_allocation_id") REFERENCES "public"."earning_allocations"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "statement_lines" ADD CONSTRAINT "statement_lines_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "statement_payment_links" ADD CONSTRAINT "statement_payment_links_statement_id_statements_id_fk" FOREIGN KEY ("statement_id") REFERENCES "public"."statements"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "statement_payment_links" ADD CONSTRAINT "statement_payment_links_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_payee_id_payees_id_fk" FOREIGN KEY ("payee_id") REFERENCES "public"."payees"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "statements" ADD CONSTRAINT "statements_calculation_run_id_calculation_runs_id_fk" FOREIGN KEY ("calculation_run_id") REFERENCES "public"."calculation_runs"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "suspense_items" ADD CONSTRAINT "suspense_items_earning_id_normalized_earnings_id_fk" FOREIGN KEY ("earning_id") REFERENCES "public"."normalized_earnings"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "track_contributors" ADD CONSTRAINT "track_contributors_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "track_contributors" ADD CONSTRAINT "track_contributors_artist_id_artists_id_fk" FOREIGN KEY ("artist_id") REFERENCES "public"."artists"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "public"."releases"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "artists_default_payee_id_idx" ON "artists" USING btree ("default_payee_id");--> statement-breakpoint
CREATE INDEX "artists_default_split_contract_id_idx" ON "artists" USING btree ("default_split_contract_id");--> statement-breakpoint
CREATE INDEX "artists_is_active_idx" ON "artists" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "calculation_runs_batch_id_idx" ON "calculation_runs" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "calculation_runs_status_idx" ON "calculation_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "catalog_aliases_alias_text_idx" ON "catalog_aliases" USING btree ("alias_text");--> statement-breakpoint
CREATE INDEX "catalog_aliases_artist_id_idx" ON "catalog_aliases" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "catalog_aliases_payee_id_idx" ON "catalog_aliases" USING btree ("payee_id");--> statement-breakpoint
CREATE INDEX "catalog_aliases_label_id_idx" ON "catalog_aliases" USING btree ("label_id");--> statement-breakpoint
CREATE INDEX "catalog_aliases_release_id_idx" ON "catalog_aliases" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "catalog_aliases_track_id_idx" ON "catalog_aliases" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "contract_cost_terms_contract_id_idx" ON "contract_cost_terms" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "contract_cost_terms_payee_id_idx" ON "contract_cost_terms" USING btree ("payee_id");--> statement-breakpoint
CREATE INDEX "contract_cost_terms_status_idx" ON "contract_cost_terms" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contract_extractions_contract_id_idx" ON "contract_extractions" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "contract_scopes_contract_id_idx" ON "contract_scopes" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "contract_scopes_scope_idx" ON "contract_scopes" USING btree ("scope_type","scope_id");--> statement-breakpoint
CREATE INDEX "contract_scopes_dsp_idx" ON "contract_scopes" USING btree ("dsp");--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_contract_number_unique" ON "contracts" USING btree ("contract_number");--> statement-breakpoint
CREATE INDEX "contracts_status_idx" ON "contracts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contracts_effective_from_idx" ON "contracts" USING btree ("effective_from");--> statement-breakpoint
CREATE INDEX "earning_allocations_earning_id_idx" ON "earning_allocations" USING btree ("earning_id");--> statement-breakpoint
CREATE INDEX "earning_allocations_calculation_run_id_idx" ON "earning_allocations" USING btree ("calculation_run_id");--> statement-breakpoint
CREATE INDEX "earning_allocations_payee_id_idx" ON "earning_allocations" USING btree ("payee_id");--> statement-breakpoint
CREATE INDEX "earning_allocations_contract_id_idx" ON "earning_allocations" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "earning_allocations_track_id_idx" ON "earning_allocations" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "earning_allocations_status_idx" ON "earning_allocations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "earning_track_matches_earning_track_unique" ON "earning_track_matches" USING btree ("earning_id","track_id");--> statement-breakpoint
CREATE INDEX "earning_track_matches_earning_id_idx" ON "earning_track_matches" USING btree ("earning_id");--> statement-breakpoint
CREATE INDEX "earning_track_matches_track_id_idx" ON "earning_track_matches" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "expense_applications_cost_term_id_idx" ON "expense_applications" USING btree ("cost_term_id");--> statement-breakpoint
CREATE INDEX "expense_applications_payee_id_idx" ON "expense_applications" USING btree ("payee_id");--> statement-breakpoint
CREATE INDEX "expense_applications_statement_id_idx" ON "expense_applications" USING btree ("statement_id");--> statement-breakpoint
CREATE INDEX "expense_applications_calculation_run_id_idx" ON "expense_applications" USING btree ("calculation_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_rates_currency_date_unique" ON "fx_rates" USING btree ("from_currency","to_currency","effective_date");--> statement-breakpoint
CREATE INDEX "fx_rates_effective_date_idx" ON "fx_rates" USING btree ("effective_date");--> statement-breakpoint
CREATE UNIQUE INDEX "identity_link_payee_office_partner_unique" ON "identity_link" USING btree ("payee_id","office_partner_id");--> statement-breakpoint
CREATE INDEX "identity_link_payee_id_idx" ON "identity_link" USING btree ("payee_id");--> statement-breakpoint
CREATE INDEX "identity_link_office_partner_id_idx" ON "identity_link" USING btree ("office_partner_id");--> statement-breakpoint
CREATE INDEX "import_batches_source_idx" ON "import_batches" USING btree ("source");--> statement-breakpoint
CREATE INDEX "import_batches_status_idx" ON "import_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "import_batches_imported_at_idx" ON "import_batches" USING btree ("imported_at");--> statement-breakpoint
CREATE INDEX "import_issues_batch_id_idx" ON "import_issues" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "import_issues_raw_import_row_id_idx" ON "import_issues" USING btree ("raw_import_row_id");--> statement-breakpoint
CREATE INDEX "import_issues_severity_idx" ON "import_issues" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "labels_payee_id_idx" ON "labels" USING btree ("payee_id");--> statement-breakpoint
CREATE INDEX "labels_is_active_idx" ON "labels" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "mapping_rules_source_idx" ON "mapping_rules" USING btree ("source");--> statement-breakpoint
CREATE INDEX "mapping_rules_target_track_id_idx" ON "mapping_rules" USING btree ("target_track_id");--> statement-breakpoint
CREATE INDEX "mapping_rules_is_active_idx" ON "mapping_rules" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "mapping_stats_by_batch_batch_unique" ON "mapping_stats_by_batch" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "normalized_earnings_batch_id_idx" ON "normalized_earnings" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "normalized_earnings_raw_import_row_id_idx" ON "normalized_earnings" USING btree ("raw_import_row_id");--> statement-breakpoint
CREATE INDEX "normalized_earnings_isrc_idx" ON "normalized_earnings" USING btree ("isrc");--> statement-breakpoint
CREATE INDEX "normalized_earnings_upc_idx" ON "normalized_earnings" USING btree ("upc");--> statement-breakpoint
CREATE INDEX "normalized_earnings_mapping_status_idx" ON "normalized_earnings" USING btree ("mapping_status");--> statement-breakpoint
CREATE INDEX "normalized_earnings_calculation_status_idx" ON "normalized_earnings" USING btree ("calculation_status");--> statement-breakpoint
CREATE INDEX "payee_balances_payee_currency_idx" ON "payee_balances" USING btree ("payee_id","currency");--> statement-breakpoint
CREATE INDEX "payee_balances_statement_id_idx" ON "payee_balances" USING btree ("statement_id");--> statement-breakpoint
CREATE INDEX "payee_balances_movement_type_idx" ON "payee_balances" USING btree ("movement_type");--> statement-breakpoint
CREATE INDEX "payees_is_active_idx" ON "payees" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "payees_preferred_currency_idx" ON "payees" USING btree ("preferred_currency");--> statement-breakpoint
CREATE INDEX "payments_payee_id_idx" ON "payments" USING btree ("payee_id");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "payments_paid_at_idx" ON "payments" USING btree ("paid_at");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_import_rows_batch_row_unique" ON "raw_import_rows" USING btree ("batch_id","row_number");--> statement-breakpoint
CREATE INDEX "raw_import_rows_batch_id_idx" ON "raw_import_rows" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "releases_label_id_idx" ON "releases" USING btree ("label_id");--> statement-breakpoint
CREATE INDEX "releases_upc_idx" ON "releases" USING btree ("upc");--> statement-breakpoint
CREATE INDEX "royalty_rules_contract_id_idx" ON "royalty_rules" USING btree ("contract_id");--> statement-breakpoint
CREATE INDEX "royalty_rules_payee_id_idx" ON "royalty_rules" USING btree ("payee_id");--> statement-breakpoint
CREATE INDEX "royalty_rules_scope_idx" ON "royalty_rules" USING btree ("scope_type","scope_id");--> statement-breakpoint
CREATE INDEX "royalty_rules_priority_idx" ON "royalty_rules" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "statement_lines_statement_id_idx" ON "statement_lines" USING btree ("statement_id");--> statement-breakpoint
CREATE INDEX "statement_lines_earning_allocation_id_idx" ON "statement_lines" USING btree ("earning_allocation_id");--> statement-breakpoint
CREATE INDEX "statement_lines_track_id_idx" ON "statement_lines" USING btree ("track_id");--> statement-breakpoint
CREATE UNIQUE INDEX "statement_payment_links_statement_payment_unique" ON "statement_payment_links" USING btree ("statement_id","payment_id");--> statement-breakpoint
CREATE INDEX "statement_payment_links_statement_id_idx" ON "statement_payment_links" USING btree ("statement_id");--> statement-breakpoint
CREATE INDEX "statement_payment_links_payment_id_idx" ON "statement_payment_links" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "statements_payee_period_currency_version_unique" ON "statements" USING btree ("payee_id","period_start","period_end","currency","version");--> statement-breakpoint
CREATE INDEX "statements_payee_id_idx" ON "statements" USING btree ("payee_id");--> statement-breakpoint
CREATE INDEX "statements_calculation_run_id_idx" ON "statements" USING btree ("calculation_run_id");--> statement-breakpoint
CREATE INDEX "statements_status_idx" ON "statements" USING btree ("status");--> statement-breakpoint
CREATE INDEX "suspense_items_earning_id_idx" ON "suspense_items" USING btree ("earning_id");--> statement-breakpoint
CREATE INDEX "suspense_items_reason_code_idx" ON "suspense_items" USING btree ("reason_code");--> statement-breakpoint
CREATE INDEX "suspense_items_resolved_idx" ON "suspense_items" USING btree ("resolved");--> statement-breakpoint
CREATE UNIQUE INDEX "track_contributors_track_artist_role_unique" ON "track_contributors" USING btree ("track_id","artist_id","role");--> statement-breakpoint
CREATE INDEX "track_contributors_track_id_idx" ON "track_contributors" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "track_contributors_artist_id_idx" ON "track_contributors" USING btree ("artist_id");--> statement-breakpoint
CREATE INDEX "tracks_isrc_idx" ON "tracks" USING btree ("isrc");--> statement-breakpoint
CREATE INDEX "tracks_release_id_idx" ON "tracks" USING btree ("release_id");