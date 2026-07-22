import { createHash, randomUUID } from "crypto";
import type { Pool } from "pg";
import { sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type {
  CostTermStatusUpdate,
  DistributionFxRateInput,
  DistributionSuspenseItemInsert,
  EarningAllocationInsert,
  ExpenseApplicationInsert,
  PayeeBalanceLedgerInput,
  PayeeBalanceInsertPlan,
  StatementInsertPlan,
  StatementLineInsertPlan
} from "@ehq/domain-distribution";
import type { AuthenticatedApiUser } from "./auth.js";

export type JsonRecord = Readonly<Record<string, unknown>>;
export type ApiMutationStatus = 200 | 501;
export type ApiPersistenceHttpStatus = 401 | 403 | 409 | 500;

export interface ApiMutationResult<TBody extends JsonRecord> {
  readonly status: ApiMutationStatus;
  readonly body: TBody;
}

export interface ApiMutationResponse extends JsonRecord {
  readonly auditEventId: string | null;
}

export interface DisabledWriteBody extends JsonRecord {
  readonly error: "action_not_enabled_yet";
  readonly message: string;
  readonly action: string;
}

export interface ApiPersistenceHttpError extends Error {
  readonly status: ApiPersistenceHttpStatus;
  readonly code: string;
  readonly context: readonly string[];
}

export interface ApiImportPreviewRow {
  readonly id: string;
  readonly rowNumber: number;
  readonly rawData: Readonly<Record<string, string>>;
}

export interface DistributionImportPreviewRecord {
  readonly previewId: string;
  readonly workspaceId: string;
  readonly source: "kontor" | "routenote";
  readonly fileName: string;
  readonly checksum: string;
  readonly idempotencyFingerprint: string;
  readonly rows: readonly ApiImportPreviewRow[];
  readonly createdAtIso: string;
}

export interface OfficeBankImportPreviewRecord {
  readonly previewId: string;
  readonly workspaceId: string;
  readonly accountId?: string | null;
  readonly source: "sbi" | "mcb" | "csv" | "cashflow" | "pdf";
  readonly fileName: string;
  readonly checksum: string;
  readonly idempotencyFingerprint: string;
  readonly rows: readonly ApiImportPreviewRow[];
  readonly rowDecisions: readonly OfficeBankImportPreviewDecision[];
  readonly createdAtIso: string;
}

export interface OfficeBankImportPreviewDecision {
  readonly id: string;
  readonly status: "accepted" | "duplicate" | "rejected";
  readonly issues: readonly string[];
}

export interface PersistedAuditEvent {
  readonly id: string;
  readonly occurredAt: string;
  readonly actorId: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly idempotencyKey: string | null;
  readonly context: Readonly<Record<string, string>>;
}

export type AuditEventScope = "office" | "distribution";

export interface ApiPersistenceRuntime {
  readonly writesEnabled: boolean;
  readonly withTx: <TResult>(callback: (tx: ApiWriteTransaction) => Promise<TResult>) => Promise<TResult>;
  readonly readAuditEvents: (scope: AuditEventScope) => Promise<readonly PersistedAuditEvent[]>;
  readonly storeDistributionImportPreview: (preview: DistributionImportPreviewRecord) => Promise<void>;
  readonly getDistributionImportPreview: (previewId: string) => Promise<DistributionImportPreviewRecord | null>;
  readonly storeOfficeBankImportPreview: (preview: OfficeBankImportPreviewRecord) => Promise<void>;
  readonly getOfficeBankImportPreview: (previewId: string) => Promise<OfficeBankImportPreviewRecord | null>;
}

export interface RunIdempotentMutationInput<TBody extends ApiMutationResponse> {
  readonly runtime: ApiPersistenceRuntime;
  readonly actor: AuthenticatedApiUser;
  readonly action: string;
  readonly route: string;
  readonly idempotencyKey: string;
  readonly requestBody: unknown;
  readonly write: (tx: ApiWriteTransaction, idempotencyKey: string) => Promise<TBody>;
}

export interface RunDisabledMutationInput {
  readonly runtime: ApiPersistenceRuntime;
  readonly actor: AuthenticatedApiUser;
  readonly action: string;
  readonly route: string;
  readonly idempotencyKey: string;
  readonly requestBody: unknown;
}

export interface AppendAuditEventInput {
  readonly actor: AuthenticatedApiUser;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly before: JsonRecord;
  readonly after: JsonRecord;
  readonly idempotencyKey: string;
}

export interface PersistDistributionImportInput {
  readonly batchId: string;
  readonly workspaceId: string;
  readonly source: "kontor" | "routenote";
  readonly fileName: string;
  readonly status: "processing" | "normalized" | "failed" | "void";
  readonly importedAtIso: string;
  readonly rows: readonly ApiImportPreviewRow[];
  readonly acceptedRowIds: readonly string[];
  readonly rejectedRowIds: readonly string[];
  readonly normalizedRows: readonly PersistDistributionNormalizedEarningInput[];
  readonly issues: readonly PersistDistributionImportIssueInput[];
  readonly metadata: JsonRecord;
}

export interface PersistDistributionNormalizedEarningInput {
  readonly rowId: string;
  readonly dsp: string;
  readonly grossAmount: string;
  readonly quantity: string;
  readonly currency: string;
  readonly isrc: string | null;
  readonly upc: string | null;
  readonly rawTitle: string | null;
  readonly rawArtist: string | null;
  readonly rawLabel: string | null;
}

export interface PersistDistributionImportIssueInput {
  readonly rowId: string;
  readonly severity: "info" | "warning" | "error";
  readonly code: string;
  readonly message: string;
  readonly metadata: JsonRecord;
}

export interface PersistOfficeBankImportInput {
  readonly batchId: string;
  readonly workspaceId: string;
  readonly source: "sbi" | "mcb" | "csv" | "cashflow" | "pdf";
  readonly fileName: string;
  readonly checksum: string;
  readonly accountId: string | null;
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly currency: string | null;
  readonly acceptedRowCount: number;
  readonly rejectedRowCount: number;
  readonly duplicateRowCount: number;
  readonly idempotencyFingerprint: string;
  readonly status: "confirmed" | "failed" | "void";
  readonly importedAtIso: string;
  readonly metadata: JsonRecord;
  readonly lines: readonly OfficeBankStatementLineInsert[];
}

export interface ExistingOfficeBankImportBatch {
  readonly id: string;
  readonly status: "previewed" | "confirmed" | "failed" | "void";
  readonly acceptedRowCount: number;
  readonly rejectedRowCount: number;
  readonly duplicateRowCount: number;
}

export interface OfficeBankStatementLineInsert {
  readonly id: string;
  readonly accountId: string;
  readonly occurredOn: string;
  readonly valueOn: string | null;
  readonly description: string;
  readonly reference: string | null;
  readonly direction: "credit" | "debit";
  readonly amountMinor: bigint;
  readonly balanceMinor: bigint | null;
  readonly currency: string;
  readonly amountMurMinor: bigint;
  readonly balanceMurMinor: bigint | null;
  readonly isDuplicateCandidate: boolean;
  readonly rawData: JsonRecord;
}

export interface ExistingOfficeBankStatementLineForDedupe {
  readonly id: string;
  readonly accountId: string;
  readonly occurredOn: string;
  readonly valueOn: string | null;
  readonly description: string;
  readonly reference: string | null;
  readonly direction: "credit" | "debit";
  readonly amountMinor: bigint;
  readonly balanceMinor: bigint | null;
  readonly currency: string;
}

export interface PersistDistributionAllocationRunInput {
  readonly runId: string;
  readonly workspaceId: string;
  readonly batchId: string | null;
  readonly startedAtIso: string;
  readonly finishedAtIso: string;
  readonly allocations: readonly PersistedEarningAllocationInsert[];
  readonly expenseApplications: readonly ExpenseApplicationInsert[];
  readonly costTermStatusUpdates: readonly CostTermStatusUpdate[];
  readonly suspenseItems: readonly DistributionSuspenseItemInsert[];
  readonly metadata: JsonRecord;
}

export interface PersistedEarningAllocationInsert extends EarningAllocationInsert {
  readonly id: string;
}

export interface StatementPersistPlan {
  readonly statementId: string;
  readonly statement: StatementInsertPlan;
  readonly lines: readonly StatementLineInsertPlan[];
  readonly balanceLedgerRow: PayeeBalanceInsertPlan;
}

export interface PersistDistributionStatementsInput {
  readonly workspaceId: string;
  readonly statements: readonly StatementPersistPlan[];
}

export interface PersistDistributionStatementVoidInput {
  readonly statementId: string;
  readonly status: "void";
  readonly reversalLedgerRow: PayeeBalanceInsertPlan;
}

export interface PersistDistributionPaymentRecordInput {
  readonly paymentId: string;
  readonly workspaceId: string;
  readonly statementPaymentLinkId: string | null;
  readonly statementId: string | null;
  readonly payeeId: string;
  readonly amount: string;
  readonly currency: string;
  readonly exchangeRate: string | null;
  readonly method: string;
  readonly paidAt: string | null;
  readonly reference: string | null;
  readonly notes: string | null;
}

export interface PersistDistributionPaymentUpdateInput {
  readonly paymentId: string;
  readonly amount: string;
  readonly currency: string;
  readonly exchangeRate: string | null;
  readonly method: string;
  readonly paidAt: string | null;
  readonly reference: string | null;
  readonly notes: string | null;
}

export interface PersistDistributionPaymentReconcileInput {
  readonly paymentId: string;
  readonly statementPaymentLinkId: string;
  readonly statementId: string;
  readonly amountApplied: string;
  readonly reconciledAt: string;
}

export interface PersistDistributionPaymentVoidInput {
  readonly paymentId: string;
}

export interface PersistedDistributionRoyaltyRule {
  readonly id: string;
  readonly contractId: string;
  readonly payeeId: string;
  readonly percentage: string;
  readonly scopeType: string | null;
  readonly scopeId: string | null;
  readonly priority: number;
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly status: "active";
}

export interface PersistDistributionRoyaltyRulesInput {
  readonly contractId: string;
  readonly rules: readonly PersistedDistributionRoyaltyRule[];
}

export interface PersistDistributionFxRatesInput {
  readonly rates: readonly DistributionFxRateInput[];
}

export interface PersistDistributionAliasUpsertInput {
  readonly aliasId: string;
  readonly aliasText: string;
  readonly targetType: "artist" | "payee" | "label" | "release" | "track" | "unassigned";
  readonly targetId: string | null;
}

export interface PersistDistributionDuplicateResolveInput {
  readonly earningIds: readonly string[];
}

export interface PersistDistributionPayeeBalanceAdjustmentsInput {
  readonly rows: readonly PayeeBalanceLedgerInput[];
}

export interface PersistIdentityLinkInput {
  readonly id: string;
  readonly payeeId: string;
  readonly officePartnerId: string;
  readonly confidence: string;
  readonly status: "linked";
}

export type ApiWriteTransaction =
  | {
      readonly kind: "postgres";
      readonly executor: SqlExecutor;
    }
  | {
      readonly kind: "memory";
      readonly state: MemoryPersistenceState;
    };

interface SqlExecutor {
  readonly execute: (query: SQL<unknown>) => Promise<unknown>;
}

interface TransactionalDrizzleDatabase {
  readonly transaction: <TResult>(callback: (tx: SqlExecutor) => Promise<TResult>) => Promise<TResult>;
}

interface StoredIdempotencyResult {
  readonly key: string;
  readonly route: string;
  readonly requestHash: string;
  readonly responseJson: JsonRecord | null;
}

interface BeginIdempotentInput {
  readonly key: string;
  readonly route: string;
  readonly requestHash: string;
}

type BeginIdempotentResult =
  | {
      readonly status: "started";
    }
  | {
      readonly status: "replay";
      readonly responseJson: JsonRecord;
    };

interface MemoryPersistenceState {
  readonly idempotency: Map<string, StoredIdempotencyResult>;
  readonly auditEvents: PersistedAuditEvent[];
}

interface PersistenceState {
  readonly memory: MemoryPersistenceState;
  readonly distributionPreviews: Map<string, DistributionImportPreviewRecord>;
  readonly officeBankPreviews: Map<string, OfficeBankImportPreviewRecord>;
}

type ImportPreviewKind = "distribution_import" | "office_bank_import";

const SENSITIVE_ACTIONS = new Set<string>([
  "command_center_integration_toggle",
  "command_center_settings_update",
  "office_settings_update",
  "command_center_user_permission_update",
  "distribution_alias_upsert",
  "distribution_catalog_artist_promote",
  "distribution_catalog_contributor_payee_link",
  "distribution_catalog_contributors_override",
  "distribution_allocations_preview",
  "distribution_allocations_retry_missing_contracts",
  "distribution_allocations_run",
  "distribution_allocations_unpost",
  "distribution_contract_expense_create",
  "distribution_contract_expense_update",
  "distribution_contract_track_rules_override",
  "distribution_contract_rules_update",
  "distribution_contract_upsert",
  "distribution_duplicate_resolve",
  "distribution_fx_rates_save",
  "distribution_financial_reconciliation_action",
  "distribution_identity_link",
  "distribution_import_confirm",
  "distribution_import_preview",
  "distribution_import_reverse",
  "distribution_mapping_apply_rules",
  "distribution_payment_record",
  "distribution_payment_reconcile",
  "distribution_payment_update",
  "distribution_payment_void",
  "distribution_payee_upsert",
  "distribution_release_upsert",
  "distribution_statement_generate",
  "distribution_statement_void",
  "distribution_suspense_resolve",
  "distribution_track_upsert",
  "office_bank_import_reverse",
  "office_cashflow_import_reverse",
  "office_bank_import_delete",
  "office_financial_reset",
  "distribution_financial_reset",
  "office_bank_account_delete",
  "office_partner_payee_link",
  "office_partner_payee_unlink"
]);

const ALLOWED_MUTATING_ACTIONS = new Set<string>([
  ...SENSITIVE_ACTIONS,
  "office_partner_create",
  "office_partner_update",
  "office_plan_comptable_create",
  "office_plan_comptable_update",
  "office_plan_comptable_delete",
  "office_transaction_create",
  "office_transaction_update",
  "office_transaction_validate",
  "office_transaction_cancel",
  "office_bank_account_create",
  "office_bank_account_update",
  "office_project_create",
  "office_project_update",
  "office_settings_update",
  "office_cashflow_import_confirm",
  "office_cashflow_import_reverse",
  "office_cashflow_manual_entry_create",
  "office_cashflow_manual_entry_cancel",
  "office_advance_create",
  "office_advance_mark_paid",
  "office_advance_apply",
  "office_bank_import_preview",
  "office_bank_import_confirm",
  "office_reconciliation_approve",
  "office_reconciliation_match",
  "office_reconciliation_unmatch",
  "office_reconciliation_reject",
  "office_reconciliation_ignore",
  "office_reconciliation_create_transaction",
  "office_bank_raw_reassign_account",
  "office_ledger_bulk_confirm"
]);

const OFFICE_BOT_ACTIONS = new Set<string>([
  "office_bank_import_preview",
  "office_bank_import_confirm",
  "office_transaction_create",
  "office_transaction_update",
  "office_transaction_validate",
  "office_transaction_cancel",
  "office_bank_account_create",
  "office_bank_account_update",
  "office_project_create",
  "office_project_update",
  "office_settings_update",
  "office_cashflow_import_confirm",
  "office_cashflow_import_reverse",
  "office_cashflow_manual_entry_create",
  "office_cashflow_manual_entry_cancel",
  "office_advance_create",
  "office_advance_mark_paid",
  "office_advance_apply",
  "office_reconciliation_approve",
  "office_reconciliation_match",
  "office_reconciliation_unmatch",
  "office_reconciliation_reject",
  "office_reconciliation_ignore",
  "office_reconciliation_create_transaction",
  "office_bank_raw_reassign_account",
  "office_ledger_bulk_confirm"
]);

const DISTRIBUTION_BOT_ACTIONS = new Set<string>([
  "distribution_contract_expense_create",
  "distribution_contract_expense_update",
  "distribution_contract_rules_update",
  "distribution_contract_upsert",
  "distribution_mapping_apply_rules",
  "distribution_payment_record",
  "distribution_payment_reconcile",
  "distribution_payment_update",
  "distribution_payee_upsert",
  "distribution_release_upsert",
  "distribution_statement_generate",
  "distribution_suspense_resolve",
  "distribution_track_upsert"
]);

export function createPostgresPersistenceRuntime(pool: Pool, env: Readonly<Record<string, string | undefined>>): ApiPersistenceRuntime {
  const database = drizzle(pool) as unknown as TransactionalDrizzleDatabase;
  return createDrizzlePersistenceRuntime(database, env);
}

export function createDrizzlePersistenceRuntime(database: TransactionalDrizzleDatabase, env: Readonly<Record<string, string | undefined>>): ApiPersistenceRuntime {
  const state = createInitialPersistenceState();
  return {
    writesEnabled: isWritesEnabled(env),
    withTx: async <TResult>(callback: (tx: ApiWriteTransaction) => Promise<TResult>): Promise<TResult> =>
      database.transaction(async (executor: SqlExecutor): Promise<TResult> => callback({ kind: "postgres", executor })),
    readAuditEvents: async (scope: AuditEventScope): Promise<readonly PersistedAuditEvent[]> =>
      database.transaction(async (executor: SqlExecutor): Promise<readonly PersistedAuditEvent[]> => readPersistedAuditEvents(executor, scope)),
    storeDistributionImportPreview: async (preview: DistributionImportPreviewRecord): Promise<void> => {
      state.distributionPreviews.set(preview.previewId, preview);
      await database.transaction(async (executor: SqlExecutor): Promise<void> => {
        await persistApiImportPreview(executor, "distribution_import", preview);
      });
    },
    getDistributionImportPreview: async (previewId: string): Promise<DistributionImportPreviewRecord | null> => {
      const cached = state.distributionPreviews.get(previewId);
      if (cached !== undefined) {
        return cached;
      }

      const stored = await database.transaction(async (executor: SqlExecutor): Promise<DistributionImportPreviewRecord | null> =>
        readApiImportPreview<DistributionImportPreviewRecord>(executor, "distribution_import", previewId, new Date().toISOString())
      );
      if (stored !== null) {
        state.distributionPreviews.set(stored.previewId, stored);
      }
      return stored;
    },
    storeOfficeBankImportPreview: async (preview: OfficeBankImportPreviewRecord): Promise<void> => {
      state.officeBankPreviews.set(preview.previewId, preview);
      await database.transaction(async (executor: SqlExecutor): Promise<void> => {
        await persistApiImportPreview(executor, "office_bank_import", preview);
      });
    },
    getOfficeBankImportPreview: async (previewId: string): Promise<OfficeBankImportPreviewRecord | null> => {
      const cached = state.officeBankPreviews.get(previewId);
      if (cached !== undefined) {
        return cached;
      }

      const stored = await database.transaction(async (executor: SqlExecutor): Promise<OfficeBankImportPreviewRecord | null> =>
        readApiImportPreview<OfficeBankImportPreviewRecord>(executor, "office_bank_import", previewId, new Date().toISOString())
      );
      if (stored !== null) {
        state.officeBankPreviews.set(stored.previewId, stored);
      }
      return stored;
    }
  };
}

export function createMemoryPersistenceRuntime(env: Readonly<Record<string, string | undefined>>): ApiPersistenceRuntime {
  let state = createInitialPersistenceState();
  return {
    writesEnabled: isWritesEnabled(env),
    withTx: async <TResult>(callback: (tx: ApiWriteTransaction) => Promise<TResult>): Promise<TResult> => {
      const draft = cloneMemoryPersistenceState(state.memory);
      const result = await callback({ kind: "memory", state: draft });
      state = {
        memory: draft,
        distributionPreviews: state.distributionPreviews,
        officeBankPreviews: state.officeBankPreviews
      };
      return result;
    },
    readAuditEvents: async (scope: AuditEventScope): Promise<readonly PersistedAuditEvent[]> =>
      state.memory.auditEvents.filter((event) => isAuditActionInScope(event.action, scope)).reverse(),
    storeDistributionImportPreview: async (preview: DistributionImportPreviewRecord): Promise<void> => {
      state.distributionPreviews.set(preview.previewId, preview);
    },
    getDistributionImportPreview: async (previewId: string): Promise<DistributionImportPreviewRecord | null> => state.distributionPreviews.get(previewId) ?? null,
    storeOfficeBankImportPreview: async (preview: OfficeBankImportPreviewRecord): Promise<void> => {
      state.officeBankPreviews.set(preview.previewId, preview);
    },
    getOfficeBankImportPreview: async (previewId: string): Promise<OfficeBankImportPreviewRecord | null> => state.officeBankPreviews.get(previewId) ?? null
  };
}

export function requirePermission(actor: AuthenticatedApiUser | undefined, action: string): AuthenticatedApiUser {
  return requirePermissionForWorkspace(actor, action, null);
}

export function requirePermissionForWorkspace(actor: AuthenticatedApiUser | undefined, action: string, workspaceId: string | null): AuthenticatedApiUser {
  if (actor === undefined) {
    throwPersistenceHttpError(401, "auth_required", "A verified Supabase user is required for this action.", [`action=${action}`]);
  }

  if (!ALLOWED_MUTATING_ACTIONS.has(action)) {
    throwPersistenceHttpError(403, "permission_action_unknown", "The action has no explicit permission rule.", [
      `action=${action}`,
      `actorRole=${actor.role}`
    ]);
  }

  if (actor.role === "bot_office" || actor.role === "bot_distribution") {
    requireBotPermission(actor, action, workspaceId);
    return actor;
  }

  if (SENSITIVE_ACTIONS.has(action) && actor.role !== "administrator") {
    throwPersistenceHttpError(403, "permission_denied", "Administrator permission is required for this action.", [
      `action=${action}`,
      `actorRole=${actor.role}`,
      `actorUserId=${actor.userId}`
    ]);
  }

  return actor;
}

export function isBotApiUser(actor: AuthenticatedApiUser): boolean {
  return actor.role === "bot_office" || actor.role === "bot_distribution";
}

function requireBotPermission(actor: AuthenticatedApiUser, action: string, workspaceId: string | null): void {
  const allowedActions = actor.role === "bot_office" ? OFFICE_BOT_ACTIONS : DISTRIBUTION_BOT_ACTIONS;
  if (!allowedActions.has(action)) {
    throwPersistenceHttpError(403, "bot_permission_denied", "The bot role is not allowed to perform this action.", [
      `action=${action}`,
      `actorRole=${actor.role}`,
      `actorUserId=${actor.userId}`
    ]);
  }

  if (actor.workspaceId === null) {
    throwPersistenceHttpError(403, "bot_workspace_missing", "The bot token must carry an explicit workspace id.", [
      `action=${action}`,
      `actorRole=${actor.role}`,
      `actorUserId=${actor.userId}`
    ]);
  }

  if (workspaceId === null) {
    throwPersistenceHttpError(403, "bot_workspace_required", "Bot writes must include an explicit workspace id.", [
      `action=${action}`,
      `actorRole=${actor.role}`,
      `actorWorkspaceId=${actor.workspaceId}`
    ]);
  }

  if (workspaceId !== actor.workspaceId) {
    throwPersistenceHttpError(403, "bot_workspace_denied", "The bot role cannot write outside its assigned workspace.", [
      `action=${action}`,
      `actorRole=${actor.role}`,
      `actorWorkspaceId=${actor.workspaceId}`,
      `requestWorkspaceId=${workspaceId}`
    ]);
  }
}

function workspaceIdFromRequestBody(requestBody: unknown): string | null {
  if (typeof requestBody !== "object" || requestBody === null || Array.isArray(requestBody)) {
    return null;
  }

  const workspaceId = (requestBody as Readonly<Record<string, unknown>>)["workspaceId"];
  if (typeof workspaceId !== "string") {
    return null;
  }

  const trimmedWorkspaceId = workspaceId.trim();
  return trimmedWorkspaceId.length === 0 ? null : trimmedWorkspaceId;
}

export async function runIdempotentMutation<TBody extends ApiMutationResponse>(input: RunIdempotentMutationInput<TBody>): Promise<ApiMutationResult<TBody | DisabledWriteBody>> {
  requirePermissionForWorkspace(input.actor, input.action, workspaceIdFromRequestBody(input.requestBody));
  const requestHash = hashRequestBody(input.requestBody);
  return input.runtime.withTx(async (tx: ApiWriteTransaction): Promise<ApiMutationResult<TBody | DisabledWriteBody>> => {
    const idempotency = await beginIdempotent(tx, {
      key: input.idempotencyKey,
      route: input.route,
      requestHash
    });

    if (idempotency.status === "replay") {
      return {
        status: statusForStoredResponse(idempotency.responseJson),
        body: idempotency.responseJson as TBody | DisabledWriteBody
      };
    }

    if (!input.runtime.writesEnabled) {
      const disabledBody = disabledWriteBody(input.action);
      await completeIdempotent(tx, input.idempotencyKey, disabledBody);
      return {
        status: 501,
        body: disabledBody
      };
    }

    const response = await input.write(tx, input.idempotencyKey);
    if (response.auditEventId === null) {
      throwPersistenceHttpError(500, "audit_event_missing", "Mutation completed without an audit event.", [
        `action=${input.action}`,
        `route=${input.route}`,
        `idempotencyKey=${input.idempotencyKey}`
      ]);
    }

    await completeIdempotent(tx, input.idempotencyKey, response);
    return {
      status: 200,
      body: response
    };
  });
}

export async function runDisabledMutation(input: RunDisabledMutationInput): Promise<ApiMutationResult<DisabledWriteBody>> {
  requirePermissionForWorkspace(input.actor, input.action, workspaceIdFromRequestBody(input.requestBody));
  const requestHash = hashRequestBody(input.requestBody);
  return input.runtime.withTx(async (tx: ApiWriteTransaction): Promise<ApiMutationResult<DisabledWriteBody>> => {
    const idempotency = await beginIdempotent(tx, {
      key: input.idempotencyKey,
      route: input.route,
      requestHash
    });

    if (idempotency.status === "replay") {
      return {
        status: statusForStoredResponse(idempotency.responseJson),
        body: idempotency.responseJson as DisabledWriteBody
      };
    }

    const response = disabledWriteBody(input.action);
    await completeIdempotent(tx, input.idempotencyKey, response);
    return {
      status: 501,
      body: response
    };
  });
}

export async function appendAuditEvent(tx: ApiWriteTransaction, input: AppendAuditEventInput): Promise<string> {
  if (tx.kind === "memory") {
    const auditEventId = `audit_${randomUUID()}`;
    tx.state.auditEvents.push({
      id: auditEventId,
      occurredAt: new Date().toISOString(),
      actorId: input.actor.userId,
      action: input.action,
      entityType: input.targetType,
      entityId: input.targetId,
      idempotencyKey: input.idempotencyKey,
      context: {
        actorEmail: input.actor.email ?? "unknown",
        actorRole: input.actor.role
      }
    });
    return auditEventId;
  }

  const auditEventId = randomUUID();
  await tx.executor.execute(sql`
    insert into audit_logs (
      id,
      entity_type,
      entity_id,
      action,
      actor_user_id,
      before,
      after,
      metadata
    )
    values (
      ${auditEventId},
      ${input.targetType},
      ${input.targetId},
      ${input.action},
      ${input.actor.userId},
      ${JSON.stringify(input.before)}::jsonb,
      ${JSON.stringify(input.after)}::jsonb,
      ${JSON.stringify({
        actorEmail: input.actor.email,
        actorRole: input.actor.role,
        idempotencyKey: input.idempotencyKey
      })}::jsonb
    )
  `);
  return auditEventId;
}

export async function persistDistributionImportConfirmation(tx: ApiWriteTransaction, input: PersistDistributionImportInput): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    insert into import_batches (
      id,
      workspace_id,
      source,
      file_name,
      status,
      imported_at,
      metadata
    )
    values (
      ${input.batchId},
      ${input.workspaceId},
      ${input.source},
      ${input.fileName},
      ${input.status},
      ${input.importedAtIso},
      ${JSON.stringify(input.metadata)}::jsonb
    )
  `);

  const rawRows = input.rows.map((row) => ({ ...row, rawImportRowId: randomUUID() }));
  const rawRowIdByPreviewId = new Map(rawRows.map((row) => [row.id, row.rawImportRowId]));
  const insertChunkSize = 400;
  for (let offset = 0; offset < rawRows.length; offset += insertChunkSize) {
    const chunk = rawRows.slice(offset, offset + insertChunkSize);
    const rows = chunk.map((row): SQL => sql`(
      ${row.rawImportRowId},
      ${input.batchId},
      ${row.rowNumber},
      ${JSON.stringify(row.rawData)}::jsonb
    )`);
    await tx.executor.execute(sql`
      insert into raw_import_rows (id, batch_id, row_number, raw_data)
      values ${sql.join(rows, sql`, `)}
    `);
  }

  const normalizedRows = input.normalizedRows.map((row) => ({
    ...row,
    id: randomUUID(),
    rawImportRowId: rawRowIdByPreviewId.get(row.rowId)
  }));
  for (let offset = 0; offset < normalizedRows.length; offset += insertChunkSize) {
    const chunk = normalizedRows.slice(offset, offset + insertChunkSize);
    const rows = chunk.map((row): SQL => sql`(
      ${row.id},
      ${input.workspaceId},
      ${input.batchId},
      ${row.rawImportRowId},
      ${row.dsp},
      ${row.grossAmount},
      ${row.quantity},
      ${row.currency},
      ${row.isrc},
      ${row.upc},
      ${row.rawTitle},
      ${row.rawArtist},
      ${row.rawLabel},
      'unmapped',
      'pending'
    )`);
    await tx.executor.execute(sql`
      insert into normalized_earnings (
        id, workspace_id, batch_id, raw_import_row_id, dsp, gross_amount, quantity,
        currency, isrc, upc, raw_title, raw_artist, raw_label, mapping_status, calculation_status
      ) values ${sql.join(rows, sql`, `)}
    `);
  }

  const issueRows = input.issues.flatMap((issue) => {
    const rawImportRowId = rawRowIdByPreviewId.get(issue.rowId);
    return rawImportRowId === undefined ? [] : [{ ...issue, id: randomUUID(), rawImportRowId }];
  });
  for (let offset = 0; offset < issueRows.length; offset += insertChunkSize) {
    const chunk = issueRows.slice(offset, offset + insertChunkSize);
    const rows = chunk.map((issue): SQL => sql`(
      ${issue.id},
      ${input.batchId},
      ${issue.rawImportRowId},
      ${issue.severity},
      ${issue.code},
      ${issue.message},
      ${JSON.stringify(issue.metadata)}::jsonb
    )`);
    await tx.executor.execute(sql`
      insert into import_issues (id, batch_id, raw_import_row_id, severity, code, message, metadata)
      values ${sql.join(rows, sql`, `)}
    `);
  }
}

export async function findDistributionImportBatchByFingerprint(
  tx: ApiWriteTransaction,
  workspaceId: string,
  source: string,
  fileName: string,
  checksum: string
): Promise<{ readonly id: string; readonly status: string } | null> {
  if (tx.kind === "memory") return null;
  const rows = rowsFromQueryResult(await tx.executor.execute(sql`
    select id::text, status::text
    from import_batches
    where workspace_id = ${workspaceId}
      and source = ${source}
      and file_name = ${fileName}
      and metadata->>'checksum' = ${checksum}
      and status not in ('failed', 'void')
    order by created_at desc
    limit 1
  `));
  const row = rows[0];
  return row === undefined ? null : { id: stringField(row, "id"), status: stringField(row, "status") };
}

export async function applyDistributionImportMappingRules(
  tx: ApiWriteTransaction,
  workspaceId: string,
  batchId: string,
  source: string
): Promise<number> {
  if (tx.kind === "memory") return 0;
  const rules = rowsFromQueryResult(await tx.executor.execute(sql`
    select mr.conditions_json, mr.source, mr.target_track_id::text as target_track_id
    from mapping_rules mr
    join tracks t on t.id = mr.target_track_id and t.workspace_id = ${workspaceId}
    where mr.is_active = true
  `));
  const earnings = rowsFromQueryResult(await tx.executor.execute(sql`
    select id::text, dsp, isrc, upc, raw_title, raw_artist, raw_label
    from normalized_earnings
    where workspace_id = ${workspaceId} and batch_id = ${batchId} and mapping_status = 'unmapped'
  `));
  const matches: Array<{ readonly earningId: string; readonly trackId: string }> = [];
  for (const earning of earnings) {
    const matchingRules = rules.filter((rule) => {
      const ruleSource = stringField(rule, "source").toLocaleLowerCase();
      if (ruleSource !== "" && ruleSource !== "all" && ruleSource !== "*" && ruleSource !== source.toLocaleLowerCase()) return false;
      return mappingConditionsMatch(rule.conditions_json, earning);
    });
    const targetIds = [...new Set(matchingRules.map((rule) => nullableStringField(rule, "target_track_id")).filter((id): id is string => id !== null))];
    if (targetIds.length === 1) matches.push({ earningId: stringField(earning, "id"), trackId: targetIds[0] as string });
  }
  if (matches.length === 0) return 0;
  const chunkSize = 400;
  for (let offset = 0; offset < matches.length; offset += chunkSize) {
    const chunk = matches.slice(offset, offset + chunkSize);
    const earningIds = sql.join(chunk.map((match) => sql`${match.earningId}`), sql`, `);
    await tx.executor.execute(sql`
      update normalized_earnings
      set mapping_status = 'matched', calculation_status = 'pending', updated_at = now()
      where workspace_id = ${workspaceId} and id in (${earningIds})
    `);
    const insertRows = chunk.map((match): SQL => sql`(
      ${randomUUID()}, ${match.earningId}, ${match.trackId}, '100.000000', 'matched'
    )`);
    await tx.executor.execute(sql`
      insert into earning_track_matches (id, earning_id, track_id, confidence, status)
      values ${sql.join(insertRows, sql`, `)}
    `);
  }
  return matches.length;
}

function mappingConditionsMatch(value: unknown, earning: JsonRecord): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const conditions = value as JsonRecord;
  const fields: Record<string, string> = {
    dsp: stringField(earning, "dsp"),
    store: stringField(earning, "dsp"),
    isrc: nullableStringField(earning, "isrc") ?? "",
    upc: nullableStringField(earning, "upc") ?? "",
    ean: nullableStringField(earning, "upc") ?? "",
    title: nullableStringField(earning, "raw_title") ?? "",
    artist: nullableStringField(earning, "raw_artist") ?? "",
    label: nullableStringField(earning, "raw_label") ?? ""
  };
  return Object.entries(conditions).every(([key, expected]) => {
    const actual = fields[key.toLocaleLowerCase()];
    if (actual === undefined) return false;
    if (typeof expected === "string") return actual.trim().toLocaleLowerCase() === expected.trim().toLocaleLowerCase();
    if (Array.isArray(expected)) return expected.some((item) => typeof item === "string" && actual.trim().toLocaleLowerCase() === item.trim().toLocaleLowerCase());
    return false;
  });
}

export async function persistOfficeBankImportConfirmation(tx: ApiWriteTransaction, input: PersistOfficeBankImportInput): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    insert into office_bank_import_batches (
      id,
      workspace_id,
      source,
      file_name,
      checksum,
      account_id,
      period_start,
      period_end,
      currency,
      accepted_row_count,
      rejected_row_count,
      duplicate_row_count,
      idempotency_fingerprint,
      status,
      imported_at,
      metadata
    )
    values (
      ${input.batchId},
      ${input.workspaceId},
      ${input.source},
      ${input.fileName},
      ${input.checksum},
      ${input.accountId},
      ${input.periodStart},
      ${input.periodEnd},
      ${input.currency},
      ${input.acceptedRowCount},
      ${input.rejectedRowCount},
      ${input.duplicateRowCount},
      ${input.idempotencyFingerprint},
      ${input.status},
      ${input.importedAtIso},
      ${JSON.stringify(input.metadata)}::jsonb
    )
  `);

  // Multi-row inserts in chunks: a statement-by-statement loop over thousands of lines
  // (real imports run 2000+) exceeded the host proxy's request timeout, so the client saw
  // a 500 while the transaction kept committing server-side. 400 rows x 15 params = 6000
  // bind parameters per statement, comfortably under Postgres's 65535 limit.
  const INSERT_CHUNK_SIZE = 400;
  for (let offset = 0; offset < input.lines.length; offset += INSERT_CHUNK_SIZE) {
    const chunk = input.lines.slice(offset, offset + INSERT_CHUNK_SIZE);
    const rows = chunk.map((line): SQL => sql`(
      ${line.id},
      ${input.batchId},
      ${line.accountId},
      ${line.occurredOn},
      ${line.valueOn},
      ${line.description},
      ${line.reference},
      ${line.direction},
      ${String(line.amountMinor)},
      ${line.balanceMinor === null ? null : String(line.balanceMinor)},
      ${line.currency},
      ${String(line.amountMurMinor)},
      ${line.balanceMurMinor === null ? null : String(line.balanceMurMinor)},
      ${line.isDuplicateCandidate},
      ${JSON.stringify(line.rawData)}::jsonb
    )`);
    await tx.executor.execute(sql`
      insert into office_bank_statement_lines (
        id,
        import_batch_id,
        account_id,
        occurred_on,
        value_on,
        description,
        reference,
        direction,
        amount_minor,
        balance_minor,
        currency,
        amount_mur_minor,
        balance_mur_minor,
        is_duplicate_candidate,
        raw_data
      )
      values ${sql.join(rows, sql`, `)}
    `);
  }
}

