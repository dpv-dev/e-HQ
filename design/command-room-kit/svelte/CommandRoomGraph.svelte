<script lang="ts">
  import type { CommandRoomDataPoint, CommandRoomGraphVariant, CommandRoomTone } from "./types.js";

  interface Props {
    readonly title: string;
    readonly description: string;
    readonly valueLabel: string;
    readonly tone: CommandRoomTone;
    readonly variant: CommandRoomGraphVariant;
    readonly points: readonly CommandRoomDataPoint[];
  }

  const props: Props = $props();

  function validatePercent(value: number, context: string): number {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new RangeError(`${context} must be a finite number from 0 to 100. Received: ${String(value)}`);
    }

    return value;
  }

  function toneColor(tone: CommandRoomTone): string {
    const colors: Record<CommandRoomTone, string> = {
      success: "var(--cr-success)",
      warning: "var(--cr-warning)",
      danger: "var(--cr-danger)",
      info: "var(--cr-info)",
      accent: "var(--cr-accent)",
      neutral: "var(--cr-muted)",
    };

    return colors[tone];
  }

  function linePath(points: readonly CommandRoomDataPoint[]): string {
    if (points.length < 2) {
      throw new RangeError(`Line and area graphs require at least 2 points. Received: ${String(points.length)}`);
    }

    return points
      .map((point: CommandRoomDataPoint, index: number): string => {
        const x: number = 48 + (index / (points.length - 1)) * 742;
        const y: number = 276 - (validatePercent(point.value, `points[${String(index)}].value`) / 100) * 224;
        const command: string = index === 0 ? "M" : "L";
        return `${command}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join("");
  }

  function areaPath(points: readonly CommandRoomDataPoint[]): string {
    return `${linePath(points)}L790 276H48Z`;
  }

  function barStyle(point: CommandRoomDataPoint, index: number): string {
    const height: number = validatePercent(point.value, `points[${String(index)}].value`);
    return `--bar-value:${String(height)}%;--bar-color:${toneColor(point.tone)};`;
  }

  function gaugeStyle(points: readonly CommandRoomDataPoint[]): string {
    const point: CommandRoomDataPoint = gaugePoint(points);
    const value: number = validatePercent(point.value, "points[0].value");
    return `--graph-progress:${String(value)}%;--graph-color:${toneColor(point.tone)};`;
  }

  function gaugePoint(points: readonly CommandRoomDataPoint[]): CommandRoomDataPoint {
    if (points.length !== 1) {
      throw new RangeError(`Gauge graphs require exactly 1 point. Received: ${String(points.length)}`);
    }

    const point: CommandRoomDataPoint | undefined = points[0];
    if (point === undefined) {
      throw new RangeError("Gauge graph point is missing after length validation.");
    }

    return point;
  }

  function funnelStyle(point: CommandRoomDataPoint, index: number): string {
    const opacity: number = 0.2 - index * 0.035;
    return `--step-alpha:${String(Math.max(opacity, 0.04))};--step-color:${toneColor(point.tone)};`;
  }

  function donutBackground(points: readonly CommandRoomDataPoint[]): string {
    const total: number = points.reduce((sum: number, point: CommandRoomDataPoint): number => sum + point.value, 0);
    if (!Number.isFinite(total) || total <= 0) {
      throw new RangeError(`Donut graphs require a positive total. Received: ${String(total)}`);
    }

    let cursor: number = 0;
    const segments: string[] = points.map((point: CommandRoomDataPoint): string => {
      const next: number = cursor + (point.value / total) * 100;
      const segment: string = `${toneColor(point.tone)} ${cursor.toFixed(2)}% ${next.toFixed(2)}%`;
      cursor = next;
      return segment;
    });

    return `background:conic-gradient(${segments.join(",")});`;
  }
</script>

<article class={`cr-svelte-graph cr-svelte-graph--${props.variant} cr-svelte-tone-${props.tone}`}>
  <header>
    <div>
      <h3>{props.title}</h3>
      <p>{props.description}</p>
    </div>
    <strong>{props.valueLabel}</strong>
  </header>

  {#if props.variant === "line" || props.variant === "area"}
    <svg class="cr-svelte-graph__line" viewBox="0 0 820 310" role="img" aria-label={props.title}>
      <path class="grid" d="M48 52H790M48 108H790M48 164H790M48 220H790M48 276H790" />
      <path class="axis" d="M48 36V276H790" />
      {#if props.variant === "area"}
        <path class="area" d={areaPath(props.points)} />
      {/if}
      <path class="line" d={linePath(props.points)} />
    </svg>
  {:else if props.variant === "bars"}
    <div class="cr-svelte-graph__bars">
      {#each props.points as point, index (point.label)}
        <i style={barStyle(point, index)} title={`${point.label}: ${String(point.value)}`}></i>
      {/each}
    </div>
  {:else if props.variant === "gauge"}
    <div class="cr-svelte-graph__gauge" style={gaugeStyle(props.points)}>
      <span>{Math.round(validatePercent(gaugePoint(props.points).value, "points[0].value"))}%</span>
    </div>
  {:else if props.variant === "funnel"}
    <div class="cr-svelte-graph__funnel">
      {#each props.points as point, index (point.label)}
        <div style={funnelStyle(point, index)}>
          <span>{point.label}</span>
          <strong>{point.value}</strong>
        </div>
      {/each}
    </div>
  {:else}
    <div class="cr-svelte-graph__donut" style={donutBackground(props.points)} aria-label={props.title}></div>
  {/if}
</article>

<style>
  .cr-svelte-graph {
    display: grid;
    gap: var(--cr-space-5);
    min-height: 360px;
    padding: var(--cr-space-5);
    border: 1px solid var(--cr-line);
    border-radius: var(--cr-radius-lg);
    color: var(--cr-text);
    background:
      linear-gradient(rgba(255, 255, 255, 0.042) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.032) 1px, transparent 1px),
      var(--cr-surface);
    background-size: 48px 48px;
    box-shadow: var(--cr-shadow-panel), inset 0 1px 0 rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(22px);
  }

  header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--cr-space-4);
  }

  h3,
  p {
    margin: 0;
  }

  h3 {
    font-size: 1.42rem;
    letter-spacing: 0;
  }

  p {
    max-width: 520px;
    margin-top: 8px;
    color: var(--cr-muted);
    line-height: 1.5;
  }

  header > strong {
    color: var(--tone-color);
    font-size: 1.35rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .cr-svelte-graph__line {
    width: 100%;
    height: auto;
    overflow: visible;
  }

  .grid {
    fill: none;
    stroke: var(--cr-chart-grid);
    stroke-width: 1;
  }

  .axis {
    fill: none;
    stroke: var(--cr-chart-axis);
    stroke-width: 1.4;
  }

  .line {
    fill: none;
    stroke: var(--tone-color);
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 4;
    filter: drop-shadow(0 0 8px var(--tone-color));
  }

  .area {
    fill: var(--tone-color);
    opacity: 0.14;
  }

  .cr-svelte-graph__bars {
    display: flex;
    align-items: end;
    gap: 12px;
    height: 210px;
  }

  .cr-svelte-graph__bars i {
    flex: 1;
    height: var(--bar-value);
    min-height: 12px;
    border-radius: 3px 3px 0 0;
    background: linear-gradient(180deg, var(--bar-color), rgba(255, 255, 255, 0.08));
    box-shadow: 0 0 12px color-mix(in srgb, var(--bar-color), transparent 68%);
  }

  .cr-svelte-graph__gauge,
  .cr-svelte-graph__donut {
    position: relative;
    display: grid;
    width: 190px;
    height: 190px;
    place-items: center;
    justify-self: center;
    border-radius: var(--cr-radius-orb);
    box-shadow: var(--cr-shadow-cyan);
  }

  .cr-svelte-graph__gauge {
    background:
      conic-gradient(var(--graph-color) var(--graph-progress), rgba(255, 255, 255, 0.08) 0),
      rgba(2, 7, 10, 0.72);
  }

  .cr-svelte-graph__gauge::before,
  .cr-svelte-graph__donut::before {
    position: absolute;
    width: 108px;
    height: 108px;
    border-radius: inherit;
    content: "";
    background: var(--cr-bg);
  }

  .cr-svelte-graph__gauge span {
    position: relative;
    z-index: 1;
    color: var(--tone-color);
    font-size: 2rem;
    font-weight: 760;
  }

  .cr-svelte-graph__funnel {
    display: grid;
    gap: var(--cr-space-3);
  }

  .cr-svelte-graph__funnel div {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: var(--cr-space-3);
    align-items: center;
    min-height: 54px;
    padding: 0 var(--cr-space-4);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: var(--cr-radius-md);
    background: linear-gradient(90deg, rgba(255, 184, 0, var(--step-alpha)), rgba(255, 255, 255, 0.028));
  }

  .cr-svelte-graph__funnel strong {
    color: var(--step-color);
    font-family: var(--cr-font-mono);
  }

  .cr-svelte-graph__donut {
    position: relative;
  }

  .cr-svelte-tone-success {
    --tone-color: var(--cr-success);
  }

  .cr-svelte-tone-warning {
    --tone-color: var(--cr-warning);
  }

  .cr-svelte-tone-danger {
    --tone-color: var(--cr-danger);
  }

  .cr-svelte-tone-info {
    --tone-color: var(--cr-info);
  }

  .cr-svelte-tone-accent {
    --tone-color: var(--cr-accent);
  }

  .cr-svelte-tone-neutral {
    --tone-color: var(--cr-muted);
  }
</style>
