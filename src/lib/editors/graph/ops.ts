/**
 * Canvas operations that don't need the DOM: which shapes take a colour,
 * stacking order, where a dragged shape would land, line direction.
 * Kept here (not in Canvas.svelte) so they can be tested on their own.
 */
import type { Shape } from '../../model/kinds';
import type { GEdge, GraphData } from '../../model/types';
import { contains, type Rect } from './geometry';

/** Shapes too small or too symbolic to colour: start / end dots, fork bars, history, lollipops. */
export const NO_PAINT: ReadonlySet<Shape> = new Set<Shape>(['initial', 'final', 'flowFinal', 'bar', 'history', 'lollipop']);

export function canPaint(shape: Shape): boolean {
  return !NO_PAINT.has(shape);
}

/**
 * Shapes that already draw their own colour (zones, sticky notes, map ideas,
 * traceability boxes, the central idea); every other shape gets the shared
 * tint: a light fill and a coloured outline.
 */
export const OWN_TINT: ReadonlySet<Shape> = new Set<Shape>(['zone', 'note', 'topic', 'concept', 'trace', 'central']);

/**
 * Colour (or clear, with undefined) shapes and lines. Shapes that can't take
 * a colour are left alone. Returns how many things changed.
 */
export function paint(g: GraphData, nodeIds: Iterable<string>, edgeIds: Iterable<string>, hex: string | undefined, shapeOf: (type: string, icon?: string) => Shape): number {
  const ns = new Set(nodeIds);
  const es = new Set(edgeIds);
  let changed = 0;
  for (const n of g.nodes) {
    if (!ns.has(n.id) || !canPaint(shapeOf(n.type, n.icon)) || n.color === hex) continue;
    if (hex) n.color = hex;
    else delete n.color;
    changed++;
  }
  for (const e of g.edges) {
    if (!es.has(e.id) || e.color === hex) continue;
    if (hex) e.color = hex;
    else delete e.color;
    changed++;
  }
  return changed;
}

/** The one colour all of these share, undefined if none has one, 'mixed' if they differ. */
export function commonColor(colors: (string | undefined)[]): string | undefined {
  if (!colors.length) return undefined;
  const first = colors[0];
  return colors.every((c) => c === first) ? first : 'mixed';
}

/**
 * Stacking: shapes later in the list are drawn on top of earlier ones
 * (containers always stay behind the shapes they hold, whatever their order).
 */
export function bringToFront(g: GraphData, ids: Iterable<string>): void {
  const set = new Set(ids);
  g.nodes = [...g.nodes.filter((n) => !set.has(n.id)), ...g.nodes.filter((n) => set.has(n.id))];
}

export function sendToBack(g: GraphData, ids: Iterable<string>): void {
  const set = new Set(ids);
  g.nodes = [...g.nodes.filter((n) => set.has(n.id)), ...g.nodes.filter((n) => !set.has(n.id))];
}

/** A line the other way round: ends, end labels and message arrows swap. */
export function reverseEdge(e: GEdge): void {
  [e.from, e.to] = [e.to, e.from];
  const fl = e.fromLabel;
  const tl = e.toLabel;
  if (tl) e.fromLabel = tl;
  else delete e.fromLabel;
  if (fl) e.toLabel = fl;
  else delete e.toLabel;
  e.messages?.forEach((m) => (m.dir = m.dir === 'forward' ? 'back' : 'forward'));
}

/**
 * The container a shape at `r` would belong to if dropped there: the smallest
 * container that holds all of it and is bigger than it. `skip` are shapes
 * that can't take it (itself, what it carries).
 */
export function dropTarget(r: Rect, containers: { id: string; rect: Rect }[], skip: ReadonlySet<string>): string | null {
  let best: string | null = null;
  let bestArea = Infinity;
  for (const c of containers) {
    if (skip.has(c.id)) continue;
    const area = c.rect.w * c.rect.h;
    if (area < bestArea && area > r.w * r.h && contains(c.rect, r)) {
      best = c.id;
      bestArea = area;
    }
  }
  return best;
}

/** A colour mixed with white: a light fill for exports that take a plain hex (PlantUML). */
export function lighten(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c * amount + 255 * (1 - amount)));
  return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('');
}