export async function getDistributionImportPreviewInTransaction(
  tx: ApiWriteTransaction,
  previewId: string,
  nowIso: string
): Promise<DistributionImportPreviewRecord | null> {
  if (tx.kind === "memory") {
    return null;
  }

  return readApiImportPreview<DistributionImportPreviewRecord>(tx.executor, "distribution_import", previewId, nowIso);
}

export async function getOfficeBankImportPreviewInTransaction(
  tx: ApiWriteTransaction,
  previewId: string,
  nowIso: string
): Promise<OfficeBankImportPreviewRecord | null> {
  if (tx.kind === "memory") {
    return null;
  }

  return readApiImportPreview<OfficeBankImportPreviewRecord>(tx.executor, "office_bank_import", previewId, nowIso);
}

export async function findOfficeBankImportBatchByFingerprint(
  tx: ApiWriteTransaction,
  workspaceId: string,
  idempotencyFingerprint: string
): Promise<ExistingOfficeBankImportBatch | null> {
  if (tx.kind === "memory") {
    return null;
  }

  const rows = rowsFromQueryResult(await tx.executor.execute(sql`
    select
      id::text as id,
      status::text as status,
      accepted_row_count,
      rejected_row_count,
      duplicate_row_count
    from office_bank_import_batches
    where workspace_id = ${workspaceId}
      and idempotency_fingerprint = ${idempotencyFingerprint}
    limit 1
  `));
  const row = rows[0];
  if (row === undefined) {
    return null;
  }

  const status = officeBankImportStatusField(row, "status");
  return {
    id: stringField(row, "id"),
    status,
    acceptedRowCount: integerField(row, "accepted_row_count"),
    rejectedRowCount: integerField(row, "rejected_row_count"),
    duplicateRowCount: integerField(row, "duplicate_row_count")
  };
}

