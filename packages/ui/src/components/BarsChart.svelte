<script lang="ts">
  import type { ChartPoint, Tone } from "./types.js";

  interface Props {
    readonly title: string;
    readonly points: readonly ChartPoint[];
    readonly tone: Tone;
  }

  const props: Props = $props();

  function barStyle(point: ChartPoint): string {
    return `--ehq-chart-level:${String(point.value)}%;`;
  }
</script>

<section class={`ehq-chart ehq-edge-surface bars tone-${props.tone}`} aria-label={props.title}>
  <div class="title-stack">
    <p class="eyebrow ehq-type-label-mono">Chart</p>
    <h3 class="ehq-type-heading">{props.title}</h3>
  </div>
  <div class="bars-frame">
    {#each props.points as point, index (`${point.label}-${String(index)}`)}
      <span style={barStyle(point)} aria-label={`${point.label}: ${String(point.value)}`}></span>
    {/each}
  </div>
  <div class="labels">
    {#each props.points as point, index (`${point.label}-${String(index)}`)}
      <small>{point.label}</small>
    {/each}
  </div>
</section>

<style>
  .ehq-chart {
    min-height: 190px;
    padding: var(--ehq-space-4);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: grid;
    gap: var(--ehq-space-3);
  }

  h3 {
    margin: 0;
    font-size: var(--ehq-type-section-title-size);
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
    font-size: var(--ehq-type-label-size);
  }

  .bars-frame {
    height: var(--ehq-chart-frame-height);
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    align-items: end;
    gap: var(--ehq-space-2);
  }

  .bars-frame span {
    height: var(--ehq-chart-level);
    min-height: var(--ehq-space-2);
    border-radius: var(--ehq-radius-sm) var(--ehq-radius-sm) 0 0;
    background: var(--ehq-yellow);
  }

  .tone-info .bars-frame span {
    background: var(--ehq-info);
  }

  .tone-success .bars-frame span {
    background: var(--ehq-success);
  }

  .tone-warning .bars-frame span,
  .tone-active .bars-frame span {
    background: var(--ehq-yellow);
  }

  .tone-error .bars-frame span {
    background: var(--ehq-error);
  }

  .tone-muted .bars-frame span {
    background: var(--ehq-border-strong);
  }

  .labels {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: var(--ehq-space-2);
  }

  small {
    min-width: 0;
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    font-weight: var(--ehq-type-label-weight);
    line-height: 1.25;
    overflow-wrap: anywhere;
    text-align: center;
  }
</style>
