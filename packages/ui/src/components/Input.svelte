<script lang="ts">
  import type { FieldState } from "./types.js";

  interface Props {
    readonly id: string;
    readonly label: string;
    readonly value: string;
    readonly placeholder: string;
    readonly type: "text" | "search" | "email" | "number";
    readonly state: FieldState;
    readonly message: string;
  }

  const props: Props = $props();
</script>

<label class={`ehq-field ${props.state}`} for={props.id}>
  <span>{props.label}</span>
  <input
    id={props.id}
    type={props.type}
    value={props.value}
    placeholder={props.placeholder}
    disabled={props.state === "disabled"}
    aria-invalid={props.state === "error"}
  />
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

  input {
    min-height: 38px;
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
