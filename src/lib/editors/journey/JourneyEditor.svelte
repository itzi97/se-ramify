<script lang="ts">
  import { app } from '../../stores/app.svelte';
  import { uid } from '../../model/diagram';
  import type { JourneyData } from '../../model/types';
  import Icon from '../../components/Icon.svelte';
  import { autosize, focusEnd } from '../board/actions';
  import { EMOTIONS, clampEmotion, emotionInfo, smoothPath } from './model';

  /**
   * Customer journey: stages across, rows of notes below, and the emotion
   * curve (drag a point up or down, or click in a stage's column) with the
   * moments of truth starred.
   */

  const data = $derived((app.doc?.data ?? { persona: '', scenario: '', stages: [], rows: [], cells: {}, emotion: {}, moments: [] }) as JourneyData);
  const n = $derived(data.stages.length);

  const HEAD_W = 170;
  const EMO_H = 190;
  const PAD = 22;
  const STEP = (EMO_H - 2 * PAD) / 4;

  let fresh = $state<string | null>(null);
  let emoW = $state(0);
  /** The stage column under the pointer (header, cell or curve): lit from top to bottom. */
  let hoverStage = $state<string | null>(null);
  /** Where a click on the curve would put the point, shown while the pointer is over it. */
  let preview = $state<{ i: number; v: number } | null>(null);

  function jd(d: { data: unknown }): JourneyData {
    return d.data as JourneyData;
  }

  /* ------------------------------------------------------------- stages */

  function addStage() {
    const id = uid();
    app.change((d) => jd(d).stages.push({ id, name: 'Nueva etapa' }));
    fresh = id;
  }
  function moveStage(i: number, by: number) {
    const j = i + by;
    if (j < 0 || j >= n) return;
    app.change((d) => {
      const s = jd(d).stages;
      [s[i], s[j]] = [s[j], s[i]];
    });
  }
  function removeStage(id: string) {
    app.change((d) => {
      const j = jd(d);
      j.stages = j.stages.filter((s) => s.id !== id);
      for (const k of Object.keys(j.cells)) if (k.endsWith(`:${id}`)) delete j.cells[k];
      delete j.emotion[id];
      j.moments = j.moments.filter((m) => m !== id);
    });
  }
  function toggleMoment(id: string) {
    app.change((d) => {
      const j = jd(d);
      j.moments = j.moments.includes(id) ? j.moments.filter((m) => m !== id) : [...j.moments, id];
    });
  }

  /* --------------------------------------------------------------- rows */

  function addRow() {
    const id = uid();
    app.change((d) => jd(d).rows.push({ id, name: 'Nueva fila' }));
    fresh = id;
  }
  function moveRow(i: number, by: number) {
    const j = i + by;
    if (j < 0 || j >= data.rows.length) return;
    app.change((d) => {
      const r = jd(d).rows;
      [r[i], r[j]] = [r[j], r[i]];
    });
  }
  function removeRow(id: string) {
    app.change((d) => {
      const j = jd(d);
      j.rows = j.rows.filter((r) => r.id !== id);
      for (const k of Object.keys(j.cells)) if (k.startsWith(`${id}:`)) delete j.cells[k];
    });
  }
  function rowTone(name: string): string | undefined {
    if (/pain|dolor|frustra|problema/i.test(name)) return '#d9534f';
    if (/oportunidad|gain|idea|mejora/i.test(name)) return '#58a55c';
    return undefined;
  }

  /* ------------------------------------------------------------ emotion */

  const colW = $derived(n ? (emoW - HEAD_W) / n : 0);
  const yOf = (v: number) => PAD + (2 - v) * STEP;
  const xOf = (i: number) => HEAD_W + (i + 0.5) * colW;
  const points = $derived(
    data.stages
      .map((s, i) => (s.id in data.emotion ? { id: s.id, i, v: data.emotion[s.id], x: xOf(i), y: yOf(data.emotion[s.id]) } : null))
      .filter((p): p is { id: string; i: number; v: number; x: number; y: number } => !!p)
  );

  let svgEl = $state<SVGSVGElement | null>(null);
  let dragging = $state<{ id: string; pointerId: number } | null>(null);

  function local(e: PointerEvent) {
    const r = svgEl!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function setEmotion(id: string, v: number) {
    if (data.emotion[id] === v) return;
    app.change((d) => (jd(d).emotion[id] = v), `emo:${id}`);
  }
  function onEmoDown(e: PointerEvent) {
    if (e.button !== 0 || !svgEl || !n) return;
    const p = local(e);
    if (p.x < HEAD_W) return;
    const i = Math.min(n - 1, Math.max(0, Math.floor((p.x - HEAD_W) / colW)));
    const id = data.stages[i].id;
    svgEl.setPointerCapture(e.pointerId);
    dragging = { id, pointerId: e.pointerId };
    setEmotion(id, clampEmotion(2 - (p.y - PAD) / STEP));
  }
  function onEmoMove(e: PointerEvent) {
    if (!svgEl || !n) return;
    const p = local(e);
    if (!dragging) {
      if (p.x < HEAD_W) {
        preview = null;
        hoverStage = null;
        return;
      }
      const i = Math.min(n - 1, Math.max(0, Math.floor((p.x - HEAD_W) / colW)));
      preview = { i, v: clampEmotion(2 - (p.y - PAD) / STEP) };
      hoverStage = data.stages[i].id;
      return;
    }
    if (e.pointerId !== dragging.pointerId) return;
    setEmotion(dragging.id, clampEmotion(2 - (p.y - PAD) / STEP));
  }
  function onEmoUp(e: PointerEvent) {
    if (dragging && e.pointerId === dragging.pointerId) dragging = null;
  }
  function onEmoLeave() {
    preview = null;
    if (!dragging) hoverStage = null;
  }
  /** Click anywhere in a cell (not only on its text) to type in it. */
  function focusCell(e: MouseEvent) {
    const cell = e.currentTarget as HTMLElement;
    if ((e.target as HTMLElement).tagName !== 'TEXTAREA') cell.querySelector('textarea')?.focus();
  }
  function onPointKey(e: KeyboardEvent, id: string, v: number) {
    if (e.key === 'ArrowUp') setEmotion(id, clampEmotion(v + 1));
    else if (e.key === 'ArrowDown') setEmotion(id, clampEmotion(v - 1));
    else if (e.key === 'Delete' || e.key === 'Backspace') app.change((d) => delete jd(d).emotion[id]);
    else return;
    e.preventDefault();
  }
</script>

<div class="wrap">
  <div class="scroll">
    <div class="journey" data-export-root style:grid-template-columns="{HEAD_W}px repeat({Math.max(1, n)}, minmax(190px, 1fr)) 44px" style:min-width="{HEAD_W + Math.max(1, n) * 190 + 44}px">
      <div class="head" style:grid-column="1 / -1">
        <label class="persona">
          <span class="sect">Persona</span>
          <input type="text" class="ghost-input big" value={data.persona} placeholder="¿Quién vive este recorrido?" oninput={(e) => app.change((d) => (jd(d).persona = e.currentTarget.value), 'persona')} />
        </label>
        <label class="scenario">
          <span class="sect">Escenario</span>
          <input type="text" class="ghost-input" value={data.scenario} placeholder="¿Qué quiere conseguir, en qué contexto?" oninput={(e) => app.change((d) => (jd(d).scenario = e.currentTarget.value), 'scenario')} />
        </label>
      </div>

      <!-- stages -->
      <div class="corner sect">Etapas</div>
      {#each data.stages as s, i (s.id)}
        <div class="stage" class:moment={data.moments.includes(s.id)} class:hot={hoverStage === s.id} role="columnheader" tabindex="-1" onpointerenter={() => (hoverStage = s.id)} onpointerleave={() => hoverStage === s.id && (hoverStage = null)}>
          {#if fresh === s.id}
            <input type="text" class="ghost-input stage-name" value={s.name} use:focusEnd onblur={() => (fresh = null)} oninput={(e) => app.change((d) => (jd(d).stages[i].name = e.currentTarget.value), `stage:${s.id}`)} />
          {:else}
            <input type="text" class="ghost-input stage-name" value={s.name} aria-label="Stage name" oninput={(e) => app.change((d) => (jd(d).stages[i].name = e.currentTarget.value), `stage:${s.id}`)} />
          {/if}
          {#if data.moments.includes(s.id)}
            <span class="moment-badge"><Icon name="Star" size={12} /> Momento de la verdad</span>
          {/if}
          <div class="tools" data-no-export>
            <button class="icon small" aria-label="Move left" title="Move left" disabled={i === 0} onclick={() => moveStage(i, -1)}><Icon name="ChevronLeft" size={14} /></button>
            <button class="icon small" aria-label="Move right" title="Move right" disabled={i === n - 1} onclick={() => moveStage(i, 1)}><Icon name="ChevronRight" size={14} /></button>
            <button class="icon small star" class:on={data.moments.includes(s.id)} aria-pressed={data.moments.includes(s.id)} aria-label="Moment of truth" title="Momento de la verdad" onclick={() => toggleMoment(s.id)}><Icon name="Star" size={14} /></button>
            <button class="icon small" aria-label="Delete stage" title="Delete stage" onclick={() => removeStage(s.id)}><Icon name="Trash2" size={14} /></button>
          </div>
        </div>
      {:else}
        <div class="stage empty muted small">No stages yet.</div>
      {/each}
      <!-- Grid cells stay in the export (removing them would shift the grid); only their controls go. -->
      <div class="add-col">
        <button class="icon" data-no-export aria-label="Add a stage" title="Add a stage" onclick={addStage}><Icon name="Plus" size={16} /></button>
      </div>

      <!-- rows -->
      {#each data.rows as r, ri (r.id)}
        {@const tone = rowTone(r.name)}
        <div class="row-head" style:background={tone ? `color-mix(in srgb, ${tone} 12%, var(--panel-2))` : undefined}>
          {#if fresh === r.id}
            <input type="text" class="ghost-input row-name" value={r.name} use:focusEnd onblur={() => (fresh = null)} oninput={(e) => app.change((d) => (jd(d).rows[ri].name = e.currentTarget.value), `row:${r.id}`)} />
          {:else}
            <input type="text" class="ghost-input row-name" value={r.name} aria-label="Row name" oninput={(e) => app.change((d) => (jd(d).rows[ri].name = e.currentTarget.value), `row:${r.id}`)} />
          {/if}
          <div class="tools" data-no-export>
            <button class="icon small" aria-label="Move up" title="Move up" disabled={ri === 0} onclick={() => moveRow(ri, -1)}><Icon name="ArrowUp" size={13} /></button>
            <button class="icon small" aria-label="Move down" title="Move down" disabled={ri === data.rows.length - 1} onclick={() => moveRow(ri, 1)}><Icon name="ArrowDown" size={13} /></button>
            <button class="icon small" aria-label="Delete row" title="Delete row" onclick={() => removeRow(r.id)}><Icon name="Trash2" size={13} /></button>
          </div>
        </div>
        {#each data.stages as s (s.id)}
          {@const key = `${r.id}:${s.id}`}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div
            class="cell"
            class:moment={data.moments.includes(s.id)}
            class:hot={hoverStage === s.id}
            style:background={tone ? `color-mix(in srgb, ${tone} 6%, var(--panel))` : undefined}
            onclick={focusCell}
            onpointerenter={() => (hoverStage = s.id)}
            onpointerleave={() => hoverStage === s.id && (hoverStage = null)}
          >
            <textarea
              rows="2"
              value={data.cells[key] ?? ''}
              aria-label="{r.name} — {s.name}"
              use:autosize={data.cells[key] ?? ''}
              oninput={(e) => {
                const v = e.currentTarget.value;
                app.change((d) => {
                  if (v) jd(d).cells[key] = v;
                  else delete jd(d).cells[key];
                }, `cell:${key}`);
              }}
            ></textarea>
          </div>
        {/each}
        {#if !n}<div class="cell"></div>{/if}
        <div class="add-col"></div>
      {/each}
      <div class="add-row" style:grid-column="1 / -1">
        <button class="small" data-no-export onclick={addRow}><Icon name="Plus" size={14} /> Row</button>
      </div>

      <!-- emotion curve -->
      <div class="emo" style:grid-column="1 / span {Math.max(1, n) + 1}" bind:clientWidth={emoW}>
        <svg
          bind:this={svgEl}
          width={emoW}
          height={EMO_H}
          role="img"
          aria-label="Curva de emociones"
          onpointerdown={onEmoDown}
          onpointermove={onEmoMove}
          onpointerup={onEmoUp}
          onpointerleave={onEmoLeave}
          onpointercancel={() => (dragging = null)}
        >
          <rect x="0" y="0" width={HEAD_W} height={EMO_H} class="emo-head" />
          <text x="14" y="22" class="emo-title">Emoción</text>
          {#each EMOTIONS as em (em.value)}
            <line x1={HEAD_W} x2={emoW} y1={yOf(em.value)} y2={yOf(em.value)} class="level" class:zero={em.value === 0} />
            <g transform="translate({HEAD_W - 30} {yOf(em.value) - 9})" style:color={em.color}><Icon name={em.icon} size={18} /></g>
            <text x={HEAD_W - 36} y={yOf(em.value) + 4} text-anchor="end" class="level-label">{em.label}</text>
          {/each}
          {#each data.stages as s, i (s.id)}
            {#if i > 0}<line x1={HEAD_W + i * colW} x2={HEAD_W + i * colW} y1="0" y2={EMO_H} class="col" />{/if}
            {#if data.moments.includes(s.id)}
              <rect x={HEAD_W + i * colW} y="0" width={colW} height={EMO_H} class="moment-col" />
            {/if}
            {#if hoverStage === s.id}
              <rect x={HEAD_W + i * colW} y="0" width={colW} height={EMO_H} class="col-hover" />
            {/if}
            {#if !(s.id in data.emotion)}
              <circle cx={xOf(i)} cy={yOf(0)} r="7" class="unset" />
            {/if}
          {/each}
          <path d={smoothPath(points)} class="curve" />
          <!-- where a click would set the point, with its level named -->
          {#if preview && !dragging}
            {@const em = emotionInfo(preview.v)}
            {@const cur = data.emotion[data.stages[preview.i]?.id]}
            {#if cur !== preview.v}
              <circle cx={xOf(preview.i)} cy={yOf(preview.v)} r="8" class="ghost" fill={em.color} />
            {/if}
            <text x={xOf(preview.i) + 14} y={yOf(preview.v) + 4} class="pt-label">{em.label}</text>
          {/if}
          {#each points as p (p.id)}
            {@const live = dragging?.id === p.id}
            {#if live}
              <circle cx={p.x} cy={p.y} r="15" class="pt-halo" />
              <text x={p.x + 14} y={p.y + 4} class="pt-label">{emotionInfo(p.v).label}</text>
            {/if}
            <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
            <circle
              cx={p.x}
              cy={p.y}
              r="8"
              class="pt"
              class:live
              class:hot={preview?.i === p.i}
              fill={emotionInfo(p.v).color}
              tabindex="0"
              role="slider"
              aria-label="Emoción en {data.stages[p.i].name}"
              aria-valuemin={-2}
              aria-valuemax={2}
              aria-valuenow={p.v}
              aria-valuetext={emotionInfo(p.v).label}
              onkeydown={(e) => onPointKey(e, p.id, p.v)}
            />
          {/each}
        </svg>
      </div>
      <div class="add-col"></div>
    </div>
    <p class="tip tiny muted">Drag a point of the curve up or down (or click in a stage's column); ↑ / ↓ on a focused point, Delete clears it. The star marks a moment of truth.</p>
  </div>
</div>

<style>
  .wrap {
    position: absolute;
    inset: 0;
  }
  .scroll {
    position: absolute;
    inset: 0;
    overflow: auto;
    padding: var(--sp-4);
    background: var(--paper);
  }
  .journey {
    display: grid;
    background: var(--paper);
    padding: var(--sp-2);
  }
  .head {
    display: flex;
    gap: var(--sp-4);
    align-items: flex-end;
    flex-wrap: wrap;
    padding: 0 0 var(--sp-3);
  }
  .head label {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .persona {
    flex: 0 1 380px;
  }
  .scenario {
    flex: 1 1 380px;
  }
  .big {
    font-size: var(--fs-lg);
    font-weight: 700;
  }
  .corner,
  .stage,
  .row-head,
  .cell,
  .emo {
    border: 1px solid var(--line);
    margin: 0 -1px -1px 0;
  }
  .corner {
    display: flex;
    align-items: center;
    padding: var(--sp-2) var(--sp-3);
    background: var(--panel-2);
  }
  .stage {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--sp-2) var(--sp-2) 6px;
    background: color-mix(in srgb, #4a7fc1 16%, var(--panel));
  }
  .stage.moment {
    background: color-mix(in srgb, #e2c044 30%, var(--panel));
  }
  .stage-name {
    font-weight: 700;
  }
  /* The column under the pointer, from its header down to the curve. */
  .stage.hot {
    box-shadow: inset 0 -3px 0 color-mix(in srgb, #4a7fc1 70%, var(--ink));
  }
  .stage.moment.hot {
    box-shadow: inset 0 -3px 0 #b08d1a;
  }
  .moment-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding-left: 6px;
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--ink-2);
  }
  .moment-badge :global(svg) {
    fill: currentColor;
  }
  .tools {
    display: flex;
    gap: 1px;
    opacity: 0;
    transition: opacity var(--t);
  }
  .stage:hover .tools,
  .row-head:hover .tools,
  .tools:focus-within {
    opacity: 1;
  }
  .star.on {
    color: #b08d1a;
  }
  .star.on :global(svg) {
    fill: currentColor;
  }
  .add-col {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .row-head {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--sp-2);
    background: var(--panel-2);
  }
  .row-name {
    font-weight: 700;
    font-size: var(--fs-sm);
  }
  /* Row labels stay in view while the stages scroll sideways. */
  .corner,
  .row-head {
    position: sticky;
    left: 0;
    z-index: 2;
  }
  /* An empty persona / scenario field leaves no trace in the exported image. */
  :global(.exporting) .head label:has(input:placeholder-shown) {
    visibility: hidden;
  }
  .cell {
    padding: 6px var(--sp-2);
    background: var(--panel);
    cursor: text;
    transition: box-shadow var(--t);
  }
  .cell.hot {
    box-shadow: inset 0 0 0 9999px var(--hover);
  }
  .cell:focus-within {
    box-shadow: inset 0 0 0 2px var(--accent);
  }
  .cell.moment {
    box-shadow: inset 0 0 0 9999px color-mix(in srgb, #e2c044 7%, transparent);
  }
  .cell.moment.hot {
    box-shadow: inset 0 0 0 9999px color-mix(in srgb, #e2c044 14%, transparent);
  }
  .cell.moment:focus-within {
    box-shadow: inset 0 0 0 2px var(--accent), inset 0 0 0 9999px color-mix(in srgb, #e2c044 7%, transparent);
  }
  :global(html.exporting) .cell:is(.hot, :focus-within):not(.moment),
  :global(html.exporting) .stage.hot {
    box-shadow: none;
  }
  :global(html.exporting) .cell.moment:is(.hot, :focus-within) {
    box-shadow: inset 0 0 0 9999px color-mix(in srgb, #e2c044 7%, transparent);
  }
  :global(html.exporting) .col-hover,
  :global(html.exporting) .ghost,
  :global(html.exporting) .pt-label,
  :global(html.exporting) .pt-halo {
    display: none;
  }
  .cell textarea {
    display: block;
    width: 100%;
    min-height: 44px;
    padding: 2px 4px;
    border: 1px solid transparent;
    background: transparent;
    resize: none;
    overflow: hidden;
    font-size: var(--fs-sm);
    line-height: 1.4;
  }
  .cell textarea:hover {
    border-color: var(--line);
  }
  .cell textarea:focus {
    border-color: var(--accent);
    outline: none;
    background: var(--panel);
  }
  .add-row {
    padding: var(--sp-1) 0 var(--sp-2);
  }
  .emo {
    background: var(--panel);
    min-width: 0;
  }
  .emo svg {
    display: block;
    cursor: ns-resize;
    touch-action: none;
    font-family: var(--font);
  }
  .emo-head {
    fill: var(--panel-2);
  }
  .emo-title {
    font-size: 12px;
    font-weight: 700;
    fill: var(--ink);
  }
  .level {
    stroke: var(--line);
    stroke-dasharray: 2 5;
  }
  .level.zero {
    stroke: var(--faint);
    stroke-dasharray: none;
  }
  .level-label {
    font-size: 10.5px;
    fill: var(--muted);
  }
  .col {
    stroke: var(--line);
  }
  .moment-col {
    fill: color-mix(in srgb, #e2c044 14%, transparent);
  }
  .curve {
    fill: none;
    stroke: var(--ink-2);
    stroke-width: 2.5;
    stroke-linecap: round;
  }
  .pt {
    stroke: var(--panel);
    stroke-width: 2.5;
    cursor: grab;
    outline: none;
    transition: stroke var(--t);
  }
  :global(html:not(.exporting)) .pt:is(.hot, :hover) {
    stroke: var(--ink-2);
  }
  .pt.live {
    cursor: grabbing;
  }
  .pt:focus-visible {
    stroke: var(--accent);
    stroke-width: 3;
  }
  .col-hover {
    fill: color-mix(in srgb, var(--accent) 6%, transparent);
    pointer-events: none;
  }
  .ghost {
    opacity: 0.4;
    pointer-events: none;
  }
  .pt-halo {
    fill: color-mix(in srgb, var(--accent) 18%, transparent);
    pointer-events: none;
  }
  .pt-label {
    font-size: 11.5px;
    font-weight: 700;
    fill: var(--ink-2);
    paint-order: stroke;
    stroke: var(--panel);
    stroke-width: 3px;
    stroke-linejoin: round;
    pointer-events: none;
  }
  .unset {
    fill: none;
    stroke: var(--faint);
    stroke-width: 1.5;
    stroke-dasharray: 3 3;
  }
  .tip {
    margin-top: var(--sp-2);
  }
</style>
