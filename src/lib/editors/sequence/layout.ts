/**
 * Sequence diagram geometry. Pure (no Svelte, no DOM) so it can be tested.
 *
 * Columns: one per participant, spaced so heads and message labels fit.
 * Rows: items in order, top to bottom. Activation bars are worked out from
 * the messages when `activations` is on: a synchronous call opens a bar on
 * the callee, a reply closes the replier's innermost bar.
 */
import { noteKind, refOver } from './text';
import type { MessageStyle, ParticipantKind, SeqItem, SequenceData } from '../../model/types';

export const FONT = 13;
export const SMALL = 12;
const MARGIN = 24;
const OBJ_H = 36;
const GLYPH_H = 64;
const BAR_W = 10;
const BAR_STEP = 5;
const MIN_GAP = 140;
const ROW = 36;
const SELF_W = 36;
const SELF_H = 20;

/** Rough text width for Atkinson Hyperlegible; layout only needs to be close. */
export function textWidth(s: string, size = FONT): number {
  let w = 0;
  for (const ch of s) w += /[MWmw@%]/.test(ch) ? 0.85 : /[il.,:;'|!()[\]\s]/.test(ch) ? 0.32 : /[A-ZÁÉÍÓÚÑ]/.test(ch) ? 0.68 : 0.56;
  return w * size;
}

export interface HeadBox {
  id: string;
  name: string;
  kind: ParticipantKind;
  /** Centre x of the column. */
  x: number;
  /** Top of the head. */
  y: number;
  w: number;
  h: number;
  /** Drawn where a «create» message reaches it, not at the top. */
  created: boolean;
}

export interface Lifeline {
  id: string;
  x: number;
  y1: number;
  y2: number;
  destroyed: boolean;
}

export interface Activation {
  pid: string;
  x: number;
  y1: number;
  y2: number;
  depth: number;
}

export interface MessageBox {
  itemId: string;
  index: number;
  num: number | null;
  text: string;
  style: MessageStyle;
  x1: number;
  x2: number;
  y: number;
  self: boolean;
  /** Where the label sits (text-anchor middle for normal messages, start for self). */
  labelX: number;
  labelY: number;
  labelAnchor: 'middle' | 'start';
}

export interface FragmentBox {
  itemId: string;
  closeId: string | null;
  op: string;
  guard: string;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  elses: { itemId: string; y: number; guard: string }[];
}

export interface NoteBox {
  itemId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  /** A PlantUML divider (== x ==) or delay (... x ...) drawn across every lifeline. */
  kind?: 'divider' | 'delay';
}

export interface Layout {
  width: number;
  height: number;
  heads: HeadBox[];
  lifelines: Lifeline[];
  activations: Activation[];
  messages: MessageBox[];
  fragments: FragmentBox[];
  notes: NoteBox[];
  /** Vertical band of every item, for hit-testing and highlighting. */
  rows: { itemId: string; y1: number; y2: number }[];
  /** Destroy marks (X) at the end of a lifeline. */
  crosses: { x: number; y: number }[];
  problems: string[];
}

function headSize(name: string, kind: ParticipantKind): { w: number; h: number } {
  const tw = textWidth(name || ' ') + 24;
  if (kind === 'object') return { w: Math.max(80, tw), h: OBJ_H };
  return { w: Math.max(56, tw - 8), h: GLYPH_H };
}

export function layoutSequence(data: SequenceData): Layout {
  const problems: string[] = [];
  const parts = data.participants;
  const index = new Map(parts.map((p, i) => [p.id, i]));
  const sizes = parts.map((p) => headSize(p.name, p.kind));
  const headH = Math.max(OBJ_H, ...sizes.map((s) => s.h));

  // ---------------------------------------------------------------- columns
  const gaps: number[] = [];
  for (let i = 0; i < parts.length - 1; i++) gaps.push(Math.max(MIN_GAP, (sizes[i].w + sizes[i + 1].w) / 2 + 30));
  const valid = data.items.filter((it) => {
    if (it.t !== 'msg') return true;
    const ok = index.has(it.from) && index.has(it.to);
    if (!ok) problems.push(`A message refers to a participant that no longer exists ("${it.text}").`);
    return ok;
  });
  const msgs = valid.filter((it): it is Extract<SeqItem, { t: 'msg' }> => it.t === 'msg');
  // Labels must fit over their span; widen the last gap of the span when they don't.
  const spans = msgs
    .map((m) => {
      const a = index.get(m.from)!;
      const b = index.get(m.to)!;
      return { lo: Math.min(a, b), hi: Math.max(a, b), w: textWidth(messageLabel(m.text, m.style, 99)) + 30 };
    })
    .sort((p, q) => p.hi - p.lo - (q.hi - q.lo));
  for (const s of spans) {
    if (s.lo === s.hi) {
      // Self message: the label sits to the right of the loop.
      if (s.lo < gaps.length) gaps[s.lo] = Math.max(gaps[s.lo], SELF_W + s.w + 10);
      continue;
    }
    let have = 0;
    for (let i = s.lo; i < s.hi; i++) have += gaps[i];
    if (have < s.w) gaps[s.hi - 1] += s.w - have;
  }
  const xs: number[] = [];
  let cx = 0;
  parts.forEach((_, i) => {
    xs.push(cx);
    cx += gaps[i] ?? 0;
  });

  // ------------------------------------------------------------------- rows
  const top = MARGIN;
  let y = top + headH + 30;
  const createdAt = new Map<string, number>();
  const firstCreate = new Map<string, string>();
  for (const m of msgs) if (m.style === 'create' && !firstCreate.has(m.to)) firstCreate.set(m.to, m.id);

  const stacks = new Map<string, { y1: number; depth: number }[]>(parts.map((p) => [p.id, []]));
  const activations: Activation[] = [];
  const messages: MessageBox[] = [];
  const notes: NoteBox[] = [];
  const rows: Layout['rows'] = [];
  const crosses: Layout['crosses'] = [];
  const destroyedAt = new Map<string, number>();
  const heads: HeadBox[] = [];

  const barX = (pid: string, depth: number) => xs[index.get(pid)!] - BAR_W / 2 + depth * BAR_STEP;
  const topDepth = (pid: string) => (stacks.get(pid)!.length ? stacks.get(pid)!.length - 1 : -1);
  /** Where a line meets participant `pid`, arriving from / leaving towards direction `dir` (+1 = right). */
  const edgeX = (pid: string, dir: number) => {
    const d = topDepth(pid);
    const x = xs[index.get(pid)!];
    if (d < 0) return x;
    return dir > 0 ? x + BAR_W / 2 + d * BAR_STEP : x - BAR_W / 2 + d * BAR_STEP;
  };
  const open = (pid: string, at: number) => {
    const st = stacks.get(pid)!;
    st.push({ y1: at, depth: st.length });
  };
  const close = (pid: string, at: number) => {
    const st = stacks.get(pid)!;
    const bar = st.pop();
    if (bar) activations.push({ pid, x: barX(pid, bar.depth), y1: bar.y1, y2: Math.max(at, bar.y1 + 12), depth: bar.depth });
  };
  const closeAll = (pid: string, at: number) => {
    while (stacks.get(pid)!.length) close(pid, at);
  };

  // Fragments: a stack of open ones; extents are filled in when they close.
  type OpenFrag = FragmentBox & { lo: number; hi: number; selfRight: boolean; nested: number; children: OpenFrag[]; depths: Map<string, number> };
  const fragStack: OpenFrag[] = [];
  const fragments: OpenFrag[] = [];
  const touch = (lo: number, hi: number, selfRight = false) => {
    for (const f of fragStack) {
      f.lo = Math.min(f.lo, lo);
      f.hi = Math.max(f.hi, hi);
      if (selfRight && hi === f.hi) f.selfRight = true;
    }
  };

  let num = 0;
  valid.forEach((it, i) => {
    const y1 = y;
    switch (it.t) {
      case 'msg': {
        const a = index.get(it.from)!;
        const b = index.get(it.to)!;
        const self = a === b;
        if (destroyedAt.has(it.from) || destroyedAt.has(it.to)) problems.push(`"${it.text}" uses a participant after it was destroyed.`);
        const n = data.autonumber ? ++num : null;
        const label = labelOf(it.text, n);
        const isCreate = it.style === 'create' && firstCreate.get(it.to) === it.id && !self;
        if (isCreate) {
          const s = sizes[b];
          // The head is drawn here, centred on the arrow.
          y += s.h / 2 - 8;
          createdAt.set(it.to, y);
        }
        // The caller is busy while it calls (if it isn't an actor and has no bar yet).
        if (data.activations && it.style === 'sync' && stacks.get(it.from)!.length === 0 && parts[a].kind !== 'actor') open(it.from, y);
        if (self) {
          const x = edgeX(it.from, 1);
          if (data.activations && it.style === 'sync') {
            open(it.from, y + SELF_H - 4);
          }
          const xb = data.activations && it.style === 'sync' ? edgeX(it.from, 1) : x;
          messages.push({ itemId: it.id, index: i, num: n, text: it.text, style: it.style, x1: x, x2: xb, y, self: true, labelX: x + SELF_W + 6, labelY: y - 5, labelAnchor: 'start' });
          touch(a, a, true);
          y += SELF_H;
          if (data.activations && it.style === 'sync') close(it.from, y + 10);
          y += ROW;
        } else {
          const dir = b > a ? 1 : -1;
          const x1 = edgeX(it.from, dir);
          let x2: number;
          if (isCreate) {
            x2 = xs[b] - (dir * sizes[b].w) / 2;
          } else if (it.style === 'sync' && data.activations) {
            open(it.to, y);
            x2 = edgeX(it.to, -dir);
          } else {
            x2 = edgeX(it.to, -dir);
          }
          messages.push({ itemId: it.id, index: i, num: n, text: it.text, style: it.style, x1, x2, y, self: false, labelX: (x1 + x2) / 2, labelY: y - 6, labelAnchor: 'middle' });
          if (it.style === 'reply' && data.activations) close(it.from, y);
          if (it.style === 'destroy') {
            closeAll(it.to, y);
            destroyedAt.set(it.to, y);
            crosses.push({ x: xs[b], y });
          }
          touch(Math.min(a, b), Math.max(a, b));
          y += isCreate ? sizes[b].h / 2 + 22 : ROW;
        }
        break;
      }
      case 'open': {
        y += 6;
        const f: OpenFrag = { itemId: it.id, closeId: null, op: it.op, guard: it.guard, x1: 0, x2: 0, y1: y, y2: y, elses: [], lo: Infinity, hi: -Infinity, selfRight: false, nested: 0, children: [], depths: new Map(parts.map((p) => [p.id, stacks.get(p.id)!.length])) };
        if (fragStack.length) fragStack[fragStack.length - 1].children.push(f);
        fragStack.push(f);
        fragments.push(f);
        // `ref over A, B` spans just those lifelines.
        const span = (refOver(it) ?? []).filter((id) => index.has(id)).map((id) => index.get(id)!);
        if (span.length) touch(Math.min(...span), Math.max(...span));
        y += it.op === 'ref' ? 44 : 34;
        break;
      }
      case 'else': {
        const f = fragStack[fragStack.length - 1];
        if (!f) {
          problems.push('"else" outside a fragment.');
          y += 10;
          break;
        }
        y += 2;
        f.elses.push({ itemId: it.id, y, guard: it.guard });
        // Each operand starts from the state the fragment started in: bars closed
        // in the previous operand come back, bars it opened end here.
        if (data.activations) {
          for (const p of parts) {
            const want = f.depths.get(p.id) ?? 0;
            while (stacks.get(p.id)!.length > want) close(p.id, y);
            while (stacks.get(p.id)!.length < want) open(p.id, y);
          }
        }
        y += 30;
        break;
      }
      case 'close': {
        const f = fragStack.pop();
        if (!f) {
          problems.push('"end" without a fragment to close.');
          y += 10;
          break;
        }
        y += 4;
        f.y2 = y;
        f.closeId = it.id;
        y += 24;
        break;
      }
      case 'note': {
        const nk = noteKind(it.text);
        if (nk !== 'note' && it.over.length === 0) {
          // Dividers and delays run across all lifelines.
          const label = nk === 'divider' ? it.text.replace(/^==\s*|\s*==$/g, '') : it.text.replace(/^\.\.\.\s*|\s*\.\.\.$/g, '');
          const tw = textWidth(label || ' ', SMALL) + 24;
          const left = (xs[0] ?? 0) - 50;
          const right = Math.max((xs[xs.length - 1] ?? 0) + 50, left + tw + 40);
          notes.push({ itemId: it.id, x: left, y: y - 6, w: right - left, h: 24, lines: label ? [label] : [], kind: nk });
          y += 24 + 14;
          break;
        }
        const over = it.over.filter((p) => index.has(p)).map((p) => index.get(p)!);
        const lines = (it.text || ' ').split('\n');
        const tw = Math.max(...lines.map((l) => textWidth(l, SMALL))) + 22;
        const h = lines.length * 16 + 12;
        let x: number;
        let w: number;
        if (over.length === 0) {
          w = Math.max(80, tw);
          x = (xs[0] ?? 0) - w / 2;
        } else {
          const lo = Math.min(...over);
          const hi = Math.max(...over);
          const span = xs[hi] - xs[lo];
          w = Math.max(tw, span + 60, 80);
          x = (xs[lo] + xs[hi]) / 2 - w / 2;
          touch(lo, hi);
        }
        notes.push({ itemId: it.id, x, y: y - 6, w, h, lines });
        y += h + 14;
        break;
      }
    }
    rows.push({ itemId: it.id, y1: y1 - 18, y2: y - 18 });
  });

  // Unclosed fragments end here.
  while (fragStack.length) {
    const f = fragStack.pop()!;
    problems.push(`The "${f.op}" fragment has no "end".`);
    f.y2 = y;
    y += 10;
  }
  y += 16;
  for (const p of parts) closeAll(p.id, y);

  // Fragment extents: around their lifelines, outer ones a little wider than what they hold.
  const depthOf = (f: OpenFrag): number => (f.children.length ? 1 + Math.max(...f.children.map(depthOf)) : 0);
  for (const f of fragments) {
    if (f.lo === Infinity) {
      f.lo = 0;
      f.hi = Math.max(0, parts.length - 1);
    }
    const pad = 22 + depthOf(f) * 12;
    const left = xs[f.lo] ?? 0;
    const right = xs[f.hi] ?? 0;
    const minW = textWidth(`${f.op} [${f.guard}]`, SMALL) + 40;
    f.x1 = left - Math.max(pad + 34, f.op.length * 7.5 + 18 + 8 + 16);
    f.x2 = Math.max(right + pad + 34 + (f.selfRight ? SELF_W + 20 : 0), f.x1 + minW);
  }

  // Heads and lifelines.
  parts.forEach((p, i) => {
    const s = sizes[i];
    const created = createdAt.has(p.id);
    const hy = created ? createdAt.get(p.id)! - s.h / 2 : top + headH - s.h;
    heads.push({ id: p.id, name: p.name, kind: p.kind, x: xs[i], y: hy, w: s.w, h: s.h, created });
  });
  const lifelines: Lifeline[] = heads.map((h) => ({ id: h.id, x: h.x, y1: h.y + h.h, y2: destroyedAt.get(h.id) ?? y, destroyed: destroyedAt.has(h.id) }));

  // Shift everything so the leftmost thing sits at the margin.
  let minX = Infinity;
  let maxX = -Infinity;
  const see = (a: number, b: number) => {
    minX = Math.min(minX, a);
    maxX = Math.max(maxX, b);
  };
  heads.forEach((h) => see(h.x - h.w / 2, h.x + h.w / 2));
  fragments.forEach((f) => see(f.x1, f.x2));
  notes.forEach((n) => see(n.x, n.x + n.w));
  messages.forEach((m) => {
    const lw = textWidth(messageLabel(m.text, m.style, m.num), FONT);
    if (m.self) see(m.x1, m.labelX + lw);
    else see(m.labelX - lw / 2, m.labelX + lw / 2);
  });
  if (minX === Infinity) {
    minX = 0;
    maxX = 0;
  }
  const dx = MARGIN - minX;
  heads.forEach((h) => (h.x += dx));
  lifelines.forEach((l) => (l.x += dx));
  activations.forEach((a) => (a.x += dx));
  messages.forEach((m) => {
    m.x1 += dx;
    m.x2 += dx;
    m.labelX += dx;
  });
  fragments.forEach((f) => {
    f.x1 += dx;
    f.x2 += dx;
  });
  notes.forEach((n) => (n.x += dx));
  crosses.forEach((c) => (c.x += dx));

  return {
    width: Math.ceil(maxX - minX + MARGIN * 2),
    height: Math.ceil(y + MARGIN),
    heads,
    lifelines,
    activations,
    messages,
    fragments: fragments.map(({ lo: _lo, hi: _hi, selfRight: _s, nested: _n, children: _c, depths: _d, ...f }) => f),
    notes,
    rows,
    crosses,
    problems
  };
}

/** What a message shows: number, stereotype, text. */
export function messageLabel(text: string, style: MessageStyle, n: number | null): string {
  return labelOf((style === 'create' ? '«create» ' : style === 'destroy' ? '«destroy» ' : '') + text, n);
}

/** "3: prestar(libro)" when numbered. */
export function labelOf(text: string, n: number | null): string {
  return n === null ? text : `${n}: ${text}`;
}
