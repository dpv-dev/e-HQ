import type { Category, Department, Division, FinancialAllocation, Partner, Project, ProjectBudgetLine, Transaction } from "@ehq/db";
import { eofMoney } from "@ehq/domain-finance";

export type OfficePnlView =
  | "global_ledger"
  | "department_allocated"
  | "project_ledger"
  | "project_department_allocated"
  | "partner_ledger"
  | "partner_department_allocated";

export interface OfficePnlFilters {
  readonly dateFrom: string | null;
  readonly dateTo: string | null;
  readonly departmentId: string | null;
}

export interface OfficePnlDataset {
  readonly departments: readonly OfficeDepartmentRow[];
  readonly divisions: readonly OfficeDivisionRow[];
  readonly categories: readonly OfficeCategoryRow[];
  readonly partners: readonly OfficePartnerRow[];
  readonly projects: readonly OfficeProjectRow[];
  readonly projectBudgetLines: readonly OfficeProjectBudgetLineRow[];
  readonly transactions: readonly OfficeTransactionRow[];
  readonly financialAllocations: readonly OfficeFinancialAllocationRow[];
}

export type OfficeDepartmentRow = Pick<Department, "id" | "name" | "type" | "color" | "isActive">;
export type OfficeDivisionRow = Pick<Division, "id" | "departmentId" | "name" | "isActive">;
export type OfficeCategoryRow = Pick<Category, "id" | "divisionId" | "name" | "type" | "isActive"> & {
  readonly accountCode?: string | null;
  readonly accountLabel?: string | null;
};
export type OfficePartnerRow = Pick<Partner, "id" | "name" | "type" | "isActive">;
export type OfficeProjectRow = Pick<Project, "id" | "name" | "status" | "state" | "isActive">;
export type OfficeProjectBudgetLineRow = Pick<ProjectBudgetLine, "id" | "projectId" | "categoryId" | "type" | "plannedAmountMinor">;
export type OfficeTransactionRow = Pick<
  Transaction,
  | "id"
  | "transactionDate"
  | "type"
  | "status"
  | "isActive"
  | "description"
  | "categoryId"
  | "partnerId"
  | "projectId"
  | "accountId"
  | "amountMinor"
  | "originalCurrency"
  | "exchangeRateE10"
>;
export type OfficeFinancialAllocationRow = Pick<FinancialAllocation, "id" | "transactionId" | "departmentId" | "amountMinor">;

export interface OfficePnlTotals {
  readonly income: string;
  readonly expense: string;
  readonly profit: string;
  readonly tx_count: number;
  readonly currency: "MUR";
  readonly view: OfficePnlView;
}

export interface OfficePnlDepartment {
  readonly id: string;
  readonly name: string;
  readonly color: string | null;
  readonly type: OfficeDepartmentRow["type"];
}

export interface OfficePnlProject {
  readonly id: string;
  readonly name: string;
  readonly status: OfficeProjectRow["status"];
  readonly state: string;
}

export interface OfficePnlPartner {
  readonly id: string;
  readonly name: string;
  readonly type: OfficePartnerRow["type"];
}

export interface OfficeGlobalPnlResponse extends OfficePnlTotals {
  readonly view: "global_ledger";
}

export interface OfficeDepartmentPnlResponse extends OfficePnlTotals {
  readonly department: OfficePnlDepartment;
  readonly view: "department_allocated";
}

export interface OfficeProjectPnlResponse extends OfficePnlTotals {
  readonly project: OfficePnlProject;
  readonly budget_income: string;
  readonly budget_expenses: string;
  readonly view: "project_ledger" | "project_department_allocated";
}

export interface OfficePartnerPnlResponse extends OfficePnlTotals {
  readonly partner: OfficePnlPartner;
  readonly view: "partner_ledger" | "partner_department_allocated";
}

export interface OfficePnlCategoryRow {
  readonly category_id: string;
  readonly category_name: string;
  readonly category_type: OfficeCategoryRow["type"];
  readonly division_id: string;
  readonly division_name: string;
  readonly department_id: string;
  readonly department_name: string;
  readonly income: string;
  readonly expense: string;
  readonly profit: string;
  readonly tx_count: number;
}

export interface OfficePnlDivisionRow {
  readonly division_id: string;
  readonly division_name: string;
  readonly department_id: string;
  readonly department_name: string;
  readonly income: string;
  readonly expense: string;
  readonly profit: string;
  readonly tx_count: number;
}

