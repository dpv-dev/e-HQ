import type {
  DistributionAlias,
  AuditLogEntry,
  DistributionContract,
  DistributionContractExpense,
  DistributionMappingRow,
  OfficePartnerClassificationSuggestion,
  OfficePartnerPayeeLink,
  OfficeProjectCoherenceViolation
} from "@ehq/api-client";
import type {
  DistributionCostTermInput,
  DistributionExistingExpenseApplication,
  DistributionFxRateInput,
  PayeeBalanceLedgerInput,
  DistributionReadDataset,
  DistributionRoyaltyRuleInput
} from "@ehq/domain-distribution";
import type {
  OfficeAnalyticsDataset,
  OfficeCashflowManualEntryRow,
  OfficeAdvanceApplicationRow,
  OfficeManagedAdvanceRow
} from "@ehq/domain-office";

export interface ApiDistributionRoyaltyRuleInput extends DistributionRoyaltyRuleInput {
  readonly scopeType: string | null;
  readonly scopeId: string | null;
  readonly effectiveFrom: string | null;
  readonly effectiveTo: string | null;
  readonly status: "draft" | "active" | "inactive" | "archived";
}

export interface ApiFixtureStore {
  readonly office: OfficeAnalyticsDataset;
  readonly officeAuditLog: readonly AuditLogEntry[];
  readonly officeClassificationSuggestions: Readonly<Record<string, readonly OfficePartnerClassificationSuggestion[]>>;
  readonly officePartnerPayeeLinks: Readonly<Record<string, OfficePartnerPayeeLink>>;
  readonly officeProjectViolations: Readonly<Record<string, readonly OfficeProjectCoherenceViolation[]>>;
  readonly officeCashflowManualEntries: readonly OfficeCashflowManualEntryRow[];
  readonly officeAdvances: readonly OfficeManagedAdvanceRow[];
  readonly officeAdvanceApplications: readonly OfficeAdvanceApplicationRow[];
  readonly distribution: DistributionReadDataset;
  readonly distributionContracts: readonly DistributionContract[];
  readonly distributionContractExpenses: readonly DistributionContractExpense[];
  readonly distributionMappingRows: readonly DistributionMappingRow[];
  readonly distributionRoyaltyRules: readonly ApiDistributionRoyaltyRuleInput[];
  readonly distributionCostTerms: readonly DistributionCostTermInput[];
  readonly distributionExpenseApplications: readonly DistributionExistingExpenseApplication[];
  readonly distributionFxRates: readonly DistributionFxRateInput[];
  readonly distributionPayeeBalances: readonly PayeeBalanceLedgerInput[];
  readonly distributionAliases: readonly DistributionAlias[];
}

export function createEmptyApiFixtureStore(): ApiFixtureStore {
  return {
    office: {
      departments: [],
      divisions: [],
      categories: [],
      partners: [],
      projects: [],
      projectBudgetLines: [],
      transactions: [],
      financialAllocations: [],
      bankAccounts: [],
      bankImportBatches: [],
      bankStatementLines: [],
      bankReconciliationMatches: [],
      cashflowProjectionRows: [],
      exchangeRates: []
    },
    officeAuditLog: [],
    officeClassificationSuggestions: {},
    officePartnerPayeeLinks: {},
    officeProjectViolations: {},
    officeCashflowManualEntries: [],
    officeAdvances: [],
    officeAdvanceApplications: [],
    distribution: {
      importBatches: [],
      normalizedEarnings: [],
      calculationRuns: [],
      earningAllocations: [],
      suspenseItems: [],
      statements: [],
      statementLines: [],
      statementPaymentLinks: [],
      payments: [],
      payees: [],
      tracks: []
    },
    distributionContracts: [],
    distributionContractExpenses: [],
    distributionMappingRows: [],
    distributionRoyaltyRules: [],
    distributionCostTerms: [],
    distributionExpenseApplications: [],
    distributionFxRates: [],
    distributionPayeeBalances: [],
    distributionAliases: []
  };
}

