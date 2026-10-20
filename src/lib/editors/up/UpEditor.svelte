<script lang="ts">
  import { app } from '../../stores/app.svelte';
  import { blankUp } from '../../model/diagram';
  import { kindInfo } from '../../model/kinds';
  import type { DiagramMeta, UpArtifact, UpData } from '../../model/types';
  import Icon from '../../components/Icon.svelte';
  import { autosize } from '../board/actions';
  import {
    CHART,
    MAX_EFFORT,
    STATUSES,
    addArtifact,
    addDiscipline,
    addIteration,
    addSuggested,
    artifactsOf,
    autoLink,
    chartLayout,
    effortAt,
    effortFromY,
    humpPath,
    iterationsOf,
    kindFor,
    moveArtifact,
    moveArtifactToPhase,
    moveDiscipline,
    progress,
    removeArtifact,
    removeDiscipline,
    removeIteration,
    renameDiscipline,
    renameIteration,
    rowBaseline,
    setEffort,
    setPhase,
    statusInfo,
    suggestedArtifacts,
    updateArtifact,
    wrapText
  } from './model';

  /**
   * Unified Process plan: the classic chart (phases and iterations across,
   * disciplines down with their effort "humps", milestones at the end of each
   * phase) and, under it, the artefacts of each phase linked to the diagrams
   * of the same project. The panel on the right edits it all.
   */

  const doc = $derived(app.docOf('up'));
  const data = $derived(normalize(doc.data));
  const L = $derived(chartLayout(data));

  function normalize(d: UpData): UpData {
    const blank = blankUp();
    return {
      phases: d.phases?.length ? d.phases : blank.phases,
      disciplines: d.disciplines?.length ? d.disciplines : blank.disciplines,
      artifacts: d.artifacts ?? []
    };
  }

  /** Inside `app.change`: the live data, healed if a file lost its phases or disciplines. */
  function ud(d: { data: unknown }): UpData {
    const x = d.data as UpData;
    if (!x.phases?.length || !x.disciplines?.length) {
      const blank = blankUp();
      if (!x.phases?.length) x.phases = blank.phases;
      if (!x.disciplines?.length) x.disciplines = blank.disciplines;
    }
    x.artifacts ??= [];
    return x;
  }

  let tab = $state<'artifacts' | 'phases' | 'disciplines'>('artifacts');
  let selected = $state<string | null>(null);
  let editCurves = $state(false);
  const current = $derived(data.artifacts.find((a) => a.id === selected) ?? null);

  const COLORS = ['#4a7fc1', '#3a9e9a', '#58a55c', '#8a63c4', '#e8873a', '#d9534f', '#b0864a', '#6c8aa0', '#c25b9a'];
  const colorOf = (i: number) => COLORS[i % COLORS.length];

  /* -------------------------------------------------- project diagrams */

  const projectDiagrams = $derived(
    app.list.filter((m) => (m.project || '') === (doc.project || '') && m.id !== doc.id && !m.archived).sort((a, b) => a.title.localeCompare(b.title, 'es'))
  );
  const metaOf = (id: string | undefined): DiagramMeta | undefined => (id ? app.list.find((m) => m.id === id) : undefined);
  const missingSuggested = $derived(suggestedArtifacts(data).length);
  const total = $derived(progress(data));

  function openDiagram(id: string | undefined) {
    const m = metaOf(id);
    if (m) void app.open(m.path);
    else app.notify("That diagram isn't in the list any more (deleted or archived). Link the artefact again.", 'error');
  }

  function addSuggestions() {
    let n = 0;
    app.change((d) => (n = addSuggested(ud(d))));
    app.notify(n ? `Added ${n} suggested artefact${n === 1 ? '' : 's'}.` : 'Every suggested artefact is already in the plan.');
  }

  function linkAll() {
    let n = 0;
    const refs = projectDiagrams.map((m) => ({ id: m.id, kind: m.kind, title: m.title }));
    app.change((d) => {
      const r = autoLink(ud(d).artifacts, refs);
      ud(d).artifacts = r.artifacts;
      n = r.linked;
    });
    app.notify(n ? `Linked ${n} artefact${n === 1 ? '' : 's'} to diagrams of this project.` : `No new links: no unlinked artefact matches a diagram in "${doc.project || 'No project'}".`);
  }

  async function createFor(a: UpArtifact) {
    const kind = kindFor(a.name);
    if (!kind) return;
    const back = app.path;
    const aid = a.id;
    await app.create(kind, a.name, doc.project);
    const newId = app.doc?.id;
    if (back) await app.open(back);
    if (newId && app.doc?.kind === 'up') {
      app.change((d) => updateArtifact(ud(d), aid, { diagramId: newId }));
      app.notify(`Created "${a.name}" in ${doc.project || 'No project'} and linked it. Click its title in the plan to open it.`);
    }
  }

  function newArtifact(phaseId: string) {
    let id = '';
    app.change((d) => (id = addArtifact(ud(d), phaseId)));
    selected = id;
    tab = 'artifacts';
    focusName = true;
  }

  function select(id: string) {
    selected = id;
    tab = 'artifacts';
  }

  let focusName = $state(false);
  function focusOnMount(node: HTMLInputElement) {
    if (!focusName) return;
    queueMicrotask(() => {
      node.focus();
      node.select();
      focusName = false;
    });
  }

  /* ----------------------------------------------------- curve editing */

  let svgEl = $state<SVGSVGElement | null>(null);
  let drag = $state<{ disc: string; row: number; phase: number; pointerId: number } | null>(null);

  function svgY(e: PointerEvent): number {
    const ctm = svgEl?.getScreenCTM();
    if (!svgEl || !ctm) return 0;
    const pt = svgEl.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(ctm.inverse()).y;
  }

  function onHandleDown(e: PointerEvent, disc: string, row: number, phase: number) {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    drag = { disc, row, phase, pointerId: e.pointerId };
  }

  function onHandleMove(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const v = effortFromY(svgY(e), rowBaseline(drag.row));
    const d0 = data.disciplines.find((x) => x.id === drag!.disc);
    if (d0 && effortAt(d0, drag.phase) === v) return;
    const { disc, phase } = drag;
    app.change((d) => setEffort(ud(d), disc, phase, v), `effort:${disc}:${phase}`);
  }

  function onHandleUp(e: PointerEvent) {
    if (drag && e.pointerId === drag.pointerId) drag = null;
  }

  function onHandleKey(e: KeyboardEvent, disc: string, phase: number, value: number) {
    const by = e.key === 'ArrowUp' ? 1 : e.key === 'ArrowDown' ? -1 : 0;
    if (!by) return;
    e.preventDefault();
    app.change((d) => setEffort(ud(d), disc, phase, value + by), `effort:${disc}:${phase}`);
  }

  const kindLabel = (a: UpArtifact) => {
    const k = kindFor(a.name);
    return k ? kindInfo(k)?.es : undefined;
  };