export async function readExistingOfficeBankStatementLinesForDedupe(
  tx: ApiWriteTransaction,
  workspaceId: string,
  accountId: string,
  periodStart: string,
  periodEnd: string
): Promise<readonly ExistingOfficeBankStatementLineForDedupe[]> {
  if (tx.kind === "memory") {
    return [];
  }

  const rows = rowsFromQueryResult(await tx.executor.execute(sql`
    select
      line.id::text as id,
      line.account_id::text as account_id,
      line.occurred_on::text as occurred_on,
      line.value_on::text as value_on,
      line.description,
      line.reference,
      line.direction,
      line.amount_minor::text as amount_minor,
      line.balance_minor::text as balance_minor,
      line.currency
    from office_bank_statement_lines line
    inner join office_bank_import_batches batch on batch.id = line.import_batch_id
    where batch.workspace_id = ${workspaceId}
      and line.account_id = ${accountId}
      and (
        line.occurred_on between ${periodStart} and ${periodEnd}
        or line.value_on between ${periodStart} and ${periodEnd}
      )
      -- Void imports are still visible in current read projections, so treating them as
      -- active here prevents a reverse/re-import from creating a second visible copy.
      and batch.status in ('confirmed', 'void')
    order by line.occurred_on, line.id
  `));

  return rows.map((row): ExistingOfficeBankStatementLineForDedupe => ({
    id: stringField(row, "id"),
    accountId: stringField(row, "account_id"),
    occurredOn: stringField(row, "occurred_on"),
    valueOn: nullableStringField(row, "value_on"),
    description: stringField(row, "description"),
    reference: nullableStringField(row, "reference"),
    direction: officeBankDirectionField(row, "direction"),
    amountMinor: bigintField(row, "amount_minor"),
    balanceMinor: nullableBigintField(row, "balance_minor"),
    currency: stringField(row, "currency")
  }));
}

