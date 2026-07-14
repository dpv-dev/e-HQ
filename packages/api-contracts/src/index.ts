import { z } from "zod";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/u;
const currencyCodePattern = /^[A-Z]{3}$/u;
const moneyStringPattern = /^-?\d+(?:\.\d+)?$/u;
const workspaceIdSchema = z.string().min(1);
const nullableIdSchema = z.string().min(1).nullable();
const nullableTextSchema = z.string().min(1).nullable();

export const officeCashflowManualEntryWriteSchema = z.object({
  workspaceId: workspaceIdSchema,
  accountId: nullableIdSchema,
  partnerId: nullableIdSchema,
  projectId: nullableIdSchema,
  entryDate: z.string().regex(isoDatePattern),
  direction: z.enum(["inflow", "outflow"]),
  amountMicro: z.string().regex(moneyStringPattern),
  currency: z.string().regex(currencyCodePattern),
  label: z.string().trim().min(1),
  notes: nullableTextSchema,
  status: z.enum(["planned", "confirmed"])
});

export const officeCashflowManualEntryCancelSchema = z.object({
  workspaceId: workspaceIdSchema,
  reason: nullableTextSchema
});

export const officeAdvanceWriteSchema = z.object({
  workspaceId: workspaceIdSchema,
  beneficiaryType: z.enum(["staff", "freelancer", "artist", "supplier", "contractor", "other"]),
  beneficiaryName: z.string().trim().min(1).max(160),
  partnerId: nullableIdSchema,
  projectId: nullableIdSchema,
  transactionId: nullableIdSchema,
  label: z.string().trim().min(1),
  plannedPaymentOn: z.string().regex(isoDatePattern),
  paidOn: z.string().regex(isoDatePattern).nullable(),
  originalAmountMicro: z.string().regex(moneyStringPattern),
  currency: z.string().regex(currencyCodePattern),
  status: z.enum(["planned", "paid"]),
  notes: nullableTextSchema
});

export const officeAdvanceApplicationSchema = z.object({
  workspaceId: workspaceIdSchema,
  appliedOn: z.string().regex(isoDatePattern),
  amountMicro: z.string().regex(moneyStringPattern),
  kind: z.enum(["invoice", "expense", "refund", "write_off"]),
  reference: nullableTextSchema,
  notes: nullableTextSchema
});

export const officeAdvanceMarkPaidSchema = z.object({
  workspaceId: workspaceIdSchema,
  paidOn: z.string().regex(isoDatePattern),
  transactionId: nullableIdSchema
});

const todoMessage = "TODO(api-contracts): replace contract placeholders after endpoint approval.";

export interface ApiErrorEnvelope {
  readonly code: string;
  readonly message: string;
  readonly context: readonly string[];
}

export const apiErrorEnvelopeSchema: z.ZodType<ApiErrorEnvelope> = z.custom<ApiErrorEnvelope>((input: unknown): input is ApiErrorEnvelope => {
  throw new Error(todoMessage);
});

export function createOpenApiDocument(): never {
  throw new Error("TODO(api-contracts): define OpenAPI shapes contract-first.");
}
