<script lang="ts">
  import type { Tone } from "./types.js";

  interface Props {
    readonly label: string;
    readonly tone: Tone;
  }

  const props: Props = $props();
</script>

<span class={`ehq-badge ${props.tone}`}>{props.label}</span>

<style>
  .ehq-badge {
    min-height: 24px;
    padding: 0 var(--ehq-space-2);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-pill);
    display: inline-flex;
    align-items: center;
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    font-weight: var(--ehq-type-label-weight);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .success {
    color: var(--ehq-success);
    background: var(--ehq-success-bg);
  }

  .info {
    color: var(--ehq-info);
    background: var(--ehq-info-bg);
  }

  .warning,
  .active {
    color: var(--ehq-text-soft);
    background: var(--ehq-surface-high);
    border-color: var(--ehq-border);
  }

  .error {
    color: var(--ehq-error);
    background: var(--ehq-error-bg);
  }

  .muted {
    color: var(--ehq-text-muted);
    background: var(--ehq-surface-high);
  }
</style>
