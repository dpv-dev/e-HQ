<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { IconName } from "./icons.js";
  import type { AlertTone } from "./types.js";

  interface Props {
    readonly tone: AlertTone;
    readonly title: string;
    readonly message: string;
    readonly dismissible: boolean;
    readonly ondismiss?: (() => void) | null;
  }

  const props: Props = $props();

  const toneIconNames: Readonly<Record<AlertTone, IconName>> = {
    success: "circle-check",
    info: "info",
    warning: "circle-alert",
    error: "circle-x"
  };

  function handleDismiss(): void {
    if (props.ondismiss === undefined || props.ondismiss === null) {
      return;
    }

    props.ondismiss();
  }
</script>

<section class={`ehq-alert ${props.tone}`} role={props.tone === "error" ? "alert" : "status"}>
  <span class="icon" aria-hidden="true"><Icon name={toneIconNames[props.tone]} size={18} strokeWidth={2} /></span>
  <div class="copy">
    <strong>{props.title}</strong>
    {#if props.message.length > 0}
      <span>{props.message}</span>
    {/if}
  </div>
  {#if props.dismissible}
    <button type="button" class="dismiss" aria-label="Dismiss" onclick={handleDismiss}>
      <Icon name="x" size={16} strokeWidth={2} />
    </button>
  {/if}
</section>

<style>
  .ehq-alert {
    display: flex;
    align-items: flex-start;
    gap: var(--ehq-space-2);
    padding: var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
  }

  .icon {
    display: grid;
    place-items: center;
    margin-top: 1px;
    flex: none;
  }

  .copy {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  strong {
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-control-size);
    font-weight: var(--ehq-type-heading-weight);
    color: var(--ehq-text);
  }

  .copy span {
    color: var(--ehq-text-soft);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-control-size);
    line-height: var(--ehq-type-ui-line);
  }

  .dismiss {
    appearance: none;
    margin-left: auto;
    padding: 2px;
    border: 0;
    background: none;
    color: var(--ehq-text-muted);
    cursor: pointer;
    display: grid;
    place-items: center;
    flex: none;
  }

  .dismiss:hover {
    color: var(--ehq-text);
  }

  .success {
    background: var(--ehq-success-bg);
    border-color: var(--ehq-success-border);
  }

  .success .icon,
  .success strong {
    color: var(--ehq-success);
  }

  .info {
    background: var(--ehq-info-bg);
    border-color: var(--ehq-info-border);
  }

  .info .icon,
  .info strong {
    color: var(--ehq-info);
  }

  .warning {
    background: var(--ehq-yellow-muted);
    border-color: var(--ehq-yellow-border);
  }

  .warning .icon,
  .warning strong {
    color: var(--ehq-yellow);
  }

  .error {
    background: var(--ehq-error-bg);
    border-color: var(--ehq-error-border);
  }

  .error .icon,
  .error strong {
    color: var(--ehq-error);
  }
</style>
