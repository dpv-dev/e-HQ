<script lang="ts">
  import type { ToolbarFilter } from "./types.js";
  import Button from "./Button.svelte";

  interface Props {
    readonly label: string;
    readonly filters: readonly ToolbarFilter[];
    readonly actionLabel: string;
    readonly loading: boolean;
    readonly onFilterSelect?: ((filter: ToolbarFilter) => void) | null;
    readonly onActionSelect?: (() => void) | null;
  }

  const props: Props = $props();

  function selectFilter(filter: ToolbarFilter): void {
    if (filter.disabled || props.onFilterSelect === undefined || props.onFilterSelect === null) {
      return;
    }

    props.onFilterSelect(filter);
  }

  function selectAction(): void {
    if (props.onActionSelect === undefined || props.onActionSelect === null) {
      return;
    }

    props.onActionSelect();
  }
</script>

<section class="ehq-toolbar ehq-edge-surface" aria-label={props.label}>
  {#each props.filters as filter (filter.label)}
    <button
      class="ehq-toolbar-filter"
      class:active={filter.active}
      type="button"
      disabled={filter.disabled}
      aria-pressed={filter.active}
      title={filter.title}
      onclick={() => selectFilter(filter)}
    >
      <span>{filter.label}</span>
      <strong>{filter.value}</strong>
    </button>
  {/each}
  {#if props.actionLabel.length > 0}
    <div class="action">
      <Button label={props.actionLabel} variant="primary" size="small" type="button" disabled={false} loading={props.loading} locked={false} focus={false} ariaLabel={props.actionLabel} onclick={selectAction} />
    </div>
  {/if}
</section>

<style>
  .ehq-toolbar {
    padding: var(--ehq-space-3);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: flex;
    flex-wrap: wrap;
    align-items: end;
    gap: var(--ehq-space-2);
  }

  .ehq-toolbar-filter {
    min-height: 42px;
    min-width: 128px;
    padding: var(--ehq-space-2) var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-bg-main);
    color: var(--ehq-text);
    display: grid;
    justify-items: start;
    gap: var(--ehq-space-1);
  }

  .ehq-toolbar-filter.active {
    border-color: var(--ehq-yellow-border);
    box-shadow: 0 0 0 3px var(--ehq-yellow-muted);
  }

  .ehq-toolbar-filter:disabled {
    color: var(--ehq-text-disabled);
    cursor: not-allowed;
  }

  span {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    font-weight: var(--ehq-type-label-weight);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  strong {
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-ui-size);
    font-weight: var(--ehq-type-body-weight);
  }

  .action {
    margin-left: auto;
  }
</style>
