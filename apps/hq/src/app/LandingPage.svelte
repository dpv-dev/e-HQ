<script lang="ts">
  import {
    getWorkspaceAccess,
    type AuthSession,
    type WorkspaceAppId
  } from "@ehq/auth";
  import commandCenterScene from "../../../../packages/ui/assets/backgrounds/scene-command-center.svg?url";
  import commandCenterPhoto from "../../../../packages/ui/assets/backgrounds/hq-card-command-center.jpg?url";
  import distributionPhoto from "../../../../packages/ui/assets/backgrounds/hq-card-distribution.jpg?url";
  import officePhoto from "../../../../packages/ui/assets/backgrounds/hq-card-office.jpg?url";
  import type { AppRoute } from "./routes";
  import { signInWithSupabasePassword } from "./supabase";

  interface Props {
    readonly session: AuthSession | null;
    readonly onLogin: (session: AuthSession) => void;
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

  const { session, onLogin, onNavigate, onOpenWorkspace }: Props = $props();

  let accessRequestedFor = $state<string | null>(null);
  let loginOpen = $state(false);
  let loginTarget = $state<WorkspaceCard | null>(null);
  let loginEmail = $state("david@eeee.mu");
  let loginPassword = $state("");
  let rememberSession = $state(true);
  let loginMessage = $state("");
  let signingIn = $state(false);

  const cards: readonly WorkspaceCard[] = [
    {
      workspaceId: "command-center",
      eyebrow: "supervision",
      title: "command center",
      description: "global oversight, monitoring and ecosystem health.",
      image: commandCenterPhoto
    },
    {
      workspaceId: "office",
      eyebrow: "financial control",
      title: "office",
      description: "transactions, payments, chart of accounts and p&l.",
      image: officePhoto
    },
    {
      workspaceId: "distribution",
      eyebrow: "royalties",
      title: "distribution",
      description: "imports, mapping, allocations and statements.",
      image: distributionPhoto
    }
  ];

  const isLoggedIn = $derived(session !== null);
  const userInitials = $derived(session?.initials ?? "ë");
  const userName = $derived(session?.displayName.toLowerCase() ?? "sign in");
  const userRole = $derived(session?.roleLabel ?? "public access");

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
    <button class="brand" type="button" onclick={() => onNavigate("/")}>
      <span class="brand-e">ë</span>
      <span class="brand-name">ë • hq</span>
    </button>

    <div class="top-right">
      <span class="coord">port louis · 20°10′s · 57°31′e</span>
      <button class="user-chip" type="button" onclick={() => openLogin(null)}>
        <span>{userInitials}</span>
        <strong>{userName}</strong>
        <small>{userRole}</small>
      </button>
    </div>
  </header>

  <section class="hero" aria-labelledby="landing-title">
    <div class="hero-copy">
      <p class="eyebrow">{`{ workspace }`}</p>
      <h1 id="landing-title">welcome to <span>ë</span> • hq</h1>
      <p class="lead">
        Choose your workspace. Public visitors can explore the entry points; permissions apply after sign-in.
      </p>
      <i aria-hidden="true"></i>
    </div>

    <div class="hero-scene" aria-hidden="true">
      <img src={commandCenterScene} alt="" />
    </div>
  </section>

  <section class="workspace-grid" aria-label="Available workspaces">
    {#each cards as card (card.workspaceId)}
      {@const locked = isLocked(card.workspaceId)}
      <article class:locked class:live={!locked} class="workspace-card">
        {#if locked}
          <div class="cross" aria-label="Access denied">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </div>
        {/if}

        <div class="photo">
          <img src={card.image} alt="" />
          <div class="photo-copy">
            <p>{card.eyebrow}</p>
            <h2>{card.title}</h2>
          </div>
        </div>

        <div class="workspace-copy">
          <div class="mobile-title">
            <span>{card.eyebrow}</span>
            {card.title}
          </div>
          <p>{card.description}</p>
          <div class="workspace-actions">
            {#if locked}
              <button class="locked-button" type="button" onclick={() => openWorkspace(card)}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                access denied
              </button>
              <button class="request-link" type="button" onclick={() => openWorkspace(card)}>request access →</button>
            {:else}
              <button class="enter-button" type="button" onclick={() => openWorkspace(card)}>
                {isLoggedIn ? "enter" : "sign in"} <span aria-hidden="true">→</span>
              </button>
            {/if}
          </div>
        </div>
      </article>
    {/each}
  </section>

  <footer>
    <span>© 2026 ë · wip v0001 · port louis, mu</span>
    <span>privacy · terms · settings</span>
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

  .brand-name,
  .coord,
  .eyebrow,
  .photo-copy p,
  .mobile-title span,
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
  .close-button {
    font-family: var(--ehq-mono);
  }

  .brand-name {
    color: var(--ehq-text-soft);
    font-size: 12px;
    letter-spacing: 0.16em;
    text-transform: lowercase;
  }

  .coord {
    color: var(--ehq-text-muted);
    font-size: 11px;
    letter-spacing: 0.04em;
  }

  .user-chip {
    display: grid;
    grid-template-columns: auto auto;
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
    font-size: 11px;
    font-weight: var(--ehq-type-label-weight);
  }

  .user-chip strong {
    font-size: 12.5px;
    line-height: 1.2;
    text-transform: lowercase;
  }

  .user-chip small {
    color: var(--ehq-text-muted);
    font-family: var(--ehq-mono);
    font-size: 10.5px;
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
  .photo-copy p,
  .mobile-title span,
  .field span {
    color: var(--ehq-text-muted);
    font-size: 11px;
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
    text-transform: lowercase;
  }

  h1 span {
    color: var(--ehq-yellow);
  }

  .lead {
    max-width: 45ch;
    margin-top: var(--ehq-space-3);
    color: var(--ehq-text-soft);
    font-size: clamp(13px, 1.1vw, 15.5px);
    font-weight: 300;
    line-height: 1.55;
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

  .photo {
    position: relative;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
  }

  .photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    filter: brightness(0.6) saturate(0.92);
    transform: scale(1.02);
    transition:
      transform var(--ehq-transition-normal) var(--ehq-ease),
      filter var(--ehq-transition-normal) var(--ehq-ease);
  }

  .workspace-card.live:hover .photo img {
    filter: brightness(1.08) saturate(1.06);
    transform: scale(1.07);
  }

  .photo::after {
    content: "";
    position: absolute;
    inset: 0;
    background:
      linear-gradient(180deg, transparent 30%, var(--ehq-bg-main) 100%),
      linear-gradient(90deg, var(--ehq-bg-main), transparent 52%);
    opacity: 0.82;
  }

  .photo-copy {
    position: absolute;
    inset: auto var(--ehq-space-4) var(--ehq-space-4);
    z-index: 1;
  }

  .photo-copy h2 {
    margin-top: var(--ehq-space-2);
    font-size: clamp(28px, 3.4vw, 46px);
    font-weight: var(--ehq-type-display-weight);
    line-height: 0.94;
    letter-spacing: 0;
    text-transform: lowercase;
  }

  .workspace-copy {
    flex: 0 0 auto;
    padding: var(--ehq-space-4);
  }

  .mobile-title {
    display: none;
  }

  .workspace-copy > p {
    color: var(--ehq-text-soft);
    font-size: 13px;
    font-weight: 300;
    line-height: 1.55;
  }

  .workspace-actions {
    margin-top: var(--ehq-space-3);
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
    font-size: 12px;
    font-weight: var(--ehq-type-heading-weight);
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .enter-button {
    border: 1px solid var(--ehq-yellow);
    background: var(--ehq-yellow);
    color: var(--ehq-text-on-yellow);
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
    font-size: 11px;
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
    font-size: 11px;
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
    font-size: 11px;
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
    font-size: 10px;
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
    font-size: 13.5px;
    line-height: 1.55;
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
    font-size: 14px;
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
    font-size: 11px;
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
    font-size: 11px;
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
    font-size: 12px;
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
    font-size: 10.5px;
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
    font-size: 11px;
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
      font-size: 13px;
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

    .coord,
    .hero-scene,
    .photo-copy,
    .workspace-copy > p {
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
      font-size: 12.5px;
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

    .mobile-title {
      display: block;
      font-size: clamp(17px, 5.6vw, 20px);
      font-weight: var(--ehq-type-display-weight);
      line-height: 1;
      text-transform: lowercase;
    }

    .mobile-title span {
      display: block;
      margin-bottom: var(--ehq-space-1);
      font-weight: 400;
    }

    .workspace-actions {
      margin-top: var(--ehq-space-2);
    }

    .enter-button,
    .locked-button {
      min-height: 36px;
      padding: 0 var(--ehq-space-3);
      font-size: 11px;
    }

    footer {
      font-size: 10px;
    }
  }

  @media (max-width: 920px) and (max-height: 640px) {
    .lead,
    footer {
      display: none;
    }

    .mobile-title {
      font-size: 17px;
    }
  }
</style>
