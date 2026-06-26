<script lang="ts">
  import type { Snippet } from "svelte";
  import type { OperatorState, Tone, WorkspaceKind } from "./types.js";
  import EmptyState from "./EmptyState.svelte";
  import PageHeader from "./PageHeader.svelte";

  interface Props {
    readonly workspace: WorkspaceKind;
    readonly eyebrow: string;
    readonly title: string;
    readonly description: string;
    readonly meta: string;
    readonly statusLabel: string;
    readonly statusTone: Tone;
    readonly state: OperatorState;
    readonly emptyTitle: string;
    readonly emptyDetail: string;
    readonly disabledReason: string;
    readonly headerActions?: Snippet;
    readonly toolbar?: Snippet;
    readonly children?: Snippet;
  }

  const props: Props = $props();
</script>

<div class={`ehq-page-template ehq-operator-page ehq-workspace-${props.workspace}`}>
  <PageHeader
    workspace={props.workspace}
    eyebrow={props.eyebrow}
    title={props.title}
    description={props.description}
    meta={props.meta}
    statusLabel={props.statusLabel}
    statusTone={props.statusTone}
  >
    {#snippet actions()}
      {#if props.headerActions}
        {@render props.headerActions()}
      {/if}
    {/snippet}
  </PageHeader>

  {#if props.toolbar}
    <div class="template-toolbar">
      {@render props.toolbar()}
    </div>
  {/if}

  {#if props.state === "ready"}
    {#if props.children}
      {@render props.children()}
    {/if}
  {:else}
    <EmptyState
      title={props.emptyTitle}
      detail={props.emptyDetail}
      state={props.state}
      actionLabel=""
      actionHref={null}
      disabledReason={props.disabledReason}
    />
  {/if}
</div>

<style>
  .ehq-page-template {
    padding: var(--ehq-space-5);
  }

  .template-toolbar {
    min-width: 0;
  }

  @media (max-width: 760px) {
    .ehq-page-template {
      padding: var(--ehq-space-4);
    }
  }
</style>
