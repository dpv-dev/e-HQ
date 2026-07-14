import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  categories,
  departments,
  divisions,
  exchangeRates,
  financialAllocations,
  officeBankAccounts,
  officeBankImportBatches,
  officeBankReconciliationMatches,
  officeBankStatementLines,
  officeCashflowProjectionRows,
  officeCashflowManualEntries,
  officeAdvanceApplications,
  officeAdvances,
  partners,
  projectBudgetLines,
  projectDepartments,
  projectMembers,
  projects,
  sharedCostRules,
  transactions
} from "./schema.js";

export type Department = InferSelectModel<typeof departments>;
export type NewDepartment = InferInsertModel<typeof departments>;

export type Division = InferSelectModel<typeof divisions>;
export type NewDivision = InferInsertModel<typeof divisions>;

export type Category = InferSelectModel<typeof categories>;
export type NewCategory = InferInsertModel<typeof categories>;

export type Partner = InferSelectModel<typeof partners>;
export type NewPartner = InferInsertModel<typeof partners>;

export type Project = InferSelectModel<typeof projects>;
export type NewProject = InferInsertModel<typeof projects>;

export type ProjectDepartment = InferSelectModel<typeof projectDepartments>;
export type NewProjectDepartment = InferInsertModel<typeof projectDepartments>;

export type ProjectBudgetLine = InferSelectModel<typeof projectBudgetLines>;
export type NewProjectBudgetLine = InferInsertModel<typeof projectBudgetLines>;

export type ProjectMember = InferSelectModel<typeof projectMembers>;
export type NewProjectMember = InferInsertModel<typeof projectMembers>;

export type Transaction = InferSelectModel<typeof transactions>;
export type NewTransaction = InferInsertModel<typeof transactions>;

export type FinancialAllocation = InferSelectModel<typeof financialAllocations>;
export type NewFinancialAllocation = InferInsertModel<typeof financialAllocations>;

export type SharedCostRule = InferSelectModel<typeof sharedCostRules>;
export type NewSharedCostRule = InferInsertModel<typeof sharedCostRules>;

export type ExchangeRate = InferSelectModel<typeof exchangeRates>;
export type NewExchangeRate = InferInsertModel<typeof exchangeRates>;

export type OfficeBankAccount = InferSelectModel<typeof officeBankAccounts>;
export type NewOfficeBankAccount = InferInsertModel<typeof officeBankAccounts>;

export type OfficeBankImportBatch = InferSelectModel<typeof officeBankImportBatches>;
export type NewOfficeBankImportBatch = InferInsertModel<typeof officeBankImportBatches>;

export type OfficeBankStatementLine = InferSelectModel<typeof officeBankStatementLines>;
export type NewOfficeBankStatementLine = InferInsertModel<typeof officeBankStatementLines>;

export type OfficeBankReconciliationMatch = InferSelectModel<typeof officeBankReconciliationMatches>;
export type NewOfficeBankReconciliationMatch = InferInsertModel<typeof officeBankReconciliationMatches>;

export type OfficeCashflowProjectionRow = InferSelectModel<typeof officeCashflowProjectionRows>;
export type NewOfficeCashflowProjectionRow = InferInsertModel<typeof officeCashflowProjectionRows>;

export type OfficeCashflowManualEntry = InferSelectModel<typeof officeCashflowManualEntries>;
export type NewOfficeCashflowManualEntry = InferInsertModel<typeof officeCashflowManualEntries>;

export type OfficeAdvance = InferSelectModel<typeof officeAdvances>;
export type NewOfficeAdvance = InferInsertModel<typeof officeAdvances>;

export type OfficeAdvanceApplication = InferSelectModel<typeof officeAdvanceApplications>;
export type NewOfficeAdvanceApplication = InferInsertModel<typeof officeAdvanceApplications>;