export async function acquireAdvisoryLock(tx: ApiWriteTransaction, lockKey: string): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  const rows = rowsFromQueryResult(await tx.executor.execute(sql`
    select pg_try_advisory_xact_lock(hashtext(${lockKey})) as locked
  `));
  const locked = rows[0]?.locked;
  if (locked !== true) {
    throwPersistenceHttpError(409, "write_lock_unavailable", "Another write is already running for this lock key.", [`lockKey=${lockKey}`]);
  }
}

export async function persistDistributionAllocationRun(tx: ApiWriteTransaction, input: PersistDistributionAllocationRunInput): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    insert into calculation_runs (
      id,
      workspace_id,
      batch_id,
      status,
      reconciliation_json,
      started_at,
      finished_at
    )
    values (
      ${input.runId},
      ${input.workspaceId},
      ${input.batchId},
      'calculated',
      ${JSON.stringify(input.metadata)}::jsonb,
      ${input.startedAtIso},
      ${input.finishedAtIso}
    )
  `);

  // Production waves contain tens of thousands of rows. Keep the whole run
  // atomic, but avoid one network round trip per row inside the transaction.
  const INSERT_CHUNK_SIZE = 400;
  for (let offset = 0; offset < input.allocations.length; offset += INSERT_CHUNK_SIZE) {
    const chunk = input.allocations.slice(offset, offset + INSERT_CHUNK_SIZE);
    const rows = chunk.map((allocation): SQL => sql`(
      ${allocation.id},
      ${allocation.earningId},
      ${input.runId},
      ${allocation.payeeId},
      ${allocation.contractId},
      ${allocation.trackId},
      ${allocation.grossAmount},
      ${allocation.originalGrossAmount},
      ${allocation.fxRate},
      ${allocation.grossShare},
      ${allocation.recoupmentApplied},
      ${allocation.netPayable},
      ${allocation.splitPercentage},
      ${allocation.currency},
      ${allocation.originalCurrency},
      'calculated'
    )`);
    await tx.executor.execute(sql`
      insert into earning_allocations (
        id,
        earning_id,
        calculation_run_id,
        payee_id,
        contract_id,
        track_id,
        gross_amount,
        original_gross_amount,
        fx_rate,
        gross_share,
        recoupment_applied,
        net_payable,
        split_percentage,
        currency,
        original_currency,
        status
      ) values ${sql.join(rows, sql`, `)}
    `);
  }

  for (let offset = 0; offset < input.expenseApplications.length; offset += INSERT_CHUNK_SIZE) {
    const chunk = input.expenseApplications.slice(offset, offset + INSERT_CHUNK_SIZE);
    const rows = chunk.map((application): SQL => sql`(
      ${randomUUID()},
      ${application.costTermId},
      ${application.payeeId},
      ${input.runId},
      ${application.amountApplied},
      ${application.currency}
    )`);
    await tx.executor.execute(sql`
      insert into expense_applications (
        id,
        cost_term_id,
        payee_id,
        calculation_run_id,
        amount_applied,
        currency
      ) values ${sql.join(rows, sql`, `)}
    `);
  }

  for (const update of input.costTermStatusUpdates) {
    await tx.executor.execute(sql`
      update contract_cost_terms
      set status = ${update.status}, updated_at = now()
      where id = ${update.id}
    `);
  }

  for (let offset = 0; offset < input.suspenseItems.length; offset += INSERT_CHUNK_SIZE) {
    const chunk = input.suspenseItems.slice(offset, offset + INSERT_CHUNK_SIZE);
    const rows = chunk.map((suspense): SQL => sql`(
      ${randomUUID()},
      ${input.workspaceId},
      ${suspense.earningId},
      ${suspense.amount},
      ${suspense.currency},
      ${suspense.reasonCode}
    )`);
    await tx.executor.execute(sql`
      insert into suspense_items (
        id,
        workspace_id,
        earning_id,
        amount,
        currency,
        reason_code
      ) values ${sql.join(rows, sql`, `)}
    `);
  }

  const allocatedEarningIds = [...new Set(input.allocations.map((allocation) => allocation.earningId))];
  if (allocatedEarningIds.length > 0) {
    await tx.executor.execute(sql`
      update normalized_earnings
      set calculation_status = 'calculated', updated_at = now()
      where workspace_id = ${input.workspaceId}
        and id in (${sql.join(allocatedEarningIds.map((earningId) => sql`${earningId}`), sql`, `)})
    `);
  }

  const suspenseEarningIds = [...new Set(input.suspenseItems.map((item) => item.earningId))];
  if (suspenseEarningIds.length > 0) {
    await tx.executor.execute(sql`
      update normalized_earnings
      set calculation_status = 'suspense', updated_at = now()
      where workspace_id = ${input.workspaceId}
        and id in (${sql.join(suspenseEarningIds.map((earningId) => sql`${earningId}`), sql`, `)})
    `);
  }
}

export async function persistDistributionStatements(tx: ApiWriteTransaction, input: PersistDistributionStatementsInput): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  for (const plan of input.statements) {
    const insertedRows = rowsFromQueryResult(await tx.executor.execute(sql`
      insert into statements (
        id,
        workspace_id,
        payee_id,
        period_start,
        period_end,
        currency,
        gross_total,
        recoupment_total,
        net_payable,
        amount_due,
        version,
        status
      )
      values (
        ${plan.statementId},
        ${input.workspaceId},
        ${plan.statement.payeeId},
        ${plan.statement.periodStart},
        ${plan.statement.periodEnd},
        ${plan.statement.currency},
        ${plan.statement.grossTotal},
        ${plan.statement.recoupmentTotal},
        ${plan.statement.netPayable},
        ${plan.statement.amountDue},
        ${plan.statement.version},
        'generated'
      )
      on conflict (payee_id, period_start, period_end, currency, version) do nothing
      returning id
    `));
    if (insertedRows.length !== 1) {
      throwPersistenceHttpError(409, "statement_generation_conflict", "A statement already exists for this payee, period, currency, and version.", [
        `payeeId=${plan.statement.payeeId}`,
        `periodStart=${plan.statement.periodStart}`,
        `periodEnd=${plan.statement.periodEnd}`,
        `currency=${plan.statement.currency}`,
        `version=${String(plan.statement.version)}`
      ]);
    }

    for (const line of plan.lines) {
      await tx.executor.execute(sql`
        insert into statement_lines (
          id,
          statement_id,
          earning_allocation_id,
          track_id,
          gross_share,
          recoupment_applied,
          net_payable,
          quantity,
          currency
        )
        values (
          ${randomUUID()},
          ${plan.statementId},
          ${line.earningAllocationId},
          ${line.trackId},
          ${line.grossShare},
          ${line.recoupmentApplied},
          ${line.netPayable},
          ${line.quantity},
          ${line.currency}
        )
      `);
    }

    await tx.executor.execute(sql`
      insert into payee_balances (
        id,
        payee_id,
        statement_id,
        currency,
        opening_balance,
        period_net,
        closing_balance,
        movement_type
      )
      values (
        ${randomUUID()},
        ${plan.balanceLedgerRow.payeeId},
        ${plan.statementId},
        ${plan.balanceLedgerRow.currency},
        ${plan.balanceLedgerRow.openingBalance},
        ${plan.balanceLedgerRow.periodNet},
        ${plan.balanceLedgerRow.closingBalance},
        ${plan.balanceLedgerRow.movementType}
      )
    `);
  }
}

export async function persistDistributionStatementVoid(tx: ApiWriteTransaction, input: PersistDistributionStatementVoidInput): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    update statements
    set status = ${input.status}, updated_at = now()
    where id = ${input.statementId}
  `);

  await tx.executor.execute(sql`
    insert into payee_balances (
      id,
      payee_id,
      statement_id,
      currency,
      opening_balance,
      period_net,
      closing_balance,
      movement_type
    )
    values (
      ${randomUUID()},
      ${input.reversalLedgerRow.payeeId},
      ${input.statementId},
      ${input.reversalLedgerRow.currency},
      ${input.reversalLedgerRow.openingBalance},
      ${input.reversalLedgerRow.periodNet},
      ${input.reversalLedgerRow.closingBalance},
      ${input.reversalLedgerRow.movementType}
    )
  `);
}

