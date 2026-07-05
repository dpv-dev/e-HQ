<script lang="ts">
  import type { PeriodOption } from "./types.js";

  interface Props {
    readonly label: string;
    readonly options: readonly PeriodOption[];
  }

  const props: Props = $props();
</script>

<section class="ehq-period-bar ehq-edge-surface" aria-label={props.label}>
  <p>{props.label}</p>
  <div>
    {#each props.options as option (option.value)}
      <button type="button" class:active={option.active} disabled={option.disabled}>
        {option.label}
      </button>
    {/each}
  </div>
</section>

<style>
  .ehq-period-bar {
    padding: var(--ehq-space-3);
    border-radius: var(--ehq-radius-sm);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ehq-space-3);
  }

  p {
    margin: 0;
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  div {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ehq-space-2);
  }

  button {
    min-height: 30px;
    padding: 0 var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-bg-main);
    color: var(--ehq-text-soft);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-control-size);
  }

  button:hover:not(:disabled) {
    border-color: var(--ehq-yellow-border);
    color: var(--ehq-text);
  }

  button.active {
    border-color: var(--ehq-yellow-border);
    color: var(--ehq-text);
    box-shadow: 0 0 0 3px var(--ehq-yellow-muted);
  }

  button:disabled {
    color: var(--ehq-text-disabled);
    cursor: not-allowed;
  }

  @media (max-width: 700px) {
    .ehq-period-bar {
      align-items: start;
      flex-direction: column;
    }
  }
</style>
