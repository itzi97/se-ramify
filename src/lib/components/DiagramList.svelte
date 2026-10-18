<script lang="ts">
  import { app } from '../stores/app.svelte';
  import { kindInfo } from '../model/kinds';
  import type { DiagramMeta } from '../model/types';
  import Icon from './Icon.svelte';
  import { exportProject } from '../export/project';

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
      <div class="sect group row between">
        <span>{project || 'No project'}</span>
        <button class="icon small" title="Export this project: every diagram as PNG plus a Markdown memoria" aria-label="Export project {project || 'No project'}" onclick={() => exportProject(project)}><Icon name="PackageOpen" size={14} /></button>
      </div>
      {#each items as m (m.path)}
        {@const k = kindInfo(m.kind)}
        <button class="menu-row item" class:on={m.path === app.path} class:archived={m.archived} onclick={async (e) => {
            const btn = e.currentTarget;
            await app.open(m.path);
            // Hand the keyboard to the diagram (Del, arrows, Ctrl+A act on the canvas, not on this button).
            btn.blur();
          }} title="{k.label} · {k.es}">
          <Icon name={k.icon} size={15} />
          <span class="t">{m.title.trim() || 'Sin título'}</span>
        </button>
      {/each}
    {:else}
      <p class="muted small empty">{query ? 'Nothing matches.' : 'No diagrams yet.'}</p>
    {/each}
  </div>
  <div class="foot">
    {#if app.deleted.length}
      <details class="trash">
        <summary class="small muted">Recently deleted ({app.deleted.length})</summary>
        {#each app.deleted.slice(0, 20) as d (d.id)}
          <div class="row between del">
            <span class="t small">{d.title || 'Sin título'}</span>
            <button class="secondary small" onclick={() => app.undelete(d)}>Restore</button>
          </div>
        {/each}
      </details>
    {/if}
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
    padding: var(--sp-3) 0 var(--sp-1) var(--sp-2);
  }
  .group button {
    opacity: 0.55;
    color: var(--muted);
  }
  .group:hover button,
  .group button:focus-visible {
    opacity: 1;
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
  .trash {
    width: 100%;
  }
  .trash summary {
    cursor: pointer;
    padding: 2px 0;
  }
  .del {
    gap: var(--sp-2);
    padding: 2px 0;
  }
  .del .t {
    flex: 1;
  }
</style>