export function createFixtureStore(): ApiFixtureStore {
  return {
    office: createOfficeFixture(),
    officeAuditLog: createOfficeAuditLogFixture(),
    officeClassificationSuggestions: createOfficeClassificationSuggestionsFixture(),
    officePartnerPayeeLinks: createOfficePartnerPayeeLinksFixture(),
    officeProjectViolations: createOfficeProjectViolationsFixture(),
    officeCashflowManualEntries: [],
    officeAdvances: [],
    officeAdvanceApplications: [],
    distribution: createDistributionFixture(),
    distributionContracts: createDistributionContractsFixture(),
    distributionContractExpenses: createDistributionContractExpensesFixture(),
    distributionMappingRows: createDistributionMappingRowsFixture(),
    distributionRoyaltyRules: createDistributionRoyaltyRulesFixture(),
    distributionCostTerms: createDistributionCostTermsFixture(),
    distributionExpenseApplications: createDistributionExpenseApplicationsFixture(),
    distributionFxRates: [],
    distributionPayeeBalances: createDistributionPayeeBalancesFixture(),
    distributionAliases: []
  };
}

function createOfficeFixture(): OfficeAnalyticsDataset {
  return {
    departments: [
      { id: "dept_events", name: "Events", type: "mixed", color: null, isActive: true },
      { id: "dept_ops", name: "Operations", type: "expense", color: null, isActive: true }
    ],
    divisions: [
      { id: "div_live", departmentId: "dept_events", name: "Live", isActive: true },
      { id: "div_admin", departmentId: "dept_ops", name: "Administration", isActive: true }
    ],
    categories: [
      { id: "cat_live_income", divisionId: "div_live", name: "Live income", type: "income", accountCode: null, accountLabel: null, isActive: true },
      { id: "cat_rental_expense", divisionId: "div_live", name: "Equipment rental", type: "expense", accountCode: null, accountLabel: null, isActive: true },
      { id: "cat_bank_fee", divisionId: "div_admin", name: "Bank fees", type: "expense", accountCode: "6150", accountLabel: "Bank Charges", isActive: true }
    ],
    partners: [
      { id: "partner_bedouin", name: "Bedouin Ltd", type: "both", isActive: true },
      { id: "partner_mcb", name: "MCB", type: "supplier", isActive: true }
    ],
    projects: [
      { id: "project_kaya", name: "Kaya Estate", description: null, status: "active", state: "active", isActive: true },
      { id: "project_null_reference", name: "General Office", description: null, status: "active", state: "active", isActive: true }
    ],
    projectBudgetLines: [
      { id: "budget_kaya_income", projectId: "project_kaya", categoryId: "cat_live_income", type: "income", plannedAmountMinor: 800_000n },
      { id: "budget_kaya_expense", projectId: "project_kaya", categoryId: "cat_rental_expense", type: "expense", plannedAmountMinor: 200_000n }
    ],
    transactions: [
      {
        id: "tx_bedouin_income",
        workspaceId: "workspace_1",
        transactionDate: "2026-02-04T10:00:00.000Z",
        type: "income",
        status: "validated",
        isActive: true,
        description: "DJ performance invoice",
        categoryId: "cat_live_income",
        partnerId: "partner_bedouin",
        projectId: "project_kaya",
        accountId: "bank_mur",
        amountMinor: 500_000n,
        originalCurrency: null,
        exchangeRateE10: null
      },
      {
        id: "tx_bedouin_rental",
        workspaceId: "workspace_1",
        transactionDate: "2026-02-09T10:00:00.000Z",
        type: "expense",
        status: "validated",
        isActive: true,
        description: "Projector rental",
        categoryId: "cat_rental_expense",
        partnerId: "partner_bedouin",
        projectId: "project_kaya",
        accountId: "bank_mur",
        amountMinor: 120_000n,
        originalCurrency: null,
        exchangeRateE10: null
      },
      {
        id: "tx_mcb_fee",
        workspaceId: "workspace_1",
        transactionDate: "2026-02-12T10:00:00.000Z",
        type: "expense",
        status: "validated",
        isActive: true,
        description: "Current account fee",
        categoryId: "cat_bank_fee",
        partnerId: "partner_mcb",
        projectId: null,
        accountId: "bank_mur",
        amountMinor: 5_000n,
        originalCurrency: null,
        exchangeRateE10: null
      },
      {
        id: "tx_uncategorized",
        workspaceId: "workspace_1",
        transactionDate: "2026-02-15T10:00:00.000Z",
        type: "expense",
        status: "draft",
        isActive: true,
        description: "Awaiting category",
        categoryId: null,
        partnerId: null,
        projectId: null,
        accountId: null,
        amountMinor: 8_500n,
        originalCurrency: null,
        exchangeRateE10: null
      }
    ],
    financialAllocations: [
      { id: "alloc_bedouin_income", transactionId: "tx_bedouin_income", departmentId: "dept_events", amountMinor: 500_000n },
      { id: "alloc_bedouin_rental", transactionId: "tx_bedouin_rental", departmentId: "dept_events", amountMinor: 120_000n },
      { id: "alloc_mcb_fee", transactionId: "tx_mcb_fee", departmentId: "dept_ops", amountMinor: 5_000n }
    ],
    bankAccounts: [
      {
        id: "bank_mur",
        workspaceId: "workspace_1",
        bankName: "Mauritius Commercial Bank",
        accountLabel: "MCB MUR",
        accountReferenceHash: "fixture-bank-mur",
        currency: "MUR",
        currentBalanceMinor: 250_000n,
        currentBalanceMurMinor: null,
        isActive: true,
        balanceAsOf: "2026-02-28T18:00:00.000Z"
      },
      {
        id: "bank_eur",
        workspaceId: "workspace_1",
        bankName: "Mauritius Commercial Bank",
        accountLabel: "MCB EUR",
        accountReferenceHash: "fixture-bank-eur",
        currency: "EUR",
        currentBalanceMinor: 1_000n,
        currentBalanceMurMinor: 50_000n,
        isActive: true,
        balanceAsOf: "2026-02-28T18:00:00.000Z"
      }
    ],
    bankImportBatches: [
      {
        id: "office_import_mcb_feb",
        workspaceId: "workspace_1",
        source: "mcb",
        fileName: "fixture-mcb-feb.csv",
        checksum: "fixture-office-import-mcb-feb",
        accountId: "bank_mur",
        periodStart: "2026-02-01",
        periodEnd: "2026-02-28",
        openingBalanceMinor: null,
        closingBalanceMinor: 250_000n,
        currency: "MUR",
        acceptedRowCount: 3,
        rejectedRowCount: 0,
        duplicateRowCount: 1,
        idempotencyFingerprint: "fixture-office-import-mcb-feb",
        status: "confirmed",
        importedAt: "2026-02-28T12:00:00.000Z",
        metadata: {}
      },
      {
        id: "office_import_sbi_old",
        workspaceId: "workspace_1",
        source: "sbi",
        fileName: "fixture-sbi-old.csv",
        checksum: "fixture-office-import-sbi-old",
        accountId: "bank_mur",
        periodStart: "2026-01-01",
        periodEnd: "2026-01-31",
        openingBalanceMinor: null,
        closingBalanceMinor: 100_000n,
        currency: "MUR",
        acceptedRowCount: 1,
        rejectedRowCount: 0,
        duplicateRowCount: 0,
        idempotencyFingerprint: "fixture-office-import-sbi-old",
        status: "confirmed",
        importedAt: "2026-01-31T12:00:00.000Z",
        metadata: {}
      }
    ],
    bankStatementLines: [
      {
        id: "bank_line_income",
        importBatchId: "office_import_mcb_feb",
        accountId: "bank_mur",
        occurredOn: "2026-02-04",
        valueOn: null,
        description: "Fixture income",
        reference: "INV-BED-1",
        direction: "credit",
        amountMinor: 500_000n,
        balanceMinor: 500_000n,
        currency: "MUR",
        amountMurMinor: 500_000n,
        balanceMurMinor: 500_000n,
        isDuplicateCandidate: false,
        reconciliationStatus: "matched",
        matchedTransactionId: "tx_bedouin_income",
        rawData: {}
      },
      {
        id: "bank_line_rental",
        importBatchId: "office_import_mcb_feb",
        accountId: "bank_mur",
        occurredOn: "2026-02-09",
        valueOn: null,
        description: "Fixture rental",
        reference: "",
        direction: "debit",
        amountMinor: 120_000n,
        balanceMinor: 380_000n,
        currency: "MUR",
        amountMurMinor: 120_000n,
        balanceMurMinor: 380_000n,
        isDuplicateCandidate: true,
        reconciliationStatus: "suggested",
        matchedTransactionId: null,
        rawData: {}
      },
      {
        id: "bank_line_unmatched",
        importBatchId: "office_import_mcb_feb",
        accountId: "bank_mur",
        occurredOn: "2026-02-15",
        valueOn: null,
        description: "Fixture unmatched",
        reference: "UNMATCHED",
        direction: "debit",
        amountMinor: 8_500n,
        balanceMinor: 371_500n,
        currency: "MUR",
        amountMurMinor: 8_500n,
        balanceMurMinor: 371_500n,
        isDuplicateCandidate: false,
        reconciliationStatus: "unmatched",
        matchedTransactionId: null,
        rawData: {}
      }
    ],
    bankReconciliationMatches: [
      {
        id: "recon_bedouin_rental",
        bankStatementLineId: "bank_line_rental",
        transactionId: "tx_bedouin_rental",
        confidenceBp: 9800,
        status: "matched",
        approvedByUserId: "fixture-user",
        approvedAt: "2026-02-28T13:00:00.000Z"
      }
    ],
    cashflowProjectionRows: [
      {
        id: "cash_feb",
        workspaceId: "workspace_1",
        accountId: "bank_mur",
        periodMonth: "2026-02",
        expectedInflowMinor: 500_000n,
        expectedOutflowMinor: 133_500n,
        expectedClosingBalanceMinor: 300_000n,
        currency: "MUR",
        createdAt: "2026-02-01T00:00:00.000Z"
      },
      {
        id: "cash_mar",
        workspaceId: "workspace_1",
        accountId: "bank_mur",
        periodMonth: "2026-03",
        expectedInflowMinor: 350_000n,
        expectedOutflowMinor: 145_000n,
        expectedClosingBalanceMinor: 505_000n,
        currency: "MUR",
        createdAt: "2026-03-01T00:00:00.000Z"
      }
    ],
    exchangeRates: [
      { fromCurrency: "EUR", toCurrency: "MUR", rateE10: 510_000_000_000n, effectiveDate: "2024-01-01" }
    ]
  };
}