export async function persistDistributionPaymentRecord(tx: ApiWriteTransaction, input: PersistDistributionPaymentRecordInput): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    insert into payments (
      id,
      workspace_id,
      payee_id,
      amount,
      currency,
      exchange_rate,
      method,
      status,
      paid_at,
      reference,
      notes
    )
    values (
      ${input.paymentId},
      ${input.workspaceId},
      ${input.payeeId},
      ${input.amount},
      ${input.currency},
      ${input.exchangeRate},
      ${input.method},
      'recorded',
      ${input.paidAt},
      ${input.reference},
      ${input.notes}
    )
  `);

  if (input.statementId !== null && input.statementPaymentLinkId !== null) {
    await tx.executor.execute(sql`
      insert into statement_payment_links (
        id,
        statement_id,
        payment_id,
        amount_applied
      )
      values (
        ${input.statementPaymentLinkId},
        ${input.statementId},
        ${input.paymentId},
        ${input.amount}
      )
    `);
  }
}

export async function persistDistributionPaymentUpdate(tx: ApiWriteTransaction, input: PersistDistributionPaymentUpdateInput): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    update payments
    set
      amount = ${input.amount},
      currency = ${input.currency},
      exchange_rate = ${input.exchangeRate},
      method = ${input.method},
      status = 'edited',
      paid_at = ${input.paidAt},
      reference = ${input.reference},
      notes = ${input.notes},
      updated_at = now()
    where id = ${input.paymentId}
  `);

}

