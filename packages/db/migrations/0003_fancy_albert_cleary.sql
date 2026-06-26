ALTER TYPE "public"."distribution_balance_movement_type" ADD VALUE 'statement' BEFORE 'adjustment';--> statement-breakpoint
ALTER TYPE "public"."distribution_balance_movement_type" ADD VALUE 'void_reversal' BEFORE 'adjustment';--> statement-breakpoint
ALTER TYPE "public"."distribution_statement_status" ADD VALUE 'generated' BEFORE 'locked';