<script lang="ts">
  import type { AuthSession } from "@ehq/auth";

  interface Props {
    readonly session: AuthSession | null;
    readonly onLogout: () => void;
  }

  const { session, onLogout }: Props = $props();

  let menuOpen = $state(false);

  const displayInitials = $derived(session?.initials ?? "ë");
  const displayName = $derived(session?.displayName ?? "Not signed in");
  const displayRole = $derived(session?.roleLabel ?? "public");

  function toggleMenu(): void {
    menuOpen = !menuOpen;
  }

  function logout(): void {
    onLogout();
    menuOpen = false;
  }
</script>

<div class="dev-session">
  <button
    class="profile"
    class:open={menuOpen}
    type="button"
    aria-haspopup="menu"
    aria-expanded={menuOpen}
    aria-label="Session menu"
    onclick={toggleMenu}
  >
    <span>{displayInitials}</span>
    <strong>{displayName}</strong>
    <small>{displayRole}</small>
  </button>

  {#if menuOpen}
    <section class="session-menu" aria-label="Session actions">
      <header>
        <p>session</p>
        <strong>Supabase Auth</strong>
        <small>{session?.userId ?? "no active session"}</small>
      </header>

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
    font-size: var(--ehq-type-label-size);
    font-weight: var(--ehq-type-label-weight);
  }

  .profile strong {
    max-width: 140px;
    overflow: hidden;
    font-size: var(--ehq-type-ui-size);
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
    font-size: var(--ehq-type-label-size);
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
    font-size: var(--ehq-type-label-size);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .session-menu header strong {
    font-size: var(--ehq-type-ui-size);
  }

  .logout {
    min-height: 32px;
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-action-size);
    font-weight: var(--ehq-type-heading-weight);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .logout:hover {
    border-color: var(--ehq-error);
    color: var(--ehq-error);
  }
</style>
