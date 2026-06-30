<script lang="ts">
  import { getWorkspaceAccess, type AuthSession, type WorkspaceAppId } from "@ehq/auth";
  import CommandCenterApp from "./canonical/command-center/App.svelte";
  import DistributionApp from "./canonical/distribution/App.svelte";
  import OfficeApp from "./canonical/office/App.svelte";
  import type { PlatformPageId } from "./platform-data.js";
  import { getWorkspaceForPage, workspaces, type WorkspaceDefinition } from "./platform-data.js";
  import type { AppRoute } from "./routes.js";

  interface Props {
    readonly initialWorkspaceId: WorkspaceAppId;
    readonly initialPageId: PlatformPageId | null;
    readonly session: AuthSession;
    readonly onNavigate: (route: AppRoute) => void;
    readonly onLogout: () => void;
  }

  const { initialWorkspaceId, initialPageId, session, onLogout }: Props = $props();

  const requestedWorkspaceId = $derived(resolveRequestedWorkspaceId(initialWorkspaceId, initialPageId));
  const requestedAccess = $derived(getWorkspaceAccess(session, requestedWorkspaceId));
  const activeWorkspaceId = $derived(
    requestedAccess.status === "allowed" ? requestedWorkspaceId : resolveFallbackWorkspaceId(requestedWorkspaceId, session)
  );
  const fallbackAccess = $derived(getWorkspaceAccess(session, activeWorkspaceId));
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
</script>

<svelte:head>
  <title>ë • HQ — console</title>
</svelte:head>

{#if fallbackAccess.status === "locked"}
  <main class="access-denied">
    <section class="ehq-edge-surface">
      <p class="ehq-type-label-mono">access</p>
      <h1 class="ehq-type-display">Workspace locked</h1>
      <span class="ehq-type-body">{fallbackAccess.reason ?? "Your Supabase role does not allow this workspace."}</span>
      <button class="ehq-type-heading" type="button" onclick={onLogout}>Sign out</button>
    </section>
  </main>
{:else}
  {#if lockedMessage.length > 0}
    <p class="workspace-notice ehq-type-label-mono" role="status">{lockedMessage}</p>
  {/if}

  {#if activeWorkspaceId === "office"}
    <OfficeApp {session} {onLogout} />
  {:else if activeWorkspaceId === "distribution"}
    <DistributionApp {session} {onLogout} />
  {:else}
    <CommandCenterApp {session} {onLogout} />
  {/if}
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

  .access-denied section {
    width: min(560px, 100%);
    padding: var(--ehq-space-5);
    display: grid;
    gap: var(--ehq-space-3);
  }

  .access-denied p,
  .access-denied h1,
  .access-denied span {
    margin: 0;
  }

  .access-denied p {
    color: var(--ehq-error);
  }

  .access-denied button {
    justify-self: start;
    min-height: 38px;
    padding: 0 var(--ehq-space-3);
    border: 1px solid var(--ehq-border);
    border-radius: var(--ehq-radius-sm);
    background: transparent;
    color: var(--ehq-text);
  }
</style>
