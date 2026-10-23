<script lang="ts">
  import { app, type Notice } from '../stores/app.svelte';
  import Icon from './Icon.svelte';

  const ICON: Record<Notice['tone'], string> = { info: 'Info', ok: 'CircleCheck', warn: 'TriangleAlert', error: 'CircleX' };

  async function act(n: Notice) {
    app.dismiss(n.id);
    await n.action?.run();
  }
</script>

<div class="notices" aria-live="polite">
  {#each app.notices as n (n.id)}
    <div
      class="notice float arrive {n.tone}"
      role={n.tone === 'error' ? 'alert' : 'status'}
      onpointerenter={() => app.holdNotice(n.id)}
      onpointerleave={() => app.releaseNotice(n.id)}
      onfocusin={() => app.holdNotice(n.id)}
      onfocusout={() => app.releaseNotice(n.id)}
    >
      <span class="ic"><Icon name={ICON[n.tone]} size={16} /></span>
      <span class="text">{n.text}</span>
      {#if n.action}<button class="secondary small act" onclick={() => act(n)}>{n.action.label}</button>{/if}
      <button class="icon small" aria-label="Dismiss" onclick={() => app.dismiss(n.id)}><Icon name="X" size={14} /></button>
    </div>
  {/each}
</div>

<style>
  .notices {
    position: fixed;
    left: 50%;
    bottom: var(--sp-4);
    transform: translateX(-50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-2);
    z-index: 100;
    pointer-events: none;
  }
  .notice {
    --tone: var(--accent);
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 6px 6px 6px var(--sp-3);
    max-width: min(600px, calc(100vw - 32px));
    border-left: 3px solid var(--tone);
  }
  .ok {
    --tone: var(--ok);
  }
  .warn {
    --tone: var(--warn);
  }
  .error {
    --tone: var(--danger);
  }
  .ic {
    flex: none;
    display: inline-flex;
    color: var(--tone);
  }
  .text {
    flex: 1;
    min-width: 0;
  }
  .act {
    flex: none;
    border-color: color-mix(in srgb, var(--tone) 45%, var(--line));
  }
</style>
