<script lang="ts">
  /**
   * What the window shows when no diagram is open: where you left off, how far
   * each project's hand-ins are, and every kind of diagram one click away.
   */
  import { app } from '../stores/app.svelte';
  import { FAMILIES, GROUP_ORDER, KINDS, familyOf, shortName } from '../model/kinds';
  import type { DiagramKind, DiagramMeta } from '../model/types';
  import type { DeliverableId, DeliverableReview } from '../model/deliverables';
  import { projectReviews } from '../stores/handins';
  import { ago } from '../model/people';
  import { editedLine } from '../storage/team';
  import { exportProject } from '../export/project';
  import Icon from './Icon.svelte';
  import KindBadge from './KindBadge.svelte';
  import Avatar from './Avatar.svelte';

  let {
    onNew,
    onHandIns,
    onPalette
  }: { onNew: (kind?: DiagramKind) => void; onHandIns: (project: string, tab?: DeliverableId) => void; onPalette: () => void } = $props();

  const live = $derived(app.list.filter((m) => !m.archived && !m.dupOf && !m.conflict));
  /** The list comes newest first. */
  const recent = $derived(live.slice(0, 6));
  /** Projects, the one worked on most recently first. */
  const projects = $derived.by(() => {
    const map = new Map<string, DiagramMeta[]>();
    for (const m of live) {
      const k = m.project || '';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    }
    return [...map.entries()];
  });
  const folder = $derived(app.dir?.split(/[\\/]/).pop() ?? '');

  /* Hand-in progress per project, worked out again whenever a diagram changes. */
  let reviews = $state<Record<string, DeliverableReview[]>>({});
  const sig = $derived(live.map((m) => `${m.path}|${m.updated}|${m.project}`).join('\n'));
  $effect(() => {
    void sig;
    const names = projects.map(([p]) => p);
    let stale = false;
    const t = setTimeout(async () => {
      const out: Record<string, DeliverableReview[]> = {};
      for (const p of names) out[p] = await projectReviews(p);
      if (!stale) reviews = out;
    }, 200);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  });

  const pct = (r: DeliverableReview) => (r.total ? Math.round((r.done / r.total) * 100) : 0);
</script>

