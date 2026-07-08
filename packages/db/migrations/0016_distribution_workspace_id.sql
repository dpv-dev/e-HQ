-- Distribution workspace_id
-- Mirrors what migration 0015 did for `transactions`: add nullable, backfill to the
-- single production workspace, then enforce NOT NULL. All Distribution data in this
-- deployment belongs to 'eeee-mu'; future multi-tenant tenants will be separated at
-- import time (import_batches.workspace_id drives the whole chain).
--
-- Tables scoped here are the root entities that the API queries directly with a
-- workspaceId filter. Child tables (raw_import_rows, normalized_earnings, etc.)
-- inherit their workspace through their parent foreign key and do not need their own
-- column at this stage.

-- import_batches
ALTER TABLE "import_batches" ADD COLUMN "workspace_id" text;--> statement-breakpoint
UPDATE "import_batches" SET "workspace_id" = 'eeee-mu' WHERE "workspace_id" IS NULL;--> statement-breakpoint
ALTER TABLE "import_batches" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "import_batches_workspace_id_idx" ON "import_batches" USING btree ("workspace_id");--> statement-breakpoint

-- payees
ALTER TABLE "payees" ADD COLUMN "workspace_id" text;--> statement-breakpoint
UPDATE "payees" SET "workspace_id" = 'eeee-mu' WHERE "workspace_id" IS NULL;--> statement-breakpoint
ALTER TABLE "payees" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "payees_workspace_id_idx" ON "payees" USING btree ("workspace_id");--> statement-breakpoint

-- contracts
ALTER TABLE "contracts" ADD COLUMN "workspace_id" text;--> statement-breakpoint
UPDATE "contracts" SET "workspace_id" = 'eeee-mu' WHERE "workspace_id" IS NULL;--> statement-breakpoint
ALTER TABLE "contracts" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "contracts_workspace_id_idx" ON "contracts" USING btree ("workspace_id");--> statement-breakpoint

-- statements
ALTER TABLE "statements" ADD COLUMN "workspace_id" text;--> statement-breakpoint
UPDATE "statements" SET "workspace_id" = 'eeee-mu' WHERE "workspace_id" IS NULL;--> statement-breakpoint
ALTER TABLE "statements" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "statements_workspace_id_idx" ON "statements" USING btree ("workspace_id");--> statement-breakpoint

-- payments
ALTER TABLE "payments" ADD COLUMN "workspace_id" text;--> statement-breakpoint
UPDATE "payments" SET "workspace_id" = 'eeee-mu' WHERE "workspace_id" IS NULL;--> statement-breakpoint
ALTER TABLE "payments" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "payments_workspace_id_idx" ON "payments" USING btree ("workspace_id");