export async function persistDistributionPaymentReconcile(tx: ApiWriteTransaction, input: PersistDistributionPaymentReconcileInput): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    update payments
    set
      status = 'reconciled',
      updated_at = ${input.reconciledAt}
    where id = ${input.paymentId}
  `);

  await tx.executor.execute(sql`
    insert into statement_payment_links (
      id,
      statement_id,
      payment_id,
      amount_applied
    )
    values (
      ${input.statementPaymentLinkId},
      ${input.statementId},
      ${input.paymentId},
      ${input.amountApplied}
    )
    on conflict (statement_id, payment_id) do update
    set amount_applied = excluded.amount_applied
  `);
}

export async function persistDistributionPaymentVoid(tx: ApiWriteTransaction, input: PersistDistributionPaymentVoidInput): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  // The payment row is kept and flipped to 'void'; balance reads already treat
  // void payments as zero applied, so the statement balance self-corrects.
  await tx.executor.execute(sql`
    update payments
    set status = 'void', updated_at = now()
    where id = ${input.paymentId}
  `);
}

export async function persistDistributionRoyaltyRules(tx: ApiWriteTransaction, input: PersistDistributionRoyaltyRulesInput): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    update royalty_rules
    set status = 'archived', updated_at = now()
    where contract_id = ${input.contractId}
      and status <> 'archived'
  `);

  for (const rule of input.rules) {
    await tx.executor.execute(sql`
      insert into royalty_rules (
        id,
        contract_id,
        payee_id,
        percentage,
        scope_type,
        scope_id,
        priority,
        effective_from,
        effective_to,
        recoupable,
        status
      )
      values (
        ${rule.id},
        ${rule.contractId},
        ${rule.payeeId},
        ${rule.percentage},
        ${rule.scopeType},
        ${rule.scopeId},
        ${rule.priority},
        ${rule.effectiveFrom},
        ${rule.effectiveTo},
        true,
        ${rule.status}
      )
    `);
  }
}

