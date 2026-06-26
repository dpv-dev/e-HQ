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
  } from "./routes";
  import { restoreSupabaseAuthSession, signOutOfSupabase, subscribeToSupabaseAuthSession } from "./supabase";

  let route = $state<AppRoute>("/");
  let session = $state<AuthSession | null>(null);
  let initialWorkspaceId = $state<WorkspaceAppId>("command-center");
  let initialPageId = $state<PlatformPageId | null>(null);

  const navigate = (nextRoute: AppRoute): void => {
    window.history.pushState({}, "", nextRoute);
    route = nextRoute;
  };

  const setSession = (nextSession: AuthSession): void => {
    session = nextSession;
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
    const target = resolveConsoleTarget(route);
    if (target !== null) {
      initialWorkspaceId = target.workspaceId;
      initialPageId = target.pageId;
    } else if (route !== "/app") {
      initialWorkspaceId = "command-center";
      initialPageId = null;
    }

    const handlePopState = (): void => {
      route = readRouteFromLocation();
      const popTarget = resolveConsoleTarget(route);
      if (popTarget !== null) {
        initialWorkspaceId = popTarget.workspaceId;
        initialPageId = popTarget.pageId;
      } else if (route !== "/app") {
        initialWorkspaceId = "command-center";
        initialPageId = null;
      }
    };

    const restoreSession = async (): Promise<void> => {
      try {
        const restoredSession = await restoreSupabaseAuthSession();
        if (!cancelled && restoredSession !== null) {
          session = restoredSession;
        }
      } catch (error: unknown) {
        console.error("Supabase session restore failed.", { error });
      }
    };

    const authState = subscribeToSupabaseAuthSession((nextSession: AuthSession | null): void => {
      if (nextSession === null) {
        session = null;
        return;
      }

      session = nextSession;
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
  <LoginPage onLogin={setSession} onNavigate={navigate} />
{:else if session !== null && (route === "/app" || route.startsWith("/console/"))}
  <PlatformShell
    initialWorkspaceId={initialWorkspaceId}
    initialPageId={initialPageId}
    session={session}
    onNavigate={navigate}
    onLogout={clearSession}
  />
{:else if route === "/design"}
  <DesignSystemPage onNavigate={navigate} />
{:else}
  <LandingPage session={session} onLogin={setSession} onNavigate={navigate} onOpenWorkspace={openWorkspace} />
{/if}
