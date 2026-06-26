<script lang="ts">
  import {
    allWorkspaces,
    createPreviewAuthSession,
    createPreviewPermissionUsers,
    getWorkspaceAccess,
    type AuthRoleId,
    type AuthSession,
    type PreviewPermissionUser,
    type WorkspaceAppId
  } from "@ehq/auth";

  interface Props {
    readonly session: AuthSession | null;
    readonly onSessionChange: (session: AuthSession) => void;
    readonly onLogout: () => void;
  }

  const { session, onSessionChange, onLogout }: Props = $props();
  const profiles: readonly PreviewPermissionUser[] = createPreviewPermissionUsers();
  const showDevSessionSwitcher = import.meta.env.DEV;

  let menuOpen = $state(false);

  const displayInitials = $derived(session?.initials ?? "ë");
  const displayName = $derived(session?.displayName ?? "Not signed in");
  const displayRole = $derived(session?.roleLabel ?? "public");

  function toggleMenu(): void {
    if (!showDevSessionSwitcher) {
      return;
    }

    menuOpen = !menuOpen;
  }

  function selectRole(roleId: AuthRoleId): void {
    onSessionChange(createPreviewAuthSession(roleId));
    menuOpen = false;
  }

  function logout(): void {
    onLogout();
    menuOpen = false;
  }

  function formatAccess(profile: PreviewPermissionUser): string {
    const allowedWorkspaces = allWorkspaces.filter(
      (workspaceId: WorkspaceAppId): boolean => getWorkspaceAccess(profile.session, workspaceId).status === "allowed"
    );

    if (allowedWorkspaces.length === 0) {
      return "no workspaces";
    }

    return allowedWorkspaces.join(" · ");
  }
</script>

<div class="dev-session">
  <button
    class="profile"
    class:open={menuOpen}
    type="button"
    aria-haspopup={showDevSessionSwitcher}
    aria-expanded={menuOpen}
    aria-label="Preview session menu"
    onclick={toggleMenu}
  >
    <span>{displayInitials}</span>
    <strong>{displayName}</strong>
    <small>{displayRole}</small>
  </button>

  {#if showDevSessionSwitcher && menuOpen}
    <section class="session-menu" aria-label="Dev preview session switcher">
      <header>
        <p>dev session</p>
        <strong>@ehq/auth preview</strong>
      </header>

      <div class="profile-list">
        {#each profiles as profile (profile.userId)}
          <button
            class:active={session?.roleId === profile.roleId}
            type="button"
            onclick={() => selectRole(profile.roleId)}
          >
            <span>{profile.initials}</span>
            <strong>{profile.displayName}</strong>
            <small>{formatAccess(profile)}</small>
          </button>
        {/each}
      </div>

      <button class="logout" type="button" onclick={logout}>Sign out</button>
    </section>
  {/if}
</div>

<style>
  .dev-session {
    position: relative;
    flex: 0 0 auto;
  }

  .profile {
    min-height: 38px;
    padding: var(--ehq-space-1) var(--ehq-space-2);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    color: var(--ehq-text);
    display: grid;
    grid-template-columns: 28px auto;
    column-gap: var(--ehq-space-2);
    align-items: center;
    text-align: left;
  }

  .profile.open,
  .profile:hover {
    border-color: var(--ehq-yellow-border);
  }

  .profile span {
    grid-row: span 2;
    width: 28px;
    height: 28px;
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-surface-high);
    color: var(--ehq-yellow);
    display: grid;
    place-items: center;
    font-family: var(--ehq-mono);
    font-size: 10px;
    font-weight: var(--ehq-type-label-weight);
  }

  .profile strong {
    max-width: 140px;
    overflow: hidden;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .profile small,
  .session-menu p,
  .session-menu small,
  .logout {
    font-family: var(--ehq-mono);
  }

  .profile small {
    color: var(--ehq-text-muted);
    font-size: 10px;
  }

  .session-menu {
    position: absolute;
    z-index: 20;
    top: calc(100% + var(--ehq-space-2));
    right: 0;
    width: min(320px, calc(100vw - var(--ehq-space-6)));
    padding: var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-surface);
    box-shadow: var(--ehq-shadow-md);
    display: grid;
    gap: var(--ehq-space-3);
  }

  .session-menu header {
    display: grid;
    gap: var(--ehq-space-1);
  }

  .session-menu p,
  .session-menu strong,
  .session-menu small {
    margin: 0;
  }

  .session-menu p {
    color: var(--ehq-yellow);
    font-size: 10px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .session-menu header strong {
    font-size: 13px;
  }

  .profile-list {
    display: grid;
    gap: var(--ehq-space-2);
  }

  .profile-list button {
    min-height: 56px;
    padding: var(--ehq-space-2);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-bg-main);
    color: var(--ehq-text);
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr);
    column-gap: var(--ehq-space-2);
    align-items: center;
    text-align: left;
  }

  .profile-list button.active {
    border-color: var(--ehq-yellow-border);
    box-shadow: 0 0 0 3px var(--ehq-yellow-muted);
  }

  .profile-list button span {
    grid-row: span 2;
    width: 30px;
    height: 30px;
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-surface-high);
    color: var(--ehq-yellow);
    display: grid;
    place-items: center;
    font-family: var(--ehq-mono);
    font-size: 10px;
    font-weight: var(--ehq-type-label-weight);
  }

  .profile-list button strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .profile-list button small {
    color: var(--ehq-text-muted);
    font-size: 10px;
  }

  .logout {
    min-height: 32px;
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    color: var(--ehq-text-muted);
    font-size: 10px;
    font-weight: var(--ehq-type-heading-weight);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .logout:hover {
    border-color: var(--ehq-error);
    color: var(--ehq-error);
  }
</style>
