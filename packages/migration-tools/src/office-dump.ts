import type {
  LegacyBoolean,
  LegacyOfficeBankAccountRow,
  LegacyOfficeBankRawTransactionRow,
  LegacyOfficeBankReconciliationRow,
  LegacyOfficeCategoryRow,
  LegacyOfficeDepartmentRow,
  LegacyOfficeDump,
  LegacyOfficeFinancialAllocationRow,
  LegacyOfficePartnerRow,
  LegacyOfficeProjectRow,
  LegacyOfficeTransactionRow,
  OfficeB2Contract
} from "@ehq/domain-office";
import { parseMysqlInsertDump, type MysqlDumpRecord, type MysqlParsedDump } from "./mysql-dump-parser.js";

export interface OfficeLegacyTableNames {
  readonly departments: string;
  readonly categories: string;
  readonly partners: string;
  readonly projects: string;
  readonly bankAccounts: string;
  readonly transactions: string;
  readonly financialAllocations: string;
  readonly bankRawTransactions: string;
  readonly bankReconciliations: string;
}

export interface OfficeDumpBuildResult {
  readonly dump: LegacyOfficeDump;
  readonly parsedTables: MysqlParsedDump;
  readonly tableNames: OfficeLegacyTableNames;
}

interface FieldContext {
  readonly tableName: string;
  readonly fieldName: string;
  readonly rowId: string | null;
}

export function resolveOfficeLegacyTableNames(tablePrefix: string): OfficeLegacyTableNames {
  return {
    departments: `${tablePrefix}eof_departments`,
    categories: `${tablePrefix}eof_categories`,
    partners: `${tablePrefix}eof_partners`,
    projects: `${tablePrefix}eof_projects`,
    bankAccounts: `${tablePrefix}eof_bank_accounts`,
    transactions: `${tablePrefix}eof_transactions`,
    financialAllocations: `${tablePrefix}eof_financial_allocations`,
    bankRawTransactions: `${tablePrefix}eof_bank_raw_transactions`,
    bankReconciliations: `${tablePrefix}eof_bank_reconciliations`
  };
}

export function buildLegacyOfficeDumpFromSql(sql: string, contract: OfficeB2Contract): OfficeDumpBuildResult {
  const tableNames = resolveOfficeLegacyTableNames(contract.tablePrefix);
  const selectedTables = [
    tableNames.departments,
    tableNames.categories,
    tableNames.partners,
    tableNames.projects,
    tableNames.bankAccounts,
    tableNames.transactions,
    tableNames.financialAllocations,
    tableNames.bankRawTransactions,
    tableNames.bankReconciliations
  ];
  const parsedTables = parseMysqlInsertDump(sql, selectedTables);
  const dump: LegacyOfficeDump = {
    departments: readTableRows(parsedTables, tableNames.departments).map((row) => mapDepartmentRow(row, tableNames.departments)),
    categories: readTableRows(parsedTables, tableNames.categories).map((row) => mapCategoryRow(row, tableNames.categories)),
    partners: readTableRows(parsedTables, tableNames.partners).map((row) => mapPartnerRow(row, tableNames.partners)),
    projects: readTableRows(parsedTables, tableNames.projects).map((row) => mapProjectRow(row, tableNames.projects)),
    bankAccounts: readTableRows(parsedTables, tableNames.bankAccounts).map((row) => mapBankAccountRow(row, tableNames.bankAccounts)),
    transactions: readTableRows(parsedTables, tableNames.transactions).map((row) => mapTransactionRow(row, tableNames.transactions)),
    financialAllocations: readTableRows(parsedTables, tableNames.financialAllocations).map((row) =>
      mapFinancialAllocationRow(row, tableNames.financialAllocations)
    ),
    bankRawTransactions: readTableRows(parsedTables, tableNames.bankRawTransactions).map((row) => mapBankRawTransactionRow(row, tableNames.bankRawTransactions)),
    bankReconciliations: readTableRows(parsedTables, tableNames.bankReconciliations).map((row) =>
      mapBankReconciliationRow(row, tableNames.bankReconciliations)
    )
  };

  return {
    dump,
    parsedTables,
    tableNames
  };
}

function readTableRows(parsedDump: MysqlParsedDump, tableName: string): readonly MysqlDumpRecord[] {
  return parsedDump.tables.get(tableName)?.rows ?? [];
}

function mapDepartmentRow(row: MysqlDumpRecord, tableName: string): LegacyOfficeDepartmentRow {
  const id = requireCell(row, ["id"], {
    tableName,
    fieldName: "id",
    rowId: null
  });

  return {
    id,
    name: requireCell(row, ["name", "department_name", "label", "title"], {
      tableName,
      fieldName: "name",
      rowId: id
    }),
    slug: nullableText(row, ["slug"], tableName, "slug", id),
    parentId: nullableForeignKey(row, ["parent_id", "parentId"], tableName, "parentId", id),
    type: nullableText(row, ["type", "department_type"], tableName, "type", id),
    color: nullableText(row, ["color", "colour"], tableName, "color", id),
    isActive: requireLegacyBoolean(row, ["is_active", "active"], tableName, id),
    createdAt: nullableText(row, ["created_at", "created"], tableName, "createdAt", id)
  };
}

