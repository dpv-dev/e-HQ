export type LegacyDatabaseAccessMode = "read-only";
export * from "./distribution/schema.js";
export type * from "./distribution/types.js";
export * from "./office/schema.js";
export type * from "./office/types.js";
export interface LegacyDatabaseTarget {
    readonly host: string;
    readonly databaseName: string;
    readonly tablePrefix: string;
    readonly accessMode: LegacyDatabaseAccessMode;
}
export interface LegacyTransactionRow {
    readonly id: string;
    readonly transactionDate: string;
    readonly type: "income" | "expense";
    readonly status: string;
    readonly amountMurDecimal: string;
    readonly categoryId: string | null;
    readonly partnerId: string | null;
    readonly projectId: string | null;
}
export interface LegacyCategoryRow {
    readonly id: string;
    readonly name: string;
    readonly type: string;
    readonly departmentId: string | null;
    readonly divisionId: string | null;
}
export interface LegacyContractCostTermRow {
    readonly id: string;
    readonly contractId: string;
    readonly payeeId: string | null;
    readonly amountDecimal: string;
    readonly currency: string;
    readonly recoupable: boolean;
    readonly status: string;
}
export interface ReadonlyLegacyFinanceRepository {
    readonly target: LegacyDatabaseTarget;
    readTransactions(): Promise<readonly LegacyTransactionRow[]>;
    readCategories(): Promise<readonly LegacyCategoryRow[]>;
    readContractCostTerms(): Promise<readonly LegacyContractCostTermRow[]>;
}
export declare const legacyDatabaseTarget: LegacyDatabaseTarget;
//# sourceMappingURL=index.d.ts.map