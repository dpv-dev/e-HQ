<script lang="ts">
  import {
    createErrorState,
    createIdleState,
    createLoadingState,
    createSuccessState,
    type ApiRequestState,
    type CommandCenterNotification,
    type CommandCenterNotificationsResponse
  } from "@ehq/api-client";
  import {
    getWorkspaceAccess,
    type AuthSession,
    type WorkspaceAppId
  } from "@ehq/auth";
  import commandCenterScene from "../../../../packages/ui/assets/backgrounds/scene-command-center.svg?url";
  import commandCenterPhoto from "../../../../packages/ui/assets/backgrounds/hq-card-command-center.jpg?url";
  import distributionPhoto from "../../../../packages/ui/assets/backgrounds/hq-card-distribution.jpg?url";
  import officePhoto from "../../../../packages/ui/assets/backgrounds/hq-card-office.jpg?url";
  import { createShellApiClient } from "./app-shell-data.js";
  import type { AppRoute } from "./routes.js";
  import { signInWithSupabasePassword } from "./supabase.js";

  interface Props {
    readonly session: AuthSession | null;
    readonly onLogin: (session: AuthSession) => void;
    readonly onLogout: () => void;
    readonly onNavigate: (route: AppRoute) => void;
    readonly onOpenWorkspace: (workspaceId: WorkspaceAppId) => void;
  }

  interface WorkspaceCard {
    readonly workspaceId: WorkspaceAppId;
    readonly eyebrow: string;
    readonly title: string;
    readonly description: string;
    readonly image: string;
  }

  const { session, onLogin, onLogout, onNavigate, onOpenWorkspace }: Props = $props();
  const client = createShellApiClient();

  let accessRequestedFor = $state<string | null>(null);
  let loginOpen = $state(false);
  let notificationsOpen = $state(false);
  let sessionMenuOpen = $state(false);
  let notificationSessionUserId = $state<string | null>(null);
  let notificationsState = $state<ApiRequestState<CommandCenterNotificationsResponse>>(
    createIdleState<CommandCenterNotificationsResponse>()
  );
  let loginTarget = $state<WorkspaceCard | null>(null);
  let loginEmail = $state("david@eeee.mu");
  let loginPassword = $state("");
  let rememberSession = $state(true);
  let loginMessage = $state("");
  let signingIn = $state(false);

  const cards: readonly WorkspaceCard[] = [
    {
      workspaceId: "command-center",
      eyebrow: "Command Center",
      title: "HQ",
      description: "Manage overall operations and monitoring.",
      image: commandCenterPhoto
    },
    {
      workspaceId: "office",
      eyebrow: "Finance Control",
      title: "Office",
      description: "Manage transactions, payments and financial control.",
      image: officePhoto
    },
    {
      workspaceId: "distribution",
      eyebrow: "Royalty Operations",
      title: "Distribution",
      description: "Manage royalties, imports, mapping and allocations.",
      image: distributionPhoto
    }
  ];

  const isLoggedIn = $derived(session !== null);
  const userInitials = $derived(session?.initials ?? "ë");
  const userName = $derived(session?.displayName ?? "Sign in");
  const userRole = $derived(session?.roleLabel ?? "Public access");
  const notificationItems = $derived(
    notificationsState.status === "success" ? notificationsState.data.items : []
  );
  const notificationUnreadCount = $derived(
    notificationsState.status === "success" ? notificationsState.data.unreadCount : 0
  );

  $effect((): void => {
    const userId = session?.userId ?? null;
    if (userId === null) {
      notificationSessionUserId = null;
      notificationsState = createIdleState<CommandCenterNotificationsResponse>();
      return;
    }

    if (notificationSessionUserId === userId) {
      return;
    }

    notificationSessionUserId = userId;
    void loadNotifications();
  });

  const isAllowed = (workspaceId: WorkspaceAppId): boolean => {
    if (session === null) {
      return true;
    }

    return getWorkspaceAccess(session, workspaceId).status === "allowed";
  };

  const isLocked = (workspaceId: WorkspaceAppId): boolean => session !== null && !isAllowed(workspaceId);

  const openLogin = (card: WorkspaceCard | null): void => {
    loginTarget = card;
    loginMessage = "";
    loginOpen = true;
    sessionMenuOpen = false;
    notificationsOpen = false;
  };

  const closeLogin = (): void => {
    loginOpen = false;
    loginTarget = null;
    loginMessage = "";
  };

  const resolveEmail = (): string => {
    const trimmedEmail = loginEmail.trim();

    if (trimmedEmail.length === 0) {
      return "david@eeee.mu";
    }

    return trimmedEmail;
  };

  const applyLogin = async (email: string): Promise<void> => {
    if (email.length === 0 || loginPassword.trim().length === 0) {
      loginMessage = "Enter your email and password to continue.";
      return;
    }

    signingIn = true;
    loginMessage = "";

    try {
      const nextSession = await signInWithSupabasePassword({
        email,
        password: loginPassword
      });
      onLogin(nextSession);
      loginOpen = false;
      loginTarget = null;
      loginMessage = "";
      accessRequestedFor = null;
    } catch (error: unknown) {
      loginMessage = error instanceof Error ? error.message : "Supabase sign-in failed.";
    } finally {
      signingIn = false;
    }
  };

  const submitLogin = (event: SubmitEvent): void => {
    event.preventDefault();
    void applyLogin(resolveEmail());
  };

  const continueWithSso = (): void => {
    void applyLogin(resolveEmail());
  };

  const forgotPassword = (): void => {
    loginMessage = "Password reset is ready for this account.";
  };

  const toggleNotifications = (): void => {
    notificationsOpen = !notificationsOpen;
    sessionMenuOpen = false;

    if (notificationsOpen && session !== null) {
      void loadNotifications();
    }
  };

  const toggleSessionMenu = (): void => {
    if (session === null) {
      openLogin(null);
      return;
    }

    sessionMenuOpen = !sessionMenuOpen;
    notificationsOpen = false;
  };

  const signOut = (): void => {
    sessionMenuOpen = false;
    notificationsOpen = false;
    onLogout();
  };

  const loadNotifications = async (): Promise<void> => {
    if (session === null) {
      notificationsState = createIdleState<CommandCenterNotificationsResponse>();
      return;
    }

    notificationsState = createLoadingState<CommandCenterNotificationsResponse>();

    try {
      const response = await client.commandCenter.listNotifications({
        workspaceId: "eeee-mu"
      });
      notificationsState = createSuccessState<CommandCenterNotificationsResponse>(response);
    } catch (error: unknown) {
      notificationsState = createErrorState<CommandCenterNotificationsResponse>(error);
    }
  };

  const openNotificationAction = (notification: CommandCenterNotification): void => {
    if (notification.actionHref === null) {
      return;
    }

    notificationsOpen = false;
    onNavigate(notification.actionHref as AppRoute);
  };

  const openWorkspace = (card: WorkspaceCard): void => {
    if (session === null) {
      openLogin(card);
      return;
    }

    if (isAllowed(card.workspaceId)) {
      onOpenWorkspace(card.workspaceId);
      return;
    }

    accessRequestedFor = card.title;
  };
