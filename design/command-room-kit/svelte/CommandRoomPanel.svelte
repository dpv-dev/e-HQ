<script lang="ts">
  import type { Snippet } from "svelte";
  import type { CommandRoomTone } from "./types.js";

  interface Props {
    readonly title: string;
    readonly eyebrow: string;
    readonly tone: CommandRoomTone;
    readonly action: Snippet | null;
    readonly children: Snippet;
  }

  const props: Props = $props();
</script>

<section class={`cr-svelte-panel cr-svelte-tone-${props.tone}`}>
  <header>
    <div>
      <p>{props.eyebrow}</p>
      <h2>{props.title}</h2>
    </div>
    {#if props.action}
      <div class="action">{@render props.action()}</div>
    {/if}
  </header>
  <div class="body">
    {@render props.children()}
  </div>
</section>

<style>
  .cr-svelte-panel {
    display: grid;
    gap: var(--cr-space-5);
    padding: var(--cr-space-5);
    border: 1px solid var(--cr-line);
    border-radius: var(--cr-radius-lg);
    color: var(--cr-text);
    background:
      linear-gradient(145deg, rgba(255, 255, 255, 0.055), transparent 38%),
      var(--cr-surface);
    box-shadow: var(--cr-shadow-panel), inset 0 1px 0 rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(22px);
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--cr-space-4);
  }

  p,
  h2 {
    margin: 0;
  }

  p {
    color: var(--tone-color);
    font-family: var(--cr-font-mono);
    font-size: 0.72rem;
    text-transform: uppercase;
  }

  h2 {
    margin-top: var(--cr-space-2);
    font-size: 1.45rem;
    line-height: 1.1;
    letter-spacing: 0;
  }

  .body {
    min-width: 0;
  }

  .cr-svelte-tone-success {
    --tone-color: var(--cr-success);
  }

  .cr-svelte-tone-warning {
    --tone-color: var(--cr-warning);
  }

  .cr-svelte-tone-danger {
    --tone-color: var(--cr-danger);
  }

  .cr-svelte-tone-info {
    --tone-color: var(--cr-info);
  }

  .cr-svelte-tone-accent {
    --tone-color: var(--cr-accent);
  }

  .cr-svelte-tone-neutral {
    --tone-color: var(--cr-muted);
  }
</style>