function mapCategoryRow(row: MysqlDumpRecord, tableName: string): LegacyOfficeCategoryRow {
  const id = requireCell(row, ["id"], {
    tableName,
    fieldName: "id",
    rowId: null
  });

  return {
    id,
    name: requireCell(row, ["name", "category_name", "label", "title"], {
      tableName,
      fieldName: "name",
      rowId: id
    }),
    type: requireCell(row, ["type", "transaction_type", "category_type"], {
      tableName,
      fieldName: "type",
      rowId: id
    }),
    departmentId: nullableForeignKey(row, ["department_id", "dept_id"], tableName, "departmentId", id),
    divisionId: nullableForeignKey(row, ["division_id", "divisionId"], tableName, "divisionId", id),
    isActive: requireLegacyBoolean(row, ["is_active", "active"], tableName, id)
  };
}

function mapPartnerRow(row: MysqlDumpRecord, tableName: string): LegacyOfficePartnerRow {
  const id = requireCell(row, ["id"], {
    tableName,
    fieldName: "id",
    rowId: null
  });

  return {
    id,
    name: requireCell(row, ["name", "partner_name", "company_name", "label", "title"], {
      tableName,
      fieldName: "name",
      rowId: id
    }),
    type: nullableText(row, ["type", "partner_type"], tableName, "type", id),
    isActive: requireLegacyBoolean(row, ["is_active", "active"], tableName, id)
  };
}

function mapProjectRow(row: MysqlDumpRecord, tableName: string): LegacyOfficeProjectRow {
  const id = requireCell(row, ["id"], {
    tableName,
    fieldName: "id",
    rowId: null
  });

  return {
    id,
    name: requireCell(row, ["name", "project_name", "label", "title"], {
      tableName,
      fieldName: "name",
      rowId: id
    }),
    status: nullableText(row, ["status"], tableName, "status", id),
    state: nullableText(row, ["state"], tableName, "state", id),
    isActive: requireLegacyBoolean(row, ["is_active", "active"], tableName, id)
  };
}

function mapBankAccountRow(row: MysqlDumpRecord, tableName: string): LegacyOfficeBankAccountRow {
  const id = requireCell(row, ["id"], {
    tableName,
    fieldName: "id",
    rowId: null
  });

  return {
    id,
    name: requireCell(row, ["name"], {
      tableName,
      fieldName: "name",
      rowId: id
    }),
    accountNumber: nullableText(row, ["account_number"], tableName, "accountNumber", id),
    bankName: nullableText(row, ["bank_name"], tableName, "bankName", id),
    currency: requireCell(row, ["currency"], {
      tableName,
      fieldName: "currency",
      rowId: id
    }),
    isActive: requireLegacyBoolean(row, ["is_active"], tableName, id),
    institution: nullableText(row, ["institution"], tableName, "institution", id)
  };
}

function mapTransactionRow(row: MysqlDumpRecord, tableName: string): LegacyOfficeTransactionRow {
  const id = requireCell(row, ["id"], {
    tableName,
    fieldName: "id",
    rowId: null
  });

  return {
    id,
    transactionDate: requireCell(row, ["transaction_date", "date", "created_at"], {
      tableName,
      fieldName: "transactionDate",
      rowId: id
    }),
    type: requireCell(row, ["type", "transaction_type"], {
      tableName,
      fieldName: "type",
      rowId: id
    }),
    status: requireCell(row, ["status"], {
      tableName,
      fieldName: "status",
      rowId: id
    }),
    isActive: requireLegacyBoolean(row, ["is_active", "active"], tableName, id),
    description: nullableText(row, ["description", "memo", "label", "title"], tableName, "description", id),
    categoryId: nullableForeignKey(row, ["category_id", "cat_id"], tableName, "categoryId", id),
    partnerId: nullableForeignKey(row, ["partner_id"], tableName, "partnerId", id),
    projectId: nullableForeignKey(row, ["project_id"], tableName, "projectId", id),
    amountMur: requireCell(row, ["amount_mur"], {
      tableName,
      fieldName: "amountMur",
      rowId: id
    }),
    originalAmount: nullableText(row, ["original_amount", "amount_original"], tableName, "originalAmount", id),
    originalCurrency: nullableText(row, ["original_currency", "currency"], tableName, "originalCurrency", id),
    exchangeRate: nullableText(row, ["exchange_rate", "fx_rate"], tableName, "exchangeRate", id)
  };
}

