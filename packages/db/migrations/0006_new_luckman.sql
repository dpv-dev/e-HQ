ALTER TYPE "public"."distribution_allocation_status" ADD VALUE 'calculated' BEFORE 'posted';--> statement-breakpoint
ALTER TYPE "public"."distribution_allocation_status" ADD VALUE 'statemented' BEFORE 'posted';--> statement-breakpoint
ALTER TYPE "public"."distribution_calculation_status" ADD VALUE 'allocated' BEFORE 'calculated';--> statement-breakpoint
ALTER TYPE "public"."distribution_calculation_status" ADD VALUE 'suspense' BEFORE 'error';--> statement-breakpoint
ALTER TYPE "public"."distribution_calculation_status" ADD VALUE 'completed' BEFORE 'error';--> statement-breakpoint
ALTER TYPE "public"."distribution_calculation_status" ADD VALUE 'failed' BEFORE 'error';--> statement-breakpoint
ALTER TYPE "public"."distribution_calculation_status" ADD VALUE 'running' BEFORE 'error';--> statement-breakpoint
ALTER TYPE "public"."distribution_cost_term_status" ADD VALUE 'non_recoverable' BEFORE 'satisfied';--> statement-breakpoint
ALTER TYPE "public"."distribution_import_status" ADD VALUE 'normalized' BEFORE 'completed';--> statement-breakpoint
ALTER TYPE "public"."distribution_mapping_status" ADD VALUE 'unmatched' BEFORE 'matched';--> statement-breakpoint
ALTER TABLE "financial_allocations" DROP CONSTRAINT "financial_allocations_percentage_bp_check";--> statement-breakpoint
ALTER TABLE "financial_allocations" ALTER COLUMN "percentage_bp" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "financial_allocations" ADD CONSTRAINT "financial_allocations_percentage_bp_check" CHECK ("financial_allocations"."percentage_bp" is null or ("financial_allocations"."percentage_bp" >= 0 and "financial_allocations"."percentage_bp" <= 10000));