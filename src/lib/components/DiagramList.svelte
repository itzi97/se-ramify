<script lang="ts">
  import { app } from '../stores/app.svelte';
  import { kindInfo } from '../model/kinds';
  import type { DiagramMeta } from '../model/types';
  import Icon from './Icon.svelte';

  let { onNew }: { onNew: () => void } = $props();
  let query = $state('');

  /** Diagrams grouped by project, newest first inside each; "No project" last. */
  const groups = $derived.by(() => {
    const q = query.trim().toLowerCase();
    const shown = app.list.filter((m) => (app.showArchived || !m.archived) && (!q || `${m.title} ${m.project} ${kindInfo(m.kind).label} ${kindInfo(m.kind).es}`.toLowerCase().includes(q)));
    const map = new Map<string, DiagramMeta[]>();
    for (const m of shown) {
      const key = m.project || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
  });
  const archivedCount = $derived(app.list.filter((m) => m.archived).length);
</script>

<nav class="list" aria-label="Diagrams">
  <div class="head">
    <button class="primary new" onclick={onNew}><Icon name="Plus" size={16} /> New diagram</button>
    <input type="search" placeholder="Filter" bind:value={query} aria-label="Filter diagrams" />
  </div>
  <div class="scroll">
    {#each groups as [project, items] (project)}
      <div class="sect group">{project || 'No project'}</div>
      {#each items as m (m.path)}
        {@const k = kindInfo(m.kind)}
        <button class="menu-row item" class:on={m.path === app.path} class:archived={m.archived} onclick={() => app.open(m.path)} title="{k.label} · {k.es}">
          <Icon name={k.icon} size={15} />
          <span class="t">{m.title}</span>
        </button>
      {/each}
    {:else}
      <p class="muted small empty">{query ? 'Nothing matches.' : 'No diagrams yet.'}</p>
    {/each}
  </div>
  <div class="foot">
    {#if archivedCount}
      <label class="check small muted"><input type="checkbox" bind:checked={app.showArchived} /> Show archived ({archivedCount})</label>
    {/if}
    <button class="small folder" onclick={() => app.pickDir()} title={app.dir ?? ''}>
      <Icon name="FolderOpen" size={14} />
      <span class="t">{app.dir?.split(/[\\/]/).pop() ?? 'Choose folder'}</span>
    </button>
  </div>
</nav>

<style>
  .list {
    position: absolute;
    top: var(--top-h);
    left: 0;
    bottom: 0;
    width: var(--list-w);
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--line);
    background: var(--panel);
    z-index: 30;
  }
  .head {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    padding: var(--sp-3);
  }
  .new {
    justify-content: center;
  }
  .scroll {
    flex: 1;
    overflow: auto;
    padding: 0 var(--sp-2) var(--sp-3);
  }
  .group {
    padding: var(--sp-3) var(--sp-2) var(--sp-1);
  }
  .item {
    color: var(--ink-2);
  }
  .item.on {
    background: var(--press);
    color: var(--ink);
    font-weight: 700;
  }
  .item.archived {
    opacity: 0.6;
  }
  .t {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .empty {
    padding: var(--sp-3) var(--sp-2);
  }
  .foot {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3) var(--sp-3);
    border-top: 1px solid var(--line);
  }
  .folder {
    max-width: 100%;
  }
</style>
