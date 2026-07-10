import { z } from "zod";
import type {
  AllocationLine,
  BasisPointShare,
  Expense,
  LedgerTransaction,
  MoneyAmount,
  ReconciliationResult
} from "./types.js";
import {
  createBasisPoints,
  createCurrencyCode,
  createMoneyAmount,
  createMoneyMicroUnits
} from "./money.js";

const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/u).transform(createCurrencyCode);
const moneyMicroUnitsSchema = z.bigint().transform(createMoneyMicroUnits);

export const moneyAmountSchema: z.ZodType<MoneyAmount, z.ZodTypeDef, unknown> = z.object({
  amountMicro: moneyMicroUnitsSchema,
  currency: currencyCodeSchema
}).transform((value) => createMoneyAmount(value.amountMicro, value.currency));

export const basisPointShareSchema: z.ZodType<BasisPointShare, z.ZodTypeDef, unknown> = z.object({
  participantId: z.string().min(1),
  shareBasisPoints: z.number().int().min(0).max(10_000).transform(createBasisPoints)
});

export const ledgerTransactionSchema: z.ZodType<LedgerTransaction, z.ZodTypeDef, unknown> = z.object({
  id: z.string().min(1),
  transactionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  direction: z.enum(["income", "expense"]),
  amount: moneyAmountSchema,
  categoryId: z.string().min(1).nullable(),
  departmentId: z.string().min(1).nullable(),
  divisionId: z.string().min(1).nullable(),
  sourceSystem: z.enum(["office", "distribution"])
});

export const expenseSchema: z.ZodType<Expense, z.ZodTypeDef, unknown> = z.object({
  id: z.string().min(1),
  contractId: z.string().min(1),
  payeeId: z.string().min(1).nullable(),
  amount: moneyAmountSchema,
  recoupable: z.boolean(),
  status: z.enum(["open", "partially-recovered", "recovered", "non-recoverable", "deleted"])
});

export const allocationLineSchema: z.ZodType<AllocationLine, z.ZodTypeDef, unknown> = z.object({
  sourceId: z.string().min(1),
  participantId: z.string().min(1),
  grossAmount: moneyAmountSchema,
  recoupmentAmount: moneyAmountSchema,
  netAmount: moneyAmountSchema
});

export const reconciliationResultSchema: z.ZodType<ReconciliationResult, z.ZodTypeDef, unknown> = z.object({
  transactionId: z.string().min(1),
  linkedBankTransactionIds: z.array(z.string().min(1)),
  reconciledAmount: moneyAmountSchema
});
