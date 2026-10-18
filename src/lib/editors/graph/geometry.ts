/**
 * Pure geometry for the canvas diagrams: where a line meets a shape, how a
 * line is routed (straight or orthogonal), the arrowheads and diamonds at
 * its ends, and which shapes sit inside a container. No Svelte, so the node
 * tests can check it.
 */
import type { EndMark, Shape } from '../../model/kinds';

export interface Pt {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Outline = 'rect' | 'ellipse' | 'diamond';

/** What a line ends against, per shape. */
export function outlineOf(shape: Shape): Outline {
  switch (shape) {
    case 'ellipse':
    case 'initial':
    case 'final':
    case 'flowFinal':
    case 'history':
    case 'attribute':
    case 'lollipop':
    case 'central':
      return 'ellipse';
    case 'diamond':
    case 'relationship':
      return 'diamond';
    default:
      return 'rect';
  }
}

export const center = (r: Rect): Pt => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Point where the ray from the centre of `r` towards `toward` leaves the shape. */
export function boundaryPoint(r: Rect, outline: Outline, toward: Pt): Pt {
  const c = center(r);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;
  const hw = Math.max(1, r.w / 2);
  const hh = Math.max(1, r.h / 2);
  let t: number;
  if (outline === 'ellipse') t = 1 / Math.sqrt((dx * dx) / (hw * hw) + (dy * dy) / (hh * hh));
  else if (outline === 'diamond') t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
  else t = Math.min(dx === 0 ? Infinity : hw / Math.abs(dx), dy === 0 ? Infinity : hh / Math.abs(dy));
  return { x: c.x + dx * t, y: c.y + dy * t };
}

export interface Route {
  /** Polyline from the source boundary to the target boundary. */
  points: Pt[];
  /** Where the label goes (middle of the route). */
  mid: Pt;
}

/** A straight line between two shapes; `offset` shifts it sideways (parallel lines between one pair). */
export function straightRoute(a: Rect, ao: Outline, b: Rect, bo: Outline, offset = 0): Route {
  let ca = center(a);
  let cb = center(b);
  if (offset) {
    const dx = cb.x - ca.x;
    const dy = cb.y - ca.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * offset;
    const ny = (dx / len) * offset;
    ca = { x: ca.x + nx, y: ca.y + ny };
    cb = { x: cb.x + nx, y: cb.y + ny };
    // Push the shifted centres back onto the shapes along the shifted line.
    const pa = clipFrom({ ...a }, ao, ca, cb);
    const pb = clipFrom({ ...b }, bo, cb, ca);
    return { points: [pa, pb], mid: { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 } };
  }
  const pa = boundaryPoint(a, ao, cb);
  const pb = boundaryPoint(b, bo, ca);
  return { points: [pa, pb], mid: { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 } };
}

/** Where the segment from `inside` towards `outside` crosses the boundary of `r` (by bisection; shapes are convex). */
function clipFrom(r: Rect, o: Outline, inside: Pt, outside: Pt): Pt {
  const isIn = (p: Pt) => {
    const c = center(r);
    const u = (p.x - c.x) / (r.w / 2 || 1);
    const v = (p.y - c.y) / (r.h / 2 || 1);
    if (o === 'ellipse') return u * u + v * v <= 1;
    if (o === 'diamond') return Math.abs(u) + Math.abs(v) <= 1;
    return Math.abs(u) <= 1 && Math.abs(v) <= 1;
  };
  if (!isIn(inside)) return boundaryPoint(r, o, outside);
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const m = (lo + hi) / 2;
    const p = { x: inside.x + (outside.x - inside.x) * m, y: inside.y + (outside.y - inside.y) * m };
    if (isIn(p)) lo = m;
    else hi = m;
  }
  return { x: inside.x + (outside.x - inside.x) * lo, y: inside.y + (outside.y - inside.y) * lo };
}

/**
 * Orthogonal route: leave from the side facing the other shape, one or two
 * bends. Side midpoints lie on every outline we draw (rect, ellipse,
 * diamond), so no clipping is needed.
 */
