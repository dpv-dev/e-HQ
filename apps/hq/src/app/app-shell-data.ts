import {
  createApiClient,
  createErrorState,
  createIdleState,
  createSuccessState,
  standardApiRetryPolicy,
  type ApiRequestState,
  type EhqApiClient
} from "@ehq/api-client";
import type { WorkspaceAppId } from "@ehq/auth";
import { readRequiredViteEnv } from "./env.js";
import type { Tone } from "./platform-data.js";
import { getSupabaseAccessToken } from "./supabase.js";

export interface WorkspaceDashboardSummary {
  readonly label: string;
  readonly detail: string;
  readonly tone: Tone;
}

export type WorkspaceDashboardStates = Readonly<Record<WorkspaceAppId, ApiRequestState<WorkspaceDashboardSummary>>>;

const apiBaseUrl: string = readRequiredViteEnv("VITE_API_BASE_URL");

export function createInitialWorkspaceDashboardStates(): WorkspaceDashboardStates {
  return {
    "command-center": createIdleState<WorkspaceDashboardSummary>(),
    office: createIdleState<WorkspaceDashboardSummary>(),
    distribution: createIdleState<WorkspaceDashboardSummary>()
  };
}

export function createShellApiClient(): EhqApiClient {
  return createApiClient({
    baseUrl: apiBaseUrl,
    fetch: (input: RequestInfo | URL, init: RequestInit): Promise<Response> => fetch(input, init),
    auth: {
      getAccessToken: getSupabaseAccessToken
    },
    retryPolicy: standardApiRetryPolicy,
    readCacheTtlMs: 3_000
  });
}

export async function loadWorkspaceDashboardSummary(
  client: EhqApiClient,
  workspaceId: WorkspaceAppId,
  workspaceRef: string,
  period: string
): Promise<ApiRequestState<WorkspaceDashboardSummary>> {
  try {
    if (workspaceId === "command-center") {
      return createSuccessState<WorkspaceDashboardSummary>({
        label: "System operational",
        detail: "3 monitored workspaces",
        tone: "success"
      });
    }

    if (workspaceId === "office") {
      const dashboard = await client.office.getDashboard({
        workspaceId: workspaceRef,
        period
      });

      return createSuccessState<WorkspaceDashboardSummary>({
        label: "Office loaded",
        detail: `${String(dashboard.unreconciledTransactionCount)} lines to reconcile`,
        tone: "success"
      });
    }

    const dashboard = await client.distribution.getDashboard({
      workspaceId: workspaceRef,
      period
    });

    return createSuccessState<WorkspaceDashboardSummary>({
      label: "Distribution loaded",
      detail: `${String(dashboard.suspenseCount)} suspense`,
      tone: "warning"
    });
  } catch (error: unknown) {
    return createErrorState<WorkspaceDashboardSummary>(error);
  }
}