function createOfficeAuditLogFixture(): readonly AuditLogEntry[] {
  return [
    {
      id: "audit_office_import",
      occurredAt: "2026-02-28T12:00:00.000Z",
      actorId: "user_david",
      action: "office.import.confirmed",
      entityType: "office_bank_import_batch",
      entityId: "office_import_mcb_feb",
      entityReference: "fixture-mcb-feb.csv",
      idempotencyKey: "fixture-office-import",
      context: { source: "mcb", workspaceId: "workspace_1" }
    }
  ];
}

function createOfficeClassificationSuggestionsFixture(): Readonly<Record<string, readonly OfficePartnerClassificationSuggestion[]>> {
  return {
    partner_bedouin: [
      {
        id: "suggest_bedouin_income",
        categoryId: "cat_live_income",
        categoryLabel: "Live income",
        type: "income",
        confidenceBp: 9100
      },
      {
        id: "suggest_bedouin_expense",
        categoryId: "cat_rental_expense",
        categoryLabel: "Equipment rental",
        type: "expense",
        confidenceBp: 8700
      }
    ],
    partner_mcb: [
      {
        id: "suggest_mcb_fee",
        categoryId: "cat_bank_fee",
        categoryLabel: "Bank fees",
        type: "expense",
        confidenceBp: 9400
      }
    ]
  };
}

