<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Tone, WorkspaceKind } from "./types.js";
  import Badge from "./Badge.svelte";

  interface Props {
    readonly workspace: WorkspaceKind;
    readonly eyebrow: string;
    readonly title: string;
    readonly description: string;
    readonly meta: string;
    readonly statusLabel: string;
    readonly statusTone: Tone;
    readonly actions?: Snippet;
  }

  const props: Props = $props();
</script>

<header class={`ehq-page-header ehq-workspace-${props.workspace}`}>
  <div class="copy">
    <p>{props.eyebrow}</p>
    <h1>{props.title}</h1>
    <span>{props.description}</span>
    {#if props.meta.length > 0}
      <small>{props.meta}</small>
    {/if}
  </div>

  <div class="header-side">
    {#if props.statusLabel.length > 0}
      <Badge label={props.statusLabel} tone={props.statusTone} />
    {/if}
    {#if props.actions}
      <div class="actions">
        {@render props.actions()}
      </div>
    {/if}
  </div>
</header>

<style>
  .ehq-page-header {
    min-height: 126px;
    padding: var(--ehq-space-5) 0;
    border-bottom: 1px solid var(--ehq-border-soft);
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: var(--ehq-space-5);
  }

  .copy {
    min-width: 0;
    display: grid;
    gap: var(--ehq-space-2);
  }

  p,
  h1,
  span,
  small {
    margin: 0;
  }

  p {
    color: var(--ehq-workspace-accent);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-caption-size);
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  h1 {
    color: var(--ehq-type-page-title-color);
    font-family: var(--ehq-display);
    font-size: var(--ehq-type-page-title-size);
    font-weight: var(--ehq-type-display-weight);
    line-height: var(--ehq-type-page-title-line);
    letter-spacing: 0;
  }

  span {
    max-width: 760px;
    color: var(--ehq-text-soft);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-ui-size);
    line-height: var(--ehq-type-ui-line);
  }

  small {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-caption-size);
  }

  .header-side {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: var(--ehq-space-3);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: var(--ehq-space-2);
  }

  @media (max-width: 780px) {
    .ehq-page-header {
      align-items: start;
      flex-direction: column;
    }

    .header-side,
    .actions {
      justify-content: flex-start;
    }
  }
</style>