export function orthogonalRoute(a: Rect, b: Rect, loopBack = false): Route {
  const ca = center(a);
  const cb = center(b);
  // Flows that go back up a column (a "no" back to an earlier step) loop round the right-hand side.
  if (loopBack && b.y + b.h < a.y && Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 16) {
    const x = Math.max(a.x + a.w, b.x + b.w) + 36;
    const p1 = { x: a.x + a.w, y: ca.y };
    const p4 = { x: b.x + b.w, y: cb.y };
    return { points: [p1, { x, y: p1.y }, { x, y: p4.y }, p4], mid: { x, y: (p1.y + p4.y) / 2 } };
  }
  const gapX = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const gapY = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  // Overlapping ranges in one axis: a single straight segment works.
  const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (gapY > 0 && overlapX > 16) {
    const x = (Math.max(a.x, b.x) + Math.min(a.x + a.w, b.x + b.w)) / 2;
    const down = cb.y > ca.y;
    const p1 = { x, y: down ? a.y + a.h : a.y };
    const p2 = { x, y: down ? b.y : b.y + b.h };
    return { points: [p1, p2], mid: { x, y: (p1.y + p2.y) / 2 } };
  }
  if (gapX > 0 && overlapY > 16) {
    const y = (Math.max(a.y, b.y) + Math.min(a.y + a.h, b.y + b.h)) / 2;
    const right = cb.x > ca.x;
    const p1 = { x: right ? a.x + a.w : a.x, y };
    const p2 = { x: right ? b.x : b.x + b.w, y };
    return { points: [p1, p2], mid: { x: (p1.x + p2.x) / 2, y } };
  }
  if (gapY >= gapX) {
    // Mostly above / below: vertical – horizontal – vertical.
    const down = cb.y > ca.y;
    const p1 = { x: ca.x, y: down ? a.y + a.h : a.y };
    const p4 = { x: cb.x, y: down ? b.y : b.y + b.h };
    const my = (p1.y + p4.y) / 2;
    const p2 = { x: p1.x, y: my };
    const p3 = { x: p4.x, y: my };
    return { points: [p1, p2, p3, p4], mid: { x: (p2.x + p3.x) / 2, y: my } };
  }
  const right = cb.x > ca.x;
  const p1 = { x: right ? a.x + a.w : a.x, y: ca.y };
  const p4 = { x: right ? b.x : b.x + b.w, y: cb.y };
  const mx = (p1.x + p4.x) / 2;
  const p2 = { x: mx, y: p1.y };
  const p3 = { x: mx, y: p4.y };
  return { points: [p1, p2, p3, p4], mid: { x: mx, y: (p2.y + p3.y) / 2 } };
}

/** A loop on a shape's top-right corner, for an edge from a shape to itself. */
export function selfLoop(r: Rect): Route {
  const x0 = r.x + r.w * 0.7;
  const y0 = r.y;
  const x1 = r.x + r.w;
  const y1 = r.y + r.h * 0.3;
  const d = 28;
  const points = [
    { x: x0, y: y0 },
    { x: x0, y: y0 - d },
    { x: x1 + d, y: y0 - d },
    { x: x1 + d, y: y1 },
    { x: x1, y: y1 }
  ];
  return { points, mid: { x: x1 + d, y: y0 - d } };
}

/** How far back from the tip the line stops, so it doesn't run through a hollow mark. */
export function markInset(mark: EndMark): number {
  switch (mark) {
    case 'triangle':
      return 14;
    case 'diamond':
    case 'filledDiamond':
      return 18;
    case 'filled':
      return 6;
    default:
      return 0;
  }
}

export interface MarkShape {
  kind: 'polyline' | 'polygon';
  points: Pt[];
  filled: boolean;
}

/** The mark drawn at `tip`, for a line arriving from `from`. */
export function markAt(mark: EndMark, tip: Pt, from: Pt): MarkShape | null {
  if (mark === 'none') return null;
  const dx = tip.x - from.x;
  const dy = tip.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const nx = -uy;
  const ny = ux;
  const back = (d: number, side: number): Pt => ({ x: tip.x - ux * d + nx * side, y: tip.y - uy * d + ny * side });
  switch (mark) {
    case 'arrow':
      return { kind: 'polyline', points: [back(12, 6), tip, back(12, -6)], filled: false };
    case 'filled':
      return { kind: 'polygon', points: [tip, back(12, 5.5), back(12, -5.5)], filled: true };
    case 'triangle':
      return { kind: 'polygon', points: [tip, back(14, 8), back(14, -8)], filled: false };
    case 'diamond':
      return { kind: 'polygon', points: [tip, back(9, 5.5), back(18, 0), back(9, -5.5)], filled: false };
    case 'filledDiamond':
      return { kind: 'polygon', points: [tip, back(9, 5.5), back(18, 0), back(9, -5.5)], filled: true };
  }
}

