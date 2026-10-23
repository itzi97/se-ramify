<script lang="ts" module>
  import type { EdgeTypeInfo, Shape } from '../../model/kinds';
  import type { GEdge, EdgeRouting } from '../../model/types';

  export interface GraphEdgeData {
    [key: string]: unknown;
    edge: GEdge;
    info: EdgeTypeInfo;
    routing: EdgeRouting;
    fromShape: Shape;
    toShape: Shape;
    /** Parallel lines between the same two shapes: this one's offset in px. */
    offset: number;
    /** Draw as a tree connector (traceability criteria, mind-map branches). */
    style?: 'tree' | 'branch';
    color?: string;
    /** Total participation (E/R): a double line. */
    double?: boolean;
    /** Flows going back up loop round the side (activity, flowchart). */
    loopBack?: boolean;
    /** Right-angle lines that leave the same shape: this one's sideways shift, so tracks don't merge. */
    spread?: number;
  }
</script>

<script lang="ts">
  import { getContext } from 'svelte';
  import { useStore, type EdgeProps } from '@xyflow/svelte';
  import { alongFrom, inset, markAt, markInset, midDirection, orthogonalAvoiding, outlineOf, pathOf, selfLoop, straightRoute, type Pt, type Rect, type Route } from './geometry';

  let { id, source, target, data, selected }: EdgeProps & { data: GraphEdgeData } = $props();

  const edgeCtx = getContext<{ editEdge: (id: string) => void }>('graph-edge');
  // Like useInternalNode, but follows `source` / `target` if a line is reversed in place.
  const store = $derived(useStore());
  const a = {
    get current() {
      store.nodes;
      return store.nodeLookup.get(source);
    }
  };
  const b = {
    get current() {
      store.nodes;
      return store.nodeLookup.get(target);
    }
  };

  function rectOf(n: typeof a.current): Rect | null {
    if (!n) return null;
    const w = n.measured?.width ?? n.width ?? 0;
    const h = n.measured?.height ?? n.height ?? 0;
    if (!w || !h) return null;
    return { x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y, w, h };
  }

  /** Glyph-with-caption shapes: lines end at the glyph (stick figure, device icon), not the caption's box. */
  /** Glyph-with-caption shapes: lines meet the glyph (stick figure, device tile), not the caption's box. */
  function glyph(r: Rect | null, shape: string): Rect | null {
    if (!r) return r;
    const box = shape === 'actor' ? { w: 34, h: 58 } : shape === 'device' ? { w: 54, h: 54 } : shape === 'lollipop' ? { w: 20, h: 20 } : null;
    if (!box) return r;
    return { x: r.x + (r.w - box.w) / 2, y: r.y + 1, w: box.w, h: box.h };
  }

  /** A line leaving a glyph straight down starts under its caption instead of crossing it. */
  function underCaption(points: Pt[], full: Rect | null, g: Rect | null, atStart: boolean): Pt[] {
    if (!full || !g || g === full || points.length < 2) return points;
    const i = atStart ? 0 : points.length - 1;
    const j = atStart ? 1 : points.length - 2;
    const p = points[i];
    const q = points[j];
    const bottom = g.y + g.h;
    if (Math.abs(p.y - bottom) < 1.5 && Math.abs(p.x - q.x) < 0.5 && q.y > p.y) {
      const out = points.slice();
      out[i] = { x: p.x, y: full.y + full.h };
      return out;
    }
    return points;
  }

  const route = $derived.by((): Route | null => {
    const fa = rectOf(a.current);
    const fb = rectOf(b.current);
    const ra = glyph(fa, data.fromShape);
    const rb = glyph(fb, data.toShape);
    if (!ra || !rb) return null;
    if (source === target) return selfLoop(ra);
    if (data.style === 'tree') {
      // From under the parent's left edge, down, then right into the child.
      const x = ra.x + 14;
      const y = rb.y + rb.h / 2;
      return { points: [{ x, y: ra.y + ra.h }, { x, y }, { x: rb.x, y }], mid: { x, y } };
    }
    if (data.style === 'branch') {
      const right = rb.x + rb.w / 2 >= ra.x + ra.w / 2;
      const p1 = { x: right ? ra.x + ra.w : ra.x, y: ra.y + ra.h / 2 };
      const p2 = { x: right ? rb.x : rb.x + rb.w, y: rb.y + rb.h / 2 };
      return { points: [p1, p2], mid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 } };
    }
    if (data.routing === 'orthogonal' && !data.offset) {
      // Other shapes (not containers, not the two ends) are obstacles to route round.
      const obstacles: Rect[] = [];
      for (const n of store.nodeLookup.values()) {
        if (n.id === source || n.id === target || n.zIndex === 0 || (n.internals.userNode.zIndex ?? 2) === 0) continue;
        const r = rectOf(n);
        if (r) obstacles.push(r);
      }
      const rt = orthogonalAvoiding(ra, rb, obstacles, data.loopBack);
      let pts = underCaption(underCaption(rt.points, fa, ra, true), fb, rb, false);
      let mid = rt.mid;
      if (data.spread && pts.length >= 3) {
        // Several lines leaving one shape each get their own track (a few px apart), so they don't merge.
        pts = pts.map((p) => ({ ...p }));
        for (let i = 0; i < pts.length - 2; i++) {
          const horizontal = Math.abs(pts[i].y - pts[i + 1].y) < 0.5;
          if (horizontal) {
            pts[i].y += data.spread;
            pts[i + 1].y += data.spread;
          } else {
            pts[i].x += data.spread;
            pts[i + 1].x += data.spread;
          }
        }
        mid = { x: (pts[Math.floor((pts.length - 1) / 2)].x + pts[Math.floor((pts.length - 1) / 2) + 1].x) / 2, y: (pts[Math.floor((pts.length - 1) / 2)].y + pts[Math.floor((pts.length - 1) / 2) + 1].y) / 2 };
      }
      return { points: pts, mid };
    }
    return straightRoute(ra, outlineOf(data.fromShape), rb, outlineOf(data.toShape), data.offset);
  });

  const endMark = $derived(data.info.end);
  const startMark = $derived(data.info.start ?? 'none');
  const line = $derived(route ? inset(route.points, markInset(startMark), markInset(endMark)) : []);
  const d = $derived.by(() => {
    if (!route) return '';
    if (data.style === 'branch') {
      const [p1, p2] = route.points;
      const mx = (p1.x + p2.x) / 2;
      return `M${p1.x},${p1.y} C${mx},${p1.y} ${mx},${p2.y} ${p2.x},${p2.y}`;
    }
    return pathOf(line);
  });
  const endShape = $derived(route ? markAt(endMark, route.points[route.points.length - 1], route.points[route.points.length - 2]) : null);
  const startShape = $derived(route ? markAt(startMark, route.points[0], route.points[1]) : null);

  /** The person's colour for this line, else the mind-map branch colour. */
  const ecolor = $derived(data.edge.color ?? data.color);
  const text = $derived([data.info.stereotype ? `«${data.info.stereotype}»` : '', data.edge.label ?? ''].filter(Boolean).join(' '));
  const labelLines = $derived(text ? text.split('\n') : []);

  /** End labels (multiplicity / role) sit beside the line, near each end. */
  /** How far along the line an end label sits: 20px, but never past a third of a short end segment. */
  const endDist = (fromEnd: boolean) => {
    const pts = route!.points;
    const a = fromEnd ? pts[pts.length - 1] : pts[0];
    const b = fromEnd ? pts[pts.length - 2] : pts[1];
    return Math.max(8, Math.min(20, Math.hypot(b.x - a.x, b.y - a.y) / 3));
  };
  const fromAt = $derived(route && data.edge.fromLabel ? alongFrom(route.points, false, endDist(false), -12) : null);
  const toAt = $derived(route && data.edge.toLabel ? alongFrom(route.points, true, endDist(true), 12) : null);

  /** Communication diagrams: messages grouped by direction, each group with its own arrow. */
  const msgGroups = $derived.by(() => {
    const ms = data.edge.messages ?? [];
    if (!route || !ms.length) return [];
    const dir = midDirection(route.points);
    const n = { x: -dir.y, y: dir.x };
    const groups: { arrow: Pt[]; at: Pt; lines: string[]; anchor: 'start' | 'end' | 'middle'; steep: boolean; above: boolean }[] = [];
    (['forward', 'back'] as const).forEach((which, gi) => {
      const lines = ms.filter((m) => m.dir === which).map((m) => `${m.seq}${m.seq ? ': ' : ''}${m.text}`);
      if (!lines.length) return;
      // The first group goes above the line (or left of a steep one), whichever way the link was drawn.
      const first = n.y > 0.01 || (Math.abs(n.y) <= 0.01 && n.x > 0) ? -1 : 1;
      const side = gi === 0 ? first : -first;
      const above = n.y * side < 0;
      const c = { x: route.mid.x + n.x * 16 * side, y: route.mid.y + n.y * 16 * side };
      const u = which === 'forward' ? dir : { x: -dir.x, y: -dir.y };
      const tail = { x: c.x - u.x * 14, y: c.y - u.y * 14 };
      const tip = { x: c.x + u.x * 14, y: c.y + u.y * 14 };
      const head = [
        { x: tip.x - u.x * 7 + n.x * 4, y: tip.y - u.y * 7 + n.y * 4 },
        tip,
        { x: tip.x - u.x * 7 - n.x * 4, y: tip.y - u.y * 7 - n.y * 4 }
      ];
      // Text block beyond the arrow, away from the line; on steep lines it hangs to one side.
      const steep = Math.abs(dir.y) > 0.6;
      const at = steep ? { x: c.x + n.x * 12 * side, y: c.y - ((lines.length - 1) * 14) / 2 } : { x: c.x + n.x * 10 * side, y: c.y + n.y * 10 * side };
      const anchor = steep ? (n.x * side > 0 ? 'start' : 'end') : 'middle';
      groups.push({ arrow: [tail, tip, ...head], at, lines, anchor, steep, above });
    });
    return groups;
  });
