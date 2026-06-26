<script lang="ts">
  import type { StatusItem } from "./types.js";

  interface Props {
    readonly label: string;
    readonly items: readonly StatusItem[];
  }

  const props: Props = $props();
</script>

<section class="ehq-status-strip" aria-label={props.label}>
  {#each props.items as item (item.label)}
    <article class={`tone-${item.tone}`}>
      <span>{item.label}</span>
      <strong>{item.value}</strong>
    </article>
  {/each}
</section>

<style>
  .ehq-status-strip {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--ehq-space-2);
  }

  article {
    min-height: 68px;
    padding: var(--ehq-space-3);
    border: 1px solid var(--ehq-border-soft);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-surface);
    display: grid;
    align-content: center;
    gap: var(--ehq-space-1);
  }

  span,
  strong {
    margin: 0;
  }

  span {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  strong {
    color: var(--ehq-text);
    font-family: var(--ehq-font);
    font-size: 15px;
    font-weight: var(--ehq-type-heading-weight);
  }

  .tone-success {
    border-color: rgba(34,197,94,.28);
    background: var(--ehq-success-bg);
  }

  .tone-info {
    border-color: rgba(59,130,246,.28);
    background: var(--ehq-info-bg);
  }

  .tone-warning,
  .tone-active {
    border-color: var(--ehq-yellow-border);
    background: var(--ehq-yellow-muted);
  }

  .tone-error {
    border-color: rgba(255,59,48,.34);
    background: var(--ehq-error-bg);
  }

  .tone-muted {
    background: var(--ehq-state-empty-bg);
  }
</style>
