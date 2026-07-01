-- Classified-ledger push (Sophie): statutory account mapping on categories + a source value.
-- IF NOT EXISTS guards keep this safe to re-apply and independent of prior hand-written drift.
ALTER TYPE "public"."transaction_source" ADD VALUE IF NOT EXISTS 'ledger_import';--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "account_code" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "account_label" text;
