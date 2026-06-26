declare const currencyCodeBrand: unique symbol;
declare const moneyMicroUnitsBrand: unique symbol;
declare const basisPointsBrand: unique symbol;

export type CurrencyCode = string & {
  readonly [currencyCodeBrand]: "CurrencyCode";
};

export type MoneyMicroUnits = bigint & {
  readonly [moneyMicroUnitsBrand]: "MoneyMicroUnits";
};

export type BasisPoints = number & {
  readonly [basisPointsBrand]: "BasisPoints";
};

export interface MoneyAmount {
  readonly amountMicro: MoneyMicroUnits;
  readonly currency: CurrencyCode;
}

export interface BasisPointShare {
  readonly participantId: string;
  readonly shareBasisPoints: BasisPoints;
}

export interface LegacyRoundingAuditRecord {
  readonly source: string;
  readonly original_10dp: string;
  readonly result_micro: MoneyMicroUnits;
  readonly delta: string;
}

export interface LegacyDistributionConversion {
  readonly amount: MoneyAmount;
  readonly auditRecord: LegacyRoundingAuditRecord;
}

export interface LedgerTransaction {
  readonly id: string;
  readonly transactionDate: string;
  readonly direction: "income" | "expense";
  readonly amount: MoneyAmount;
  readonly categoryId: string | null;
  readonly departmentId: string | null;
  readonly divisionId: string | null;
  readonly sourceSystem: "office" | "distribution";
}

export interface Expense {
  readonly id: string;
  readonly contractId: string;
  readonly payeeId: string | null;
  readonly amount: MoneyAmount;
  readonly recoupable: boolean;
  readonly status: "open" | "partially-recovered" | "recovered" | "non-recoverable" | "deleted";
}

export interface AllocationLine {
  readonly sourceId: string;
  readonly participantId: string;
  readonly grossAmount: MoneyAmount;
  readonly recoupmentAmount: MoneyAmount;
  readonly netAmount: MoneyAmount;
}

export interface ReconciliationResult {
  readonly transactionId: string;
  readonly linkedBankTransactionIds: readonly string[];
  readonly reconciledAmount: MoneyAmount;
}
