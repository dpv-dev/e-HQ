<script lang="ts">
  import type { AuthSession } from "@ehq/auth";
  import sceneCommandCenter from "../../../../packages/ui/assets/backgrounds/scene-command-center.svg?url";
  import type { AppRoute } from "./routes.js";
  import { signInWithSupabasePassword } from "./supabase.js";

  interface Props {
    readonly onLogin: (session: AuthSession) => void;
    readonly onNavigate: (route: AppRoute) => void;
    readonly nextRoute: AppRoute | null;
  }

  const { onLogin, onNavigate, nextRoute }: Props = $props();

  let email = $state("david@eeee.mu");
  let password = $state("");
  let rememberSession = $state(true);
  let statusMessage = $state("");
  let signingIn = $state(false);

  const signIn = async (): Promise<void> => {
    if (email.trim().length === 0 || password.trim().length === 0) {
      statusMessage = "Enter your email and password to continue.";
      return;
    }

    signingIn = true;
    statusMessage = "";

    try {
      const session = await signInWithSupabasePassword({
        email: email.trim(),
        password
      });
      statusMessage = rememberSession
        ? "Session ready. Opening your available workspaces."
        : "Sign-in validated for this session.";
      onLogin(session);
      onNavigate(nextRoute ?? "/");
    } catch (error: unknown) {
      statusMessage = error instanceof Error ? error.message : "Supabase sign-in failed.";
    } finally {
      signingIn = false;
    }
  };

  const submitLogin = (event: SubmitEvent): void => {
    event.preventDefault();
    void signIn();
  };

  const forgotPassword = (): void => {
    statusMessage = "Password reset is ready for the selected account.";
  };
</script>

<svelte:head>
  <title>ë • HQ — sign in</title>
</svelte:head>

