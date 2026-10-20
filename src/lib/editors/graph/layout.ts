/**
 * Automatic layout.
 *  - mindmapLayout: the mind map is always laid out — a two-sided tree
 *    around the central idea, branches balanced by height. Pure.
 *  - tidy: on-demand layout of any other canvas diagram with ELK, keeping
 *    containers (system boundary, swimlanes, packages, nodes, zones) around
 *    what they hold.
 */
import type { ElkExtendedEdge, ElkNode } from 'elkjs/lib/elk-api';
import type { GEdge, GNode, GraphKind } from '../../model/types';
import { BRANCH_COLORS } from '../../model/colors';

export interface Size {
  w: number;
  h: number;
}

export interface Placed {
  x: number;
  y: number;
  /** Which side of the root a mind-map idea sits on. */
  side?: 'left' | 'right';
  depth?: number;
  color?: string;
}

const H_GAP = 56;
const V_GAP = 14;

/** Children of each idea, in their order. */
export function childrenMap(nodes: GNode[]): Map<string, GNode[]> {
  const ids = new Set(nodes.map((n) => n.id));
  const map = new Map<string, GNode[]>();
  for (const n of nodes) {
    if (!n.parent || !ids.has(n.parent)) continue;
    if (!map.has(n.parent)) map.set(n.parent, []);
    map.get(n.parent)!.push(n);
  }
  for (const list of map.values()) list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return map;
}

export function mindmapRoot(nodes: GNode[]): GNode | undefined {
  return nodes.find((n) => n.type === 'central') ?? nodes.find((n) => !n.parent && n.type !== 'note');
}

/**
 * Positions (top-left) for every idea reachable from the root. Ideas not in
 * the tree (notes, orphans) are left out: they keep their own x / y.
 */
export function mindmapLayout(nodes: GNode[], size: (n: GNode) => Size): Map<string, Placed> {
  const out = new Map<string, Placed>();
  const root = mindmapRoot(nodes);
  if (!root) return out;
  const kids = childrenMap(nodes);
  const heights = new Map<string, number>();
  const subtree = (n: GNode): number => {
    const own = size(n).h;
    const ch = kids.get(n.id) ?? [];
    const sum = ch.reduce((s, c) => s + subtree(c), 0) + Math.max(0, ch.length - 1) * V_GAP;
    const h = Math.max(own, sum);
    heights.set(n.id, h);
    return h;
  };
  const rootSize = size(root);
  out.set(root.id, { x: -rootSize.w / 2, y: -rootSize.h / 2, depth: 0 });

  // Split main branches between the sides, keeping heights even; order is kept per side.
  const main = kids.get(root.id) ?? [];
  for (const m of main) subtree(m);
  const right: GNode[] = [];
  const left: GNode[] = [];
  let hr = 0;
  let hl = 0;
  main.forEach((m, i) => {
    const h = heights.get(m.id)!;
    if (i === 0 || hr <= hl) {
      right.push(m);
      hr += h + V_GAP;
    } else {
      left.push(m);
      hl += h + V_GAP;
    }
  });

  const place = (n: GNode, side: 'left' | 'right', anchorX: number, topY: number, depth: number, color: string) => {
    const s = size(n);
    const h = heights.get(n.id)!;
    const x = side === 'right' ? anchorX : anchorX - s.w;
    const myColor = n.color ?? color;
    out.set(n.id, { x, y: topY + (h - s.h) / 2, side, depth, color: myColor });
    const ch = kids.get(n.id) ?? [];
    const sum = ch.reduce((acc, c) => acc + heights.get(c.id)!, 0) + Math.max(0, ch.length - 1) * V_GAP;
    let y = topY + (h - sum) / 2;
    const nextX = side === 'right' ? x + s.w + H_GAP : x - H_GAP;
    for (const c of ch) {
      place(c, side, nextX, y, depth + 1, myColor);
      y += heights.get(c.id)! + V_GAP;
    }
  };
  const column = (list: GNode[], side: 'left' | 'right', total: number) => {
    let y = -total / 2;
    const x = side === 'right' ? rootSize.w / 2 + H_GAP : -rootSize.w / 2 - H_GAP;
    for (const m of list) {
      const color = BRANCH_COLORS[main.indexOf(m) % BRANCH_COLORS.length];
      place(m, side, x, y, 1, color);
      y += heights.get(m.id)! + V_GAP;
    }
  };
  column(right, 'right', hr - V_GAP);
  column(left, 'left', hl - V_GAP);
  return out;
}

/* -------------------------------------------------------------------- ELK */

export interface TidyNode {
  id: string;
  w: number;
  h: number;
  container: boolean;
  parent: string | null;
  /** Traceability: fixed column (ELK partition). */
  column?: number;
}

export interface TidyResult {
  x: number;
  y: number;
  w?: number;
  h?: number;
}

