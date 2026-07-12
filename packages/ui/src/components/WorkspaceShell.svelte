<script lang="ts">
  import { onMount } from "svelte";
  import type { Snippet } from "svelte";
  import Icon from "./Icon.svelte";
  import type { WorkspaceKind, WorkspaceNavGroup, WorkspaceNavItem } from "./types.js";

  interface Props {
    readonly workspace: WorkspaceKind;
    readonly brandLabel: string;
    readonly homeHref: string;
    readonly navLabel: string;
    readonly navItems: readonly WorkspaceNavItem[];
    readonly navGroups: readonly WorkspaceNavGroup[] | null;
    readonly statusLabel: string;
    readonly statusValue: string;
    readonly userInitial: string;
    readonly userName: string;
    readonly userContext: string;
    readonly signOutHref: string;
    readonly onNavigate: ((href: string) => void) | null;
    readonly onSignOut: (() => void) | null;
    readonly showWorkspaceNav?: boolean;
    readonly footer?: Snippet;
    readonly children?: Snippet;
  }

  const props: Props = $props();
  let sessionMenuOpen = $state(false);
  let navCollapsed = $state(true);
  const showWorkspaceNav = $derived(props.showWorkspaceNav ?? true);
  const collapseStorageKey = $derived(`ehq-shell-nav-collapsed:${props.workspace}`);

  const navGroupList = $derived<readonly WorkspaceNavGroup[]>(
    props.navGroups !== null ? props.navGroups : [{ id: "default", label: "", items: props.navItems }]
  );

  onMount((): void => {
    navCollapsed = props.workspace !== "command-center";
    const raw = window.localStorage.getItem(collapseStorageKey);
    if (raw === "0") {
      navCollapsed = false;
      return;
    }
    if (raw === "1") {
      navCollapsed = true;
    }
  });

  function handleNavClick(item: WorkspaceNavItem, event: MouseEvent): void {
    if (props.onNavigate === null || item.disabled) {
      return;
    }

    event.preventDefault();
    props.onNavigate(item.href);
  }

  function toggleSessionMenu(): void {
    sessionMenuOpen = !sessionMenuOpen;
  }

  function signOut(): void {
    sessionMenuOpen = false;

    if (props.onSignOut === null) {
      return;
    }

    props.onSignOut();
  }

  function toggleNavCollapse(): void {
    navCollapsed = !navCollapsed;
    window.localStorage.setItem(collapseStorageKey, navCollapsed ? "1" : "0");
  }
</script>

