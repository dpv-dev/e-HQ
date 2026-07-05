<script lang="ts">
  import type { FieldState, SelectOption } from "./types.js";

  interface Props {
    readonly id: string;
    readonly label: string;
    readonly value: string;
    readonly options: readonly SelectOption[];
    readonly state: FieldState;
    readonly message: string;
    readonly onchange?: ((value: string) => void) | null;
  }

  const props: Props = $props();

  function handleChange(event: Event & { readonly currentTarget: EventTarget & HTMLSelectElement }): void {
    if (props.onchange === undefined || props.onchange === null) {
      return;
    }

    props.onchange(event.currentTarget.value);
  }
</script>

<label class={`ehq-select-field ${props.state}`} for={props.id}>
  <span>{props.label}</span>
  <select
    id={props.id}
    value={props.value}
    disabled={props.state === "disabled"}
    aria-invalid={props.state === "error"}
    onchange={handleChange}
  >
    {#each props.options as option (option.value)}
      <option value={option.value}>{option.label}</option>
    {/each}
  </select>
  {#if props.message.length > 0}
    <small>{props.message}</small>
  {/if}
</label>

<style>
  .ehq-select-field {
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

  select {
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

  select:focus,
  .focus select {
    border-color: var(--ehq-yellow-border);
    box-shadow: 0 0 0 3px var(--ehq-yellow-muted);
  }

  .error select {
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
