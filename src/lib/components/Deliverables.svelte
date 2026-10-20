<script lang="ts">
  /**
   * The hand-in checklist for one project: what E1, E2, E3 and the final
   * hand-in ask for, which diagrams cover each part, what is still missing
   * inside them, and an export of just that hand-in.
   */
  import { app } from '../stores/app.svelte';
  import { storage } from '../storage/diagrams';
  import { kindInfo } from '../model/kinds';
  import { slug } from '../model/diagram';
  import { blankMinutes } from '../editors/minutes/model';
  import { moduleFor } from '../editors/registry';
  import { DELIVERABLES, deliverableDocs, review, type DeliverableId, type Need, type NeedReview } from '../model/deliverables';
  import type { DataByKind, Diagram, DiagramKind, DiagramMeta, MinutesType } from '../model/types';
  import { exportSet } from '../export/project';
  import Icon from './Icon.svelte';

  let { project, onClose }: { project: string; onClose: () => void } = $props();

  let tab = $state<DeliverableId>('E1');
  let docs = $state<Diagram[]>([]);
  let loading = $state(true);

  const metas = $derived(app.list.filter((m) => (m.project || '') === project && !m.archived));

  async function load() {
    loading = true;
    const s = await storage();
    const out: Diagram[] = [];
    for (const m of metas) {
      // The open diagram may have edits not saved yet: use the live copy.
      if (app.doc && app.doc.id === m.id) out.push(JSON.parse(JSON.stringify(app.doc)) as Diagram);
      else {
        try {
          out.push(await s.load(m.path));
        } catch {
          /* unreadable file: the list already shows it */
        }
      }
    }
    docs = out;
    loading = false;
  }

  $effect(() => {
    metas;
    void load();
  });

  const reviews = $derived(DELIVERABLES.map((d) => review(d, docs)));
  const current = $derived(reviews.find((r) => r.deliverable.id === tab)!);

  const metaOf = (id: string): DiagramMeta | undefined => app.list.find((m) => m.id === id);

  async function openDoc(d: Diagram) {
    const m = metaOf(d.id);
    if (!m) return;
    const path = m.path;
    onClose();
    await app.open(path);
  }

  const MINUTES: Record<string, MinutesType> = { client: 'client', pm: 'postmortem', retro: 'retro' };

  async function create(need: Need, have: number) {
    const kind = need.kinds[0] as DiagramKind;
    let title = need.title;
    if (need.id === 'arch') title = have === 0 ? 'Arquitectura — local' : 'Arquitectura — nube';
    let data: DataByKind[DiagramKind] | undefined;
    if (kind === 'minutes') data = blankMinutes(MINUTES[need.id] ?? 'client');
    else data = (moduleFor(kind).blank as (() => DataByKind[DiagramKind]) | undefined)?.();
    // Read the project before closing: the prop goes null once the panel is gone.
    const into = project;
    onClose();
    await app.create(kind, title, into, data as never);
  }

  function stateIcon(r: NeedReview): string {
    return r.state === 'done' ? 'CircleCheck' : r.state === 'partial' ? 'CircleAlert' : r.state === 'text' ? 'PenLine' : 'Circle';
  }

  /** The final hand-in re-delivers E1–E3 (corrected): its export carries them too. */
  const scope = $derived(tab === 'Final' ? reviews : [current]);

  async function exportDeliverable() {
    const r = current;
    const seen = new Set<string>();
    const list = scope
      .flatMap((x) => deliverableDocs(x))
      .filter((d) => !seen.has(d.id) && (seen.add(d.id), true))
      .map((d) => metaOf(d.id))
      .filter((m): m is DiagramMeta => !!m);
    const intro = ['## Contenido de la entrega', '', '| Apartado | Peso | Diagramas |', '|---|---|---|'];
    for (const p of scope.flatMap((x) => x.parts)) {
      const names = p.needs.flatMap((n) => (n.state === 'text' ? [`_${n.need.label.replace(/ — in the written report$/, '')} (texto)_`] : n.docs.map((d) => d.title)));
      intro.push(`| ${p.part.label} | ${p.part.weight} | ${names.join('; ') || '—'} |`);
    }
    const pending = scope.flatMap((x) => x.parts).flatMap((p) => p.needs).filter((n) => (n.state === 'missing' && !n.need.optional) || n.state === 'partial');
    if (pending.length) {
      intro.push('', '> **Pendiente** (quita esta nota antes de entregar):');
      for (const n of pending) intro.push(`> - ${n.need.label}${n.problems.length ? `: ${n.problems.join('; ')}` : ' — falta'}`);
    }
    await exportSet(list, `${project || 'Proyecto'} — ${r.deliverable.title}`, `${slug(project, 40) || 'proyecto'}-${r.deliverable.id.toLowerCase()}`, intro, `Export ${r.deliverable.id} of "${project || 'No project'}" into…`);
  }

  function onKey(e: KeyboardEvent) {
    // The export-formats dialog opens on top of this one and handles its own Escape.
    if (e.key === 'Escape' && !document.querySelector('[aria-label="Export formats"]')) onClose();
  }
</script>

<svelte:window onkeydown={onKey} />

