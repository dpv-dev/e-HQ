<script lang="ts">
  import type { ChartPoint, Tone } from "./types.js";

  interface Props {
    readonly title: string;
    readonly points: readonly ChartPoint[];
    readonly tone: Tone;
  }

  const props: Props = $props();

  function pointStyle(point: ChartPoint, index: number): string {
    const left = props.points.length <= 1 ? 50 : (index / (props.points.length - 1)) * 100;
    return `--ehq-chart-left:${String(left)}%;--ehq-chart-bottom:${String(point.value)}%;`;
  }
</script>

<section class={`ehq-chart ehq-edge-surface line tone-${props.tone}`} aria-label={props.title}>
  <div class="title-stack">
    <p class="eyebrow ehq-type-label-mono">Chart</p>
    <h3 class="ehq-type-heading">{props.title}</h3>
  </div>
  <div class="line-frame">
    <span class="axis"></span>
    {#each props.points as point, index (point.label)}
      <i style={pointStyle(point, index)} aria-label={`${point.label}: ${String(point.value)}`}></i>
    {/each}
  </div>
  <div class="caption">
    <span>{props.points[0]?.label}</span>
    <span>{props.points[props.points.length - 1]?.label}</span>
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

  .line-frame {
    position: relative;
    height: 104px;
    border-bottom: 1px solid var(--ehq-border);
    border-left: 1px solid var(--ehq-border);
  }

  .axis {
    position: absolute;
    inset: auto 0 52% 0;
    height: 1px;
    background: var(--ehq-border-soft);
  }

  i {
    position: absolute;
    left: var(--ehq-chart-left);
    bottom: var(--ehq-chart-bottom);
    width: 10px;
    height: 10px;
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-yellow);
    box-shadow: 0 0 0 4px var(--ehq-yellow-muted);
    transform: translate(-50%, 50%);
  }

  .tone-info i {
    background: var(--ehq-info);
    box-shadow: 0 0 0 4px var(--ehq-info-bg);
  }

  .tone-success i {
    background: var(--ehq-success);
    box-shadow: 0 0 0 4px var(--ehq-success-bg);
  }

  .tone-error i {
    background: var(--ehq-error);
    box-shadow: 0 0 0 4px var(--ehq-error-bg);
  }

  .tone-muted i {
    background: var(--ehq-border-strong);
    box-shadow: 0 0 0 4px var(--ehq-surface-high);
  }

  .caption {
    display: flex;
    justify-content: space-between;
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    font-weight: var(--ehq-type-label-weight);
  }
</style>
