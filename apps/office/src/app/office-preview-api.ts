import {
  createApiClient,
  standardApiRetryPolicy,
  type ApiMutationReceipt,
  type AuditLogEntry,
  type BankImportConfirmRequest,
  type BankImportConfirmResponse,
  type BankImportPreviewRequest,
  type BankImportPreviewResponse,
  type CashflowBucket,
  type EhqApiClient,
  type FetchLike,
  type IdempotencyKey,
  type EntityId,
  type OfficeCategoryType,
  type OfficeDashboardResponse,
  type OfficeBankQualityResponse,
  type OfficeDepartmentPnl,
  type OfficeGlobalPnl,
  type OfficeIntegrityCheckAllResponse,
  type OfficePartnerDetail,
  type OfficePartnerPnl,
  type OfficePartnerListItem,
  type OfficePartnerPayeeLink,
  type OfficePartnerPayeeLinkRequest,
  type OfficePartnerRecord,
  type OfficePartnerWriteRequest,
  type OfficePlanComptableNode,
  type OfficePnlProjectionRow,
  type OfficeProjectCoherenceViolation,
  type OfficeProjectPnl,
  type OfficeProjectSummary,
  type OfficeReconciliationCandidate,
  type OfficeTransaction,
  type OfficeTransactionStatus,
  type OfficeTransactionWriteRequest,
  type PageResult
} from "@ehq/api-client";

const workspaceId = "eeee-mu";

const dashboard: OfficeDashboardResponse = {
  period: "2026-05",
  cashBalanceMicro: "1490000000000",
  receivablesMicro: "890000000000",
  payablesMicro: "640000000000",
  unreconciledTransactionCount: 18,
  lastAuditEventId: "audit_office_preview_099",
  recentImports: [
    {
      id: "import_mcb_may",
      source: "mcb",
      fileName: "Euro MCB Current Account statement (5).pdf",
      importedAt: "2026-06-01T09:10:00.000Z",
      periodLabel: "May 2026",
      acceptedRowCount: 9,
      rejectedRowCount: 0,
      duplicateRowCount: 0,
      status: "previewed"
    },
    {
      id: "import_mur_q4",
      source: "sbi",
      fileName: "bankStatement_1Oct2024 to 28Jan2025.pdf",
      importedAt: "2026-06-01T09:14:00.000Z",
      periodLabel: "Oct 2024-Jan 2025",
      acceptedRowCount: 327,
      rejectedRowCount: 0,
      duplicateRowCount: 0,
      status: "confirmed"
    },
    {
      id: "import_cashflow_2025",
      source: "cashflow",
      fileName: "Cashflow 2025.xlsx",
      importedAt: "2026-06-01T09:20:00.000Z",
      periodLabel: "Dec 2024-Apr 2026",
      acceptedRowCount: 1033,
      rejectedRowCount: 0,
      duplicateRowCount: 2,
      status: "previewed"
    }
  ]
};

const pnlProjectionRows: readonly OfficePnlProjectionRow[] = [
  {
    id: "pnl_music",
    departmentId: "dept_music",
    departmentLabel: "ë • music",
    revenueMicro: "1240000000000",
    expenseMicro: "890000000000",
    netMicro: "350000000000",
    revenueBarLevel: 80,
    expenseBarLevel: 57,
    netBarLevel: 92,
    netTone: "positive",
    validatedProjectionId: "projection_2026_05_final",
    validatedAt: "2026-06-01T08:30:00.000Z"
  },
  {
    id: "pnl_store",
    departmentId: "dept_store",
    departmentLabel: "the storë",
    revenueMicro: "980000000000",
    expenseMicro: "760000000000",
    netMicro: "220000000000",
    revenueBarLevel: 63,
    expenseBarLevel: 49,
    netBarLevel: 58,
    netTone: "positive",
    validatedProjectionId: "projection_2026_05_final",
    validatedAt: "2026-06-01T08:30:00.000Z"
  },
  {
    id: "pnl_visuals",
    departmentId: "dept_visuals",
    departmentLabel: "ë • visuals",
    revenueMicro: "610000000000",
    expenseMicro: "480000000000",
    netMicro: "130000000000",
    revenueBarLevel: 39,
    expenseBarLevel: 31,
    netBarLevel: 34,
    netTone: "positive",
    validatedProjectionId: "projection_2026_05_final",
    validatedAt: "2026-06-01T08:30:00.000Z"
  },
  {
    id: "pnl_events",
    departmentId: "dept_events",
    departmentLabel: "evënts",
    revenueMicro: "1560000000000",
    expenseMicro: "1610000000000",
    netMicro: "-50000000000",
    revenueBarLevel: 100,
    expenseBarLevel: 100,
    netBarLevel: 13,
    netTone: "negative",
    validatedProjectionId: "projection_2026_05_final",
    validatedAt: "2026-06-01T08:30:00.000Z"
  },
  {
    id: "pnl_office",
    departmentId: "dept_office",
    departmentLabel: "ë • office",
    revenueMicro: "60000000000",
    expenseMicro: "410000000000",
    netMicro: "-350000000000",
    revenueBarLevel: 4,
    expenseBarLevel: 26,
    netBarLevel: 92,
    netTone: "negative",
    validatedProjectionId: "projection_2026_05_final",
    validatedAt: "2026-06-01T08:30:00.000Z"
  }
];

const globalPnl: OfficeGlobalPnl = {
  scope: "global",
  completeness: "complete",
  period: "2026-05",
  incomeMicro: "4450000000000",
  expenseMicro: "4150000000000",
  netMicro: "300000000000",
  validatedProjectionId: "projection_2026_05_final",
  projectionRows: pnlProjectionRows,
  lines: [
    {
      id: "global_income",
      label: "Validated income",
      incomeMicro: "4450000000000",
      expenseMicro: "0",
      netMicro: "4450000000000"
    },
    {
      id: "global_expense",
      label: "Validated expense",
      incomeMicro: "0",
      expenseMicro: "4150000000000",
      netMicro: "-4150000000000"
    }
  ]
};