export interface OfficePnlDepartmentRow {
  readonly department_id: string;
  readonly department_name: string;
  readonly department_type: OfficeDepartmentRow["type"];
  readonly income: string;
  readonly expense: string;
  readonly profit: string;
  readonly tx_count: number;
}

export interface OfficePnlMonthlyRow {
  readonly month: string;
  readonly income: string;
  readonly expense: string;
  readonly profit: string;
}

interface ResolvedDataset {
  readonly departmentsById: ReadonlyMap<string, OfficeDepartmentRow>;
  readonly divisionsById: ReadonlyMap<string, OfficeDivisionRow>;
  readonly categoriesById: ReadonlyMap<string, OfficeCategoryRow>;
  readonly partnersById: ReadonlyMap<string, OfficePartnerRow>;
  readonly projectsById: ReadonlyMap<string, OfficeProjectRow>;
  readonly transactionsById: ReadonlyMap<string, OfficeTransactionRow>;
}

interface Accumulator {
  readonly incomeMinor: bigint;
  readonly expenseMinor: bigint;
  readonly transactionIds: ReadonlySet<string>;
}

interface MutableAccumulator {
  incomeMinor: bigint;
  expenseMinor: bigint;
  readonly transactionIds: Set<string>;
}

interface TransactionAmountInput {
  readonly transaction: OfficeTransactionRow;
  readonly amountMinor: bigint;
}

export function readGlobalPnl(dataset: OfficePnlDataset, filters: OfficePnlFilters): OfficeGlobalPnlResponse {
  const transactions = filterLedgerTransactions(dataset.transactions, filters);
  return {
    ...formatAccumulator(sumTransactions(transactions), "global_ledger"),
    view: "global_ledger"
  };
}

export function readDepartmentPnl(dataset: OfficePnlDataset, departmentId: string, filters: OfficePnlFilters): OfficeDepartmentPnlResponse {
  const resolved = resolveDataset(dataset);
  const department = requireDepartment(resolved, departmentId);
  const transactions = filterAllocationInputs(dataset, filters, {
    departmentId,
    projectId: null,
    partnerId: null
  });

  return {
    ...formatAccumulator(sumTransactionInputs(transactions), "department_allocated"),
    department: toDepartmentResponse(department),
    view: "department_allocated"
  };
}

export function readProjectPnl(dataset: OfficePnlDataset, projectId: string, filters: OfficePnlFilters): OfficeProjectPnlResponse {
  const resolved = resolveDataset(dataset);
  const project = requireProject(resolved, projectId);
  const accumulator =
    filters.departmentId === null
      ? sumTransactions(filterLedgerTransactions(dataset.transactions, filters).filter((transaction) => transaction.projectId === projectId))
      : sumTransactionInputs(filterAllocationInputs(dataset, filters, { departmentId: filters.departmentId, projectId, partnerId: null }));
  const budgets = sumProjectBudgets(dataset.projectBudgetLines.filter((line) => line.projectId === projectId));
  const view = filters.departmentId === null ? "project_ledger" : "project_department_allocated";

  return {
    ...formatAccumulator(accumulator, view),
    project: toProjectResponse(project),
    budget_income: formatMinor(budgets.incomeMinor),
    budget_expenses: formatMinor(budgets.expenseMinor),
    view
  };
}

export function readPartnerPnl(dataset: OfficePnlDataset, partnerId: string, filters: OfficePnlFilters): OfficePartnerPnlResponse {
  const resolved = resolveDataset(dataset);
  const partner = requirePartner(resolved, partnerId);
  const accumulator =
    filters.departmentId === null
      ? sumTransactions(filterLedgerTransactions(dataset.transactions, filters).filter((transaction) => transaction.partnerId === partnerId))
      : sumTransactionInputs(filterAllocationInputs(dataset, filters, { departmentId: filters.departmentId, projectId: null, partnerId }));
  const view = filters.departmentId === null ? "partner_ledger" : "partner_department_allocated";

  return {
    ...formatAccumulator(accumulator, view),
    partner: toPartnerResponse(partner),
    view
  };
}

