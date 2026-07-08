-- Added nullable first: the table is already populated, so a NOT NULL column needs a
-- backfill pass before the constraint can be applied.
ALTER TABLE "transactions" ADD COLUMN "workspace_id" text;--> statement-breakpoint
-- Backfill from the transaction's own bank account when it has one (matches that
-- account's workspace); everything else (manual entries with no account, or an
-- orphaned account_id) falls back to the single production workspace, since this
-- deployment has never had more than one.
UPDATE "transactions" AS t
SET "workspace_id" = COALESCE(
  (SELECT a.workspace_id FROM "office_bank_accounts" a WHERE a.id = t.account_id),
  'eeee-mu'
)
WHERE t."workspace_id" IS NULL;--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "transactions_workspace_id_idx" ON "transactions" USING btree ("workspace_id");