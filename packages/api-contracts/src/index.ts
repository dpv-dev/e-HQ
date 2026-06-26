import { z } from "zod";

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
