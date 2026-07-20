CREATE INDEX "normalized_earnings_mapping_workbench_idx"
ON "normalized_earnings" USING btree ("workspace_id", "mapping_status", "legacy_id", "id");--> statement-breakpoint

CREATE INDEX "earning_track_matches_workbench_idx"
ON "earning_track_matches" USING btree ("earning_id", "status", "confidence", "id");