const departmentPnls: readonly OfficeDepartmentPnl[] = pnlProjectionRows.map(
  (row: OfficePnlProjectionRow): OfficeDepartmentPnl => ({
    scope: "department",
    completeness: "complete",
    departmentId: row.departmentId,
    departmentLabel: row.departmentLabel,
    period: "2026-05",
    incomeMicro: row.revenueMicro,
    expenseMicro: row.expenseMicro,
    netMicro: row.netMicro,
    validatedProjectionId: row.validatedProjectionId,
    projectionRows: [row],
    lines: [
      {
        id: `${row.id}_income`,
        label: `${row.departmentLabel} income`,
        incomeMicro: row.revenueMicro,
        expenseMicro: "0",
        netMicro: row.revenueMicro
      },
      {
        id: `${row.id}_expense`,
        label: `${row.departmentLabel} expense`,
        incomeMicro: "0",
        expenseMicro: row.expenseMicro,
        netMicro: `-${row.expenseMicro}`
      }
    ]
  })
);

const planComptableNodes: readonly OfficePlanComptableNode[] = [
  { id: "dept_office", parentId: null, kind: "department", code: "OF", label: "ë • office", active: true },
  { id: "div_shared", parentId: "dept_office", kind: "division", code: "OF-SH", label: "Shared costs", active: true, departmentId: "dept_office", departmentLabel: "ë • office" },
  { id: "cat_rent", parentId: "div_shared", kind: "category", code: "6010", label: "Rent", active: true, departmentId: "dept_office", departmentLabel: "ë • office", divisionId: "div_shared", divisionLabel: "Shared costs", type: "expense" },
  { id: "cat_salary", parentId: "div_shared", kind: "category", code: "6020", label: "Salaries", active: true, departmentId: "dept_office", departmentLabel: "ë • office", divisionId: "div_shared", divisionLabel: "Shared costs", type: "expense" },
  { id: "dept_music", parentId: null, kind: "department", code: "MU", label: "ë • music", active: true },
  { id: "div_releases", parentId: "dept_music", kind: "division", code: "MU-RE", label: "Releases", active: true, departmentId: "dept_music", departmentLabel: "ë • music" },
  { id: "cat_streaming", parentId: "div_releases", kind: "category", code: "7010", label: "Streaming", active: true, departmentId: "dept_music", departmentLabel: "ë • music", divisionId: "div_releases", divisionLabel: "Releases", type: "income" },
  { id: "cat_studio", parentId: "div_releases", kind: "category", code: "6030", label: "Studio", active: true, departmentId: "dept_music", departmentLabel: "ë • music", divisionId: "div_releases", divisionLabel: "Releases", type: "expense" },
  { id: "dept_store", parentId: null, kind: "department", code: "ST", label: "the storë", active: true },
  { id: "div_retail", parentId: "dept_store", kind: "division", code: "ST-RE", label: "Retail", active: true, departmentId: "dept_store", departmentLabel: "the storë" },
  { id: "cat_cogs", parentId: "div_retail", kind: "category", code: "6040", label: "Cost of goods", active: true, departmentId: "dept_store", departmentLabel: "the storë", divisionId: "div_retail", divisionLabel: "Retail", type: "expense" },
  { id: "dept_events", parentId: null, kind: "department", code: "EV", label: "evënts", active: true },
  { id: "div_stage", parentId: "dept_events", kind: "division", code: "EV-ST", label: "Stage", active: true, departmentId: "dept_events", departmentLabel: "evënts" },
  { id: "cat_stage", parentId: "div_stage", kind: "category", code: "6050", label: "Stage setup", active: true, departmentId: "dept_events", departmentLabel: "evënts", divisionId: "div_stage", divisionLabel: "Stage", type: "expense" },
  { id: "cat_sponsorship", parentId: "div_stage", kind: "category", code: "7050", label: "Sponsorship income", active: true, departmentId: "dept_events", departmentLabel: "evënts", divisionId: "div_stage", divisionLabel: "Stage", type: "income" },
  { id: "dept_visuals", parentId: null, kind: "department", code: "VI", label: "ë • visuals", active: true },
  { id: "div_print", parentId: "dept_visuals", kind: "division", code: "VI-PR", label: "Print", active: true, departmentId: "dept_visuals", departmentLabel: "ë • visuals" },
  { id: "cat_print", parentId: "div_print", kind: "category", code: "6060", label: "Printing", active: true, departmentId: "dept_visuals", departmentLabel: "ë • visuals", divisionId: "div_print", divisionLabel: "Print", type: "expense" }
];

interface OfficeTransactionSeed {
  readonly id: EntityId;
  readonly occurredOn: string;
  readonly accountId: EntityId;
  readonly categoryId: EntityId | null;
  readonly projectId: EntityId | null;
  readonly projectLabel: string | null;
  readonly description: string;
  readonly amountMicro: string;
  readonly currency: string;
  readonly status: OfficeTransactionStatus;
  readonly sourceAuditEventId: EntityId | null;
}

const transactionSeeds: readonly OfficeTransactionSeed[] = [
  {
    id: "tx_rent_may",
    occurredOn: "2026-05-12",
    accountId: "mcb-main",
    categoryId: "cat_rent",
    projectId: null,
    projectLabel: null,
    description: "MCB transfer — rent",
    amountMicro: "-35000000000",
    currency: "MUR",
    status: "posted",
    sourceAuditEventId: "audit_tx_rent"
  },
  {
    id: "tx_bandcamp_may",
    occurredOn: "2026-05-11",
    accountId: "mcb-main",
    categoryId: "cat_streaming",
    projectId: "project_alma",
    projectLabel: "Alma",
    description: "Bandcamp payout",
    amountMicro: "82000000000",
    currency: "MUR",
    status: "posted",
    sourceAuditEventId: "audit_tx_bandcamp"
  },
  {
    id: "tx_stage_may",
    occurredOn: "2026-05-10",
    accountId: "sbi-operating",
    categoryId: "cat_stage",
    projectId: "project_ng_groove",
    projectLabel: "NG Groove",
    description: "Stage build",
    amountMicro: "-120000000000",
    currency: "MUR",
    status: "pending",
    sourceAuditEventId: "audit_tx_stage"
  },
  {
    id: "tx_vinyl_may",
    occurredOn: "2026-05-09",
    accountId: "mcb-main",
    categoryId: "cat_cogs",
    projectId: null,
    projectLabel: null,
    description: "Vinyl restock",
    amountMicro: "-48000000000",
    currency: "MUR",
    status: "reconciled",
    sourceAuditEventId: "audit_tx_vinyl"
  },
  {
    id: "tx_print_may",
    occurredOn: "2026-05-08",
    accountId: "mcb-main",
    categoryId: "cat_print",
    projectId: "project_album_posters",
    projectLabel: "Album posters",
    description: "Print run — posters",
    amountMicro: "-18000000000",
    currency: "MUR",
    status: "draft",
    sourceAuditEventId: "audit_tx_print"
  },
  {
    id: "tx_airport_may",
    occurredOn: "2026-05-07",
    accountId: "sbi-operating",
    categoryId: null,
    projectId: null,
    projectLabel: null,
    description: "Uber — airport run",
    amountMicro: "-2400000000",
    currency: "MUR",
    status: "pending",
    sourceAuditEventId: "audit_tx_airport"
  }
];

