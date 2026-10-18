/**
 * Gantt maths: dates (ISO YYYY-MM-DD, whole days, UTC so no DST surprises),
 * which rows are visible, group spans, the timeline scale and header ticks,
 * and the edits (move, resize, indent…) as pure functions on GanttData.
 * No Svelte here — tests/gantt.test.ts covers it.
 */
import type { GanttData, GanttTask } from '../../model/types';

const DAY = 86_400_000;

/* ------------------------------------------------------------------ dates */

/** "2026-10-19" → ms at UTC midnight. Invalid input → NaN. */
export function parseDay(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}

export function fmtDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function addDays(iso: string, n: number): string {
  return fmtDay(parseDay(iso) + n * DAY);
}

/** Whole days from a to b (b − a). */
export function diffDays(a: string, b: string): number {
  return Math.round((parseDay(b) - parseDay(a)) / DAY);
}

/** Inclusive length: a task from Mon to Fri lasts 5 days; a milestone lasts 0. */
export function durationDays(t: Pick<GanttTask, 'start' | 'end' | 'milestone'>): number {
  if (t.milestone) return 0;
  return Math.max(1, diffDays(t.start, t.end) + 1);
}

export function isWeekend(iso: string): boolean {
  const d = new Date(parseDay(iso)).getUTCDay();
  return d === 0 || d === 6;
}

/** Monday of the week containing `iso`. */
export function mondayOf(iso: string): string {
  const d = new Date(parseDay(iso)).getUTCDay(); // 0 = Sunday
  return addDays(iso, -((d + 6) % 7));
}

/** ISO 8601 week number. */
export function isoWeek(iso: string): number {
  const ms = parseDay(iso);
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7;
  const thursday = ms + (3 - day) * DAY;
  const yearStart = Date.UTC(new Date(thursday).getUTCFullYear(), 0, 1);
  return 1 + Math.floor((thursday - yearStart) / DAY / 7);
}

/** Today in local time, as ISO. */
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTHS_ES_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function monthShort(iso: string): string {
  return MONTHS_ES[new Date(parseDay(iso)).getUTCMonth()];
}

/** "19/10/2026" — how dates are written in Spain. */
export function esDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/** "19/10/2026", "19-10-26", "2026-10-19" → "2026-10-19"; anything else → null. */
export function parseEsDate(text: string): string | null {
  const s = text.trim();
  const ymd = (y: number, mo: number, d: number): string | null => {
    const dt = new Date(Date.UTC(y, mo - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return ymd(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2}|\d{4}))?$/.exec(s);
  if (m) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear();
    return ymd(y, +m[2], +m[1]);
  }
  return null;
}

/** "19 oct" */
export function shortDate(iso: string): string {
  const d = new Date(parseDay(iso));
  return `${d.getUTCDate()} ${MONTHS_ES[d.getUTCMonth()]}`;
}

/* ------------------------------------------------------------------- tree */

export interface Row {
  task: GanttTask;
  depth: number;
  /** Group with children (shows the collapse chevron). */
  hasChildren: boolean;
}

/** Children of `parentId` (undefined = top level), in array order. Orphans (parent missing) count as top level. */
export function childrenOf(tasks: GanttTask[], parentId: string | undefined): GanttTask[] {
  const ids = new Set(tasks.map((t) => t.id));
  return tasks.filter((t) => (parentId === undefined ? !t.parent || !ids.has(t.parent) : t.parent === parentId));
}

/** Every descendant id of a group (not including itself). */
export function descendants(tasks: GanttTask[], id: string): string[] {
  const out: string[] = [];
  const walk = (pid: string, seen: Set<string>) => {
    for (const c of tasks) {
      if (c.parent === pid && !seen.has(c.id)) {
        seen.add(c.id);
        out.push(c.id);
        walk(c.id, seen);
      }
    }
  };
  walk(id, new Set([id]));
  return out;
}

/** Rows in display order: depth-first, children right under their group, collapsed groups hide theirs. */
export function visibleRows(tasks: GanttTask[], collapsed: Set<string> = new Set()): Row[] {
  const rows: Row[] = [];
  const seen = new Set<string>();
  const walk = (parentId: string | undefined, depth: number) => {
    for (const t of childrenOf(tasks, parentId)) {
      if (seen.has(t.id)) continue;
      seen.add(t.id);
      const kids = tasks.some((c) => c.parent === t.id);
      rows.push({ task: t, depth, hasChildren: kids });
      if (kids && !collapsed.has(t.id)) walk(t.id, depth + 1);
    }
  };
  walk(undefined, 0);
  return rows;
}

