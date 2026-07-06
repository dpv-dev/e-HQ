<script lang="ts">
  import type { OperatorAction } from "./types.js";
  import Button from "./Button.svelte";

  interface Props {
    readonly label: string;
    readonly actions: readonly OperatorAction[];
  }

  const props: Props = $props();
</script>

<section class="ehq-action-grid" aria-label={props.label}>
  {#each props.actions as action (action.label)}
    <article class="ehq-edge-surface" class:disabled={action.disabled}>
      <div>
        <p>{action.status}</p>
        <h3>{action.label}</h3>
        <span>{action.detail}</span>
      </div>

      {#if action.href !== null && !action.disabled}
        <a href={action.href}>Open</a>
      {:else}
        <Button
          label={action.disabled ? "Enable writes" : "Open"}
          variant={action.variant}
          size="small"
          type="button"
          disabled={action.disabled}
          loading={false}
          locked={action.disabled}
          focus={false}
          ariaLabel={action.label}
        />
      {/if}
    </article>
  {/each}
</section>

<style>
  .ehq-action-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: var(--ehq-space-3);
  }

  article {
    min-height: 154px;
    padding: var(--ehq-space-4);
    border-radius: var(--ehq-radius-sm);
    display: grid;
    align-content: space-between;
    gap: var(--ehq-space-4);
  }

  article.disabled {
    --ehq-edge-fill: var(--ehq-state-disabled-bg);
    --ehq-edge-border-color: var(--ehq-state-disabled-border);
  }

  p,
  h3,
  span {
    margin: 0;
  }

  p {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  h3 {
    margin-top: var(--ehq-space-2);
    color: var(--ehq-text);
    font-family: var(--ehq-display);
    font-size: var(--ehq-type-section-title-size);
    font-weight: var(--ehq-type-heading-weight);
  }

  span {
    display: block;
    margin-top: var(--ehq-space-2);
    color: var(--ehq-text-soft);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-ui-size);
    line-height: var(--ehq-type-ui-line);
  }

  a {
    width: max-content;
    min-height: 30px;
    padding: 0 var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    color: var(--ehq-text);
    display: inline-flex;
    align-items: center;
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-action-size);
    letter-spacing: 0.08em;
    text-decoration: none;
    text-transform: uppercase;
  }

  a:hover,
  a:focus-visible {
    border-color: var(--ehq-yellow-border);
    outline: 0;
    box-shadow: 0 0 0 3px var(--ehq-yellow-muted);
  }
</style>
