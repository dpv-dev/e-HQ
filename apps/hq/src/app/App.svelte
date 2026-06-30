<script lang="ts">
  import { onMount } from "svelte";
  import type { AuthSession, WorkspaceAppId } from "@ehq/auth";
  import DesignSystemPage from "./DesignSystemPage.svelte";
  import LandingPage from "./LandingPage.svelte";
  import LoginPage from "./LoginPage.svelte";
  import PlatformShell from "./PlatformShell.svelte";
  import type { PlatformPageId } from "./platform-data.js";
  import {
    normalizeRoute,
    resolveBareWorkspaceRedirect,
    resolveConsoleRouteForWorkspace,
    resolveConsoleTarget,
    type AppRoute
  } from "./routes.js";
  import { normalizeRoutePath } from "./route-utils.js";
  import { restoreSupabaseAuthSession, signOutOfSupabase, subscribeToSupabaseAuthSession } from "./supabase.js";

  let route = $state<AppRoute>("/");
  let session = $state<AuthSession | null>(null);
  let isRestoringSession = $state<boolean>(false);
  let initialWorkspaceId = $state<WorkspaceAppId>("command-center");
  let initialPageId = $state<PlatformPageId | null>(null);
  let loginNextRoute = $state<AppRoute | null>(null);

  const navigate = (nextRoute: AppRoute): void => {
    window.history.pushState({}, "", nextRoute);
    route = nextRoute;
  };

  const setSession = (nextSession: AuthSession): void => {
    session = nextSession;
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

    const nextRoute = normalizeRoutePath(rawNextRoute);

    if (nextRoute === "/") {
      return null;
    }

    if (nextRoute === "/login") {
      return null;
    }

    return nextRoute as AppRoute;
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

  const clearSessionState = (): void => {
    session = null;
    initialWorkspaceId = "command-center";
    initialPageId = null;
    navigate("/");
  };

  const clearSession = (): void => {
    void (async (): Promise<void> => {
      try {
        await signOutOfSupabase();
      } catch (error: unknown) {
        console.error("Supabase sign-out failed.", { error });
      } finally {
        clearSessionState();
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
        if (route.startsWith("/console/") && session === null && !isRestoringSession) {
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
        if (!cancelled && restoredSession !== null) {
          session = restoredSession;

          if (route === "/login" && loginNextRoute !== null) {
            navigate(loginNextRoute);
          }
        }
      } catch (error: unknown) {
        console.error("Supabase session restore failed.", { error });
      } finally {
        isRestoringSession = false;
      }
    };

    const authState = subscribeToSupabaseAuthSession((nextSession: AuthSession | null): void => {
      if (nextSession === null) {
        session = null;
        return;
      }

      session = nextSession;

      if (route === "/login" && loginNextRoute !== null) {
        navigate(loginNextRoute);
      }
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
  <LoginPage onLogin={setSession} onNavigate={navigate} nextRoute={loginNextRoute} />
{:else if session !== null && (route === "/app" || route === "/console" || route.startsWith("/console/"))}
  <PlatformShell
    initialWorkspaceId={initialWorkspaceId}
    initialPageId={initialPageId}
    session={session}
    onNavigate={navigate}
    onLogout={clearSession}
  />
{:else if route === "/design"}
  <DesignSystemPage onNavigate={navigate} />
{:else if isRestoringSession && (route === "/app" || route.startsWith("/console/"))}
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
