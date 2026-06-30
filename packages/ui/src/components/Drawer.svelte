<script lang="ts">
  import type { DrawerState, Tone } from "./types.js";
  import Badge from "./Badge.svelte";
  import Button from "./Button.svelte";

  interface Props {
    readonly open: boolean;
    readonly title: string;
    readonly badgeLabel: string;
    readonly badgeTone: Tone;
    readonly body: string;
    readonly primaryAction: string;
    readonly secondaryAction: string;
    readonly state: DrawerState;
  }

  const props: Props = $props();
</script>

<section class={`ehq-drawer-demo ehq-edge-surface ${props.state}`} class:closed={!props.open} aria-label={props.title}>
  {#if props.open}
    <aside class="drawer-panel ehq-edge-surface">
      <header>
        <div>
          <p>Drawer</p>
          <h3>{props.state === "locked" ? "× " : ""}{props.title}</h3>
        </div>
        {#if props.badgeLabel.length > 0}
          <Badge label={props.badgeLabel} tone={props.badgeTone} />
        {/if}
      </header>
      <div class="body">{props.body}</div>
      <footer>
        <Button
          label={props.secondaryAction}
          variant="secondary"
          size="small"
          type="button"
          disabled={props.state === "locked"}
          loading={false}
          locked={false}
          focus={false}
          ariaLabel={props.secondaryAction}
        />
        <Button
          label={props.primaryAction}
          variant={props.state === "error" ? "danger" : "primary"}
          size="small"
          type="button"
          disabled={false}
          loading={false}
          locked={props.state === "locked"}
          focus={false}
          ariaLabel={props.primaryAction}
        />
      </footer>
    </aside>
  {:else}
    <div class="closed-copy">
      <strong>Drawer closed</strong>
      <span>The trigger remains in the surrounding shell.</span>
    </div>
  {/if}
</section>

<style>
  .ehq-drawer-demo {
    min-height: 290px;
    padding: var(--ehq-space-3);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    display: flex;
    justify-content: flex-end;
  }

  .ehq-drawer-demo.closed {
    justify-content: center;
    align-items: center;
  }

  .drawer-panel {
    width: min(360px, 100%);
    padding: var(--ehq-space-4);
    border: 0;
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    box-shadow: var(--ehq-shadow-md);
    display: grid;
    gap: var(--ehq-space-4);
  }

  header,
  footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ehq-space-3);
  }

  footer {
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  p,
  h3 {
    margin: 0;
  }

  p {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    font-weight: var(--ehq-type-label-weight);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  h3 {
    margin-top: var(--ehq-space-1);
    font-family: var(--ehq-display);
    font-size: var(--ehq-type-section-title-size);
    font-weight: var(--ehq-type-heading-weight);
  }

  .locked h3,
  .error h3 {
    color: var(--ehq-error);
  }

  .body,
  .closed-copy span {
    color: var(--ehq-text-soft);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-ui-size);
    font-weight: var(--ehq-type-body-weight);
    line-height: var(--ehq-type-ui-line);
  }

  .closed-copy {
    display: grid;
    gap: var(--ehq-space-2);
    text-align: center;
  }

  .closed-copy strong {
    font-size: var(--ehq-type-section-title-size);
    font-weight: var(--ehq-type-heading-weight);
  }
</style>