export function readPnlByCategory(dataset: OfficePnlDataset, filters: OfficePnlFilters): readonly OfficePnlCategoryRow[] {
  const resolved = resolveDataset(dataset);
  const groups = new Map<string, MutableAccumulator>();
  if (filters.departmentId === null) {
    for (const transaction of filterLedgerTransactions(dataset.transactions, filters)) {
      if (transaction.categoryId === null) {
        continue;
      }

      const category = resolved.categoriesById.get(transaction.categoryId);
      if (category === undefined || category.divisionId === null) {
        continue;
      }

      addTransactionToGroup(groups, category.id, transaction, transaction.amountMinor);
    }
  } else {
    for (const input of filterAllocationInputs(dataset, filters, { departmentId: filters.departmentId, projectId: null, partnerId: null })) {
      if (input.transaction.categoryId === null) {
        continue;
      }

      const category = resolved.categoriesById.get(input.transaction.categoryId);
      if (category === undefined || category.divisionId === null) {
        continue;
      }

      addTransactionToGroup(groups, category.id, input.transaction, input.allocation.amountMinor);
    }
  }

  return [...groups.entries()].flatMap(([categoryId, accumulator]) => {
    const category = requireCategory(resolved, categoryId);
    if (category.divisionId === null) {
      return [];
    }

    const division = requireDivision(resolved, category.divisionId);
    const department = requireDepartment(resolved, division.departmentId);
    const totals = formatAccumulator(freezeAccumulator(accumulator), "global_ledger");
    return [{
      category_id: category.id,
      category_name: category.name,
      category_type: category.type,
      division_id: division.id,
      division_name: division.name,
      department_id: department.id,
      department_name: department.name,
      income: totals.income,
      expense: totals.expense,
      profit: totals.profit,
      tx_count: totals.tx_count
    }];
  });
}

export function readPnlByDivision(dataset: OfficePnlDataset, filters: OfficePnlFilters): readonly OfficePnlDivisionRow[] {
  const resolved = resolveDataset(dataset);
  const groups = new Map<string, MutableAccumulator>();
  if (filters.departmentId === null) {
    for (const transaction of filterLedgerTransactions(dataset.transactions, filters)) {
      if (transaction.categoryId === null) {
        continue;
      }

      const category = resolved.categoriesById.get(transaction.categoryId);
      if (category === undefined || category.divisionId === null) {
        continue;
      }

      addTransactionToGroup(groups, category.divisionId, transaction, transaction.amountMinor);
    }
  } else {
    for (const input of filterAllocationInputs(dataset, filters, { departmentId: filters.departmentId, projectId: null, partnerId: null })) {
      if (input.transaction.categoryId === null) {
        continue;
      }

      const category = resolved.categoriesById.get(input.transaction.categoryId);
      if (category === undefined || category.divisionId === null) {
        continue;
      }

      addTransactionToGroup(groups, category.divisionId, input.transaction, input.allocation.amountMinor);
    }
  }

  return [...groups.entries()].map(([divisionId, accumulator]) => {
    const division = requireDivision(resolved, divisionId);
    const department = requireDepartment(resolved, division.departmentId);
    const totals = formatAccumulator(freezeAccumulator(accumulator), "global_ledger");
    return {
      division_id: division.id,
      division_name: division.name,
      department_id: department.id,
      department_name: department.name,
      income: totals.income,
      expense: totals.expense,
      profit: totals.profit,
      tx_count: totals.tx_count
    };
  });
}

export function readPnlByDepartment(dataset: OfficePnlDataset, filters: OfficePnlFilters): readonly OfficePnlDepartmentRow[] {
  const resolved = resolveDataset(dataset);
  const groups = new Map<string, MutableAccumulator>();
  for (const input of filterAllocationInputs(dataset, filters, { departmentId: filters.departmentId, projectId: null, partnerId: null })) {
    if (input.allocation.departmentId === null) {
      continue;
    }

    addTransactionToGroup(groups, input.allocation.departmentId, input.transaction, input.allocation.amountMinor);
  }

  return [...groups.entries()].map(([departmentId, accumulator]) => {
    const department = requireDepartment(resolved, departmentId);
    const totals = formatAccumulator(freezeAccumulator(accumulator), "department_allocated");
    return {
      department_id: department.id,
      department_name: department.name,
      department_type: department.type,
      income: totals.income,
      expense: totals.expense,
      profit: totals.profit,
      tx_count: totals.tx_count
    };
  });
}

