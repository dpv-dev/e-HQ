<script lang="ts">
  import type { Snippet } from "svelte";
  import type { CommandRoomNavItem, CommandRoomSurface } from "./types.js";

  interface Props {
    readonly brandLabel: string;
    readonly roleLabel: string;
    readonly surface: CommandRoomSurface;
    readonly navItems: readonly CommandRoomNavItem[];
    readonly actions: Snippet | null;
    readonly children: Snippet;
  }

  const props: Props = $props();
</script>

<section class={`cr-svelte-shell cr-svelte-shell--${props.surface}`}>
  <aside>
    <div class="brand">
      <div class="mark">ë</div>
      <div>
        <strong>{props.brandLabel}</strong>
        <span>{props.roleLabel}</span>
      </div>
    </div>
    <nav aria-label={`${props.brandLabel} navigation`}>
      {#each props.navItems as item (item.id)}
        <a href={item.href} data-active={item.active}>
          <span></span>
          {item.label}
        </a>
      {/each}
    </nav>
  </aside>
  <main>
    {#if props.actions}
      <div class="actions">{@render props.actions()}</div>
    {/if}
    {@render props.children()}
  </main>
</section>

<style>
  .cr-svelte-shell {
    display: grid;
    grid-template-columns: 280px minmax(0, 1fr);
    gap: var(--cr-space-5);
    min-height: 760px;
    padding: var(--cr-space-5);
    border: 1px solid var(--cr-line);
    border-radius: var(--cr-radius-xl);
    background:
      linear-gradient(135deg, rgba(124, 236, 255, 0.08), transparent 24%),
      rgba(2, 7, 10, 0.72);
    box-shadow: var(--cr-shadow-panel);
    backdrop-filter: blur(24px);
  }

  .cr-svelte-shell--office {
    background-image: linear-gradient(135deg, rgba(124, 236, 255, 0.1), transparent 30%);
  }

  .cr-svelte-shell--distribution {
    background-image: linear-gradient(135deg, rgba(255, 184, 0, 0.1), transparent 30%);
  }

  .cr-svelte-shell--command {
    background-image: linear-gradient(135deg, rgba(184, 247, 255, 0.12), transparent 30%);
  }

  aside {
    display: flex;
    flex-direction: column;
    gap: var(--cr-space-5);
    padding: var(--cr-space-5);
    border: 1px solid var(--cr-line);
    border-radius: var(--cr-radius-lg);
    background:
      linear-gradient(145deg, rgba(255, 255, 255, 0.055), transparent 38%),
      var(--cr-surface);
    box-shadow: var(--cr-shadow-panel), inset 0 1px 0 rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(22px);
  }

  .brand {
    display: flex;
    align-items: center;
    gap: var(--cr-space-3);
    min-height: 56px;
  }

  .mark {
    display: grid;
    width: 46px;
    height: 46px;
    place-items: center;
    border: 1px solid rgba(255, 184, 0, 0.55);
    border-radius: var(--cr-radius-orb);
    color: var(--cr-ink);
    background: var(--cr-accent);
    box-shadow: var(--cr-shadow-accent);
    font-family: var(--cr-font-mono);
    font-weight: 700;
  }

  strong,
  span {
    display: block;
  }

  .brand span {
    color: var(--cr-muted);
    font-family: var(--cr-font-mono);
    font-size: 0.72rem;
    text-transform: uppercase;
  }

  nav {
    display: grid;
    gap: var(--cr-space-2);
  }

  a {
    display: flex;
    align-items: center;
    gap: var(--cr-space-3);
    min-height: 48px;
    padding: 0 var(--cr-space-4);
    border: 1px solid transparent;
    border-radius: var(--cr-radius-md);
    color: var(--cr-muted);
    text-decoration: none;
  }

  a[data-active="true"],
  a:hover {
    border-color: var(--cr-line-strong);
    color: var(--cr-text);
    background: var(--cr-glass);
  }

  a span {
    width: 9px;
    height: 9px;
    border-radius: var(--cr-radius-orb);
    background: currentColor;
    box-shadow: 0 0 12px currentColor;
  }

  main {
    display: grid;
    gap: var(--cr-space-5);
    align-content: start;
    min-width: 0;
  }

  .actions {
    display: flex;
    justify-content: end;
    gap: var(--cr-space-3);
  }

  @media (max-width: 980px) {
    .cr-svelte-shell {
      grid-template-columns: 1fr;
    }
  }
</style>