/** The dates a task is drawn with: a group spans its descendants (its own dates if it has none). */
export function span(tasks: GanttTask[], t: GanttTask): { start: string; end: string } {
  if (!t.group) return { start: t.start, end: t.end };
  const kids = descendants(tasks, t.id)
    .map((id) => tasks.find((x) => x.id === id)!)
    .filter((k) => !k.group && !Number.isNaN(parseDay(k.start)) && !Number.isNaN(parseDay(k.end)));
  if (!kids.length) return { start: t.start, end: t.end };
  let s = kids[0].start;
  let e = kids[0].end;
  for (const k of kids) {
    if (k.start < s) s = k.start;
    if (k.end > e) e = k.end;
  }
  return { start: s, end: e };
}

/** A group's progress: children weighted by duration. */
export function groupProgress(tasks: GanttTask[], t: GanttTask): number {
  if (!t.group) return t.progress;
  const kids = descendants(tasks, t.id)
    .map((id) => tasks.find((x) => x.id === id)!)
    .filter((k) => !k.group && !k.milestone);
  if (!kids.length) return t.progress;
  let total = 0;
  let done = 0;
  for (const k of kids) {
    const d = durationDays(k);
    total += d;
    done += (d * k.progress) / 100;
  }
  return total ? Math.round((done / total) * 100) : 0;
}

/* --------------------------------------------------------------- timeline */

export type Scale = GanttData['scale'];

export const PX_PER_DAY: Record<Scale, number> = { day: 30, week: 16, month: 5 };

export interface Range {
  start: string;
  /** Exclusive end (first day after the timeline). */
  end: string;
  days: number;
}

/** Days shown: every task plus today, padded, and snapped to whole weeks / months. */
export function timelineRange(tasks: GanttTask[], scale: Scale, today: string): Range {
  const dates: string[] = [today];
  for (const t of tasks) {
    if (!Number.isNaN(parseDay(t.start))) dates.push(t.start);
    if (!Number.isNaN(parseDay(t.end))) dates.push(t.end);
  }
  dates.sort();
  let start = addDays(dates[0], -3);
  let end = addDays(dates[dates.length - 1], 8);
  if (scale === 'week' || scale === 'day') {
    start = mondayOf(start);
    end = addDays(mondayOf(end), 7);
  } else {
    const s = new Date(parseDay(start));
    start = fmtDay(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1));
    const e = new Date(parseDay(end));
    end = fmtDay(Date.UTC(e.getUTCFullYear(), e.getUTCMonth() + 1, 1));
  }
  // At least a comfortable width even for a one-task chart.
  const minDays = scale === 'day' ? 28 : scale === 'week' ? 70 : 180;
  if (diffDays(start, end) < minDays) end = addDays(start, minDays);
  return { start, end, days: diffDays(start, end) };
}

/**
 * The plan's own range, for exported images: from the first task to the
 * last plus about one scale unit either side (whole months at month scale),
 * with no padding to fill a screen and no "today".
 */
export function planRange(tasks: GanttTask[], scale: Scale, today: string): Range {
  const dates: string[] = [];
  for (const t of tasks) {
    if (!Number.isNaN(parseDay(t.start))) dates.push(t.start);
    if (!Number.isNaN(parseDay(t.end))) dates.push(t.end);
  }
  if (!dates.length) dates.push(today);
  dates.sort();
  const first = dates[0];
  const last = dates[dates.length - 1];
  let start: string;
  let end: string;
  if (scale === 'day') {
    start = addDays(first, -1);
    end = addDays(last, 2);
  } else if (scale === 'week') {
    start = addDays(mondayOf(first), -7);
    end = addDays(mondayOf(last), 14);
  } else {
    const s = new Date(parseDay(first));
    start = fmtDay(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), 1));
    const e = new Date(parseDay(last));
    end = fmtDay(Date.UTC(e.getUTCFullYear(), e.getUTCMonth() + 1, 1));
  }
  return { start, end, days: diffDays(start, end) };
}

export interface Tick {
  /** Day offset from the range start. */
  at: number;
  /** Width in days. */
  span: number;
  label: string;
}

