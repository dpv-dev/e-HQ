<script lang="ts">
  import type { OperatorState } from "./types.js";
  import Button from "./Button.svelte";
  import Loader from "./Loader.svelte";

  interface Props {
    readonly title: string;
    readonly detail: string;
    readonly state: OperatorState;
    readonly actionLabel: string;
    readonly actionHref: string | null;
    readonly disabledReason: string;
  }

  const props: Props = $props();

  const stateLabels: Record<OperatorState, string> = {
    ready: "Prêt",
    loading: "Chargement",
    empty: "Vide",
    error: "Erreur",
    disabled: "Désactivé"
  };
</script>

<section class={`ehq-empty-state ehq-edge-surface ${props.state}`} aria-live="polite">
  {#if props.state === "loading"}
    <Loader label={props.title} detail={props.detail} size="medium" />
  {:else}
    <div>
      <p class="ehq-type-label-mono">{stateLabels[props.state]}</p>
      <h3>{props.title}</h3>
      <span>{props.detail}</span>
      {#if props.disabledReason.length > 0}
        <small>{props.disabledReason}</small>
      {/if}
    </div>

    {#if props.actionLabel.length > 0}
      {#if props.actionHref !== null && props.state !== "disabled"}
        <a class="empty-link" href={props.actionHref}>{props.actionLabel}</a>
      {:else}
        <Button
          label={props.actionLabel}
          variant="secondary"
          size="small"
          type="button"
          disabled={props.state === "empty" || props.state === "disabled"}
          loading={false}
          locked={props.state === "disabled"}
          focus={false}
          ariaLabel={props.actionLabel}
        />
      {/if}
    {/if}
  {/if}
</section>

<style>
  .ehq-empty-state {
    min-height: 156px;
    padding: var(--ehq-space-5);
    border-radius: var(--ehq-radius-sm);
    display: grid;
    align-items: center;
    gap: var(--ehq-space-4);
    background: transparent;
  }

  .empty {
    --ehq-edge-fill: var(--ehq-state-empty-bg);
    --ehq-edge-border-color: var(--ehq-border-soft);
  }

  .error {
    --ehq-edge-fill: var(--ehq-error-bg);
    --ehq-edge-border-color: var(--ehq-error);
  }

  .disabled {
    --ehq-edge-fill: var(--ehq-state-disabled-bg);
    --ehq-edge-border-color: var(--ehq-state-disabled-border);
  }

  p,
  h3,
  span,
  small {
    margin: 0;
  }

  h3 {
    margin-top: var(--ehq-space-2);
    color: var(--ehq-text);
    font-family: var(--ehq-display);
    font-size: var(--ehq-h3);
    font-weight: var(--ehq-type-heading-weight);
  }

  span,
  small {
    display: block;
    margin-top: var(--ehq-space-2);
    color: var(--ehq-text-soft);
    font-family: var(--ehq-font);
    font-size: 13px;
    line-height: 1.5;
  }

  small {
    color: var(--ehq-state-disabled-text);
  }

  .empty-link {
    width: max-content;
    min-height: 32px;
    padding: 0 var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    color: var(--ehq-text);
    display: inline-flex;
    align-items: center;
    font-family: var(--ehq-font);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-decoration: none;
    text-transform: uppercase;
  }

  .empty-link:hover,
  .empty-link:focus-visible {
    border-color: var(--ehq-yellow-border);
    outline: 0;
    box-shadow: 0 0 0 3px var(--ehq-yellow-muted);
  }
</style>
