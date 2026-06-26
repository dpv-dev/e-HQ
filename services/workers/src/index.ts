export type WorkflowLockKey = string;

export interface WorkflowRunStub {
  readonly lockKey: WorkflowLockKey;
  readonly status: "pending" | "running" | "completed" | "failed";
}

export function createWorkersRuntime(): never {
  throw new Error("TODO(services/workers): wire Temporal workflows after kernel approval.");
}