<div class="home" lang="en">
  <div class="col">
    <header class="hello">
      <div class="stack tight">
        <h1><Icon name="FolderOpen" size={22} /> {folder}</h1>
        <p class="muted">
          {#if live.length}{live.length} diagram{live.length === 1 ? '' : 's'} in {projects.length} project{projects.length === 1 ? '' : 's'}{:else}An empty folder, ready for your group's diagrams{/if}
          · <button class="inline" onclick={() => app.pickDir()}>Use another folder</button>
        </p>
      </div>
      <button class="secondary find" onclick={onPalette}><Icon name="Search" size={15} /> Find a diagram or an action <kbd class="quiet">Ctrl K</kbd></button>
    </header>

    {#if !live.length}
      <section class="example">
        <span class="ex-badge"><Icon name="GraduationCap" size={22} /></span>
        <div class="stack tight grow">
          <h2>See a finished project first</h2>
          <p class="small">Every hand-in — E1, E2, E3 and the final — done for an invented library app: the company, use cases with their specifications, class and sequence diagrams, the backlog, the plan and the actas. Open it next to yours, or delete it when you're done.</p>
        </div>
        <button class="primary" onclick={async () => onHandIns(await app.loadExampleProject())}>Load the example project</button>
      </section>
    {/if}

    {#if recent.length}
      <section>
        <h2>Continue</h2>
        <div class="recent">
          {#each recent as m (m.path)}
            {@const ps = app.presence[m.id] ?? []}
            <button class="rcard" style:--fam={familyOf(m.kind).color} onclick={() => app.open(m.path)} title={editedLine(m.updated, m.updatedBy)}>
              <span class="rtop">
                <KindBadge kind={m.kind} />
                <span class="rkind">{shortName(m.kind)}</span>
                {#if ps.length}
                  <span class="faces">{#each ps.slice(0, 3) as p (p.client)}<Avatar name={p.name} size={18} state={p.editing ? 'editing' : 'here'} title="{p.name} {p.editing ? 'is editing it' : 'has it open'}" />{/each}</span>
                {/if}
              </span>
              <strong class="rtitle" lang="es">{m.title.trim() || 'Sin título'}</strong>
              <span class="rfoot">
                <span class="rproj" lang="es">{m.project || 'No project'}</span>
                <span class="rwhen">
                  {#if m.updatedBy && m.updatedBy !== app.userName}<Avatar name={m.updatedBy} size={16} />{/if}
                  {ago(m.updated)}
                </span>
              </span>
            </button>
          {/each}
        </div>
      </section>
    {/if}

    {#if projects.length}
      <section>
        <h2>Hand-ins</h2>
        <div class="projects">
          {#each projects as [p, items] (p)}
            <div class="proj">
              <div class="pinfo">
                <strong lang="es">{p || 'No project'}</strong>
                <span class="tiny muted">{items.length} diagram{items.length === 1 ? '' : 's'} · changed {ago(items[0].updated)}</span>
              </div>
              <div class="meters" role="group" aria-label="Hand-ins of {p || 'No project'}">
                {#each reviews[p] ?? [] as r (r.deliverable.id)}
                  <button
                    class="meter"
                    class:full={r.total > 0 && r.done === r.total}
                    class:none={r.done === 0}
                    onclick={() => onHandIns(p, r.deliverable.id)}
                    title="{r.deliverable.title}: {r.done} of {r.total} required parts done. Open the checklist"
                  >
                    <span class="mtop"><span class="mid">{r.deliverable.id}</span><span class="mnum">{r.done}/{r.total}</span></span>
                    <span class="bar"><span style:width="{pct(r)}%"></span></span>
                  </button>
                {:else}
                  <span class="tiny muted reading">Checking the hand-ins…</span>
                {/each}
              </div>
              <div class="pacts">
                <button class="icon secondary" title="Hand-in checklist" aria-label="Open the hand-in checklist of {p || 'No project'}" onclick={() => onHandIns(p)}><Icon name="ClipboardCheck" size={16} /></button>
                <button class="icon secondary" title="Export the whole project: every diagram as PNG plus the memoria" aria-label="Export the whole of {p || 'No project'}" onclick={() => exportProject(p)}><Icon name="PackageOpen" size={16} /></button>
              </div>
            </div>
          {/each}
        </div>
      </section>
    {/if}

    <section>
      <h2>Start a new diagram</h2>
      <div class="families">
        {#each GROUP_ORDER as g (g)}
          <div class="famrow" style:--fam={FAMILIES[g].color}>
            <span class="famname">{FAMILIES[g].label}</span>
            <div class="chips">
              {#each KINDS.filter((k) => k.group === g) as k (k.kind)}
                <button class="kchip" onclick={() => onNew(k.kind)} title="{k.es} — {k.blurb}">
                  <KindBadge kind={k.kind} size="sm" />
                  <span lang="es">{shortName(k.kind)}</span>
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </section>

    <footer class="row more">
      <button class="secondary" onclick={() => app.importDiagramFile()}><Icon name="FileInput" size={16} /> Open a diagram file…</button>
      {#if live.length && !app.list.some((m) => m.project.startsWith('Ejemplo — BiblioYa'))}
        <button class="secondary" onclick={async () => onHandIns(await app.loadExampleProject())}><Icon name="GraduationCap" size={16} /> Load the example project</button>
      {/if}
    </footer>
  </div>
</div>

<style>
  .home {
    position: absolute;
    inset: 0;
    overflow: auto;
    background: var(--paper);
  }
  .col {
    max-width: 940px;
    margin: 0 auto;
    padding: 28px 32px 48px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }
  .tight {
    gap: 2px;
  }
  .grow {
    flex: 1;
  }
  h1 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0;
    font-size: 22px;
    line-height: 1.2;
  }
  h1 :global(.lucide) {
    color: var(--muted);
  }
  h2 {
    margin: 0 0 var(--sp-3);
    font-size: var(--fs-lg);
  }
  .hello {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--sp-4);
    flex-wrap: wrap;
  }
  .find {
    color: var(--muted);
    min-width: 280px;
    justify-content: flex-start;
  }
  .find kbd {
    margin-left: auto;
  }

  /* First run: the example project, offered once and plainly. */
  .example {
    display: flex;
    align-items: center;
    gap: var(--sp-4);
    padding: var(--sp-4) var(--sp-5);
    border-radius: var(--r-card);
    background: var(--panel);
    border: 1px solid var(--line);
    border-left: 4px solid var(--accent);
  }
  .example h2 {
    margin: 0;
  }
  .ex-badge {
    flex: none;
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    color: var(--accent);
    background: var(--selected);
  }

  /* Continue: the six most recent diagrams. */
  .recent {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: var(--sp-3);
  }
  .rcard {
    height: auto;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
    padding: var(--sp-3);
    border: 1px solid var(--line);
    border-radius: var(--r-card);
    background: var(--panel);
    color: var(--ink);
    text-align: left;
    white-space: normal;
  }
  .rcard:hover {
    background: var(--panel);
    border-color: var(--fam);
    box-shadow: inset 0 0 0 1px var(--fam);
  }
  .rtop {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
  }
  .rkind {
    font-size: var(--fs-sm);
    color: var(--fam);
    font-weight: 700;
  }
  .faces {
    margin-left: auto;
    display: inline-flex;
    gap: 6px;
    padding-right: 3px;
  }
  .rtitle {
    font-size: var(--fs-md);
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .rfoot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-2);
    font-size: var(--fs-sm);
    color: var(--muted);
  }
  .rproj {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rwhen {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  /* Hand-ins: one row per project, a meter per entrega. */
  .projects {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
  }
  .proj {
    display: flex;
    align-items: center;
    gap: var(--sp-4);
    padding: var(--sp-3) var(--sp-3) var(--sp-3) var(--sp-4);
    border: 1px solid var(--line);
    border-radius: var(--r-card);
    background: var(--panel);
  }
  .pinfo {
    flex: 1 1 200px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .pinfo strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meters {
    flex: 0 1 auto;
    display: flex;
    gap: 6px;
  }
  .meter {
    height: auto;
    width: 84px;
    flex-direction: column;
    align-items: stretch;
    gap: 5px;
    padding: 6px 8px 7px;
    border: 1px solid var(--line);
    border-radius: var(--r-control);
    background: var(--panel);
  }
  .meter:hover {
    border-color: var(--accent);
    background: var(--panel);
  }
  .mtop {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: var(--fs-sm);
  }
  .mid {
    font-weight: 700;
    color: var(--ink);
  }
  .mnum {
    font-size: var(--fs-xs);
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .bar {
    display: block;
    height: 5px;
    border-radius: 3px;
    background: var(--panel-2);
    box-shadow: inset 0 0 0 1px var(--line);
    overflow: hidden;
  }
  .bar span {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: var(--accent);
    transition: width var(--t-layout);
  }
  .meter.full .bar span {
    background: var(--ok);
  }
  .meter.full .mnum {
    color: var(--ok-ink);
    font-weight: 700;
  }
  .reading {
    align-self: center;
  }
  .pacts {
    flex: none;
    display: flex;
    gap: 4px;
  }

  /* New: every kind, by family, in its colour. */
  .families {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--line);
    border-radius: var(--r-card);
    background: var(--panel);
    overflow: hidden;
  }
  .famrow {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-3);
    padding: var(--sp-3) var(--sp-3) var(--sp-3) var(--sp-4);
    box-shadow: inset 3px 0 0 var(--fam);
  }
  .famrow + .famrow {
    border-top: 1px solid var(--line);
  }
  .famname {
    flex: none;
    width: 128px;
    line-height: 30px;
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--fam);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .kchip {
    height: 30px;
    padding: 0 10px 0 5px;
    gap: 6px;
    border: 1px solid var(--line);
    background: var(--panel);
    color: var(--ink);
    font-size: var(--fs-sm);
  }
  .kchip:hover {
    border-color: var(--fam);
    background: color-mix(in srgb, var(--fam) 8%, var(--panel));
  }
  .more {
    gap: var(--sp-2);
    flex-wrap: wrap;
  }

  @media (max-width: 760px) {
    .col {
      padding: 20px 16px 40px;
    }
    .proj {
      flex-wrap: wrap;
    }
    .famrow {
      flex-direction: column;
      gap: var(--sp-2);
    }
  }
</style>