/** Two header bands: `top` (months, or years at month scale) and `bottom` (days / weeks / months). */
export function headerTicks(range: Range, scale: Scale): { top: Tick[]; bottom: Tick[] } {
  const top: Tick[] = [];
  const bottom: Tick[] = [];
  // Top band: calendar months (month scale: years).
  let cur = range.start;
  while (cur < range.end) {
    const d = new Date(parseDay(cur));
    const next =
      scale === 'month' ? fmtDay(Date.UTC(d.getUTCFullYear() + 1, 0, 1)) : fmtDay(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    const stop = next < range.end ? next : range.end;
    top.push({
      at: diffDays(range.start, cur),
      span: diffDays(cur, stop),
      label: scale === 'month' ? String(d.getUTCFullYear()) : `${MONTHS_ES_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`
    });
    cur = stop;
  }
  // Bottom band.
  if (scale === 'day') {
    for (let i = 0; i < range.days; i++) {
      const iso = addDays(range.start, i);
      bottom.push({ at: i, span: 1, label: String(new Date(parseDay(iso)).getUTCDate()) });
    }
  } else if (scale === 'week') {
    for (let i = 0; i < range.days; i += 7) {
      const iso = addDays(range.start, i);
      bottom.push({ at: i, span: Math.min(7, range.days - i), label: `S${isoWeek(iso)} · ${shortDate(iso)}` });
    }
  } else {
    cur = range.start;
    while (cur < range.end) {
      const d = new Date(parseDay(cur));
      const next = fmtDay(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
      const stop = next < range.end ? next : range.end;
      bottom.push({ at: diffDays(range.start, cur), span: diffDays(cur, stop), label: MONTHS_ES[d.getUTCMonth()] });
      cur = stop;
    }
  }
  return { top, bottom };
}

/* ------------------------------------------------------------------ edits */

/** Shift a task (and, for a group, everything under it) by `days`. */
export function moveTask(data: GanttData, id: string, days: number): void {
  if (!days) return;
  const ids = new Set([id, ...descendants(data.tasks, id)]);
  for (const t of data.tasks) {
    if (!ids.has(t.id)) continue;
    t.start = addDays(t.start, days);
    t.end = addDays(t.end, days);
  }
}

/** Move one edge; never shorter than one day. Milestones only move. */
export function resizeTask(data: GanttData, id: string, edge: 'start' | 'end', days: number): void {
  const t = data.tasks.find((x) => x.id === id);
  if (!t || !days || t.milestone || t.group) return;
  if (edge === 'start') {
    const next = addDays(t.start, days);
    t.start = next > t.end ? t.end : next;
  } else {
    const next = addDays(t.end, days);
    t.end = next < t.start ? t.start : next;
  }
}

/** Set the inclusive duration in days by moving the end. */
export function setDuration(t: GanttTask, days: number): void {
  if (t.milestone) {
    t.end = t.start;
    return;
  }
  t.end = addDays(t.start, Math.max(1, Math.round(days)) - 1);
}

/** Set the start, keeping the duration. */
export function setStart(t: GanttTask, iso: string): void {
  if (Number.isNaN(parseDay(iso))) return;
  const len = diffDays(t.start, t.end);
  t.start = iso;
  t.end = addDays(iso, Math.max(0, len));
}

/** Set the end; a start after it is pulled back. */
export function setEnd(t: GanttTask, iso: string): void {
  if (Number.isNaN(parseDay(iso))) return;
  t.end = iso;
  if (t.start > iso) t.start = iso;
  if (t.milestone) t.start = iso;
}

/**
 * Indent: the task goes into the nearest group above it (in display order)
 * that sits at its own level. Returns false when there is none.
 */
export function indent(data: GanttData, id: string): boolean {
  const rows = visibleRows(data.tasks);
  const i = rows.findIndex((r) => r.task.id === id);
  if (i < 0) return false;
  const me = rows[i];
  for (let j = i - 1; j >= 0; j--) {
    const r = rows[j];
    if (r.depth < me.depth) return false;
    if (r.depth === me.depth && r.task.group) {
      me.task.parent = r.task.id;
      // Keep it last among the new siblings: move it after the group's last descendant in the array.
      placeAfterSubtree(data, me.task.id, r.task.id);
      return true;
    }
  }
  return false;
}

/** Outdent: one level up (out of its group, right after that group). */
export function outdent(data: GanttData, id: string): boolean {
  const t = data.tasks.find((x) => x.id === id);
  if (!t?.parent) return false;
  const parent = data.tasks.find((x) => x.id === t.parent);
  t.parent = parent?.parent;
  if (parent) placeAfterSubtree(data, t.id, parent.id);
  return true;
}

/** Array surgery so `id` (with its own subtree) comes right after `anchor`'s whole subtree. */
function placeAfterSubtree(data: GanttData, id: string, anchor: string): void {
  const moving = new Set([id, ...descendants(data.tasks, id)]);
  const block = data.tasks.filter((t) => moving.has(t.id));
  const rest = data.tasks.filter((t) => !moving.has(t.id));
  const anchorSet = new Set([anchor, ...descendants(rest, anchor)]);
  let at = -1;
  rest.forEach((t, i) => {
    if (anchorSet.has(t.id)) at = i;
  });
  rest.splice(at + 1, 0, ...block);
  data.tasks.splice(0, data.tasks.length, ...rest);
}

/** Swap with the previous / next sibling (same parent), carrying subtrees along. */
export function moveAmongSiblings(data: GanttData, id: string, dir: -1 | 1): boolean {
  const t = data.tasks.find((x) => x.id === id);
  if (!t) return false;
  const sibs = childrenOf(data.tasks, t.parent);
  const i = sibs.findIndex((s) => s.id === id);
  const j = i + dir;
  if (j < 0 || j >= sibs.length) return false;
  // Down: this block goes after the next sibling's. Up: the previous sibling's block goes after this one.
  if (dir === 1) placeAfterSubtree(data, id, sibs[j].id);
  else placeAfterSubtree(data, sibs[j].id, id);
  return true;
}

/** Remove a task (a group takes its subtree along) and every dependency on it. */
export function removeTask(data: GanttData, id: string): void {
  const gone = new Set([id, ...descendants(data.tasks, id)]);
  data.tasks = data.tasks.filter((t) => !gone.has(t.id));
  for (const t of data.tasks) t.deps = t.deps.filter((d) => !gone.has(d));
}

/**
 * Finish-to-start rule: no task starts before its prerequisites are done.
 * Anything that would is pushed later (keeping its length; a group takes
 * its subtree along), and the push cascades down the chain. Returns the ids
 * that moved.
 */
export function enforceDeps(data: GanttData): string[] {
  const moved = new Set<string>();
  for (let pass = 0; pass < data.tasks.length + 2; pass++) {
    let changed = false;
    for (const t of data.tasks) {
      if (!t.deps.length) continue;
      const need = t.deps
        .map((d) => data.tasks.find((x) => x.id === d))
        .filter((d): d is GanttTask => !!d && !descendants(data.tasks, d.id).includes(t.id) && !descendants(data.tasks, t.id).includes(d.id))
        .map((d) => earliestAfter(data.tasks, d))
        .sort()
        .at(-1);
      if (!need) continue;
      const start = t.group ? span(data.tasks, t).start : t.start;
      const lag = diffDays(start, need);
      if (lag > 0) {
        moveTask(data, t.id, lag);
        moved.add(t.id);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return [...moved];
}

/** Skip a Saturday / Sunday start: the next Monday. */
export function nextWorkday(iso: string): string {
  const d = new Date(parseDay(iso)).getUTCDay();
  return d === 6 ? addDays(iso, 2) : d === 0 ? addDays(iso, 1) : iso;
}

/**
 * Where a new row goes and when it starts.
 *  - a group (phase) is always top level, right after the selected row's top-level group;
 *  - a task / milestone goes into the selected group, or beside the selected row,
 *    starting the day after the previous sibling ends (or at its group's start).
 */
export function placeNew(data: GanttData, kind: 'task' | 'milestone' | 'group', selectedId: string | null, today: string): { parent: string | undefined; index: number; start: string } {
  const sel = selectedId ? data.tasks.find((t) => t.id === selectedId) : undefined;
  const after = (anchorId: string) => {
    const block = new Set([anchorId, ...descendants(data.tasks, anchorId)]);
    let at = data.tasks.length;
    data.tasks.forEach((x, i) => {
      if (block.has(x.id)) at = i + 1;
    });
    return at;
  };
  const weekly = data.scale !== 'day';
  const fix = (iso: string) => (weekly ? nextWorkday(iso) : iso);
  if (kind === 'group') {
    let top = sel;
    const seen = new Set<string>();
    while (top?.parent && !seen.has(top.id)) {
      seen.add(top.id);
      top = data.tasks.find((x) => x.id === top!.parent);
    }
    const index = top ? after(top.id) : data.tasks.length;
    const lastTop = top ?? childrenOf(data.tasks, undefined).at(-1);
    const start = lastTop ? fix(addDays(span(data.tasks, lastTop).end, 1)) : mondayOf(today);
    return { parent: undefined, index, start };
  }
  const parent = sel ? (sel.group ? sel.id : sel.parent) : undefined;
  let start: string;
  if (sel && !sel.group) start = fix(addDays(sel.end, 1));
  else if (sel?.group) {
    const kids = childrenOf(data.tasks, sel.id);
    const last = kids.at(-1);
    start = last ? fix(addDays(span(data.tasks, last).end, 1)) : sel.start;
  } else {
    const last = childrenOf(data.tasks, undefined).at(-1);
    start = last ? fix(addDays(span(data.tasks, last).end, 1)) : mondayOf(today);
  }
  const index = sel ? after(sel.id) : data.tasks.length;
  return { parent, index, start };
}

/** Would `from` → `to` (to depends on from) create a cycle? */
export function wouldCycle(tasks: GanttTask[], from: string, to: string): boolean {
  if (from === to) return true;
  // Cycle if `to` is already (transitively) a prerequisite of `from`.
  const stack = [from];
  const seen = new Set<string>();
  while (stack.length) {
    const cur = stack.pop()!;
    if (cur === to) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    const t = tasks.find((x) => x.id === cur);
    if (t) stack.push(...t.deps);
  }
  return false;
}

/* ---------------------------------------------------------------- exports */

function mermaidText(s: string): string {
  return s.replace(/[:;#]/g, (c) => (c === ':' ? ' -' : c === ';' ? ',' : '')).replace(/\s+/g, ' ').trim() || 'Tarea';
}

/** Where a dependent may start at the earliest, given one prerequisite (finish-to-start). */
function earliestAfter(tasks: GanttTask[], dep: GanttTask): string {
  const end = dep.group ? span(tasks, dep).end : dep.end;
  return dep.milestone ? end : addDays(end, 1);
}

/**
 * Mermaid `gantt` source. Groups become sections (nested ones joined with
 * " / "); every task has an explicit start and an exclusive end date, so the
 * chart matches the editor exactly whether or not weekends are excluded.
 * A task that starts right after all its prerequisites is written as
 * `after tX tY`, which is how Mermaid draws finish-to-start dependencies.
 */
export function toMermaid(title: string, data: GanttData): string {
  const out = ['gantt', `  title ${mermaidText(title)}`, '  dateFormat YYYY-MM-DD', '  axisFormat %d %b'];
  if (!data.showWeekends) out.push('  excludes weekends');
  const ids = new Map<string, string>();
  data.tasks.forEach((t, i) => ids.set(t.id, `t${i + 1}`));
  const byId = new Map(data.tasks.map((t) => [t.id, t]));
  const pathOf = (t: GanttTask): string[] => {
    const p: string[] = [];
    let cur = byId.get(t.parent ?? '');
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      p.unshift(mermaidText(cur.name));
      cur = byId.get(cur.parent ?? '');
    }
    return p;
  };
  let section: string | null = null;
  for (const r of visibleRows(data.tasks)) {
    const t = r.task;
    if (t.group) continue;
    const sec = pathOf(t).join(' / ');
    if (sec !== section) {
      if (sec) out.push(`  section ${sec}`);
      else if (section !== null) out.push('  section General');
      section = sec;
    }
    const tags: string[] = [];
    if (t.milestone) tags.push('milestone');
    else if (t.progress >= 100) tags.push('done');
    else if (t.progress > 0) tags.push('active');
    tags.push(ids.get(t.id)!);
    // `after` only for prerequisites Mermaid knows (tasks, not sections) and only when it lands on the real start.
    const deps = t.deps.map((d) => byId.get(d)).filter((d): d is GanttTask => !!d && !d.group);
    const latest = deps.length ? deps.map((d) => earliestAfter(data.tasks, d)).sort().at(-1)! : null;
    const useAfter = deps.length > 0 && deps.length === t.deps.length && latest === t.start;
    tags.push(useAfter ? `after ${deps.map((d) => ids.get(d.id)).join(' ')}` : t.start);
    tags.push(t.milestone ? '0d' : addDays(t.end, 1));
    out.push(`  ${mermaidText(t.name)} :${tags.join(', ')}`);
  }
  return out.join('\n') + '\n';
}

function csvCell(v: string | number): string {
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV for a spreadsheet in Spanish: `;` between fields and a UTF-8 BOM, as Excel in es-ES expects. */
export function toCsv(data: GanttData): string {
  const name = (id?: string) => data.tasks.find((t) => t.id === id)?.name ?? '';
  const lines = [['Nombre', 'Tipo', 'Inicio', 'Fin', 'Duración (días)', 'Progreso (%)', 'Responsable', 'Grupo', 'Depende de'].join(';')];
  for (const r of visibleRows(data.tasks)) {
    const t = r.task;
    const sp = span(data.tasks, t);
    lines.push(
      [
        t.name,
        t.group ? 'Grupo' : t.milestone ? 'Hito' : 'Tarea',
        esDate(sp.start),
        esDate(sp.end),
        t.group ? durationDays({ ...sp, milestone: false }) : durationDays(t),
        t.group ? groupProgress(data.tasks, t) : t.progress,
        t.owner,
        name(t.parent),
        t.deps.map(name).join(', ')
      ]
        .map(csvCell)
        .join(';')
    );
  }
  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}