/** Pull the first / last point of a polyline back by `d` along its segment. */
export function inset(points: Pt[], atStart: number, atEnd: number): Pt[] {
  const out = points.map((p) => ({ ...p }));
  const pull = (i: number, j: number, d: number) => {
    if (!d) return;
    const dx = out[j].x - out[i].x;
    const dy = out[j].y - out[i].y;
    const len = Math.hypot(dx, dy);
    if (len <= d) return;
    out[i] = { x: out[i].x + (dx / len) * d, y: out[i].y + (dy / len) * d };
  };
  pull(0, 1, atStart);
  pull(out.length - 1, out.length - 2, atEnd);
  return out;
}

export function pathOf(points: Pt[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

/** A point `d` along the route from its start (or end), offset sideways by `side`: where end labels go. */
export function alongFrom(points: Pt[], fromEnd: boolean, d: number, side: number): Pt {
  const a = fromEnd ? points[points.length - 1] : points[0];
  const b = fromEnd ? points[points.length - 2] : points[1];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  return { x: a.x + ux * d - uy * side, y: a.y + uy * d + ux * side };
}

/** Direction of the segment that holds the midpoint (for message arrows on communication links). */
export function midDirection(points: Pt[]): Pt {
  const i = Math.max(0, Math.floor((points.length - 1) / 2));
  const a = points[i];
  const b = points[Math.min(points.length - 1, i + 1)];
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
}

/** Is `inner` fully inside `outer`? (a small tolerance so a snug fit counts) */
export function contains(outer: Rect, inner: Rect, tol = 2): boolean {
  return inner.x >= outer.x - tol && inner.y >= outer.y - tol && inner.x + inner.w <= outer.x + outer.w + tol && inner.y + inner.h <= outer.y + outer.h + tol;
}

/** The smallest container that holds each shape (null for top level). Containers are given by id. */
export function parentsOf(rects: Map<string, Rect>, containers: Set<string>): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const [id, r] of rects) {
    let best: string | null = null;
    let bestArea = Infinity;
    for (const cid of containers) {
      if (cid === id) continue;
      const c = rects.get(cid)!;
      const area = c.w * c.h;
      if (area < bestArea && area > r.w * r.h && contains(c, r)) {
        best = cid;
        bestArea = area;
      }
    }
    out.set(id, best);
  }
  return out;
}

/** Every shape inside a container, at any depth. */
export function descendantsOf(id: string, parents: Map<string, string | null>): string[] {
  const out: string[] = [];
  const walk = (p: string) => {
    for (const [child, parent] of parents) {
      if (parent === p) {
        out.push(child);
        walk(child);
      }
    }
  };
  walk(id);
  return out;
}

/* -------------------------------------------------- routing round shapes */

/** Does segment p–q pass through rect r (shrunk by a small margin)? */
export function segmentHits(p: Pt, q: Pt, r: Rect, margin = 4): boolean {
  const x0 = r.x + margin;
  const y0 = r.y + margin;
  const x1 = r.x + r.w - margin;
  const y1 = r.y + r.h - margin;
  if (x1 <= x0 || y1 <= y0) return false;
  // Liang–Barsky clip of the segment against the rectangle.
  let t0 = 0;
  let t1 = 1;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const edges: [number, number][] = [
    [-dx, p.x - x0],
    [dx, x1 - p.x],
    [-dy, p.y - y0],
    [dy, y1 - p.y]
  ];
  for (const [pp, qq] of edges) {
    if (pp === 0) {
      if (qq < 0) return false;
      continue;
    }
    const t = qq / pp;
    if (pp < 0) {
      if (t > t1) return false;
      if (t > t0) t0 = t;
    } else {
      if (t < t0) return false;
      if (t < t1) t1 = t;
    }
  }
  return t1 - t0 > 1e-6;
}

export function routeHits(points: Pt[], obstacles: Rect[]): number {
  let n = 0;
  for (const r of obstacles) {
    for (let i = 1; i < points.length; i++) {
      if (segmentHits(points[i - 1], points[i], r)) {
        n++;
        break;
      }
    }
  }
  return n;
}

const routeLength = (pts: Pt[]) => pts.slice(1).reduce((s, p, i) => s + Math.abs(p.x - pts[i].x) + Math.abs(p.y - pts[i].y), 0);

