<script lang="ts">
  import { onMount } from "svelte";
  import type { AuthSession, WorkspaceAppId } from "@ehq/auth";
  import DesignSystemPage from "./DesignSystemPage.svelte";
  import LandingPage from "./LandingPage.svelte";
  import PlatformShell from "./PlatformShell.svelte";
  import type { PlatformPageId } from "./platform-data.js";
  import {
    buildLoginRouteWithNext,
    isProtectedRoute,
    normalizeRoute,
    resolveBareWorkspaceRedirect,
    resolveConsoleRouteForWorkspace,
    resolveConsoleTarget,
    type AppRoute
  } from "./routes.js";
  import { restoreSupabaseAuthSession, signOutOfSupabase, subscribeToSupabaseAuthSession } from "./supabase.js";

  // Resolve a location pathname to a route without touching history. Used at
  // component init so protected deep links — including bare workspace aliases
  // like /office — never flash the landing page before onMount runs, and by
  // readRouteFromLocation, which additionally rewrites the URL for aliases.
  const resolveRouteFromPath = (pathname: string): AppRoute => {
    return resolveBareWorkspaceRedirect(pathname) ?? normalizeRoute(pathname);
  };

  let route = $state<AppRoute>(resolveRouteFromPath(window.location.pathname));
  let session = $state<AuthSession | null>(null);
  // Session restoration always runs on mount; start true to cover that window.
  let isRestoringSession = $state<boolean>(true);
  // True while an intentional logout is in flight so the session-loss redirect
  // (subscription branch and route guard) lets clearSession land on "/".
  let isSigningOut = $state<boolean>(false);
  let initialWorkspaceId = $state<WorkspaceAppId>("command-center");
  let initialPageId = $state<PlatformPageId | null>(null);
  let loginNextRoute = $state<AppRoute | null>(null);

  const navigate = (nextRoute: AppRoute): void => {
    window.history.pushState({}, "", nextRoute);
    route = nextRoute;
  };

  const redirectToLogin = (deniedRoute: AppRoute): void => {
    // Replace the history entry so "back" does not return to the protected route.
    window.history.replaceState({}, "", buildLoginRouteWithNext(deniedRoute));
    loginNextRoute = deniedRoute;
    route = "/login";
  };

  const setSession = (nextSession: AuthSession): void => {
    session = nextSession;
    completeLogin();
  };

  const readLoginNextRoute = (): AppRoute | null => {
    const params = new URLSearchParams(window.location.search);
    const rawNextRoute = params.get("next");

    if (rawNextRoute === null) {
      return null;
    }

    if (rawNextRoute === "") {
      return null;
    }

    // normalizeRoute maps unknown paths to "/", which is rejected below, so the
    // query can only ever produce a valid in-app destination.
    const nextRoute = normalizeRoute(rawNextRoute);

    if (nextRoute === "/") {
      return null;
    }

    if (nextRoute === "/login") {
      return null;
    }

    return nextRoute;
  };

  const resolveWorkspaceFromConsoleRoute = (consoleRoute: AppRoute): WorkspaceAppId => {
    const exactMatch = resolveConsoleTarget(consoleRoute);

    if (exactMatch !== null) {
      return exactMatch.workspaceId;
    }

    if (consoleRoute.startsWith("/console/office")) {
      return "office";
    }

    if (consoleRoute.startsWith("/console/distribution")) {
      return "distribution";
    }

    return "command-center";
  };

  const syncWorkspaceFromRoute = (nextRoute: AppRoute): void => {
    const consoleTarget = resolveConsoleTarget(nextRoute);

    if (consoleTarget !== null) {
      initialWorkspaceId = consoleTarget.workspaceId;
      return;
    }

    if (nextRoute.startsWith("/console/")) {
      initialWorkspaceId = resolveWorkspaceFromConsoleRoute(nextRoute);
      return;
    }

    if (nextRoute !== "/app") {
      initialWorkspaceId = "command-center";
    }
  };

  // Single owner of the login -> destination transition. Every auth-success
  // path (LoginPage submit via setSession, the auth subscription, session
  // restore) funnels through here; the route guard makes it idempotent, so
  // concurrent callers cannot stack duplicate history entries. replaceState
  // swaps the /login entry for the destination so Back never returns to the
  // login form.
  const completeLogin = (): void => {
    if (route !== "/login") {
      return;
    }

    const destination: AppRoute = loginNextRoute ?? "/";
    loginNextRoute = null;

    const target = resolveConsoleTarget(destination);
    if (target !== null) {
      initialWorkspaceId = target.workspaceId;
      initialPageId = target.pageId ?? null;
    } else {
      syncWorkspaceFromRoute(destination);
      initialPageId = null;
    }

    window.history.replaceState({}, "", destination);
    route = destination;
  };

  const clearSessionState = (): void => {
    session = null;
    initialWorkspaceId = "command-center";
    initialPageId = null;
    navigate("/");
  };

  const clearSession = (): void => {
    void (async (): Promise<void> => {
      // Intentional logout: signOutOfSupabase fires SIGNED_OUT before
      // clearSessionState runs, so without this guard the session-loss branch
      // would redirect to /login?next=<protected route> first.
      isSigningOut = true;
      try {
        await signOutOfSupabase();
      } catch (error: unknown) {
        console.error("Supabase sign-out failed.", { error });
      } finally {
        // Navigate to "/" before releasing the guard so the route guard never
        // observes an unauthenticated protected route during logout.
        clearSessionState();
        isSigningOut = false;
      }
    })();
  };

  const openWorkspace = (workspaceId: WorkspaceAppId): void => {
    const nextRoute = resolveConsoleRouteForWorkspace(workspaceId) as AppRoute;
    const target = resolveConsoleTarget(nextRoute);

    initialWorkspaceId = workspaceId;
    initialPageId = target?.pageId ?? null;
    navigate(nextRoute);
  };

  const readRouteFromLocation = (): AppRoute => {
    const redirectRoute = resolveBareWorkspaceRedirect(window.location.pathname);

    if (redirectRoute !== null) {
      window.history.replaceState({}, "", `${redirectRoute}${window.location.search}${window.location.hash}`);
      return redirectRoute;
    }

    return normalizeRoute(window.location.pathname);
  };

  // Route guard: any transition that lands on a protected route without a
  // session (in-app navigation, Back/Forward, session loss) redirects to
  // login once restoration has settled. Intentional logout is excluded via
  // isSigningOut so clearSession can land on "/" instead of /login?next=....
  $effect((): void => {
    if (!isRestoringSession && !isSigningOut && session === null && isProtectedRoute(route)) {
      redirectToLogin(route);
    }
  });

  onMount((): (() => void) => {
    let cancelled = false;
    route = readRouteFromLocation();
    loginNextRoute = route === "/login" ? readLoginNextRoute() : null;
    const target = resolveConsoleTarget(route);
    if (target !== null) {
      initialWorkspaceId = target.workspaceId;
      initialPageId = target.pageId ?? null;
    } else if (route !== "/app") {
      syncWorkspaceFromRoute(route);
      initialPageId = null;
    }

    if (session === null && route === "/login" && loginNextRoute !== null) {
      initialWorkspaceId = resolveWorkspaceFromConsoleRoute(loginNextRoute);
    }

    const handlePopState = (): void => {
      route = readRouteFromLocation();
      loginNextRoute = route === "/login" ? readLoginNextRoute() : null;
      const popTarget = resolveConsoleTarget(route);
      if (popTarget !== null) {
        initialWorkspaceId = popTarget.workspaceId;
        initialPageId = popTarget.pageId ?? null;
      } else if (route !== "/app") {
        syncWorkspaceFromRoute(route);
        initialPageId = null;
      }

      if (route !== "/login") {
        if (isProtectedRoute(route) && session === null && !isRestoringSession) {
          void restoreSession();
        }

        return;
      }

      if (session === null) {
        initialWorkspaceId = resolveWorkspaceFromConsoleRoute("/console/office/dashboard");
      }
    };

    const restoreSession = async (): Promise<void> => {
      isRestoringSession = true;

      try {
        const restoredSession = await restoreSupabaseAuthSession();
        if (cancelled) {
          return;
        }

        if (restoredSession !== null) {
          session = restoredSession;
          completeLogin();
          return;
        }

        if (isProtectedRoute(route)) {
          redirectToLogin(route);
        }
      } catch (error: unknown) {
        console.error("Supabase session restore failed.", { error });

        if (!cancelled && session === null && isProtectedRoute(route)) {
          redirectToLogin(route);
        }
      } finally {
        isRestoringSession = false;
      }
    };

    const authState = subscribeToSupabaseAuthSession((nextSession: AuthSession | null): void => {
      if (nextSession === null) {
        session = null;

        // Losing the session (expiry, remote sign-out) on a protected route
        // sends the user to login instead of falling through to the landing
        // page. Intentional logout is excluded: clearSession navigates to "/".
        if (!isSigningOut && !isRestoringSession && isProtectedRoute(route)) {
          redirectToLogin(route);
        }

        return;
      }

      session = nextSession;
      completeLogin();
    });

    void restoreSession();
    window.addEventListener("popstate", handlePopState);

    return (): void => {
      cancelled = true;
      authState.unsubscribe();
      window.removeEventListener("popstate", handlePopState);
    };
  });
</script>

{#if route === "/login"}
  <LandingPage
    session={session}
    onLogin={setSession}
    onLogout={clearSession}
    onNavigate={navigate}
    onOpenWorkspace={openWorkspace}
    loginMode={true}
  />
{:else if session !== null && isProtectedRoute(route)}
  <PlatformShell
    initialWorkspaceId={initialWorkspaceId}
    initialPageId={initialPageId}
    session={session}
    onNavigate={navigate}
    onLogout={clearSession}
  />
{:else if route === "/design"}
  <DesignSystemPage onNavigate={navigate} />
{:else if isRestoringSession && isProtectedRoute(route)}
  <main class="auth-recovery">
    <p>Restoring your session…</p>
  </main>
{:else}
  <LandingPage session={session} onLogin={setSession} onLogout={clearSession} onNavigate={navigate} onOpenWorkspace={openWorkspace} />
{/if}

<style>
  .auth-recovery {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    background: var(--ehq-bg-main);
    color: var(--ehq-text);
  }

  .auth-recovery p {
    margin: 0;
    font-family: var(--ehq-mono);
    font-size: 0.95rem;
  }
</style>
