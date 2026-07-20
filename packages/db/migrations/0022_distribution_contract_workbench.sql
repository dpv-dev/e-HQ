CREATE TABLE "contract_rule_set_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" text NOT NULL,
	"track_id" uuid NOT NULL,
	"base_contract_id" uuid NOT NULL,
	"rules_json" jsonb NOT NULL,
	"effective_from" date NOT NULL,
	"effective_to" date,
	"currency" char(3) NOT NULL,
	"reason" text NOT NULL,
	"created_by_user_id" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "contract_rule_set_overrides_json_array_check" CHECK (jsonb_typeof("rules_json") = 'array' and jsonb_array_length("rules_json") > 0),
	CONSTRAINT "contract_rule_set_overrides_dates_check" CHECK ("effective_to" is null or "effective_to" >= "effective_from")
);--> statement-breakpoint
ALTER TABLE "contract_rule_set_overrides" ADD CONSTRAINT "contract_rule_set_overrides_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "contract_rule_set_overrides" ADD CONSTRAINT "contract_rule_set_overrides_base_contract_id_contracts_id_fk" FOREIGN KEY ("base_contract_id") REFERENCES "public"."contracts"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "contract_rule_set_overrides_workspace_track_idempotency_unique" ON "contract_rule_set_overrides" USING btree ("workspace_id","track_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "contract_rule_set_overrides_latest_idx" ON "contract_rule_set_overrides" USING btree ("workspace_id","track_id","created_at","id");--> statement-breakpoint
CREATE INDEX "royalty_rules_contract_workbench_idx" ON "royalty_rules" USING btree ("scope_type","scope_id","status","contract_id","priority");--> statement-breakpoint
CREATE INDEX "contract_cost_terms_workbench_idx" ON "contract_cost_terms" USING btree ("contract_id","status","currency");
