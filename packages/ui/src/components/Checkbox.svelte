<script lang="ts">
  interface Props {
    readonly id: string;
    readonly label: string;
    readonly checked: boolean;
    readonly indeterminate: boolean;
    readonly disabled: boolean;
    readonly onchange?: ((checked: boolean) => void) | null;
  }

  const props: Props = $props();

  function handleChange(event: Event & { readonly currentTarget: EventTarget & HTMLInputElement }): void {
    if (props.onchange === undefined || props.onchange === null) {
      return;
    }

    props.onchange(event.currentTarget.checked);
  }

  function syncIndeterminate(node: HTMLInputElement, indeterminate: boolean): { update: (next: boolean) => void } {
    node.indeterminate = indeterminate;
    return {
      update(next: boolean): void {
        node.indeterminate = next;
      }
    };
  }
</script>

<label class="ehq-checkbox" class:disabled={props.disabled} for={props.id}>
  <input
    id={props.id}
    type="checkbox"
    checked={props.checked}
    disabled={props.disabled}
    use:syncIndeterminate={props.indeterminate}
    onchange={handleChange}
  />
  <span class="box" aria-hidden="true">
    {#if props.indeterminate}
      <svg viewBox="0 0 12 12" fill="none"><path d="M2.5 6H9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
    {:else if props.checked}
      <svg viewBox="0 0 12 12" fill="none"><path d="M2.5 6.5L5 9L9.5 3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    {/if}
  </span>
  <span class="text">{props.label}</span>
</label>

<style>
  .ehq-checkbox {
    display: inline-flex;
    align-items: center;
    gap: var(--ehq-space-2);
    cursor: pointer;
    user-select: none;
  }

  .ehq-checkbox.disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  input {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    clip-path: inset(50%);
    overflow: hidden;
  }

  .box {
    width: 18px;
    height: 18px;
    border: 1.5px solid var(--ehq-border);
    border-radius: 4px;
    background: var(--ehq-bg-main);
    color: var(--ehq-text-on-yellow);
    display: grid;
    place-items: center;
    flex: none;
  }

  .box svg {
    width: 12px;
    height: 12px;
  }

  input:checked + .box,
  input:indeterminate + .box {
    background: var(--ehq-yellow);
    border-color: var(--ehq-yellow);
  }

  input:focus-visible + .box {
    box-shadow: 0 0 0 3px var(--ehq-yellow-muted);
  }

  .text {
    color: var(--ehq-text);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-control-size);
    line-height: var(--ehq-type-ui-line);
  }
</style>
