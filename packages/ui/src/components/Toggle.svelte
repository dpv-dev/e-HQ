<script lang="ts">
  interface Props {
    readonly id: string;
    readonly label: string;
    readonly checked: boolean;
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
</script>

<label class="ehq-toggle" class:disabled={props.disabled} for={props.id}>
  <input
    id={props.id}
    type="checkbox"
    role="switch"
    checked={props.checked}
    disabled={props.disabled}
    onchange={handleChange}
  />
  <span class="track" aria-hidden="true"><span class="thumb"></span></span>
  {#if props.label.length > 0}
    <span class="text">{props.label}</span>
  {/if}
</label>

<style>
  .ehq-toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--ehq-space-2);
    cursor: pointer;
    user-select: none;
  }

  .ehq-toggle.disabled {
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

  .track {
    width: 40px;
    height: 22px;
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-surface-high);
    border: 1px solid var(--ehq-border);
    display: flex;
    align-items: center;
    padding: 0 2px;
    flex: none;
    transition: background 120ms ease;
  }

  .thumb {
    width: 16px;
    height: 16px;
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-text);
    transition: transform 120ms ease;
  }

  input:checked + .track {
    background: var(--ehq-yellow);
    border-color: var(--ehq-yellow);
  }

  input:checked + .track .thumb {
    background: var(--ehq-text-on-yellow);
    transform: translateX(18px);
  }

  input:focus-visible + .track {
    box-shadow: 0 0 0 3px var(--ehq-yellow-muted);
  }

  .text {
    color: var(--ehq-text);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-control-size);
    line-height: var(--ehq-type-ui-line);
  }
</style>
