CREATE TABLE "api_import_previews" (
	"preview_id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"kind" varchar(64) NOT NULL,
	"payload_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "api_import_previews_workspace_kind_idx" ON "api_import_previews" USING btree ("workspace_id","kind");
--> statement-breakpoint
CREATE INDEX "api_import_previews_expires_at_idx" ON "api_import_previews" USING btree ("expires_at");