function mapFinancialAllocationRow(row: MysqlDumpRecord, tableName: string): LegacyOfficeFinancialAllocationRow {
  const id = requireCell(row, ["id"], {
    tableName,
    fieldName: "id",
    rowId: null
  });

  return {
    id,
    transactionId: requireCell(row, ["transaction_id"], {
      tableName,
      fieldName: "transactionId",
      rowId: id
    }),
    departmentId: requireCell(row, ["department_id", "dept_id"], {
      tableName,
      fieldName: "departmentId",
      rowId: id
    }),
    divisionName: nullableText(row, ["division_name"], tableName, "divisionName", id),
    amountMur: requireCell(row, ["amount_mur"], {
      tableName,
      fieldName: "amountMur",
      rowId: id
    }),
    percentageBp: nullableText(row, ["percentage_bp", "percentage"], tableName, "percentageBp", id),
    roleSlug: nullableText(row, ["role_slug"], tableName, "roleSlug", id)
  };
}

function mapBankRawTransactionRow(row: MysqlDumpRecord, tableName: string): LegacyOfficeBankRawTransactionRow {
  const id = requireCell(row, ["id"], {
    tableName,
    fieldName: "id",
    rowId: null
  });

  return {
    id,
    importId: requireCell(row, ["import_id"], {
      tableName,
      fieldName: "importId",
      rowId: id
    }),
    accountId: requireCell(row, ["account_id"], {
      tableName,
      fieldName: "accountId",
      rowId: id
    }),
    externalId: nullableText(row, ["external_id"], tableName, "externalId", id),
    transactionDate: requireCell(row, ["transaction_date"], {
      tableName,
      fieldName: "transactionDate",
      rowId: id
    }),
    description: nullableText(row, ["description"], tableName, "description", id),
    direction: requireCell(row, ["direction"], {
      tableName,
      fieldName: "direction",
      rowId: id
    }),
    amount: requireCell(row, ["amount"], {
      tableName,
      fieldName: "amount",
      rowId: id
    }),
    balance: nullableText(row, ["balance"], tableName, "balance", id),
    status: requireCell(row, ["status"], {
      tableName,
      fieldName: "status",
      rowId: id
    }),
    rawPayload: nullableText(row, ["raw_payload"], tableName, "rawPayload", id),
    createdAt: requireCell(row, ["created_at"], {
      tableName,
      fieldName: "createdAt",
      rowId: id
    }),
    dedupeHash: nullableText(row, ["dedupe_hash"], tableName, "dedupeHash", id)
  };
}

function mapBankReconciliationRow(row: MysqlDumpRecord, tableName: string): LegacyOfficeBankReconciliationRow {
  const id = requireCell(row, ["id"], {
    tableName,
    fieldName: "id",
    rowId: null
  });

  return {
    id,
    transactionId: requireCell(row, ["transaction_id"], {
      tableName,
      fieldName: "transactionId",
      rowId: id
    }),
    bankRawTransactionId: requireCell(row, ["bank_raw_transaction_id"], {
      tableName,
      fieldName: "bankRawTransactionId",
      rowId: id
    }),
    amountLinked: requireCell(row, ["amount_linked"], {
      tableName,
      fieldName: "amountLinked",
      rowId: id
    }),
    status: requireCell(row, ["status"], {
      tableName,
      fieldName: "status",
      rowId: id
    }),
    validatedByUserId: nullableText(row, ["validated_by_user_id"], tableName, "validatedByUserId", id),
    validatedAt: nullableText(row, ["validated_at"], tableName, "validatedAt", id),
    createdAt: requireCell(row, ["created_at"], {
      tableName,
      fieldName: "createdAt",
      rowId: id
    })
  };
}

function requireLegacyBoolean(row: MysqlDumpRecord, aliases: readonly string[], tableName: string, rowId: string): LegacyBoolean {
  const value = requireCell(row, aliases, {
    tableName,
    fieldName: aliases.join("|"),
    rowId
  });
  if (value === "0" || value === "1") {
    return value;
  }

  if (value === "true") {
    return "1";
  }

  if (value === "false") {
    return "0";
  }

  throw new Error(`Office B2 dump field ${aliases.join("|")} must be a legacy boolean in ${tableName} row ${rowId}: ${value}.`);
}

function nullableForeignKey(row: MysqlDumpRecord, aliases: readonly string[], tableName: string, fieldName: string, rowId: string): string | null {
  const value = nullableText(row, aliases, tableName, fieldName, rowId);
  if (value === null || value.trim().length === 0) {
    return null;
  }

  return value;
}

function nullableText(row: MysqlDumpRecord, aliases: readonly string[], tableName: string, fieldName: string, rowId: string): string | null {
  const value = readCell(row, aliases);
  if (value === undefined) {
    return null;
  }

  if (value === null) {
    return null;
  }

  if (value.length === 0 && fieldName !== "originalCurrency") {
    return null;
  }

  return value;
}

function requireCell(row: MysqlDumpRecord, aliases: readonly string[], context: FieldContext): string {
  const value = readCell(row, aliases);
  if (value === undefined || value === null || value.trim().length === 0) {
    const rowText = context.rowId === null ? "unknown row" : `row ${context.rowId}`;
    throw new Error(`Office B2 dump is missing ${context.fieldName} in ${context.tableName} ${rowText}.`);
  }

  return value;
}

function readCell(row: MysqlDumpRecord, aliases: readonly string[]): string | null | undefined {
  for (const alias of aliases) {
    const value = row[alias];
    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}
