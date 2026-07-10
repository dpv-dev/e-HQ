<script lang="ts">
  import type { CommandRoomDataPoint, CommandRoomKpiVariant, CommandRoomTone } from "./types.js";

  interface Props {
    readonly label: string;
    readonly value: string;
    readonly detail: string;
    readonly delta: string;
    readonly period: string;
    readonly tone: CommandRoomTone;
    readonly variant: CommandRoomKpiVariant;
    readonly progressPercent: number;
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

  function sparklinePath(points: readonly CommandRoomDataPoint[]): string {
    if (points.length < 2) {
      return "";
    }

    return points
      .map((point: CommandRoomDataPoint, index: number): string => {
        const x: number = (index / (points.length - 1)) * 118;
        const y: number = 34 - (validatePercent(point.value, `points[${String(index)}].value`) / 100) * 30;
        const command: string = index === 0 ? "M" : "L";
        return `${command}${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join("");
  }

  function ringStyle(percent: number, tone: CommandRoomTone): string {
    const validatedPercent: number = validatePercent(percent, "progressPercent");
    return `--ring-value:${String(validatedPercent)}%;--ring-color:${toneColor(tone)};`;
  }
</script>

<article class={`cr-svelte-kpi cr-svelte-kpi--${props.variant} cr-svelte-tone-${props.tone}`}>
  {#if props.variant === "orbit"}
    <div class="cr-svelte-kpi__ring" style={ringStyle(props.progressPercent, props.tone)}>
      <span>{Math.round(validatePercent(props.progressPercent, "progressPercent"))}</span>
    </div>
  {/if}

  <div class="cr-svelte-kpi__topline">
    <span>{props.label}</span>
    <span>{props.period}</span>
  </div>

  <strong>{props.value}</strong>

  <div class="cr-svelte-kpi__footer">
    <span class="cr-svelte-kpi__delta">{props.delta}</span>
    {#if props.points.length > 1}
      <svg viewBox="0 0 118 38" aria-hidden="true">
        <path d={sparklinePath(props.points)} />
      </svg>
    {:else}
      <span>{props.detail}</span>
    {/if}
  </div>
</article>

<style>
  .cr-svelte-kpi {
    position: relative;
    display: grid;
    align-content: space-between;
    min-height: 150px;
    padding: 18px;
    border: 1px solid var(--cr-line);
    border-radius: var(--cr-radius-lg);
    overflow: hidden;
    color: var(--cr-text);
    background:
      radial-gradient(circle at 86% 18%, rgba(124, 236, 255, 0.075), transparent 4.5rem),
      linear-gradient(180deg, rgba(255, 255, 255, 0.045), transparent 58%),
      var(--cr-surface);
    box-shadow: 0 14px 42px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.055);
  }

  .cr-svelte-kpi::before {
    position: absolute;
    right: 18px;
    bottom: 18px;
    width: 64px;
    height: 64px;
    border: 1px solid rgba(255, 255, 255, 0.075);
    border-radius: var(--cr-radius-orb);
    content: "";
    background: radial-gradient(circle, rgba(124, 236, 255, 0.065), transparent 68%);
  }

  .cr-svelte-kpi--compact {
    min-height: 138px;
    padding: 16px;
  }

  .cr-svelte-kpi--ledger {
    background:
      linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.028) 1px, transparent 1px),
      var(--cr-surface);
    background-size: 28px 28px;
  }

  .cr-svelte-kpi--orbit {
    border-color: rgba(255, 184, 0, 0.42);
    background:
      radial-gradient(circle at 82% 28%, rgba(255, 184, 0, 0.08), transparent 4.25rem),
      linear-gradient(180deg, rgba(255, 255, 255, 0.042), transparent 58%),
      var(--cr-surface);
  }

  .cr-svelte-kpi--risk {
    border-color: rgba(255, 101, 122, 0.45);
  }

  .cr-svelte-kpi__topline,
  .cr-svelte-kpi__footer {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--cr-space-3);
    color: var(--cr-muted);
    font-family: var(--cr-font-mono);
    font-size: 0.68rem;
    text-transform: uppercase;
  }

  .cr-svelte-kpi__topline span:first-child {
    color: var(--cr-text);
    font-family: var(--cr-font-body);
    font-size: 0.86rem;
    font-weight: 650;
    text-transform: none;
  }

  strong {
    position: relative;
    z-index: 1;
    display: block;
    margin-top: 18px;
    font-size: 2.55rem;
    font-weight: 680;
    line-height: 1;
    letter-spacing: 0;
    font-variant-numeric: tabular-nums;
  }

  .cr-svelte-kpi--compact strong {
    font-size: 2.35rem;
  }

  .cr-svelte-kpi__footer {
    margin-top: 18px;
    font-size: 0.82rem;
  }

  .cr-svelte-kpi__delta {
    min-height: 24px;
    padding: 0 8px;
    border: 1px solid rgba(34, 197, 94, 0.28);
    border-radius: var(--cr-radius-sm);
    color: var(--tone-color);
    background: rgba(34, 197, 94, 0.08);
  }

  .cr-svelte-tone-danger .cr-svelte-kpi__delta {
    border-color: rgba(239, 68, 68, 0.3);
    background: rgba(239, 68, 68, 0.08);
  }

  .cr-svelte-tone-warning .cr-svelte-kpi__delta,
  .cr-svelte-tone-accent .cr-svelte-kpi__delta {
    border-color: rgba(255, 184, 0, 0.3);
    background: rgba(255, 184, 0, 0.08);
  }

  .cr-svelte-tone-info .cr-svelte-kpi__delta {
    border-color: rgba(59, 130, 246, 0.3);
    background: rgba(59, 130, 246, 0.08);
  }

  svg {
    width: 86px;
    height: 28px;
  }

  path {
    fill: none;
    stroke: var(--tone-color);
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2.4;
  }

  .cr-svelte-kpi__ring {
    position: absolute;
    right: 16px;
    top: 16px;
    display: grid;
    width: 48px;
    height: 48px;
    place-items: center;
    border: 1px solid rgba(255, 184, 0, 0.24);
    border-radius: var(--cr-radius-orb);
    color: var(--cr-accent);
    font: 700 0.66rem / 1 var(--cr-font-mono);
    background:
      conic-gradient(var(--ring-color) var(--ring-value), rgba(255, 255, 255, 0.08) 0),
      var(--cr-bg);
    box-shadow: var(--cr-shadow-accent);
  }

  .cr-svelte-kpi__ring::before {
    position: absolute;
    inset: 7px;
    border-radius: inherit;
    content: "";
    background: var(--cr-bg);
  }

  .cr-svelte-kpi__ring span {
    position: relative;
    z-index: 1;
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