const transactions: readonly OfficeTransaction[] = transactionSeeds.map(createOfficePreviewTransaction);

const partnerDetails: readonly OfficePartnerDetail[] = [
  {
    id: "partner_bedouin",
    name: "Bedouin Ltd",
    status: "active",
    email: "ops@bedouin.example",
    phone: "+230 5720 1100",
    address: "Port Louis, Mauritius",
    taxId: "VAT-BED-2026",
    notes: "Events company. We invoice DJ services and they rent production gear to us.",
    activity: {
      income: {
        periodTotalMicro: "320000000000",
        openBalanceMicro: "120000000000",
        transactionCount: 4,
        lastActivityOn: "2026-05-18"
      },
      expense: {
        periodTotalMicro: "85000000000",
        openBalanceMicro: "35000000000",
        transactionCount: 2,
        lastActivityOn: "2026-05-21"
      },
      netMicro: "235000000000"
    },
    distributionPayeeLink: {
      partnerId: "partner_bedouin",
      partnerName: "Bedouin Ltd",
      payeeId: "payee_bedouin",
      payeeName: "Bedouin Events",
      resolution: "stored_link",
      status: "active",
      source: "manual_link",
      confidence: "1.00"
    },
    classificationSuggestions: [
      {
        id: "suggest_bedouin_income",
        categoryId: "cat_sponsorship",
        categoryLabel: "Sponsorship income",
        type: "income",
        confidenceBp: 9200
      },
      {
        id: "suggest_bedouin_expense",
        categoryId: "cat_stage",
        categoryLabel: "Stage setup",
        type: "expense",
        confidenceBp: 8700
      }
    ]
  },
  {
    id: "partner_mauritius_music",
    name: "Mauritius Music Expo",
    status: "active",
    email: "accounts@mauritiusmusic.example",
    phone: "+230 5900 0177",
    address: "Moka, Mauritius",
    taxId: null,
    notes: "Festival client for showcase and brand activation packages.",
    activity: {
      income: {
        periodTotalMicro: "410000000000",
        openBalanceMicro: "210000000000",
        transactionCount: 3,
        lastActivityOn: "2026-05-24"
      },
      expense: {
        periodTotalMicro: "0",
        openBalanceMicro: "0",
        transactionCount: 0,
        lastActivityOn: null
      },
      netMicro: "410000000000"
    },
    distributionPayeeLink: null,
    classificationSuggestions: [
      {
        id: "suggest_mme_income",
        categoryId: "cat_sponsorship",
        categoryLabel: "Sponsorship income",
        type: "income",
        confidenceBp: 9600
      }
    ]
  },
  {
    id: "partner_pixel_print",
    name: "Pixel Print House",
    status: "active",
    email: "billing@pixelprint.example",
    phone: "+230 5860 0142",
    address: "Curepipe, Mauritius",
    taxId: "VAT-PIX-001",
    notes: "Print supplier for posters, sleeves, and merch runs.",
    activity: {
      income: {
        periodTotalMicro: "0",
        openBalanceMicro: "0",
        transactionCount: 0,
        lastActivityOn: null
      },
      expense: {
        periodTotalMicro: "18000000000",
        openBalanceMicro: "18000000000",
        transactionCount: 1,
        lastActivityOn: "2026-05-08"
      },
      netMicro: "-18000000000"
    },
    distributionPayeeLink: null,
    classificationSuggestions: [
      {
        id: "suggest_pixel_expense",
        categoryId: "cat_print",
        categoryLabel: "Printing",
        type: "expense",
        confidenceBp: 9400
      }
    ]
  },
  {
    id: "partner_vinylpress",
    name: "VinylPress EU",
    status: "active",
    email: "accounts@vinylpress.example",
    phone: null,
    address: "Berlin, Germany",
    taxId: "DE-VINYL-982",
    notes: "Supplier for vinyl restock and special editions.",
    activity: {
      income: {
        periodTotalMicro: "0",
        openBalanceMicro: "0",
        transactionCount: 0,
        lastActivityOn: null
      },
      expense: {
        periodTotalMicro: "48000000000",
        openBalanceMicro: "0",
        transactionCount: 1,
        lastActivityOn: "2026-05-09"
      },
      netMicro: "-48000000000"
    },
    distributionPayeeLink: null,
    classificationSuggestions: [
      {
        id: "suggest_vinyl_expense",
        categoryId: "cat_cogs",
        categoryLabel: "Cost of goods",
        type: "expense",
        confidenceBp: 9800
      }
    ]
  }
];

const reconciliationCandidates: readonly OfficeReconciliationCandidate[] = [
  {
    id: "rec_vinyl",
    transactionId: "tx_vinyl_may",
    statementLineId: "bank_line_7001",
    occurredOn: "2026-05-09",
    bankDescription: "CARD — vinyl pressing",
    ledgerDescription: "Cost of goods · the storë",
    amountMicro: "-48000000000",
    confidenceBp: 9800,
    status: "suggested"
  },
  {
    id: "rec_studio",
    transactionId: "tx_studio_may",
    statementLineId: "bank_line_7002",
    occurredOn: "2026-05-06",
    bankDescription: "TRANSFER — studio",
    ledgerDescription: "Studio · ë • music",
    amountMicro: "-22000000000",
    confidenceBp: 9100,
    status: "suggested"
  },
  {
    id: "rec_unknown",
    transactionId: "tx_unknown_may",
    statementLineId: "bank_line_7003",
    occurredOn: "2026-05-05",
    bankDescription: "DEBIT — unknown",
    ledgerDescription: "To classify",
    amountMicro: "-7500000000",
    confidenceBp: 4200,
    status: "unmatched"
  }
];

