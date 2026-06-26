<script lang="ts">
  import type { SurfaceState } from "./types.js";
  import Button from "./Button.svelte";
  import Loader from "./Loader.svelte";

  interface Props {
    readonly title: string;
    readonly subtitle: string;
    readonly body: string;
    readonly state: SurfaceState;
    readonly primaryAction: string;
    readonly secondaryAction: string;
  }

  const props: Props = $props();
</script>

<section class={`ehq-panel ehq-edge-surface ${props.state}`}>
  {#if props.state === "loading"}
    <Loader label="Loading panel" detail={props.subtitle} size="medium" />
  {:else}
    <header>
      <p class="eyebrow ehq-type-label-mono">Panel</p>
      <h3 class="ehq-type-heading">{props.state === "locked" ? "× " : ""}{props.title}</h3>
      <p class="subtitle ehq-type-body">{props.subtitle}</p>
    </header>
    <div class="body">{props.body}</div>
    <footer>
      {#if props.secondaryAction.length > 0}
        <Button label={props.secondaryAction} variant="secondary" size="small" type="button" disabled={false} loading={false} locked={false} focus={false} ariaLabel={props.secondaryAction} />
      {/if}
      {#if props.primaryAction.length > 0}
        <Button label={props.primaryAction} variant={props.state === "error" ? "danger" : "primary"} size="small" type="button" disabled={props.state === "empty"} loading={false} locked={props.state === "locked"} focus={false} ariaLabel={props.primaryAction} />
      {/if}
    </footer>
  {/if}
</section>

<style>
  .ehq-panel {
    min-height: 170px;
    padding: var(--ehq-space-4);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: grid;
    gap: var(--ehq-space-3);
  }

  .ehq-panel.hover {
    --ehq-edge-border-color: var(--ehq-yellow-border);
  }

  .ehq-panel.empty {
    --ehq-edge-border-color: var(--ehq-border-soft);
  }

  .ehq-panel.error,
  .ehq-panel.locked {
    --ehq-edge-border-color: var(--ehq-error);
  }

  h3,
  p {
    margin: 0;
  }

  h3 {
    font-size: var(--ehq-h3);
  }

  .locked h3 {
    color: var(--ehq-error);
  }

  .eyebrow {
    margin-top: var(--ehq-space-1);
    font-size: 11px;
  }

  .subtitle {
    margin-top: var(--ehq-space-1);
    color: var(--ehq-text-muted);
    font-size: 11px;
  }

  .body {
    color: var(--ehq-text-soft);
    font-family: var(--ehq-font);
    font-size: 13px;
    font-weight: var(--ehq-type-body-weight);
    line-height: 1.6;
  }

  footer {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ehq-space-2);
  }
</style>
