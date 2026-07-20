CREATE TABLE "catalog_contributor_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"track_id" uuid NOT NULL,
	"contributors_json" jsonb NOT NULL,
	"reason" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_contributor_overrides_json_array_check" CHECK (jsonb_typeof("contributors_json") = 'array')
);--> statement-breakpoint
ALTER TABLE "catalog_contributor_overrides" ADD CONSTRAINT "catalog_contributor_overrides_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_contributor_overrides_workspace_idempotency_unique" ON "catalog_contributor_overrides" USING btree ("workspace_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "catalog_contributor_overrides_latest_idx" ON "catalog_contributor_overrides" USING btree ("workspace_id","track_id","created_at","id");--> statement-breakpoint
CREATE INDEX "tracks_catalog_workbench_idx" ON "tracks" USING btree ("workspace_id","catalog_status","legacy_id","id");--> statement-breakpoint
CREATE INDEX "releases_catalog_workbench_idx" ON "releases" USING btree ("workspace_id","release_date","label_id","id");
