CREATE TYPE "public"."office_cashflow_manual_direction" AS ENUM('inflow', 'outflow');--> statement-breakpoint
CREATE TYPE "public"."office_cashflow_manual_status" AS ENUM('planned', 'confirmed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."office_advance_beneficiary_type" AS ENUM('staff', 'freelancer', 'artist', 'supplier', 'contractor', 'other');--> statement-breakpoint
CREATE TYPE "public"."office_advance_status" AS ENUM('planned', 'paid', 'partially_applied', 'settled', 'refunded', 'waived', 'written_off');--> statement-breakpoint
CREATE TYPE "public"."office_advance_application_kind" AS ENUM('invoice', 'expense', 'refund', 'write_off');--> statement-breakpoint
CREATE TABLE "office_cashflow_manual_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"account_id" uuid,
	"partner_id" uuid,
	"project_id" uuid,
	"entry_date" date NOT NULL,
	"direction" "office_cashflow_manual_direction" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'MUR' NOT NULL,
	"label" text NOT NULL,
	"notes" text,
	"status" "office_cashflow_manual_status" DEFAULT 'planned' NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "office_cashflow_manual_entries_amount_minor_check" CHECK ("office_cashflow_manual_entries"."amount_minor" > 0)
);--> statement-breakpoint
CREATE TABLE "office_advances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"beneficiary_type" "office_advance_beneficiary_type" NOT NULL,
	"beneficiary_name" text NOT NULL,
	"partner_id" uuid,
	"project_id" uuid,
	"bank_statement_line_id" uuid,
	"transaction_id" uuid,
	"label" text NOT NULL,
	"planned_payment_on" date NOT NULL,
	"paid_on" date,
	"original_amount_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'MUR' NOT NULL,
	"status" "office_advance_status" DEFAULT 'planned' NOT NULL,
	"notes" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "office_advances_original_amount_minor_check" CHECK ("office_advances"."original_amount_minor" > 0),
	CONSTRAINT "office_advances_paid_date_check" CHECK (("office_advances"."status" = 'planned' and "office_advances"."paid_on" is null) or ("office_advances"."status" <> 'planned' and "office_advances"."paid_on" is not null))
);--> statement-breakpoint
CREATE TABLE "office_advance_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"advance_id" uuid NOT NULL,
	"applied_on" date NOT NULL,
	"amount_minor" bigint NOT NULL,
	"kind" "office_advance_application_kind" NOT NULL,
	"reference" text,
	"notes" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "office_advance_applications_amount_minor_check" CHECK ("office_advance_applications"."amount_minor" > 0)
);--> statement-breakpoint
ALTER TABLE "office_cashflow_manual_entries" ADD CONSTRAINT "office_cashflow_manual_entries_account_id_office_bank_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."office_bank_accounts"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "office_cashflow_manual_entries" ADD CONSTRAINT "office_cashflow_manual_entries_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "office_cashflow_manual_entries" ADD CONSTRAINT "office_cashflow_manual_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "office_advances" ADD CONSTRAINT "office_advances_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "office_advances" ADD CONSTRAINT "office_advances_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "office_advances" ADD CONSTRAINT "office_advances_bank_statement_line_id_office_bank_statement_lines_id_fk" FOREIGN KEY ("bank_statement_line_id") REFERENCES "public"."office_bank_statement_lines"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "office_advances" ADD CONSTRAINT "office_advances_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "office_advance_applications" ADD CONSTRAINT "office_advance_applications_advance_id_office_advances_id_fk" FOREIGN KEY ("advance_id") REFERENCES "public"."office_advances"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "office_cashflow_manual_entries_account_id_idx" ON "office_cashflow_manual_entries" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "office_cashflow_manual_entries_partner_id_idx" ON "office_cashflow_manual_entries" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "office_cashflow_manual_entries_project_id_idx" ON "office_cashflow_manual_entries" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "office_cashflow_manual_entries_workspace_status_date_idx" ON "office_cashflow_manual_entries" USING btree ("workspace_id","status","entry_date");--> statement-breakpoint
CREATE INDEX "office_advances_partner_id_idx" ON "office_advances" USING btree ("partner_id");--> statement-breakpoint
CREATE INDEX "office_advances_project_id_idx" ON "office_advances" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "office_advances_bank_statement_line_id_idx" ON "office_advances" USING btree ("bank_statement_line_id");--> statement-breakpoint
CREATE INDEX "office_advances_transaction_id_idx" ON "office_advances" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "office_advances_workspace_beneficiary_idx" ON "office_advances" USING btree ("workspace_id","beneficiary_type","beneficiary_name");--> statement-breakpoint
CREATE INDEX "office_advances_workspace_status_date_idx" ON "office_advances" USING btree ("workspace_id","status","planned_payment_on");--> statement-breakpoint
CREATE INDEX "office_advance_applications_advance_id_idx" ON "office_advance_applications" USING btree ("advance_id");--> statement-breakpoint
CREATE INDEX "office_advance_applications_applied_on_idx" ON "office_advance_applications" USING btree ("applied_on");
