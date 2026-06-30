<script lang="ts">
  import type { SurfaceState, Tone } from "./types.js";
  import Badge from "./Badge.svelte";
  import Button from "./Button.svelte";
  import Loader from "./Loader.svelte";

  interface Props {
    readonly title: string;
    readonly subtitle: string;
    readonly eyebrow: string;
    readonly state: SurfaceState;
    readonly accent: boolean;
    readonly badgeLabel: string;
    readonly badgeTone: Tone;
    readonly actionLabel: string;
  }

  const props: Props = $props();
</script>

<article class={`ehq-card-surface ehq-edge-surface ${props.state}`} class:accent={props.accent}>
  {#if props.state === "loading"}
    <Loader label="Loading" detail="Card content is on the way." size="small" />
  {:else}
    <div class="card-copy">
      <p>{props.eyebrow}</p>
      <h3>{props.state === "locked" ? "× " : ""}{props.title}</h3>
      <span>{props.subtitle}</span>
    </div>
    {#if props.badgeLabel.length > 0}
      <Badge label={props.badgeLabel} tone={props.badgeTone} />
    {/if}
    {#if props.actionLabel.length > 0}
      <Button
        label={props.actionLabel}
        variant={props.state === "error" ? "danger" : "secondary"}
        size="small"
        type="button"
        disabled={props.state === "empty"}
        loading={false}
        locked={props.state === "locked"}
        focus={props.state === "hover"}
        ariaLabel={props.actionLabel}
      />
    {/if}
  {/if}
</article>

<style>
  .ehq-card-surface {
    min-height: 158px;
    padding: var(--ehq-space-4);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: grid;
    align-content: start;
    gap: var(--ehq-space-3);
  }

  .ehq-card-surface.accent {
    --ehq-edge-border-color: var(--ehq-yellow-border);
    --ehq-edge-hairline-opacity: 1;
  }

  .ehq-card-surface.hover {
    --ehq-edge-border-color: var(--ehq-yellow-border);
    box-shadow: var(--ehq-glow-yellow);
  }

  .ehq-card-surface.empty {
    --ehq-edge-border-color: var(--ehq-border-soft);
  }

  .ehq-card-surface.error {
    --ehq-edge-border-color: var(--ehq-error);
    --ehq-edge-fill: var(--ehq-error-bg);
  }

  .ehq-card-surface.locked {
    --ehq-edge-border-color: var(--ehq-error);
  }

  p {
    margin: 0;
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    font-weight: var(--ehq-type-label-weight);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  h3 {
    margin: var(--ehq-space-2) 0 0;
    font-family: var(--ehq-display);
    font-size: var(--ehq-type-section-title-size);
    font-weight: var(--ehq-type-heading-weight);
  }

  .locked h3 {
    color: var(--ehq-error);
  }

  span {
    display: block;
    margin-top: var(--ehq-space-2);
    color: var(--ehq-text-soft);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-ui-size);
    font-weight: var(--ehq-type-body-weight);
    line-height: var(--ehq-type-ui-line);
  }
</style>
