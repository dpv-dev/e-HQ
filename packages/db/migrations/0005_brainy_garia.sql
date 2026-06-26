ALTER TABLE "categories" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "departments" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "divisions" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "exchange_rates" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "financial_allocations" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "office_bank_accounts" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "office_bank_import_batches" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "office_bank_reconciliation_matches" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "office_bank_statement_lines" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "office_cashflow_projection_rows" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "partners" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "project_budget_lines" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "project_departments" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "project_members" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "shared_cost_rules" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "artists" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "calculation_runs" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "catalog_aliases" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "contract_cost_terms" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "contract_extractions" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "contract_scopes" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "contracts" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "earning_allocations" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "earning_track_matches" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "expense_applications" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "fx_rates" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "identity_link" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "import_batches" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "import_issues" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "labels" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "mapping_rules" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "mapping_stats_by_batch" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "normalized_earnings" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "payee_balances" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "payees" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "raw_import_rows" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "releases" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "royalty_rules" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "statement_lines" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "statement_payment_links" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "statements" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "suspense_items" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "track_contributors" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "legacy_id" integer;--> statement-breakpoint
CREATE UNIQUE INDEX "categories_legacy_id_unique" ON "categories" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_legacy_id_unique" ON "departments" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "divisions_legacy_id_unique" ON "divisions" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_rates_legacy_id_unique" ON "exchange_rates" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_allocations_legacy_id_unique" ON "financial_allocations" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "office_bank_accounts_legacy_id_unique" ON "office_bank_accounts" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "office_bank_import_batches_legacy_id_unique" ON "office_bank_import_batches" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "office_bank_reconciliation_matches_legacy_id_unique" ON "office_bank_reconciliation_matches" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "office_bank_statement_lines_legacy_id_unique" ON "office_bank_statement_lines" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "office_cashflow_projection_rows_legacy_id_unique" ON "office_cashflow_projection_rows" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "partners_legacy_id_unique" ON "partners" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_budget_lines_legacy_id_unique" ON "project_budget_lines" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_departments_legacy_id_unique" ON "project_departments" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_members_legacy_id_unique" ON "project_members" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_legacy_id_unique" ON "projects" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shared_cost_rules_legacy_id_unique" ON "shared_cost_rules" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_legacy_id_unique" ON "transactions" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "artists_legacy_id_unique" ON "artists" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "audit_logs_legacy_id_unique" ON "audit_logs" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calculation_runs_legacy_id_unique" ON "calculation_runs" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "catalog_aliases_legacy_id_unique" ON "catalog_aliases" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_cost_terms_legacy_id_unique" ON "contract_cost_terms" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_extractions_legacy_id_unique" ON "contract_extractions" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contract_scopes_legacy_id_unique" ON "contract_scopes" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "contracts_legacy_id_unique" ON "contracts" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "earning_allocations_legacy_id_unique" ON "earning_allocations" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "earning_track_matches_legacy_id_unique" ON "earning_track_matches" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "expense_applications_legacy_id_unique" ON "expense_applications" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "fx_rates_legacy_id_unique" ON "fx_rates" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "identity_link_legacy_id_unique" ON "identity_link" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "import_batches_legacy_id_unique" ON "import_batches" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "import_issues_legacy_id_unique" ON "import_issues" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "labels_legacy_id_unique" ON "labels" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mapping_rules_legacy_id_unique" ON "mapping_rules" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "mapping_stats_by_batch_legacy_id_unique" ON "mapping_stats_by_batch" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "normalized_earnings_legacy_id_unique" ON "normalized_earnings" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payee_balances_legacy_id_unique" ON "payee_balances" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payees_legacy_id_unique" ON "payees" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_legacy_id_unique" ON "payments" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "raw_import_rows_legacy_id_unique" ON "raw_import_rows" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "releases_legacy_id_unique" ON "releases" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "royalty_rules_legacy_id_unique" ON "royalty_rules" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "statement_lines_legacy_id_unique" ON "statement_lines" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "statement_payment_links_legacy_id_unique" ON "statement_payment_links" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "statements_legacy_id_unique" ON "statements" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "suspense_items_legacy_id_unique" ON "suspense_items" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "track_contributors_legacy_id_unique" ON "track_contributors" USING btree ("legacy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tracks_legacy_id_unique" ON "tracks" USING btree ("legacy_id");