const projectSummaries: readonly OfficeProjectSummary[] = [
  {
    id: "project_alma",
    code: "MU-ALMA",
    label: "Alma",
    status: "active",
    ownerLabel: "ë • music",
    periodIncomeMicro: "82000000000",
    periodExpenseMicro: "22000000000",
    netMicro: "60000000000",
    openViolationCount: 0,
    lastActivityOn: "2026-05-11"
  },
  {
    id: "project_ng_groove",
    code: "EV-NG",
    label: "NG Groove",
    status: "active",
    ownerLabel: "evënts",
    periodIncomeMicro: "240000000000",
    periodExpenseMicro: "120000000000",
    netMicro: "120000000000",
    openViolationCount: 1,
    lastActivityOn: "2026-05-10"
  },
  {
    id: "project_album_posters",
    code: "VI-POST",
    label: "Album posters",
    status: "active",
    ownerLabel: "ë • visuals",
    periodIncomeMicro: "0",
    periodExpenseMicro: "18000000000",
    netMicro: "-18000000000",
    openViolationCount: 1,
    lastActivityOn: "2026-05-08"
  }
];

const projectPnls: readonly OfficeProjectPnl[] = [
  {
    completeness: "partial",
    projectId: "project_alma",
    projectLabel: "Alma",
    period: "2026-05",
    incomeMicro: "82000000000",
    expenseMicro: "22000000000",
    netMicro: "60000000000",
    receivableMicro: "42000000000",
    payableMicro: "0",
    transactionCount: 2,
    validatedProjectionId: "projection_project_alma_2026_05",
    lines: [
      {
        id: "project_alma_bandcamp",
        label: "Bandcamp payout",
        categoryLabel: "Streaming",
        type: "income",
        transactionCount: 1,
        amountMicro: "82000000000"
      },
      {
        id: "project_alma_studio",
        label: "Studio booking",
        categoryLabel: "Studio",
        type: "expense",
        transactionCount: 1,
        amountMicro: "22000000000"
      }
    ]
  },
  {
    completeness: "partial",
    projectId: "project_ng_groove",
    projectLabel: "NG Groove",
    period: "2026-05",
    incomeMicro: "240000000000",
    expenseMicro: "120000000000",
    netMicro: "120000000000",
    receivableMicro: "80000000000",
    payableMicro: "120000000000",
    transactionCount: 2,
    validatedProjectionId: "projection_project_ng_groove_2026_05",
    lines: [
      {
        id: "project_ng_groove_sponsor",
        label: "Showcase sponsor",
        categoryLabel: "Sponsorship income",
        type: "income",
        transactionCount: 1,
        amountMicro: "240000000000"
      },
      {
        id: "project_ng_groove_stage",
        label: "Stage build",
        categoryLabel: "Stage setup",
        type: "expense",
        transactionCount: 1,
        amountMicro: "120000000000"
      }
    ]
  },
  {
    completeness: "partial",
    projectId: "project_album_posters",
    projectLabel: "Album posters",
    period: "2026-05",
    incomeMicro: "0",
    expenseMicro: "18000000000",
    netMicro: "-18000000000",
    receivableMicro: "0",
    payableMicro: "18000000000",
    transactionCount: 1,
    validatedProjectionId: "projection_project_album_posters_2026_05",
    lines: [
      {
        id: "project_album_posters_print",
        label: "Print run — posters",
        categoryLabel: "Printing",
        type: "expense",
        transactionCount: 1,
        amountMicro: "18000000000"
      }
    ]
  }
];

const projectViolations: Readonly<Record<string, readonly OfficeProjectCoherenceViolation[]>> = {
  project_alma: [],
  project_ng_groove: [
    {
      id: "violation_ng_supplier",
      projectId: "project_ng_groove",
      severity: "warning",
      rule: "supplier_partner_missing",
      message: "Stage supplier is not linked to a partner record yet.",
      exactFixPath: "partners",
      relatedEntityId: "tx_stage_may"
    }
  ],
  project_album_posters: [
    {
      id: "violation_posters_category",
      projectId: "project_album_posters",
      severity: "error",
      rule: "project_income_missing",
      message: "Project has expenses but no validated income projection for the selected period.",
      exactFixPath: "projects",
      relatedEntityId: "tx_print_may"
    }
  ]
};

const integrityCheckAll: OfficeIntegrityCheckAllResponse = {
  checkedAt: "2026-06-01T10:30:00.000Z",
  status: "warning",
  passCount: 3,
  warningCount: 2,
  failCount: 0,
  checks: [
    {
      id: "integrity_bank_import_batches",
      label: "Import batches",
      status: "pass",
      detail: "All confirmed imports have audit receipts and source fingerprints.",
      exactFixPath: "imports"
    },
    {
      id: "integrity_pending_classification",
      label: "Pending classification",
      status: "warning",
      detail: "Two transactions are pending classification before validation.",
      exactFixPath: "transactions"
    },
    {
      id: "integrity_project_coherence",
      label: "Project coherence",
      status: "warning",
      detail: "Two projects have open coherence warnings.",
      exactFixPath: "projects"
    },
    {
      id: "integrity_partner_activity",
      label: "Partner activity sides",
      status: "pass",
      detail: "Income and expense sides are available as separate partner facts.",
      exactFixPath: "partners"
    },
    {
      id: "integrity_reconciliation_atomicity",
      label: "Reconciliation batches",
      status: "pass",
      detail: "No partial approval batches detected in the preview window.",
      exactFixPath: "reconciliation"
    }
  ]
};

const bankQuality: OfficeBankQualityResponse = {
  period: "2026-05",
  matchedRateBp: 8600,
  unmatchedLineCount: 18,
  duplicateCandidateCount: 2,
  missingReferenceCount: 4,
  staleImportCount: 0,
  lastImportAt: "2026-06-01T09:20:00.000Z"
};

