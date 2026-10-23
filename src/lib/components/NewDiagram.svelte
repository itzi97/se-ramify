<script lang="ts">
  import { app } from '../stores/app.svelte';
  import { FAMILIES, GROUP_ORDER, KINDS, familyOf, type KindInfo } from '../model/kinds';
  import { moduleFor } from '../editors/registry';
  import type { DiagramKind } from '../model/types';
  import Icon from './Icon.svelte';
  import KindBadge from './KindBadge.svelte';
  import { focusIn } from './focus';

  let { onClose, initialKind }: { onClose: () => void; initialKind?: DiagramKind } = $props();

  // svelte-ignore state_referenced_locally
  let kind = $state<DiagramKind>(initialKind ?? 'usecase');
  let title = $state('');
  let project = $state(app.cwd);
  let start = $state<'blank' | 'example'>('blank');
  let query = $state('');


  const projects = $derived(app.entries.filter((e) => e.type === 'folder').map((e) => e.rel).sort((a, b) => a.localeCompare(b, 'es')));
  /** Lower case, no accents: "comunicacion" finds "comunicación". */
  const fold = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  /** Other names people search by. */
  const ALSO: Partial<Record<string, string>> = {
    usecase: 'sistema actores casos uso use case',
    storymap: 'mapa de historias de usuario story map sprints backlog',
    kanban: 'tablero tareas',
    gantt: 'planificacion cronograma calendario pud',
    stakeholder: 'interesados poder interes cebolla',
    architecture: 'tco equipos red infraestructura nube servidores',
    deployment: 'despliegue componentes nodos',
    flowchart: 'flujo modelo de desarrollo ciclo de vida cascada espiral',
    er: 'entidad relacion base de datos chen',
    dfd: 'flujo de datos contexto',
    screenflow: 'pantallas wireframe prototipo mockup',
    traceability: 'trazabilidad matriz requisitos pruebas',
    vision: 'elevator pitch vision producto',
    canvas: 'canvas modelo de negocio lienzo',
    brainstorm: 'lluvia de ideas',
    sixhats: 'seis sombreros de bono',
    journey: 'viaje del cliente experiencia'
  };
  const matches = (k: KindInfo) => {
    const q = fold(query.trim());
    return !q || q.split(/\s+/).every((w) => fold(`${k.label} ${k.es} ${k.blurb} ${k.course} ${ALSO[k.kind] ?? ''}`).includes(w));
  };
  const anyMatch = $derived(KINDS.some(matches));
  // The selection follows the search: the first match is picked when the current one drops out.
  $effect(() => {
    query;
    const shown = GROUP_ORDER.flatMap((g) => KINDS.filter((k) => k.group === g && matches(k)));
    if (shown.length && !shown.some((k) => k.kind === kind)) kind = shown[0].kind;
  });
  const info = $derived(KINDS.find((k) => k.kind === kind)!);
  /** "T3 Requisitos · T4 UML · E2" as separate tags. */
  const where = $derived(info.course.split(' · ').map((t) => t.trim()).filter(Boolean));

  /** The chosen card scrolls into view when it was picked from outside (home screen, search). */
  function reveal(node: HTMLElement, on: boolean) {
    if (on) requestAnimationFrame(() => node.scrollIntoView({ block: 'center' }));
  }

  async function create() {
    const mod = moduleFor(kind);
    const data = start === 'example' ? mod.example() : mod.blank?.();
    await app.create(kind, title.trim() || info.es, project, data as never);
    onClose();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'Enter' && anyMatch && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      void create();
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<button class="scrim veil" aria-label="Close" tabindex="-1" onclick={onClose}></button>
<div class="dialog float arrive" role="dialog" aria-modal="true" aria-label="New diagram">
  <header class="row between">
    <strong>New diagram</strong>
    <input type="search" class="q" placeholder="Search kinds (e.g. secuencia, gantt)" bind:value={query} aria-label="Search diagram kinds" use:focusIn />
    <button class="icon" aria-label="Close" onclick={onClose}><Icon name="X" /></button>
  </header>
  <div class="body">
    <div class="kinds">
      {#if !anyMatch}<p class="muted small none">No kind matches "{query}".</p>{/if}
      {#each GROUP_ORDER as g (g)}
        {@const items = KINDS.filter((k) => k.group === g && matches(k))}
        {#if items.length}
          <div class="fhead" style:--fam={FAMILIES[g].color}><span class="dot"></span>{FAMILIES[g].label}<span class="n">{items.length}</span></div>
          <div class="grid">
            {#each items as k (k.kind)}
              <button class="card" class:on={k.kind === kind} style:--fam={FAMILIES[g].color} onclick={() => (kind = k.kind)} ondblclick={create} aria-pressed={k.kind === kind} use:reveal={k.kind === initialKind}>
                <KindBadge kind={k.kind} />
                <span class="names">
                  <strong lang="es">{k.es}</strong>
                  {#if k.label.toLowerCase() !== k.es.toLowerCase()}<span class="muted small">{k.label}</span>{/if}
                </span>
              </button>
            {/each}
          </div>
        {/if}
      {/each}
    </div>
    <aside class="side stack" style:--fam={familyOf(kind).color}>
      <div class="stack about">
        <div class="row top"><KindBadge kind={kind} size="lg" /><div class="stack tight"><span class="fam-name">{familyOf(kind).label}</span><strong class="big" lang="es">{info.es}</strong></div></div>
        <p class="small">{info.blurb}</p>
        <div class="where" aria-label="Where it shows up in the course">
          {#each where as w (w)}<span class="tag" lang="es">{w}</span>{/each}
        </div>
      </div>
      <label class="field">Title <input type="text" bind:value={title} placeholder={info.es} /></label>
      <label class="field">
        Folder
        <input type="text" list="projects" bind:value={project} placeholder="Top folder · or type a new one, e.g. Neuranet/E2" />
        <datalist id="projects">{#each projects as p (p)}<option value={p}></option>{/each}</datalist>
      </label>
      <div class="seg" role="radiogroup" aria-label="Start from">
        <button class:active={start === 'blank'} role="radio" aria-checked={start === 'blank'} onclick={() => (start = 'blank')}>Blank</button>
        <button class:active={start === 'example'} role="radio" aria-checked={start === 'example'} onclick={() => (start = 'example')}>Example</button>
      </div>
      <p class="tiny muted">{start === 'example' ? 'Starts with a small worked example (a library loans system) to edit or learn from.' : 'Starts empty.'} <kbd class="quiet">Enter</kbd> creates.</p>
      <div class="spacer"></div>
      <button class="primary go" onclick={create} disabled={!anyMatch}><Icon name="Plus" size={16} /> Create</button>
    </aside>
  </div>
</div>

<style>
  .veil {
    background: var(--veil) !important;
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
  .fhead {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    margin: var(--sp-4) 0 var(--sp-2);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--fam);
  }
  .fhead .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--fam);
  }
  .fhead .n {
    font-weight: 400;
    color: var(--muted);
  }
  .none {
    margin-top: var(--sp-4);
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
  .card:hover {
    border-color: color-mix(in srgb, var(--fam) 60%, var(--line));
    background: var(--panel);
  }
  .card.on {
    border-color: var(--fam);
    background: color-mix(in srgb, var(--fam) 7%, var(--panel));
    box-shadow: inset 0 0 0 1px var(--fam);
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
    line-height: 1.25;
  }
  .top {
    align-items: flex-start;
    gap: var(--sp-3);
  }
  .tight {
    gap: 2px;
  }
  .fam-name {
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--fam);
  }
  .where {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
  .tag {
    padding: 1px 8px;
    border-radius: var(--r-pill);
    border: 1px solid var(--line);
    background: var(--panel);
    font-size: var(--fs-xs);
    color: var(--ink-2);
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
