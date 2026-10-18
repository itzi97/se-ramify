<script lang="ts">
  import { onDestroy } from 'svelte';
  import { app } from '../../stores/app.svelte';
  import { uid } from '../../model/diagram';
  import { stickyBg } from '../../model/colors';
  import type { BoardData, BoardKind, Sticky } from '../../model/types';
  import Icon from '../../components/Icon.svelte';
  import Swatches from '../../components/Swatches.svelte';
  import { TEMPLATES, randomWord, type SectionDef } from './templates';
  import { autosize, focusEnd } from './actions';

  /**
   * One editor for every sticky-note board. The template (templates.ts)
   * decides the grid; stickies are added with the section's + button or a
   * double-click, edited inline, and dragged with the pointer between and
   * within sections (no HTML5 drag and drop, so it behaves the same on
   * Wayland, X11 and Windows).
   */

  const kind = app.doc!.kind as BoardKind;
  const t = TEMPLATES[kind];
  const data = $derived((app.doc?.data ?? { subject: '', sections: {} }) as BoardData);

  let editing = $state<string | null>(null);
  let colorFor = $state<string | null>(null);
  let lastSection = $state(t.defaultSection);

  const list = (sec: string): Sticky[] => data.sections[sec] ?? [];
  const total = $derived(Object.values(data.sections).reduce((n, l) => n + (l?.length ?? 0), 0));

  function board(d: { data: unknown }): BoardData {
    return d.data as BoardData;
  }

  function find(id: string): { sec: string; index: number } | null {
    for (const [sec, items] of Object.entries(data.sections)) {
      const index = (items ?? []).findIndex((s) => s.id === id);
      if (index >= 0) return { sec, index };
    }
    return null;
  }

  function add(sec: string, index?: number) {
    const id = uid();
    app.change((d) => {
      const secs = board(d).sections;
      const arr = (secs[sec] ??= []);
      arr.splice(index ?? arr.length, 0, { id, text: '' });
    });
    lastSection = sec;
    editing = id;
  }

  function setText(id: string, text: string) {
    const at = find(id);
    if (!at) return;
    app.change((d) => {
      const s = board(d).sections[at.sec]?.[at.index];
      if (s) s.text = text;
    }, `sticky:${id}`);
  }

  function setColor(id: string, color: string | undefined) {
    const at = find(id);
    if (!at) return;
    app.change((d) => {
      const s = board(d).sections[at.sec]?.[at.index];
      if (!s) return;
      if (color) s.color = color;
      else delete s.color;
    });
  }

  function remove(id: string) {
    const at = find(id);
    if (!at) return;
    app.change((d) => {
      board(d).sections[at.sec]?.splice(at.index, 1);
    });
    if (editing === id) editing = null;
    if (colorFor === id) colorFor = null;
  }

  function move(id: string, toSec: string, toIndex: number) {
    const at = find(id);
    if (!at) return;
    // Dropped where it already is (toIndex counts the list without the dragged sticky).
    if (at.sec === toSec && toIndex === at.index) return;
    app.change((d) => {
      const secs = board(d).sections;
      const [s] = secs[at.sec]!.splice(at.index, 1);
      const arr = (secs[toSec] ??= []);
      arr.splice(Math.min(toIndex, arr.length), 0, s);
    });
    lastSection = toSec;
  }

  function finishEdit(id: string, value: string) {
    if (editing === id) editing = null;
    if (!value.trim()) remove(id);
  }

  function onStickyKey(e: KeyboardEvent, id: string) {
    if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) {
      e.preventDefault();
      (e.currentTarget as HTMLTextAreaElement).blur();
    } else if (e.key === 'Tab' && !e.shiftKey && (e.currentTarget as HTMLTextAreaElement).value.trim()) {
      // Tab: keep going with a new sticky right after this one.
      e.preventDefault();
      const at = find(id);
      (e.currentTarget as HTMLTextAreaElement).blur();
      if (at) add(at.sec, at.index + 1);
    }
  }

  /* ----------------------------------------------------------------- drag */

  interface Drag {
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    dx: number;
    dy: number;
    w: number;
    h: number;
    active: boolean;
  }
  let drag = $state<Drag | null>(null);
  let ghost = $state({ x: 0, y: 0 });
  let drop = $state<{ sec: string; index: number } | null>(null);

  function onStickyDown(e: PointerEvent, id: string) {
    if (e.button !== 0 || editing === id) return;
    if ((e.target as HTMLElement).closest('button, textarea, input')) return;
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    el.setPointerCapture(e.pointerId);
    drag = { id, pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, w: r.width, h: r.height, active: false };
  }

  function onStickyMove(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.active && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5) return;
    drag.active = true;
    colorFor = null;
    ghost = { x: e.clientX - drag.dx, y: e.clientY - drag.dy };
    drop = dropAt(e.clientX, e.clientY, drag.id);
  }

  function onStickyUp(e: PointerEvent, id: string) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const wasActive = drag.active;
    drag = null;
    if (wasActive) {
      if (drop) move(id, drop.sec, drop.index);
      drop = null;
    } else {
      editing = id;
      colorFor = null;
    }
  }

  function onStickyCancel() {
    drag = null;
    drop = null;
  }

  /** Section and index (in reading order, without the dragged sticky) under the pointer. */
  function dropAt(x: number, y: number, dragId: string): { sec: string; index: number } | null {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    const secEl = el?.closest<HTMLElement>('[data-section]');
    if (!secEl) return null;
    const sec = secEl.dataset.section!;
    let index = 0;
    for (const s of secEl.querySelectorAll<HTMLElement>('[data-sticky]')) {
      if (s.dataset.sticky === dragId) continue;
      const r = s.getBoundingClientRect();
      if (r.bottom < y || (r.top <= y && y <= r.bottom && r.left + r.width / 2 < x)) index++;
    }
    return { sec, index };
  }

  function dropBefore(sec: string, s: Sticky): boolean {
    if (!drag?.active || !drop || drop.sec !== sec || s.id === drag.id) return false;
    return list(sec).filter((x) => x.id !== drag!.id).indexOf(s) === drop.index;
  }
  function dropAtEnd(sec: string): boolean {
    if (!drag?.active || !drop || drop.sec !== sec) return false;
    return drop.index >= list(sec).filter((x) => x.id !== drag!.id).length;
  }

  const dragged = $derived.by(() => {
    if (!drag?.active) return null;
    const at = find(drag.id);
    return at ? list(at.sec)[at.index] : null;
  });

  /* ------------------------------------------------------- double-click */

  function onSectionDbl(e: MouseEvent, sec: string) {
    if ((e.target as HTMLElement).closest('[data-sticky], button, textarea, input')) return;
    add(sec);
  }

  function onBoardDbl(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (target.closest('[data-section], [data-sticky], button, textarea, input')) return;
    add(lastSection);
  }

  /* ------------------------------------------------- brainstorm stimulus */

  let word = $state<string | null>(null);

  /* ----------------------------------------------------- crazy-8 timer */

  const PANEL_MS = 60_000;
  let running = $state(false);
  let acc = $state(0);
  let startedAt = 0;
  let now = $state(Date.now());
  let timer: ReturnType<typeof setInterval> | null = null;

  const elapsed = $derived(Math.min(8 * PANEL_MS, acc + (running ? now - startedAt : 0)));
  const currentPanel = $derived(running || acc > 0 ? Math.min(8, Math.floor(elapsed / PANEL_MS) + 1) : 0);
  const panelLeft = $derived(Math.max(0, PANEL_MS - (elapsed % PANEL_MS || (elapsed >= 8 * PANEL_MS ? PANEL_MS : 0))));
  const finished = $derived(elapsed >= 8 * PANEL_MS);

  // While the timer runs, new stickies go to the panel of the current minute.
  $effect(() => {
    if (kind === 'crazy8' && running && currentPanel) lastSection = `p${currentPanel}`;
  });

  function startTimer() {
    if (finished) acc = 0;
    startedAt = Date.now();
    now = startedAt;
    running = true;
    timer ??= setInterval(() => {
      now = Date.now();
      if (running && acc + (now - startedAt) >= 8 * PANEL_MS) {
        acc = 8 * PANEL_MS;
        running = false;
      }
    }, 250);
  }
  function stopTimer() {
    if (running) acc += Date.now() - startedAt;
    running = false;
  }
  function resetTimer() {
    running = false;
    acc = 0;
  }
  onDestroy(() => {
    if (timer) clearInterval(timer);
  });

  const mmss = (ms: number) => {
    const s = Math.ceil(ms / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  /* --------------------------------------------------------------- misc */

  function initials(name: string): string {
    const words = name.split(/[,(]/)[0].trim().split(/\s+/).filter(Boolean);
    return (words[0]?.[0] ?? '') + (words[1]?.[0] ?? '') || '?';
  }

  function sectionBg(sec: SectionDef): string {
    return sec.tint ? `color-mix(in srgb, ${sec.tint} 11%, var(--panel))` : 'var(--panel)';
  }

  function onWindowPointerDown(e: PointerEvent) {
    if (colorFor && !(e.target as HTMLElement).closest('.color-pop, .tool-color')) colorFor = null;
  }
</script>

<svelte:window onpointerdown={onWindowPointerDown} />

<div class="wrap">
  <div class="bar">
    <label class="subject-field">
      <span class="sect">{t.subjectLabel}</span>
      <input
        type="text"
        value={data.subject}
        placeholder={t.subjectPlaceholder}
        oninput={(e) => app.change((d) => (board(d).subject = e.currentTarget.value), 'subject')}
      />
    </label>
    <button class="secondary small" onclick={() => add(lastSection)} title="Add a sticky note (or double-click a section)">
      <Icon name="Plus" size={14} /> Sticky
    </button>
    {#if kind === 'brainstorm'}
      <span class="sep"></span>
      <button class="secondary small" onclick={() => (word = randomWord(word ?? undefined))} title="A random word to spark new ideas">
        <Icon name="Shuffle" size={14} /> Estímulo aleatorio
      </button>
      {#if word}
        <span class="word" aria-live="polite">{word}<button class="icon small" aria-label="Clear the word" onclick={() => (word = null)}><Icon name="X" size={12} /></button></span>
      {/if}
      <span class="spacer"></span>
      <span class="small muted">{total} {total === 1 ? 'idea' : 'ideas'}</span>
    {:else if kind === 'crazy8'}
      <span class="sep"></span>
      {#if running}
        <button class="secondary small" onclick={stopTimer}><Icon name="Pause" size={14} /> Pause</button>
      {:else}
        <button class="primary small" onclick={startTimer}><Icon name="Play" size={14} /> {acc > 0 && !finished ? 'Resume' : 'Start 8 minutes'}</button>
      {/if}
      <button class="small" onclick={resetTimer} disabled={!running && acc === 0}><Icon name="RotateCcw" size={14} /> Reset</button>
      <span class="timer" class:live={running} aria-live="off">
        {#if finished}
          Time's up — eight ideas.
        {:else if currentPanel}
          Idea {currentPanel} of 8 · <strong>{mmss(panelLeft)}</strong>
        {:else}
          One minute per panel.
        {/if}
      </span>
    {/if}
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="scroll" ondblclick={onBoardDbl}>
    <div
      class="board"
      data-export-root
      style:grid-template-columns={t.columns}
      style:grid-template-areas={t.areas.map((a) => `"${a}"`).join(' ')}
      style:grid-template-rows={t.rowMin.map((h) => (h <= 40 ? `${h}px` : `minmax(${h}px, auto)`)).join(' ')}
      style:min-width="{t.minWidth}px"
    >
      {#each t.decor as d (d.area)}
        {#if d.kind === 'subject'}
          <div class="decor subject {kind}" style:grid-area={d.area}>
            {#if kind === 'persona'}
              <div class="avatar" aria-hidden="true">{initials(data.subject).toUpperCase()}</div>
              <div class="who">{data.subject || t.subjectPlaceholder}</div>
            {:else if kind === 'empathy'}
              <div class="face" aria-hidden="true"><Icon name="CircleUserRound" size={56} /></div>
              <div class="who">{data.subject || t.subjectPlaceholder}</div>
            {:else}
              <div class="sect">{t.subjectLabel}</div>
              <div class="challenge">{data.subject || t.subjectPlaceholder}</div>
            {/if}
          </div>
        {:else if d.kind === 'axisY'}
          <div class="decor axis-y" style:grid-area={d.area}><span>{d.text}</span><Icon name="ArrowUp" size={14} /></div>
        {:else}
          <div class="decor axis-x" style:grid-area={d.area}><span>{d.text}</span><Icon name="ArrowRight" size={14} /></div>
        {/if}
      {/each}

      {#each t.sections as sec (sec.id)}
        {@const items = list(sec.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <section
          class="section"
          class:current={kind === 'crazy8' && sec.panel === currentPanel && !finished}
          class:target={drag?.active && drop?.sec === sec.id}
          style:grid-area={sec.area}
          style:background={sectionBg(sec)}
          data-section={sec.id}
          ondblclick={(e) => onSectionDbl(e, sec.id)}
          aria-label={sec.title}
        >
          <header class="sec-head">
            {#if sec.hat}
              <svg class="hat" width="30" height="22" viewBox="0 0 30 22" aria-hidden="true">
                <ellipse cx="15" cy="18" rx="13.5" ry="3" fill={sec.hat} stroke="var(--ink)" stroke-width="1.2" />
                <path d="M7 18 L8.5 4 Q15 1.5 21.5 4 L23 18 Z" fill={sec.hat} stroke="var(--ink)" stroke-width="1.2" stroke-linejoin="round" />
              </svg>
            {:else if sec.panel}
              <span class="panel-no">{sec.panel}</span>
            {:else if sec.icon}
              <Icon name={sec.icon} size={15} />
            {/if}
            <strong class="sec-title">{sec.title}</strong>
            <span class="spacer"></span>
            <button class="icon small add" data-no-export title="Add a sticky to {sec.title}" aria-label="Add a sticky to {sec.title}" onclick={() => add(sec.id)}>
              <Icon name="Plus" size={14} />
            </button>
          </header>
          {#if kind === 'sixhats'}
            <p class="hint always">{sec.hint}</p>
          {:else if !items.length}
            <p class="hint" data-no-export>{sec.hint}</p>
          {/if}
          <div class="stickies" class:drop-end={dropAtEnd(sec.id)}>
            {#each items as s (s.id)}
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <div
                class="sticky note"
                class:dragging={drag?.active && drag.id === s.id}
                class:drop-before={dropBefore(sec.id, s)}
                class:editing={editing === s.id}
                style:background={stickyBg(s.color)}
                data-sticky={s.id}
                onpointerdown={(e) => onStickyDown(e, s.id)}
                onpointermove={onStickyMove}
                onpointerup={(e) => onStickyUp(e, s.id)}
                onpointercancel={onStickyCancel}
              >
                {#if editing === s.id}
                  <textarea
                    rows="2"
                    value={s.text}
                    aria-label="Sticky note text"
                    use:autosize={s.text}
                    use:focusEnd
                    oninput={(e) => setText(s.id, e.currentTarget.value)}
                    onkeydown={(e) => onStickyKey(e, s.id)}
                    onblur={(e) => finishEdit(s.id, e.currentTarget.value)}
                  ></textarea>
                {:else}
                  <div class="text">{s.text}</div>
                {/if}
                <div class="tools" data-no-export>
                  <button class="icon small tool-color" title="Colour" aria-label="Colour" onclick={() => (colorFor = colorFor === s.id ? null : s.id)}><Icon name="Palette" size={12} /></button>
                  <button class="icon small" title="Delete" aria-label="Delete sticky" onclick={() => remove(s.id)}><Icon name="X" size={12} /></button>
                </div>
                {#if colorFor === s.id}
                  <div class="color-pop float arrive" data-no-export>
                    <Swatches value={s.color} onPick={(hex) => { setColor(s.id, hex); colorFor = null; }} />
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  </div>

  {#if drag?.active && dragged}
    <div class="sticky note ghost" style:left="{ghost.x}px" style:top="{ghost.y}px" style:width="{drag.w}px" style:min-height="{drag.h}px" style:background={stickyBg(dragged.color)}>
      <div class="text">{dragged.text}</div>
    </div>
  {/if}
</div>

<style>
  .wrap {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
  }
  .bar {
    flex: none;
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3);
    border-bottom: 1px solid var(--line);
    background: var(--panel);
    flex-wrap: wrap;
  }
  .subject-field {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    flex: 1 1 320px;
    max-width: 640px;
  }
  .sep {
    width: 1px;
    height: 20px;
    background: var(--line);
    margin: 0 var(--sp-1);
  }
  .word {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 0 2px 0 var(--sp-3);
    height: 26px;
    border-radius: var(--r-pill);
    background: color-mix(in srgb, var(--accent) 14%, var(--panel));
    font-weight: 700;
  }
  .timer {
    font-size: var(--fs-sm);
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .timer.live {
    color: var(--ink);
  }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow: auto;
    background: var(--paper);
  }
  .board {
    display: grid;
    gap: 10px;
    padding: var(--sp-4);
    min-height: 100%;
    background: var(--paper);
  }
  .section {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    min-width: 0;
    padding: var(--sp-2) var(--sp-3) var(--sp-3);
    border: 1px solid var(--line);
    border-radius: var(--r-card);
    transition: border-color var(--t), box-shadow var(--t);
  }
  .section.target {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 1px var(--accent);
  }
  .section.current {
    border-color: var(--accent);
    box-shadow: inset 0 0 0 2px var(--accent);
  }
  .sec-head {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: 26px;
    color: var(--ink-2);
  }
  .sec-title {
    color: var(--ink);
    font-size: var(--fs-md);
  }
  .add {
    opacity: 0;
    transition: opacity var(--t);
  }
  .section:hover .add,
  .add:focus-visible {
    opacity: 1;
  }
  .panel-no {
    display: inline-grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: var(--r-pill);
    background: var(--panel-2);
    font-weight: 700;
    font-size: var(--fs-sm);
  }
  .hat {
    flex: none;
  }
  .hint {
    font-size: var(--fs-sm);
    color: var(--muted);
  }
  .hint.always {
    color: var(--ink-2);
  }
  .stickies {
    flex: 1;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(128px, 1fr));
    align-content: start;
    gap: var(--sp-2);
    position: relative;
  }
  .note {
    position: relative;
    min-height: 50px;
    padding: var(--sp-2) var(--sp-2) var(--sp-2) 10px;
    border-radius: var(--r-control);
    box-shadow: 0 1px 2px rgba(22, 25, 29, 0.14);
    color: var(--ink);
    font-size: var(--fs-sm);
    line-height: 1.35;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .note.editing {
    cursor: text;
    box-shadow: 0 0 0 2px var(--accent);
  }
  .note.dragging {
    opacity: 0.3;
  }
  .note.drop-before::before,
  .drop-end::after {
    content: '';
    position: absolute;
    top: 2px;
    bottom: 2px;
    left: -6px;
    width: 3px;
    border-radius: 2px;
    background: var(--accent);
  }
  .drop-end::after {
    position: static;
    display: block;
    width: 3px;
    min-height: 48px;
  }
  .text {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  textarea {
    display: block;
    width: 100%;
    min-height: 40px;
    padding: 0;
    border: 0;
    background: transparent;
    resize: none;
    font-size: var(--fs-sm);
    line-height: 1.35;
    overflow: hidden;
    outline: none;
  }
  .tools {
    position: absolute;
    top: 2px;
    right: 2px;
    display: flex;
    gap: 1px;
    opacity: 0;
    transition: opacity var(--t);
  }
  .tools button {
    width: 20px;
    height: 20px;
    background: color-mix(in srgb, var(--panel) 70%, transparent);
  }
  .note:hover .tools,
  .note.editing .tools,
  .tools:focus-within {
    opacity: 1;
  }
  .color-pop {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 30;
    padding: var(--sp-2);
    cursor: default;
  }
  .ghost {
    position: fixed;
    z-index: 90;
    pointer-events: none;
    cursor: grabbing;
    box-shadow: var(--shadow);
    transform: rotate(-1.5deg);
  }
  .decor {
    display: flex;
    min-width: 0;
  }
  .decor.subject {
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--sp-2);
    padding: var(--sp-3);
    text-align: center;
    border-radius: var(--r-card);
  }
  .decor.subject.empathy {
    border-radius: 50%;
    border: 2px solid var(--line);
    background: var(--panel);
    aspect-ratio: 1 / 1;
    justify-self: center;
    max-height: 100%;
    margin: var(--sp-2) 0;
  }
  .decor.subject.context {
    border: 2px solid var(--ink-2);
    background: var(--panel);
  }
  .decor.subject.persona {
    flex-direction: row;
    justify-content: flex-start;
    text-align: left;
    border: 1px solid var(--line);
    background: var(--panel);
  }
  .face {
    color: var(--muted);
  }
  .avatar {
    flex: none;
    display: grid;
    place-items: center;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: color-mix(in srgb, #4a7fc1 22%, var(--panel));
    border: 2px solid color-mix(in srgb, #4a7fc1 60%, var(--panel));
    font-size: 26px;
    font-weight: 700;
    color: var(--ink-2);
  }
  .who {
    font-weight: 700;
    font-size: var(--fs-lg);
    overflow-wrap: anywhere;
  }
  .challenge {
    font-size: 19px;
    font-weight: 700;
    line-height: 1.3;
    max-width: 30ch;
  }
  .axis-y {
    flex-direction: column-reverse;
    align-items: center;
    justify-content: center;
    gap: var(--sp-1);
    color: var(--muted);
    font-weight: 700;
    font-size: var(--fs-sm);
    border-left: 2px solid var(--muted);
    margin-left: 12px;
  }
  .axis-y span {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
  }
  .axis-x {
    align-items: center;
    justify-content: center;
    gap: var(--sp-1);
    color: var(--muted);
    font-weight: 700;
    font-size: var(--fs-sm);
    border-top: 2px solid var(--muted);
  }
</style>
