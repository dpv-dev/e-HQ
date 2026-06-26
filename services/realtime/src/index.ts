export interface RealtimeStatusStub {
  readonly workflowRunId: string;
  readonly transport: "sse" | "websocket";
}

export function createRealtimeService(): never {
  throw new Error("TODO(services/realtime): wire workflow status streams after API approval.");
}