export async function persistDistributionFxRates(tx: ApiWriteTransaction, input: PersistDistributionFxRatesInput): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  for (const rate of input.rates) {
    await tx.executor.execute(sql`
      insert into fx_rates (
        id,
        from_currency,
        to_currency,
        effective_date,
        rate
      )
      values (
        ${randomUUID()},
        ${rate.fromCurrency},
        ${rate.toCurrency},
        ${rate.effectiveDate},
        ${rate.rate}
      )
      on conflict (from_currency, to_currency, effective_date) do update
      set rate = excluded.rate
    `);
  }
}

export async function persistDistributionAliasUpsert(tx: ApiWriteTransaction, input: PersistDistributionAliasUpsertInput): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  const artistId = input.targetType === "artist" ? input.targetId : null;
  const payeeId = input.targetType === "payee" ? input.targetId : null;
  const labelId = input.targetType === "label" ? input.targetId : null;
  const releaseId = input.targetType === "release" ? input.targetId : null;
  const trackId = input.targetType === "track" ? input.targetId : null;

  await tx.executor.execute(sql`
    delete from catalog_aliases
    where id = ${input.aliasId}
      or lower(alias_text) = lower(${input.aliasText})
  `);

  await tx.executor.execute(sql`
    insert into catalog_aliases (
      id,
      alias_text,
      artist_id,
      payee_id,
      label_id,
      release_id,
      track_id
    )
    values (
      ${input.aliasId},
      ${input.aliasText},
      ${artistId},
      ${payeeId},
      ${labelId},
      ${releaseId},
      ${trackId}
    )
  `);
}

export async function persistDistributionDuplicateResolve(tx: ApiWriteTransaction, input: PersistDistributionDuplicateResolveInput): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  if (input.earningIds.length === 0) {
    return;
  }

  const earningIds = sql.join(input.earningIds.map((earningId: string) => sql`${earningId}`), sql`, `);
  await tx.executor.execute(sql`
    update normalized_earnings
    set
      calculation_status = 'excluded',
      updated_at = now()
    where id in (${earningIds})
  `);
}

export async function persistDistributionPayeeBalanceAdjustments(
  tx: ApiWriteTransaction,
  input: PersistDistributionPayeeBalanceAdjustmentsInput
): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  for (const row of input.rows) {
    await tx.executor.execute(sql`
      insert into payee_balances (
        id,
        payee_id,
        statement_id,
        currency,
        opening_balance,
        period_net,
        closing_balance,
        movement_type,
        created_at
      )
      values (
        ${row.id},
        ${row.payeeId},
        ${row.statementId},
        ${row.currency},
        ${row.openingBalance},
        ${row.periodNet},
        ${row.closingBalance},
        ${row.movementType},
        ${row.createdAt}
      )
    `);
  }
}

export async function persistIdentityLink(tx: ApiWriteTransaction, input: PersistIdentityLinkInput): Promise<void> {
  if (tx.kind === "memory") {
    return;
  }

  await tx.executor.execute(sql`
    update identity_link
    set status = 'archived', updated_at = now()
    where status <> 'archived'
      and (payee_id = ${input.payeeId} or office_partner_id = ${input.officePartnerId})
      and not (payee_id = ${input.payeeId} and office_partner_id = ${input.officePartnerId})
  `);

  await tx.executor.execute(sql`
    insert into identity_link (
      id,
      payee_id,
      office_partner_id,
      confidence,
      status
    )
    values (
      ${input.id},
      ${input.payeeId},
      ${input.officePartnerId},
      ${input.confidence},
      ${input.status}
    )
    on conflict (payee_id, office_partner_id) do update
    set
      confidence = excluded.confidence,
      status = excluded.status,
      updated_at = now()
  `);
}

export async function markDistributionImportBatchVoid(tx: ApiWriteTransaction, batchId: string): Promise<JsonRecord> {
  if (tx.kind === "memory") {
    return {
      previousStatus: "unknown",
      nextStatus: "void"
    };
  }

  const beforeRows = rowsFromQueryResult(await tx.executor.execute(sql`
    select status
    from import_batches
    where id = ${batchId}
  `));
  const previousStatus = stringField(beforeRows[0], "status");
  const allocationRows = rowsFromQueryResult(await tx.executor.execute(sql`
    select count(*)::int as count
    from earning_allocations ea
    join normalized_earnings ne on ne.id = ea.earning_id
    where ne.batch_id = ${batchId}
      and ea.status not in ('void', 'error')
  `));
  const activeAllocationCount = integerField(allocationRows[0] ?? {}, "count");
  if (activeAllocationCount > 0) {
    throwPersistenceHttpError(409, "distribution_import_has_allocations", "Reverse the allocation run before voiding this import batch.", [
      `batchId=${batchId}`,
      `activeAllocationCount=${String(activeAllocationCount)}`
    ]);
  }
  await tx.executor.execute(sql`
    update import_batches
    set status = 'void', updated_at = now()
    where id = ${batchId}
  `);
  await tx.executor.execute(sql`
    update normalized_earnings
    set mapping_status = 'ignored', calculation_status = 'excluded', updated_at = now()
    where batch_id = ${batchId}
  `);
  return {
    previousStatus,
    nextStatus: "void"
  };
}

export async function markOfficeBankImportBatchVoid(tx: ApiWriteTransaction, batchId: string): Promise<JsonRecord> {
  if (tx.kind === "memory") {
    return {
      previousStatus: "unknown",
      nextStatus: "void"
    };
  }

  const beforeRows = rowsFromQueryResult(await tx.executor.execute(sql`
    select status
    from office_bank_import_batches
    where id = ${batchId}
  `));
  const previousStatus = stringField(beforeRows[0], "status");
  await tx.executor.execute(sql`
    update office_bank_import_batches
    set status = 'void', updated_at = now()
    where id = ${batchId}
  `);
  return {
    previousStatus,
    nextStatus: "void"
  };
}

export function hashRequestBody(body: unknown): string {
  return createHash("sha256").update(canonicalJson(body)).digest("hex");
}

export function disabledWriteBody(action: string): DisabledWriteBody {
  return {
    error: "action_not_enabled_yet",
    message: `This action (${action}) is currently not enabled yet.`,
    action
  };
}

export function isApiPersistenceHttpError(error: unknown): error is ApiPersistenceHttpError {
  return (
    error instanceof Error &&
    typeof (error as { readonly status?: unknown }).status === "number" &&
    typeof (error as { readonly code?: unknown }).code === "string" &&
    Array.isArray((error as { readonly context?: unknown }).context)
  );
}

function isWritesEnabled(env: Readonly<Record<string, string | undefined>>): boolean {
  const value = env.WRITES_ENABLED;
  return value === "1" || value === "true";
}

async function beginIdempotent(tx: ApiWriteTransaction, input: BeginIdempotentInput): Promise<BeginIdempotentResult> {
  if (tx.kind === "memory") {
    const existing = tx.state.idempotency.get(input.key);
    if (existing !== undefined) {
      return beginResultFromExisting(existing, input);
    }

    tx.state.idempotency.set(input.key, {
      key: input.key,
      route: input.route,
      requestHash: input.requestHash,
      responseJson: null
    });
    return { status: "started" };
  }

  const insertedRows = rowsFromQueryResult(await tx.executor.execute(sql`
    insert into api_idempotency_keys (
      key,
      route,
      request_hash,
      response_json
    )
    values (
      ${input.key},
      ${input.route},
      ${input.requestHash},
      null
    )
    on conflict (key) do nothing
    returning key
  `));

  if (insertedRows.length === 1) {
    return { status: "started" };
  }

  const existingRows = rowsFromQueryResult(await tx.executor.execute(sql`
    select key, route, request_hash, response_json
    from api_idempotency_keys
    where key = ${input.key}
  `));
  const existing = idempotencyRowFromPg(existingRows[0], input.key);
  return beginResultFromExisting(existing, input);
}

async function completeIdempotent(tx: ApiWriteTransaction, key: string, responseJson: JsonRecord): Promise<void> {
  if (tx.kind === "memory") {
    const existing = tx.state.idempotency.get(key);
    if (existing === undefined) {
      throwPersistenceHttpError(500, "idempotency_state_missing", "Idempotency state disappeared before completion.", [`key=${key}`]);
    }

    tx.state.idempotency.set(key, {
      ...existing,
      responseJson
    });
    return;
  }

  await tx.executor.execute(sql`
    update api_idempotency_keys
    set response_json = ${JSON.stringify(responseJson)}::jsonb
    where key = ${key}
  `);
}

