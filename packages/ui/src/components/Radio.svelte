<script lang="ts">
  interface Props {
    readonly id: string;
    readonly name: string;
    readonly label: string;
    readonly value: string;
    readonly checked: boolean;
    readonly disabled: boolean;
    readonly onselect?: ((value: string) => void) | null;
  }

  const props: Props = $props();

  function handleChange(): void {
    if (props.onselect === undefined || props.onselect === null) {
      return;
    }

    props.onselect(props.value);
  }
</script>

<label class="ehq-radio" class:disabled={props.disabled} for={props.id}>
  <input
    id={props.id}
    type="radio"
    name={props.name}
    value={props.value}
    checked={props.checked}
    disabled={props.disabled}
    onchange={handleChange}
  />
  <span class="dot" aria-hidden="true"></span>
  <span class="text">{props.label}</span>
</label>

<style>
  .ehq-radio {
    display: inline-flex;
    align-items: center;
    gap: var(--ehq-space-2);
    cursor: pointer;
    user-select: none;
  }

  .ehq-radio.disabled {
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

  .dot {
    width: 18px;
    height: 18px;
    border: 1.5px solid var(--ehq-border);
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-bg-main);
    display: grid;
    place-items: center;
    flex: none;
  }

  .dot::after {
    content: "";
    width: 8px;
    height: 8px;
    border-radius: var(--ehq-radius-pill);
    background: transparent;
  }

  input:checked + .dot {
    border-color: var(--ehq-yellow);
  }

  input:checked + .dot::after {
    background: var(--ehq-yellow);
  }

  input:focus-visible + .dot {
    box-shadow: 0 0 0 3px var(--ehq-yellow-muted);
  }

  .text {
    color: var(--ehq-text);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-control-size);
    line-height: var(--ehq-type-ui-line);
  }
</style>
