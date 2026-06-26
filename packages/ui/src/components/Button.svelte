<script lang="ts">
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
    readonly onclick?: (() => void) | null;
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
  onclick={props.onclick ?? undefined}
>
  {#if props.loading}
    <span class="spinner" aria-hidden="true"></span>
  {/if}
  {#if props.locked}
    <b aria-hidden="true">×</b>
  {/if}
  <span>{props.label}</span>
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
    font-size: 11px;
    font-weight: var(--ehq-type-heading-weight);
    letter-spacing: 0.08em;
    line-height: 1;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .ehq-button.small {
    min-height: 30px;
    padding: 0 var(--ehq-space-2);
    font-size: 10px;
  }

  .ehq-button.primary {
    background: var(--ehq-yellow);
    border-color: var(--ehq-yellow);
    color: var(--ehq-text-on-yellow);
  }

  .ehq-button.secondary:hover,
  .ehq-button.focus-demo,
  .ehq-button:focus-visible {
    outline: none;
    border-color: var(--ehq-yellow-border);
    box-shadow: 0 0 0 3px var(--ehq-yellow-muted);
  }

  .ehq-button.danger {
    background: var(--ehq-error-bg);
    border-color: var(--ehq-error);
    color: var(--ehq-error);
  }

  .ehq-button:disabled {
    color: var(--ehq-text-disabled);
    cursor: not-allowed;
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
    width: 14px;
    height: 14px;
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
