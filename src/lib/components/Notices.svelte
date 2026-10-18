<script lang="ts">
  import { app } from '../stores/app.svelte';
  import Icon from './Icon.svelte';
</script>

<div class="notices" aria-live="polite">
  {#each app.notices as n (n.id)}
    <div class="notice float arrive" class:error={n.tone === 'error'} role={n.tone === 'error' ? 'alert' : 'status'}>
      <span>{n.text}</span>
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
    gap: var(--sp-2);
    z-index: 100;
    pointer-events: none;
  }
  .notice {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 6px 6px 6px var(--sp-3);
    max-width: 560px;
  }
  .notice.error {
    border-color: var(--danger);
    color: var(--danger);
  }
</style>