<button class="scrim veil" aria-label="Close" tabindex="-1" onclick={onClose}></button>
<div class="dialog float arrive" role="dialog" aria-modal="true" aria-label="Hand-in checklist">
  <header class="row between">
    <div class="stack tight">
      <strong>Hand-ins — {project || 'No project'}</strong>
      <span class="tiny muted">What each entrega of the course project asks for, and which of this project's diagrams cover it.</span>
    </div>
    <button class="icon" aria-label="Close" onclick={onClose}><Icon name="X" /></button>
  </header>
  <div class="tabs seg" role="tablist" aria-label="Hand-in">
    {#each reviews as r (r.deliverable.id)}
      <button role="tab" class:active={tab === r.deliverable.id} aria-selected={tab === r.deliverable.id} onclick={() => (tab = r.deliverable.id)}>
        {r.deliverable.id}
        <span class="count" class:full={r.done === r.total}>{r.done}/{r.total}</span>
      </button>
    {/each}
  </div>
  <div class="body">
    <p class="small"><strong>{current.deliverable.title}.</strong> {current.deliverable.blurb}</p>
    {#if loading && !docs.length}<p class="small muted">Reading the project…</p>{/if}
    {#each current.parts as p (p.part.label)}
      <section class="part">
        <div class="row between ph">
          <span class="plabel">{p.part.label}</span>
          <span class="weight">{p.part.weight}</span>
        </div>
        {#each p.needs as r (r.need.id)}
          <div class="need s-{r.state}">
            <span class="st" title={r.state}><Icon name={stateIcon(r)} size={17} /></span>
            <div class="nbody">
              <div class="row wrap gap">
                <span class="nlabel">{r.need.label}{#if r.need.optional}<span class="muted"> (optional)</span>{/if}</span>
                {#each r.docs as d (d.id)}
                  <button class="chip" onclick={() => openDoc(d)} title="Open — {kindInfo(d.kind).es}"><Icon name={kindInfo(d.kind).icon} size={13} /> {d.title}</button>
                {/each}
              </div>
              {#if r.state === 'missing' && r.need.kinds.length}
                <p class="tiny muted">Made with: {r.need.kinds.map((k) => kindInfo(k).es).join(' or ')}{r.need.min && r.need.min > 1 ? ` (${r.need.min} of them)` : ''}.</p>
              {/if}
              {#if r.problems.length}
                <ul class="problems tiny">
                  {#each r.problems as pr, i (i)}<li>{pr}</li>{/each}
                </ul>
              {/if}
            </div>
            {#if r.state !== 'text' && (r.state === 'missing' || r.docs.length < (r.need.min ?? 1))}
              <button class="secondary small" onclick={() => create(r.need, r.docs.length)}><Icon name="Plus" size={14} /> Create</button>
            {/if}
          </div>
        {/each}
      </section>
    {/each}
  </div>
  <footer class="row between">
    <span class="tiny muted">The rubric fails a hand-in with anything missing ("completitud"). Text parts are yours to write in the report.</span>
    <button class="primary" onclick={exportDeliverable} disabled={!scope.some((x) => deliverableDocs(x).length)} title={tab === 'Final' ? 'Exports E1, E2 and E3 too: the final hand-in includes them corrected' : undefined}><Icon name="PackageOpen" size={16} /> Export {current.deliverable.id}…</button>
  </footer>
</div>

<style>
  .veil {
    background: color-mix(in srgb, var(--ink) 18%, transparent) !important;
    z-index: 80;
  }
  .dialog {
    position: fixed;
    inset: 5vh 10vw;
    max-width: 920px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    z-index: 81;
    overflow: hidden;
  }
  header {
    padding: var(--sp-3) var(--sp-3) var(--sp-3) var(--sp-4);
    border-bottom: 1px solid var(--line);
  }
  .tight {
    gap: 2px;
  }
  .tabs {
    margin: var(--sp-3) var(--sp-4) 0;
    align-self: flex-start;
  }
  .count {
    margin-left: 6px;
    font-size: var(--fs-xs, 11px);
    opacity: 0.75;
  }
  .count.full {
    color: var(--ok, #2e8b57);
    opacity: 1;
  }
  .body {
    flex: 1;
    overflow: auto;
    padding: var(--sp-3) var(--sp-4) var(--sp-4);
  }
  .part {
    margin-top: var(--sp-4);
    border: 1px solid var(--line);
    border-radius: var(--r-card);
    background: var(--panel);
    overflow: hidden;
  }
  .ph {
    padding: var(--sp-2) var(--sp-3);
    background: var(--panel-2);
    border-bottom: 1px solid var(--line);
    gap: var(--sp-3);
  }
  .plabel {
    font-weight: 700;
  }
  .weight {
    flex: none;
    font-variant-numeric: tabular-nums;
    color: var(--muted);
  }
  .need {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-3);
    padding: var(--sp-2) var(--sp-3);
  }
  .need + .need {
    border-top: 1px solid var(--line);
  }
  .st {
    flex: none;
    margin-top: 2px;
    color: var(--muted);
  }
  .s-done .st {
    color: var(--ok, #2e8b57);
  }
  .s-partial .st {
    color: var(--warn, #c98a12);
  }
  .s-missing .st {
    color: var(--danger, #c0392b);
  }
  .nbody {
    flex: 1;
    min-width: 0;
  }
  .wrap {
    flex-wrap: wrap;
  }
  .gap {
    gap: var(--sp-2);
  }
  .nlabel {
    margin-right: var(--sp-1);
  }
  .s-text .nlabel {
    color: var(--muted);
    font-style: italic;
  }
  .chip {
    height: auto;
    padding: 1px 8px;
    gap: 4px;
    border: 1px solid var(--line);
    border-radius: 999px;
    background: var(--panel-2);
    color: var(--ink);
    font-size: var(--fs-sm, 12px);
  }
  .chip:hover {
    border-color: var(--accent);
  }
  .problems {
    margin: 4px 0 0;
    padding-left: 18px;
    color: var(--warn-ink, var(--ink));
  }
  footer {
    padding: var(--sp-3) var(--sp-4);
    border-top: 1px solid var(--line);
    gap: var(--sp-3);
  }
  @media (max-width: 760px) {
    .dialog {
      inset: 2vh 3vw;
    }
  }
</style>
