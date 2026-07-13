import type { ApiRequestState } from "@ehq/api-client";

export type CanonicalRequestStatus = "idle" | "loading" | "success" | "error";

export function isRequestStatusLoading(status: CanonicalRequestStatus): boolean {
  return status === "loading" || status === "idle";
}

export function isApiRequestLoading<TData>(state: ApiRequestState<TData>): boolean {
  return isRequestStatusLoading(state.status);
}

export function apiRequestStateLabel<TData>(state: ApiRequestState<TData>): "loading" | "error" | "loaded" {
  if (isApiRequestLoading(state)) {
    return "loading";
  }

  if (state.status === "error") {
    return "error";
  }

  return "loaded";
}