export function readMonthlyPnl(dataset: OfficePnlDataset, filters: OfficePnlFilters): readonly OfficePnlMonthlyRow[] {
  const groups = new Map<string, MutableAccumulator>();
  if (filters.departmentId === null) {
    for (const transaction of filterLedgerTransactions(dataset.transactions, filters)) {
      addTransactionToGroup(groups, toMonth(transaction.transactionDate), transaction, transaction.amountMinor);
    }
  } else {
    for (const input of filterAllocationInputs(dataset, filters, { departmentId: filters.departmentId, projectId: null, partnerId: null })) {
      addTransactionToGroup(groups, toMonth(input.transaction.transactionDate), input.transaction, input.allocation.amountMinor);
    }
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([month, accumulator]) => {
      const totals = formatAccumulator(freezeAccumulator(accumulator), "global_ledger");
      return {
        month,
        income: totals.income,
        expense: totals.expense,
        profit: totals.profit
      };
    });
}

function filterLedgerTransactions(transactions: readonly OfficeTransactionRow[], filters: OfficePnlFilters): readonly OfficeTransactionRow[] {
  return transactions.filter((transaction) => isBaseIncluded(transaction) && isInDateRange(transaction, filters));
}

function filterAllocationInputs(
  dataset: OfficePnlDataset,
  filters: OfficePnlFilters,
  entityFilter: Readonly<{ readonly departmentId: string | null; readonly projectId: string | null; readonly partnerId: string | null }>
): readonly (TransactionAmountInput & { readonly allocation: OfficeFinancialAllocationRow })[] {
  const transactionsById = new Map<string, OfficeTransactionRow>(dataset.transactions.map((transaction) => [transaction.id, transaction]));
  const inputs: (TransactionAmountInput & { readonly allocation: OfficeFinancialAllocationRow })[] = [];
  for (const allocation of dataset.financialAllocations) {
    if (entityFilter.departmentId !== null && allocation.departmentId !== entityFilter.departmentId) {
      continue;
    }

    const transaction = transactionsById.get(allocation.transactionId);
    if (transaction === undefined || !isBaseIncluded(transaction) || !isInDateRange(transaction, filters)) {
      continue;
    }

    if (entityFilter.projectId !== null && transaction.projectId !== entityFilter.projectId) {
      continue;
    }

    if (entityFilter.partnerId !== null && transaction.partnerId !== entityFilter.partnerId) {
      continue;
    }

    inputs.push({ transaction, amountMinor: allocation.amountMinor, allocation });
  }

  return inputs;
}

function isBaseIncluded(transaction: OfficeTransactionRow): boolean {
  return transaction.status === "validated" && transaction.isActive && isFxValid(transaction);
}

function isFxValid(transaction: OfficeTransactionRow): boolean {
  if (transaction.originalCurrency === null || transaction.originalCurrency === "" || transaction.originalCurrency === "MUR") {
    return true;
  }

  return transaction.exchangeRateE10 !== null;
}

function isInDateRange(transaction: OfficeTransactionRow, filters: OfficePnlFilters): boolean {
  const date = transaction.transactionDate.slice(0, 10);
  if (filters.dateFrom !== null && date < filters.dateFrom) {
    return false;
  }

  return !(filters.dateTo !== null && date > filters.dateTo);
}

function sumTransactions(transactions: readonly OfficeTransactionRow[]): Accumulator {
  return sumTransactionInputs(transactions.map((transaction) => ({ transaction, amountMinor: transaction.amountMinor })));
}

function sumTransactionInputs(inputs: readonly TransactionAmountInput[]): Accumulator {
  const accumulator = createAccumulator();
  for (const input of inputs) {
    addToAccumulator(accumulator, input.transaction, input.amountMinor);
  }

  return freezeAccumulator(accumulator);
}

function sumProjectBudgets(lines: readonly OfficeProjectBudgetLineRow[]): Readonly<{ readonly incomeMinor: bigint; readonly expenseMinor: bigint }> {
  let incomeMinor = 0n;
  let expenseMinor = 0n;
  for (const line of lines) {
    if (line.type === "income") {
      incomeMinor += line.plannedAmountMinor;
    } else {
      expenseMinor += line.plannedAmountMinor;
    }
  }

  return { incomeMinor, expenseMinor };
}

function createAccumulator(): MutableAccumulator {
  return {
    incomeMinor: 0n,
    expenseMinor: 0n,
    transactionIds: new Set<string>()
  };
}

