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
  import { Button, Checkbox, Loader } from "@ehq/ui";
  import landingBackground from "../../../../packages/ui/assets/backgrounds/hq-landing-command-room.webp?url";
  import { createShellApiClient } from "./app-shell-data.js";
  import type { AppRoute } from "./routes.js";
  import { sendSupabasePasswordReset, signInWithSupabasePassword } from "./supabase.js";

  interface Props {
    readonly session: AuthSession | null;
    readonly onLogin: (session: AuthSession) => void;
    readonly onLogout: () => void;
    readonly onNavigate: (route: AppRoute) => void;
    readonly onOpenWorkspace: (workspaceId: WorkspaceAppId) => void;
    readonly onPrefetchWorkspace: (workspaceId: WorkspaceAppId) => void;
    readonly loginMode?: boolean;
  }

  interface WorkspaceCard {
    readonly workspaceId: WorkspaceAppId;
    readonly eyebrow: string;
    readonly title: string;
    readonly description: string;
  }

  type MessageTone = "info" | "error";

  const { session, onLogin, onLogout, onNavigate, onOpenWorkspace, onPrefetchWorkspace, loginMode = false }: Props = $props();
  const client = createShellApiClient();

  let loginOpen = $state(false);
  let notificationsOpen = $state(false);
  let sessionMenuOpen = $state(false);
  let notificationSessionUserId = $state<string | null>(null);
  let notificationsState = $state<ApiRequestState<CommandCenterNotificationsResponse>>(
    createIdleState<CommandCenterNotificationsResponse>()
  );
  let loginTarget = $state<WorkspaceCard | null>(null);
  let loginEmail = $state("");
  let loginPassword = $state("");
  let rememberSession = $state(true);
  let loginMessage = $state("");
  let loginMessageTone = $state<MessageTone>("info");
  let emailInvalid = $state(false);
  let passwordInvalid = $state(false);
  let signingIn = $state(false);
  let resettingPassword = $state(false);

  const cards: readonly WorkspaceCard[] = [
    {
      workspaceId: "office",
      eyebrow: "Finance Control",
      title: "Office",
      description: "Manage transactions and financial control."
    },
    {
      workspaceId: "distribution",
      eyebrow: "Royalty Operations",
      title: "Distribution",
      description: "Manage royalties and allocations."
    },
    {
      workspaceId: "command-center",
      eyebrow: "Command Center",
      title: "HQ",
      description: "Manage overall operations and monitoring."
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
    loginMessageTone = "info";
    emailInvalid = false;
    passwordInvalid = false;
    loginOpen = true;
    sessionMenuOpen = false;
    notificationsOpen = false;
  };

  const closeLogin = (): void => {
    if (loginMode) {
      onNavigate("/");
      return;
    }

    loginOpen = false;
    loginTarget = null;
    loginMessage = "";
    loginMessageTone = "info";
    emailInvalid = false;
    passwordInvalid = false;
  };

  const applyLogin = async (email: string): Promise<void> => {
    emailInvalid = email.length === 0;
    passwordInvalid = loginPassword.trim().length === 0;

    if (emailInvalid || passwordInvalid) {
      loginMessageTone = "error";
      loginMessage = "Enter your email and password to continue.";
      return;
    }

    signingIn = true;
    loginMessage = "";

    try {
      const selectedWorkspace = !loginMode ? loginTarget?.workspaceId ?? null : null;
      const nextSession = await signInWithSupabasePassword({
        email,
        password: loginPassword
      });
      onLogin(nextSession);

      if (
        selectedWorkspace !== null &&
        getWorkspaceAccess(nextSession, selectedWorkspace).status === "allowed"
      ) {
        onOpenWorkspace(selectedWorkspace);
      }

      loginOpen = false;
      loginTarget = null;
      loginMessage = "";
      loginMessageTone = "info";
    } catch (error: unknown) {
      loginMessageTone = "error";
      loginMessage = error instanceof Error ? error.message : "Supabase sign-in failed.";
    } finally {
      signingIn = false;
    }
  };

  const submitLogin = (event: SubmitEvent): void => {
    event.preventDefault();
    void applyLogin(loginEmail.trim());
  };

  const forgotPassword = async (): Promise<void> => {
    const trimmedEmail = loginEmail.trim();

    if (trimmedEmail.length === 0) {
      emailInvalid = true;
      loginMessageTone = "error";
      loginMessage = "Enter your email above to receive a reset link.";
      return;
    }

    resettingPassword = true;
    loginMessage = "";

    try {
      await sendSupabasePasswordReset(trimmedEmail);
      loginMessageTone = "info";
      loginMessage = `Password reset email sent to ${trimmedEmail}.`;
    } catch (error: unknown) {
      loginMessageTone = "error";
      loginMessage = error instanceof Error ? error.message : "Supabase password reset failed.";
    } finally {
      resettingPassword = false;
    }
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
    }
  };

  $effect((): void => {
    if (!loginMode || session !== null || loginOpen) {
      return;
    }

    openLogin(null);
  });