function createOfficePartnerPayeeLinksFixture(): Readonly<Record<string, OfficePartnerPayeeLink>> {
  return {
    partner_bedouin: {
      partnerId: "partner_bedouin",
      partnerName: "Bedouin Ltd",
      payeeId: "payee_alma",
      payeeName: "Alma",
      resolution: "name_fuzzy",
      status: "active",
      source: "fixture",
      confidence: "86.000000"
    },
    partner_mcb: {
      partnerId: "partner_mcb",
      partnerName: "MCB",
      payeeId: null,
      payeeName: null,
      resolution: "unmatched",
      status: null,
      source: "fixture",
      confidence: null
    }
  };
}

function createOfficeProjectViolationsFixture(): Readonly<Record<string, readonly OfficeProjectCoherenceViolation[]>> {
  return {
    project_kaya: [
      {
        id: "violation_project_category",
        projectId: "project_kaya",
        severity: "warning",
        rule: "project.category.mix",
        message: "One project line should be reviewed before period close.",
        exactFixPath: "transactions",
        relatedEntityId: "tx_bedouin_rental"
      }
    ],
    project_null_reference: []
  };
}

function createDistributionFixture(): DistributionReadDataset {
  return {
    importBatches: [
      {
        id: "batch_kontor",
        source: "kontor",
        fileName: "kontor.csv",
        status: "completed",
        importedAt: "2026-04-30T10:00:00.000Z"
      }
    ],
    normalizedEarnings: [
      {
        id: "earning_matched",
        batchId: "batch_kontor",
        dsp: "Spotify",
        grossAmount: "100.0000000000",
        quantity: "10.000000",
        currency: "USD",
        isrc: "MUAAA2600001",
        upc: "742000000001",
        rawTitle: "Seggae light",
        rawArtist: "Kaya",
        rawLabel: "Babani",
        mappingStatus: "matched",
        calculationStatus: "calculated"
      },
      {
        id: "earning_suspense",
        batchId: "batch_kontor",
        dsp: "Apple Music",
        grossAmount: "50.0000000000",
        quantity: "5.000000",
        currency: "USD",
        isrc: null,
        upc: "742000000002",
        rawTitle: "Unknown",
        rawArtist: "Unknown",
        rawLabel: "Babani",
        mappingStatus: "suspense",
        calculationStatus: "error"
      },
      {
        id: "earning_pending",
        batchId: "batch_kontor",
        dsp: "Spotify",
        grossAmount: "100.0000000000",
        quantity: "10.000000",
        currency: "USD",
        isrc: "MUAAA2600001",
        upc: "742000000001",
        rawTitle: "Seggae light",
        rawArtist: "Kaya",
        rawLabel: "Babani",
        mappingStatus: "matched",
        calculationStatus: "pending"
      }
    ],
    calculationRuns: [
      {
        id: "run_1",
        batchId: "batch_kontor",
        status: "calculated",
        startedAt: "2026-05-01T10:00:00.000Z",
        finishedAt: "2026-05-01T10:10:00.000Z",
        createdAt: "2026-05-01T09:59:00.000Z"
      }
    ],
    earningAllocations: [
      {
        id: "alloc_alma",
        earningId: "earning_matched",
        calculationRunId: "run_1",
        payeeId: "payee_alma",
        contractId: "contract_1",
        trackId: "track_1",
        grossAmount: "100.0000000000",
        grossShare: "70.0000000000",
        recoupmentApplied: "10.0000000000",
        netPayable: "60.0000000000",
        splitPercentage: "70.000000",
        currency: "USD",
        status: "posted",
        createdAt: "2026-05-01T10:10:00.000Z"
      },
      {
        id: "alloc_david",
        earningId: "earning_matched",
        calculationRunId: "run_1",
        payeeId: "payee_david",
        contractId: "contract_1",
        trackId: "track_1",
        grossAmount: "100.0000000000",
        grossShare: "30.0000000000",
        recoupmentApplied: "0.0000000000",
        netPayable: "30.0000000000",
        splitPercentage: "30.000000",
        currency: "USD",
        status: "posted",
        createdAt: "2026-05-01T10:10:00.000Z"
      }
    ],
    suspenseItems: [
      {
        id: "suspense_1",
        earningId: "earning_suspense",
        amount: "50.0000000000",
        currency: "USD",
        reasonCode: "unmapped_track",
        resolved: false,
        resolvedAt: null,
        createdAt: "2026-05-01T10:20:00.000Z"
      }
    ],
    statements: [
      {
        id: "statement_alma",
        payeeId: "payee_alma",
        calculationRunId: "run_1",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-30",
        currency: "USD",
        grossTotal: "70.0000000000",
        recoupmentTotal: "10.0000000000",
        netPayable: "60.0000000000",
        amountDue: "60.0000000000",
        version: 1,
        status: "generated",
        createdAt: "2026-05-02T10:00:00.000Z"
      }
    ],
    statementLines: [
      {
        id: "line_alma",
        statementId: "statement_alma",
        earningAllocationId: "alloc_alma",
        trackId: "track_1",
        grossShare: "70.0000000000",
        recoupmentApplied: "10.0000000000",
        netPayable: "60.0000000000",
        quantity: "10.000000",
        currency: "USD"
      }
    ],
    statementPaymentLinks: [
      {
        id: "link_1",
        statementId: "statement_alma",
        paymentId: "payment_1",
        amountApplied: "15.1000000000"
      },
      {
        id: "link_void",
        statementId: "statement_alma",
        paymentId: "payment_void",
        amountApplied: "99.0000000000"
      }
    ],
    payments: [
      {
        id: "payment_1",
        payeeId: "payee_alma",
        amount: "15.1000000000",
        currency: "USD",
        status: "recorded",
        paidAt: "2026-05-05T10:00:00.000Z",
        reference: "PAY-1"
      },
      {
        id: "payment_void",
        payeeId: "payee_alma",
        amount: "99.0000000000",
        currency: "USD",
        status: "void",
        paidAt: "2026-05-06T10:00:00.000Z",
        reference: "VOID"
      }
    ],
    payees: [
      {
        id: "payee_alma",
        name: "Alma",
        preferredCurrency: "USD",
        isActive: true
      },
      {
        id: "payee_david",
        name: "David",
        preferredCurrency: "USD",
        isActive: true
      }
    ],
    tracks: [
      {
        id: "track_1",
        title: "Seggae light",
        isrc: "MUAAA2600001",
        releaseId: "release_1"
      }
    ]
  };
}

