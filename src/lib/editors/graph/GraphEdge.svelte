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
  }
</script>

<script lang="ts">
  import { getContext } from 'svelte';
  import { useStore, type EdgeProps } from '@xyflow/svelte';
  import { alongFrom, inset, markAt, markInset, midDirection, orthogonalRoute, outlineOf, pathOf, selfLoop, straightRoute, type Pt, type Rect, type Route } from './geometry';

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

  const route = $derived.by((): Route | null => {
    const ra = rectOf(a.current);
    const rb = rectOf(b.current);
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
    if (data.routing === 'orthogonal' && !data.offset) return orthogonalRoute(ra, rb, data.loopBack);
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

  const text = $derived([data.info.stereotype ? `«${data.info.stereotype}»` : '', data.edge.label ?? ''].filter(Boolean).join(' '));
  const labelLines = $derived(text ? text.split('\n') : []);

  /** End labels (multiplicity / role) sit beside the line, near each end. */
  const fromAt = $derived(route && data.edge.fromLabel ? alongFrom(route.points, false, 20, -12) : null);
  const toAt = $derived(route && data.edge.toLabel ? alongFrom(route.points, true, 20, 12) : null);

  /** Communication diagrams: messages grouped by direction, each group with its own arrow. */
  const msgGroups = $derived.by(() => {
    const ms = data.edge.messages ?? [];
    if (!route || !ms.length) return [];
    const dir = midDirection(route.points);
    const n = { x: -dir.y, y: dir.x };
    const groups: { arrow: Pt[]; at: Pt; lines: string[] }[] = [];
    (['forward', 'back'] as const).forEach((which, gi) => {
      const lines = ms.filter((m) => m.dir === which).map((m) => `${m.seq}${m.seq ? ': ' : ''}${m.text}`);
      if (!lines.length) return;
      const side = gi === 0 ? -1 : 1;
      const c = { x: route.mid.x + n.x * 16 * side, y: route.mid.y + n.y * 16 * side };
      const u = which === 'forward' ? dir : { x: -dir.x, y: -dir.y };
      const tail = { x: c.x - u.x * 14, y: c.y - u.y * 14 };
      const tip = { x: c.x + u.x * 14, y: c.y + u.y * 14 };
      const head = [
        { x: tip.x - u.x * 7 + n.x * 4, y: tip.y - u.y * 7 + n.y * 4 },
        tip,
        { x: tip.x - u.x * 7 - n.x * 4, y: tip.y - u.y * 7 - n.y * 4 }
      ];
      // Text block beyond the arrow, away from the line.
      const at = { x: c.x + n.x * 10 * side, y: c.y + n.y * 10 * side };
      groups.push({ arrow: [tail, tip, ...head], at, lines });
    });
    return groups;
  });
</script>

{#if route}
  <g class="gedge" class:selected class:dashed={data.info.dashed} style={data.color ? `--ecolor: ${data.color}` : undefined} role="presentation" ondblclick={(e) => { e.stopPropagation(); if (!id.startsWith('tree:')) edgeCtx?.editEdge(id); }}>
    <path class="hit" d={d} />
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
      <text class="elabel msg" x={g.at.x} y={g.at.y + (gi === 0 ? -(g.lines.length - 1) * 14 - 4 : 12)}>
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
  .selected .ln,
  .selected .mark {
    stroke: var(--accent);
  }
  .selected .mark.filled {
    fill: var(--accent);
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
