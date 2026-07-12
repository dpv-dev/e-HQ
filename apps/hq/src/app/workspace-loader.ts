import type { WorkspaceAppId } from "@ehq/auth";

export interface WorkspaceComponentModule {
  readonly default: any;
}

export function loadWorkspaceComponent(workspaceId: WorkspaceAppId): Promise<WorkspaceComponentModule> {
  if (workspaceId === "office") {
    return import("./canonical/office/App.svelte") as unknown as Promise<WorkspaceComponentModule>;
  }

  if (workspaceId === "distribution") {
    return import("./canonical/distribution/App.svelte") as unknown as Promise<WorkspaceComponentModule>;
  }

  return import("./canonical/command-center/App.svelte") as unknown as Promise<WorkspaceComponentModule>;
}

export function prefetchWorkspaceComponent(workspaceId: WorkspaceAppId): void {
  void loadWorkspaceComponent(workspaceId);
}
