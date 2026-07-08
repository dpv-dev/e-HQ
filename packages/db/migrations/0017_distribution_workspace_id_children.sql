-- Distribution workspace_id — child tables (migration 0017)
-- Adds workspace_id to the remaining Distribution domain root tables.
-- Child/leaf tables (earning_allocations, statement_lines, statement_payment_links,
-- expense_applications) derive their workspace from their parent via FK and do not
-- need a dedicated column; filtering through the parent is sufficient.
--
-- All existing rows are backfilled to 'eeee-mu' (single production workspace).

-- calculation_runs (root of allocation runs — independently queryable)
ALTER TABLE "calculation_runs" ADD COLUMN "workspace_id" text;--> statement-breakpoint
UPDATE "calculation_runs" SET "workspace_id" = 'eeee-mu' WHERE "workspace_id" IS NULL;--> statement-breakpoint
ALTER TABLE "calculation_runs" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "calculation_runs_workspace_id_idx" ON "calculation_runs" USING btree ("workspace_id");--> statement-breakpoint

-- normalized_earnings (root of import data — high-volume, direct filtering needed)
ALTER TABLE "normalized_earnings" ADD COLUMN "workspace_id" text;--> statement-breakpoint
UPDATE "normalized_earnings" SET "workspace_id" = COALESCE(
  (SELECT b.workspace_id FROM import_batches b WHERE b.id = normalized_earnings.batch_id),
  'eeee-mu'
) WHERE "workspace_id" IS NULL;--> statement-breakpoint
ALTER TABLE "normalized_earnings" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "normalized_earnings_workspace_id_idx" ON "normalized_earnings" USING btree ("workspace_id");--> statement-breakpoint

-- suspense_items (allocation results — independently queryable)
ALTER TABLE "suspense_items" ADD COLUMN "workspace_id" text;--> statement-breakpoint
UPDATE "suspense_items" SET "workspace_id" = 'eeee-mu' WHERE "workspace_id" IS NULL;--> statement-breakpoint
ALTER TABLE "suspense_items" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "suspense_items_workspace_id_idx" ON "suspense_items" USING btree ("workspace_id");--> statement-breakpoint

-- releases (catalog — workspace-specific)
ALTER TABLE "releases" ADD COLUMN "workspace_id" text;--> statement-breakpoint
UPDATE "releases" SET "workspace_id" = 'eeee-mu' WHERE "workspace_id" IS NULL;--> statement-breakpoint
ALTER TABLE "releases" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "releases_workspace_id_idx" ON "releases" USING btree ("workspace_id");--> statement-breakpoint

-- tracks (catalog — workspace-specific)
ALTER TABLE "tracks" ADD COLUMN "workspace_id" text;--> statement-breakpoint
UPDATE "tracks" SET "workspace_id" = 'eeee-mu' WHERE "workspace_id" IS NULL;--> statement-breakpoint
ALTER TABLE "tracks" ALTER COLUMN "workspace_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "tracks_workspace_id_idx" ON "tracks" USING btree ("workspace_id");
