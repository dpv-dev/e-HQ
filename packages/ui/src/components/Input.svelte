<script lang="ts">
  import type { Snippet } from "svelte";
  import type { FieldState } from "./types.js";

  interface Props {
    readonly id: string;
    readonly label: string;
    readonly value?: string;
    readonly placeholder: string;
    readonly type: "text" | "search" | "email" | "number" | "password";
    readonly state: FieldState;
    readonly message: string;
    readonly oninput?: ((value: string) => void) | null;
    // Optional leading icon (design-system reference "input with icon" state).
    readonly icon?: Snippet | null;
  }

  let {
    id,
    label,
    value = $bindable(""),
    placeholder,
    type,
    state,
    message,
    oninput = null,
    icon = null
  }: Props = $props();

  function handleInput(event: Event & { readonly currentTarget: EventTarget & HTMLInputElement }): void {
    value = event.currentTarget.value;

    if (oninput === null) {
      return;
    }

    oninput(event.currentTarget.value);
  }
</script>

<label class={`ehq-field ${state}`} for={id}>
  <span>{label}</span>
  <div class="control" class:with-icon={icon}>
    {#if icon}
      <span class="icon" aria-hidden="true">{@render icon()}</span>
    {/if}
    <input
      id={id}
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={state === "disabled"}
      aria-invalid={state === "error"}
      oninput={handleInput}
    />
  </div>
  {#if message.length > 0}
    <small>{message}</small>
  {/if}
</label>

<style>
  .ehq-field {
    display: grid;
    gap: var(--ehq-space-1);
  }

  span {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    font-weight: var(--ehq-type-label-weight);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .control {
    position: relative;
  }

  .control .icon {
    position: absolute;
    left: var(--ehq-space-3);
    top: 50%;
    transform: translateY(-50%);
    color: var(--ehq-text-muted);
    display: grid;
    place-items: center;
    pointer-events: none;
  }

  .control.with-icon input {
    padding-left: calc(var(--ehq-space-3) + 22px);
  }

  input {
    min-height: 36px;
    width: 100%;
    padding: 0 var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-bg-main);
    color: var(--ehq-text);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-control-size);
    font-weight: var(--ehq-type-body-weight);
    line-height: var(--ehq-type-ui-line);
    outline: 0;
  }

  input::placeholder {
    color: var(--ehq-text-muted);
  }

  input:focus,
  .focus input {
    border-color: var(--ehq-yellow-border);
    box-shadow: 0 0 0 3px var(--ehq-yellow-muted);
  }

  .error input {
    border-color: var(--ehq-error);
  }

  small {
    color: var(--ehq-error);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-label-size);
    font-weight: var(--ehq-type-body-weight);
  }

  .disabled {
    opacity: 0.6;
  }
</style>
