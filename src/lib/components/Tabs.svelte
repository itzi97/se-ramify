<script lang="ts">
  /**
   * The open diagrams, as tabs above the canvas (like Jupyter's). Click to
   * switch, the X or a middle-click closes, Ctrl+Tab and Ctrl+W from anywhere.
   */
  import { app } from '../stores/app.svelte';
  import { familyOf } from '../model/kinds';
  import KindBadge from './KindBadge.svelte';
  import Icon from './Icon.svelte';

  const metaByPath = $derived(new Map(app.list.map((m) => [m.path, m])));
  const tabs = $derived(app.tabs.map((p) => ({ path: p, m: metaByPath.get(p) })).filter((t) => t.m));
  /** Same title twice: the folder tells them apart. */
  const twice = $derived.by(() => {
    const seen = new Map<string, number>();
    for (const t of tabs) seen.set(t.m!.title, (seen.get(t.m!.title) ?? 0) + 1);
    return seen;
  });

  function keys(e: KeyboardEvent) {
    if (!(e.ctrlKey || e.metaKey) || !app.path) return;
    if (e.key === 'Tab' && tabs.length > 1) {
      e.preventDefault();
      const i = tabs.findIndex((t) => t.path === app.path);
      const next = tabs[(i + (e.shiftKey ? -1 : 1) + tabs.length) % tabs.length];
      void app.open(next.path);
    } else if (e.key.toLowerCase() === 'w') {
      e.preventDefault();
      void app.closeTab(app.path);
    }
  }

  // The tab in front stays in sight when there are more than fit.
  $effect(() => {
    if (app.path) requestAnimationFrame(() => document.querySelector('.doc-tabs .tab.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
  });

  function tabKeys(e: KeyboardEvent, i: number) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const all = [...document.querySelectorAll<HTMLElement>('.doc-tabs .tab .pick')];
    all[(i + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length]?.focus();
  }
</script>

<svelte:window onkeydown={keys} />

{#if tabs.length}
  <div class="doc-tabs" role="tablist" aria-label="Open diagrams">
    {#each tabs as t, i (t.path)}
      {@const m = t.m!}
      <div class="tab" class:on={t.path === app.path} style:--fam={familyOf(m.kind).color} role="presentation" onauxclick={(e) => e.button === 1 && (e.preventDefault(), app.closeTab(t.path))}>
        <button
          class="pick"
          role="tab"
          aria-selected={t.path === app.path}
          tabindex={t.path === app.path ? 0 : -1}
          title="{m.title}{m.project ? `\n${m.project}` : ''}"
          onclick={() => app.open(t.path)}
          onkeydown={(e) => tabKeys(e, i)}
        >
          <KindBadge kind={m.kind} size="sm" />
          <span class="t" lang="es">{m.title || 'Sin título'}</span>
          {#if (twice.get(m.title) ?? 0) > 1 && m.project}<span class="where tiny">{m.project.split('/').pop()}</span>{/if}
        </button>
        <button class="x" aria-label="Close {m.title}" title="Close (Ctrl+W)" tabindex="-1" onclick={() => app.closeTab(t.path)}><Icon name="X" size={13} /></button>
      </div>
    {/each}
  </div>
{/if}

<style>
  .doc-tabs {
    position: absolute;
    top: var(--top-h);
    left: 0;
    right: 0;
    height: var(--tabs-h);
    display: flex;
    align-items: flex-end;
    gap: 2px;
    padding: 0 var(--sp-2);
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
    background: var(--panel-2);
    border-bottom: 1px solid var(--line);
    z-index: 5;
  }
  :global(.has-list) .doc-tabs {
    left: var(--list-w);
  }
  .tab {
    position: relative;
    flex: 0 1 220px;
    min-width: 110px;
    height: calc(var(--tabs-h) - 5px);
    display: flex;
    align-items: center;
    border: 1px solid transparent;
    border-bottom: none;
    border-radius: 8px 8px 0 0;
    color: var(--muted);
  }
  .tab:hover {
    color: var(--ink);
    background: color-mix(in srgb, var(--panel) 60%, transparent);
  }
  .tab.on {
    background: var(--panel);
    border-color: var(--line);
    color: var(--ink);
    margin-bottom: -1px;
    height: calc(var(--tabs-h) - 4px);
  }
  /* The kind's family colour along the top of the tab in front. */
  .tab.on::before {
    content: '';
    position: absolute;
    inset: -1px -1px auto -1px;
    height: 2px;
    border-radius: 8px 8px 0 0;
    background: var(--fam);
  }
  .pick {
    flex: 1;
    min-width: 0;
    height: 100%;
    padding: 0 4px 0 8px;
    gap: 6px;
    justify-content: flex-start;
    background: none;
    font-size: var(--fs-sm);
    font-weight: inherit;
    color: inherit;
  }
  .tab.on .pick {
    font-weight: 700;
  }
  .t {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .where {
    flex: none;
    color: var(--faint);
    font-weight: 400;
  }
  .x {
    flex: none;
    width: 22px;
    height: 22px;
    margin-right: 4px;
    padding: 0;
    border-radius: 6px;
    background: none;
    color: var(--faint);
    opacity: 0;
  }
  .tab:hover .x,
  .tab.on .x,
  .x:focus-visible {
    opacity: 1;
  }
  .x:hover {
    color: var(--ink);
    background: var(--selected);
  }
</style>
