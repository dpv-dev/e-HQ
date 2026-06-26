import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { sql, type SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type {
  CostTermStatusUpdate,
  DistributionFxRateInput,
  DistributionSuspenseItemInsert,
  EarningAllocationInsert,
  ExpenseApplicationInsert,
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
  readonly source: "sbi" | "mcb" | "csv" | "cashflow" | "pdf";
  readonly fileName: string;
  readonly checksum: string;
  readonly idempotencyFingerprint: string;
  readonly rows: readonly ApiImportPreviewRow[];
  readonly createdAtIso: string;
}

export interface ApiPersistenceRuntime {
  readonly writesEnabled: boolean;
  readonly withTx: <TResult>(callback: (tx: ApiWriteTransaction) => Promise<TResult>) => Promise<TResult>;
  readonly storeDistributionImportPreview: (preview: DistributionImportPreviewRecord) => void;
  readonly getDistributionImportPreview: (previewId: string) => DistributionImportPreviewRecord | null;
  readonly storeOfficeBankImportPreview: (preview: OfficeBankImportPreviewRecord) => void;
  readonly getOfficeBankImportPreview: (previewId: string) => OfficeBankImportPreviewRecord | null;
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
  readonly source: "kontor" | "routenote";
  readonly fileName: string;
  readonly status: "processing" | "failed" | "void";
  readonly importedAtIso: string;
  readonly rows: readonly ApiImportPreviewRow[];
  readonly acceptedRowIds: readonly string[];
  readonly rejectedRowIds: readonly string[];
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

export interface PersistDistributionAllocationRunInput {
  readonly runId: string;
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
  readonly statements: readonly StatementPersistPlan[];
}

export interface PersistDistributionStatementVoidInput {
  readonly statementId: string;
  readonly status: "void";
  readonly reversalLedgerRow: PayeeBalanceInsertPlan;
}

export interface PersistDistributionPaymentRecordInput {
  readonly paymentId: string;
  readonly statementPaymentLinkId: string;
  readonly statementId: string;
  readonly payeeId: string;
  readonly amount: string;
  readonly currency: string;
  readonly paidAt: string;
  readonly reference: string;
}

export interface PersistDistributionPaymentUpdateInput {
  readonly paymentId: string;
  readonly amount: string;
  readonly currency: string;
  readonly reference: string;
}

export interface PersistDistributionPaymentReconcileInput {
  readonly paymentId: string;
  readonly statementPaymentLinkId: string;
  readonly statementId: string;
  readonly amountApplied: string;
  readonly bankTransactionId: string;
  readonly reconciledAt: string;
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
  readonly auditEvents: JsonRecord[];
}

interface PersistenceState {
  readonly memory: MemoryPersistenceState;
  readonly distributionPreviews: Map<string, DistributionImportPreviewRecord>;
  readonly officeBankPreviews: Map<string, OfficeBankImportPreviewRecord>;
}

const SENSITIVE_ACTIONS = new Set<string>([
  "distribution_allocations_preview",
  "distribution_allocations_run",
  "distribution_allocations_unpost",
  "distribution_contract_expense_create",
  "distribution_contract_expense_update",
  "distribution_contract_rules_update",
  "distribution_contract_upsert",
  "distribution_fx_rates_save",
  "distribution_identity_link",
  "distribution_import_confirm",
  "distribution_import_preview",
  "distribution_import_reverse",
  "distribution_mapping_apply_rules",
  "distribution_payment_record",
  "distribution_payment_reconcile",
  "distribution_payment_update",
  "distribution_payee_upsert",
  "distribution_release_upsert",
  "distribution_statement_generate",
  "distribution_statement_void",
  "distribution_suspense_resolve",
  "distribution_track_upsert",
  "office_bank_import_confirm",
  "office_bank_import_preview",
  "office_bank_import_reverse",
  "office_partner_payee_link",
  "office_partner_payee_unlink",
  "office_reconciliation_approve"
]);

const ALLOWED_MUTATING_ACTIONS = new Set<string>([
  ...SENSITIVE_ACTIONS,
  "office_partner_create",
  "office_partner_update",
  "office_plan_comptable_create",
  "office_plan_comptable_update",
  "office_transaction_create",
  "office_transaction_update"
]);

const OFFICE_BOT_ACTIONS = new Set<string>([
  "office_bank_import_preview",
  "office_bank_import_confirm",
  "office_transaction_create",
  "office_transaction_update"
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
    storeDistributionImportPreview: (preview: DistributionImportPreviewRecord): void => {
      state.distributionPreviews.set(preview.previewId, preview);
    },
    getDistributionImportPreview: (previewId: string): DistributionImportPreviewRecord | null => state.distributionPreviews.get(previewId) ?? null,
    storeOfficeBankImportPreview: (preview: OfficeBankImportPreviewRecord): void => {
      state.officeBankPreviews.set(preview.previewId, preview);
    },
    getOfficeBankImportPreview: (previewId: string): OfficeBankImportPreviewRecord | null => state.officeBankPreviews.get(previewId) ?? null
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
    storeDistributionImportPreview: (preview: DistributionImportPreviewRecord): void => {
      state.distributionPreviews.set(preview.previewId, preview);
    },
    getDistributionImportPreview: (previewId: string): DistributionImportPreviewRecord | null => state.distributionPreviews.get(previewId) ?? null,
    storeOfficeBankImportPreview: (preview: OfficeBankImportPreviewRecord): void => {
      state.officeBankPreviews.set(preview.previewId, preview);
    },
    getOfficeBankImportPreview: (previewId: string): OfficeBankImportPreviewRecord | null => state.officeBankPreviews.get(previewId) ?? null
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
      actorUserId: input.actor.userId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      before: input.before,
      after: input.after,
      idempotencyKey: input.idempotencyKey
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
      source,
      file_name,
      status,
      imported_at,
      metadata
    )
    values (
      ${input.batchId},
      ${input.source},
      ${input.fileName},
      ${input.status},
      ${input.importedAtIso},
      ${JSON.stringify(input.metadata)}::jsonb
    )
  `);

  const accepted = new Set<string>(input.acceptedRowIds);
  const rejected = new Set<string>(input.rejectedRowIds);
  for (const row of input.rows) {
    const rawImportRowId = randomUUID();
    await tx.executor.execute(sql`
      insert into raw_import_rows (
        id,
        batch_id,
        row_number,
        raw_data
      )
      values (
        ${rawImportRowId},
        ${input.batchId},
        ${row.rowNumber},
        ${JSON.stringify(row.rawData)}::jsonb
      )
    `);
    await tx.executor.execute(sql`
      insert into import_issues (
        id,
        batch_id,
        raw_import_row_id,
        severity,
        code,
        message,
        metadata
      )
      values (
        ${randomUUID()},
        ${input.batchId},
        ${rawImportRowId},
        'warning',
        'runtime_parser_missing',
        'Structured preview rows were persisted as raw import rows; no runtime distribution parser is enabled in services/api yet.',
        ${JSON.stringify({
          operatorDecision: accepted.has(row.id) ? "accepted" : rejected.has(row.id) ? "rejected" : "unselected",
          previewRowId: row.id
        })}::jsonb
      )
    `);
  }
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

  for (const line of input.lines) {
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
      values (
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
      )
    `);
  }
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
      batch_id,
      status,
      reconciliation_json,
      started_at,
      finished_at
    )
    values (
      ${input.runId},
      ${input.batchId},
      'calculated',
      ${JSON.stringify(input.metadata)}::jsonb,
      ${input.startedAtIso},
      ${input.finishedAtIso}
    )
  `);

  for (const allocation of input.allocations) {
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
      )
      values (
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
      )
    `);
  }

  for (const application of input.expenseApplications) {
    await tx.executor.execute(sql`
      insert into expense_applications (
        id,
        cost_term_id,
        payee_id,
        calculation_run_id,
        amount_applied,
        currency
      )
      values (
        ${randomUUID()},
        ${application.costTermId},
        ${application.payeeId},
        ${input.runId},
        ${application.amountApplied},
        ${application.currency}
      )
    `);
  }

  for (const update of input.costTermStatusUpdates) {
    await tx.executor.execute(sql`
      update contract_cost_terms
      set status = ${update.status}, updated_at = now()
      where id = ${update.id}
    `);
  }

  for (const suspense of input.suspenseItems) {
    await tx.executor.execute(sql`
      insert into suspense_items (
        id,
        earning_id,
        amount,
        currency,
        reason_code
      )
      values (
        ${randomUUID()},
        ${suspense.earningId},
        ${suspense.amount},
        ${suspense.currency},
        ${suspense.reasonCode}
      )
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
      payee_id,
      amount,
      currency,
      status,
      paid_at,
      reference
    )
    values (
      ${input.paymentId},
      ${input.payeeId},
      ${input.amount},
      ${input.currency},
      'recorded',
      ${input.paidAt},
      ${input.reference}
    )
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
      ${input.amount}
    )
  `);
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
      status = 'edited',
      reference = ${input.reference},
      updated_at = now()
    where id = ${input.paymentId}
  `);

  await tx.executor.execute(sql`
    update statement_payment_links
    set amount_applied = ${input.amount}
    where payment_id = ${input.paymentId}
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
  await tx.executor.execute(sql`
    update import_batches
    set status = 'void', updated_at = now()
    where id = ${batchId}
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

function stringField(row: JsonRecord | undefined, key: string): string {
  if (row === undefined) {
    return "unknown";
  }

  const value = row[key];
  return typeof value === "string" ? value : "unknown";
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
