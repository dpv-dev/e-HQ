ALTER TYPE "public"."distribution_cost_term_status" ADD VALUE 'open' BEFORE 'satisfied';--> statement-breakpoint
ALTER TYPE "public"."distribution_cost_term_status" ADD VALUE 'partially_recovered' BEFORE 'satisfied';--> statement-breakpoint
ALTER TYPE "public"."distribution_cost_term_status" ADD VALUE 'recovered' BEFORE 'satisfied';--> statement-breakpoint
ALTER TYPE "public"."distribution_cost_term_status" ADD VALUE 'deleted';