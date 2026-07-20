import { z } from "zod";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/u;
const isoDateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u;
const currencyCodePattern = /^[A-Z]{3}$/u;
const moneyStringPattern = /^-?\d+(?:\.\d+)?$/u;
const positiveDecimalPattern = /^(?:0\.\d*[1-9]\d*|[1-9]\d*(?:\.\d+)?)$/u;
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

export const distributionContractExpenseCategorySchema = z.enum([
  "advance",
  "recoupment",
  "studio",
  "marketing",
  "distribution",
  "other"
]);

export const distributionContractExpenseWriteSchema = z.object({
  workspaceId: workspaceIdSchema,
  contractId: z.string().min(1),
  payeeId: nullableIdSchema,
  incurredOn: z.string().regex(isoDatePattern),
  category: distributionContractExpenseCategorySchema,
  label: z.string().trim().min(1).max(500),
  amountMicro: z.string().regex(positiveDecimalPattern),
  currency: z.string().regex(currencyCodePattern),
  recoverable: z.boolean()
}).strict();

export const distributionContractExpenseUpdateSchema = distributionContractExpenseWriteSchema.extend({
  status: z.enum(["open", "recouped", "waived"])
});

export const distributionPaymentMethodSchema = z.enum([
  "bank_transfer",
  "paypal",
  "cash",
  "cheque",
  "crypto",
  "other"
]);

const distributionPaymentMutableSchema = z.object({
  workspaceId: workspaceIdSchema,
  amountMicro: z.string().regex(positiveDecimalPattern),
  currency: z.string().regex(currencyCodePattern),
  exchangeRate: z.string().regex(positiveDecimalPattern).nullable(),
  method: distributionPaymentMethodSchema,
  status: z.enum(["draft", "paid"]),
  paidAt: z.string().regex(isoDateTimePattern).nullable(),
  reference: z.string().trim().min(1).max(500).nullable(),
  notes: z.string().trim().min(1).max(4000).nullable()
}).strict();

function validatePaidAt(
  value: { readonly status: "draft" | "paid"; readonly paidAt: string | null },
  refinementContext: z.RefinementCtx
): void {
  if (value.status === "paid" && value.paidAt === null) {
    refinementContext.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["paidAt"],
      message: "paidAt is required when status is paid."
    });
  }
  if (value.status === "draft" && value.paidAt !== null) {
    refinementContext.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["paidAt"],
      message: "paidAt must be null while status is draft."
    });
  }
}

export const distributionPaymentRecordSchema = distributionPaymentMutableSchema.extend({
  statementId: nullableIdSchema,
  payeeId: z.string().min(1)
}).superRefine(validatePaidAt);

export const distributionPaymentUpdateSchema = distributionPaymentMutableSchema.superRefine(validatePaidAt);

export const distributionPaymentReconcileSchema = z.object({
  workspaceId: workspaceIdSchema,
  statementId: z.string().min(1),
  amountAppliedMicro: z.string().regex(positiveDecimalPattern),
  reconciledAt: z.string().regex(isoDateTimePattern)
}).strict();

export interface ApiErrorEnvelope {
  readonly code: string;
  readonly message: string;
  readonly context: readonly string[];
}

export const apiErrorEnvelopeSchema: z.ZodType<ApiErrorEnvelope> = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  context: z.array(z.string())
});

export function createOpenApiDocument(): Readonly<Record<string, unknown>> {
  return {
    openapi: "3.1.0",
    info: { title: "eHQ Platform API", version: "1.0.0" },
    paths: {
      "/erh/v1/mapping/rows": {
        get: {
          operationId: "listDistributionMappingRows",
          summary: "Read the live workspace-scoped Distribution mapping queue with opaque cursor pagination"
        }
      },
      "/erh/v1/contracts/{contractId}/expenses": {
        post: { operationId: "recordDistributionContractExpense", summary: "Record an audited Distribution expense or advance" }
      },
      "/erh/v1/payments": {
        post: { operationId: "recordDistributionPayment", summary: "Record a standalone or statement-linked Distribution payment" }
      },
      "/erh/v1/payments/{paymentId}": {
        patch: { operationId: "updateDistributionPayment", summary: "Update an auditable Distribution payment record" }
      },
      "/erh/v1/payments/{paymentId}/reconcile": {
        post: { operationId: "reconcileDistributionPayment", summary: "Link a Distribution payment to a Distribution statement" }
      },
      "/erh/v1/payments/{paymentId}/void": {
        post: { operationId: "voidDistributionPayment", summary: "Void a Distribution payment without deleting it" }
      }
    }
  };
}