function optionsFor(kind: GraphKind): Record<string, string> {
  const layered = (dir: string, extra: Record<string, string> = {}) => ({
    'elk.algorithm': 'layered',
    'elk.direction': dir,
    'elk.spacing.nodeNode': '40',
    'elk.layered.spacing.nodeNodeBetweenLayers': '70',
    'elk.spacing.edgeNode': '24',
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
    'elk.padding': '[top=48,left=28,bottom=28,right=28]',
    ...extra
  });
  switch (kind) {
    case 'usecase':
    case 'deployment':
    case 'architecture':
    case 'screenflow':
      return layered('RIGHT');
    case 'traceability':
      return layered('RIGHT', { 'elk.partitioning.activate': 'true', 'elk.spacing.nodeNode': '18' });
    case 'er':
    case 'dfd':
    case 'communication':
    case 'conceptmap':
      return {
        'elk.algorithm': 'stress',
        'elk.stress.desiredEdgeLength': kind === 'er' ? '110' : '180',
        'elk.spacing.nodeNode': '40',
        'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
        'elk.padding': '[top=48,left=28,bottom=28,right=28]'
      };
    case 'orgchart':
      return layered('DOWN', { 'elk.layered.spacing.nodeNodeBetweenLayers': '56', 'elk.spacing.nodeNode': '28', 'elk.edgeRouting': 'ORTHOGONAL' });
    default:
      return layered('DOWN');
  }
}

/** Edge types drawn "upwards" (child → parent): reversed for layout so parents end up first. */
const UPWARD = new Set(['generalization', 'realization', 'isa', 'reports']);
/** Edge types between peers: they don't decide the layers (org chart "works with"). */
const SIDEWAYS = new Set(['collab']);

export async function tidy(kind: GraphKind, nodes: TidyNode[], edges: GEdge[]): Promise<Map<string, TidyResult>> {
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  const elk = new ELK();
  const options = optionsFor(kind);
  const byId = new Map<string, ElkNode>();
  for (const n of nodes) {
    const layoutOptions: Record<string, string> = {};
    if (n.column !== undefined) layoutOptions['elk.partitioning.partition'] = String(n.column);
    if (n.container) Object.assign(layoutOptions, options, { 'elk.nodeSize.constraints': 'MINIMUM_SIZE', 'elk.nodeSize.minimum': `(${Math.min(n.w, 200)}, ${Math.min(n.h, 120)})` });
    byId.set(n.id, { id: n.id, width: n.w, height: n.h, children: [], edges: [], layoutOptions });
  }
  const root: ElkNode = { id: '__root', layoutOptions: options, children: [], edges: [] };
  for (const n of nodes) {
    const parent = n.parent ? byId.get(n.parent) : undefined;
    (parent ?? root).children!.push(byId.get(n.id)!);
  }
  // Containers sized by ELK: drop the fixed size so they shrink / grow around what they hold.
  for (const n of nodes) {
    const e = byId.get(n.id)!;
    if (n.container && e.children!.length) {
      delete e.width;
      delete e.height;
    } else delete e.children;
  }
  const ids = new Set(nodes.map((n) => n.id));
  const elkEdges: ElkExtendedEdge[] = edges
    .filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to && !SIDEWAYS.has(e.type))
    .map((e) => (UPWARD.has(e.type) ? { id: e.id, sources: [e.to], targets: [e.from] } : { id: e.id, sources: [e.from], targets: [e.to] }));
  root.edges = elkEdges;
  const laid = await elk.layout(root);
  const out = new Map<string, TidyResult>();
  const walk = (n: ElkNode, ox: number, oy: number) => {
    for (const c of n.children ?? []) {
      const x = ox + (c.x ?? 0);
      const y = oy + (c.y ?? 0);
      out.set(c.id, { x: Math.round(x), y: Math.round(y), w: c.width, h: c.height });
      walk(c, x, y);
    }
  };
  walk(laid, 0, 0);
  return out;
}

/* ------------------------------------------------------- special layouts */

