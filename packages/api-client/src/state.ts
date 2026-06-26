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
