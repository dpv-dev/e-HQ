<script lang="ts">
  import type { SurfaceState, Tone } from "./types.js";
  import Loader from "./Loader.svelte";
  import { animateNumericText } from "./count-up.js";

  interface Props {
    readonly label: string;
    readonly value: string;
    readonly detail: string;
    readonly tone: Tone;
    readonly state: SurfaceState;
    readonly accent: boolean;
  }

  const props: Props = $props();
  const displayValue = $derived(`${props.state === "locked" ? "× " : ""}${props.value}`);
</script>

<article class={`ehq-kpi ehq-edge-surface ${props.state}`} class:accent={props.accent}>
  {#if props.state === "loading"}
    <Loader label="Loading KPI" detail="" size="small" />
  {:else}
    <p>{props.label}</p>
    <strong use:animateNumericText={displayValue}></strong>
    <span class={`tone-${props.tone}`}>{props.detail}</span>
  {/if}
</article>

<style>
  .ehq-kpi {
    min-height: 118px;
    padding: var(--ehq-space-4);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
  }

  .ehq-kpi.accent {
    --ehq-edge-border-color: var(--ehq-yellow-border);
    --ehq-edge-hairline-opacity: 1;
  }

  .ehq-kpi.hover {
    --ehq-edge-border-color: var(--ehq-yellow-border);
  }

  .ehq-kpi.empty {
    --ehq-edge-border-color: var(--ehq-border-soft);
  }

  .ehq-kpi.error,
  .ehq-kpi.locked {
    --ehq-edge-border-color: var(--ehq-error);
  }

  p,
  span {
    margin: 0;
    font-size: var(--ehq-type-caption-size);
    font-weight: var(--ehq-type-body-weight);
  }

  p {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-weight: var(--ehq-type-label-weight);
    text-transform: uppercase;
  }

  span {
    font-family: var(--ehq-font);
  }

  strong {
    display: block;
    margin: var(--ehq-space-2) 0;
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-kpi-value-size);
    font-weight: var(--ehq-type-figure-weight);
    font-variant-numeric: tabular-nums;
  }

  .locked strong {
    color: var(--ehq-error);
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
</style>
