<script lang="ts">
  import { tick } from "svelte";
  import type { Snippet } from "svelte";
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
    // Optional live wiring: pages pass rich content and real handlers, while
    // static previews (design system) omit these and keep the inert demo body.
    readonly content?: Snippet | null;
    readonly onPrimary?: (() => void | Promise<void>) | null;
    readonly onSecondary?: (() => void | Promise<void>) | null;
    readonly primaryDisabled?: boolean;
    readonly primaryTitle?: string | null;
    /** Inline is kept for existing two-pane screens; overlay is the contextual workbench. */
    readonly presentation?: "inline" | "overlay";
    /** Complex workbenches provide their own explicit, contextual actions. */
    readonly showFooter?: boolean;
  }

  const props: Props = $props();
  let panelElement = $state<HTMLElement | null>(null);
  let returnFocus = $state<HTMLElement | null>(null);

  $effect(() => {
    if (!props.open || props.presentation !== "overlay") return;
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    void tick().then(() => panelElement?.focus());
    return () => returnFocus?.focus();
  });

  function closeOverlay(event: MouseEvent): void {
    if (event.target === event.currentTarget) void props.onSecondary?.();
  }

  function handlePanelKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      void props.onSecondary?.();
      return;
    }
    if (event.key !== "Tab" || panelElement === null) return;
    const focusable = Array.from(panelElement.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
</script>

{#snippet drawerContent()}
  {#if props.open}
    <div
      bind:this={panelElement}
      class="drawer-panel ehq-edge-surface"
      class:drawer-overlay-panel={props.presentation === "overlay"}
      aria-label={props.title}
      aria-modal={props.presentation === "overlay" ? "true" : undefined}
      role="dialog"
      tabindex="-1"
      onkeydown={handlePanelKeydown}
    >
      <header>
        <div>
          <h3>{props.state === "locked" ? "× " : ""}{props.title}</h3>
        </div>
        {#if props.badgeLabel.length > 0}
          <Badge label={props.badgeLabel} tone={props.badgeTone} />
        {/if}
      </header>
      {#if props.content}
        <div class="content">
          {@render props.content()}
        </div>
      {:else}
        <div class="body">{props.body}</div>
      {/if}
      {#if props.showFooter !== false}
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
            onclick={props.onSecondary ?? null}
          />
          <Button
            label={props.primaryAction}
            variant={props.state === "error" ? "danger" : "primary"}
            size="small"
            type="button"
            disabled={props.primaryDisabled ?? false}
            loading={false}
            locked={props.state === "locked"}
            focus={false}
            ariaLabel={props.primaryAction}
            title={props.primaryTitle ?? null}
            onclick={props.onPrimary ?? null}
          />
        </footer>
      {/if}
    </div>
  {/if}
{/snippet}

{#if props.presentation === "overlay"}
  {#if props.open}
    <div class="drawer-backdrop" role="presentation" onclick={closeOverlay}>
      {@render drawerContent()}
    </div>
  {/if}
{:else}
  <section class={`ehq-drawer-demo ehq-edge-surface ${props.state}`} class:closed={!props.open} aria-label={props.title}>
    {#if props.open}
      {@render drawerContent()}
    {:else}
      <div class="closed-copy">
        <strong>Drawer closed</strong>
        <span>The trigger remains in the surrounding shell.</span>
      </div>
    {/if}
  </section>
{/if}

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

  .drawer-backdrop {
    position: fixed;
    inset: 0;
    z-index: 90;
    padding: var(--ehq-space-4);
    background: rgb(0 0 0 / 0.56);
    display: flex;
    justify-content: flex-end;
  }

  .drawer-overlay-panel {
    width: min(680px, 100%);
    max-height: 100%;
    overflow: auto;
    border: 1px solid var(--ehq-border-strong);
    background: var(--ehq-surface);
    outline: none;
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

  h3 {
    margin: 0;
    margin-top: var(--ehq-space-1);
    font-family: var(--ehq-display);
    font-size: var(--ehq-type-section-title-size);
    font-weight: var(--ehq-type-heading-weight);
  }

  .locked h3,
  .error h3 {
    color: var(--ehq-error);
  }

  .content {
    display: grid;
    gap: var(--ehq-space-3);
  }

  @media (max-width: 720px) {
    .drawer-backdrop {
      padding: 0;
    }

    .drawer-overlay-panel {
      width: 100%;
      border-radius: 0;
    }
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
