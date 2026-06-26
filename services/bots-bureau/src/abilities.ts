export type BotRole = "bot_office" | "bot_distribution";
export type AbilityMode = "read" | "write";
export type FinancialLockScope = "none" | "financial-run";

export interface BotAbility {
  readonly name: string;
  readonly title: string;
  readonly role: BotRole;
  readonly mode: AbilityMode;
  readonly method: "GET" | "POST" | "PATCH";
  readonly pathTemplate: string;
  readonly description: string;
  readonly lockScope: FinancialLockScope;
  readonly maxRows: number | null;
}

export const BOT_ABILITIES: readonly BotAbility[] = [
  {
    name: "office.dashboard.get",
    title: "Read Office dashboard",
    role: "bot_office",
    mode: "read",
    method: "GET",
    pathTemplate: "/eof/v1/dashboard",
    description: "Fetches Office dashboard context before Sophie proposes Office writes.",
    lockScope: "none",
    maxRows: null
  },
  {
    name: "bank.accounts.list",
    title: "Read bank accounts",
    role: "bot_office",
    mode: "read",
    method: "GET",
    pathTemplate: "/eof/v1/bank/accounts",
    description: "Lists Office bank accounts so Sophie uses real account ids.",
    lockScope: "none",
    maxRows: null
  },
  {
    name: "bank.lines.list",
    title: "Read bank lines",
    role: "bot_office",
    mode: "read",
    method: "GET",
    pathTemplate: "/eof/v1/bank/raw",
    description: "Lists bank statement lines before classification or draft transactions.",
    lockScope: "none",
    maxRows: null
  },
  {
    name: "transactions.list",
    title: "Read Office transactions",
    role: "bot_office",
    mode: "read",
    method: "GET",
    pathTemplate: "/eof/v1/transactions",
    description: "Lists Office transactions for read-before-write reconciliation.",
    lockScope: "none",
    maxRows: null
  },
  {
    name: "plan-comptable.list",
    title: "Read chart of accounts",
    role: "bot_office",
    mode: "read",
    method: "GET",
    pathTemplate: "/eof/v1/plan-comptable",
    description: "Lists Office categories so Sophie never guesses category ids.",
    lockScope: "none",
    maxRows: null
  },
  {
    name: "bank.import.preview",
    title: "Preview bank import",
    role: "bot_office",
    mode: "write",
    method: "POST",
    pathTemplate: "/eof/v1/bank-import/preview",
    description: "Dry-runs a small Office bank import batch before confirm.",
    lockScope: "none",
    maxRows: 50
  },
  {
    name: "bank.import.confirm",
    title: "Confirm bank import",
    role: "bot_office",
    mode: "write",
    method: "POST",
    pathTemplate: "/eof/v1/bank-import/confirm",
    description: "Confirms an Office bank import preview through the guarded API.",
    lockScope: "financial-run",
    maxRows: 50
  },
  {
    name: "bank.line.classify",
    title: "Classify bank line",
    role: "bot_office",
    mode: "write",
    method: "PATCH",
    pathTemplate: "/eof/v1/transactions/{transactionId}",
    description: "Updates the transaction draft associated with a bank line classification.",
    lockScope: "none",
    maxRows: 1
  },
  {
    name: "transaction.upsert",
    title: "Create draft transaction",
    role: "bot_office",
    mode: "write",
    method: "POST",
    pathTemplate: "/eof/v1/transactions",
    description: "Creates an Office transaction draft from read bank context.",
    lockScope: "none",
    maxRows: 1
  },
  {
    name: "transaction.category.set",
    title: "Set transaction category",
    role: "bot_office",
    mode: "write",
    method: "PATCH",
    pathTemplate: "/eof/v1/transactions/{transactionId}",
    description: "Sets a category on an existing Office transaction draft.",
    lockScope: "none",
    maxRows: 1
  },
  {
    name: "transaction.validate",
    title: "Validate transaction",
    role: "bot_office",
    mode: "write",
    method: "PATCH",
    pathTemplate: "/eof/v1/transactions/{transactionId}",
    description: "Promotes a prepared Office transaction through the explicit validate step.",
    lockScope: "financial-run",
    maxRows: 1
  },
  {
    name: "distribution.dashboard.get",
    title: "Read Distribution dashboard",
    role: "bot_distribution",
    mode: "read",
    method: "GET",
    pathTemplate: "/erh/v1/dashboard",
    description: "Fetches Distribution dashboard context before Théo writes.",
    lockScope: "none",
    maxRows: null
  },
  {
    name: "contracts.list",
    title: "Read contracts",
    role: "bot_distribution",
    mode: "read",
    method: "GET",
    pathTemplate: "/erh/v1/contracts",
    description: "Lists contracts so Théo uses real contract ids.",
    lockScope: "none",
    maxRows: null
  },
  {
    name: "mapping.rows.list",
    title: "Read mapping rows",
    role: "bot_distribution",
    mode: "read",
    method: "GET",
    pathTemplate: "/erh/v1/mapping/rows",
    description: "Lists mapping rows before applying rules.",
    lockScope: "none",
    maxRows: null
  },
  {
    name: "payees.list",
    title: "Read payees",
    role: "bot_distribution",
    mode: "read",
    method: "GET",
    pathTemplate: "/erh/v1/payees",
    description: "Lists payees and artists for scoped Distribution work.",
    lockScope: "none",
    maxRows: null
  },
  {
    name: "releases.list",
    title: "Read releases",
    role: "bot_distribution",
    mode: "read",
    method: "GET",
    pathTemplate: "/erh/v1/releases",
    description: "Lists releases so Théo never invents release ids.",
    lockScope: "none",
    maxRows: null
  },
  {
    name: "tracks.list",
    title: "Read tracks",
    role: "bot_distribution",
    mode: "read",
    method: "GET",
    pathTemplate: "/erh/v1/tracks",
    description: "Lists tracks so Théo never invents track ids.",
    lockScope: "none",
    maxRows: null
  },
  {
    name: "suspense.list",
    title: "Read suspense",
    role: "bot_distribution",
    mode: "read",
    method: "GET",
    pathTemplate: "/erh/v1/suspense",
    description: "Lists suspense rows before resolving them.",
    lockScope: "none",
    maxRows: null
  },
  {
    name: "statements.list",
    title: "Read statements",
    role: "bot_distribution",
    mode: "read",
    method: "GET",
    pathTemplate: "/erh/v1/statements",
    description: "Lists statements before payment or reconciliation writes.",
    lockScope: "none",
    maxRows: null
  },
  {
    name: "payments.list",
    title: "Read payments",
    role: "bot_distribution",
    mode: "read",
    method: "GET",
    pathTemplate: "/erh/v1/payments",
    description: "Lists payment records before reconciliation writes.",
    lockScope: "none",
    maxRows: null
  },
  {
    name: "contract.upsert",
    title: "Create or update contract",
    role: "bot_distribution",
    mode: "write",
    method: "POST",
    pathTemplate: "/erh/v1/contracts",
    description: "Guarded contract upsert door; the API returns honest not-enabled until the contract write model is activated.",
    lockScope: "financial-run",
    maxRows: 1
  },
  {
    name: "contract.split.set",
    title: "Set contract split",
    role: "bot_distribution",
    mode: "write",
    method: "POST",
    pathTemplate: "/erh/v1/contracts/{contractId}/rules",
    description: "Persists exact contract split rules through the Hono API.",
    lockScope: "financial-run",
    maxRows: 50
  },
  {
    name: "contract.expense.add",
    title: "Add contract expense",
    role: "bot_distribution",
    mode: "write",
    method: "POST",
    pathTemplate: "/erh/v1/contracts/{contractId}/expenses",
    description: "Adds an audited contract expense.",
    lockScope: "financial-run",
    maxRows: 1
  },
  {
    name: "contract.expense.update",
    title: "Update contract expense",
    role: "bot_distribution",
    mode: "write",
    method: "PATCH",
    pathTemplate: "/erh/v1/contracts/{contractId}/expenses/{expenseId}",
    description: "Guarded contract expense update door; the API returns honest not-enabled until the update write model is activated.",
    lockScope: "financial-run",
    maxRows: 1
  },
  {
    name: "payee.upsert",
    title: "Create or update payee",
    role: "bot_distribution",
    mode: "write",
    method: "POST",
    pathTemplate: "/erh/v1/payees",
    description: "Guarded payee upsert door; the API returns honest not-enabled until the catalog write model is activated.",
    lockScope: "financial-run",
    maxRows: 1
  },
  {
    name: "artist.upsert",
    title: "Create or update artist",
    role: "bot_distribution",
    mode: "write",
    method: "POST",
    pathTemplate: "/erh/v1/payees",
    description: "Guarded artist upsert door using the payee catalog surface.",
    lockScope: "financial-run",
    maxRows: 1
  },
  {
    name: "release.upsert",
    title: "Create or update release",
    role: "bot_distribution",
    mode: "write",
    method: "POST",
    pathTemplate: "/erh/v1/releases",
    description: "Guarded release upsert door; the API returns honest not-enabled until the catalog write model is activated.",
    lockScope: "financial-run",
    maxRows: 1
  },
  {
    name: "track.upsert",
    title: "Create or update track",
    role: "bot_distribution",
    mode: "write",
    method: "POST",
    pathTemplate: "/erh/v1/tracks",
    description: "Guarded track upsert door; the API returns honest not-enabled until the catalog write model is activated.",
    lockScope: "financial-run",
    maxRows: 1
  },
  {
    name: "mapping.apply-rules",
    title: "Apply mapping rules",
    role: "bot_distribution",
    mode: "write",
    method: "POST",
    pathTemplate: "/erh/v1/mapping/apply-rules",
    description: "Applies mapping rules through the guarded Distribution route.",
    lockScope: "financial-run",
    maxRows: 50
  },
  {
    name: "suspense.resolve",
    title: "Resolve suspense",
    role: "bot_distribution",
    mode: "write",
    method: "POST",
    pathTemplate: "/erh/v1/suspense/{suspenseId}/resolve",
    description: "Resolves a single suspense item through the audited route.",
    lockScope: "financial-run",
    maxRows: 1
  },
  {
    name: "payment.record",
    title: "Record payment",
    role: "bot_distribution",
    mode: "write",
    method: "POST",
    pathTemplate: "/erh/v1/payments",
    description: "Records a payment only; it never executes an external transfer.",
    lockScope: "financial-run",
    maxRows: 1
  },
  {
    name: "payment.reconcile",
    title: "Reconcile payment",
    role: "bot_distribution",
    mode: "write",
    method: "POST",
    pathTemplate: "/erh/v1/payments/{paymentId}/reconcile",
    description: "Links a recorded payment to a statement and recomputes balances.",
    lockScope: "financial-run",
    maxRows: 1
  },
  {
    name: "statement.generate",
    title: "Generate statement",
    role: "bot_distribution",
    mode: "write",
    method: "POST",
    pathTemplate: "/erh/v1/statements/generate",
    description: "Generates statements through the guarded statement engine route.",
    lockScope: "financial-run",
    maxRows: 50
  }
];

export function abilitiesForRole(role: BotRole): readonly BotAbility[] {
  return BOT_ABILITIES.filter((ability: BotAbility): boolean => ability.role === role);
}

export function findAbilityForRole(role: BotRole, name: string): BotAbility | null {
  return abilitiesForRole(role).find((ability: BotAbility): boolean => ability.name === name) ?? null;
}
