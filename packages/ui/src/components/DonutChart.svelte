<script lang="ts">
  import type { Tone } from "./types.js";

  interface Props {
    readonly title: string;
    readonly value: number;
    readonly label: string;
    readonly tone: Tone;
  }

  const props: Props = $props();
  const donutStyle = $derived(`--ehq-donut-value:${String(props.value)}%;`);
</script>

<section class={`ehq-chart ehq-edge-surface donut tone-${props.tone}`} aria-label={props.title}>
  <div class="title-stack">
    <p class="eyebrow ehq-type-label-mono">Chart</p>
    <h3 class="ehq-type-heading">{props.title}</h3>
  </div>
  <div class="donut-ring" style={donutStyle}>
    <strong>{props.value}%</strong>
  </div>
  <p>{props.label}</p>
</section>

<style>
  .ehq-chart {
    min-height: 190px;
    padding: var(--ehq-space-4);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: grid;
    justify-items: center;
    gap: var(--ehq-space-3);
    text-align: center;
  }

  h3,
  p {
    margin: 0;
  }

  h3 {
    justify-self: start;
    font-size: var(--ehq-h3);
  }

  .title-stack,
  .eyebrow {
    margin: 0;
  }

  .title-stack {
    justify-self: start;
    display: grid;
    gap: var(--ehq-space-1);
  }

  .eyebrow {
    font-size: 10px;
  }

  .donut-ring {
    width: 112px;
    aspect-ratio: 1;
    border-radius: var(--ehq-radius-pill);
    background: conic-gradient(var(--ehq-yellow) var(--ehq-donut-value), var(--ehq-surface-high) 0);
    display: grid;
    place-items: center;
  }

  .tone-info .donut-ring {
    background: conic-gradient(var(--ehq-info) var(--ehq-donut-value), var(--ehq-surface-high) 0);
  }

  .tone-success .donut-ring {
    background: conic-gradient(var(--ehq-success) var(--ehq-donut-value), var(--ehq-surface-high) 0);
  }

  .tone-error .donut-ring {
    background: conic-gradient(var(--ehq-error) var(--ehq-donut-value), var(--ehq-surface-high) 0);
  }

  strong {
    width: 76px;
    aspect-ratio: 1;
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-surface);
    color: var(--ehq-text);
    display: grid;
    place-items: center;
    font-family: var(--ehq-font);
    font-size: 20px;
    font-weight: var(--ehq-type-figure-weight);
    font-variant-numeric: tabular-nums;
  }

  p {
    color: var(--ehq-text-soft);
    font-family: var(--ehq-font);
    font-size: 13px;
    font-weight: var(--ehq-type-body-weight);
  }
</style>
