CREATE INDEX IF NOT EXISTS "suspense_items_workbench_page_idx"
  ON "suspense_items" USING btree ("workspace_id", "resolved", "created_at", "id");

CREATE TABLE IF NOT EXISTS "suspense_resolution_overrides" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" text NOT NULL,
  "suspense_id" uuid NOT NULL,
  "resolution" varchar(40) NOT NULL,
  "target_id" text,
  "note" text NOT NULL,
  "created_by_user_id" text NOT NULL,
  "idempotency_key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "suspense_resolution_overrides_suspense_id_suspense_items_id_fk"
    FOREIGN KEY ("suspense_id") REFERENCES "public"."suspense_items"("id")
    ON DELETE restrict ON UPDATE cascade
);

CREATE UNIQUE INDEX IF NOT EXISTS "suspense_resolution_overrides_workspace_idempotency_unique"
  ON "suspense_resolution_overrides" USING btree ("workspace_id", "idempotency_key");

CREATE INDEX IF NOT EXISTS "suspense_resolution_overrides_suspense_idx"
  ON "suspense_resolution_overrides" USING btree ("workspace_id", "suspense_id", "created_at");