</script>

{#if route}
  <g class="gedge" class:selected class:tinted={!!ecolor} class:branch={data.style === 'branch'} class:dashed={data.info.dashed} style={ecolor ? `--ecolor: ${ecolor}` : undefined} role="presentation" ondblclick={(e) => { e.stopPropagation(); if (!id.startsWith('tree:')) edgeCtx?.editEdge(id); }}>
    <path class="hit" d={d} />
    {#if selected}<path class="halo" d={d} />{/if}
    {#if data.double}
      <path class="ln double-outer" d={d} />
      <path class="ln double-inner" d={d} />
    {:else}
      <path class="ln" d={d} />
    {/if}
    {#each [startShape, endShape] as m, i (i)}
      {#if m}
        {#if m.kind === 'polyline'}
          <polyline class="mark" points={m.points.map((p) => `${p.x},${p.y}`).join(' ')} />
        {:else}
          <polygon class="mark" class:filled={m.filled} points={m.points.map((p) => `${p.x},${p.y}`).join(' ')} />
        {/if}
      {/if}
    {/each}
    {#if labelLines.length}
      <text class="elabel" x={route.mid.x} y={route.mid.y - (labelLines.length - 1) * 7.5}>
        {#each labelLines as l, i (i)}<tspan x={route.mid.x} dy={i ? 15 : 0}>{l}</tspan>{/each}
      </text>
    {/if}
    {#if fromAt}<text class="elabel end" x={fromAt.x} y={fromAt.y}>{data.edge.fromLabel}</text>{/if}
    {#if toAt}<text class="elabel end" x={toAt.x} y={toAt.y}>{data.edge.toLabel}</text>{/if}
    {#each msgGroups as g, gi (gi)}
      <polyline class="msg-arrow" points={g.arrow.slice(0, 2).map((p) => `${p.x},${p.y}`).join(' ')} />
      <polyline class="msg-arrow" points={g.arrow.slice(2).map((p) => `${p.x},${p.y}`).join(' ')} />
      <text class="elabel msg" style="text-anchor: {g.anchor}" x={g.at.x} y={g.steep ? g.at.y : g.at.y + (g.above ? -(g.lines.length - 1) * 14 - 4 : 12)}>
        {#each g.lines as l, i (i)}<tspan x={g.at.x} dy={i ? 14 : 0}>{l}</tspan>{/each}
      </text>
    {/each}
  </g>
{/if}

<style>
  .gedge {
    --edge-ink: var(--ecolor, var(--d-line));
  }
  .hit {
    fill: none;
    stroke: transparent;
    stroke-width: 14;
  }
  .ln {
    fill: none;
    stroke: var(--edge-ink);
    stroke-width: 1.5;
    stroke-linejoin: round;
  }
  :global(.svelte-flow__edge) .gedge .ln {
    transition: none;
  }
  .dashed .ln {
    stroke-dasharray: 7 5;
  }
  .double-outer {
    stroke-width: 5;
  }
  .double-inner {
    stroke: var(--d-fill, white);
    stroke-width: 2;
  }
  .mark {
    fill: var(--d-fill);
    stroke: var(--edge-ink);
    stroke-width: 1.5;
    stroke-linejoin: round;
  }
  polyline.mark {
    fill: none;
  }
  .mark.filled {
    fill: var(--edge-ink);
  }
  /* A colour the person picked: a touch of ink keeps light colours (yellow) readable on paper, and dark ones on dark paper. */
  .gedge.tinted:not(.branch) {
    --edge-ink: color-mix(in srgb, var(--ecolor) 85%, var(--d-ink));
  }
  /* Labels need more ink than lines to stay readable (yellow text on paper). */
  .tinted .elabel {
    fill: color-mix(in srgb, var(--ecolor) 62%, var(--d-ink));
  }
  .tinted .msg-arrow {
    stroke: color-mix(in srgb, var(--ecolor) 62%, var(--d-ink));
  }

  /* Hover: the line thickens and leans towards the accent — "click me". Never in an exported image. */
  .ln,
  .mark {
    transition: stroke var(--t), stroke-width var(--t), fill var(--t);
  }
  :global(:root:not(.exporting)) .gedge:not(.branch):hover .ln:not(.double-outer):not(.double-inner) {
    stroke-width: 2.5;
  }
  :global(:root:not(.exporting)) .gedge:not(.tinted):not(.selected):hover :is(.ln:not(.double-inner), .mark) {
    stroke: color-mix(in srgb, var(--accent) 65%, var(--edge-ink));
  }
  :global(:root:not(.exporting)) .gedge:not(.tinted):not(.selected):hover .mark.filled {
    fill: color-mix(in srgb, var(--accent) 65%, var(--edge-ink));
  }

  /* Selected: the accent on a soft accent halo; a coloured line keeps its colour on the halo. */
  .halo {
    fill: none;
    stroke: var(--selected);
    stroke-width: 10;
    stroke-linecap: round;
    stroke-linejoin: round;
  }
  .selected:not(.tinted) :is(.ln:not(.double-inner), .mark) {
    stroke: var(--accent);
  }
  .selected:not(.tinted) .mark.filled {
    fill: var(--accent);
  }
  :global(.exporting) .halo {
    display: none;
  }
  .elabel {
    font-family: var(--font);
    font-size: 12px;
    fill: var(--d-ink);
    text-anchor: middle;
    dominant-baseline: central;
    paint-order: stroke;
    stroke: var(--paper);
    stroke-width: 4px;
    stroke-linejoin: round;
  }
  .elabel.msg {
    font-size: 11.5px;
  }
  .msg-arrow {
    fill: none;
    stroke: var(--d-ink);
    stroke-width: 1.3;
  }
</style>
