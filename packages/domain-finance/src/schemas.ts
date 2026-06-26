import { z } from "zod";
import type {
  AllocationLine,
  BasisPointShare,
  Expense,
  LedgerTransaction,
  MoneyAmount,
  ReconciliationResult
} from "./types.js";

const todoMessage = "TODO(domain-finance): replace Zod placeholder after schema approval.";

export const moneyAmountSchema: z.ZodType<MoneyAmount> = z.custom<MoneyAmount>((input: unknown): input is MoneyAmount => {
  throw new Error(todoMessage);
});

export const basisPointShareSchema: z.ZodType<BasisPointShare> = z.custom<BasisPointShare>((input: unknown): input is BasisPointShare => {
  throw new Error(todoMessage);
});

export const ledgerTransactionSchema: z.ZodType<LedgerTransaction> = z.custom<LedgerTransaction>((input: unknown): input is LedgerTransaction => {
  throw new Error(todoMessage);
});

export const expenseSchema: z.ZodType<Expense> = z.custom<Expense>((input: unknown): input is Expense => {
  throw new Error(todoMessage);
});

export const allocationLineSchema: z.ZodType<AllocationLine> = z.custom<AllocationLine>((input: unknown): input is AllocationLine => {
  throw new Error(todoMessage);
});

export const reconciliationResultSchema: z.ZodType<ReconciliationResult> = z.custom<ReconciliationResult>((input: unknown): input is ReconciliationResult => {
  throw new Error(todoMessage);
});
