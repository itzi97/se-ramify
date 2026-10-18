<script lang="ts">
  import { app } from '../stores/app.svelte';
  import { GROUP_ORDER, KINDS, type KindInfo } from '../model/kinds';
  import { moduleFor } from '../editors/registry';
  import type { DiagramKind } from '../model/types';
  import Icon from './Icon.svelte';

  let { onClose }: { onClose: () => void } = $props();

  let kind = $state<DiagramKind>('usecase');
  let title = $state('');
  let project = $state(app.doc?.project ?? lastProject());
  let start = $state<'blank' | 'example'>('blank');
  let query = $state('');

  function lastProject(): string {
    return app.list.find((m) => m.project)?.project ?? '';
  }

  const projects = $derived([...new Set(app.list.map((m) => m.project).filter(Boolean))].sort());
  const matches = (k: KindInfo) => {
    const q = query.trim().toLowerCase();
    return !q || `${k.label} ${k.es} ${k.blurb} ${k.course}`.toLowerCase().includes(q);
  };
  const info = $derived(KINDS.find((k) => k.kind === kind)!);

  async function create() {
    const mod = moduleFor(kind);
    const data = start === 'example' ? mod.example() : undefined;
    await app.create(kind, title.trim() || info.es, project, data as never);
    onClose();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window onkeydown={onKey} />

<button class="scrim veil" aria-label="Close" tabindex="-1" onclick={onClose}></button>
<div class="dialog float arrive" role="dialog" aria-modal="true" aria-label="New diagram">
  <header class="row between">
    <strong>New diagram</strong>
    <input type="search" class="q" placeholder="Search kinds (e.g. secuencia, gantt)" bind:value={query} aria-label="Search diagram kinds" />
    <button class="icon" aria-label="Close" onclick={onClose}><Icon name="X" /></button>
  </header>
  <div class="body">
    <div class="kinds">
      {#each GROUP_ORDER as g (g)}
        {@const items = KINDS.filter((k) => k.group === g && matches(k))}
        {#if items.length}
          <div class="sect">{g}</div>
          <div class="grid">
            {#each items as k (k.kind)}
              <button class="card" class:on={k.kind === kind} onclick={() => (kind = k.kind)} ondblclick={create} aria-pressed={k.kind === kind}>
                <Icon name={k.icon} size={20} />
                <span class="names">
                  <strong>{k.es}</strong>
                  {#if k.label.toLowerCase() !== k.es.toLowerCase()}<span class="muted small">{k.label}</span>{/if}
                </span>
              </button>
            {/each}
          </div>
        {/if}
      {/each}
    </div>
    <aside class="side stack">
      <div class="stack about">
        <div class="row"><Icon name={info.icon} size={22} /><strong class="big">{info.es}</strong></div>
        <p class="small">{info.blurb}</p>
        <p class="tiny muted">In the course: {info.course}</p>
      </div>
      <label class="field">Title <input type="text" bind:value={title} placeholder={info.es} /></label>
      <label class="field">
        Project
        <input type="text" list="projects" bind:value={project} placeholder="e.g. Proyecto final, Ejercicios T3" />
        <datalist id="projects">{#each projects as p (p)}<option value={p}></option>{/each}</datalist>
      </label>
      <div class="seg" role="radiogroup" aria-label="Start from">
        <button class:active={start === 'blank'} role="radio" aria-checked={start === 'blank'} onclick={() => (start = 'blank')}>Blank</button>
        <button class:active={start === 'example'} role="radio" aria-checked={start === 'example'} onclick={() => (start = 'example')}>Example</button>
      </div>
      <p class="tiny muted">{start === 'example' ? 'Starts with a small worked example (a library loans system) to edit or learn from.' : 'Starts empty.'}</p>
      <div class="spacer"></div>
      <button class="primary go" onclick={create}><Icon name="Plus" size={16} /> Create</button>
    </aside>
  </div>
</div>

<style>
  .veil {
    background: color-mix(in srgb, var(--ink) 18%, transparent) !important;
    z-index: 80;
  }
  .dialog {
    position: fixed;
    inset: 6vh 6vw;
    max-width: 1100px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    z-index: 81;
    overflow: hidden;
  }
  header {
    padding: var(--sp-3) var(--sp-3) var(--sp-3) var(--sp-4);
    border-bottom: 1px solid var(--line);
    gap: var(--sp-3);
  }
  .q {
    max-width: 360px;
    margin-left: auto;
  }
  .body {
    flex: 1;
    min-height: 0;
    display: flex;
  }
  .kinds {
    flex: 1;
    overflow: auto;
    padding: var(--sp-2) var(--sp-4) var(--sp-4);
  }
  .sect {
    margin: var(--sp-4) 0 var(--sp-2);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: var(--sp-2);
  }
  .card {
    height: auto;
    min-height: 56px;
    padding: var(--sp-2) var(--sp-3);
    border: 1px solid var(--line);
    border-radius: var(--r-card);
    background: var(--panel);
    color: var(--ink);
    gap: var(--sp-3);
    white-space: normal;
    text-align: left;
  }
  .card.on {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
  }
  .names {
    display: flex;
    flex-direction: column;
    line-height: 1.25;
  }
  .side {
    width: 320px;
    flex: none;
    padding: var(--sp-4);
    border-left: 1px solid var(--line);
    background: var(--panel-2);
    overflow: auto;
  }
  .big {
    font-size: var(--fs-lg);
  }
  .go {
    justify-content: center;
  }
  @media (max-width: 760px) {
    .body {
      flex-direction: column;
    }
    .side {
      width: auto;
      border-left: 0;
      border-top: 1px solid var(--line);
    }
  }
</style>
