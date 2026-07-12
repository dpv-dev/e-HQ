<script lang="ts">
  import { getWorkspaceAccess, type AuthSession, type WorkspaceAppId } from "@ehq/auth";
  import { Button, EmptyState, Loader } from "@ehq/ui";
  import type { PlatformPageId } from "./platform-data.js";
  import { getWorkspaceForPage, workspaces, type WorkspaceDefinition } from "./platform-data.js";
  import type { AppRoute } from "./routes.js";
  import { loadWorkspaceComponent, type WorkspaceComponentModule } from "./workspace-loader.js";
  import officeOrbitalScopeUrl from "../office-orbital-scope.css?url";
  import orbitalOfficeUrl from "./canonical/office/orbital-office.css?url";

  interface Props {
    readonly initialWorkspaceId: WorkspaceAppId;
    readonly initialPageId: PlatformPageId | null;
    readonly session: AuthSession;
    readonly onNavigate: (route: AppRoute) => void;
    readonly onLogout: () => void;
  }

  const { initialWorkspaceId, initialPageId, session, onNavigate, onLogout }: Props = $props();

  const requestedWorkspaceId = $derived(resolveRequestedWorkspaceId(initialWorkspaceId, initialPageId));
  const requestedAccess = $derived(getWorkspaceAccess(session, requestedWorkspaceId));
  const activeWorkspaceId = $derived(
    requestedAccess.status === "allowed" ? requestedWorkspaceId : resolveFallbackWorkspaceId(requestedWorkspaceId, session)
  );
  const fallbackAccess = $derived(getWorkspaceAccess(session, activeWorkspaceId));
  const workspaceComponentModule = $derived(loadWorkspaceComponent(activeWorkspaceId));
  const lockedMessage = $derived(
    requestedAccess.status === "locked" ? requestedAccess.reason ?? "Access locked. Request access required." : ""
  );

  function resolveRequestedWorkspaceId(
    workspaceId: WorkspaceAppId,
    pageId: PlatformPageId | null
  ): WorkspaceAppId {
    if (pageId === null || pageId === undefined) {
      return workspaceId;
    }

    return getWorkspaceForPage(pageId).id;
  }

  function resolveFallbackWorkspaceId(workspaceId: WorkspaceAppId, activeSession: AuthSession): WorkspaceAppId {
    const allowedWorkspace = workspaces.find(
      (item: WorkspaceDefinition): boolean => getWorkspaceAccess(activeSession, item.id).status === "allowed"
    );

    if (allowedWorkspace === undefined) {
      return workspaceId;
    }

    return allowedWorkspace.id;
  }

  function openHqLanding(): void {
    onNavigate("/app");
  }

</script>

<svelte:head>
  <link rel="stylesheet" href={officeOrbitalScopeUrl} />
  <link rel="stylesheet" href={orbitalOfficeUrl} />
  <title>ë • HQ — console</title>
</svelte:head>

{#if fallbackAccess.status === "locked"}
  <main class="access-denied">
    <div class="access-denied-body">
      <EmptyState
        title="Workspace locked"
        detail={fallbackAccess.reason ?? "Your Supabase role does not allow this workspace."}
        state="error"
        actionLabel=""
        actionHref={null}
        disabledReason=""
      />
      <div class="access-denied-actions">
        <Button
          label="Back to HQ"
          variant="secondary"
          size="medium"
          type="button"
          disabled={false}
          loading={false}
          locked={false}
          focus={false}
          ariaLabel="Back to HQ landing"
          onclick={openHqLanding}
        />
        <Button
          label="Sign out"
          variant="primary"
          size="medium"
          type="button"
          disabled={false}
          loading={false}
          locked={false}
          focus={false}
          ariaLabel="Sign out"
          onclick={onLogout}
        />
      </div>
    </div>
  </main>
{:else}
  {#if lockedMessage.length > 0}
    <p class="workspace-notice ehq-type-label-mono" role="status">{lockedMessage}</p>
  {/if}

  {#await workspaceComponentModule}
    <main class="workspace-loader" aria-live="polite" aria-busy="true">
      <Loader label="Loading workspace" detail="Preparing the selected console." size="medium" />
    </main>
  {:then module}
    <module.default {session} {onLogout} />
  {:catch}
    <main class="workspace-loader">
      <EmptyState
        title="Workspace unavailable"
        detail="The selected workspace failed to load. Reload the page or return to HQ."
        state="error"
        actionLabel=""
        actionHref={null}
        disabledReason=""
      />
    </main>
  {/await}
{/if}

<style>
  .workspace-notice {
    position: fixed;
    z-index: 30;
    top: var(--ehq-space-3);
    left: 50%;
    transform: translateX(-50%);
    max-width: min(720px, calc(100vw - var(--ehq-space-6)));
    margin: 0;
    padding: var(--ehq-space-2) var(--ehq-space-3);
    border: 1px solid var(--ehq-warning);
    border-radius: var(--ehq-radius-sm);
    background: var(--ehq-surface);
    color: var(--ehq-warning);
    box-shadow: var(--ehq-shadow-md);
  }

  .access-denied {
    min-height: 100vh;
    padding: var(--ehq-space-6);
    background: var(--ehq-bg);
    color: var(--ehq-text);
    display: grid;
    place-items: center;
  }

  .access-denied-body {
    width: min(560px, 100%);
    display: grid;
    gap: var(--ehq-space-3);
  }

  .access-denied-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ehq-space-2);
  }

  .workspace-loader {
    min-height: 100vh;
    padding: var(--ehq-space-6);
    display: grid;
    place-items: center;
    background: var(--ehq-bg);
    color: var(--ehq-text);
  }
</style>