function createDistributionContractsFixture(): readonly DistributionContract[] {
  return [
    {
      id: "contract_1",
      payeeId: "payee_alma",
      title: "Kaya catalogue split",
      status: "active",
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      splitBp: 7000,
      openExpenseMicro: "10.0000000000",
      currency: "USD"
    }
  ];
}

function createDistributionContractExpensesFixture(): readonly DistributionContractExpense[] {
  return [
    {
      id: "expense_advance",
      contractId: "contract_1",
      payeeId: "payee_alma",
      incurredOn: "2026-01-15",
      label: "Advance recoupment balance",
      originalAmountMicro: "20.0000000000",
      openAmountMicro: "10.0000000000",
      currency: "USD",
      status: "open"
    }
  ];
}

function createDistributionMappingRowsFixture(): readonly DistributionMappingRow[] {
  return [
    {
      id: "mapping_suspense_1",
      batchId: "batch_kontor",
      sourceTitle: "Unknown",
      sourceArtist: "Unknown",
      sourceStore: "Apple Music",
      suggestedTrackId: null,
      suggestedTrackTitle: null,
      confidenceBp: 0,
      status: "unmapped",
      exactFixPath: "manual_track"
    }
  ];
}

function createDistributionRoyaltyRulesFixture(): readonly ApiDistributionRoyaltyRuleInput[] {
  return [
    {
      contractId: "contract_1",
      royaltyRuleId: "rule_alma",
      payeeId: "payee_alma",
      artistId: "artist_alma",
      role: "artist",
      percentage: "70.000000",
      scopeType: null,
      scopeId: null,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      status: "active"
    },
    {
      contractId: "contract_1",
      royaltyRuleId: "rule_david",
      payeeId: "payee_david",
      artistId: "artist_david",
      role: "artist",
      percentage: "30.000000",
      scopeType: null,
      scopeId: null,
      effectiveFrom: "2026-01-01",
      effectiveTo: null,
      status: "active"
    }
  ];
}

function createDistributionCostTermsFixture(): readonly DistributionCostTermInput[] {
  return [
    {
      id: "cost_advance",
      contractId: "contract_1",
      payeeId: "payee_alma",
      amount: "20.0000000000",
      currency: "USD",
      recoupable: true,
      status: "open",
      expenseDate: "2026-01-15"
    }
  ];
}

function createDistributionExpenseApplicationsFixture(): readonly DistributionExistingExpenseApplication[] {
  return [
    {
      costTermId: "cost_advance",
      amountApplied: "10.0000000000",
      currency: "USD"
    }
  ];
}

function createDistributionPayeeBalancesFixture(): readonly PayeeBalanceLedgerInput[] {
  return [
    {
      id: "balance_statement_alma",
      payeeId: "payee_alma",
      statementId: "statement_alma",
      currency: "USD",
      openingBalance: "0.0000000000",
      periodNet: "60.0000000000",
      closingBalance: "0.0000000000",
      movementType: "statement",
      createdAt: "2026-05-02T10:00:00.000Z"
    }
  ];
}
