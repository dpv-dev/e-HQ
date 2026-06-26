<script lang="ts">
  import type { Tone, TableCell, TableColumn, TableRow, TableState } from "./types.js";
  import Badge from "./Badge.svelte";
  import Button from "./Button.svelte";
  import Loader from "./Loader.svelte";

  interface Props {
    readonly title: string;
    readonly columns: readonly TableColumn[];
    readonly rows: readonly TableRow[];
    readonly state: TableState;
    readonly actionLabel: string;
  }

  const props: Props = $props();

  function moneyTone(tone: Tone): string {
    return `money tone-${tone}`;
  }

  function rowKey(row: TableRow, index: number): string {
    return `${row.id}:${String(index)}`;
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
      <span>Nothing matches the current filters.</span>
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
            {#each props.columns as column (column.label)}
              <th class:right={column.align === "right"}>
                {column.label}{column.sortable ? " ↑" : ""}
              </th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each props.rows as row, index (rowKey(row, index))}
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
                    <Button
                      label={cell.value}
                      variant={cell.tone === "error" ? "danger" : "secondary"}
                      size="small"
                      type="button"
                      disabled={false}
                      loading={false}
                      locked={cell.locked}
                      focus={cell.tone === "active"}
                      ariaLabel={cell.value}
                    />
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
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
    font-size: var(--ehq-h3);
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
    font-size: 10px;
  }

  .table-frame {
    width: 100%;
    overflow-x: auto;
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
    font-size: 10px;
    font-weight: var(--ehq-type-label-weight);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  td {
    color: var(--ehq-text);
    font-family: var(--ehq-font);
    font-size: 13px;
    font-weight: var(--ehq-type-body-weight);
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
    font-size: var(--ehq-h3);
    font-weight: var(--ehq-type-heading-weight);
  }

  .state-card span {
    color: var(--ehq-text-muted);
    font-size: 13px;
  }

  .error-copy strong,
  .locked-copy strong {
    color: var(--ehq-error);
  }
</style>
