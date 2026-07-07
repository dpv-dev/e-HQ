<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { Snippet } from "svelte";
  import type { ButtonSize, ButtonVariant } from "./types.js";

  interface Props {
    readonly label: string;
    readonly variant: ButtonVariant;
    readonly size: ButtonSize;
    readonly type: "button" | "submit" | "reset";
    readonly disabled: boolean;
    readonly loading: boolean;
    readonly locked: boolean;
    readonly focus: boolean;
    readonly ariaLabel: string | null;
    readonly title?: string | null;
    readonly onclick?: (() => void | Promise<void>) | null;
    // Design-system reference additions (optional — existing call sites unaffected):
    // a leading icon snippet and the trailing arrow shown on reference buttons.
    readonly icon?: Snippet | null;
    readonly arrow?: boolean;
  }

  const props: Props = $props();
  const isDisabled = $derived(props.disabled || props.loading || props.locked);
  const accessibleLabel = $derived(props.ariaLabel ?? props.label);
</script>

<button
  class={`ehq-button ${props.variant} ${props.size}`}
  class:loading={props.loading}
  class:locked={props.locked}
  class:focus-demo={props.focus}
  type={props.type}
  disabled={isDisabled}
  aria-label={accessibleLabel}
  title={props.title ?? undefined}
  onclick={props.onclick ?? undefined}
>
  {#if props.loading}
    <span class="spinner" aria-hidden="true"></span>
  {/if}
  {#if props.locked}
    <b aria-hidden="true">×</b>
  {/if}
  {#if props.icon}
    <span class="icon" aria-hidden="true">{@render props.icon()}</span>
  {/if}
  <span>{props.label}</span>
  {#if props.arrow === true}
    <span class="icon" aria-hidden="true"><Icon name="arrow-right" size={14} strokeWidth={2} /></span>
  {/if}
</button>

<style>
  .ehq-button {
    min-height: 36px;
    padding: 0 var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    color: var(--ehq-text);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--ehq-space-2);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-action-size);
    font-weight: var(--ehq-type-heading-weight);
    letter-spacing: 0.08em;
    line-height: 1;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .ehq-button.small {
    min-height: 30px;
    padding: 0 var(--ehq-space-2);
    font-size: var(--ehq-type-action-size);
  }

  .ehq-button.primary {
    background: var(--ehq-yellow);
    border-color: var(--ehq-yellow);
    color: var(--ehq-text-on-yellow);
  }

  .ehq-button.primary:hover {
    background: var(--ehq-yellow-hover);
    border-color: var(--ehq-yellow-hover);
  }

  .ehq-button.secondary:hover,
  .ehq-button.focus-demo,
  .ehq-button:focus-visible {
    outline: none;
    border-color: var(--ehq-yellow-border);
    box-shadow: 0 0 0 3px var(--ehq-yellow-muted);
  }

  .ehq-button.tertiary {
    border-color: transparent;
    color: var(--ehq-yellow);
  }

  .ehq-button.tertiary:hover {
    color: var(--ehq-yellow-hover);
  }

  .ehq-button.ghost {
    border-color: transparent;
    color: var(--ehq-text-soft);
  }

  .ehq-button.ghost:hover {
    background: var(--ehq-surface-high);
    color: var(--ehq-text);
  }

  .ehq-button.danger {
    background: var(--ehq-error-bg);
    border-color: var(--ehq-error);
    color: var(--ehq-error);
  }

  .ehq-button.danger:hover {
    background: var(--ehq-error-hover);
  }

  .icon {
    display: grid;
    place-items: center;
  }

  .ehq-button:disabled {
    color: var(--ehq-text-disabled);
    cursor: not-allowed;
  }

  .ehq-button.primary:disabled {
    background: var(--ehq-yellow-muted);
    border-color: var(--ehq-yellow-border);
    color: var(--ehq-text-disabled);
  }

  .ehq-button.locked {
    border-color: var(--ehq-border);
    color: var(--ehq-text-soft);
  }

  .ehq-button.locked b {
    color: var(--ehq-error);
    font-size: 16px;
    line-height: 1;
  }

  .spinner {
    width: var(--ehq-spinner-sm);
    height: var(--ehq-spinner-sm);
    border: 2px solid var(--ehq-yellow-muted);
    border-top-color: var(--ehq-yellow);
    border-radius: var(--ehq-radius-pill);
    animation: ehq-button-spin 900ms linear infinite;
  }

  @keyframes ehq-button-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
