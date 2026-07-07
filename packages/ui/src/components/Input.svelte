<script lang="ts">
  import type { Snippet } from "svelte";
  import type { FieldState } from "./types.js";

  interface Props {
    readonly id: string;
    readonly label: string;
    readonly value: string;
    readonly placeholder: string;
    readonly type: "text" | "search" | "email" | "number";
    readonly state: FieldState;
    readonly message: string;
    readonly oninput?: ((value: string) => void) | null;
    // Optional leading icon (design-system reference "input with icon" state).
    readonly icon?: Snippet | null;
  }

  const props: Props = $props();

  function handleInput(event: Event & { readonly currentTarget: EventTarget & HTMLInputElement }): void {
    if (props.oninput === undefined || props.oninput === null) {
      return;
    }

    props.oninput(event.currentTarget.value);
  }
</script>

<label class={`ehq-field ${props.state}`} for={props.id}>
  <span>{props.label}</span>
  <div class="control" class:with-icon={props.icon}>
    {#if props.icon}
      <span class="icon" aria-hidden="true">{@render props.icon()}</span>
    {/if}
    <input
      id={props.id}
      type={props.type}
      value={props.value}
      placeholder={props.placeholder}
      disabled={props.state === "disabled"}
      aria-invalid={props.state === "error"}
      oninput={handleInput}
    />
  </div>
  {#if props.message.length > 0}
    <small>{props.message}</small>
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