<main class="login-shell">
  <section class="brand-panel" aria-label="Command center signal">
    <button class="brand" type="button" onclick={() => onNavigate("/")}>
      <span>ë</span>
      <strong>ë • hq</strong>
    </button>

    <div class="scene-wrap">
      <img src={sceneCommandCenter} alt="" />
    </div>

    <div class="brand-copy">
      <p>{`{ command center }`}</p>
      <h2>one signal. every label, payee and number.</h2>
      <small>music, visuals, talent & culture; operated from one place.</small>
      <span>port louis · 20°10′s · 57°31′e · since 2006</span>
    </div>
  </section>

  <section class="form-panel" aria-labelledby="login-title">
    <form class="login-form" onsubmit={submitLogin}>
      <p class="eyebrow">{`{ sign in }`}</p>
      <h1 id="login-title">welcome back</h1>
      <p class="lead">Sign in to reach your workspaces. Access follows your permissions.</p>

      <label class="field">
        <span>email</span>
        <input
          bind:value={email}
          autocomplete="username"
          inputmode="email"
          placeholder="you@eeee.mu"
          type="email"
        />
      </label>

      <label class="field">
        <span>password</span>
        <input
          bind:value={password}
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
      <button class="sso-button" type="button" disabled={signingIn} onclick={() => void signIn()}>
        continue with ë sso
      </button>

      {#if statusMessage.length > 0}
        <p class="status" role="status">{statusMessage}</p>
      {/if}

      <p class="foot">© 2026 ë · wip v0001 · port louis, mu</p>
    </form>
  </section>
</main>

<style>
  :global(body) {
    overflow: hidden;
  }

  .login-shell {
    height: 100dvh;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(380px, 0.9fr);
    background: var(--ehq-bg-main);
    color: var(--ehq-text);
    overflow: hidden;
  }

  .brand-panel {
    position: relative;
    min-height: 0;
    padding: clamp(var(--ehq-space-5), 4vw, var(--ehq-space-6));
    border-right: 1px solid var(--ehq-border-soft);
    background:
      radial-gradient(circle at 60% 18%, var(--ehq-yellow-muted), transparent 34rem),
      var(--ehq-bg-main);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    overflow: hidden;
  }

  .brand {
    position: relative;
    z-index: 2;
    width: fit-content;
    padding: 0;
    border: 0;
    background: transparent;
    color: var(--ehq-text);
    display: inline-flex;
    align-items: baseline;
    gap: var(--ehq-space-2);
  }

  .brand span {
    color: var(--ehq-yellow);
    font-size: 26px;
    font-weight: var(--ehq-type-display-weight);
    line-height: 1;
  }

  .brand strong,
  .brand-copy p,
  .brand-copy span,
  .eyebrow,
  .field span,
  .form-row,
  .plain-link,
  .separator,
  .submit-button,
  .sso-button,
  .foot,
  .status {
    font-family: var(--ehq-mono);
  }

  .brand strong {
    color: var(--ehq-text-soft);
    font-size: var(--ehq-type-caption-size);
    letter-spacing: 0.16em;
    text-transform: lowercase;
  }

  .scene-wrap {
    position: absolute;
    inset: 0;
    z-index: 1;
    display: grid;
    place-items: center;
    padding: clamp(var(--ehq-space-5), 6vw, var(--ehq-space-8));
  }

  .scene-wrap img {
    width: min(104%, 780px);
    max-height: 86dvh;
    object-fit: contain;
    opacity: 0.92;
    filter: drop-shadow(0 24px 52px var(--ehq-black));
  }

  .brand-copy {
    position: relative;
    z-index: 2;
    max-width: 460px;
  }

  .brand-copy p,
  .eyebrow,
  .field span {
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  .brand-copy h2,
  .brand-copy small,
  h1,
  p {
    margin: 0;
  }

  .brand-copy h2 {
    max-width: 18ch;
    margin-top: var(--ehq-space-3);
    font-size: clamp(22px, 3vw, 28px);
    line-height: 1.05;
    letter-spacing: 0;
  }

  .brand-copy small {
    display: block;
    max-width: 36ch;
    margin-top: var(--ehq-space-2);
    color: var(--ehq-text-soft);
    font-size: var(--ehq-type-ui-size);
    font-weight: 300;
    line-height: var(--ehq-type-ui-line);
  }

  .brand-copy span {
    display: block;
    margin-top: var(--ehq-space-4);
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
  }

  .form-panel {
    min-height: 0;
    padding: clamp(var(--ehq-space-4), 5vw, var(--ehq-space-6));
    display: grid;
    place-items: center;
  }

  .login-form {
    width: min(100%, 360px);
  }

  h1 {
    margin-top: var(--ehq-space-3);
    font-size: clamp(34px, 5vw, 42px);
    line-height: 1;
    letter-spacing: 0;
    text-transform: lowercase;
  }

  .lead {
    margin-top: var(--ehq-space-2);
    color: var(--ehq-text-soft);
    font-size: var(--ehq-type-ui-size);
    font-weight: 300;
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

  :global(.login-shell input:-webkit-autofill),
  :global(.login-shell input:-webkit-autofill:hover),
  :global(.login-shell input:-webkit-autofill:focus) {
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
    min-height: 46px;
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

  .submit-button span {
    display: inline-block;
    transition: transform var(--ehq-transition-normal) var(--ehq-ease);
  }

  .submit-button:hover span {
    transform: translateX(var(--ehq-space-1));
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

  .status,
  .foot {
    margin-top: var(--ehq-space-5);
    color: var(--ehq-text-muted);
    font-size: var(--ehq-type-caption-size);
    line-height: var(--ehq-type-ui-line);
  }

  .status {
    color: var(--ehq-yellow);
  }

  @media (max-width: 860px) {
    .login-shell {
      grid-template-columns: 1fr;
    }

    .brand-panel {
      display: none;
    }

    .form-panel {
      align-items: center;
      padding: var(--ehq-space-5);
    }
  }

  @media (max-height: 620px) {
    .field {
      margin-top: var(--ehq-space-3);
    }

    .status,
    .foot {
      margin-top: var(--ehq-space-3);
    }
  }
</style>
