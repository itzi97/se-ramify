<script lang="ts">
  import { app } from '../../stores/app.svelte';
  import { uid } from '../../model/diagram';
  import { initials } from '../../model/stories';
  import type { GanttData, GanttTask } from '../../model/types';
  import Icon from '../../components/Icon.svelte';
  import Swatches from '../../components/Swatches.svelte';
  import {
    PX_PER_DAY,
    addDays,
    descendants,
    diffDays,
    durationDays,
    groupProgress,
    headerTicks,
    indent,
    mondayOf,
    moveAmongSiblings,
    moveTask,
    outdent,
    removeTask,
    resizeTask,
    setDuration,
    setEnd,
    setStart,
    shortDate,
    span,
    timelineRange,
    planRange,
    todayLocal,
    visibleRows,
    wouldCycle,
    enforceDeps,
    placeNew,
    esDate
  } from './time';
  import DateField from './DateField.svelte';
  import { onMount, flushSync } from 'svelte';

  const ROW = 32;
  const HEAD = 48;
  const FULL = { name: 224, start: 96, end: 96, days: 50, pct: 58, owner: 92 };
  /** Narrow windows: name, dates and % only, so the timeline gets the room. */
  const COMPACT = { name: 180, start: 88, end: 88, days: 0, pct: 56, owner: 0 };
  let viewW = $state(1600);
  /**
   * While an image is captured the sheet is laid out tight: only the plan's
   * own dates (not today, not the screen width), only its rows, every column.
   */
  let exporting = $state(false);
  const compact = $derived(!exporting && viewW < 1500);
  const COLS = $derived(compact ? COMPACT : FULL);
  const TABLE_W = $derived(Object.values(COLS).reduce((a, b) => a + b, 0));

  const doc = $derived(app.docOf('gantt'));
  const data = $derived(doc.data);

  let selected = $state<string | null>(null);
  let details = $state(false);
  let collapsed = $state<Set<string>>(new Set());
  let scroller: HTMLDivElement | undefined = $state();
  let sheet: HTMLDivElement | undefined = $state();

  onMount(() => {
    // The shell asks for the image source right after it marks <html> as exporting:
    // switch to the tight layout synchronously, measure, and switch back when it's done.
    const root = document.documentElement;
    const watch = new MutationObserver(() => {
      if (exporting && !root.classList.contains('exporting')) exporting = false;
    });
    watch.observe(root, { attributes: true, attributeFilter: ['class'] });
    app.setImageSource(() => {
      flushSync(() => (exporting = true));
      const el = sheet!;
      return { el, width: el.scrollWidth, height: el.scrollHeight };
    });
    return () => {
      watch.disconnect();
      app.setImageSource(null);
    };
  });

  /** A bar being dragged: preview only, committed on release. */
  let drag = $state<{ id: string; mode: 'move' | 'start' | 'end'; days: number } | null>(null);

  const today = todayLocal();

  /** What is drawn: the live data, or a copy with the drag applied. */
  const tasks = $derived.by((): GanttTask[] => {
    const live = data.tasks;
    if (!drag || !drag.days) return live;
    const copy: GanttData = { ...data, tasks: live.map((t) => ({ ...t, deps: [...t.deps] })) };
    if (drag.mode === 'move') moveTask(copy, drag.id, drag.days);
    else resizeTask(copy, drag.id, drag.mode, drag.days);
    enforceDeps(copy);
    return copy.tasks;
  });

  const rows = $derived(visibleRows(tasks, collapsed));
  const px = $derived(PX_PER_DAY[data.scale]);
  const range = $derived(exporting ? planRange(data.tasks, data.scale, today) : timelineRange(data.tasks, data.scale, today));
  const ticks = $derived(headerTicks(range, data.scale));
  /** In an exported image, room after the last date for a milestone's or bar's label. */
  const timelineW = $derived(range.days * px + (exporting ? 170 : 0));
  const rowIndex = $derived(new Map(rows.map((r, i) => [r.task.id, i])));
  const sel = $derived(selected ? data.tasks.find((t) => t.id === selected) ?? null : null);

  /** Every change keeps finish-to-start dependencies: dependents are pushed later, never drawn before their prerequisites. */
  function edit(fn: (g: GanttData) => void, key?: string) {
    app.change((d) => {
      const g = (d as typeof doc).data;
      fn(g);
      enforceDeps(g);
    }, key);
  }
  function editTask(id: string, fn: (t: GanttTask) => void, key?: string) {
    edit((g) => {
      const t = g.tasks.find((x) => x.id === id);
      if (t) fn(t);
    }, key ? `${key}:${id}` : undefined);
  }

  /** Inherited colour: the task's own, else its nearest group's. */
  function colorOf(t: GanttTask): string | undefined {
    let cur: GanttTask | undefined = t;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      if (cur.color) return cur.color;
      seen.add(cur.id);
      cur = tasks.find((x) => x.id === cur!.parent);
    }
    return undefined;
  }

  function xOf(iso: string): number {
    return diffDays(range.start, iso) * px;
  }

  /* ------------------------------------------------------------ adding */

  function add(kind: 'task' | 'milestone' | 'group') {
    const id = uid();
    edit((g) => {
      const at = placeNew(g, kind, selected, today);
      const t: GanttTask = {
        id,
        name: kind === 'group' ? 'Nueva fase' : kind === 'milestone' ? 'Hito' : 'Nueva tarea',
        start: at.start,
        end: kind === 'milestone' || kind === 'group' ? at.start : addDays(at.start, 4),
        progress: 0,
        milestone: kind === 'milestone',
        group: kind === 'group',
        parent: at.parent,
        deps: [],
        owner: ''
      };
      g.tasks.splice(at.index, 0, t);
    });
    selected = id;
    if (selected) collapsed.delete(selected);
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLInputElement>(`[data-name-input="${id}"]`);
      el?.focus();
      el?.select();
    });
  }

  function remove(id: string) {
    edit((g) => removeTask(g, id));
    if (selected === id) {
      selected = null;
      details = false;
    }
  }

  function toggleCollapse(id: string) {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    collapsed = next;
  }

  /** Pick the finest scale at which the whole plan fits beside the table. */
  function fitScale() {
    const room = viewW - TABLE_W - 8;
    const pick = (['day', 'week', 'month'] as const).find((sc) => timelineRange(data.tasks, sc, today).days * PX_PER_DAY[sc] <= room) ?? 'month';
    if (pick !== data.scale) edit((g) => (g.scale = pick));
    scroller?.scrollTo({ left: 0 });
  }

  function scrollToToday() {
    if (!scroller) return;
    scroller.scrollTo({ left: Math.max(0, xOf(today) - 120), behavior: 'smooth' });
  }

  /* -------------------------------------------------------------- drag */

  function onBarDown(e: PointerEvent, t: GanttTask) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const off = e.clientX - rect.left;
    const mode: 'move' | 'start' | 'end' = t.group || t.milestone ? 'move' : off < 7 ? 'start' : off > rect.width - 7 ? 'end' : 'move';
    const x0 = e.clientX;
    let moved = false;
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      if (Math.abs(dx) > 3) moved = true;
      if (!moved) return;
      drag = { id: t.id, mode, days: Math.round(dx / px) };
    };
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      const d = drag;
      drag = null;
      if (moved && d && d.days) {
        edit((g) => {
          if (d.mode === 'move') moveTask(g, d.id, d.days);
          else resizeTask(g, d.id, d.mode, d.days);
        });
      }
      selected = t.id;
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  function cursorFor(e: PointerEvent, t: GanttTask) {
    const el = e.currentTarget as HTMLElement;
    if (t.group || t.milestone) {
      el.style.cursor = 'grab';
      return;
    }
    const r = el.getBoundingClientRect();
    const off = e.clientX - r.left;
    el.style.cursor = off < 7 || off > r.width - 7 ? 'ew-resize' : 'grab';
  }

  /* -------------------------------------------------------- dependencies */

  const arrows = $derived.by(() => {
    const out: { id: string; d: string; hot: boolean; x: number; y: number }[] = [];
    for (const r of rows) {
      const t = r.task;
      const ti = rowIndex.get(t.id)!;
      for (const depId of t.deps) {
        const dep = tasks.find((x) => x.id === depId);
        const di = rowIndex.get(depId);
        if (!dep || di === undefined) continue;
        const ds = span(tasks, dep);
        const ts = span(tasks, t);
        const x1 = dep.milestone ? xOf(ds.start) + px / 2 + 7 : xOf(ds.end) + px;
        const y1 = di * ROW + ROW / 2;
        const x2 = t.milestone ? xOf(ts.start) + px / 2 - 8 : xOf(ts.start);
        const y2 = ti * ROW + ROW / 2;
        let d: string;
        if (x2 - x1 >= 16) d = `M${x1},${y1} H${x1 + 8} V${y2} H${x2 - 1}`;
        else {
          const mid = y2 + (y2 > y1 ? -ROW / 2 : ROW / 2);
          d = `M${x1},${y1} H${x1 + 8} V${mid} H${x2 - 10} V${y2} H${x2 - 1}`;
        }
        out.push({ id: `${depId}>${t.id}`, d, hot: selected === t.id || selected === depId, x: x2, y: y2 });
      }
    }
    return out;
  });

  function toggleDep(taskId: string, depId: string, on: boolean) {
    editTask(taskId, (t) => {
      t.deps = on ? [...new Set([...t.deps, depId])] : t.deps.filter((d) => d !== depId);
    });
  }

  /* ---------------------------------------------------------------- keys */

  function onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    if (!selected) return;
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      remove(selected);
    } else if (e.key === 'Escape') {
      if (details) details = false;
      else selected = null;
    } else if (e.key === 'Enter') {
      details = true;
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="gantt">
  <div class="bar-row">
    <button class="small" onclick={() => add('task')} title="Add a task after the selected row"><Icon name="Plus" size={15} /> Task</button>
    <button class="small" onclick={() => add('milestone')} title="Add a milestone"><Icon name="Diamond" size={14} /> Milestone</button>
    <button class="small" onclick={() => add('group')} title="Add a group (a phase or an iteration)"><Icon name="FolderPlus" size={15} /> Group</button>
    <span class="sep"></span>
    <button class="icon small" disabled={!selected} onclick={() => selected && edit((g) => void indent(g, selected!))} title="Indent: into the group above" aria-label="Indent"><Icon name="IndentIncrease" size={15} /></button>
    <button class="icon small" disabled={!sel?.parent} onclick={() => selected && edit((g) => void outdent(g, selected!))} title="Outdent: out of its group" aria-label="Outdent"><Icon name="IndentDecrease" size={15} /></button>
    <button class="icon small" disabled={!selected} onclick={() => selected && edit((g) => void moveAmongSiblings(g, selected!, -1))} title="Move up" aria-label="Move up"><Icon name="ArrowUp" size={15} /></button>
    <button class="icon small" disabled={!selected} onclick={() => selected && edit((g) => void moveAmongSiblings(g, selected!, 1))} title="Move down" aria-label="Move down"><Icon name="ArrowDown" size={15} /></button>
    <button class="icon small" disabled={!selected} onclick={() => (details = !details)} title="Details and dependencies (Enter)" aria-label="Details"><Icon name="PanelRight" size={15} /></button>
    <button class="icon small danger" disabled={!selected} onclick={() => selected && remove(selected)} title="Delete (Del)" aria-label="Delete"><Icon name="Trash2" size={15} /></button>
    <span class="sep"></span>
    <div class="seg" role="radiogroup" aria-label="Scale">
      {#each [['day', 'Days'], ['week', 'Weeks'], ['month', 'Months']] as [v, l] (v)}
        <button class:active={data.scale === v} role="radio" aria-checked={data.scale === v} onclick={() => edit((g) => (g.scale = v as GanttData['scale']))}>{l}</button>
      {/each}
    </div>
    <button class="small" onclick={fitScale} title="Choose the scale that shows the whole plan"><Icon name="Maximize" size={14} /> Fit</button>
    <label class="check small"><input type="checkbox" checked={data.showWeekends} onchange={(e) => edit((g) => (g.showWeekends = e.currentTarget.checked))} /> Weekends</label>
    <button class="small" onclick={scrollToToday}><Icon name="CalendarCheck" size={15} /> Today</button>
  </div>

  <div class="scroller" bind:this={scroller} bind:clientWidth={viewW}>
    <div class="sheet" class:tight={exporting} bind:this={sheet} data-export-root style:width="{TABLE_W + timelineW}px">
      <!-- Header -->
      <div class="head" style:height="{HEAD}px">
        <div class="th table-part" style:width="{TABLE_W}px">
          <span style:width="{COLS.name}px" class="c-name">Tarea</span>
          <span style:width="{COLS.start}px">Inicio</span>
          <span style:width="{COLS.end}px">Fin</span>
          {#if COLS.days}<span style:width="{COLS.days}px" class="num">Días</span>{/if}
          <span style:width="{COLS.pct}px" class="num">%</span>
          {#if COLS.owner}<span style:width="{COLS.owner}px">Responsable</span>{/if}
        </div>
        <div class="th-time" style:width="{timelineW}px">
          <div class="band">
            {#each ticks.top as t (t.at)}
              <span class="tick" style:left="{t.at * px}px" style:width="{t.span * px}px">{t.label}</span>
            {/each}
          </div>
          <div class="band lower">
            {#each ticks.bottom as t (t.at)}
              <span class="tick" class:weekend={data.scale === 'day' && data.showWeekends && t.at % 7 >= 5} style:left="{t.at * px}px" style:width="{t.span * px}px">{t.label}</span>
            {/each}
          </div>
        </div>
      </div>

      <!-- Body -->
      <div class="body" style:min-height="{exporting ? rows.length * ROW : Math.max(rows.length, 1) * ROW + ROW}px">
        <div class="table-part rows" style:width="{TABLE_W}px">
          {#each rows as r (r.task.id)}
            {@const t = r.task}
            {@const sp = span(tasks, t)}
            <div class="tr" class:sel={selected === t.id} class:group={t.group} style:height="{ROW}px" onpointerdown={() => (selected = t.id)} role="row" tabindex="-1">
              <span class="c-name" style:width="{COLS.name}px" style:padding-left="{6 + r.depth * 16}px">
                {#if r.hasChildren}
                  <button class="icon small chev" aria-label={collapsed.has(t.id) ? 'Expand' : 'Collapse'} onclick={() => toggleCollapse(t.id)}>
                    <Icon name={collapsed.has(t.id) ? 'ChevronRight' : 'ChevronDown'} size={14} />
                  </button>
                {:else}
                  <span class="mark">
                    {#if t.milestone}<Icon name="Diamond" size={11} />{:else if t.group}<Icon name="Folder" size={12} />{/if}
                  </span>
                {/if}
                <input
                  class="ghost-input cell-in"
                  data-name-input={t.id}
                  type="text"
                  value={t.name}
                  aria-label="Name"
                  oninput={(e) => editTask(t.id, (x) => (x.name = e.currentTarget.value), 'name')}
                />
              </span>
              {#if t.group}
                <span class="ro" style:width="{COLS.start}px">{esDate(sp.start)}</span>
                <span class="ro" style:width="{COLS.end}px">{esDate(sp.end)}</span>
                {#if COLS.days}<span class="ro num" style:width="{COLS.days}px">{durationDays({ ...sp, milestone: false })}</span>{/if}
                <span class="ro num" style:width="{COLS.pct}px">{groupProgress(tasks, t)}</span>
              {:else}
                <span style:width="{COLS.start}px">
                  {#key t.start}<DateField cls="ghost-input cell-in" label="Start" value={t.start} onCommit={(v) => editTask(t.id, (x) => (x.milestone ? setEnd(x, v) : setStart(x, v)))} />{/key}
                </span>
                <span style:width="{COLS.end}px">
                  {#if t.milestone}<span class="ro">—</span>{:else}
                    {#key t.end}<DateField cls="ghost-input cell-in" label="End" value={t.end} onCommit={(v) => editTask(t.id, (x) => setEnd(x, v))} />{/key}
                  {/if}
                </span>
                {#if COLS.days}
                  <span class="num" style:width="{COLS.days}px">
                    {#if t.milestone}<span class="ro">0</span>{:else}
                      <input class="ghost-input cell-in num" type="number" min="1" value={durationDays(t)} aria-label="Duration in days" onchange={(e) => editTask(t.id, (x) => setDuration(x, +e.currentTarget.value || 1))} />
                    {/if}
                  </span>
                {/if}
                <span class="num" style:width="{COLS.pct}px">
                  {#if t.milestone}<span class="ro">—</span>{:else}
                    <input class="ghost-input cell-in num" type="number" min="0" max="100" step="10" value={t.progress} aria-label="Progress" onchange={(e) => editTask(t.id, (x) => (x.progress = Math.max(0, Math.min(100, +e.currentTarget.value || 0))))} />
                  {/if}
                </span>
              {/if}
              {#if COLS.owner}
                <span style:width="{COLS.owner}px">
                  <input class="ghost-input cell-in" type="text" value={t.owner} aria-label="Owner" oninput={(e) => editTask(t.id, (x) => (x.owner = e.currentTarget.value), 'owner')} />
                </span>
              {/if}
            </div>
          {/each}
          {#if !rows.length}
            <div class="tr hint muted small" style:height="{ROW}px" data-no-export>Add a task, a milestone or a group (a PUD phase) with the buttons above.</div>
          {/if}
        </div>

        <div
          class="timeline"
          style:width="{timelineW}px"
          style:--px="{px}px"
          class:weekends={data.showWeekends && data.scale !== 'month'}
          role="presentation"
          onpointerdown={(e) => {
            if (e.target === e.currentTarget) selected = null;
          }}
        >
          {#each ticks.bottom as t (t.at)}
            <span class="vline" style:left="{t.at * px}px"></span>
          {/each}
          {#each rows as r, i (r.task.id)}
            {#if selected === r.task.id}<span class="row-hi" style:top="{i * ROW}px" style:height="{ROW}px"></span>{/if}
          {/each}
          {#if today >= range.start && today < range.end}
            <span class="today" style:left="{xOf(today) + px / 2}px" title="Today"></span>
          {/if}

          <svg class="deps" width={timelineW} height={rows.length * ROW} aria-hidden="true">
            {#each arrows as a (a.id)}
              <path class:hot={a.hot} d={a.d} fill="none" stroke="currentColor" stroke-width="1.4" />
              <polygon class:hot={a.hot} points="{a.x},{a.y} {a.x - 6},{a.y - 4} {a.x - 6},{a.y + 4}" fill="currentColor" />
            {/each}
          </svg>

          {#each rows as r, i (r.task.id)}
            {@const t = r.task}
            {@const sp = span(tasks, t)}
            {@const c = colorOf(t)}
            {@const top = i * ROW}
            {#if t.milestone}
              <div
                class="ms"
                class:sel={selected === t.id}
                style:left="{xOf(sp.start) + px / 2 - 7}px"
                style:top="{top + ROW / 2 - 7}px"
                style:--c={c ?? 'var(--d-ink)'}
                title="{t.name} · {shortDate(sp.start)}"
                role="button"
                tabindex="-1"
                onpointerdown={(e) => onBarDown(e, t)}
                onpointermove={(e) => cursorFor(e, t)}
                ondblclick={() => (details = true)}
              ></div>
              <span class="lbl" style:left="{xOf(sp.start) + px / 2 + 12}px" style:top="{top}px" style:line-height="{ROW}px">{t.name}</span>
            {:else if t.group}
              <div
                class="grp"
                class:sel={selected === t.id}
                style:left="{xOf(sp.start)}px"
                style:width="{Math.max(px, (diffDays(sp.start, sp.end) + 1) * px)}px"
                style:top="{top + 10}px"
                style:--c={c ?? 'var(--d-ink)'}
                title="{t.name} · {shortDate(sp.start)} – {shortDate(sp.end)}"
                role="button"
                tabindex="-1"
                onpointerdown={(e) => onBarDown(e, t)}
                onpointermove={(e) => cursorFor(e, t)}
                ondblclick={() => (details = true)}
              ></div>
            {:else}
              {@const w = Math.max(px, (diffDays(sp.start, sp.end) + 1) * px)}
              <div
                class="task"
                class:sel={selected === t.id}
                class:dragging={drag?.id === t.id}
                style:left="{xOf(sp.start)}px"
                style:width="{w}px"
                style:top="{top + 7}px"
                style:height="{ROW - 14}px"
                style:--c={c ?? '#6c737a'}
                title="{t.name} · {shortDate(sp.start)} – {shortDate(sp.end)} · {t.progress}%"
                role="button"
                tabindex="-1"
                onpointerdown={(e) => onBarDown(e, t)}
                onpointermove={(e) => cursorFor(e, t)}
                ondblclick={() => (details = true)}
              >
                <span class="fill" style:width="{t.progress}%"></span>
              </div>
              {#if t.owner}
                <span class="lbl owner" style:left="{xOf(sp.start) + w + 6}px" style:top="{top}px" style:line-height="{ROW}px">{initials(t.owner)}</span>
              {/if}
            {/if}
          {/each}
        </div>
      </div>
    </div>
  </div>

  {#if details && sel}
    {@const sp = span(data.tasks, sel)}
    <aside class="inspector float arrive" style:top="54px" aria-label="Task details">
      <div class="inspector-head">
        <Icon name={sel.group ? 'Folder' : sel.milestone ? 'Diamond' : 'ChartGantt'} size={16} />
        <strong class="spacer">{sel.group ? 'Group' : sel.milestone ? 'Milestone' : 'Task'}</strong>
        <button class="icon small danger" aria-label="Delete" title="Delete" onclick={() => remove(sel.id)}><Icon name="Trash2" size={15} /></button>
        <button class="icon" aria-label="Close" onclick={() => (details = false)}><Icon name="X" size={16} /></button>
      </div>
      <div class="inspector-body">
        <label class="field">Name <input type="text" value={sel.name} oninput={(e) => editTask(sel.id, (x) => (x.name = e.currentTarget.value), 'name')} /></label>
        {#if sel.group}
          <p class="small muted">{shortDate(sp.start)} – {shortDate(sp.end)} · spans what's inside it · {groupProgress(data.tasks, sel)}% done</p>
        {:else}
          <div class="two">
            <label class="field">{sel.milestone ? 'Date' : 'Start'} {#key sel.start}<DateField label={sel.milestone ? 'Date' : 'Start'} value={sel.start} onCommit={(v) => editTask(sel.id, (x) => (x.milestone ? setEnd(x, v) : setStart(x, v)))} />{/key}</label>
            {#if !sel.milestone}
              <label class="field">End {#key sel.end}<DateField label="End" value={sel.end} onCommit={(v) => editTask(sel.id, (x) => setEnd(x, v))} />{/key}</label>
            {/if}
          </div>
          {#if !sel.milestone}
            <label class="field">Progress · {sel.progress}% <input type="range" min="0" max="100" step="5" value={sel.progress} oninput={(e) => editTask(sel.id, (x) => (x.progress = +e.currentTarget.value), 'progress')} /></label>
          {/if}
          <label class="check small"><input type="checkbox" checked={sel.milestone} onchange={(e) => editTask(sel.id, (x) => { x.milestone = e.currentTarget.checked; if (x.milestone) x.end = x.start; else x.end = addDays(x.start, 4); })} /> Milestone</label>
        {/if}
        <label class="field">Owner <input type="text" value={sel.owner} oninput={(e) => editTask(sel.id, (x) => (x.owner = e.currentTarget.value), 'owner')} /></label>
        <div class="stack tight">
          <span class="sect">Colour</span>
          <Swatches value={sel.color} onPick={(hex) => editTask(sel.id, (x) => (x.color = hex))} />
          {#if !sel.color && sel.parent}<span class="tiny muted">Without a colour it takes its group's.</span>{/if}
        </div>
        <div class="stack tight">
          <span class="sect">Starts after (finish → start)</span>
          {#each data.tasks.filter((x) => x.id !== sel.id && !x.group) as other (other.id)}
            {@const on = sel.deps.includes(other.id)}
            {@const blocked = !on && wouldCycle(data.tasks, other.id, sel.id)}
            <label class="check small" class:muted={blocked} title={blocked ? 'Would make a loop' : ''}>
              <input type="checkbox" checked={on} disabled={blocked} onchange={(e) => toggleDep(sel.id, other.id, e.currentTarget.checked)} />
              {other.name}
            </label>
          {:else}
            <span class="small muted">No other tasks yet.</span>
          {/each}
        </div>
      </div>
    </aside>
  {/if}
</div>

<style>
  .gantt {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    background: var(--paper);
  }
  .bar-row {
    flex: none;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 6px var(--sp-3);
    border-bottom: 1px solid var(--line);
    background: var(--panel);
    flex-wrap: wrap;
  }
  .bar-row .sep {
    width: 1px;
    height: 20px;
    margin: 0 6px;
    background: var(--line);
  }
  .bar-row .check {
    margin: 0 var(--sp-2);
  }
  .scroller {
    flex: 1;
    overflow: auto;
    position: relative;
  }
  .sheet {
    position: relative;
    display: flex;
    flex-direction: column;
    min-height: 100%;
  }
  /* Exported image: as tall as the rows, nothing stretched to the window. */
  .sheet.tight,
  .sheet.tight .rows,
  .sheet.tight .timeline {
    min-height: 0;
  }
  .sheet.tight .body {
    flex: none;
  }
  :global(html.exporting) .chev {
    visibility: hidden;
  }
  .head {
    position: sticky;
    top: 0;
    z-index: 4;
    display: flex;
    background: var(--panel);
    border-bottom: 1px solid var(--line);
  }
  .table-part {
    position: sticky;
    left: 0;
    z-index: 3;
    background: var(--panel);
    border-right: 1px solid var(--line);
    flex: none;
  }
  .th {
    display: flex;
    align-items: flex-end;
    padding-bottom: 6px;
    font-size: var(--fs-xs);
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .th > span {
    padding: 0 8px;
  }
  .th .c-name {
    padding-left: 14px;
  }
  .num {
    text-align: right;
  }
  .th-time {
    position: relative;
    flex: none;
  }
  .band {
    position: relative;
    height: 24px;
  }
  .band.lower {
    border-top: 1px solid var(--line);
  }
  .tick {
    position: absolute;
    top: 0;
    height: 100%;
    padding: 0 6px;
    font-size: var(--fs-xs);
    line-height: 24px;
    color: var(--ink-2);
    white-space: nowrap;
    overflow: hidden;
    border-left: 1px solid var(--line);
  }
  .band.lower .tick {
    color: var(--muted);
  }
  .tick.weekend {
    color: var(--faint);
  }
  .body {
    position: relative;
    display: flex;
    flex: 1 0 auto;
  }
  .rows {
    min-height: 100%;
  }
  .tr {
    display: flex;
    align-items: center;
    border-bottom: 1px solid color-mix(in srgb, var(--line) 55%, transparent);
    font-size: var(--fs-sm);
  }
  .tr > span {
    display: flex;
    align-items: center;
    min-width: 0;
    padding: 0 2px;
  }
  .tr.sel {
    background: color-mix(in srgb, var(--accent) 10%, var(--panel));
  }
  .tr.group {
    font-weight: 700;
  }
  .tr.hint {
    padding: 0 var(--sp-3);
  }
  .c-name {
    gap: 2px;
  }
  .chev {
    flex: none;
    width: 20px !important;
    height: 20px !important;
  }
  .mark {
    flex: none;
    width: 20px;
    display: inline-grid;
    place-items: center;
    color: var(--muted);
  }
  .cell-in {
    width: 100%;
    min-width: 0;
    height: 26px;
    font-size: var(--fs-sm) !important;
    font-weight: inherit;
  }
  /* Atkinson Hyperlegible slashes its zero ("2026" reads "2Ø26"): figures use the system face. */
  .gantt :global(.date-field),
  .ro,
  .cell-in.num,
  .tick,
  .th .num {
    font-family: system-ui, sans-serif;
  }
  .cell-in:global(.date-field) {
    padding: 2px 4px !important;
  }
  /* While an image is captured: no selection, hover or "today" marks in the picture. */
  :global(html.exporting) .tr.sel,
  :global(html.no-motion) .tr.sel {
    background: transparent;
  }
  :global(html.exporting) .row-hi,
  :global(html.no-motion) .row-hi,
  :global(html.exporting) .today,
  :global(html.no-motion) .today {
    display: none;
  }
  :global(html.exporting) .sel,
  :global(html.no-motion) .sel {
    outline: none !important;
    box-shadow: none !important;
  }
  :global(html.exporting) .deps path.hot,
  :global(html.no-motion) .deps path.hot {
    stroke: var(--faint);
  }
  :global(html.exporting) .deps polygon.hot,
  :global(html.no-motion) .deps polygon.hot {
    fill: var(--faint);
  }
  :global(html.exporting) .ghost-input,
  :global(html.no-motion) .ghost-input {
    border-color: transparent !important;
    background: transparent !important;
  }
  .cell-in.num {
    padding: 2px 3px !important;
    text-align: right;
    appearance: textfield;
    -moz-appearance: textfield;
  }
  .cell-in.num::-webkit-inner-spin-button,
  .cell-in.num::-webkit-outer-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .ro {
    padding: 0 8px !important;
    color: var(--muted);
    font-weight: 400;
    justify-content: flex-end;
  }
  .ro:not(.num) {
    justify-content: flex-start;
  }

  /* Timeline */
  .timeline {
    position: relative;
    flex: none;
    min-height: 100%;
    /* Dependency arrows use currentColor, so they survive image export. */
    color: var(--faint);
  }
  .timeline.weekends {
    background-image: linear-gradient(to right, transparent calc(var(--px) * 5), color-mix(in srgb, var(--ink) 4.5%, transparent) calc(var(--px) * 5));
    background-size: calc(var(--px) * 7) 100%;
  }
  .vline {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 1px;
    background: color-mix(in srgb, var(--line) 70%, transparent);
    pointer-events: none;
  }
  .row-hi {
    position: absolute;
    left: 0;
    right: 0;
    background: color-mix(in srgb, var(--accent) 7%, transparent);
    pointer-events: none;
  }
  .today {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    margin-left: -1px;
    background: var(--danger);
    opacity: 0.7;
    pointer-events: none;
    z-index: 1;
  }
  .deps {
    position: absolute;
    left: 0;
    top: 0;
    overflow: visible;
    pointer-events: none;
    z-index: 1;
  }
  .deps path {
    fill: none;
    stroke: var(--faint);
    stroke-width: 1.4;
  }
  .deps polygon {
    fill: var(--faint);
  }
  .deps path.hot {
    stroke: var(--ink);
  }
  .deps polygon.hot {
    fill: var(--ink);
  }
  .task {
    position: absolute;
    z-index: 2;
    border-radius: 4px;
    background: color-mix(in srgb, var(--c) 38%, var(--panel));
    border: 1px solid color-mix(in srgb, var(--c) 75%, var(--ink));
    overflow: hidden;
    touch-action: none;
    cursor: grab;
  }
  .task .fill {
    position: absolute;
    inset: 0 auto 0 0;
    background: var(--c);
    pointer-events: none;
  }
  .task.sel,
  .grp.sel,
  .ms.sel {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .task.dragging {
    opacity: 0.85;
    cursor: grabbing;
  }
  .grp {
    position: absolute;
    z-index: 2;
    height: 8px;
    background: var(--c);
    border-radius: 2px;
    touch-action: none;
    cursor: grab;
  }
  .grp::before,
  .grp::after {
    content: '';
    position: absolute;
    top: 100%;
    border-top: 6px solid var(--c);
  }
  .grp::before {
    left: 0;
    border-right: 6px solid transparent;
  }
  .grp::after {
    right: 0;
    border-left: 6px solid transparent;
  }
  .ms {
    position: absolute;
    z-index: 2;
    width: 14px;
    height: 14px;
    background: var(--c);
    transform: rotate(45deg);
    border-radius: 2px;
    touch-action: none;
    cursor: grab;
  }
  .lbl {
    position: absolute;
    z-index: 2;
    font-size: var(--fs-xs);
    color: var(--ink-2);
    white-space: nowrap;
    pointer-events: none;
  }
  .lbl.owner {
    color: var(--muted);
    font-weight: 700;
  }
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-2);
  }
  .tight {
    gap: var(--sp-2);
  }
</style>
