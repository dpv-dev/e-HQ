CREATE TYPE "public"."office_bank_import_source" AS ENUM('sbi', 'mcb', 'csv', 'cashflow', 'pdf');--> statement-breakpoint
CREATE TYPE "public"."office_bank_import_status" AS ENUM('previewed', 'confirmed', 'failed', 'void');--> statement-breakpoint
CREATE TYPE "public"."office_bank_line_direction" AS ENUM('credit', 'debit');--> statement-breakpoint
CREATE TYPE "public"."office_bank_reconciliation_status" AS ENUM('unmatched', 'suggested', 'matched', 'rejected');--> statement-breakpoint
CREATE TABLE "office_bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"bank_name" text NOT NULL,
	"account_label" text NOT NULL,
	"account_reference_hash" text NOT NULL,
	"currency" char(3) NOT NULL,
	"current_balance_minor" bigint DEFAULT 0 NOT NULL,
	"current_balance_mur_minor" bigint,
	"balance_as_of" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "office_bank_import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"source" "office_bank_import_source" NOT NULL,
	"file_name" text NOT NULL,
	"checksum" text NOT NULL,
	"account_id" uuid,
	"period_start" date,
	"period_end" date,
	"opening_balance_minor" bigint,
	"closing_balance_minor" bigint,
	"currency" char(3),
	"accepted_row_count" integer DEFAULT 0 NOT NULL,
	"rejected_row_count" integer DEFAULT 0 NOT NULL,
	"duplicate_row_count" integer DEFAULT 0 NOT NULL,
	"idempotency_fingerprint" text NOT NULL,
	"status" "office_bank_import_status" DEFAULT 'previewed' NOT NULL,
	"imported_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "office_bank_import_batches_row_counts_check" CHECK ("office_bank_import_batches"."accepted_row_count" >= 0 and "office_bank_import_batches"."rejected_row_count" >= 0 and "office_bank_import_batches"."duplicate_row_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "office_bank_reconciliation_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_statement_line_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"confidence_bp" integer NOT NULL,
	"status" "office_bank_reconciliation_status" DEFAULT 'suggested' NOT NULL,
	"approved_by_user_id" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "office_bank_reconciliation_matches_confidence_bp_check" CHECK ("office_bank_reconciliation_matches"."confidence_bp" >= 0 and "office_bank_reconciliation_matches"."confidence_bp" <= 10000)
);
--> statement-breakpoint
CREATE TABLE "office_bank_statement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_batch_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"occurred_on" date NOT NULL,
	"value_on" date,
	"description" text NOT NULL,
	"reference" text,
	"direction" "office_bank_line_direction" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"balance_minor" bigint,
	"currency" char(3) NOT NULL,
	"amount_mur_minor" bigint NOT NULL,
	"balance_mur_minor" bigint,
	"is_duplicate_candidate" boolean DEFAULT false NOT NULL,
	"reconciliation_status" "office_bank_reconciliation_status" DEFAULT 'unmatched' NOT NULL,
	"matched_transaction_id" uuid,
	"raw_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "office_bank_statement_lines_amount_minor_check" CHECK ("office_bank_statement_lines"."amount_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "office_cashflow_projection_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"import_batch_id" uuid,
	"account_id" uuid,
	"workspace_id" text NOT NULL,
	"period_month" char(7) NOT NULL,
	"expected_inflow_minor" bigint DEFAULT 0 NOT NULL,
	"expected_outflow_minor" bigint DEFAULT 0 NOT NULL,
	"expected_closing_balance_minor" bigint DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'MUR' NOT NULL,
	"source_row_ref" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "office_bank_import_batches" ADD CONSTRAINT "office_bank_import_batches_account_id_office_bank_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."office_bank_accounts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "office_bank_reconciliation_matches" ADD CONSTRAINT "office_bank_reconciliation_matches_bank_statement_line_id_office_bank_statement_lines_id_fk" FOREIGN KEY ("bank_statement_line_id") REFERENCES "public"."office_bank_statement_lines"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "office_bank_reconciliation_matches" ADD CONSTRAINT "office_bank_reconciliation_matches_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "office_bank_statement_lines" ADD CONSTRAINT "office_bank_statement_lines_import_batch_id_office_bank_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."office_bank_import_batches"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "office_bank_statement_lines" ADD CONSTRAINT "office_bank_statement_lines_account_id_office_bank_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."office_bank_accounts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "office_bank_statement_lines" ADD CONSTRAINT "office_bank_statement_lines_matched_transaction_id_transactions_id_fk" FOREIGN KEY ("matched_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "office_cashflow_projection_rows" ADD CONSTRAINT "office_cashflow_projection_rows_import_batch_id_office_bank_import_batches_id_fk" FOREIGN KEY ("import_batch_id") REFERENCES "public"."office_bank_import_batches"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "office_cashflow_projection_rows" ADD CONSTRAINT "office_cashflow_projection_rows_account_id_office_bank_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."office_bank_accounts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "office_bank_accounts_reference_unique" ON "office_bank_accounts" USING btree ("workspace_id","account_reference_hash");--> statement-breakpoint
CREATE INDEX "office_bank_accounts_workspace_idx" ON "office_bank_accounts" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "office_bank_accounts_currency_idx" ON "office_bank_accounts" USING btree ("currency");--> statement-breakpoint
CREATE INDEX "office_bank_accounts_is_active_idx" ON "office_bank_accounts" USING btree ("is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "office_bank_import_batches_fingerprint_unique" ON "office_bank_import_batches" USING btree ("workspace_id","idempotency_fingerprint");--> statement-breakpoint
CREATE INDEX "office_bank_import_batches_workspace_idx" ON "office_bank_import_batches" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "office_bank_import_batches_source_idx" ON "office_bank_import_batches" USING btree ("source");--> statement-breakpoint
CREATE INDEX "office_bank_import_batches_account_id_idx" ON "office_bank_import_batches" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "office_bank_import_batches_status_idx" ON "office_bank_import_batches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "office_bank_import_batches_imported_at_idx" ON "office_bank_import_batches" USING btree ("imported_at");--> statement-breakpoint
CREATE UNIQUE INDEX "office_bank_reconciliation_matches_line_tx_unique" ON "office_bank_reconciliation_matches" USING btree ("bank_statement_line_id","transaction_id");--> statement-breakpoint
CREATE INDEX "office_bank_reconciliation_matches_line_id_idx" ON "office_bank_reconciliation_matches" USING btree ("bank_statement_line_id");--> statement-breakpoint
CREATE INDEX "office_bank_reconciliation_matches_transaction_id_idx" ON "office_bank_reconciliation_matches" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "office_bank_reconciliation_matches_status_idx" ON "office_bank_reconciliation_matches" USING btree ("status");--> statement-breakpoint
CREATE INDEX "office_bank_statement_lines_import_batch_id_idx" ON "office_bank_statement_lines" USING btree ("import_batch_id");--> statement-breakpoint
CREATE INDEX "office_bank_statement_lines_account_id_idx" ON "office_bank_statement_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "office_bank_statement_lines_occurred_on_idx" ON "office_bank_statement_lines" USING btree ("occurred_on");--> statement-breakpoint
CREATE INDEX "office_bank_statement_lines_reference_idx" ON "office_bank_statement_lines" USING btree ("reference");--> statement-breakpoint
CREATE INDEX "office_bank_statement_lines_reconciliation_status_idx" ON "office_bank_statement_lines" USING btree ("reconciliation_status");--> statement-breakpoint
CREATE INDEX "office_bank_statement_lines_matched_transaction_id_idx" ON "office_bank_statement_lines" USING btree ("matched_transaction_id");--> statement-breakpoint
CREATE INDEX "office_cashflow_projection_rows_workspace_idx" ON "office_cashflow_projection_rows" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "office_cashflow_projection_rows_import_batch_id_idx" ON "office_cashflow_projection_rows" USING btree ("import_batch_id");--> statement-breakpoint
CREATE INDEX "office_cashflow_projection_rows_account_id_idx" ON "office_cashflow_projection_rows" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "office_cashflow_projection_rows_period_month_idx" ON "office_cashflow_projection_rows" USING btree ("period_month");