const cashflowBuckets: readonly CashflowBucket[] = [
  { period: "2026-01", inflowMicro: "620000000000", outflowMicro: "510000000000", closingMicro: "1110000000000", inflowLevel: 62, outflowLevel: 51 },
  { period: "2026-02", inflowMicro: "710000000000", outflowMicro: "560000000000", closingMicro: "1260000000000", inflowLevel: 71, outflowLevel: 56 },
  { period: "2026-03", inflowMicro: "680000000000", outflowMicro: "590000000000", closingMicro: "1350000000000", inflowLevel: 68, outflowLevel: 59 },
  { period: "2026-04", inflowMicro: "790000000000", outflowMicro: "650000000000", closingMicro: "1490000000000", inflowLevel: 79, outflowLevel: 65 },
  { period: "2026-05", inflowMicro: "890000000000", outflowMicro: "640000000000", closingMicro: "1740000000000", inflowLevel: 89, outflowLevel: 64 },
  { period: "2026-06", inflowMicro: "760000000000", outflowMicro: "700000000000", closingMicro: "1800000000000", inflowLevel: 76, outflowLevel: 70 }
];

const auditLogEntries: readonly AuditLogEntry[] = [
  {
    id: "audit_import_preview",
    occurredAt: "2026-06-01T09:10:00.000Z",
    actorId: "user_david_preview",
    action: "office.import.previewed",
    entityType: "bank_import_preview",
    entityId: "preview_mcb_may",
    idempotencyKey: "office-preview-seed",
    context: { source: "mcb", rows: "214" }
  },
  {
    id: "audit_recon_batch",
    occurredAt: "2026-06-01T10:00:00.000Z",
    actorId: "user_david_preview",
    action: "office.reconciliation.approved",
    entityType: "reconciliation_batch",
    entityId: "rec_batch_may",
    idempotencyKey: "office-recon-seed",
    context: { status: "accepted", candidates: "2" }
  }
];

export function createOfficePreviewClient(): EhqApiClient {
  return createApiClient({
    baseUrl: "https://preview.ehq.local",
    fetch: createOfficePreviewFetch(),
    auth: {
      getAccessToken: async (): Promise<string | null> => "office-preview-token"
    },
    retryPolicy: standardApiRetryPolicy
  });
}

function createOfficePreviewFetch(): FetchLike {
  return async (input: RequestInfo | URL, init: RequestInit): Promise<Response> => {
    const url = new URL(getRequestUrl(input));
    const method = init.method ?? "GET";
    const headers = new Headers(init.headers);

    if (headers.get("Authorization") !== "Bearer office-preview-token") {
      return createJsonResponse(createErrorPayload("preview_auth_missing", "Preview auth token missing.", url), 401);
    }

    if (!url.pathname.includes("/eof/v1/")) {
      return createJsonResponse(createErrorPayload("preview_namespace_missing", "Only eof/v1 preview routes exist.", url), 404);
    }

    return routeOfficeRequest(url, method, headers, init.body);
  };
}

