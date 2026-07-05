<script lang="ts">
  interface Props {
    readonly label: string;
    readonly detail: string;
    readonly size: "small" | "medium";
  }

  const props: Props = $props();
</script>

<div class={`ehq-loader ${props.size}`} role="status" aria-label={props.label}>
  <span aria-hidden="true"></span>
  <div>
    <strong>{props.label}</strong>
    {#if props.detail.length > 0}
      <p>{props.detail}</p>
    {/if}
  </div>
</div>

<style>
  .ehq-loader {
    min-height: 62px;
    padding: var(--ehq-space-3);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: flex;
    align-items: center;
    gap: var(--ehq-space-3);
  }

  .ehq-loader.small {
    min-height: 40px;
    padding: var(--ehq-space-2);
  }

  span {
    width: var(--ehq-spinner-md);
    height: var(--ehq-spinner-md);
    border: 2px solid var(--ehq-yellow-muted);
    border-top-color: var(--ehq-yellow);
    border-radius: var(--ehq-radius-pill);
    animation: ehq-loader-spin 900ms linear infinite;
  }

  .small span {
    width: var(--ehq-spinner-sm);
    height: var(--ehq-spinner-sm);
  }

  strong {
    display: block;
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-ui-size);
    font-weight: var(--ehq-type-heading-weight);
  }

  p {
    margin: var(--ehq-space-1) 0 0;
    color: var(--ehq-text-muted);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-label-size);
    font-weight: var(--ehq-type-body-weight);
  }

  @keyframes ehq-loader-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
