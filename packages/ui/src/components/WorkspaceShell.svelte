<script lang="ts">
  import type { Snippet } from "svelte";
  import type { WorkspaceKind, WorkspaceNavItem } from "./types.js";

  interface Props {
    readonly workspace: WorkspaceKind;
    readonly brandLabel: string;
    readonly homeHref: string;
    readonly navLabel: string;
    readonly navItems: readonly WorkspaceNavItem[];
    readonly statusLabel: string;
    readonly statusValue: string;
    readonly userInitial: string;
    readonly userName: string;
    readonly userContext: string;
    readonly signOutHref: string;
    readonly children?: Snippet;
  }

  const props: Props = $props();
</script>

<div class={`ehq-workspace-shell ehq-workspace-${props.workspace}`}>
  <aside>
    <a class="shell-mark" href={props.homeHref} aria-label={`${props.brandLabel} accueil`}>ë</a>

    <nav aria-label={props.navLabel}>
      {#each props.navItems as item (item.href)}
        <a
          class="nav-item ehq-nav-fade-item ehq-edge-surface"
          class:active={item.active}
          class:disabled={item.disabled}
          href={item.disabled ? undefined : item.href}
          aria-current={item.active ? "page" : undefined}
          aria-disabled={item.disabled}
        >
          <span class="nav-icon" aria-hidden="true">{item.icon}</span>
          <span class="nav-label">{item.label}</span>
          {#if item.badge !== null}
            <strong>{item.badge}</strong>
          {/if}
        </a>
      {/each}
    </nav>

    <section class="shell-status" aria-label="Statut de l'espace">
      <span>{props.statusLabel}</span>
      <strong>{props.statusValue}</strong>
    </section>
  </aside>

  <div class="shell-main">
    <header class="shell-topbar">
      <a class="shell-title" href={props.homeHref}>{props.brandLabel}</a>
      <div class="shell-search" aria-hidden="true">
        <span>Aller à une section</span>
        <kbd>⌘K</kbd>
      </div>
      <a class="shell-user" href={props.signOutHref}>
        <b>{props.userInitial}</b>
        <span>
          <strong>{props.userName}</strong>
          <small>{props.userContext}</small>
        </span>
      </a>
    </header>

    <main>
      {#if props.children}
        {@render props.children()}
      {/if}
    </main>
  </div>
</div>

<style>
  .ehq-workspace-shell {
    min-height: 100dvh;
    background:
      radial-gradient(circle at 14% 4%, var(--ehq-workspace-accent-bg), transparent 24%),
      radial-gradient(circle at 84% 18%, var(--ehq-yellow-muted), transparent 20%),
      var(--ehq-bg-main);
    color: var(--ehq-text);
    display: grid;
    grid-template-columns: var(--ehq-shell-sidebar-width) minmax(0, 1fr);
  }

  aside {
    min-height: 100dvh;
    padding: var(--ehq-space-4);
    border-right: 1px solid var(--ehq-border-soft);
    background: color-mix(in srgb, var(--ehq-black) 86%, transparent);
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: var(--ehq-space-5);
  }

  .shell-mark {
    width: 42px;
    height: 42px;
    border: 1px solid var(--ehq-yellow-border);
    border-radius: var(--ehq-radius-sm);
    color: var(--ehq-yellow);
    display: inline-grid;
    place-items: center;
    font-family: var(--ehq-display);
    font-size: 24px;
    font-weight: var(--ehq-type-display-weight);
    text-decoration: none;
  }

  nav {
    min-width: 0;
    display: grid;
    align-content: start;
    gap: var(--ehq-space-2);
  }

  .nav-item {
    min-height: 42px;
    padding: 0 var(--ehq-space-3);
    border-radius: var(--ehq-radius-sm);
    color: var(--ehq-text-soft);
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--ehq-space-2);
    text-decoration: none;
  }

  .nav-item.active {
    color: var(--ehq-text);
  }

  .nav-item.disabled {
    color: var(--ehq-text-disabled);
    cursor: not-allowed;
  }

  .nav-icon,
  .nav-label,
  .nav-item strong {
    position: relative;
    z-index: 1;
  }

  .nav-icon {
    color: var(--ehq-workspace-accent);
    font-family: var(--ehq-mono);
    font-size: 11px;
  }

  .nav-label {
    overflow: hidden;
    font-family: var(--ehq-font);
    font-size: 13px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .nav-item strong {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: 10px;
  }

  .shell-status {
    padding: var(--ehq-space-3);
    border: 1px solid var(--ehq-border-soft);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-state-empty-bg);
    display: grid;
    gap: var(--ehq-space-1);
  }

  .shell-status span,
  .shell-user small {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .shell-status strong {
    color: var(--ehq-text);
    font-family: var(--ehq-font);
    font-size: 13px;
    font-weight: var(--ehq-type-heading-weight);
  }

  .shell-main {
    min-width: 0;
    display: grid;
    grid-template-rows: var(--ehq-shell-topbar-height) 1fr;
  }

  .shell-topbar {
    padding: 0 var(--ehq-space-5);
    border-bottom: 1px solid var(--ehq-border-soft);
    display: grid;
    grid-template-columns: auto minmax(180px, 420px) auto;
    align-items: center;
    gap: var(--ehq-space-4);
  }

  .shell-title {
    color: var(--ehq-text);
    font-family: var(--ehq-display);
    font-size: 16px;
    font-weight: var(--ehq-type-heading-weight);
    text-decoration: none;
  }

  .shell-search {
    min-height: 38px;
    padding: 0 var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-pill);
    color: var(--ehq-text-muted);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ehq-space-3);
    font-family: var(--ehq-font);
    font-size: 12px;
  }

  kbd {
    color: var(--ehq-text-soft);
    font-family: var(--ehq-mono);
    font-size: 10px;
  }

  .shell-user {
    color: var(--ehq-text);
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--ehq-space-2);
    text-decoration: none;
  }

  .shell-user b {
    width: 34px;
    height: 34px;
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-yellow);
    color: var(--ehq-text-on-yellow);
    display: grid;
    place-items: center;
    font-family: var(--ehq-font);
    font-size: 13px;
  }

  .shell-user span {
    display: grid;
    gap: 2px;
  }

  .shell-user strong {
    font-family: var(--ehq-font);
    font-size: 13px;
    font-weight: var(--ehq-type-heading-weight);
  }

  main {
    min-width: 0;
  }

  @media (max-width: 980px) {
    .ehq-workspace-shell {
      grid-template-columns: var(--ehq-shell-sidebar-collapsed-width) minmax(0, 1fr);
    }

    aside {
      padding: var(--ehq-space-3);
    }

    .nav-item {
      grid-template-columns: 20px;
      justify-content: center;
    }

    .nav-label,
    .nav-item strong,
    .shell-status {
      display: none;
    }

    .shell-topbar {
      grid-template-columns: auto 1fr;
      padding: 0 var(--ehq-space-4);
    }

    .shell-search {
      display: none;
    }
  }

  @media (max-width: 640px) {
    .ehq-workspace-shell {
      grid-template-columns: 1fr;
    }

    aside {
      min-height: auto;
      border-right: 0;
      border-bottom: 1px solid var(--ehq-border-soft);
      grid-template-rows: auto auto;
    }

    nav {
      overflow-x: auto;
      grid-auto-flow: column;
      grid-auto-columns: max-content;
    }

    .nav-item {
      grid-template-columns: 20px auto;
    }

    .nav-label {
      display: block;
    }

    .shell-main {
      grid-template-rows: auto 1fr;
    }

    .shell-topbar {
      min-height: var(--ehq-shell-topbar-height);
    }
  }
</style>
