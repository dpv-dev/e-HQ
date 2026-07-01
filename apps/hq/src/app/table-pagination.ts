import type { ApiRequestState, PageResult } from "@ehq/api-client";
import type { TablePagination } from "@ehq/ui";

export const TABLE_PAGE_SIZE = 100;

export type PageLoadMode = "one" | "all";

export function readPageItems<TItem>(state: ApiRequestState<PageResult<TItem>>): readonly TItem[] {
  if (state.status === "success") {
    return state.data.items;
  }

  return [];
}

export function appendPageResult<TItem>(
  current: PageResult<TItem>,
  next: PageResult<TItem>
): PageResult<TItem> {
  return {
    items: [...current.items, ...next.items],
    nextCursor: next.nextCursor
  };
}

export function createTablePagination<TItem>(
  state: ApiRequestState<PageResult<TItem>>,
  loading: boolean,
  error: string | null,
  onLoadMore: (() => void | Promise<void>) | null,
  onLoadAll: (() => void | Promise<void>) | null
): TablePagination | null {
  if (state.status !== "success") {
    return null;
  }

  return {
    loadedCount: state.data.items.length,
    hasMore: state.data.nextCursor !== null,
    loading,
    error,
    onLoadMore,
    onLoadAll
  };
}

export function getPaginationErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

interface PageResultLoadConfig<TItem> {
  readonly state: ApiRequestState<PageResult<TItem>>;
  readonly loading: boolean;
  readonly setLoading: (loading: boolean) => void;
  readonly setError: (error: string | null) => void;
  readonly setState: (state: ApiRequestState<PageResult<TItem>>) => void;
  readonly fetchPage: (cursor: string) => Promise<PageResult<TItem>>;
}

export async function loadPageResult<TItem>(
  mode: PageLoadMode,
  config: PageResultLoadConfig<TItem>
): Promise<void> {
  if (config.loading || config.state.status !== "success" || config.state.data.nextCursor === null) {
    return;
  }

  config.setLoading(true);
  config.setError(null);

  try {
    let nextCursor: string | null = config.state.data.nextCursor;
    let loaded: PageResult<TItem> = config.state.data;

    while (nextCursor !== null) {
      const nextPage = await config.fetchPage(nextCursor);
      loaded = appendPageResult(loaded, nextPage);
      config.setState({ status: "success", data: loaded, error: null });
      nextCursor = nextPage.nextCursor;

      if (mode === "one") {
        break;
      }
    }
  } catch (error: unknown) {
    config.setError(getPaginationErrorMessage(error));
  } finally {
    config.setLoading(false);
  }
}