export interface Box {
  id: string;
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Swimlanes (activity diagrams, process models): the lanes stay side by side
 * as equal-height columns; every shape keeps its lane and takes its row
 * from a top-down layered layout (`rowY`: the flat ELK result).
 */
export function laneLayout(
  lanes: Box[],
  shapes: Box[],
  laneOf: Map<string, string | null>,
  rowY: Map<string, { x: number; y: number }>
): Map<string, { x: number; y: number; w?: number; h?: number }> {
  const out = new Map<string, { x: number; y: number; w?: number; h?: number }>();
  const ordered = [...lanes].sort((a, b) => a.x - b.x);
  const x0 = Math.min(...ordered.map((l) => l.x));
  const y0 = Math.min(...ordered.map((l) => l.y));
  const HEAD = 44;
  const GAP = 24;
  const minY = Math.min(...shapes.map((s) => rowY.get(s.id)?.y ?? 0));
  let x = x0;
  let bottom = 0;
  const place = (members: Box[], left: number, width: number) => {
    // Shapes in the same layered row share a y; spread them across the lane.
    const rows = new Map<number, Box[]>();
    for (const m of members) {
      const y = Math.round((rowY.get(m.id)?.y ?? 0) - minY);
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y)!.push(m);
    }
    for (const [y, row] of rows) {
      row.sort((a, b) => (rowY.get(a.id)?.x ?? 0) - (rowY.get(b.id)?.x ?? 0));
      const total = row.reduce((s, m) => s + m.w, 0) + GAP * (row.length - 1);
      let cx = left + (width - total) / 2;
      for (const m of row) {
        out.set(m.id, { x: Math.round(cx), y: Math.round(y0 + HEAD + 24 + y) });
        cx += m.w + GAP;
        bottom = Math.max(bottom, HEAD + 24 + y + m.h);
      }
    }
  };
  for (const lane of ordered) {
    const members = shapes.filter((s) => laneOf.get(s.id) === lane.id);
    const rows = new Map<number, number>();
    for (const m of members) {
      const y = Math.round(rowY.get(m.id)?.y ?? 0);
      rows.set(y, (rows.get(y) ?? 0) + m.w + GAP);
    }
    const width = Math.max(220, lane.w, ...[...rows.values()].map((v) => v - GAP + 48));
    place(members, x, width);
    out.set(lane.id, { x, y: y0, w: width });
    x += width;
  }
  // Shapes outside every lane go to the right of the lanes.
  const loose = shapes.filter((s) => !laneOf.get(s.id));
  if (loose.length) place(loose, x + 40, Math.max(...loose.map((s) => s.w)) + 48);
  const height = Math.max(bottom + 40, ...ordered.map((l) => l.h));
  for (const lane of ordered) out.set(lane.id, { ...out.get(lane.id)!, h: height });
  return out;
}

/**
 * Traceability as in the Tema 3 slide: fixed columns (requisitos, diseño,
 * componentes, pruebas); acceptance criteria indented under their
 * requirement; every other shape level with the shapes that trace to it.
 */
export function traceLayout(nodes: Box[], column: (type: string) => number | undefined, edges: GEdge[]): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  const COLS = 4;
  const colW: number[] = Array(COLS).fill(160);
  for (const n of nodes) {
    const c = column(n.type);
    if (c !== undefined) colW[c] = Math.max(colW[c], n.w + (n.type === 'criterion' ? 28 : 0));
  }
  const colX: number[] = [];
  let x = 0;
  for (let c = 0; c < COLS; c++) {
    colX.push(x);
    x += colW[c] + 80;
  }
  const isCrit = (id: string) => nodes.find((n) => n.id === id)?.type === 'criterion';
  const isReq = (id: string) => nodes.find((n) => n.id === id)?.type === 'req';
  const critsOf = (reqId: string) =>
    edges
      .filter((e) => (e.from === reqId && isCrit(e.to)) || (e.to === reqId && isCrit(e.from)))
      .map((e) => (e.from === reqId ? e.to : e.from))
      .filter((id, i, a) => a.indexOf(id) === i);
  // Column 0: requirements top to bottom, their criteria under each.
  let y = 0;
  const placed = new Set<string>();
  for (const r of nodes.filter((n) => n.type === 'req').sort((a, b) => a.y - b.y)) {
    out.set(r.id, { x: colX[0], y });
    placed.add(r.id);
    y += r.h + 10;
    for (const cid of critsOf(r.id)) {
      const c = nodes.find((n) => n.id === cid)!;
      out.set(cid, { x: colX[0] + 28, y });
      placed.add(cid);
      y += c.h + 8;
    }
    y += 18;
  }
  for (const c of nodes.filter((n) => n.type === 'criterion' && !placed.has(n.id))) {
    out.set(c.id, { x: colX[0] + 28, y });
    y += c.h + 8;
  }
  // Other columns: each shape level with the average of what traces to it.
  for (let col = 1; col < COLS; col++) {
    const items = nodes.filter((n) => column(n.type) === col);
    const want = (n: Box) => {
      const from = edges.filter((e) => e.to === n.id && out.has(e.from)).map((e) => out.get(e.from)!.y);
      return from.length ? from.reduce((s, v) => s + v, 0) / from.length : n.y;
    };
    let floor = -Infinity;
    for (const n of items.map((n) => ({ n, w: want(n) })).sort((a, b) => a.w - b.w)) {
      const yy = Math.max(n.w, floor);
      out.set(n.n.id, { x: colX[col], y: Math.round(yy) });
      floor = yy + n.n.h + 14;
    }
  }
  // Notes and anything else keep their place.
  void isReq;
  return out;
}
