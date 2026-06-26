import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  apiIdempotencyKeys,
  artists,
  auditLogs,
  calculationRuns,
  catalogAliases,
  contractCostTerms,
  contractExtractions,
  contractScopes,
  contracts,
  earningAllocations,
  earningTrackMatches,
  expenseApplications,
  fxRates,
  identityLink,
  importBatches,
  importIssues,
  labels,
  mappingRules,
  mappingStatsByBatch,
  normalizedEarnings,
  payeeBalances,
  payees,
  payments,
  rawImportRows,
  releases,
  royaltyRules,
  statementLines,
  statementPaymentLinks,
  statements,
  suspenseItems,
  trackContributors,
  tracks
} from "./schema.js";

export type ApiIdempotencyKey = InferSelectModel<typeof apiIdempotencyKeys>;
export type NewApiIdempotencyKey = InferInsertModel<typeof apiIdempotencyKeys>;

export type ImportBatch = InferSelectModel<typeof importBatches>;
export type NewImportBatch = InferInsertModel<typeof importBatches>;

export type RawImportRow = InferSelectModel<typeof rawImportRows>;
export type NewRawImportRow = InferInsertModel<typeof rawImportRows>;

export type NormalizedEarning = InferSelectModel<typeof normalizedEarnings>;
export type NewNormalizedEarning = InferInsertModel<typeof normalizedEarnings>;

export type MappingStatsByBatch = InferSelectModel<typeof mappingStatsByBatch>;
export type NewMappingStatsByBatch = InferInsertModel<typeof mappingStatsByBatch>;

export type ImportIssue = InferSelectModel<typeof importIssues>;
export type NewImportIssue = InferInsertModel<typeof importIssues>;

export type Artist = InferSelectModel<typeof artists>;
export type NewArtist = InferInsertModel<typeof artists>;

export type Payee = InferSelectModel<typeof payees>;
export type NewPayee = InferInsertModel<typeof payees>;

export type Label = InferSelectModel<typeof labels>;
export type NewLabel = InferInsertModel<typeof labels>;

export type Release = InferSelectModel<typeof releases>;
export type NewRelease = InferInsertModel<typeof releases>;

export type Track = InferSelectModel<typeof tracks>;
export type NewTrack = InferInsertModel<typeof tracks>;

export type TrackContributor = InferSelectModel<typeof trackContributors>;
export type NewTrackContributor = InferInsertModel<typeof trackContributors>;

export type IdentityLink = InferSelectModel<typeof identityLink>;
export type NewIdentityLink = InferInsertModel<typeof identityLink>;

export type Contract = InferSelectModel<typeof contracts>;
export type NewContract = InferInsertModel<typeof contracts>;

export type ContractScope = InferSelectModel<typeof contractScopes>;
export type NewContractScope = InferInsertModel<typeof contractScopes>;

export type ContractCostTerm = InferSelectModel<typeof contractCostTerms>;
export type NewContractCostTerm = InferInsertModel<typeof contractCostTerms>;

export type ContractExtraction = InferSelectModel<typeof contractExtractions>;
export type NewContractExtraction = InferInsertModel<typeof contractExtractions>;

export type RoyaltyRule = InferSelectModel<typeof royaltyRules>;
export type NewRoyaltyRule = InferInsertModel<typeof royaltyRules>;

export type EarningTrackMatch = InferSelectModel<typeof earningTrackMatches>;
export type NewEarningTrackMatch = InferInsertModel<typeof earningTrackMatches>;

export type MappingRule = InferSelectModel<typeof mappingRules>;
export type NewMappingRule = InferInsertModel<typeof mappingRules>;

export type CatalogAlias = InferSelectModel<typeof catalogAliases>;
export type NewCatalogAlias = InferInsertModel<typeof catalogAliases>;

export type CalculationRun = InferSelectModel<typeof calculationRuns>;
export type NewCalculationRun = InferInsertModel<typeof calculationRuns>;

export type EarningAllocation = InferSelectModel<typeof earningAllocations>;
export type NewEarningAllocation = InferInsertModel<typeof earningAllocations>;

export type SuspenseItem = InferSelectModel<typeof suspenseItems>;
export type NewSuspenseItem = InferInsertModel<typeof suspenseItems>;

export type Statement = InferSelectModel<typeof statements>;
export type NewStatement = InferInsertModel<typeof statements>;

export type PayeeBalance = InferSelectModel<typeof payeeBalances>;
export type NewPayeeBalance = InferInsertModel<typeof payeeBalances>;

export type StatementLine = InferSelectModel<typeof statementLines>;
export type NewStatementLine = InferInsertModel<typeof statementLines>;

export type Payment = InferSelectModel<typeof payments>;
export type NewPayment = InferInsertModel<typeof payments>;

export type StatementPaymentLink = InferSelectModel<typeof statementPaymentLinks>;
export type NewStatementPaymentLink = InferInsertModel<typeof statementPaymentLinks>;

export type ExpenseApplication = InferSelectModel<typeof expenseApplications>;
export type NewExpenseApplication = InferInsertModel<typeof expenseApplications>;

export type AuditLog = InferSelectModel<typeof auditLogs>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;

export type FxRate = InferSelectModel<typeof fxRates>;
export type NewFxRate = InferInsertModel<typeof fxRates>;