</script>

<svelte:head>
  <title>ë • HQ — workspace</title>
</svelte:head>

<main class="landing-shell" class:fogged={loginOpen}>
  <img class="landing-background" src={landingBackground} alt="" aria-hidden="true" fetchpriority="high" decoding="async" />
  <div class="map-sparkles" aria-hidden="true">
    <span class="sparkle s1"></span>
    <span class="sparkle s2"></span>
    <span class="sparkle s3"></span>
    <span class="sparkle s4"></span>
    <span class="sparkle s5"></span>
    <span class="sparkle s6"></span>
    <span class="sparkle s7"></span>
    <span class="sparkle s8"></span>
    <span class="sparkle s9"></span>
    <span class="sparkle s10"></span>
    <span class="sparkle s11"></span>
    <span class="sparkle s12"></span>
    <span class="sparkle s13"></span>
    <span class="sparkle s14"></span>
    <span class="sparkle s15"></span>
    <span class="sparkle s16"></span>
    <span class="sparkle s17"></span>
    <span class="sparkle s18"></span>
    <span class="sparkle s19"></span>
    <span class="sparkle s20"></span>
    <span class="signal-flow f1"></span>
    <span class="signal-flow f2"></span>
    <span class="signal-flow f3"></span>
    <span class="signal-flow f4"></span>
    <span class="signal-flow f5"></span>
    <span class="signal-flow f6"></span>
  </div>

  <header class="landing-top">
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
              <strong>{isLoggedIn ? "Operations center" : "Sign-in required"}</strong>
            </div>
            <Button
              label="refresh"
              variant="secondary"
              size="small"
              type="button"
              disabled={!isLoggedIn}
              loading={notificationsState.status === "loading"}
              locked={false}
              focus={false}
              ariaLabel="Refresh notifications"
              title={isLoggedIn
                ? "Reload Command Center notifications."
                : "Sign in to load live Command Center alerts."}
              onclick={loadNotifications}
            />
          </header>

          {#if !isLoggedIn}
            <article class="notification-item muted">
              <strong>Session required</strong>
              <span>Sign in to load live Command Center alerts.</span>
            </article>
          {:else if notificationsState.status === "loading"}
            <Loader label="Loading" detail="Reading API notifications." size="small" />
          {:else if notificationsState.status === "error"}
            <article class="notification-item error">
              <strong>Notifications unavailable</strong>
              <span>{notificationsState.error instanceof Error ? notificationsState.error.message : "Unknown error."}</span>
            </article>
          {:else if notificationItems.length === 0}
            <article class="notification-item muted">
              <strong>No notifications</strong>
              <span>The panel is ready.</span>
            </article>
          {:else}
            {#each notificationItems as notification (notification.id)}
              <article class={`notification-item ${notification.tone}`}>
                <div>
                  <strong>{notification.title}</strong>
                  <span>{notification.detail}</span>
                </div>
                {#if notification.actionHref !== null && notification.actionLabel !== null}
                  <Button
                    label={notification.actionLabel}
                    variant="secondary"
                    size="small"
                    type="button"
                    disabled={false}
                    loading={false}
                    locked={false}
                    focus={false}
                    ariaLabel={notification.actionLabel}
                    onclick={() => openNotificationAction(notification)}
                  />
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
          <Button
            label="Sign out"
            variant="secondary"
            size="small"
            type="button"
            disabled={false}
            loading={false}
            locked={false}
            focus={false}
            ariaLabel="Sign out"
            onclick={signOut}
          />
        </section>
      {/if}
    </div>
  </header>

  <section class="hero" aria-labelledby="landing-title">
    <div class="hero-copy">
      <h1 id="landing-title" aria-label="Welcome to ë-HQ">
        Welcome to
        <svg class="title-e" viewBox="0 0 50 72" aria-hidden="true">
          <text x="25" y="59" text-anchor="middle" font-size="60">e</text>
          <circle class="title-dot" cx="17" cy="17" r="4.6" />
          <circle class="title-dot" cx="33" cy="17" r="4.6" />
        </svg><span>-HQ</span>
      </h1>
      <p class="lead">Select your workspace to continue</p>
      <i aria-hidden="true"></i>
    </div>
  </section>

  <section class="workspace-grid" aria-label="Available workspaces">
    {#each cards as card (card.workspaceId)}
      {@const locked = isLocked(card.workspaceId)}
        <article
          class:locked
          class:live={!locked}
          class={`workspace-card accent-${card.workspaceId}`}
          onmouseenter={() => onPrefetchWorkspace(card.workspaceId)}
          onfocusin={() => onPrefetchWorkspace(card.workspaceId)}
        >
        {#if locked}
          <div class="cross" aria-label="Access denied">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </div>
        {:else}
          <span class="live-tag" aria-hidden="true"><i></i>LIVE</span>
        {/if}

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
              <Button
                label="access denied"
                variant="secondary"
                size="medium"
                type="button"
                disabled={true}
                loading={false}
                locked={true}
                focus={false}
                ariaLabel="Access denied"
                title="Access is managed by your administrator — Command Center → Users & permissions."
              />
              <p class="locked-hint">Access is managed by your administrator — Command Center → Users & permissions.</p>
            {:else}
              <button class="enter-button" type="button" onclick={() => openWorkspace(card)}>
                Enter {card.title} <span aria-hidden="true">→</span>
              </button>
            {/if}
          </div>
        </div>
      </article>
    {/each}

    <article class="workspace-card session-card accent-session">
      <span class="live-tag session-tag" aria-hidden="true"><i></i>{isLoggedIn ? "ONLINE" : "OFFLINE"}</span>

      <div class="workspace-copy">
        <div class="card-head">
          <span class="hexicon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 2.6 20.5 7.3v9.4L12 21.4 3.5 16.7V7.3Z" /></svg>
          </span>
          <h2>Session</h2>
        </div>
        <p class="card-sub">{isLoggedIn ? "Active access" : "Secure access"}</p>
        <p class="card-desc">
          {#if isLoggedIn}
            {userName} · {userRole}
          {:else}
            Sign in to unlock your current workspaces.
          {/if}
        </p>
        <div class="workspace-actions">
          {#if isLoggedIn}
            <Button
              label="Sign out →"
              variant="secondary"
              size="medium"
              type="button"
              disabled={false}
              loading={false}
              locked={false}
              focus={false}
              ariaLabel="Sign out"
              onclick={signOut}
            />
          {:else}
            <Button
              label="Sign in →"
              variant="secondary"
              size="medium"
              type="button"
              disabled={false}
              loading={false}
              locked={false}
              focus={false}
              ariaLabel="Sign in"
              onclick={() => openLogin(null)}
            />
          {/if}
        </div>
      </div>
    </article>
  </section>

  <footer>
    <span>© 2026 ë-HQ. All rights reserved.</span>
  </footer>

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

      <label class="field" class:invalid={emailInvalid}>
        <span>email</span>
        <input
          bind:value={loginEmail}
          aria-invalid={emailInvalid}
          autocomplete="username"
          inputmode="email"
          type="email"
          oninput={() => {
            emailInvalid = false;
          }}
        />
      </label>

      <label class="field" class:invalid={passwordInvalid}>
        <span>password</span>
        <input
          bind:value={loginPassword}
          aria-invalid={passwordInvalid}
          autocomplete="current-password"
          placeholder="••••••••••"
          type="password"
          oninput={() => {
            passwordInvalid = false;
          }}
        />
      </label>

      <div class="form-row">
        <Checkbox
          id="landing-remember-session"
          label="remember me"
          checked={rememberSession}
          indeterminate={false}
          disabled={false}
          onchange={(checked: boolean): void => { rememberSession = checked; }}
        />
        <Button
          label="forgot password?"
          variant="secondary"
          size="small"
          type="button"
          disabled={false}
          loading={resettingPassword}
          locked={false}
          focus={false}
          ariaLabel="Send a password reset link"
          title={resettingPassword ? "Password reset email is being sent." : "Send a password reset link to the email above."}
          onclick={forgotPassword}
        />
      </div>

      <div class="submit-row">
        <Button
          label={signingIn ? "signing in" : "sign in →"}
          variant="primary"
          size="medium"
          type="submit"
          disabled={false}
          loading={signingIn}
          locked={false}
          focus={false}
          ariaLabel="Sign in"
        />
      </div>

      {#if loginMessage.length > 0}
        <p class="login-message" class:error={loginMessageTone === "error"} role="status">{loginMessage}</p>
      {/if}
    </form>
  </section>
{/if}

<style>
  :global(body) {
    overflow: hidden;
  }

  .landing-shell {
    position: relative;
    isolation: isolate;
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

  .landing-shell::before,
  .landing-shell::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: -1;
    pointer-events: none;
  }

  .landing-shell::before {
    background:
      linear-gradient(90deg, color-mix(in srgb, var(--ehq-bg-main) 72%, transparent) 0%, color-mix(in srgb, var(--ehq-bg-main) 36%, transparent) 30%, color-mix(in srgb, var(--ehq-bg-main) 5%, transparent) 58%, color-mix(in srgb, var(--ehq-bg-main) 12%, transparent) 100%),
      linear-gradient(180deg, color-mix(in srgb, var(--ehq-bg-main) 8%, transparent) 0%, transparent 42%, color-mix(in srgb, var(--ehq-bg-main) 42%, transparent) 100%);
  }

  .landing-shell::after {
    background:
      radial-gradient(circle at 12% 48%, color-mix(in srgb, var(--ehq-yellow) 10%, transparent), transparent 20rem),
      linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--ehq-bg-main) 46%, transparent) 100%);
    mix-blend-mode: screen;
    opacity: 0.34;
  }

  .landing-background {
    position: absolute;
    inset: 0;
    z-index: -2;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center center;
    filter: saturate(1.08) brightness(1.02) contrast(1.04);
    transform: scale(1.01);
    pointer-events: none;
    user-select: none;
  }

  .map-sparkles {
    position: absolute;
    left: clamp(520px, 50.8vw, 920px);
    top: clamp(92px, 14.2vh, 146px);
    z-index: 0;
    width: clamp(500px, 42.4vw, 790px);
    height: clamp(178px, 27vh, 280px);
    pointer-events: none;
  }

  .sparkle {
    position: absolute;
    left: var(--spark-x);
    top: var(--spark-y);
    width: var(--spark-size);
    height: var(--spark-size);
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-yellow);
    box-shadow:
      0 0 8px color-mix(in srgb, var(--ehq-yellow) 86%, transparent),
      0 0 22px color-mix(in srgb, var(--ehq-yellow) 44%, transparent);
    opacity: 0.18;
    transform: translate(-50%, -50%) scale(0.72);
    animation: mapTwinkle var(--spark-speed) ease-in-out infinite;
    animation-delay: var(--spark-delay);
  }

  .signal-flow {
    position: absolute;
    left: var(--flow-x);
    top: var(--flow-y);
    z-index: 1;
    width: var(--flow-length);
    height: 10px;
    transform: rotate(var(--flow-angle));
    transform-origin: left center;
    opacity: 0.92;
    pointer-events: none;
  }

  .signal-flow::after {
    content: "";
    position: absolute;
    top: 50%;
    left: 0;
    width: var(--flow-size);
    height: var(--flow-size);
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-yellow);
    box-shadow:
      0 0 8px color-mix(in srgb, var(--ehq-yellow) 92%, transparent),
      0 0 18px color-mix(in srgb, var(--ehq-yellow) 50%, transparent);
    transform: translate(-50%, -50%);
    animation: signalTravel var(--flow-speed) linear infinite;
    animation-delay: var(--flow-delay);
  }

  .s1 {
    --spark-x: 7%;
    --spark-y: 34%;
    --spark-size: 4px;
    --spark-speed: 2.7s;
    --spark-delay: -0.4s;
  }

  .s2 {
    --spark-x: 17%;
    --spark-y: 24%;
    --spark-size: 3px;
    --spark-speed: 3.1s;
    --spark-delay: -1.6s;
  }

  .s3 {
    --spark-x: 31%;
    --spark-y: 30%;
    --spark-size: 5px;
    --spark-speed: 2.9s;
    --spark-delay: -2.2s;
  }

  .s4 {
    --spark-x: 43%;
    --spark-y: 38%;
    --spark-size: 3px;
    --spark-speed: 2.5s;
    --spark-delay: -0.9s;
  }

  .s5 {
    --spark-x: 55%;
    --spark-y: 31%;
    --spark-size: 4px;
    --spark-speed: 3.4s;
    --spark-delay: -1.2s;
  }

  .s6 {
    --spark-x: 72%;
    --spark-y: 38%;
    --spark-size: 3px;
    --spark-speed: 2.8s;
    --spark-delay: -2.7s;
  }

  .s7 {
    --spark-x: 21%;
    --spark-y: 64%;
    --spark-size: 3px;
    --spark-speed: 3.5s;
    --spark-delay: -1.1s;
  }

  .s8 {
    --spark-x: 37%;
    --spark-y: 55%;
    --spark-size: 4px;
    --spark-speed: 2.6s;
    --spark-delay: -2s;
  }

  .s9 {
    --spark-x: 49%;
    --spark-y: 60%;
    --spark-size: 3px;
    --spark-speed: 3.2s;
    --spark-delay: -0.2s;
  }

  .s10 {
    --spark-x: 64%;
    --spark-y: 57%;
    --spark-size: 5px;
    --spark-speed: 2.9s;
    --spark-delay: -1.8s;
  }

  .s11 {
    --spark-x: 84%;
    --spark-y: 67%;
    --spark-size: 3px;
    --spark-speed: 3.6s;
    --spark-delay: -2.4s;
  }

  .s12 {
    --spark-x: 3%;
    --spark-y: 58%;
    --spark-size: 3px;
    --spark-speed: 3s;
    --spark-delay: -1.4s;
  }

  .s13 {
    --spark-x: 29%;
    --spark-y: 43%;
    --spark-size: 3px;
    --spark-speed: 2.45s;
    --spark-delay: -0.7s;
  }

  .s14 {
    --spark-x: 39%;
    --spark-y: 26%;
    --spark-size: 4px;
    --spark-speed: 3.15s;
    --spark-delay: -1.9s;
  }

  .s15 {
    --spark-x: 51%;
    --spark-y: 43%;
    --spark-size: 5px;
    --spark-speed: 2.75s;
    --spark-delay: -2.3s;
  }

  .s16 {
    --spark-x: 61%;
    --spark-y: 34%;
    --spark-size: 3px;
    --spark-speed: 3.25s;
    --spark-delay: -1.5s;
  }

  .s17 {
    --spark-x: 76%;
    --spark-y: 28%;
    --spark-size: 4px;
    --spark-speed: 2.6s;
    --spark-delay: -0.1s;
  }

  .s18 {
    --spark-x: 91%;
    --spark-y: 70%;
    --spark-size: 5px;
    --spark-speed: 3.05s;
    --spark-delay: -2.55s;
  }

  .s19 {
    --spark-x: 69%;
    --spark-y: 61%;
    --spark-size: 3px;
    --spark-speed: 2.35s;
    --spark-delay: -1.25s;
  }

  .s20 {
    --spark-x: 12%;
    --spark-y: 48%;
    --spark-size: 4px;
    --spark-speed: 3.45s;
    --spark-delay: -2.85s;
  }

  .f1 {
    --flow-x: 9%;
    --flow-y: 31%;
    --flow-length: 24%;
    --flow-angle: -11deg;
    --flow-size: 4px;
    --flow-speed: 4.8s;
    --flow-delay: -1.2s;
  }

  .f2 {
    --flow-x: 29%;
    --flow-y: 32%;
    --flow-length: 26%;
    --flow-angle: 8deg;
    --flow-size: 5px;
    --flow-speed: 5.4s;
    --flow-delay: -3.1s;
  }

  .f3 {
    --flow-x: 51%;
    --flow-y: 36%;
    --flow-length: 22%;
    --flow-angle: -14deg;
    --flow-size: 4px;
    --flow-speed: 4.2s;
    --flow-delay: -0.4s;
  }

  .f4 {
    --flow-x: 41%;
    --flow-y: 44%;
    --flow-length: 36%;
    --flow-angle: 22deg;
    --flow-size: 4px;
    --flow-speed: 6s;
    --flow-delay: -2.4s;
  }

  .f5 {
    --flow-x: 18%;
    --flow-y: 53%;
    --flow-length: 31%;
    --flow-angle: -18deg;
    --flow-size: 3px;
    --flow-speed: 5.2s;
    --flow-delay: -4.2s;
  }

  .f6 {
    --flow-x: 64%;
    --flow-y: 60%;
    --flow-length: 28%;
    --flow-angle: 24deg;
    --flow-size: 5px;
    --flow-speed: 4.9s;
    --flow-delay: -1.7s;
  }

  @keyframes mapTwinkle {
    0%,
    100% {
      opacity: 0.14;
      transform: translate(-50%, -50%) scale(0.72);
    }

    42% {
      opacity: 0.92;
      transform: translate(-50%, -50%) scale(1.35);
    }

    56% {
      opacity: 0.38;
      transform: translate(-50%, -50%) scale(0.94);
    }
  }

  @keyframes signalTravel {
    0% {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.55);
    }

    12% {
      opacity: 1;
    }

    82% {
      opacity: 1;
    }

    100% {
      left: 100%;
      opacity: 0;
      transform: translate(-50%, -50%) scale(1.08);
    }
  }

  .landing-shell.fogged {
    filter: saturate(0.82);
  }

  .landing-top,
  .top-right,
  footer {
    position: relative;
    z-index: 1;
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--ehq-space-4);
  }

  .top-right {
    position: relative;
  }

  .landing-top {
    justify-content: flex-end;
  }

  .user-chip {
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ehq-text);
  }

  .eyebrow,
  .locked-hint,
  footer,
  .enter-button,
  .field span,
  .form-row,
  .login-message,
  .close-button,
  .notification-panel p,
  .notification-panel span,
  .session-panel p,
  .session-panel span {
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
    padding: 0 var(--ehq-space-1);
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-yellow);
    color: var(--ehq-text-on-yellow);
    box-shadow: 0 0 0 2px var(--ehq-bg-main);
    display: grid;
    place-items: center;
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
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

  .hero {
    position: relative;
    z-index: 1;
    flex: 0 1 36%;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 0.72fr) minmax(240px, 1fr);
    align-items: center;
    gap: clamp(var(--ehq-space-4), 3vw, var(--ehq-space-6));
  }

  .hero-copy {
    width: min(640px, 100%);
    min-width: 0;
    padding: clamp(var(--ehq-space-2), 3vh, var(--ehq-space-6)) 0;
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
    font-size: clamp(42px, 6.8vw, 86px);
    font-weight: var(--ehq-type-display-weight);
    line-height: 0.96;
    letter-spacing: 0;
    white-space: nowrap;
    text-transform: none;
    text-shadow: 0 18px 44px color-mix(in srgb, var(--ehq-black) 62%, transparent);
  }

  h1 span {
    color: var(--ehq-yellow);
  }

  /* Animated ë: clean "e" glyph + two heartbeat trema, centered. */
  .title-e {
    display: inline-block;
    width: 0.82em;
    height: 1.12em;
    margin-right: -0.16em;
    transform: translateY(0.16em);
  }

  .title-e text {
    font-family: var(--ehq-display);
    font-weight: var(--ehq-type-display-weight);
    fill: var(--ehq-yellow);
  }

  .title-dot {
    fill: var(--ehq-yellow);
    animation: dotFade 1.5s ease-in-out infinite;
  }

  @keyframes dotFade {
    0% {
      opacity: 1;
    }

    70%,
    100% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .title-dot {
      animation: none;
    }
  }

  .lead {
    max-width: 38ch;
    margin-top: var(--ehq-space-4);
    color: var(--ehq-text-soft);
    font-size: clamp(var(--ehq-type-ui-size), 1.5vw, var(--ehq-h3));
    font-weight: 300;
    line-height: var(--ehq-type-ui-line);
    text-shadow: 0 10px 28px color-mix(in srgb, var(--ehq-black) 70%, transparent);
  }

  .hero-copy i {
    display: block;
    width: 84px;
    height: 2px;
    margin-top: var(--ehq-space-4);
    background: var(--ehq-yellow);
  }

  .workspace-grid {
    position: absolute;
    left: clamp(var(--ehq-space-4), 2.5vw, var(--ehq-space-6));
    right: clamp(var(--ehq-space-4), 2.5vw, var(--ehq-space-6));
    bottom: clamp(70px, 9vh, 104px);
    z-index: 1;
    width: auto;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    align-items: stretch;
    gap: var(--ehq-space-4);
  }

  .workspace-card {
    position: relative;
    --card-accent: var(--ehq-yellow);
    min-width: 0;
    min-height: clamp(180px, 24vh, 220px);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-lg);
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--ehq-surface) 82%, transparent), color-mix(in srgb, var(--ehq-bg-main) 72%, transparent)),
      color-mix(in srgb, var(--ehq-surface) 78%, transparent);
    backdrop-filter: blur(18px);
    box-shadow:
      0 18px 46px color-mix(in srgb, var(--ehq-black) 36%, transparent),
      0 0 22px -8px var(--card-accent);
    display: block;
    overflow: hidden;
    cursor: default;
    transition:
      transform var(--ehq-transition-normal) var(--ehq-ease),
      border-color var(--ehq-transition-fast) var(--ehq-ease);
  }

  .workspace-card.live {
    cursor: pointer;
  }

  .workspace-card.live:hover {
    transform: translateY(calc(var(--ehq-space-3) * -1));
    border-color: var(--card-accent);
  }

  .workspace-card.locked {
    border-color: var(--ehq-error);
  }

  /* Per-workspace accent on the landing, sourced from the canonical workspace tokens. */
  /* Landing accents (design direction): Office red · Distribution blue · HQ white · Session neutral. */
  .accent-office {
    --card-accent: var(--ehq-error);
  }

  .accent-distribution {
    --card-accent: var(--ehq-info);
  }

  .accent-command-center {
    --card-accent: var(--ehq-text);
  }

  .accent-session {
    --card-accent: var(--ehq-text-soft);
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
    color: var(--card-accent);
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
    min-height: clamp(136px, 17vh, 156px);
    padding: clamp(var(--ehq-space-2), 1vw, var(--ehq-space-3));
    display: flex;
    flex-direction: column;
    gap: var(--ehq-space-1);
  }

  .session-card {
    background:
      radial-gradient(circle at 76% 0%, color-mix(in srgb, var(--ehq-yellow) 18%, transparent), transparent 12rem),
      linear-gradient(180deg, color-mix(in srgb, var(--ehq-surface) 86%, transparent), color-mix(in srgb, var(--ehq-bg-main) 76%, transparent)),
      color-mix(in srgb, var(--ehq-surface) 78%, transparent);
  }

  .card-desc {
    margin-top: var(--ehq-space-1);
    color: var(--ehq-text-soft);
    font-size: var(--ehq-type-caption-size);
    font-weight: 400;
    line-height: 1.45;
  }

  .workspace-actions {
    margin-top: auto;
    padding-top: var(--ehq-space-2);
    display: grid;
    gap: var(--ehq-space-2);
  }

  .enter-button {
    width: 100%;
    min-height: 32px;
    padding: 0 var(--ehq-space-3);
    border-radius: var(--ehq-radius-sm);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--ehq-space-2);
    font-family: var(--ehq-font);
    font-size: var(--ehq-type-label-size);
    font-weight: var(--ehq-type-heading-weight);
    letter-spacing: 0.04em;
    text-transform: none;
  }

  /* Stretches the design-system locked Button into the full-width card action. */
  .workspace-actions :global(.ehq-button) {
    width: 100%;
    min-height: 32px;
  }

  .enter-button {
    border: 1px solid color-mix(in srgb, var(--card-accent) 55%, transparent);
    background: color-mix(in srgb, var(--card-accent) 10%, transparent);
    color: var(--card-accent);
  }

  .workspace-card.live:hover .enter-button {
    border-color: var(--card-accent);
    background: var(--card-accent);
    color: var(--ehq-text-on-yellow);
  }

  .enter-button span {
    transition: transform var(--ehq-transition-normal) var(--ehq-ease);
  }

  .enter-button:hover span {
    transform: translateX(var(--ehq-space-1));
  }

  /* Stretched link: the CTA button is the click target for the whole card. */
  .enter-button::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
  }

  .cross svg {
    width: 14px;
    height: 14px;
    stroke: currentColor;
    stroke-width: 2.6;
    fill: none;
  }

  /* Honest static hint: workspace access is granted by an administrator. */
  .locked-hint {
    margin: 0;
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
    line-height: 1.45;
    text-align: left;
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

  /* Static status tag (no pulse). */
  .live-tag {
    position: absolute;
    top: var(--ehq-space-3);
    right: var(--ehq-space-3);
    z-index: 2;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--ehq-mono);
    font-size: var(--ehq-type-label-size);
    letter-spacing: 0.12em;
    color: var(--ehq-success);
    pointer-events: none;
  }

  .live-tag i {
    width: 7px;
    height: 7px;
    border-radius: var(--ehq-radius-pill);
    background: var(--ehq-success);
  }

  .session-tag {
    color: var(--ehq-text-muted);
  }

  .session-tag i {
    background: var(--ehq-text-muted);
  }

  footer {
    position: absolute;
    left: clamp(var(--ehq-space-4), 2.5vw, var(--ehq-space-6));
    bottom: clamp(var(--ehq-space-3), 3vh, var(--ehq-space-5));
    padding-top: clamp(var(--ehq-space-2), 1.6vh, var(--ehq-space-4));
    color: var(--ehq-text-muted);
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
    font-size: var(--ehq-h1);
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

  /* Field-level validation state, mirrored on aria-invalid for assistive tech. */
  .field.invalid input {
    border-color: var(--ehq-error);
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

  /* Stretches the design-system Button into the full-width sign-in CTA. */
  .submit-row {
    margin-top: var(--ehq-space-4);
    display: grid;
  }

  .submit-row :global(.ehq-button) {
    width: 100%;
    min-height: 44px;
  }

  .login-message {
    margin-top: var(--ehq-space-3);
    color: var(--ehq-yellow);
    font-size: var(--ehq-type-caption-size);
  }

  /* Error tone distinct from the yellow info/success tone (honest states). */
  .login-message.error {
    color: var(--ehq-error);
  }

  @media (min-width: 1181px) and (max-height: 760px) {
    .landing-shell {
      gap: var(--ehq-space-3);
    }

    .hero {
      flex-basis: 38%;
    }

    .lead {
      font-size: var(--ehq-type-ui-size);
    }

    .workspace-copy {
      padding: var(--ehq-space-3);
    }
  }

  @media (max-width: 1180px) {
    .landing-shell {
      padding: var(--ehq-space-3);
      gap: var(--ehq-space-3);
    }

    .landing-background {
      object-position: 64% center;
      filter: saturate(1.06) brightness(0.96) contrast(1.02);
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
      font-size: clamp(26px, 9.5vw, 52px);
    }

    .lead {
      margin-top: var(--ehq-space-2);
      font-size: var(--ehq-type-ui-size);
    }

    .hero-copy i {
      margin-top: var(--ehq-space-3);
    }

    .workspace-grid {
      position: relative;
      left: auto;
      right: auto;
      bottom: auto;
      flex: 0 1 auto;
      width: 100%;
      margin-top: auto;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: var(--ehq-space-3);
    }

    .workspace-card {
      min-height: 132px;
      max-width: none;
    }

    .workspace-copy {
      min-width: 0;
      min-height: 132px;
      padding: var(--ehq-space-3);
      display: flex;
      flex-direction: column;
      justify-content: center;
    }

    .workspace-actions {
      margin-top: var(--ehq-space-2);
    }

    .enter-button,
    .workspace-actions :global(.ehq-button) {
      min-height: 36px;
      padding: 0 var(--ehq-space-3);
      font-size: var(--ehq-type-action-size);
    }

    footer {
      position: relative;
      left: auto;
      bottom: auto;
      font-size: var(--ehq-type-label-size);
    }
  }

  @media (max-width: 1180px) and (max-height: 640px) {
    .lead,
    footer {
      display: none;
    }
  }

  @media (max-width: 600px) {
    .workspace-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