async function persistApiImportPreview<TPreview extends DistributionImportPreviewRecord | OfficeBankImportPreviewRecord>(
  executor: SqlExecutor,
  kind: ImportPreviewKind,
  preview: TPreview
): Promise<void> {
  const expiresAtIso = new Date(Date.parse(preview.createdAtIso) + 24 * 60 * 60 * 1000).toISOString();
  await executor.execute(sql`
    insert into api_import_previews (
      preview_id,
      workspace_id,
      kind,
      payload_json,
      expires_at
    )
    values (
      ${preview.previewId},
      ${preview.workspaceId},
      ${kind},
      ${JSON.stringify(preview)}::jsonb,
      ${expiresAtIso}
    )
    on conflict (preview_id) do update
    set
      workspace_id = excluded.workspace_id,
      kind = excluded.kind,
      payload_json = excluded.payload_json,
      expires_at = excluded.expires_at
  `);
}

async function readApiImportPreview<TPreview extends DistributionImportPreviewRecord | OfficeBankImportPreviewRecord>(
  executor: SqlExecutor,
  kind: ImportPreviewKind,
  previewId: string,
  nowIso: string
): Promise<TPreview | null> {
  // Compare against the caller's clock (nowIso), not Postgres' own now() — expires_at
  // is derived from that same clock at write time (persistApiImportPreview), and tests
  // inject a fixed nowIso, so mixing in the DB's real wall clock here drifts the two
  // apart and makes previews spuriously "expire" once real time moves past the fixed
  // test date.
  const rows = rowsFromQueryResult(await executor.execute(sql`
    select payload_json
    from api_import_previews
    where preview_id = ${previewId}
      and kind = ${kind}
      and (expires_at is null or expires_at > ${nowIso}::timestamptz)
  `));
  const row = rows[0];
  if (row === undefined) {
    return null;
  }

  const payload = row["payload_json"];
  if (!isJsonRecord(payload)) {
    throwPersistenceHttpError(500, "import_preview_payload_invalid", "Import preview payload is not a JSON object.", [
      `previewId=${previewId}`,
      `kind=${kind}`
    ]);
  }

  return payload as unknown as TPreview;
}

function beginResultFromExisting(existing: StoredIdempotencyResult, input: BeginIdempotentInput): BeginIdempotentResult {
  if (existing.route !== input.route || existing.requestHash !== input.requestHash) {
    throwPersistenceHttpError(409, "idempotency_key_conflict", "Idempotency-Key was already used with a different request.", [
      `key=${input.key}`,
      `existingRoute=${existing.route}`,
      `route=${input.route}`
    ]);
  }

  if (existing.responseJson === null) {
    throwPersistenceHttpError(409, "idempotency_key_in_progress", "Idempotency-Key is already in progress.", [
      `key=${input.key}`,
      `route=${input.route}`
    ]);
  }

  return {
    status: "replay",
    responseJson: existing.responseJson
  };
}

function isJsonRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function idempotencyRowFromPg(row: JsonRecord | undefined, key: string): StoredIdempotencyResult {
  if (row === undefined) {
    throwPersistenceHttpError(500, "idempotency_state_missing", "Idempotency row could not be read after conflict.", [`key=${key}`]);
  }

  return {
    key: stringField(row, "key"),
    route: stringField(row, "route"),
    requestHash: stringField(row, "request_hash"),
    responseJson: jsonRecordOrNull(row.response_json)
  };
}

function statusForStoredResponse(response: JsonRecord): ApiMutationStatus {
  return response.error === "action_not_enabled_yet" ? 501 : 200;
}

function throwPersistenceHttpError(status: ApiPersistenceHttpStatus, code: string, message: string, context: readonly string[]): never {
  const error = new Error(message) as ApiPersistenceHttpError;
  Object.defineProperties(error, {
    status: { value: status, enumerable: true },
    code: { value: code, enumerable: true },
    context: { value: context, enumerable: true }
  });
  error.name = "ApiPersistenceHttpError";
  throw error;
}

function createInitialPersistenceState(): PersistenceState {
  return {
    memory: {
      idempotency: new Map<string, StoredIdempotencyResult>(),
      auditEvents: []
    },
    distributionPreviews: new Map<string, DistributionImportPreviewRecord>(),
    officeBankPreviews: new Map<string, OfficeBankImportPreviewRecord>()
  };
}

function cloneMemoryPersistenceState(state: MemoryPersistenceState): MemoryPersistenceState {
  return {
    idempotency: new Map<string, StoredIdempotencyResult>(state.idempotency),
    auditEvents: [...state.auditEvents]
  };
}

function rowsFromQueryResult(result: unknown): readonly JsonRecord[] {
  if (typeof result === "object" && result !== null && Array.isArray((result as { readonly rows?: unknown }).rows)) {
    return (result as { readonly rows: readonly JsonRecord[] }).rows;
  }

  if (Array.isArray(result)) {
    return result.filter((row: unknown): row is JsonRecord => typeof row === "object" && row !== null);
  }

  return [];
}

async function readPersistedAuditEvents(executor: SqlExecutor, scope: AuditEventScope): Promise<readonly PersistedAuditEvent[]> {
  const actionPattern = `^${scope}[._]`;
  const rows = rowsFromQueryResult(await executor.execute(sql`
    select
      id::text,
      created_at,
      coalesce(actor_user_id::text, 'system') as actor_id,
      action,
      entity_type,
      entity_id::text,
      metadata->>'idempotencyKey' as idempotency_key,
      metadata
    from audit_logs
    where action ~ ${actionPattern}
    order by created_at desc, id desc
    limit 1000
  `));

  return rows.map((row): PersistedAuditEvent => ({
    id: stringField(row, "id"),
    occurredAt: timestampField(row, "created_at"),
    actorId: stringField(row, "actor_id"),
    action: stringField(row, "action"),
    entityType: stringField(row, "entity_type"),
    entityId: stringField(row, "entity_id"),
    idempotencyKey: nullableStringField(row, "idempotency_key"),
    context: stringContext(row.metadata)
  }));
}

function isAuditActionInScope(action: string, scope: AuditEventScope): boolean {
  return action.startsWith(`${scope}.`) || action.startsWith(`${scope}_`);
}

function timestampField(row: JsonRecord, key: string): string {
  const value = row[key];
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) {
      return new Date(timestamp).toISOString();
    }
  }
  throwPersistenceHttpError(500, "timestamp_field_invalid", "Database row field is not a timestamp.", [`field=${key}`]);
}

function stringContext(value: unknown): Readonly<Record<string, string>> {
  if (!isJsonRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]): readonly (readonly [string, string])[] => {
      if (typeof item === "string") {
        return [[key, item]];
      }
      if (typeof item === "number" || typeof item === "boolean") {
        return [[key, String(item)]];
      }
      return [];
    })
  );
}

function stringField(row: JsonRecord | undefined, key: string): string {
  if (row === undefined) {
    return "unknown";
  }

  const value = row[key];
  return typeof value === "string" ? value : "unknown";
}

function integerField(row: JsonRecord, key: string): number {
  const value = row[key];
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && /^-?\d+$/u.test(value)) {
    return Number.parseInt(value, 10);
  }

  throwPersistenceHttpError(500, "integer_field_invalid", "Database row field is not an integer.", [`field=${key}`]);
}

function nullableStringField(row: JsonRecord, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  throwPersistenceHttpError(500, "string_field_invalid", "Database row field is not a string.", [`field=${key}`]);
}

function bigintField(row: JsonRecord, key: string): bigint {
  const value = row[key];
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "string" && /^-?\d+$/u.test(value)) {
    return BigInt(value);
  }
  throwPersistenceHttpError(500, "bigint_field_invalid", "Database row field is not an integer.", [`field=${key}`]);
}

function nullableBigintField(row: JsonRecord, key: string): bigint | null {
  const value = row[key];
  return value === null || value === undefined ? null : bigintField(row, key);
}

function officeBankDirectionField(row: JsonRecord, key: string): "credit" | "debit" {
  const value = row[key];
  if (value === "credit" || value === "debit") {
    return value;
  }
  throwPersistenceHttpError(500, "office_bank_direction_invalid", "Office bank statement direction is invalid.", [`field=${key}`]);
}

function officeBankImportStatusField(row: JsonRecord, key: string): ExistingOfficeBankImportBatch["status"] {
  const value = row[key];
  if (value === "previewed" || value === "confirmed" || value === "failed" || value === "void") {
    return value;
  }

  throwPersistenceHttpError(500, "office_bank_import_status_invalid", "Office bank import batch status is invalid.", [`field=${key}`]);
}

function jsonRecordOrNull(value: unknown): JsonRecord | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as JsonRecord;
  }

  throwPersistenceHttpError(500, "idempotency_response_invalid", "Stored idempotency response is not a JSON object.", []);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item: unknown): string => canonicalJson(item)).join(",")}]`;
  }

  const objectValue = value as Readonly<Record<string, unknown>>;
  const entries = Object.keys(objectValue)
    .sort()
    .map((key: string): string => `${JSON.stringify(key)}:${canonicalJson(objectValue[key])}`);
  return `{${entries.join(",")}}`;
}