function routeOfficeRequest(url: URL, method: string, headers: Headers, body: BodyInit | null | undefined): Response {
  if (method === "GET" && url.pathname.endsWith("/eof/v1/dashboard")) {
    return createJsonResponse(dashboard, 200);
  }

  if (method === "GET" && url.pathname.endsWith("/eof/v1/dashboard/pnl-projection")) {
    return createJsonResponse(filterPnlRows(url), 200);
  }

  if (method === "GET" && url.pathname.endsWith("/eof/v1/pl/global")) {
    return createJsonResponse(globalPnl, 200);
  }

  if (method === "GET" && url.pathname.includes("/eof/v1/pl/department/")) {
    const departmentPnl = getDepartmentPnlFromPath(url);
    if (departmentPnl === null) {
      return createJsonResponse(createErrorPayload("preview_department_missing", "Preview department P&L is not implemented.", url), 404);
    }
    return createJsonResponse(departmentPnl, 200);
  }

  if (method === "GET" && url.pathname.endsWith("/eof/v1/transactions")) {
    return createJsonResponse(createPageResult(filterTransactions(url)), 200);
  }

  if (method === "GET" && url.pathname.endsWith("/eof/v1/plan-comptable")) {
    return createJsonResponse(planComptableNodes, 200);
  }

  if (method === "GET" && url.pathname.endsWith("/eof/v1/reconciliations")) {
    return createJsonResponse(createPageResult(filterReconciliations(url)), 200);
  }

  if (method === "GET" && url.pathname.endsWith("/eof/v1/cashflow")) {
    return createJsonResponse(cashflowBuckets, 200);
  }

  if (method === "GET" && url.pathname.endsWith("/eof/v1/integrity/check-all")) {
    return createJsonResponse(integrityCheckAll, 200);
  }

  if (method === "GET" && url.pathname.endsWith("/eof/v1/analytics/bank-quality")) {
    return createJsonResponse(bankQuality, 200);
  }

  if (method === "GET" && url.pathname.endsWith("/eof/v1/audit-log")) {
    return createJsonResponse(createPageResult(auditLogEntries), 200);
  }

  if (method === "GET" && url.pathname.endsWith("/eof/v1/projects")) {
    return createJsonResponse(createPageResult(filterProjects(url)), 200);
  }

  if (method === "GET" && url.pathname.includes("/eof/v1/projects/") && url.pathname.endsWith("/coherence-violations")) {
    return createJsonResponse(createPageResult(getProjectViolationsFromPath(url)), 200);
  }

  if (method === "GET" && url.pathname.includes("/eof/v1/pl/project/")) {
    const projectPnl = getProjectPnlFromPath(url);
    if (projectPnl === null) {
      return createJsonResponse(createErrorPayload("preview_project_missing", "Preview project is not implemented.", url), 404);
    }
    return createJsonResponse(projectPnl, 200);
  }

  if (method === "GET" && url.pathname.endsWith("/eof/v1/partners")) {
    return createJsonResponse(createPageResult(filterPartners(url)), 200);
  }

  if (method === "GET" && url.pathname.includes("/eof/v1/classification/suggestions/")) {
    const partner = getPartnerDetailFromPath(url, "/eof/v1/classification/suggestions/");
    if (partner === null) {
      return createJsonResponse(createErrorPayload("preview_partner_missing", "Preview partner is not implemented.", url), 404);
    }
    return createJsonResponse(partner.classificationSuggestions, 200);
  }

  if (method === "GET" && url.pathname.includes("/eof/v1/pl/partner/")) {
    const partner = getPartnerDetailFromPath(url, "/eof/v1/pl/partner/");
    if (partner === null) {
      return createJsonResponse(createErrorPayload("preview_partner_missing", "Preview partner is not implemented.", url), 404);
    }
    return createJsonResponse(createPartnerPnl(partner), 200);
  }

  if (method === "GET" && url.pathname.includes("/eof/v1/partners/") && url.pathname.endsWith("/payee-link")) {
    const partner = getPartnerDetailFromPath(url, "/eof/v1/partners/");
    if (partner === null) {
      return createJsonResponse(createErrorPayload("preview_partner_missing", "Preview partner is not implemented.", url), 404);
    }
    return createJsonResponse(createPartnerPayeeLink(partner), 200);
  }

  if (method === "GET" && url.pathname.includes("/eof/v1/partners/")) {
    const partner = getPartnerDetailFromPath(url, "/eof/v1/partners/");
    if (partner === null) {
      return createJsonResponse(createErrorPayload("preview_partner_missing", "Preview partner is not implemented.", url), 404);
    }
    return createJsonResponse(createPartnerRecord(partner), 200);
  }

  if (method === "POST" && url.pathname.endsWith("/eof/v1/bank-import/preview")) {
    const idempotencyKey = requireIdempotencyKey(headers, url);
    const request = parseJsonBody<BankImportPreviewRequest>(body, url);
    return createJsonResponse(createImportPreviewResponse(request, idempotencyKey), 200);
  }

  if (method === "POST" && url.pathname.endsWith("/eof/v1/bank-import/confirm")) {
    const idempotencyKey = requireIdempotencyKey(headers, url);
    const request = parseJsonBody<BankImportConfirmRequest>(body, url);
    return createJsonResponse(createImportConfirmResponse(request, idempotencyKey), 200);
  }

  if (method === "POST" && url.pathname.endsWith("/eof/v1/plan-comptable")) {
    const idempotencyKey = requireIdempotencyKey(headers, url);
    return createJsonResponse(createMutationReceipt("plan_node_preview", idempotencyKey), 202);
  }

  if (method === "PATCH" && url.pathname.includes("/eof/v1/plan-comptable/")) {
    const idempotencyKey = requireIdempotencyKey(headers, url);
    return createJsonResponse(createMutationReceipt("plan_node_updated", idempotencyKey), 202);
  }

  if (method === "POST" && url.pathname.endsWith("/eof/v1/reconciliations/approve")) {
    const idempotencyKey = requireIdempotencyKey(headers, url);
    return createJsonResponse(createMutationReceipt("reconciliation_batch_preview", idempotencyKey), 202);
  }

  if (method === "POST" && url.pathname.endsWith("/eof/v1/transactions")) {
    const idempotencyKey = requireIdempotencyKey(headers, url);
    parseJsonBody<OfficeTransactionWriteRequest>(body, url);
    return createJsonResponse(createMutationReceipt("transaction_preview", idempotencyKey), 202);
  }

  if (method === "PATCH" && url.pathname.includes("/eof/v1/transactions/")) {
    const idempotencyKey = requireIdempotencyKey(headers, url);
    const request = parseJsonBody<OfficeTransactionWriteRequest>(body, url);
    if (request.categoryId === null) {
      return createJsonResponse(
        createErrorPayload("preview_category_required", "Validated transaction lines require a category.", url),
        422
      );
    }
    return createJsonResponse(createMutationReceipt("transaction_updated", idempotencyKey), 202);
  }

  if (method === "POST" && url.pathname.endsWith("/eof/v1/partners")) {
    const idempotencyKey = requireIdempotencyKey(headers, url);
    parseJsonBody<OfficePartnerWriteRequest>(body, url);
    return createJsonResponse(createMutationReceipt("partner_created_preview", idempotencyKey), 202);
  }

  if (method === "POST" && url.pathname.includes("/eof/v1/partners/") && url.pathname.endsWith("/payee-link")) {
    const idempotencyKey = requireIdempotencyKey(headers, url);
    parseJsonBody<OfficePartnerPayeeLinkRequest>(body, url);
    return createJsonResponse(createMutationReceipt("partner_payee_linked_preview", idempotencyKey), 202);
  }

  if (method === "PATCH" && url.pathname.includes("/eof/v1/partners/") && url.pathname.endsWith("/payee-link")) {
    const idempotencyKey = requireIdempotencyKey(headers, url);
    parseJsonBody<OfficePartnerPayeeLinkRequest>(body, url);
    return createJsonResponse(createMutationReceipt("partner_payee_unlinked_preview", idempotencyKey), 202);
  }

  if (method === "PATCH" && url.pathname.includes("/eof/v1/partners/")) {
    const idempotencyKey = requireIdempotencyKey(headers, url);
    parseJsonBody<OfficePartnerWriteRequest>(body, url);
    return createJsonResponse(createMutationReceipt("partner_updated_preview", idempotencyKey), 202);
  }

  return createJsonResponse(createErrorPayload("preview_route_missing", "Preview route is not implemented.", url), 404);
}

function filterPnlRows(url: URL): readonly OfficePnlProjectionRow[] {
  const departmentId = getNullableQueryValue(url, "departmentId");

  if (departmentId === null) {
    return pnlProjectionRows;
  }

  return pnlProjectionRows.filter((row: OfficePnlProjectionRow): boolean => row.departmentId === departmentId);
}

function filterTransactions(url: URL): readonly OfficeTransaction[] {
  const period = getNullableQueryValue(url, "period");
  const accountId = getNullableQueryValue(url, "accountId");
  const departmentId = getNullableQueryValue(url, "departmentId");
  const divisionId = getNullableQueryValue(url, "divisionId");
  const categoryId = getNullableQueryValue(url, "categoryId");
  const projectId = getNullableQueryValue(url, "projectId");
  const type = getNullableQueryValue(url, "type");
  const status = getNullableQueryValue(url, "status");

  return transactions.filter((transaction: OfficeTransaction): boolean => {
    const periodMatches = period === null || transaction.occurredOn.startsWith(period);
    const accountMatches = accountId === null || transaction.accountId === accountId;
    const departmentMatches = departmentId === null || transaction.departmentId === departmentId;
    const divisionMatches = divisionId === null || transaction.divisionId === divisionId;
    const categoryMatches = categoryId === null || transaction.categoryId === categoryId;
    const projectMatches = projectId === null || transaction.projectId === projectId;
    const typeMatches = type === null || transaction.type === type;
    const statusMatches = status === null || transaction.status === status;

    return (
      periodMatches &&
      accountMatches &&
      departmentMatches &&
      divisionMatches &&
      categoryMatches &&
      projectMatches &&
      typeMatches &&
      statusMatches
    );
  });
}

