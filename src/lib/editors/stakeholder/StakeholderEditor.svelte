<script lang="ts">
  import { app } from '../../stores/app.svelte';
  import { uid } from '../../model/diagram';
  import type { Stakeholder, StakeholderData } from '../../model/types';
  import Icon from '../../components/Icon.svelte';
  import { focusEnd, autosize } from '../board/actions';
  import {
    ATTITUDES,
    GRID,
    ONION,
    QUADRANTS,
    RINGS,
    RING_LABEL_ANGLE,
    SECTORS,
    sectorLabels,
    attitudeColor,
    coreLines,
    gridLabels,
    gridValueAt,
    freeGridSpot,
    normStakeholder,
    onionCellAt,
    onionLayout,
    quadrantOf,
    quadrantTitles,
    ringBand,
    ringMid
  } from './model';

  /**
   * Stakeholder map: one list, two drawings. The power/interest grid sets
   * power and interest by dragging; the onion sets ring and sector. The
   * panel on the right edits everything.
   */

  const data = $derived((app.doc?.data ?? { stakeholders: [], view: 'grid', product: '' }) as StakeholderData);
  const people = $derived(data.stakeholders.map((s) => normStakeholder(s)));

  let selected = $state<string | null>(null);
  /** Under the pointer, on the map or in the list: lit in both. */
  let hoverId = $state<string | null>(null);
  let focusName = $state(false);
  const current = $derived(people.find((p) => p.id === selected) ?? null);

  function sd(d: { data: unknown }): StakeholderData {
    return d.data as StakeholderData;
  }

  function update(id: string, patch: Partial<Stakeholder>, key?: string) {
    app.change((d) => {
      const i = sd(d).stakeholders.findIndex((s) => s.id === id);
      if (i < 0) return;
      // Normalise on write so a file missing fields (e.g. `sector`) heals itself.
      sd(d).stakeholders[i] = { ...normStakeholder(sd(d).stakeholders[i]), ...patch };
    }, key);
  }

  function add() {
    const id = uid();
    const spot = freeGridSpot(people);
    app.change((d) => {
      sd(d).stakeholders.push({ id, name: 'Nuevo stakeholder', role: '', power: spot.power, interest: spot.interest, ring: 2, sector: 'clientes', attitude: 'neutral', notes: '' });
    });
    selected = id;
    focusName = true;
  }

  function remove(id: string) {
    app.change((d) => {
      sd(d).stakeholders = sd(d).stakeholders.filter((s) => s.id !== id);
    });
    if (selected === id) selected = null;
  }

  function setView(view: StakeholderData['view']) {
    app.change((d) => (sd(d).view = view));
  }

  /* ------------------------------------------------------------ dragging */

  let svgEl = $state<SVGSVGElement | null>(null);
  let drag = $state<{ id: string; pointerId: number; x: number; y: number; moved: boolean } | null>(null);

  function svgPoint(e: PointerEvent): { x: number; y: number } {
    const m = svgEl?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  function onDotDown(e: PointerEvent, id: string) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    pick(id);
    const p = svgPoint(e);
    drag = { id, pointerId: e.pointerId, x: p.x, y: p.y, moved: false };
    // Follow the pointer on the window, not with pointer capture: the dots
    // re-render while they move, and a moved element loses its capture.
    window.addEventListener('pointermove', onDotMove);
    window.addEventListener('pointerup', onDotUp);
    window.addEventListener('pointercancel', onDotCancel);
  }

  function stopListening() {
    window.removeEventListener('pointermove', onDotMove);
    window.removeEventListener('pointerup', onDotUp);
    window.removeEventListener('pointercancel', onDotCancel);
  }

  function onDotCancel() {
    drag = null;
    stopListening();
  }

  function onDotMove(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const p = svgPoint(e);
    drag.x = p.x;
    drag.y = p.y;
    drag.moved = true;
    if (data.view === 'grid') update(drag.id, gridValueAt(p.x, p.y), `drag:${drag.id}`);
  }

  function onDotUp(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (data.view === 'onion' && drag.moved) update(drag.id, onionCellAt(drag.x, drag.y));
    drag = null;
    stopListening();
  }

  function onDotKey(e: KeyboardEvent, s: Stakeholder) {
    const step = e.shiftKey ? 0.1 : 0.05;
    const c = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 100) / 100;
    if (data.view !== 'grid') return;
    if (e.key === 'ArrowUp') update(s.id, { power: c(s.power + step) }, `key:${s.id}`);
    else if (e.key === 'ArrowDown') update(s.id, { power: c(s.power - step) }, `key:${s.id}`);
    else if (e.key === 'ArrowRight') update(s.id, { interest: c(s.interest + step) }, `key:${s.id}`);
    else if (e.key === 'ArrowLeft') update(s.id, { interest: c(s.interest - step) }, `key:${s.id}`);
    else return;
    e.preventDefault();
  }

  /* ------------------------------------------------------------ drawing */

  const labels = $derived(gridLabels(people));
  const spots = $derived(onionLayout(people));
  const xm = (GRID.x0 + GRID.x1) / 2;
  const ym = (GRID.y0 + GRID.y1) / 2;

  /** Arc path for a ring label, centred on the label diagonal. */
  function ringArc(r: number): string {
    const a0 = ((RING_LABEL_ANGLE - 60) * Math.PI) / 180;
    const a1 = ((RING_LABEL_ANGLE + 60) * Math.PI) / 180;
    const p = (a: number) => `${(ONION.cx + r * Math.cos(a)).toFixed(1)} ${(ONION.cy + r * Math.sin(a)).toFixed(1)}`;
    return `M ${p(a0)} A ${r} ${r} 0 0 1 ${p(a1)}`;
  }
  const ringFill = [50, 36, 24, 14];
  const diag = [-135, -45, 45, 135].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return { x0: ONION.cx + ONION.core * Math.cos(a), y0: ONION.cy + ONION.core * Math.sin(a), x1: ONION.cx + ONION.radii[3] * Math.cos(a), y1: ONION.cy + ONION.radii[3] * Math.sin(a) };
  });
  const pct = (n: number) => `${Math.round(n * 100)} %`;
  const tip = (s: Stakeholder) => `${s.name}${s.role ? ` · ${s.role}` : ''}\n${data.view === 'grid' ? `Poder ${pct(s.power)} · interés ${pct(s.interest)} · ${quadrantOf(s).title}` : `${RINGS[s.ring].label} · ${SECTORS.find((x) => x.sector === s.sector)?.label ?? s.sector}`}`;

  /** Pick a stakeholder from the map; its row scrolls into view in the list. */
  function pick(id: string) {
    selected = id;
    document.getElementById(`sh-row-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /** A press on the map's background (not on a dot or a name) lets go of the selection. */
  function onChartDown(e: PointerEvent) {
    if (!(e.target as Element).closest('.who, .name')) selected = null;
  }

  function onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    if (e.key === 'Escape' && selected) selected = null;
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="stage">
  <div class="toolbar float">
    <div class="seg" role="radiogroup" aria-label="Format">
      <button class:active={data.view === 'grid'} role="radio" aria-checked={data.view === 'grid'} onclick={() => setView('grid')}><Icon name="LayoutGrid" size={14} /> Poder / interés</button>
      <button class:active={data.view === 'onion'} role="radio" aria-checked={data.view === 'onion'} onclick={() => setView('onion')}><Icon name="Target" size={14} /> Cebolla</button>
    </div>
    {#if data.view === 'onion'}
      <span class="sep"></span>
      <label class="row small muted centre">
        Centre
        <input type="text" value={data.product} placeholder="Producto / proyecto" oninput={(e) => app.change((d) => (sd(d).product = e.currentTarget.value), 'product')} />
      </label>
    {/if}
  </div>

  <div class="canvas">
    {#if data.view === 'grid'}
      <div class="chart" data-export-root>
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <svg bind:this={svgEl} viewBox="0 0 {GRID.width} {GRID.height}" role="img" aria-label="Matriz poder/influencia – interés" onpointerdown={onChartDown}>
          {#each [{ q: QUADRANTS.satisfied, x: GRID.x0, y: GRID.y0 }, { q: QUADRANTS.manage, x: xm, y: GRID.y0 }, { q: QUADRANTS.monitor, x: GRID.x0, y: ym }, { q: QUADRANTS.informed, x: xm, y: ym }] as c (c.q.id)}
            <rect x={c.x} y={c.y} width={xm - GRID.x0} height={ym - GRID.y0} style:fill="color-mix(in srgb, {c.q.tint} 15%, var(--panel))" />
          {/each}
          {#each quadrantTitles() as c (c.q.id)}
            <text x={c.x} y={c.y} class="q-title" text-anchor="middle">{c.q.title}</text>
            <text x={c.x} y={c.y + 17} class="q-who" text-anchor="middle">{c.q.who}</text>
          {/each}
          <line x1={xm} y1={GRID.y0} x2={xm} y2={GRID.y1} class="mid" />
          <line x1={GRID.x0} y1={ym} x2={GRID.x1} y2={ym} class="mid" />
          <!-- axes -->
          <line x1={GRID.x0} y1={GRID.y1} x2={GRID.x0} y2={GRID.y0 - 6} class="axis" />
          <path d="M {GRID.x0 - 5} {GRID.y0 + 2} L {GRID.x0} {GRID.y0 - 8} L {GRID.x0 + 5} {GRID.y0 + 2} Z" class="arrow" />
          <line x1={GRID.x0} y1={GRID.y1} x2={GRID.x1 + 6} y2={GRID.y1} class="axis" />
          <path d="M {GRID.x1 - 2} {GRID.y1 - 5} L {GRID.x1 + 8} {GRID.y1} L {GRID.x1 - 2} {GRID.y1 + 5} Z" class="arrow" />
          <text class="axis-label" transform="translate({GRID.x0 - 34} {ym}) rotate(-90)" text-anchor="middle">Poder/Influencia</text>
          <text class="axis-label" x={xm} y={GRID.y1 + 34} text-anchor="middle">Interés</text>
          <text class="tick" x={GRID.x0 - 8} y={GRID.y1 - 4} text-anchor="end">Bajo</text>
          <text class="tick" x={GRID.x0 - 8} y={GRID.y0 + 12} text-anchor="end">Alto</text>
          <text class="tick" x={GRID.x0 + 4} y={GRID.y1 + 16}>Bajo</text>
          <text class="tick" x={GRID.x1} y={GRID.y1 + 16} text-anchor="end">Alto</text>
          <!-- the selected stakeholder's power and interest, read off the axes (screen only) -->
          {#if current}
            {@const g = labels.find((x) => x.id === current.id)}
            {#if g}
              <g class="guides" data-no-export>
                <line x1={GRID.x0} y1={g.y} x2={g.x} y2={g.y} />
                <line x1={g.x} y1={g.y} x2={g.x} y2={GRID.y1} />
                <text x={GRID.x0 + 5} y={g.y - 5}>{pct(current.power)}</text>
                <text x={g.x + 5} y={GRID.y1 - 6}>{pct(current.interest)}</text>
              </g>
            {/if}
          {/if}
          <!-- stakeholders: names and dots both pick; dots drag -->
          {#each labels as l (l.id)}
            {@const s = people.find((p) => p.id === l.id)!}
            {#if Math.abs(l.ly - (l.y + 4)) > 1}
              <line x1={l.x} y1={l.y} x2={l.anchor === 'start' ? l.lx - 2 : l.lx + 2} y2={l.ly - 4} class="leader" />
            {/if}
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <text
              x={l.lx}
              y={l.ly}
              text-anchor={l.anchor}
              class="name"
              class:on={selected === s.id}
              class:hot={hoverId === s.id}
              onpointerdown={() => pick(s.id)}
              onpointerenter={() => (hoverId = s.id)}
              onpointerleave={() => hoverId === s.id && (hoverId = null)}>{s.name}<title>{tip(s)}</title></text
            >
          {/each}
          {#each people as s (s.id)}
            {@const l = labels.find((x) => x.id === s.id)!}
            <g class="who" class:on={selected === s.id} class:hot={hoverId === s.id || drag?.id === s.id}>
              <circle class="halo-ring" cx={l.x} cy={l.y} r="15" />
              <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
              <circle
                cx={l.x}
                cy={l.y}
                r="8"
                class="dot"
                class:on={selected === s.id}
                fill={attitudeColor(s.attitude)}
                tabindex="0"
                role="button"
                aria-label="{s.name}: poder {pct(s.power)}, interés {pct(s.interest)}"
                onpointerdown={(e) => onDotDown(e, s.id)}
                onpointerenter={() => (hoverId = s.id)}
                onpointerleave={() => hoverId === s.id && (hoverId = null)}
                onkeydown={(e) => onDotKey(e, s)}
                onfocus={() => (selected = s.id)}><title>{tip(s)}</title></circle
              >
            </g>
          {/each}
          {@render legend(GRID.x0, GRID.height - 12)}
        </svg>
      </div>
    {:else}
      <div class="chart onion" data-export-root>
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <svg bind:this={svgEl} viewBox="0 0 {ONION.width} {ONION.height}" role="img" aria-label="Mapa de stakeholders en cebolla" onpointerdown={onChartDown}>
          {#each [3, 2, 1, 0] as r (r)}
            <circle cx={ONION.cx} cy={ONION.cy} r={ONION.radii[r]} style:fill="color-mix(in srgb, #4a7fc1 {ringFill[r]}%, var(--panel))" class="ring" />
          {/each}
          {#each diag as d, i (i)}
            <line x1={d.x0} y1={d.y0} x2={d.x1} y2={d.y1} class="diag" />
          {/each}
          {#each RINGS as rg (rg.ring)}
            <path id="ring-arc-{rg.ring}" d={ringArc(ringMid(rg.ring) - 4)} fill="none" />
            <text class="ring-label" class:inner={rg.ring < 2}><textPath href="#ring-arc-{rg.ring}" startOffset="50%" text-anchor="middle">{rg.label}</textPath></text>
          {/each}
          <circle cx={ONION.cx} cy={ONION.cy} r={ONION.core} class="core" />
          {#each coreLines(data.product) as line, i (i)}
            {@const lines = coreLines(data.product)}
            <text x={ONION.cx} y={ONION.cy + 4 + (i - (lines.length - 1) / 2) * 13} text-anchor="middle" class="core-label">{line}</text>
          {/each}
          {#each sectorLabels() as sc (sc.sector)}
            <text class="sector" x={sc.x} y={sc.y} text-anchor={sc.anchor}>{sc.label}</text>
          {/each}
          {#each spots as sp (sp.id)}
            {@const s = people.find((p) => p.id === sp.id)!}
            {@const live = drag && drag.id === s.id && drag.moved}
            {#if !live}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <text
                x={sp.lx}
                y={sp.ly}
                text-anchor={sp.anchor}
                class="name halo"
                class:on={selected === s.id}
                class:hot={hoverId === s.id}
                onpointerdown={() => pick(s.id)}
                onpointerenter={() => (hoverId = s.id)}
                onpointerleave={() => hoverId === s.id && (hoverId = null)}>{s.name}<title>{tip(s)}</title></text
              >
            {/if}
            <g class="who" class:on={selected === s.id} class:hot={hoverId === s.id || !!live}>
              <circle class="halo-ring" cx={live ? drag!.x : sp.x} cy={live ? drag!.y : sp.y} r="15" />
              <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
              <circle
                cx={live ? drag!.x : sp.x}
                cy={live ? drag!.y : sp.y}
                r="8"
                class="dot"
                class:on={selected === s.id}
                fill={attitudeColor(s.attitude)}
                tabindex="0"
                role="button"
                aria-label="{s.name}: {RINGS[s.ring].label}, {s.sector}"
                onpointerdown={(e) => onDotDown(e, s.id)}
                onpointerenter={() => (hoverId = s.id)}
                onpointerleave={() => hoverId === s.id && (hoverId = null)}
                onfocus={() => (selected = s.id)}><title>{tip(s)}</title></circle
              >
            </g>
          {/each}
          {@render legend(20, ONION.height - 14)}
        </svg>
      </div>
    {/if}
    {#if !people.length}
      <div class="empty-hint"><div>No stakeholders yet — add them in the panel on the right, then drag them on the map.</div></div>
    {/if}
  </div>

  <aside class="inspector float" aria-label="Stakeholders">
    <div class="inspector-head">
      <strong>Stakeholders</strong>
      <span class="muted small">{people.length}</span>
      <span class="spacer"></span>
      <button class="secondary small" onclick={add}><Icon name="Plus" size={14} /> Add</button>
    </div>
    <div class="inspector-body">
      <div class="people" role="listbox" aria-label="Stakeholders">
        {#each people as p (p.id)}
          {@const q = quadrantOf(p)}
          <button
            id="sh-row-{p.id}"
            class="menu-row person"
            class:on={p.id === selected}
            class:hot={p.id === hoverId}
            role="option"
            aria-selected={p.id === selected}
            onclick={() => (selected = p.id)}
            onpointerenter={() => (hoverId = p.id)}
            onpointerleave={() => hoverId === p.id && (hoverId = null)}
          >
            <span class="pip" style:background={attitudeColor(p.attitude)} title={ATTITUDES.find((a) => a.attitude === p.attitude)?.label}></span>
            <span class="pname">{p.name || '(sin nombre)'}</span>
            {#if data.view === 'grid'}
              <span class="quad" style:--q={q.tint} title="Strategy for this quadrant">{q.title}</span>
            {:else}
              <span class="quad ring" style:--q="#4a7fc1" style:--qa="{ringFill[p.ring]}%" title="Onion ring">{RINGS[p.ring].label}</span>
            {/if}
          </button>
        {/each}
      </div>

      {#if current}
        {@const s = current}
        <div class="form stack">
          <div class="sect">Edit</div>
          <label class="field">
            Name
            {#if focusName}
              <input type="text" value={s.name} use:focusEnd onblur={() => (focusName = false)} oninput={(e) => update(s.id, { name: e.currentTarget.value }, `name:${s.id}`)} />
            {:else}
              <input type="text" value={s.name} oninput={(e) => update(s.id, { name: e.currentTarget.value }, `name:${s.id}`)} />
            {/if}
          </label>
          <label class="field">Role <input type="text" value={s.role} placeholder="Qué es para el proyecto" oninput={(e) => update(s.id, { role: e.currentTarget.value }, `role:${s.id}`)} /></label>
          <label class="field">
            <span class="row between"><span>Poder / influencia</span><span>{pct(s.power)}</span></span>
            <input type="range" min="0" max="1" step="0.05" value={s.power} oninput={(e) => update(s.id, { power: +e.currentTarget.value }, `power:${s.id}`)} />
          </label>
          <label class="field">
            <span class="row between"><span>Interés</span><span>{pct(s.interest)}</span></span>
            <input type="range" min="0" max="1" step="0.05" value={s.interest} oninput={(e) => update(s.id, { interest: +e.currentTarget.value }, `interest:${s.id}`)} />
          </label>
          <p class="tiny muted">Strategy: <span class="quad" style:--q={quadrantOf(s).tint}>{quadrantOf(s).title}</span> <span class="muted">· {quadrantOf(s).who}</span></p>
          <label class="field">
            Onion ring
            <select value={s.ring} onchange={(e) => update(s.id, { ring: +e.currentTarget.value as Stakeholder['ring'] })}>
              {#each RINGS as r (r.ring)}<option value={r.ring}>{r.label}</option>{/each}
            </select>
          </label>
          <label class="field">
            Sector
            <select value={s.sector} onchange={(e) => update(s.id, { sector: e.currentTarget.value as Stakeholder['sector'] })}>
              {#each SECTORS as sc (sc.sector)}<option value={sc.sector}>{sc.label}</option>{/each}
            </select>
          </label>
          <div class="field">
            <span class="small muted">Attitude</span>
            <div class="seg" role="radiogroup" aria-label="Attitude">
              {#each ATTITUDES as a (a.attitude)}
                <button class="tone" class:active={s.attitude === a.attitude} style:--tc={a.color} role="radio" aria-checked={s.attitude === a.attitude} onclick={() => update(s.id, { attitude: a.attitude })}>
                  <span class="pip" style:background={a.color}></span>{a.label}
                </button>
              {/each}
            </div>
          </div>
          <label class="field">Notes <textarea rows="3" value={s.notes} use:autosize={s.notes} oninput={(e) => update(s.id, { notes: e.currentTarget.value }, `notes:${s.id}`)}></textarea></label>
          <button class="danger small del" onclick={() => remove(s.id)}><Icon name="Trash2" size={14} /> Delete stakeholder</button>
        </div>
      {:else if people.length}
        <p class="small muted">Select a stakeholder to edit it. On the {data.view === 'grid' ? 'grid, drag a dot to set power and interest (arrow keys work too)' : 'onion, drag a dot to another ring or sector'}.</p>
      {/if}
    </div>
  </aside>
</div>

{#snippet legend(x: number, y: number)}
  <g class="legend" transform="translate({x} {y})">
    {#each ATTITUDES as a, i (a.attitude)}
      <circle cx={i * 92 + 6} cy="-4" r="5.5" fill={a.color} class="legend-dot" />
      <text x={i * 92 + 16} y="0">{a.label}</text>
    {/each}
  </g>
{/snippet}

<style>
  .stage {
    position: absolute;
    inset: 0;
    background: var(--paper);
  }
  .toolbar {
    max-width: calc(100% - var(--panel-w) - 3 * var(--edge));
  }
  .centre input {
    width: 200px;
    height: 26px;
    padding: 2px 8px;
  }
  .canvas {
    position: absolute;
    inset: 0 calc(var(--panel-w) + 2 * var(--edge)) 0 0;
    overflow: auto;
    padding: 64px var(--sp-4) var(--sp-4);
  }
  .chart {
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
    padding: var(--sp-3);
    background: var(--paper);
  }
  .chart svg {
    display: block;
    width: 100%;
    height: auto;
    font-family: var(--font);
    user-select: none;
  }
  .q-title {
    font-size: 16px;
    font-weight: 700;
    fill: var(--ink-2);
  }
  .q-who {
    font-size: 10.5px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    fill: var(--muted);
  }
  .mid {
    stroke: var(--line);
    stroke-width: 1.5;
  }
  .axis {
    stroke: var(--ink-2);
    stroke-width: 1.5;
  }
  .arrow {
    fill: var(--ink-2);
  }
  .axis-label {
    font-size: 13px;
    font-weight: 700;
    fill: var(--ink-2);
  }
  .tick {
    font-size: 10.5px;
    fill: var(--muted);
  }
  .name {
    font-size: 13px;
    fill: var(--ink);
  }
  .halo {
    paint-order: stroke;
    stroke: color-mix(in srgb, var(--panel) 85%, transparent);
    stroke-width: 3px;
    stroke-linejoin: round;
  }
  .leader {
    stroke: var(--faint);
    stroke-width: 1;
  }
  .dot {
    stroke: var(--panel);
    stroke-width: 2;
    cursor: grab;
    outline: none;
    transition: stroke var(--t);
  }
  .halo-ring {
    fill: transparent;
    pointer-events: none;
    transition: fill var(--t);
  }
  /* Hover (on the map or its row) and selection: an accent halo round the dot, the name in bold. */
  :global(html:not(.exporting)) .who:is(.hot, :hover) .halo-ring {
    fill: color-mix(in srgb, var(--accent) 16%, transparent);
  }
  :global(html:not(.exporting)) .who.on .halo-ring {
    fill: color-mix(in srgb, var(--accent) 24%, transparent);
  }
  .name {
    cursor: pointer;
  }
  :global(html:not(.exporting)) .name:is(.hot, :hover) {
    font-weight: 700;
  }
  :global(html:not(.exporting)) .name.on {
    font-weight: 700;
    fill: var(--accent);
  }
  .guides line {
    stroke: var(--accent);
    stroke-width: 1;
    stroke-dasharray: 4 4;
    opacity: 0.7;
  }
  .guides text {
    font-size: 11px;
    font-weight: 700;
    fill: var(--accent);
  }
  :global(html.exporting) .guides {
    display: none;
  }
  .dot:active {
    cursor: grabbing;
  }
  .dot.on,
  .dot:focus-visible {
    stroke: var(--accent);
    stroke-width: 3;
  }
  /* The selection ring is for the screen, not for the exported image. */
  :global(.exporting) .dot.on,
  :global(.exporting) .dot:focus-visible {
    stroke: var(--panel);
    stroke-width: 2;
  }
  .ring {
    stroke: var(--panel);
    stroke-width: 2;
  }
  .diag {
    stroke: var(--panel);
    stroke-width: 1.5;
    stroke-dasharray: 3 5;
  }
  .ring-label {
    font-size: 12.5px;
    font-style: italic;
    fill: var(--ink-2);
  }
  .ring-label.inner {
    fill: var(--ink);
  }
  .core {
    fill: #4a7fc1;
  }
  .core-label {
    font-size: 12.5px;
    font-weight: 700;
    fill: #ffffff;
  }
  .sector {
    font-size: 17px;
    font-weight: 700;
    fill: #3f8a44;
  }
  .onion .name {
    font-size: 15px;
  }
  .onion .legend text {
    font-size: 14px;
  }
  .legend text {
    font-size: 12px;
    fill: var(--muted);
  }
  .legend-dot {
    stroke: var(--panel);
    stroke-width: 1.5;
  }
  .people {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .person {
    min-height: 32px;
  }
  .person.hot {
    background: var(--hover);
  }
  .person.on {
    background: var(--selected);
    box-shadow: inset 3px 0 0 var(--accent);
    color: var(--ink);
  }
  .person.on .pname {
    font-weight: 700;
  }
  /* The quadrant's (or ring's) own tint, as on the map. */
  .quad {
    flex: none;
    padding: 1px 7px;
    border-radius: var(--r-pill);
    font-size: var(--fs-xs);
    white-space: nowrap;
    background: color-mix(in srgb, var(--q) 20%, transparent);
    color: color-mix(in srgb, var(--q) 55%, var(--ink));
  }
  .quad.ring {
    background: color-mix(in srgb, var(--q) var(--qa), transparent);
  }
  .pname {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .pip {
    flex: none;
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  .form {
    padding-top: var(--sp-2);
    border-top: 1px solid var(--line);
  }
  .field .seg {
    align-self: flex-start;
  }
  /* The chosen attitude wears its own colour, as its dot on the map. */
  .seg button.tone.active,
  .seg button.tone.active:hover {
    background: color-mix(in srgb, var(--tc) 24%, var(--panel));
    color: var(--ink);
    box-shadow: inset 0 0 0 1.5px var(--tc);
  }
  .del {
    align-self: flex-start;
  }
</style>