</script>

<svelte:head>
  <title>ë • HQ — workspace</title>
</svelte:head>

<main class="landing-shell" class:fogged={loginOpen}>
  <header class="landing-top">
    <button class="brand" type="button" aria-label="ë • HQ home" onclick={() => onNavigate("/")}>
      <span class="brand-e">ë</span>
    </button>

    <div class="top-right">
      <button class="bell" type="button" aria-label="Notifications" aria-expanded={notificationsOpen} onclick={toggleNotifications}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9a6 6 0 0 1 12 0v4l1.6 2.4a.6.6 0 0 1-.5.9H4.9a.6.6 0 0 1-.5-.9L6 13Z" />
          <path d="M9.5 19a2.5 2.5 0 0 0 5 0" />
        </svg>
        {#if notificationUnreadCount > 0}
          <span class="bell-dot" aria-hidden="true">{notificationUnreadCount}</span>
        {/if}
      </button>
      <button class="user-chip" type="button" aria-haspopup="menu" aria-expanded={sessionMenuOpen} onclick={toggleSessionMenu}>
        <span>{userInitials}</span>
        <strong>{userName}</strong>
        <small>{userRole}</small>
        <svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>

      {#if notificationsOpen}
        <section class="notification-panel" aria-label="Notifications">
          <header>
            <div>
              <p>notifications</p>
              <strong>{isLoggedIn ? "Centre opérationnel" : "Connexion requise"}</strong>
            </div>
            <button class="panel-link" type="button" onclick={loadNotifications} disabled={!isLoggedIn || notificationsState.status === "loading"}>
              actualiser
            </button>
          </header>

          {#if !isLoggedIn}
            <article class="notification-item muted">
              <strong>Session requise</strong>
              <span>Connecte-toi pour charger les alertes live du Command Center.</span>
            </article>
          {:else if notificationsState.status === "loading"}
            <article class="notification-item muted">
              <strong>Chargement</strong>
              <span>Lecture des notifications API.</span>
            </article>
          {:else if notificationsState.status === "error"}
            <article class="notification-item error">
              <strong>Notifications indisponibles</strong>
              <span>{notificationsState.error instanceof Error ? notificationsState.error.message : "Erreur inconnue."}</span>
            </article>
          {:else if notificationItems.length === 0}
            <article class="notification-item muted">
              <strong>Aucune notification</strong>
              <span>Le panneau est prêt.</span>
            </article>
          {:else}
            {#each notificationItems as notification (notification.id)}
              <article class={`notification-item ${notification.tone}`}>
                <div>
                  <strong>{notification.title}</strong>
                  <span>{notification.detail}</span>
                </div>
                {#if notification.actionHref !== null && notification.actionLabel !== null}
                  <button class="panel-link" type="button" onclick={() => openNotificationAction(notification)}>
                    {notification.actionLabel}
                  </button>
                {/if}
              </article>
            {/each}
          {/if}
        </section>
      {/if}

      {#if sessionMenuOpen && session !== null}
        <section class="session-panel" aria-label="Session actions">
          <header>
            <p>session</p>
            <strong>{session.displayName}</strong>
            <span>{session.roleLabel}</span>
          </header>
          <button class="signout-button" type="button" onclick={signOut}>Sign out</button>
        </section>
      {/if}
    </div>
  </header>

  <section class="hero" aria-labelledby="landing-title">
    <div class="hero-copy">
      <h1 id="landing-title">Welcome to <span>ë</span>-HQ</h1>
      <p class="lead">Select your workspace to continue</p>
      <i aria-hidden="true"></i>
    </div>

    <div class="hero-scene" aria-hidden="true">
      <img src={commandCenterScene} alt="" />
    </div>
  </section>

  <section class="workspace-grid" aria-label="Available workspaces">
    {#each cards as card (card.workspaceId)}
      {@const locked = isLocked(card.workspaceId)}
      <article class:locked class:live={!locked} class={`workspace-card accent-${card.workspaceId}`}>
        {#if locked}
          <div class="cross" aria-label="Access denied">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </div>
        {/if}

        <div class="photo">
          <img src={card.image} alt="" />
        </div>

        <div class="workspace-copy">
          <div class="card-head">
            <span class="hexicon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M12 2.6 20.5 7.3v9.4L12 21.4 3.5 16.7V7.3Z" /></svg>
            </span>
            <h2>{card.title}</h2>
          </div>
          <p class="card-sub">{card.eyebrow}</p>
          <p class="card-desc">{card.description}</p>
          <div class="workspace-actions">
            {#if locked}
              <button class="locked-button" type="button" onclick={() => openWorkspace(card)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                access denied
              </button>
              <button class="request-link" type="button" onclick={() => openWorkspace(card)}>request access →</button>
            {:else}
              <button class="enter-button" type="button" onclick={() => openWorkspace(card)}>
                Enter {card.title} <span aria-hidden="true">→</span>
              </button>
            {/if}
          </div>
        </div>
      </article>
    {/each}
  </section>

  <footer>
    <span>© 2026 ë-HQ. All rights reserved.</span>
    <span>Privacy Policy · Terms of Service</span>
  </footer>

  {#if accessRequestedFor !== null}
    <p class="request-note" role="status">Access request prepared for {accessRequestedFor}.</p>
  {/if}
</main>

{#if loginOpen}
  <section class="login-fog" aria-label="Sign in overlay">
    <form class="login-window" onsubmit={submitLogin}>
      <button class="close-button" type="button" aria-label="Close sign in" onclick={closeLogin}>close</button>
      <p class="eyebrow">{`{ sign in }`}</p>
      <h2>welcome back</h2>
      <p class="login-lead">
        {#if loginTarget === null}
          Sign in to reveal your workspace permissions.
        {:else}
          Sign in to open {loginTarget.title} if your profile allows it.
        {/if}
      </p>

      <label class="field">
        <span>email</span>
        <input bind:value={loginEmail} autocomplete="username" inputmode="email" type="email" />
      </label>

      <label class="field">
        <span>password</span>
        <input
          bind:value={loginPassword}
          autocomplete="current-password"
          placeholder="••••••••••"
          type="password"
        />
      </label>

      <div class="form-row">
        <label class="remember">
          <input bind:checked={rememberSession} type="checkbox" />
          remember me
        </label>
        <button class="plain-link" type="button" onclick={forgotPassword}>forgot password?</button>
      </div>

      <button class="submit-button" type="submit" disabled={signingIn}>
        {signingIn ? "signing in" : "sign in"} <span aria-hidden="true">→</span>
      </button>
      <div class="separator">or</div>
      <button class="sso-button" type="button" disabled={signingIn} onclick={continueWithSso}>continue with ë sso</button>

      {#if loginMessage.length > 0}
        <p class="login-message" role="status">{loginMessage}</p>
      {/if}
    </form>
  </section>
{/if}

<style>
  :global(body) {
    overflow: hidden;
  }

  .landing-shell {
    height: 100dvh;
    min-height: 0;
    padding: clamp(var(--ehq-space-4), 2.4vh, var(--ehq-space-5)) clamp(var(--ehq-space-5), 4vw, var(--ehq-space-8));
    background: var(--ehq-bg-main);
    color: var(--ehq-text);
    display: flex;
    flex-direction: column;
    gap: clamp(var(--ehq-space-3), 2vh, var(--ehq-space-4));
    overflow: hidden;
  }

  .landing-shell.fogged {
    filter: saturate(0.82);
  }

  .landing-top,
  .top-right,
  footer {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ehq-space-4);
  }

  .top-right {
    position: relative;
  }

  .brand,
  .user-chip {
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ehq-text);
  }

  .brand {
    display: inline-flex;
    align-items: baseline;
    gap: var(--ehq-space-2);
  }

  .brand-e {
    color: var(--ehq-yellow);
    font-size: 26px;
    font-weight: var(--ehq-type-display-weight);
    line-height: 1;
  }

  .eyebrow,
  .request-link,
  .request-note,
  footer,
  .locked-button,
  .enter-button,
  .field span,
  .form-row,
  .plain-link,
  .separator,
  .submit-button,
  .sso-button,
  .login-message,
  .close-button,
  .notification-panel p,
  .notification-panel span,
  .panel-link,
  .session-panel p,
  .session-panel span,
  .signout-button {
    font-family: var(--ehq-mono);
  }

  .bell {
    position: relative;
    width: 38px;
    height: 38px;
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-surface-high);
    color: var(--ehq-text-soft);
    display: grid;
    place-items: center;
  }

  .bell svg {
    width: 18px;
    height: 18px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .bell-dot {
    position: absolute;
    top: 1px;
    right: 1px;
    min-width: 15px;
    height: 15px;
    padding: 0 3px;
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-yellow);
    color: var(--ehq-text-on-yellow);
    box-shadow: 0 0 0 2px var(--ehq-bg-main);
    display: grid;
    place-items: center;
    font-family: var(--ehq-mono);
    font-size: 9px;
    font-weight: 600;
  }

  .chev {
    grid-row: span 2;
    width: 16px;
    height: 16px;
    fill: none;
    stroke: var(--ehq-text-muted);
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .user-chip {
    display: grid;
    grid-template-columns: auto auto auto;
    align-items: center;
    column-gap: var(--ehq-space-2);
    text-align: left;
  }

  .user-chip span {
    grid-row: span 2;
    width: 30px;
    height: 30px;
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-surface-high);
    color: var(--ehq-yellow);
    display: grid;
    place-items: center;
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-caption-size);
    font-weight: var(--ehq-type-label-weight);
  }

  .user-chip strong {
    font-size: var(--ehq-type-ui-size);
    line-height: var(--ehq-type-ui-line);
    text-transform: none;
  }

  .user-chip small {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
  }

  .notification-panel,
  .session-panel {
    position: absolute;
    top: calc(100% + var(--ehq-space-2));
    right: 0;
    z-index: 12;
    width: min(380px, calc(100vw - var(--ehq-space-6)));
    padding: var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-surface);
    box-shadow: var(--ehq-shadow-lg);
    display: grid;
    gap: var(--ehq-space-3);
  }

  .session-panel {
    width: min(300px, calc(100vw - var(--ehq-space-6)));
  }

  .notification-panel header,
  .session-panel header,
  .notification-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ehq-space-3);
  }

  .notification-panel p,
  .session-panel p,
  .notification-panel strong,
  .session-panel strong,
  .notification-panel span,
  .session-panel span {
    margin: 0;
  }

  .notification-panel p,
  .session-panel p {
    color: var(--ehq-yellow);
    font-size: var(--ehq-type-label-size);
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .notification-panel header strong,
  .session-panel strong {
    display: block;
    margin-top: var(--ehq-space-1);
    font-size: var(--ehq-type-ui-size);
    line-height: var(--ehq-type-ui-line);
  }

  .session-panel span {
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-label-size);
  }

  .notification-item {
    padding: var(--ehq-space-2);
    border: 1px solid var(--ehq-border-soft);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-bg-main);
  }

  .notification-item div {
    min-width: 0;
    display: grid;
    gap: var(--ehq-space-1);
  }

  .notification-item strong {
    font-size: var(--ehq-type-ui-size);
    line-height: var(--ehq-type-ui-line);
  }

  .notification-item span {
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-label-size);
    line-height: 1.45;
  }

  .notification-item.success {
    border-color: color-mix(in srgb, var(--ehq-success) 40%, var(--ehq-border));
  }

  .notification-item.warning {
    border-color: var(--ehq-yellow-border);
  }

  .notification-item.error {
    border-color: var(--ehq-error);
  }

  .notification-item.muted,
  .notification-item.info {
    border-color: var(--ehq-border-soft);
  }

  .panel-link,
  .signout-button {
    flex: 0 0 auto;
    min-height: 30px;
    padding: 0 var(--ehq-space-2);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    color: var(--ehq-text);
    font-size: var(--ehq-type-label-size);
    font-weight: var(--ehq-type-heading-weight);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .panel-link:hover,
  .signout-button:hover {
    border-color: var(--ehq-yellow-border);
    color: var(--ehq-yellow);
  }

  .panel-link:disabled {
    color: var(--ehq-text-disabled);
    cursor: not-allowed;
  }

  .hero {
    flex: 1 1 46%;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
    align-items: center;
    gap: clamp(var(--ehq-space-4), 3vw, var(--ehq-space-6));
  }

  .hero-copy {
    min-width: 0;
  }

  .eyebrow,
  .field span {
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
    letter-spacing: 0.22em;
    text-transform: uppercase;
  }

  h1,
  h2,
  p {
    margin: 0;
  }

  h1 {
    margin-top: var(--ehq-space-3);
    font-size: clamp(30px, 4.3vw, 50px);
    font-weight: var(--ehq-type-display-weight);
    line-height: 1;
    letter-spacing: 0;
    text-transform: none;
  }

  h1 span {
    color: var(--ehq-yellow);
  }

  .lead {
    max-width: 45ch;
    margin-top: var(--ehq-space-3);
    color: var(--ehq-text-soft);
    font-size: var(--ehq-type-ui-size);
    font-weight: 300;
    line-height: var(--ehq-type-ui-line);
  }

  .hero-copy i {
    display: block;
    width: 84px;
    height: 2px;
    margin-top: var(--ehq-space-4);
    background: var(--ehq-yellow);
  }

  .hero-scene {
    min-height: clamp(220px, 34vh, 360px);
    height: 100%;
    display: grid;
    place-items: center;
  }

  .hero-scene img {
    width: min(100%, 760px);
    height: auto;
    max-height: min(40vh, 360px);
    object-fit: contain;
    object-position: center bottom;
    filter: drop-shadow(0 24px 50px var(--ehq-black));
  }

  .workspace-grid {
    flex: 0 1 44%;
    min-height: 0;
    display: flex;
    align-items: stretch;
    justify-content: space-between;
    gap: clamp(var(--ehq-space-3), 1.4vw, var(--ehq-space-4));
  }

  .workspace-card {
    position: relative;
    --card-accent: var(--ehq-yellow);
    flex: 0 1 clamp(230px, 28vw, 340px);
    min-width: 0;
    min-height: 0;
    max-width: 340px;
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-surface);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transition:
      transform var(--ehq-transition-normal) var(--ehq-ease),
      border-color var(--ehq-transition-fast) var(--ehq-ease);
  }

  .workspace-card.live:hover {
    transform: translateY(calc(var(--ehq-space-1) * -1));
    border-color: var(--ehq-yellow-border);
  }

  .workspace-card.locked {
    border-color: var(--ehq-error);
  }

  /* Per-workspace accent on the landing (matches the visual identity). */
  .accent-office {
    --card-accent: #E6E8EC;
  }

  .accent-distribution {
    --card-accent: #FF7A1A;
  }

  .photo {
    position: relative;
    flex: 0 0 auto;
    height: clamp(150px, 17vh, 200px);
    overflow: hidden;
  }

  .photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: brightness(0.8) saturate(0.95);
    transform: scale(1.02);
    transition:
      transform var(--ehq-transition-normal) var(--ehq-ease),
      filter var(--ehq-transition-normal) var(--ehq-ease);
  }

  .workspace-card.live:hover .photo img {
    filter: brightness(1) saturate(1.05);
    transform: scale(1.06);
  }

  .photo::after {
    content: "";
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, transparent 45%, var(--ehq-surface) 100%);
    opacity: 0.9;
  }

  .card-head {
    display: flex;
    align-items: center;
    gap: var(--ehq-space-2);
  }

  .hexicon {
    flex: 0 0 auto;
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    color: var(--card-accent);
  }

  .hexicon svg {
    width: 22px;
    height: 22px;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
    stroke-linejoin: round;
  }

  .card-head h2 {
    font-size: clamp(22px, 2.4vw, 30px);
    font-weight: var(--ehq-type-display-weight);
    line-height: 1;
    letter-spacing: 0;
    text-transform: none;
  }

  .card-sub {
    color: var(--card-accent);
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .workspace-copy {
    flex: 1 1 auto;
    padding: var(--ehq-space-4);
    display: flex;
    flex-direction: column;
    gap: var(--ehq-space-1);
  }

  .card-desc {
    margin-top: var(--ehq-space-1);
    color: var(--ehq-text-soft);
    font-size: var(--ehq-type-ui-size);
    font-weight: 400;
    line-height: var(--ehq-type-ui-line);
  }

  .workspace-actions {
    margin-top: auto;
    padding-top: var(--ehq-space-3);
    display: grid;
    gap: var(--ehq-space-2);
  }

  .enter-button,
  .locked-button {
    width: 100%;
    min-height: 40px;
    padding: 0 var(--ehq-space-3);
    border-radius: var(--ehq-radius-sm);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--ehq-space-2);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-ui-size);
    font-weight: var(--ehq-type-heading-weight);
    letter-spacing: 0.04em;
    text-transform: none;
  }

  .enter-button {
    border: 1px solid color-mix(in srgb, var(--card-accent) 55%, transparent);
    background: color-mix(in srgb, var(--card-accent) 10%, transparent);
    color: var(--card-accent);
  }

  .workspace-card.live:hover .enter-button {
    border-color: var(--card-accent);
    background: color-mix(in srgb, var(--card-accent) 16%, transparent);
  }

  .enter-button span {
    transition: transform var(--ehq-transition-normal) var(--ehq-ease);
  }

  .enter-button:hover span {
    transform: translateX(var(--ehq-space-1));
  }

  .locked-button {
    border: 1px solid var(--ehq-error);
    background: var(--ehq-error-bg);
    color: var(--ehq-error);
  }

  .locked-button svg,
  .cross svg {
    width: 14px;
    height: 14px;
    stroke: currentColor;
    stroke-width: 2.6;
    fill: none;
  }

  .request-link {
    width: fit-content;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
    text-align: left;
  }

  .request-link:hover {
    color: var(--ehq-error);
  }

  .cross {
    position: absolute;
    top: var(--ehq-space-3);
    right: var(--ehq-space-3);
    z-index: 2;
    width: 38px;
    height: 38px;
    border: 1px solid var(--ehq-error);
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-error-bg);
    color: var(--ehq-error);
    display: grid;
    place-items: center;
  }

  footer {
    padding-top: clamp(var(--ehq-space-2), 1.6vh, var(--ehq-space-4));
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
  }

  .request-note {
    position: fixed;
    right: var(--ehq-space-5);
    bottom: var(--ehq-space-5);
    z-index: 5;
    margin: 0;
    padding: var(--ehq-space-2) var(--ehq-space-3);
    border: 1px solid var(--ehq-yellow-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-surface);
    color: var(--ehq-yellow);
    font-size: var(--ehq-type-caption-size);
  }

  .login-fog {
    position: fixed;
    inset: 0;
    z-index: 20;
    padding: var(--ehq-space-4);
    background: color-mix(in srgb, var(--ehq-bg-main) 74%, transparent);
    backdrop-filter: blur(18px);
    display: grid;
    place-items: center;
  }

  .login-window {
    position: relative;
    width: min(100%, 420px);
    padding: var(--ehq-space-5);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background:
      radial-gradient(circle at 12% 0%, var(--ehq-yellow-muted), transparent 18rem),
      var(--ehq-surface);
    box-shadow: var(--ehq-shadow-lg);
  }

  .close-button {
    position: absolute;
    top: var(--ehq-space-3);
    right: var(--ehq-space-3);
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-label-size);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .close-button:hover {
    color: var(--ehq-yellow);
  }

  .login-window h2 {
    margin-top: var(--ehq-space-3);
    font-size: 34px;
    line-height: 1;
    letter-spacing: 0;
    text-transform: lowercase;
  }

  .login-lead {
    margin-top: var(--ehq-space-2);
    color: var(--ehq-text-soft);
    font-size: var(--ehq-type-ui-size);
    line-height: var(--ehq-type-ui-line);
  }

  .field {
    display: grid;
    gap: var(--ehq-space-2);
    margin-top: var(--ehq-space-4);
  }

  .field input {
    width: 100%;
    min-height: 44px;
    padding: 0 var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-bg-main);
    color: var(--ehq-text);
    color-scheme: dark;
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-control-size);
    line-height: var(--ehq-type-ui-line);
  }

  .field input:focus {
    outline: none;
    border-color: var(--ehq-yellow-border);
    box-shadow: 0 0 0 3px var(--ehq-yellow-muted);
  }

  .field input::placeholder {
    color: var(--ehq-text-muted);
  }

  :global(.login-fog input:-webkit-autofill),
  :global(.login-fog input:-webkit-autofill:hover),
  :global(.login-fog input:-webkit-autofill:focus) {
    caret-color: var(--ehq-text);
    transition: background-color 9999s ease-in-out 0s;
    -webkit-box-shadow: 0 0 0 1000px var(--ehq-bg-main) inset;
    -webkit-text-fill-color: var(--ehq-text);
  }

  .form-row {
    margin-top: var(--ehq-space-3);
    color: var(--ehq-text-soft);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ehq-space-3);
    font-size: var(--ehq-type-caption-size);
  }

  .remember {
    display: inline-flex;
    align-items: center;
    gap: var(--ehq-space-2);
  }

  .remember input {
    accent-color: var(--ehq-yellow);
  }

  .plain-link {
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
  }

  .plain-link:hover {
    color: var(--ehq-yellow);
  }

  .submit-button,
  .sso-button {
    width: 100%;
    min-height: 44px;
    border-radius: var(--ehq-radius-sm);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-action-size);
    font-weight: var(--ehq-type-heading-weight);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .submit-button {
    margin-top: var(--ehq-space-4);
    border: 1px solid var(--ehq-yellow);
    background: var(--ehq-yellow);
    color: var(--ehq-text-on-yellow);
  }

  .separator {
    margin: var(--ehq-space-4) 0;
    color: var(--ehq-text-muted);
    display: flex;
    align-items: center;
    gap: var(--ehq-space-3);
    font-size: var(--ehq-type-label-size);
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .separator::before,
  .separator::after {
    content: "";
    height: 1px;
    flex: 1;
    background: var(--ehq-border);
  }

  .sso-button {
    border: 1px solid var(--ehq-border);
    background: transparent;
    color: var(--ehq-text);
  }

  .sso-button:hover {
    border-color: var(--ehq-yellow-border);
  }

  .login-message {
    margin-top: var(--ehq-space-3);
    color: var(--ehq-yellow);
    font-size: var(--ehq-type-caption-size);
  }

  @media (min-width: 921px) and (max-height: 760px) {
    .landing-shell {
      gap: var(--ehq-space-3);
    }

    .hero {
      flex-basis: 38%;
    }

    .hero-scene {
      min-height: clamp(180px, 30vh, 300px);
    }

    .lead {
      font-size: var(--ehq-type-ui-size);
    }

    .workspace-copy {
      padding: var(--ehq-space-3);
    }
  }

  @media (max-width: 920px) {
    .landing-shell {
      padding: var(--ehq-space-3);
      gap: var(--ehq-space-3);
    }

    .hero-scene {
      display: none;
    }

    .landing-top,
    footer {
      align-items: center;
    }

    .hero {
      flex: 0 0 auto;
      grid-template-columns: 1fr;
      padding: var(--ehq-space-1) 0 0;
    }

    h1 {
      margin-top: var(--ehq-space-2);
      font-size: clamp(28px, 10vw, 40px);
    }

    .lead {
      margin-top: var(--ehq-space-2);
      font-size: var(--ehq-type-ui-size);
    }

    .hero-copy i {
      margin-top: var(--ehq-space-3);
    }

    .workspace-grid {
      flex: 1 1 auto;
      display: grid;
      grid-template-columns: 1fr;
      gap: var(--ehq-space-2);
    }

    .workspace-card {
      max-width: none;
      flex-direction: row;
      align-items: stretch;
    }

    .photo {
      flex: 0 0 30%;
    }

    .workspace-copy {
      flex: 1 1 auto;
      min-width: 0;
      padding: var(--ehq-space-3);
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .workspace-actions {
      margin-top: var(--ehq-space-2);
    }

    .enter-button,
    .locked-button {
      min-height: 36px;
      padding: 0 var(--ehq-space-3);
      font-size: var(--ehq-type-action-size);
    }

    footer {
      font-size: var(--ehq-type-label-size);
    }
  }

  @media (max-width: 920px) and (max-height: 640px) {
    .lead,
    footer {
      display: none;
    }
  }
</style>