<div class={`ehq-workspace-shell ehq-workspace-${props.workspace} ${navCollapsed ? "shell-nav-collapsed" : ""}`}>
  <aside>
    <a class="shell-mark" href={props.homeHref} aria-label={`${props.brandLabel} home`}>ë</a>

    {#if showWorkspaceNav}
      <nav aria-label={props.navLabel}>
        {#each navGroupList as group (group.id)}
          {#if group.label.length > 0}
            <h2 class="nav-group">{group.label}</h2>
          {/if}
          {#each group.items as item (item.href)}
            <a
              class="nav-item ehq-nav-fade-item ehq-edge-surface"
              class:active={item.active}
              class:disabled={item.disabled}
              href={item.disabled ? undefined : item.href}
              aria-current={item.active ? "page" : undefined}
              aria-disabled={item.disabled}
              title={item.label}
              onclick={(event: MouseEvent): void => handleNavClick(item, event)}
            >
              {#if item.icon !== ""}
                <span class="nav-icon" aria-hidden="true"><Icon name={item.icon} size={16} strokeWidth={1.5} /></span>
              {:else}
                <span class="nav-icon" aria-hidden="true"></span>
              {/if}
              <span class="nav-label">{item.label}</span>
              {#if item.badge !== null}
                <strong>{item.badge}</strong>
              {/if}
            </a>
          {/each}
        {/each}
      </nav>
    {/if}

    <div class="shell-foot">
      <section class="shell-status" aria-label="Workspace status">
        <span>{props.statusLabel}</span>
        <strong>{props.statusValue}</strong>
      </section>
      {#if props.footer}
        {@render props.footer()}
      {/if}
    </div>
  </aside>

  <div class="shell-main">
    <header class="shell-topbar">
      <button
        class="shell-collapse"
        type="button"
        aria-label={navCollapsed ? "Expand left menu" : "Collapse left menu"}
        aria-expanded={!navCollapsed}
        title={navCollapsed ? "Expand menu" : "Collapse menu"}
        onclick={toggleNavCollapse}
      >
        <Icon name={navCollapsed ? "arrow-right" : "arrow-left"} size={16} strokeWidth={1.8} />
      </button>
      <a class="shell-title" href={props.homeHref}>{props.brandLabel}</a>
      <div class="shell-search" aria-hidden="true">
        <span>Go to a section</span>
        <kbd>⌘K</kbd>
      </div>
      <div class="shell-user-wrap">
        <button class="shell-user" type="button" aria-haspopup="menu" aria-expanded={sessionMenuOpen} onclick={toggleSessionMenu}>
          <b>{props.userInitial}</b>
          <span>
            <strong>{props.userName}</strong>
            <small>{props.userContext}</small>
          </span>
        </button>

        {#if sessionMenuOpen}
          <section class="shell-session-menu" aria-label="Session actions">
            <header>
              <span>session</span>
              <strong>{props.userName}</strong>
              <small>{props.userContext}</small>
            </header>
            <a href={props.signOutHref} onclick={(event: MouseEvent): void => event.preventDefault()}>Session active</a>
            <button type="button" onclick={signOut}>Sign out</button>
          </section>
        {/if}
      </div>
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
    height: 100dvh;
    min-height: 0;
    overflow: hidden;
    background:
      radial-gradient(circle at 14% 4%, var(--ehq-workspace-accent-bg), transparent 24%),
      radial-gradient(circle at 84% 18%, var(--ehq-yellow-muted), transparent 20%),
      var(--ehq-bg-main);
    color: var(--ehq-text);
    display: grid;
    grid-template-columns: var(--ehq-shell-sidebar-width) minmax(0, 1fr);
    transition: grid-template-columns 220ms var(--ehq-ease);
  }

  .ehq-workspace-shell.shell-nav-collapsed {
    grid-template-columns: var(--ehq-shell-sidebar-collapsed-width) minmax(0, 1fr);
  }

  aside {
    min-height: 0;
    padding: var(--ehq-space-4);
    border-right: 1px solid var(--ehq-border-soft);
    background: color-mix(in srgb, var(--ehq-black) 86%, transparent);
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: var(--ehq-space-5);
    overflow: hidden;
    transition: padding 220ms var(--ehq-ease);
  }

  nav {
    overflow-y: auto;
    transition: padding 220ms var(--ehq-ease), border-color 220ms var(--ehq-ease), background-color 220ms var(--ehq-ease);
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
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    scrollbar-width: none;
  }

  nav::-webkit-scrollbar {
    display: none;
  }

  nav {
    min-width: 0;
    display: grid;
    align-content: start;
    gap: var(--ehq-space-2);
  }

  .nav-group {
    margin: var(--ehq-space-3) 0 var(--ehq-space-1);
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    font-weight: var(--ehq-type-heading-weight);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    transition: opacity 180ms var(--ehq-ease), max-height 180ms var(--ehq-ease), margin 180ms var(--ehq-ease), transform 180ms var(--ehq-ease);
  }

  .nav-group:first-child {
    margin-top: 0;
  }

  .nav-item {
    min-height: 42px;
    padding: 0 var(--ehq-space-3);
    border-radius: var(--ehq-radius-sm);
    color: var(--ehq-text-white);
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--ehq-space-2);
    text-decoration: none;
    transition: width 220ms var(--ehq-ease), padding 220ms var(--ehq-ease), gap 220ms var(--ehq-ease), border-color 180ms var(--ehq-ease), background-color 180ms var(--ehq-ease);
  }

  .nav-item.active {
    color: var(--ehq-text-white);
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
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .nav-label {
    overflow: hidden;
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-menu-size);
    line-height: var(--ehq-type-ui-line);
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: opacity 180ms var(--ehq-ease), max-width 180ms var(--ehq-ease), transform 180ms var(--ehq-ease);
  }

  .nav-item strong {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    transition: opacity 180ms var(--ehq-ease), max-width 180ms var(--ehq-ease), transform 180ms var(--ehq-ease);
  }

  .shell-foot {
    display: grid;
    gap: var(--ehq-space-3);
  }

  .shell-status {
    padding: var(--ehq-space-3);
    border: 1px solid var(--ehq-border-soft);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-state-empty-bg);
    display: grid;
    gap: var(--ehq-space-1);
    transition: opacity 180ms var(--ehq-ease), max-height 180ms var(--ehq-ease), padding 180ms var(--ehq-ease), border-color 180ms var(--ehq-ease);
  }

  .shell-status span,
  .shell-user small {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .shell-status strong {
    color: var(--ehq-text);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-ui-size);
    font-weight: var(--ehq-type-heading-weight);
  }

  .shell-main {
    min-width: 0;
    min-height: 0;
    display: grid;
    grid-template-rows: var(--ehq-shell-topbar-height) 1fr;
  }

  .shell-collapse {
    width: 34px;
    height: 34px;
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-surface);
    color: var(--ehq-text-muted);
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .shell-collapse:hover {
    border-color: var(--ehq-yellow-border);
    color: var(--ehq-yellow);
  }

  .shell-nav-collapsed aside {
    padding: var(--ehq-space-4) var(--ehq-space-2);
    justify-items: center;
  }

  .shell-nav-collapsed .nav-label,
  .shell-nav-collapsed .nav-item strong {
    opacity: 0;
    max-width: 0;
    overflow: hidden;
    transform: translateX(-4px);
    pointer-events: none;
  }

  .shell-nav-collapsed .nav-group {
    opacity: 0;
    max-height: 0;
    margin: 0;
    overflow: hidden;
    transform: translateX(-4px);
    pointer-events: none;
  }

  .shell-nav-collapsed .shell-status {
    opacity: 0;
    max-height: 0;
    padding: 0;
    border-color: transparent;
    overflow: hidden;
    pointer-events: none;
  }

  .shell-nav-collapsed .nav-item {
    grid-template-columns: 20px;
    justify-content: center;
    padding: 0;
    width: 42px;
    min-height: 42px;
  }

  .shell-nav-collapsed .shell-foot {
    justify-items: center;
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
    font-size: var(--ehq-body);
    font-weight: var(--ehq-type-heading-weight);
    text-decoration: none;
  }

  .shell-search {
    min-height: 36px;
    padding: 0 var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-pill);
    color: var(--ehq-text-muted);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ehq-space-3);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-ui-size);
  }

  kbd {
    color: var(--ehq-text-soft);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
  }

  .shell-user-wrap {
    position: relative;
    justify-self: end;
  }

  .shell-user {
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ehq-text);
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: var(--ehq-space-2);
    text-align: left;
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
    font-size: var(--ehq-type-ui-size);
  }

  .shell-user span {
    display: grid;
    gap: 2px;
  }

  .shell-user strong {
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-ui-size);
    font-weight: var(--ehq-type-heading-weight);
  }

  .shell-session-menu {
    position: absolute;
    z-index: 20;
    top: calc(100% + var(--ehq-space-2));
    right: 0;
    width: min(300px, calc(100vw - var(--ehq-space-6)));
    padding: var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-surface);
    box-shadow: var(--ehq-shadow-md);
    display: grid;
    gap: var(--ehq-space-3);
  }

  .shell-session-menu header {
    display: grid;
    gap: var(--ehq-space-1);
  }

  .shell-session-menu span,
  .shell-session-menu small,
  .shell-session-menu a,
  .shell-session-menu button {
    font-family: var(--ehq-mono);
  }

  .shell-session-menu span {
    color: var(--ehq-yellow);
    font-size: var(--ehq-type-label-size);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .shell-session-menu strong {
    font-size: var(--ehq-type-ui-size);
  }

  .shell-session-menu small {
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-label-size);
  }

  .shell-session-menu a,
  .shell-session-menu button {
    min-height: 32px;
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    color: var(--ehq-text-muted);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: var(--ehq-type-action-size);
    font-weight: var(--ehq-type-heading-weight);
    letter-spacing: 0.08em;
    text-decoration: none;
    text-transform: uppercase;
  }

  .shell-session-menu button:hover {
    border-color: var(--ehq-error);
    color: var(--ehq-error);
  }

  main {
    min-width: 0;
    min-height: 0;
    overflow-y: auto;
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

    .shell-nav-collapsed {
      grid-template-columns: 62px minmax(0, 1fr);
    }

    .shell-nav-collapsed .nav-item {
      width: 40px;
    }

    .shell-topbar {
      grid-template-columns: auto 1fr;
      padding: 0 var(--ehq-space-4);
    }

    .shell-search {
      display: none;
    }
  }

  @media (max-width: 768px) {
    .ehq-workspace-shell {
      grid-template-columns: 56px minmax(0, 1fr);
    }

    aside {
      gap: var(--ehq-space-3);
      padding: var(--ehq-space-2);
    }

    .shell-topbar {
      min-height: 64px;
      padding: 0 var(--ehq-space-3);
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
      min-height: 44px;
      scroll-snap-align: start;
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
      grid-template-columns: 1fr auto;
      gap: var(--ehq-space-2);
      padding: 0 var(--ehq-space-3);
    }

    .shell-user {
      gap: 0;
    }

    .shell-user span {
      display: none;
    }
  }

  @media (max-width: 390px) {
    .shell-topbar {
      min-height: 58px;
      padding: 0 var(--ehq-space-2);
    }

    .shell-title {
      font-size: 0.9rem;
    }

    .shell-user b {
      width: 30px;
      height: 30px;
      font-size: 0.8rem;
    }

    .nav-item {
      min-height: 42px;
    }
  }
</style>
