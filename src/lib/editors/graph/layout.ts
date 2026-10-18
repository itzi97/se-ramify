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
    default:
      return layered('DOWN');
  }
}

/** Edge types drawn "upwards" (child → parent): reversed for layout so parents end up first. */
const UPWARD = new Set(['generalization', 'realization', 'isa']);

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
    .filter((e) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to)
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
