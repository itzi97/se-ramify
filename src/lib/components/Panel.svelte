<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  /**
   * The one floating panel: everything that opens from the top strip.
   * Header: a title (or a tab strip, or anything else) on the left, close on
   * the right. Body scrolls under a fixed header; one width, one padding.
   */
  let {
    title = '',
    head,
    children,
    onClose,
    closeLabel = 'Close',
    closeTitle,
    side = 'right',
    dense = false,
    class: cls = '',
    role = 'dialog',
    label,
    ...rest
  }: {
    title?: string;
    head?: Snippet;
    children: Snippet;
    onClose: () => void;
    closeLabel?: string;
    closeTitle?: string;
    side?: 'left' | 'right';
    /** A list of menu rows: rows carry their own inset, so the text lines up with the title. */
    dense?: boolean;
    class?: string;
    role?: string;
    /** Accessible name when the title is not plain text (or empty). */
    label?: string;
    [key: string]: unknown;
  } = $props();
</script>

<aside class="shell-panel float arrive {side} {cls}" {role} aria-label={label ?? (title || undefined)} {...rest}>
  <header class="panel-head">
    <div class="panel-title">
      {#if head}{@render head()}{:else}<strong>{title}</strong>{/if}
    </div>
    <button class="icon" onclick={onClose} aria-label={closeLabel} title={closeTitle ?? closeLabel}>
      <Icon name="X" size={16} />
    </button>
  </header>
  <div class="panel-body stack" class:dense>
    {@render children()}
  </div>
</aside>

<style>
  .shell-panel {
    position: absolute;
    /* Above any editor's own panels and toolbars. */
    z-index: 60;
    top: var(--chrome-top);
    width: var(--panel-w);
    /* Clears the top strip and the bottom bars. */
    max-height: calc(100% - var(--chrome-top) - var(--chrome-bottom));
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .right {
    right: var(--edge);
  }
  .left {
    left: var(--edge);
  }
  .panel-head {
    flex: none;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--sp-2);
    padding: var(--sp-3) var(--sp-3) 0 var(--sp-4);
  }
  .panel-title {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: 30px;
    font-size: var(--fs-md);
  }
  .panel-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow: auto;
    padding: var(--sp-3) var(--sp-4) var(--sp-4);
  }
  .panel-body.dense {
    gap: 2px;
    padding: var(--sp-1) var(--sp-2) var(--sp-2);
  }
</style>