function createOfficePreviewTransaction(seed: OfficeTransactionSeed): OfficeTransaction {
  const category = seed.categoryId === null ? null : getPlanCategory(seed.categoryId);
  const base = {
    id: seed.id,
    occurredOn: seed.occurredOn,
    accountId: seed.accountId,
    projectId: seed.projectId,
    projectLabel: seed.projectLabel,
    description: seed.description,
    amountMicro: seed.amountMicro,
    currency: seed.currency,
    sourceAuditEventId: seed.sourceAuditEventId
  };

  if (category === null) {
    if (isValidatedStatus(seed.status)) {
      throw new Error(`Validated preview transaction is missing category: ${seed.id}`);
    }

    return {
      ...base,
      status: seed.status,
      departmentId: null,
      departmentLabel: null,
      divisionId: null,
      divisionLabel: null,
      categoryId: null,
      categoryLabel: null,
      type: null
    };
  }

  const resolved = {
    ...base,
    departmentId: category.departmentId,
    departmentLabel: category.departmentLabel,
    divisionId: category.divisionId,
    divisionLabel: category.divisionLabel,
    categoryId: category.id,
    categoryLabel: category.label,
    type: category.type
  };

  if (isValidatedStatus(seed.status)) {
    return {
      ...resolved,
      status: seed.status
    };
  }

  return {
    ...resolved,
    status: seed.status
  };
}

function getPlanCategory(categoryId: EntityId): Extract<OfficePlanComptableNode, { readonly kind: "category" }> {
  const category = planComptableNodes.find(
    (node: OfficePlanComptableNode): boolean => node.kind === "category" && node.id === categoryId
  );

  if (category === undefined || category.kind !== "category") {
    throw new Error(`Preview category is not implemented: ${categoryId}`);
  }

  return category;
}

function isValidatedStatus(
  status: OfficeTransactionStatus
): status is "posted" | "reconciled" | "voided" {
  return status === "posted" || status === "reconciled" || status === "voided";
}

function filterReconciliations(url: URL): readonly OfficeReconciliationCandidate[] {
  const status = getNullableQueryValue(url, "status");

  if (status === null) {
    return reconciliationCandidates;
  }

  return reconciliationCandidates.filter(
    (candidate: OfficeReconciliationCandidate): boolean => candidate.status === status
  );
}

function filterPartners(url: URL): readonly OfficePartnerListItem[] {
  const facet = getNullableQueryValue(url, "facet");
  const side = facet === "supplier" ? "expense" : "income";

  return partnerDetails
    .filter((partner: OfficePartnerDetail): boolean => isNonZeroMicro(partner.activity[side].periodTotalMicro))
    .map(toPartnerListItem);
}

function filterProjects(url: URL): readonly OfficeProjectSummary[] {
  const status = getNullableQueryValue(url, "status");

  if (status === null) {
    return projectSummaries;
  }

  return projectSummaries.filter((project: OfficeProjectSummary): boolean => project.status === status);
}

function toPartnerListItem(partner: OfficePartnerDetail): OfficePartnerListItem {
  return {
    id: partner.id,
    name: partner.name,
    status: partner.status,
    activity: partner.activity,
    distributionPayeeLink: partner.distributionPayeeLink
  };
}

function createPartnerRecord(partner: OfficePartnerDetail): OfficePartnerRecord {
  return {
    id: partner.id,
    name: partner.name,
    status: partner.status,
    email: partner.email,
    phone: partner.phone,
    address: partner.address,
    taxId: partner.taxId,
    notes: partner.notes
  };
}

function createPartnerPnl(partner: OfficePartnerDetail): OfficePartnerPnl {
  return {
    ...toPartnerListItem(partner),
    completeness: "partial",
    period: "2026-05"
  };
}

function getPartnerDetailFromPath(url: URL, marker: string): OfficePartnerDetail | null {
  const markerIndex = url.pathname.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const rawId = url.pathname.slice(markerIndex + marker.length).split("/")[0] ?? "";
  return partnerDetails.find((partner: OfficePartnerDetail): boolean => partner.id === rawId) ?? null;
}

function getProjectPnlFromPath(url: URL): OfficeProjectPnl | null {
  const projectId = readEntityIdFromPath(url, "/eof/v1/pl/project/");

  if (projectId === null) {
    return null;
  }

  return projectPnls.find((projectPnl: OfficeProjectPnl): boolean => projectPnl.projectId === projectId) ?? null;
}

function getDepartmentPnlFromPath(url: URL): OfficeDepartmentPnl | null {
  const departmentId = readEntityIdFromPath(url, "/eof/v1/pl/department/");

  if (departmentId === null) {
    return null;
  }

  return departmentPnls.find((departmentPnl: OfficeDepartmentPnl): boolean => departmentPnl.departmentId === departmentId) ?? null;
}

function getProjectViolationsFromPath(url: URL): readonly OfficeProjectCoherenceViolation[] {
  const projectId = readEntityIdFromPath(url, "/eof/v1/projects/");

  if (projectId === null) {
    return [];
  }

  return projectViolations[projectId] ?? [];
}

function readEntityIdFromPath(url: URL, marker: string): string | null {
  const markerIndex = url.pathname.indexOf(marker);

  if (markerIndex < 0) {
    return null;
  }

  const rawId = url.pathname.slice(markerIndex + marker.length).split("/")[0] ?? "";

  if (rawId.length === 0) {
    return null;
  }

  return rawId;
}

function createPartnerPayeeLink(partner: OfficePartnerDetail): OfficePartnerPayeeLink {
  if (partner.distributionPayeeLink !== null) {
    return partner.distributionPayeeLink;
  }

  return {
    partnerId: partner.id,
    partnerName: partner.name,
    payeeId: null,
    payeeName: null,
    resolution: "unmatched",
    status: null,
    source: "name_match",
    confidence: null
  };
}