</script>

<div class="stage">
  <div class="toolbar float">
    <button class="small" class:active={editCurves} aria-pressed={editCurves} onclick={() => (editCurves = !editCurves)} title="Drag the dots (or use the arrow keys) to change each discipline's effort per phase">
      <Icon name="Spline" size={15} /> Edit curves
    </button>
    <span class="sep"></span>
    <button class="small" onclick={addSuggestions} disabled={!missingSuggested} title="The textbook artefacts of each phase that aren't in the plan yet">
      <Icon name="ListPlus" size={15} /> Suggested artefacts{missingSuggested ? ` (${missingSuggested})` : ''}
    </button>
    <button class="small" onclick={linkAll} disabled={!projectDiagrams.length} title="Link each unlinked artefact to a diagram of the same project that makes it">
      <Icon name="Link" size={15} /> Link to diagrams
    </button>
    <span class="sep"></span>
    <span class="small muted prog">{total.done} done · {total.draft} in progress · {total.todo} to do</span>
  </div>

  <div class="canvas">
    <div class="plan" data-export-root style:width="{L.width}px">
      <svg bind:this={svgEl} width={L.width} height={L.height} viewBox="0 0 {L.width} {L.height}" role="img" aria-label="Proceso Unificado: fases, iteraciones, disciplinas e hitos">
        <!-- phase headers -->
        <text x={CHART.pad} y={CHART.headH / 2 + 5} class="corner">Disciplinas</text>
        {#each data.phases as p, i (p.id)}
          {@const b = L.phases[i]}
          <rect x={b.x + 1} y="2" width={b.w - 2} height={CHART.headH - 6} rx="5" class="phase-head" />
          <text x={b.x + b.w / 2} y={CHART.headH / 2 + 3} text-anchor="middle" class="phase-name">{p.name}</text>
        {/each}

        <!-- discipline rows -->
        {#each data.disciplines as dsc, r (dsc.id)}
          {@const base = rowBaseline(r)}
          {@const hump = humpPath(L.phases, data.phases.map((_, i) => effortAt(dsc, i)), base)}
          {#if r % 2 === 0}<rect x="0" y={L.rowsTop + r * CHART.rowH} width={L.width} height={CHART.rowH} class="band" />{/if}
          {@const lines = wrapText(dsc.name, 25, 2)}
          {#each lines as line, k (k)}
            <text x={CHART.pad} y={L.rowsTop + r * CHART.rowH + CHART.rowH / 2 + 4 + (k - (lines.length - 1) / 2) * 14} class="disc">{line}</text>
          {/each}
          <path d={hump.area} fill={colorOf(r)} class="hump" />
          <path d={hump.line} stroke={colorOf(r)} class="hump-line" />
          <line x1={L.phases[0]?.x ?? CHART.labelW} y1={base} x2={L.width - CHART.pad} y2={base} class="baseline" />
        {/each}

        <!-- phase separators -->
        {#each L.phases as b, i (b.id)}
          {#if i > 0}<line x1={b.x} y1={CHART.headH - 2} x2={b.x} y2={L.milestoneTop} class="phase-sep" />{/if}
        {/each}

        <!-- iterations -->
        <text x={CHART.pad} y={L.iterTop + CHART.iterH / 2 + 4} class="row-label">Iteraciones</text>
        <line x1={CHART.labelW} y1={L.iterTop} x2={L.width - CHART.pad} y2={L.iterTop} class="iter-line" />
        <line x1={CHART.labelW} y1={L.milestoneTop} x2={L.width - CHART.pad} y2={L.milestoneTop} class="iter-line" />
        {#each L.phases as b (b.id)}
          {#each b.iters as it, k (k)}
            {#if k > 0}<line x1={it.x} y1={L.iterTop} x2={it.x} y2={L.milestoneTop} class="iter-sep" />{/if}
            <text x={it.x + it.w / 2} y={L.iterTop + CHART.iterH / 2 + 4} text-anchor="middle" class="iter">{it.name}</text>
          {/each}
        {/each}

        <!-- milestones -->
        <text x={CHART.pad} y={L.milestoneTop + 18} class="row-label">Hitos</text>
        {#each data.phases as p, i (p.id)}
          {@const b = L.phases[i]}
          {@const mx = b.x + b.w - (i === data.phases.length - 1 ? 10 : 0)}
          {@const my = L.milestoneTop + 14}
          <path d="M {mx} {my - 8} L {mx + 8} {my} L {mx} {my + 8} L {mx - 8} {my} Z" class="diamond" />
          {#each wrapText(p.milestone, Math.max(12, Math.floor((b.w - 24) / 6.4))) as line, k (k)}
            <text x={mx - 14} y={my + 4 + k * 14} text-anchor="end" class="milestone">{line}</text>
          {/each}
        {/each}

        <!-- curve handles (screen only) -->
        {#if editCurves}
          {#each data.disciplines as dsc, r (dsc.id)}
            {#each data.phases as p, i (p.id)}
              {@const v = effortAt(dsc, i)}
              {@const b = L.phases[i]}
              <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
              <circle
                cx={b.x + b.w / 2}
                cy={rowBaseline(r) - (v / MAX_EFFORT) * CHART.humpH}
                r="6"
                class="handle"
                stroke={colorOf(r)}
                tabindex="0"
                role="slider"
                aria-label="{dsc.name}, {p.name}"
                aria-valuemin="0"
                aria-valuemax={MAX_EFFORT}
                aria-valuenow={v}
                onpointerdown={(e) => onHandleDown(e, dsc.id, r, i)}
                onpointermove={onHandleMove}
                onpointerup={onHandleUp}
                onpointercancel={onHandleUp}
                onkeydown={(e) => onHandleKey(e, dsc.id, i, v)}
              />
            {/each}
          {/each}
        {/if}
      </svg>

      <!-- artefacts per phase, aligned with the phase columns -->
      <div class="arts" style:grid-template-columns="{CHART.labelW}px {L.phases.map((b) => `${b.w}px`).join(' ')}">
        <div class="arts-label">Artefactos</div>
        {#each data.phases as p (p.id)}
          {@const list = artifactsOf(data, p.id)}
          <div class="arts-col">
            {#each list as a (a.id)}
              {@const st = statusInfo(a.status)}
              {@const meta = metaOf(a.diagramId)}
              <div class="art" class:on={selected === a.id}>
                <button class="art-main" onclick={() => select(a.id)} title={a.note || a.name}>
                  <span class="chip" style:background={st.color} title={st.label}></span>
                  <span class="art-name" class:done={a.status === 'done'}>{a.name}</span>
                </button>
                {#if meta}
                  <button class="art-link" onclick={() => openDiagram(a.diagramId)} title="Open {meta.title}"><Icon name="CornerDownRight" size={12} /> {meta.title}</button>
                {/if}
              </div>
            {:else}
              <div class="none">—</div>
            {/each}
          </div>
        {/each}
      </div>
      <div class="legend">
        {#each STATUSES as s (s.status)}<span class="row"><span class="chip" style:background={s.color}></span>{s.label}</span>{/each}
      </div>
    </div>
  </div>

  <aside class="inspector float" aria-label="Unified Process plan">
    <div class="inspector-head">
      <div class="seg" role="tablist" aria-label="Edit">
        <button role="tab" class:active={tab === 'artifacts'} aria-selected={tab === 'artifacts'} onclick={() => (tab = 'artifacts')}>Artefacts</button>
        <button role="tab" class:active={tab === 'phases'} aria-selected={tab === 'phases'} onclick={() => (tab = 'phases')}>Phases</button>
        <button role="tab" class:active={tab === 'disciplines'} aria-selected={tab === 'disciplines'} onclick={() => (tab = 'disciplines')}>Disciplines</button>
      </div>
    </div>
    <div class="inspector-body">
      {#if tab === 'artifacts'}
        {#if current}
          {@const a = current}
          {@const meta = metaOf(a.diagramId)}
          {@const k = kindFor(a.name)}
          <button class="inline small back" onclick={() => (selected = null)}><Icon name="ChevronLeft" size={14} /> All artefacts</button>
          <label class="field">
            Name
            <input type="text" value={a.name} use:focusOnMount oninput={(e) => app.change((d) => updateArtifact(ud(d), a.id, { name: e.currentTarget.value }), `name:${a.id}`)} />
          </label>
          <div class="two">
            <label class="field">
              Phase
              <select value={a.phaseId} onchange={(e) => app.change((d) => moveArtifactToPhase(ud(d), a.id, e.currentTarget.value))}>
                {#each data.phases as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
              </select>
            </label>
            <label class="field">
              Discipline
              <select value={a.disciplineId} onchange={(e) => app.change((d) => updateArtifact(ud(d), a.id, { disciplineId: e.currentTarget.value }))}>
                {#each data.disciplines as dsc (dsc.id)}<option value={dsc.id}>{dsc.name}</option>{/each}
              </select>
            </label>
          </div>
          <div class="field">
            <span class="small muted">Status</span>
            <div class="seg" role="radiogroup" aria-label="Status">
              {#each STATUSES as s (s.status)}
                <button role="radio" class:active={a.status === s.status} aria-checked={a.status === s.status} onclick={() => app.change((d) => updateArtifact(ud(d), a.id, { status: s.status }))}>
                  <span class="chip" style:background={s.color}></span>{s.label}
                </button>
              {/each}
            </div>
          </div>
          <label class="field">
            Diagram
            <select value={a.diagramId ?? ''} onchange={(e) => app.change((d) => updateArtifact(ud(d), a.id, { diagramId: e.currentTarget.value || undefined }))}>
              <option value="">— Not linked —</option>
              {#if a.diagramId && !meta}<option value={a.diagramId}>(missing diagram)</option>{/if}
              {#each projectDiagrams as m (m.id)}<option value={m.id}>{m.title} · {kindInfo(m.kind)?.es ?? m.kind}</option>{/each}
            </select>
          </label>
          {#if meta}
            <button class="secondary small" onclick={() => openDiagram(a.diagramId)}><Icon name="ExternalLink" size={14} /> Open "{meta.title}"</button>
          {:else if k}
            <button class="secondary small" onclick={() => createFor(a)}><Icon name="Plus" size={14} /> Create {kindLabel(a)}</button>
            <p class="tiny muted">Makes a new diagram in "{doc.project || 'No project'}" titled "{a.name}", links it here and comes back to the plan.</p>
          {:else}
            <p class="tiny muted">The app doesn't draw this one; keep it as a document and track its status here.</p>
          {/if}
          <label class="field">Note <textarea rows="2" value={a.note} use:autosize={a.note} placeholder="What it covers, who owns it" oninput={(e) => app.change((d) => updateArtifact(ud(d), a.id, { note: e.currentTarget.value }), `note:${a.id}`)}></textarea></label>
          <div class="row">
            <button class="icon small" aria-label="Move up" title="Move up" onclick={() => app.change((d) => moveArtifact(ud(d), a.id, -1))}><Icon name="ArrowUp" size={14} /></button>
            <button class="icon small" aria-label="Move down" title="Move down" onclick={() => app.change((d) => moveArtifact(ud(d), a.id, 1))}><Icon name="ArrowDown" size={14} /></button>
            <span class="spacer"></span>
            <button
              class="danger small"
              onclick={() => {
                app.change((d) => removeArtifact(ud(d), a.id));
                selected = null;
              }}><Icon name="Trash2" size={14} /> Delete</button
            >
          </div>
        {:else}
          {#if !data.artifacts.length}
            <p class="small muted">No artefacts yet. <strong>Suggested artefacts</strong> in the toolbar adds the usual ones for each phase (use cases with specifications, design classes, sequence diagrams…); then link each to its diagram.</p>
          {/if}
          {#each data.phases as p (p.id)}
            {@const pr = progress(data, p.id)}
            <div class="phase-group">
              <div class="row between">
                <span class="sect">{p.name}</span>
                <span class="tiny muted">{pr.done}/{pr.total} done</span>
              </div>
              {#each artifactsOf(data, p.id) as a (a.id)}
                {@const meta = metaOf(a.diagramId)}
                <button class="menu-row item" onclick={() => (selected = a.id)}>
                  <span class="chip" style:background={statusInfo(a.status).color}></span>
                  <span class="iname">{a.name}</span>
                  {#if meta}<Icon name="Link" size={12} />{/if}
                </button>
              {/each}
              <button class="inline small add" onclick={() => newArtifact(p.id)}><Icon name="Plus" size={13} /> Add artefact</button>
            </div>
          {/each}
        {/if}
      {:else if tab === 'phases'}
        {#each data.phases as p, i (p.id)}
          <div class="phase-card stack">
            <label class="field">
              Phase {i + 1}
              <input type="text" value={p.name} oninput={(e) => app.change((d) => setPhase(ud(d), p.id, { name: e.currentTarget.value }), `pname:${p.id}`)} />
            </label>
            <label class="field">Goal <textarea rows="2" value={p.goal} use:autosize={p.goal} oninput={(e) => app.change((d) => setPhase(ud(d), p.id, { goal: e.currentTarget.value }), `pgoal:${p.id}`)}></textarea></label>
            <label class="field">Milestone <input type="text" value={p.milestone} oninput={(e) => app.change((d) => setPhase(ud(d), p.id, { milestone: e.currentTarget.value }), `pmile:${p.id}`)} /></label>
            <div class="field">
              <span class="small muted">Iterations</span>
              <div class="iters">
                {#each iterationsOf(p) as it, k (k)}
                  <span class="it">
                    <input type="text" value={it} aria-label="Iteration {k + 1} of {p.name}" oninput={(e) => app.change((d) => renameIteration(ud(d), p.id, k, e.currentTarget.value), `it:${p.id}:${k}`)} />
                    {#if iterationsOf(p).length > 1}
                      <button class="icon small" aria-label="Remove iteration {it}" onclick={() => app.change((d) => removeIteration(ud(d), p.id, k))}><Icon name="X" size={12} /></button>
                    {/if}
                  </span>
                {/each}
                <button class="icon small" aria-label="Add iteration to {p.name}" title="Add iteration" onclick={() => app.change((d) => addIteration(ud(d), p.id))}><Icon name="Plus" size={14} /></button>
              </div>
            </div>
          </div>
        {/each}
      {:else}
        <p class="tiny muted">Effort from 0 (none) to {MAX_EFFORT} (peak) in each phase; it draws the humps. You can also drag them with <strong>Edit curves</strong>.</p>
        <div class="dlist">
          {#each data.disciplines as dsc, r (dsc.id)}
            <div class="dblock">
              <div class="dname">
                <span class="chip" style:background={colorOf(r)}></span>
                <input type="text" value={dsc.name} aria-label="Discipline name" oninput={(e) => app.change((d) => renameDiscipline(ud(d), dsc.id, e.currentTarget.value), `dname:${dsc.id}`)} />
                <button class="icon small" aria-label="Move {dsc.name} up" title="Move up" onclick={() => app.change((d) => moveDiscipline(ud(d), dsc.id, -1))}><Icon name="ArrowUp" size={13} /></button>
                <button class="icon small" aria-label="Move {dsc.name} down" title="Move down" onclick={() => app.change((d) => moveDiscipline(ud(d), dsc.id, 1))}><Icon name="ArrowDown" size={13} /></button>
                <button class="icon small" aria-label="Delete {dsc.name}" title="Delete" disabled={data.disciplines.length <= 1} onclick={() => app.change((d) => removeDiscipline(ud(d), dsc.id))}><Icon name="Trash2" size={13} /></button>
              </div>
              <div class="effs" style:grid-template-columns="repeat({data.phases.length}, 1fr)">
                {#each data.phases as p, i (p.id)}
                  <label class="eff-l">
                    <span class="tiny muted" title={p.name}>{p.name}</span>
                    <input class="eff" type="number" min="0" max={MAX_EFFORT} step="1" value={effortAt(dsc, i)} aria-label="{dsc.name}, {p.name}" oninput={(e) => app.change((d) => setEffort(ud(d), dsc.id, i, +e.currentTarget.value), `effort:${dsc.id}:${i}`)} />
                  </label>
                {/each}
              </div>
            </div>
          {/each}
        </div>
        <button class="secondary small" onclick={() => app.change((d) => addDiscipline(ud(d)))}><Icon name="Plus" size={14} /> Add discipline</button>
      {/if}
    </div>
  </aside>
</div>

<style>
  .stage {
    position: absolute;
    inset: 0;
    background: var(--paper);
  }
  .prog {
    padding: 0 6px;
    white-space: nowrap;
  }
  .canvas {
    position: absolute;
    inset: 0 calc(var(--panel-w) + 2 * var(--edge)) 0 0;
    overflow: auto;
    padding: 64px var(--sp-4) var(--sp-5);
  }
  .plan {
    margin: 0 auto;
    padding: var(--sp-3) var(--sp-3) var(--sp-3) 0;
    background: var(--paper);
    font-family: var(--font);
  }
  .plan svg {
    display: block;
    font-family: var(--font);
    user-select: none;
    overflow: visible;
  }
  .corner,
  .row-label {
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    fill: var(--muted);
  }
  .phase-head {
    fill: var(--ink-2);
  }
  .phase-name {
    font-size: 14px;
    font-weight: 700;
    fill: var(--paper);
  }
  .band {
    fill: color-mix(in srgb, var(--ink) 4%, transparent);
  }
  .disc {
    font-size: 13px;
    fill: var(--ink);
  }
  .hump {
    fill-opacity: 0.38;
  }
  .hump-line {
    fill: none;
    stroke-width: 1.6;
  }
  .baseline {
    stroke: var(--line);
    stroke-width: 1;
  }
  .phase-sep {
    stroke: var(--ink-2);
    stroke-width: 1;
    stroke-dasharray: 4 4;
    opacity: 0.55;
  }
  .iter-line {
    stroke: var(--ink-2);
    stroke-width: 1.2;
  }
  .iter-sep {
    stroke: var(--line);
    stroke-width: 1;
  }
  .iter {
    font-size: 12px;
    font-weight: 700;
    fill: var(--ink-2);
  }
  .diamond {
    fill: var(--ink);
  }
  .milestone {
    font-size: 11.5px;
    font-style: italic;
    fill: var(--ink-2);
  }
  .handle {
    fill: var(--panel);
    stroke-width: 2.5;
    cursor: ns-resize;
    outline: none;
  }
  .handle:focus-visible {
    stroke: var(--accent);
    stroke-width: 3.5;
  }
  :global(.exporting) .handle {
    display: none;
  }
  .arts {
    display: grid;
    margin-top: var(--sp-2);
    border-top: 1px solid var(--ink-2);
    padding-top: var(--sp-2);
  }
  .arts-label {
    padding: 4px 0 0 12px;
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .arts-col {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 0 6px;
    min-width: 0;
    border-left: 1px dashed color-mix(in srgb, var(--ink-2) 40%, transparent);
  }
  .arts-col:nth-child(2) {
    border-left: 0;
  }
  .art {
    display: flex;
    flex-direction: column;
    border-radius: var(--r-control);
    background: var(--panel);
    border: 1px solid var(--line);
    overflow: hidden;
  }
  .art.on {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
  }
  :global(.exporting) .art.on {
    border-color: var(--line);
    box-shadow: none;
  }
  .art-main {
    height: auto;
    min-height: 28px;
    justify-content: flex-start;
    align-items: flex-start;
    gap: 6px;
    padding: 5px 7px;
    background: none;
    border-radius: 0;
    white-space: normal;
    text-align: left;
    font-size: 12.5px;
    line-height: 1.3;
    color: var(--ink);
  }
  .art-main .chip {
    margin-top: 4px;
  }
  .art-name.done {
    color: var(--ink-2);
  }
  .art-link {
    height: auto;
    justify-content: flex-start;
    gap: 4px;
    padding: 0 7px 5px 20px;
    background: none;
    border-radius: 0;
    font-size: 11.5px;
    color: var(--muted);
    white-space: normal;
    text-align: left;
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .art-link:hover {
    color: var(--ink);
  }
  .none {
    color: var(--faint);
    padding: 4px 8px;
  }
  .legend {
    display: flex;
    gap: var(--sp-4);
    justify-content: flex-end;
    margin-top: var(--sp-3);
    font-size: 11.5px;
    color: var(--muted);
  }
  .legend .row {
    gap: 5px;
  }
  .chip {
    flex: none;
    display: inline-block;
    width: 9px;
    height: 9px;
    border-radius: 50%;
  }
  .seg .chip {
    margin-right: 5px;
  }
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-2);
  }
  .two select {
    min-width: 0;
    width: 100%;
  }
  .back {
    align-self: flex-start;
  }
  .phase-group {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .item {
    min-height: 30px;
    gap: 8px;
  }
  .iname {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }
  .add {
    align-self: flex-start;
    margin-top: 2px;
  }
  .phase-card {
    padding-bottom: var(--sp-3);
    border-bottom: 1px solid var(--line);
  }
  .phase-card:last-child {
    border-bottom: 0;
  }
  .iters {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }
  .it {
    display: inline-flex;
    align-items: center;
    gap: 1px;
  }
  .it input {
    width: 56px;
    padding: 3px 6px;
  }
  .dlist {
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .dblock {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .dname {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
  }
  .dname .chip {
    margin-right: 2px;
  }
  .dname input {
    flex: 1;
    min-width: 0;
    padding: 3px 6px;
  }
  .effs {
    display: grid;
    gap: 4px;
    padding-left: 15px;
  }
  .eff-l {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .eff-l span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .eff {
    padding: 3px 6px !important;
  }
</style>