function addTransactionToGroup(
  groups: Map<string, MutableAccumulator>,
  groupId: string,
  transaction: OfficeTransactionRow,
  amountMinor: bigint
): void {
  const accumulator = groups.get(groupId) ?? createAccumulator();
  addToAccumulator(accumulator, transaction, amountMinor);
  groups.set(groupId, accumulator);
}

function addToAccumulator(accumulator: MutableAccumulator, transaction: OfficeTransactionRow, amountMinor: bigint): void {
  // Different write paths disagree on amountMinor's sign for expenses (manual entry negates it,
  // bank-reconciliation/ledger-import store a positive magnitude and carry the sign meaning in
  // `type` alone) — normalize to a positive magnitude here so profit = income - expense is
  // correct regardless of which path created the row.
  const magnitude = amountMinor < 0n ? -amountMinor : amountMinor;
  if (transaction.type === "income") {
    accumulator.incomeMinor += magnitude;
  } else {
    accumulator.expenseMinor += magnitude;
  }

  accumulator.transactionIds.add(transaction.id);
}

function freezeAccumulator(accumulator: MutableAccumulator): Accumulator {
  return {
    incomeMinor: accumulator.incomeMinor,
    expenseMinor: accumulator.expenseMinor,
    transactionIds: new Set(accumulator.transactionIds)
  };
}

function formatAccumulator(accumulator: Accumulator, view: OfficePnlView): OfficePnlTotals {
  return {
    income: formatMinor(accumulator.incomeMinor),
    expense: formatMinor(accumulator.expenseMinor),
    profit: formatMinor(accumulator.incomeMinor - accumulator.expenseMinor),
    tx_count: accumulator.transactionIds.size,
    currency: "MUR",
    view
  };
}

function formatMinor(value: bigint): string {
  return eofMoney.format(value);
}

function resolveDataset(dataset: OfficePnlDataset): ResolvedDataset {
  return {
    departmentsById: new Map<string, OfficeDepartmentRow>(dataset.departments.map((department) => [department.id, department])),
    divisionsById: new Map<string, OfficeDivisionRow>(dataset.divisions.map((division) => [division.id, division])),
    categoriesById: new Map<string, OfficeCategoryRow>(dataset.categories.map((category) => [category.id, category])),
    partnersById: new Map<string, OfficePartnerRow>(dataset.partners.map((partner) => [partner.id, partner])),
    projectsById: new Map<string, OfficeProjectRow>(dataset.projects.map((project) => [project.id, project])),
    transactionsById: new Map<string, OfficeTransactionRow>(dataset.transactions.map((transaction) => [transaction.id, transaction]))
  };
}

function requireDepartment(resolved: ResolvedDataset, departmentId: string): OfficeDepartmentRow {
  const department = resolved.departmentsById.get(departmentId);
  if (department === undefined) {
    throw new Error(`Office P&L department not found: ${departmentId}`);
  }

  return department;
}

function requireDivision(resolved: ResolvedDataset, divisionId: string): OfficeDivisionRow {
  const division = resolved.divisionsById.get(divisionId);
  if (division === undefined) {
    throw new Error(`Office P&L division not found: ${divisionId}`);
  }

  return division;
}

function requireCategory(resolved: ResolvedDataset, categoryId: string): OfficeCategoryRow {
  const category = resolved.categoriesById.get(categoryId);
  if (category === undefined) {
    throw new Error(`Office P&L category not found: ${categoryId}`);
  }

  return category;
}

function requireProject(resolved: ResolvedDataset, projectId: string): OfficeProjectRow {
  const project = resolved.projectsById.get(projectId);
  if (project === undefined) {
    throw new Error(`Office P&L project not found: ${projectId}`);
  }

  return project;
}

function requirePartner(resolved: ResolvedDataset, partnerId: string): OfficePartnerRow {
  const partner = resolved.partnersById.get(partnerId);
  if (partner === undefined) {
    throw new Error(`Office P&L partner not found: ${partnerId}`);
  }

  return partner;
}

function toDepartmentResponse(department: OfficeDepartmentRow): OfficePnlDepartment {
  return {
    id: department.id,
    name: department.name,
    color: department.color,
    type: department.type
  };
}

function toProjectResponse(project: OfficeProjectRow): OfficePnlProject {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    state: project.state
  };
}

function toPartnerResponse(partner: OfficePartnerRow): OfficePnlPartner {
  return {
    id: partner.id,
    name: partner.name,
    type: partner.type
  };
}

function toMonth(timestamp: string): string {
  return timestamp.slice(0, 7);
}
