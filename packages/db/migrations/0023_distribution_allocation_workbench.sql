CREATE INDEX "import_batches_allocation_workbench_idx" ON "import_batches" USING btree ("workspace_id","imported_at","created_at","legacy_id","id");--> statement-breakpoint
CREATE INDEX "normalized_earnings_allocation_workbench_idx" ON "normalized_earnings" USING btree ("workspace_id","batch_id","mapping_status","calculation_status","id");--> statement-breakpoint
CREATE INDEX "normalized_earnings_allocation_ready_idx" ON "normalized_earnings" USING btree ("workspace_id","mapping_status","calculation_status","batch_id","id");--> statement-breakpoint
CREATE INDEX "earning_track_matches_allocation_workbench_idx" ON "earning_track_matches" USING btree ("earning_id","status","track_id","confidence","id");--> statement-breakpoint
CREATE INDEX "earning_allocations_earning_status_run_idx" ON "earning_allocations" USING btree ("earning_id","status","calculation_run_id");--> statement-breakpoint
CREATE INDEX "earning_allocations_run_status_currency_idx" ON "earning_allocations" USING btree ("calculation_run_id","status","currency");--> statement-breakpoint
CREATE INDEX "suspense_items_allocation_workbench_idx" ON "suspense_items" USING btree ("workspace_id","resolved","reason_code","earning_id");