function isNonZeroMicro(value: string): boolean {
  return BigInt(value) !== 0n;
}

function createPageResult<TItem>(items: readonly TItem[]): PageResult<TItem> {
  return {
    items,
    nextCursor: null
  };
}

function createImportPreviewResponse(
  request: BankImportPreviewRequest,
  idempotencyKey: IdempotencyKey
): BankImportPreviewResponse {
  const sourcePrefix = request.source.replaceAll("-", "_");

  if (request.source === "mcb") {
    return {
      previewId: `preview_${sourcePrefix}_${idempotencyKey}`,
      source: request.source,
      detectedFormat: "mcb_current_account_pdf",
      accountReference: "MCB EUR current ****4509",
      periodLabel: "04/05/2026 to 29/05/2026",
      currencyCodes: ["EUR"],
      openingBalanceMicro: "0",
      closingBalanceMicro: "0",
      idempotencyFingerprint: "mcb:eur-current:2026-05:statement-pdf",
      acceptedRowCount: 9,
      rejectedRowCount: 0,
      duplicateRowCount: 0,
      parsingNotes: [
        "Text PDF with transaction date, value date, amount, balance, and wrapped detail lines.",
        "Debit/credit side is inferred by server preview from balance movement, never by UI math."
      ],
      warnings: []
    };
  }

  if (request.source === "sbi") {
    return {
      previewId: `preview_${sourcePrefix}_${idempotencyKey}`,
      source: request.source,
      detectedFormat: "transaction_history_pdf",
      accountReference: "MUR statement ****5101",
      periodLabel: "01/10/2024 to 28/01/2025",
      currencyCodes: ["MUR"],
      openingBalanceMicro: "275745270000",
      closingBalanceMicro: "901726550000",
      idempotencyFingerprint: "bank-statement:mur:2024-10-01:2025-01-28",
      acceptedRowCount: 327,
      rejectedRowCount: 0,
      duplicateRowCount: 0,
      parsingNotes: [
        "JasperReports PDF with wrapped particulars and transaction IDs on continuation lines.",
        "Transaction lines are date-led; details continue until the next date-led row."
      ],
      warnings: []
    };
  }

  if (request.source === "cashflow") {
    return {
      previewId: `preview_${sourcePrefix}_${idempotencyKey}`,
      source: request.source,
      detectedFormat: "office_cashflow_workbook",
      accountReference: "SBI closing balance workbook",
      periodLabel: "Dec 2024 to Apr 2026 monthly sheets",
      currencyCodes: ["MUR"],
      openingBalanceMicro: "520517540000",
      closingBalanceMicro: "62200000",
      idempotencyFingerprint: "cashflow-workbook:2025:monthly-tabs",
      acceptedRowCount: 1033,
      rejectedRowCount: 0,
      duplicateRowCount: 2,
      parsingNotes: [
        "Monthly sheets use DATE ISSUED, INVOICE REF, CLIENT / EXPENSES, AMOUNT MUR, PAID ON, AMOUNT PAID, STILL DUE, SBI CLOSING BALANCE, and REMARKS.",
        "Workbook rows are projections/source support; confirmed import must preserve raw source and create audited overrides for corrections."
      ],
      warnings: ["Workbook mixes 2025 and early 2026 tabs; preview groups rows by sheet period."]
    };
  }

  return {
    previewId: `preview_${sourcePrefix}_${idempotencyKey}`,
    source: request.source,
    detectedFormat: request.source === "pdf" ? "supplier_receipt_or_invoice_pdf" : "generic_bank_csv",
    accountReference: null,
    periodLabel: "detected at preview",
    currencyCodes: ["MUR"],
    openingBalanceMicro: null,
    closingBalanceMicro: null,
    idempotencyFingerprint: `${request.source}:${request.checksum}`,
    acceptedRowCount: request.rows.length,
    rejectedRowCount: request.source === "pdf" ? 1 : 0,
    duplicateRowCount: 0,
    parsingNotes: ["Generic preview path until a source-specific parser is selected."],
    warnings: request.source === "pdf" ? ["One PDF line needs review before confirmation."] : []
  };
}

function createImportConfirmResponse(
  request: BankImportConfirmRequest,
  idempotencyKey: IdempotencyKey
): BankImportConfirmResponse {
  return {
    ...createMutationReceipt(request.previewId, idempotencyKey),
    importedTransactionCount: importedTransactionCountForPreview(request.previewId)
  };
}

function importedTransactionCountForPreview(previewId: string): number {
  if (previewId.includes("preview_mcb_")) {
    return 9;
  }

  if (previewId.includes("preview_sbi_")) {
    return 327;
  }

  if (previewId.includes("preview_cashflow_")) {
    return 1033;
  }

  return 3;
}

function createMutationReceipt(entityId: string, idempotencyKey: IdempotencyKey): ApiMutationReceipt {
  return {
    id: entityId,
    status: "accepted",
    auditEventId: `audit_${idempotencyKey}`
  };
}

function requireIdempotencyKey(headers: Headers, url: URL): IdempotencyKey {
  const idempotencyKey = headers.get("Idempotency-Key");

  if (idempotencyKey === null || idempotencyKey.trim().length === 0) {
    throw new Error(`Idempotency-Key missing for preview route: ${url.pathname}`);
  }

  return idempotencyKey;
}

function parseJsonBody<TBody>(body: BodyInit | null | undefined, url: URL): TBody {
  if (typeof body !== "string") {
    throw new Error(`Preview request body must be JSON text: ${url.pathname}`);
  }

  return JSON.parse(body) as TBody;
}

function getNullableQueryValue(url: URL, key: string): string | null {
  const value = url.searchParams.get(key);

  if (value === null || value.length === 0) {
    return null;
  }

  return value;
}

function getRequestUrl(input: RequestInfo | URL): string {
  if (input instanceof URL) {
    return input.href;
  }

  if (typeof input === "string") {
    return input;
  }

  return input.url;
}

function createJsonResponse(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
      "x-request-id": "office-preview-api"
    }
  });
}

function createErrorPayload(code: string, message: string, url: URL): Readonly<Record<string, string | readonly string[]>> {
  return {
    code,
    message,
    context: [`path=${url.pathname}`]
  };
}

export { workspaceId as officePreviewWorkspaceId };
