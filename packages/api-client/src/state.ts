export type ApiRequestState<TData> =
  | ApiIdleState
  | ApiLoadingState
  | ApiSuccessState<TData>
  | ApiErrorState;

export interface ApiIdleState {
  readonly status: "idle";
  readonly data: null;
  readonly error: null;
}

export interface ApiLoadingState {
  readonly status: "loading";
  readonly data: null;
  readonly error: null;
}

export interface ApiSuccessState<TData> {
  readonly status: "success";
  readonly data: TData;
  readonly error: null;
}

export interface ApiErrorState {
  readonly status: "error";
  readonly data: null;
  readonly error: unknown;
}

export function createIdleState<TData>(): ApiRequestState<TData> {
  return {
    status: "idle",
    data: null,
    error: null
  };
}

export function createLoadingState<TData>(): ApiRequestState<TData> {
  return {
    status: "loading",
    data: null,
    error: null
  };
}

export function createSuccessState<TData>(data: TData): ApiRequestState<TData> {
  return {
    status: "success",
    data,
    error: null
  };
}

export function createErrorState<TData>(error: unknown): ApiRequestState<TData> {
  return {
    status: "error",
    data: null,
    error
  };
}

// Stale-while-revalidate: when re-fetching data that is already loaded (e.g. after a
// write), keep the current rows on screen instead of flashing a blank loading state.
// Only the very first load (idle/error/still-loading) shows the spinner. The success
// data is replaced atomically when the fresh response arrives.
//
// SVELTE 5 HAZARD — only call from IMPERATIVE loaders (onMount + explicit handler calls).
// This READS `current.status`. If a loader that does `X = beginReload(X)` is invoked from a
// reactive `$effect(() => void loadX())`, the effect tracks that read, and the write on the
// next line re-triggers the effect → infinite reload loop (a real bug this once shipped:
// ~640 requests hammering one endpoint). Effect-driven loaders must use createLoadingState()
// (which reads nothing), or wrap the read in svelte's untrack().
export function beginReload<TData>(current: ApiRequestState<TData>): ApiRequestState<TData> {
  return current.status === "success" ? current : createLoadingState<TData>();
}
