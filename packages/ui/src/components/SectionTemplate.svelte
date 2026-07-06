<script lang="ts">
  import type { Snippet } from "svelte";
  import type { OperatorState } from "./types.js";
  import EmptyState from "./EmptyState.svelte";

  interface Props {
    readonly title: string;
    readonly eyebrow: string;
    readonly detail: string;
    readonly state: OperatorState;
    readonly action?: Snippet;
    readonly children?: Snippet;
  }

  const props: Props = $props();
</script>

<section class="ehq-section-template ehq-operator-section">
  <header>
    <div>
      <p>{props.eyebrow}</p>
      <h2>{props.title}</h2>
      {#if props.detail.length > 0}
        <span>{props.detail}</span>
      {/if}
    </div>
    {#if props.action}
      <div class="section-action">
        {@render props.action()}
      </div>
    {/if}
  </header>

  {#if props.state === "ready"}
    {#if props.children}
      {@render props.children()}
    {/if}
  {:else}
    <EmptyState
      title={props.title}
      detail={props.detail.length > 0 ? props.detail : "No data matches the current filters."}
      state={props.state}
      actionLabel=""
      actionHref={null}
      disabledReason=""
    />
  {/if}
</section>

<style>
  .ehq-section-template {
    min-width: 0;
  }

  header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--ehq-space-4);
  }

  p,
  h2,
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

  h2 {
    margin-top: var(--ehq-space-1);
    color: var(--ehq-text);
    font-family: var(--ehq-display);
    font-size: var(--ehq-type-section-title-size);
    font-weight: var(--ehq-type-heading-weight);
    letter-spacing: 0;
  }

  span {
    display: block;
    margin-top: var(--ehq-space-1);
    color: var(--ehq-text-muted);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-ui-size);
    line-height: var(--ehq-type-ui-line);
  }

  .section-action {
    display: flex;
    justify-content: flex-end;
  }

  @media (max-width: 720px) {
    header {
      align-items: start;
      flex-direction: column;
    }

    .section-action {
      justify-content: flex-start;
    }
  }
</style>