/**
 * Right-angle route that avoids the other shapes when it can: tries the
 * default route, both L-shapes, both Z-shapes with the middle leg moved
 * through the gaps, and loops round either side; keeps the one crossing the
 * fewest shapes, then the shortest.
 */
export function orthogonalAvoiding(a: Rect, b: Rect, obstacles: Rect[], loopBack = false): Route {
  const first = orthogonalRoute(a, b, loopBack);
  if (!obstacles.length || routeHits(first.points, obstacles) === 0) return first;
  const ca = center(a);
  const cb = center(b);
  const cands: Route[] = [first];
  const side = (r: Rect, s: 'l' | 'r' | 't' | 'b'): Pt => (s === 'l' ? { x: r.x, y: r.y + r.h / 2 } : s === 'r' ? { x: r.x + r.w, y: r.y + r.h / 2 } : s === 't' ? { x: r.x + r.w / 2, y: r.y } : { x: r.x + r.w / 2, y: r.y + r.h });
  const mk = (pts: Pt[]): Route => {
    const i = Math.floor((pts.length - 1) / 2);
    return { points: pts, mid: { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 } };
  };
  const right = cb.x >= ca.x;
  const down = cb.y >= ca.y;
  // L-shapes: horizontal then vertical, vertical then horizontal.
  {
    const p1 = side(a, right ? 'r' : 'l');
    const p2 = side(b, down ? 't' : 'b');
    if ((right ? p2.x > p1.x : p2.x < p1.x) && (down ? p2.y > p1.y : p2.y < p1.y)) cands.push(mk([p1, { x: p2.x, y: p1.y }, p2]));
    const q1 = side(a, down ? 'b' : 't');
    const q2 = side(b, right ? 'l' : 'r');
    if ((right ? q2.x > q1.x : q2.x < q1.x) && (down ? q2.y > q1.y : q2.y < q1.y)) cands.push(mk([q1, { x: q1.x, y: q2.y }, q2]));
  }
  // Z-shapes with the middle leg at several positions, including just past every obstacle edge.
  const xs = new Set<number>([(ca.x + cb.x) / 2]);
  const ys = new Set<number>([(ca.y + cb.y) / 2]);
  for (const r of obstacles) {
    xs.add(r.x - 16);
    xs.add(r.x + r.w + 16);
    ys.add(r.y - 16);
    ys.add(r.y + r.h + 16);
  }
  const p1h = side(a, right ? 'r' : 'l');
  const p4h = side(b, right ? 'l' : 'r');
  for (const x of xs) if ((x - p1h.x) * (p4h.x - x) >= 0) cands.push(mk([p1h, { x, y: p1h.y }, { x, y: p4h.y }, p4h]));
  const p1v = side(a, down ? 'b' : 't');
  const p4v = side(b, down ? 't' : 'b');
  for (const y of ys) if ((y - p1v.y) * (p4v.y - y) >= 0) cands.push(mk([p1v, { x: p1v.x, y }, { x: p4v.x, y }, p4v]));
  // U-shapes round the outside.
  const top = Math.min(a.y, b.y, ...obstacles.map((r) => r.y)) - 24;
  const bottom = Math.max(a.y + a.h, b.y + b.h) + 24;
  const leftX = Math.min(a.x, b.x) - 24;
  const rightX = Math.max(a.x + a.w, b.x + b.w) + 24;
  cands.push(mk([side(a, 't'), { x: ca.x, y: Math.min(a.y, b.y) - 24 }, { x: cb.x, y: Math.min(a.y, b.y) - 24 }, side(b, 't')]));
  cands.push(mk([side(a, 'b'), { x: ca.x, y: bottom }, { x: cb.x, y: bottom }, side(b, 'b')]));
  cands.push(mk([side(a, 'l'), { x: leftX, y: ca.y }, { x: leftX, y: cb.y }, side(b, 'l')]));
  cands.push(mk([side(a, 'r'), { x: rightX, y: ca.y }, { x: rightX, y: cb.y }, side(b, 'r')]));
  void top;
  let best = first;
  let bestScore = Infinity;
  for (const c of cands) {
    const score = routeHits(c.points, obstacles) * 100000 + routeLength(c.points) + (c.points.length - 2) * 30;
    if (score < bestScore) {
      best = c;
      bestScore = score;
    }
  }
  return best;
}
