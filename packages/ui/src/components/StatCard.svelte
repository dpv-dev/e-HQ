<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { Snippet } from "svelte";
  import type { StatTrendDirection } from "./types.js";

  interface Props {
    readonly label: string;
    readonly value: string;
    readonly trendDirection: StatTrendDirection;
    readonly trendValue: string;
    readonly trendDetail: string;
    readonly icon?: Snippet | null;
  }

  const props: Props = $props();
</script>

<article class="ehq-stat-card ehq-edge-surface">
  {#if props.icon}
    <span class="icon" aria-hidden="true">{@render props.icon()}</span>
  {/if}
  <p class="label">{props.label}</p>
  <strong class="value">{props.value}</strong>
  {#if props.trendDirection !== "none"}
    <span class={`trend ${props.trendDirection}`}>
      {#if props.trendDirection === "up"}
        <Icon name="trending-up" size={14} strokeWidth={2} />
      {:else}
        <Icon name="trending-down" size={14} strokeWidth={2} />
      {/if}
      {props.trendValue}
      <span class="detail">{props.trendDetail}</span>
    </span>
  {:else if props.trendDetail.length > 0}
    <span class="trend muted"><span class="detail">{props.trendDetail}</span></span>
  {/if}
</article>

<style>
  .ehq-stat-card {
    min-height: 118px;
    padding: var(--ehq-space-4);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: grid;
    justify-items: start;
    align-content: start;
    gap: var(--ehq-space-1);
  }

  .icon {
    width: 36px;
    height: 36px;
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-surface-high);
    color: var(--ehq-yellow);
    display: grid;
    place-items: center;
    margin-bottom: var(--ehq-space-1);
  }

  .label {
    margin: 0;
    color: var(--ehq-text-muted);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-control-size);
  }

  .value {
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-kpi-value-size);
    font-weight: var(--ehq-type-heading-weight);
    font-variant-numeric: tabular-nums;
    color: var(--ehq-text);
  }

  .trend {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-label-size);
  }

  .trend.up {
    color: var(--ehq-success);
  }

  .trend.down {
    color: var(--ehq-error);
  }

  .trend.muted {
    color: var(--ehq-text-muted);
  }

  .detail {
    color: var(--ehq-text-muted);
  }
</style>
