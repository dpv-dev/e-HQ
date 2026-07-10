<script lang="ts">
  import type { Tone, TableColumn, TablePagination, TableRow, TableRowAction, TableState } from "./types.js";
  import Badge from "./Badge.svelte";
  import Button from "./Button.svelte";
  import Loader from "./Loader.svelte";

  interface Props {
    readonly title: string;
    readonly columns: readonly TableColumn[];
    readonly rows: readonly TableRow[];
    readonly state: TableState;
    readonly actionLabel: string;
    // Optional per-row action buttons (e.g. "Éditer", "Annuler"): rendered in a trailing
    // column, each calling its onAction with the row id. Absent on most tables.
    readonly rowActions?: readonly TableRowAction[];
    readonly pagination?: TablePagination | null;
  }

  const props: Props = $props();

  const hasRowActions = $derived((props.rowActions?.length ?? 0) > 0);
  const pagination = $derived(props.pagination ?? null);
  const showPagination = $derived(pagination !== null && props.state === "default");
  const AUTO_ROWS_PER_PAGE = 15;
  let localPage = $state(1);

  const paginationDetail = $derived(pagination === null
    ? ""
    : pagination.hasMore
      ? `${String(pagination.loadedCount)} rows loaded. More rows are available.`
      : `${String(pagination.loadedCount)} rows loaded. All rows are visible.`
  );

  // Money cells follow the tone the caller assigns (usually sign-based via
  // moneyToneForValue): positive → green, negative → red, zero/neutral → muted.
  function moneyTone(tone: Tone): string {
    return `money tone-${tone}`;
  }

  function rowKey(row: TableRow, index: number): string {
    return `${row.id}:${String(index)}`;
  }

  // Client-side column sorting over the loaded rows. Cell values are display strings,
  // so the comparator is type-aware: dd/mm/yyyy dates compare chronologically, money and
  // plain numbers compare numerically, everything else compares as locale text.
  let sortColumnIndex = $state<number | null>(null);
  let sortDirection = $state<"asc" | "desc">("asc");

  const sortedRows = $derived(sortRows(props.rows, sortColumnIndex, sortDirection));
  const showNumberedPagination = $derived(props.state === "default" && sortedRows.length > AUTO_ROWS_PER_PAGE);
  const totalLocalPages = $derived(Math.max(1, Math.ceil(sortedRows.length / AUTO_ROWS_PER_PAGE)));
  const localPageRows = $derived(
    showNumberedPagination
      ? sortedRows.slice((localPage - 1) * AUTO_ROWS_PER_PAGE, localPage * AUTO_ROWS_PER_PAGE)
      : sortedRows
  );
  const localPageNumbers = $derived(Array.from({ length: totalLocalPages }, (_, index: number): number => index + 1));
  const showFooter = $derived(props.state === "default" && (showPagination || showNumberedPagination));
  const localPaginationDetail = $derived(
    showNumberedPagination
      ? `${String((localPage - 1) * AUTO_ROWS_PER_PAGE + 1)}-${String(Math.min(localPage * AUTO_ROWS_PER_PAGE, sortedRows.length))} of ${String(sortedRows.length)} rows.`
      : `${String(sortedRows.length)} rows.`
  );

  $effect((): void => {
    if (!showNumberedPagination) {
      localPage = 1;
      return;
    }

    if (localPage > totalLocalPages) {
      localPage = totalLocalPages;
      return;
    }

    if (localPage < 1) {
      localPage = 1;
    }
  });

  function toggleSort(columnIndex: number): void {
    if (props.columns[columnIndex]?.sortable !== true) {
      return;
    }
    if (sortColumnIndex === columnIndex) {
      sortDirection = sortDirection === "asc" ? "desc" : "asc";
      return;
    }
    sortColumnIndex = columnIndex;
    sortDirection = "asc";
  }

  function goToLocalPage(page: number): void {
    if (!Number.isInteger(page) || page < 1 || page > totalLocalPages) {
      return;
    }

    localPage = page;
  }

  function sortRows(rows: readonly TableRow[], columnIndex: number | null, direction: "asc" | "desc"): readonly TableRow[] {
    if (columnIndex === null) {
      return rows;
    }
    const sorted = [...rows].sort((left: TableRow, right: TableRow): number =>
      compareCellValues(cellTextAt(left, columnIndex), cellTextAt(right, columnIndex))
    );
    return direction === "asc" ? sorted : sorted.reverse();
  }

  function cellTextAt(row: TableRow, columnIndex: number): string {
    return row.cells[columnIndex]?.value ?? "";
  }

  const DAY_FIRST_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/u;

  function compareCellValues(left: string, right: string): number {
    const leftDate = DAY_FIRST_DATE.exec(left);
    const rightDate = DAY_FIRST_DATE.exec(right);
    if (leftDate !== null && rightDate !== null) {
      const leftKey = `${leftDate[3] ?? ""}${leftDate[2] ?? ""}${leftDate[1] ?? ""}`;
      const rightKey = `${rightDate[3] ?? ""}${rightDate[2] ?? ""}${rightDate[1] ?? ""}`;
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    }
    const leftNumber = numericCellValue(left);
    const rightNumber = numericCellValue(right);
    if (leftNumber !== null && rightNumber !== null) {
      return leftNumber - rightNumber;
    }
    return left.localeCompare(right, undefined, { sensitivity: "base", numeric: true });
  }

  function numericCellValue(value: string): number | null {
    const cleaned = value.replace(/[^0-9.eE+-]/gu, "");
    if (cleaned.length === 0 || !/\d/u.test(cleaned)) {
      return null;
    }
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
</script>

<section class={`ehq-table-shell ehq-edge-surface ${props.state}`} aria-label={props.title}>
  <header>
    <div class="title-stack">
      <p class="eyebrow ehq-type-label-mono">Table</p>
      <h3 class="ehq-type-heading">{props.title}</h3>
    </div>
    {#if props.actionLabel.length > 0}
      <Button
        label={props.actionLabel}
        variant="secondary"
        size="small"
        type="button"
        disabled={props.state !== "default"}
        loading={props.state === "loading"}
        locked={props.state === "locked"}
        focus={false}
        ariaLabel={props.actionLabel}
      />
    {/if}
  </header>

  {#if props.state === "loading"}
    <div class="state-card">
      <Loader label="Loading table" detail="Rows are being prepared." size="medium" />
    </div>
  {:else if props.state === "empty"}
    <div class="state-card">
      <strong>No rows</strong>
      <span>No data matches the current filters.</span>
    </div>
  {:else if props.state === "error"}
    <div class="state-card error-copy">
      <strong>Table unavailable</strong>
      <span>The request failed and the current context is still visible.</span>
    </div>
  {:else if props.state === "locked"}
    <div class="state-card locked-copy">
      <strong>× Locked table</strong>
      <span>Access can be requested without hiding the workspace.</span>
    </div>
  {:else}
    <div class="table-frame">
      <table>
        <thead>
          <tr>
            {#each props.columns as column, columnIndex (column.label)}
              <th class:right={column.align === "right"} aria-sort={sortColumnIndex === columnIndex ? (sortDirection === "asc" ? "ascending" : "descending") : undefined}>
                {#if column.sortable}
                  <button type="button" class="sort-header" onclick={() => toggleSort(columnIndex)}>
                    {column.label}
                    <span class="sort-glyph" class:active={sortColumnIndex === columnIndex} aria-hidden="true">{sortColumnIndex === columnIndex ? (sortDirection === "asc" ? "↑" : "↓") : "↕"}</span>
                  </button>
                {:else}
                  {column.label}
                {/if}
              </th>
            {/each}
            {#if hasRowActions}
              <th class="right" aria-label="Actions"></th>
            {/if}
          </tr>
        </thead>
        <tbody>
          {#each localPageRows as row, index (rowKey(row, index))}
            <tr>
              {#each row.cells as cell}
                <td class:right={cell.kind === "money"}>
                  {#if cell.kind === "text"}
                    <span class:strong={cell.strong}>{cell.value}</span>
                  {:else if cell.kind === "money"}
                    <span class={moneyTone(cell.tone)}>{cell.value}</span>
                  {:else if cell.kind === "badge"}
                    <Badge label={cell.value} tone={cell.tone} />
                  {:else}
                    <Badge label={cell.value} tone={cell.tone} />
                  {/if}
                </td>
              {/each}
              {#if hasRowActions}
                <td class="right">
                  <div class="row-actions">
                    {#each props.rowActions ?? [] as action (action.label)}
                      <button type="button" class="ehq-row-action" class:danger={action.danger} onclick={() => action.onAction(row.id)}>
                        {action.label}
                      </button>
                    {/each}
                  </div>
                </td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if showFooter}
      <footer class="table-pagination" aria-label="Table pagination">
        <div class="pagination-info">
          <span>{localPaginationDetail}</span>
          {#if showPagination && pagination !== null}
            <span>{paginationDetail}</span>
          {/if}
          {#if showPagination && pagination !== null && pagination.error !== null}
            <small>{pagination.error}</small>
          {/if}
        </div>
        <div class="pagination-actions">
          {#if showNumberedPagination}
            <div class="pagination-numbers" aria-label="Local table pages">
              <button type="button" class="page-button" disabled={localPage <= 1} onclick={() => goToLocalPage(localPage - 1)} aria-label="Previous page">
                Prev
              </button>
              {#each localPageNumbers as pageNumber (pageNumber)}
                <button type="button" class="page-button" class:active={pageNumber === localPage} onclick={() => goToLocalPage(pageNumber)} aria-label={`Page ${String(pageNumber)}`}>
                  {pageNumber}
                </button>
              {/each}
              <button type="button" class="page-button" disabled={localPage >= totalLocalPages} onclick={() => goToLocalPage(localPage + 1)} aria-label="Next page">
                Next
              </button>
            </div>
          {/if}
          {#if showPagination && pagination !== null && pagination.hasMore}
            <Button
              label={pagination.loading ? "Loading..." : "Load more"}
              variant="secondary"
              size="small"
              type="button"
              disabled={false}
              loading={pagination.loading}
              locked={false}
              focus={false}
              ariaLabel="Load more rows"
              onclick={pagination.onLoadMore}
            />
            <Button
              label={pagination.loading ? "Loading..." : "Load all"}
              variant="secondary"
              size="small"
              type="button"
              disabled={false}
              loading={pagination.loading}
              locked={false}
              focus={false}
              ariaLabel="Load all rows"
              onclick={pagination.onLoadAll}
            />
          {/if}
        </div>
      </footer>
    {/if}
  {/if}
</section>

<style>
  .ehq-table-shell {
    min-width: 0;
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    overflow: visible;
  }

  header {
    padding: var(--ehq-space-3);
    border-bottom: 1px solid var(--ehq-border-soft);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ehq-space-3);
  }

  h3 {
    margin: 0;
    font-size: var(--ehq-type-section-title-size);
  }

  .title-stack,
  .eyebrow {
    margin: 0;
  }

  .title-stack {
    display: grid;
    gap: var(--ehq-space-1);
  }

  .eyebrow {
    font-size: var(--ehq-type-label-size);
  }

  .table-frame {
    width: 100%;
    overflow-x: auto;
  }

  .table-pagination {
    padding: var(--ehq-space-3);
    border-top: 1px solid var(--ehq-border-soft);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ehq-space-3);
  }

  .table-pagination span,
  .table-pagination small {
    color: var(--ehq-text-soft);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-ui-size);
    line-height: var(--ehq-type-ui-line);
  }

  .table-pagination small {
    color: var(--ehq-error);
  }

  .pagination-actions {
    display: flex;
    gap: var(--ehq-space-2);
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .pagination-info {
    display: grid;
    gap: var(--ehq-space-1);
  }

  .pagination-numbers {
    display: flex;
    align-items: center;
    gap: var(--ehq-space-1);
    flex-wrap: wrap;
  }

  .page-button {
    appearance: none;
    border: 1px solid var(--ehq-border-soft);
    border-radius: var(--ehq-radius-xs);
    background: transparent;
    color: var(--ehq-text-soft);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    line-height: 1;
    padding: calc(var(--ehq-space-1) - 1px) var(--ehq-space-2);
    cursor: pointer;
  }

  .page-button:hover:not(:disabled) {
    color: var(--ehq-text);
    border-color: var(--ehq-border);
  }

  .page-button.active {
    color: var(--ehq-text);
    border-color: var(--ehq-yellow);
  }

  .page-button:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  table {
    width: 100%;
    min-width: 560px;
    border-collapse: collapse;
  }

  th,
  td {
    padding: var(--ehq-space-3);
    border-bottom: 1px solid var(--ehq-border-soft);
    text-align: left;
    vertical-align: middle;
  }

  th {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    font-weight: var(--ehq-type-label-weight);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .sort-header {
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: var(--ehq-space-1);
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
  }

  .sort-header:hover {
    color: var(--ehq-text);
  }

  .sort-glyph {
    opacity: 0.5;
  }

  .sort-glyph.active {
    color: var(--ehq-yellow);
    opacity: 1;
  }

  td {
    color: var(--ehq-text-white);
    font-family: var(--ehq-font);
    font-size: 14px;
    font-weight: var(--ehq-type-body-weight);
    line-height: var(--ehq-type-ui-line);
  }

  tr:last-child td {
    border-bottom: 0;
  }

  .right {
    text-align: right;
  }

  .strong {
    font-weight: var(--ehq-type-body-weight);
  }

  .row-actions {
    display: flex;
    gap: var(--ehq-space-2);
    justify-content: flex-end;
  }

  .ehq-row-action {
    appearance: none;
    cursor: pointer;
    border: 1px solid var(--ehq-border-soft);
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    color: var(--ehq-text-soft);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    padding: var(--ehq-space-1) var(--ehq-space-2);
    white-space: nowrap;
  }

  .ehq-row-action:hover {
    color: var(--ehq-text);
    border-color: var(--ehq-border);
  }

  .ehq-row-action.danger:hover {
    color: var(--ehq-error);
    border-color: var(--ehq-error);
  }

  .money {
    font-family: var(--ehq-font);
    font-weight: var(--ehq-type-figure-weight);
    font-variant-numeric: tabular-nums;
  }

  .tone-success {
    color: var(--ehq-success);
  }

  .tone-warning,
  .tone-active {
    color: var(--ehq-text-soft);
  }

  .tone-error {
    color: var(--ehq-error);
  }

  .tone-info {
    color: var(--ehq-info);
  }

  .tone-muted {
    color: var(--ehq-text-muted);
  }

  .state-card {
    min-height: 180px;
    padding: var(--ehq-space-5);
    display: grid;
    place-items: center;
    gap: var(--ehq-space-2);
    text-align: center;
  }

  .state-card strong {
    font-size: var(--ehq-type-section-title-size);
    font-weight: var(--ehq-type-heading-weight);
  }

  .state-card span {
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-ui-size);
  }

  .error-copy strong,
  .locked-copy strong {
    color: var(--ehq-error);
  }

  @media (max-width: 760px) {
    .table-pagination {
      align-items: stretch;
      flex-direction: column;
    }

    .pagination-actions {
      justify-content: stretch;
    }
  }
</style>
