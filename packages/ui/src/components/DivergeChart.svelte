<script lang="ts">
  import type { DivergePoint } from "./types.js";

  interface Props {
    readonly title: string;
    readonly points: readonly DivergePoint[];
  }

  const props: Props = $props();

  function negativeStyle(point: DivergePoint): string {
    return `--ehq-chart-level:${String(point.negative)}%;`;
  }

  function positiveStyle(point: DivergePoint): string {
    return `--ehq-chart-level:${String(point.positive)}%;`;
  }
</script>

<section class="ehq-chart ehq-edge-surface diverge" aria-label={props.title}>
  <div class="title-stack">
    <p class="eyebrow ehq-type-label-mono">Chart</p>
    <h3 class="ehq-type-heading">{props.title}</h3>
  </div>
  <div class="rows">
    {#each props.points as point, index (`${point.label}-${String(index)}`)}
      <div class="row">
        <span>{point.label}</span>
        <div class="track">
          <i class="negative" style={negativeStyle(point)}></i>
          <i class="positive" style={positiveStyle(point)}></i>
        </div>
      </div>
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
    font-size: var(--ehq-h3);
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

  .rows {
    display: grid;
    gap: var(--ehq-space-3);
  }

  .row {
    display: grid;
    grid-template-columns: 64px minmax(0, 1fr);
    align-items: center;
    gap: var(--ehq-space-3);
  }

  span {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-label-size);
    font-weight: var(--ehq-type-body-weight);
  }

  .track {
    height: 18px;
    background: linear-gradient(90deg, transparent 49%, var(--ehq-border) 49%, var(--ehq-border) 51%, transparent 51%);
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--ehq-space-1);
  }

  i {
    height: 100%;
    border-radius: var(--ehq-radius-sm);
  }

  .negative {
    justify-self: end;
    width: var(--ehq-chart-level);
    background: var(--ehq-error);
  }

  .positive {
    justify-self: start;
    width: var(--ehq-chart-level);
    background: var(--ehq-success);
  }
</style>
