<script lang="ts" module>
  import type { GEdge as ClipEdge, GNode as ClipNode, GraphKind as Kind } from '../../model/types';
  /** Shapes copied with Ctrl+C / Ctrl+X: shared between diagrams of the same kind. */
  let shapeClipboard: { kind: string; nodes: ClipNode[]; edges: ClipEdge[]; pastes: number } | null = null;

  /** What to do first on a blank canvas, per kind. */
  const FIRST_STEP: Partial<Record<Kind, string>> = {
    usecase: 'Start with the system boundary, put the use cases inside it and the actors outside, then connect each actor to its use cases.',
    class: 'Add a class, double-click its compartments to type attributes and operations, then drag from its dot to another class.',
    activity: 'Start with an initial node, then the actions and decisions in order; swimlanes split the work by who does it.',
    state: 'Add the initial state and the states, then connect them and write "evento [guarda] / acción" on each transition.',
    communication: 'Add an actor and the objects (":Clase"), link them, then number the messages on each link in the side panel.',
    deployment: 'Add the nodes (devices, servers), then drop the execution environments and artifacts inside them.',
    architecture: 'Use + Add to pick each machine and service, and group them in zones (the building, the cloud).',
    flowchart: 'Start with a terminator, then the steps and decisions in order; a feedback line shows a loop back.',
    er: 'Add the entities, their attributes (the key underlined) and the relationships, with the cardinalities on the lines.',
    dfd: 'Start with the context: one process in the middle and the external entities around it; then the data stores and named flows.',
    screenflow: 'Add a screen per step (first line is its title; "[Botón]" and "Campo:" lines draw controls), then connect them.',
    traceability: 'Add the requirements on the left, then criteria, design elements, components and test cases, each linked to the next column.',
    conceptmap: 'Add the main concept and the related ones, and label each arrow with a linking phrase ("es un", "tiene", "causa").',
    orgchart: 'Add a role per member of the group (their name goes in the side panel), then connect each role to the one it reports to.'
  };
</script>

<script lang="ts">
  import { onDestroy, onMount, setContext, untrack } from 'svelte';
  import {
    SvelteFlow,
    Background,
    Controls,
    ConnectionMode,
    ViewportPortal,
    useSvelteFlow,
    type Node,
    type Edge,
    type NodeTypes,
    type EdgeTypes
  } from '@xyflow/svelte';
  import { app } from '../../stores/app.svelte';
  import { PALETTES, edgeTypeInfo, kindInfo, nodeTypeInfo, type NodeTypeInfo } from '../../model/kinds';
  import type { GEdge, GNode, GraphData, GraphKind } from '../../model/types';
  import { uid, blankSpec } from '../../model/diagram';
  import GraphNode, { type EditField, type GraphCtx, type GraphNodeData } from './GraphNode.svelte';
  import GraphEdge, { type GraphEdgeData } from './GraphEdge.svelte';
  import Inspector from './Inspector.svelte';
  import Toolbar from './Toolbar.svelte';
  import { mindmapLayout, mindmapRoot, childrenMap, tidy, laneLayout, traceLayout, type Size } from './layout';
  import { descendantsOf, parentsOf, type Rect } from './geometry';
  import { estimateSize, traceColumnX } from './sizing';

  const flow = useSvelteFlow();
  /** Fit leaves room for the toolbar (top) and the properties panel (right), and never blows a small diagram up. */
  const fitOptions = { padding: { top: '80px' as const, right: '40px' as const, bottom: '40px' as const, left: '40px' as const }, maxZoom: 1.1, minZoom: 0.15 };
  /** Fit the diagram; with something selected, leave room for the inspector on the right so nothing ends up under it. */
  function fitNow() {
    let right = fitOptions.padding.right as string;
    if (selNodes.length || selEdges.length) {
      const panel = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--panel-w')) || 320;
      right = `${Math.round(panel + 40)}px`;
    }
    void flow.fitView({ ...fitOptions, padding: { ...fitOptions.padding, right: right as `${number}px` }, duration: 300 });
  }
  const kind = app.doc!.kind as GraphKind;
  const palette = PALETTES[kind];
  const auto = !!palette.autoLayout;
  const data = $derived(app.doc!.data as GraphData);

  const nodeTypes = { shape: GraphNode } as unknown as NodeTypes;
  const edgeTypes = { uml: GraphEdge } as unknown as EdgeTypes;

  let nodes = $state.raw<Node<GraphNodeData>[]>([]);
  let edges = $state.raw<Edge<GraphEdgeData>[]>([]);
  let editing = $state<{ id: string; field: EditField } | null>(null);
  /** Edge type new connections get (the toolbar's relation picker). */
  let relation = $state(palette.defaultEdge);
  let wrapper = $state<HTMLDivElement | null>(null);
  /** Inspector asks for the label field to take focus (double-click on a line). */
  let focusEdgeLabel = $state(0);

  const isContainer = (n: GNode) => !!nodeTypeInfo(kind, n.type, n.icon).container;

  /* ----------------------------------------------------- model → flow */

  function sizeOf(n: GNode): Size {
    const prev = nodes.find((p) => p.id === n.id)?.measured;
    if (prev?.width && prev?.height && !auto) return { w: prev.width, h: prev.height };
    return estimateSize(kind, n, nodeTypeInfo(kind, n.type, n.icon));
  }

  function rebuild() {
    const d = $state.snapshot(data) as GraphData;
    const prev = new Map(nodes.map((n) => [n.id, n]));
    const placed = auto ? mindmapLayout(d.nodes, sizeOf) : null;
    const kids = auto ? childrenMap(d.nodes) : null;
    nodes = d.nodes.map((n) => {
      const info = nodeTypeInfo(kind, n.type, n.icon);
      const p = placed?.get(n.id);
      const old = prev.get(n.id);
      const sized = info.container || info.resizable;
      return {
        id: n.id,
        type: 'shape',
        position: p ? { x: p.x, y: p.y } : { x: n.x, y: n.y },
        ...(sized ? { width: n.w ?? info.size?.w, height: n.h ?? info.size?.h } : {}),
        data: { node: n, info, editing: editing?.id === n.id ? editing.field : null, color: p?.color, depth: p?.depth },
        selected: old?.selected ?? false,
        measured: old?.measured,
        draggable: !p,
        deletable: !(auto && n.type === 'central'),
        zIndex: info.container ? 0 : 2,
        class: info.container ? 'is-container' : undefined
      } satisfies Node<GraphNodeData>;
    });
    // Containers first so they never cover what's inside them.
    // Bigger containers first, so one nested in another is drawn (and clicked) on top of it.
    const area = (n: Node) => (n.width ?? 0) * (n.height ?? 0);
    nodes = [...nodes.filter((n) => n.zIndex === 0).sort((a, b) => area(b) - area(a)), ...nodes.filter((n) => n.zIndex !== 0)];

    const shapeOf = new Map(d.nodes.map((n) => [n.id, nodeTypeInfo(kind, n.type, n.icon).shape]));
    const prevEdges = new Map(edges.map((e) => [e.id, e]));
    const pairCount = new Map<string, number>();
    const pairSeen = new Map<string, number>();
    const pairKey = (e: GEdge) => [e.from, e.to].sort().join('|');
    for (const e of d.edges) pairCount.set(pairKey(e), (pairCount.get(pairKey(e)) ?? 0) + 1);
    // Lines leaving the same shape, in order of where they go: each gets its own track.
    const bySource = new Map<string, GEdge[]>();
    for (const e of d.edges) {
      if (!bySource.has(e.from)) bySource.set(e.from, []);
      bySource.get(e.from)!.push(e);
    }
    const posOf = new Map(d.nodes.map((n) => [n.id, n.x + n.y * 0.001]));
    const spreadOf = new Map<string, number>();
    for (const list of bySource.values()) {
      if (list.length < 2) continue;
      list.sort((a, b) => (posOf.get(a.to) ?? 0) - (posOf.get(b.to) ?? 0));
      list.forEach((e, k) => spreadOf.set(e.id, (k - (list.length - 1) / 2) * 10));
    }
    const out: Edge<GraphEdgeData>[] = d.edges.map((e) => {
      const k = pairKey(e);
      const count = pairCount.get(k)!;
      const idx = pairSeen.get(k) ?? 0;
      pairSeen.set(k, idx + 1);
      // Spread parallel lines symmetrically; flip for edges drawn the other way.
      const sign = e.from < e.to ? 1 : -1;
      const offset = count > 1 ? (idx - (count - 1) / 2) * 22 * sign : 0;
      const info = edgeTypeInfo(kind, e.type);
      const fromType = d.nodes.find((n) => n.id === e.from)?.type;
      const toType = d.nodes.find((n) => n.id === e.to)?.type;
      return {
        id: e.id,
        source: e.from,
        target: e.to,
        type: 'uml',
        zIndex: 1,
        selected: prevEdges.get(e.id)?.selected ?? false,
        data: {
          edge: e,
          info,
          routing: d.routing,
          fromShape: shapeOf.get(e.from) ?? 'rect',
          toShape: shapeOf.get(e.to) ?? 'rect',
          offset,
          style: kind === 'traceability' && fromType === 'req' && toType === 'criterion' ? 'tree' : undefined,
          double: e.type === 'total',
          loopBack: kind === 'activity' || kind === 'flowchart',
          spread: spreadOf.get(e.id)
        }
      };
    });
    if (auto && kids) {
      const root = mindmapRoot(d.nodes);
      for (const n of d.nodes) {
        if (!n.parent || n.id === root?.id) continue;
        out.unshift({
          id: `tree:${n.id}`,
          source: n.parent,
          target: n.id,
          type: 'uml',
          zIndex: 1,
          selectable: false,
          deletable: false,
          focusable: false,
          data: {
            edge: { id: `tree:${n.id}`, type: 'branch', from: n.parent, to: n.id },
            info: { type: 'branch', label: 'Branch', es: 'Rama', end: 'none' },
            routing: 'straight',
            fromShape: 'topic',
            toShape: 'topic',
            offset: 0,
            style: 'branch',
            color: placed?.get(n.id)?.color
          }
        });
      }
    }
    edges = out;
  }

  // Rebuild whenever the diagram or the edit state changes.
  $effect(() => {
    JSON.stringify(data);
    editing;
    untrack(rebuild);
  });

  /* ----------------------------------------------------- selection */

  const selNodes = $derived(nodes.filter((n) => n.selected).map((n) => n.id));
  const selEdges = $derived(edges.filter((e) => e.selected && !e.id.startsWith('tree:')).map((e) => e.id));

  function select(nodeIds: string[], edgeIds: string[] = []) {
    const ns = new Set(nodeIds);
    const es = new Set(edgeIds);
    nodes = nodes.map((n) => (n.selected === ns.has(n.id) ? n : { ...n, selected: ns.has(n.id) }));
    edges = edges.map((e) => (e.selected === es.has(e.id) ? e : { ...e, selected: es.has(e.id) }));
  }

  /* ----------------------------------------------------- helpers */

  function rects(): Map<string, Rect> {
    const m = new Map<string, Rect>();
    for (const n of nodes) {
      const w = n.measured?.width ?? n.width ?? 0;
      const h = n.measured?.height ?? n.height ?? 0;
      m.set(n.id, { x: n.position.x, y: n.position.y, w, h });
    }
    return m;
  }

  function containerIds(): Set<string> {
    return new Set(data.nodes.filter(isContainer).map((n) => n.id));
  }

  function viewCenter(): { x: number; y: number } {
    const r = wrapper?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return flow.screenToFlowPosition({ x: r.left + r.width * 0.42, y: r.top + r.height / 2 });
  }

  /** Nudge a new shape so it doesn't land exactly on another one. */
  /** The nearest spot to (x, y) where a w×h shape overlaps no other (non-container) shape. */
  function freeSpot(x: number, y: number, w = 120, h = 50): { x: number; y: number } {
    const r = rects();
    const solid = data.nodes.filter((n) => !isContainer(n)).map((n) => r.get(n.id) ?? { x: n.x, y: n.y, w: 120, h: 50 });
    const free = (px: number, py: number) => !solid.some((o) => px < o.x + o.w + 16 && o.x < px + w + 16 && py < o.y + o.h + 16 && o.y < py + h + 16);
    const snap = (v: number) => Math.round(v / 10) * 10;
    if (free(x, y)) return { x: snap(x), y: snap(y) };
    // Spiral outwards: right, down, left, up, in growing rings.
    for (let ring = 1; ring < 30; ring++) {
      const d = ring * 40;
      for (const [dx, dy] of [[d, 0], [0, d], [d, d], [-d, 0], [0, -d], [-d, d], [d, -d], [-d, -d]]) {
        if (free(x + dx, y + dy)) return { x: snap(x + dx), y: snap(y + dy) };
      }
    }
    return { x: snap(x), y: snap(y) };
  }

  /** Pan (keeping the zoom) so a shape is on screen and clear of the inspector. */
  function ensureVisible(id: string, tries = 0) {
    const n = flow.getInternalNode(id);
    const r = wrapper?.getBoundingClientRect();
    if (!r) return;
    if (!n?.measured?.width) {
      if (tries < 10) setTimeout(() => ensureVisible(id, tries + 1), 40);
      return;
    }
    const p = n.internals.positionAbsolute;
    const w = n.measured.width;
    const h = n.measured.height ?? 0;
    const tl = flow.flowToScreenPosition({ x: p.x, y: p.y });
    const br = flow.flowToScreenPosition({ x: p.x + w, y: p.y + h });
    const right = r.right - 380;
    if (tl.x >= r.left + 20 && br.x <= right && tl.y >= r.top + 70 && br.y <= r.bottom - 20) return;
    const vp = flow.getViewport();
    const cx = p.x + w / 2;
    const cy = p.y + h / 2;
    // Centre it in the part of the canvas the inspector doesn't cover.
    const screenCx = (r.left + right) / 2 - r.left;
    const screenCy = r.height / 2;
    void flow.setViewport({ x: screenCx - cx * vp.zoom, y: screenCy - cy * vp.zoom, zoom: vp.zoom }, { duration: 250 });
  }

  /* ----------------------------------------------------- mutations */

  function addNode(t: NodeTypeInfo, at?: { x: number; y: number }) {
    const id = uid();
    const size = t.size ?? estimateSize(kind, { id, type: t.type, x: 0, y: 0, label: t.defaultLabel }, t);
    let pos = at ? { x: at.x - size.w / 2, y: at.y - size.h / 2 } : (() => {
      const c = viewCenter();
      return { x: c.x - size.w / 2, y: c.y - size.h / 2 };
    })();
    if (kind === 'traceability' && t.column !== undefined) pos = traceColumnX(data.nodes, t, (n) => nodeTypeInfo(kind, n.type), size);
    let spot = t.container ? { x: Math.round(pos.x / 10) * 10, y: Math.round(pos.y / 10) * 10 } : kind === 'traceability' ? pos : freeSpot(pos.x, pos.y, size.w, size.h);
    if (t.container) {
      // A second swimlane / zone goes next to the last one instead of exactly on top of it.
      const same = data.nodes.filter((n) => isContainer(n) && n.type === t.type);
      if (same.some((n) => Math.abs(n.x - spot.x) < 20 && Math.abs(n.y - spot.y) < 20)) {
        const last = same.reduce((a, b) => (b.x + (b.w ?? 0) > a.x + (a.w ?? 0) ? b : a));
        spot = { x: last.x + (last.w ?? 200) + (t.type === 'partition' || t.type === 'lane' ? 0 : 40), y: last.y };
      }
    }
    const node: GNode = { id, type: t.type, x: spot.x, y: spot.y, label: t.defaultLabel };
    if (t.container || t.resizable) Object.assign(node, { w: t.size?.w ?? 200, h: t.size?.h ?? 120 });
    if (t.presetIcon) node.icon = t.presetIcon;
    if (t.type === 'usecase') node.spec = blankSpec();
    if (t.type === 'class') Object.assign(node, { attrs: ['- atributo: Tipo'], ops: ['+ operacion(): void'] });
    if (t.type === 'interface') Object.assign(node, { attrs: [], ops: ['+ operacion(): void'] });
    if (t.type === 'enum') Object.assign(node, { attrs: ['VALOR_A', 'VALOR_B'], ops: [] });
    if (auto && t.type === 'topic') {
      const parent = selNodes.length === 1 ? selNodes[0] : mindmapRoot(data.nodes)?.id;
      return addChild(parent!, t.defaultLabel);
    }
    app.change((d) => {
      (d.data as GraphData).nodes.push(node);
      // A new container goes behind: move it before what it will hold.
      if (t.container) {
        const list = (d.data as GraphData).nodes;
        list.unshift(list.pop()!);
      }
    });
    queueMicrotask(() => {
      select([id]);
      // Name it straight away (containers too); the toolbar button lets go of the keyboard.
      (document.activeElement as HTMLElement | null)?.blur?.();
      if (t.shape !== 'initial' && t.shape !== 'final' && t.shape !== 'flowFinal' && t.shape !== 'bar' && t.shape !== 'lollipop') editing = { id, field: 'label' };
    });
  }

  function addChild(requested: string, label = '') {
    // Ideas hang only from ideas; a note (or anything else) means "the central idea".
    const p = data.nodes.find((n) => n.id === requested);
    const parentId = p && (p.type === 'topic' || p.type === 'central') ? requested : mindmapRoot(data.nodes)?.id;
    if (!parentId) return;
    const id = uid();
    app.change((d) => {
      const g = d.data as GraphData;
      const siblings = g.nodes.filter((n) => n.parent === parentId);
      const order = siblings.length ? Math.max(...siblings.map((x) => x.order ?? 0)) + 1 : 0;
      g.nodes.push({ id, type: 'topic', x: 0, y: 0, label, parent: parentId, order });
    });
    queueMicrotask(() => {
      select([id]);
      editing = { id, field: 'label' };
      ensureVisible(id);
    });
  }

  function addSibling(of: string) {
    const n = data.nodes.find((x) => x.id === of);
    if (!n?.parent || n.type !== 'topic') return addChild(of);
    const id = uid();
    app.change((d) => {
      const g = d.data as GraphData;
      const order = (n.order ?? 0) + 0.5;
      g.nodes.push({ id, type: 'topic', x: 0, y: 0, label: '', parent: n.parent, order });
      g.nodes.filter((x) => x.parent === n.parent).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).forEach((x, i) => (x.order = i));
    });
    queueMicrotask(() => {
      select([id]);
      editing = { id, field: 'label' };
      ensureVisible(id);
    });
  }

  function connect(from: string, to: string) {
    if (auto && relation === 'crosslink' && from === to) return;
    const fromNode = data.nodes.find((n) => n.id === from);
    const toNode = data.nodes.find((n) => n.id === to);
    if ((kind === 'state' || kind === 'activity') && (fromNode?.type === 'final' || fromNode?.type === 'flowFinal')) {
      app.notify('Nothing can leave a final node in UML — draw the line the other way.');
      return;
    }
    if ((kind === 'state' || kind === 'activity') && toNode?.type === 'initial') {
      app.notify('Nothing can arrive at an initial node in UML — draw the line the other way.');
      return;
    }
    const id = uid();
    const t = edgeTypeInfo(kind, relation);
    const e: GEdge = { id, type: t.type, from, to };
    if (t.messages) e.messages = [];
    app.change((d) => (d.data as GraphData).edges.push(e));
    queueMicrotask(() => select([], [id]));
  }

  function removeIds(nodeIds: string[], edgeIds: string[]) {
    if (!nodeIds.length && !edgeIds.length) return;
    const gone = new Set(nodeIds);
    if (auto) {
      // Deleting an idea deletes its branch; the central idea stays.
      const kids = childrenMap(data.nodes);
      const walk = (id: string) => (kids.get(id) ?? []).forEach((c) => (gone.add(c.id), walk(c.id)));
      nodeIds.forEach(walk);
      const root = mindmapRoot(data.nodes);
      if (root) gone.delete(root.id);
    }
    const ge = new Set(edgeIds);
    app.change((d) => {
      const g = d.data as GraphData;
      g.nodes = g.nodes.filter((n) => !gone.has(n.id));
      g.edges = g.edges.filter((e) => !ge.has(e.id) && !gone.has(e.from) && !gone.has(e.to));
    });
  }

  function duplicateSelection() {
    if (auto || !selNodes.length) return;
    const map = new Map<string, string>();
    const copies: GNode[] = [];
    for (const id of selNodes) {
      const n = data.nodes.find((x) => x.id === id);
      if (!n) continue;
      const nid = uid();
      map.set(id, nid);
      copies.push({ ...($state.snapshot(n) as GNode), id: nid, x: n.x + 30, y: n.y + 30 });
    }
    const edgeCopies = data.edges.filter((e) => map.has(e.from) && map.has(e.to)).map((e) => ({ ...($state.snapshot(e) as GEdge), id: uid(), from: map.get(e.from)!, to: map.get(e.to)! }));
    app.change((d) => {
      (d.data as GraphData).nodes.push(...copies);
      (d.data as GraphData).edges.push(...edgeCopies);
    });
    queueMicrotask(() => select([...map.values()]));
  }

  function copySelection(cut: boolean) {
    if (auto || !selNodes.length) return;
    const ids = new Set(selNodes);
    const ns = data.nodes.filter((n) => ids.has(n.id)).map((n) => $state.snapshot(n) as GNode);
    const es = data.edges.filter((e) => ids.has(e.from) && ids.has(e.to)).map((e) => $state.snapshot(e) as GEdge);
    shapeClipboard = { kind, nodes: ns, edges: es, pastes: 0 };
    if (cut) removeIds(selNodes, []);
    app.notify(`${cut ? 'Cut' : 'Copied'} ${ns.length} shape${ns.length === 1 ? '' : 's'}.`);
  }

  function paste() {
    if (auto || !shapeClipboard || shapeClipboard.kind !== kind) return;
    const clip = shapeClipboard;
    clip.pastes++;
    const off = 30 * clip.pastes;
    const map = new Map<string, string>();
    for (const n of clip.nodes) map.set(n.id, uid());
    const ns = clip.nodes.map((n) => ({ ...structuredClone(n), id: map.get(n.id)!, x: n.x + off, y: n.y + off }));
    const es = clip.edges.map((e) => ({ ...structuredClone(e), id: uid(), from: map.get(e.from)!, to: map.get(e.to)! }));
    app.change((d) => {
      const g = d.data as GraphData;
      // Containers go first so they stay behind what they hold.
      g.nodes.unshift(...ns.filter((n) => isContainer(n)));
      g.nodes.push(...ns.filter((n) => !isContainer(n)));
      g.edges.push(...es);
    });
    queueMicrotask(() => select([...map.values()]));
  }

  function nudge(dx: number, dy: number) {
    if (auto || !selNodes.length) return;
    const parents = parentsOf(rects(), containerIds());
    const moving = new Set(selNodes.flatMap((id) => [id, ...descendantsOf(id, parents)]));
    app.change((d) => {
      for (const n of (d.data as GraphData).nodes) if (moving.has(n.id)) {
        n.x += dx;
        n.y += dy;
      }
    }, `nudge:${selNodes.join(',')}`);
  }

  /* ----------------------------------------------------- editing context */

  const ctx: GraphCtx = {
    startEdit(id, field) {
      select([id]);
      editing = { id, field };
    },
    commitEdit(id, field, value, next) {
      const n = data.nodes.find((x) => x.id === id);
      editing = null;
      if (n) {
        const current = field === 'label' ? n.label : (n[field] ?? []).join('\n');
        if (current !== value) {
          app.change((d) => {
            const m = (d.data as GraphData).nodes.find((x) => x.id === id);
            if (!m) return;
            if (field === 'label') m.label = value.replace(/\s+$/, '');
            else m[field] = value.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim());
          });
        }
      }
      if (next === 'child') addChild(id);
      else if (next === 'sibling') addSibling(id);
    },
    cancelEdit() {
      editing = null;
    }
  };
  setContext('graph', ctx);
  setContext('graph-edge', {
    editEdge(id: string) {
      select([], [id]);
      focusEdgeLabel++;
    }
  });

  /* ----------------------------------------------------- flow events */

  let dragKids: { ids: string[]; start: Map<string, { x: number; y: number }>; origin: { x: number; y: number } } | null = null;

  function onDragStart({ targetNode, nodes: dragged }: { targetNode: Node | null; nodes: Node[] }) {
    editing = null;
    dragKids = null;
    const draggedIds = new Set(dragged.map((n) => n.id));
    const containers = dragged.filter((n) => (n.data as GraphNodeData).info.container);
    if (!containers.length || !targetNode) return;
    const parents = parentsOf(rects(), containerIds());
    const ids = [...new Set(containers.flatMap((c) => descendantsOf(c.id, parents)))].filter((id) => !draggedIds.has(id));
    const start = new Map(nodes.filter((n) => ids.includes(n.id)).map((n) => [n.id, { ...n.position }]));
    dragKids = { ids, start, origin: { ...targetNode.position } };
  }

  function onDrag({ targetNode }: { targetNode: Node | null }) {
    if (!dragKids || !targetNode) return;
    const dx = targetNode.position.x - dragKids.origin.x;
    const dy = targetNode.position.y - dragKids.origin.y;
    const ids = new Set(dragKids.ids);
    nodes = nodes.map((n) => (ids.has(n.id) ? { ...n, position: { x: dragKids!.start.get(n.id)!.x + dx, y: dragKids!.start.get(n.id)!.y + dy } } : n));
  }

  function onDragStop({ nodes: dragged }: { nodes: Node[] }) {
    const moved = new Map<string, { x: number; y: number }>();
    for (const n of dragged) moved.set(n.id, n.position);
    if (dragKids) for (const id of dragKids.ids) {
      const n = nodes.find((x) => x.id === id);
      if (n) moved.set(id, n.position);
    }
    dragKids = null;
    const changed = [...moved].some(([id, p]) => {
      const m = data.nodes.find((n) => n.id === id);
      return m && (Math.round(m.x) !== Math.round(p.x) || Math.round(m.y) !== Math.round(p.y));
    });
    if (!changed) return;
    app.change((d) => {
      for (const n of (d.data as GraphData).nodes) {
        const p = moved.get(n.id);
        if (p) {
          n.x = Math.round(p.x);
          n.y = Math.round(p.y);
        }
      }
    });
  }

  function onConnectEnd(event: MouseEvent | TouchEvent, state: { fromNode: { id: string } | null; toNode: { id: string } | null }) {
    const from = state.fromNode?.id;
    if (!from) return;
    let to = state.toNode?.id;
    if (!to) {
      const pt = 'changedTouches' in event ? event.changedTouches[0] : event;
      // The topmost shape under the pointer that isn't a container, else a container.
      const hits = document.elementsFromPoint(pt.clientX, pt.clientY).map((el) => el.closest<HTMLElement>('.svelte-flow__node')).filter((el): el is HTMLElement => !!el);
      const hit = hits.find((el) => !el.classList.contains('is-container')) ?? hits[0];
      to = hit?.dataset.id;
      // Letting go over the shape you started from is a cancelled drag, not a loop (except in state machines).
      if (to === from && kind !== 'state') return;
    }
    if (to) connect(from, to);
  }

  function onDelete({ nodes: ns, edges: es }: { nodes: Node[]; edges: Edge[] }) {
    removeIds(
      ns.map((n) => n.id),
      es.map((e) => e.id).filter((id) => !id.startsWith('tree:'))
    );
  }

  /** Resizing a container or note (from GraphNode's NodeResizer). */
  setContext('graph-resize', (id: string, r: { x: number; y: number; width: number; height: number }) => {
    app.change((d) => {
      const n = (d.data as GraphData).nodes.find((x) => x.id === id);
      if (n) Object.assign(n, { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) });
    });
  });

  function onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    // Canvas keys only when the canvas (or nothing in particular) has focus, so Tab / Enter still work on buttons.
    if (t !== document.body && !t.closest('.svelte-flow')) return;
    if (document.querySelector('[aria-modal="true"]')) return;
    const one = selNodes.length === 1 ? selNodes[0] : null;
    const mod = e.ctrlKey || e.metaKey;
    if (auto && one && e.key === 'Tab') {
      e.preventDefault();
      addChild(one);
    } else if (auto && one && e.key === 'Enter') {
      e.preventDefault();
      addSibling(one);
    } else if (one && (e.key === 'F2' || (!auto && e.key === 'Enter'))) {
      e.preventDefault();
      editing = { id: one, field: 'label' };
    } else if (mod && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      duplicateSelection();
    } else if (mod && !e.shiftKey && (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'x')) {
      if (!selNodes.length) return;
      e.preventDefault();
      copySelection(e.key.toLowerCase() === 'x');
    } else if (mod && e.key.toLowerCase() === 'v') {
      if (!shapeClipboard || shapeClipboard.kind !== kind) return;
      e.preventDefault();
      paste();
    } else if (mod && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      select(nodes.map((n) => n.id), edges.filter((x) => !x.id.startsWith('tree:')).map((x) => x.id));
    } else if (e.key.startsWith('Arrow') && selNodes.length && !mod) {
      e.preventDefault();
      const step = e.shiftKey ? 1 : 10;
      const [dx, dy] = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key as 'ArrowLeft']!;
      nudge(dx, dy);
    } else if (e.key === 'Escape') {
      editing = null;
      select([]);
    }
  }

  /* ----------------------------------------------------- tidy */

  async function runTidy() {
    if (auto) {
      fitNow();
      return;
    }
    const r = rects();
    const box = (n: GNode) => {
      const rr = r.get(n.id)!;
      return { id: n.id, type: n.type, x: n.x, y: n.y, w: rr.w || 120, h: rr.h || 50 };
    };
    const parents = parentsOf(r, containerIds());
    let laid: Map<string, { x: number; y: number; w?: number; h?: number }>;
    const lanes = data.nodes.filter((n) => isContainer(n) && (n.type === 'partition' || n.type === 'lane'));
    if (kind === 'traceability') {
      laid = traceLayout(data.nodes.filter((n) => n.type !== 'note').map(box), (t) => nodeTypeInfo(kind, t).column, data.edges);
    } else if (lanes.length) {
      // Keep the swimlanes as columns: rows come from a flat top-down layout, columns from the lanes.
      const shapes = data.nodes.filter((n) => !isContainer(n));
      const flat = await tidy(kind, shapes.map((n) => ({ ...box(n), container: false, parent: null })), data.edges);
      const laneIds = new Set(lanes.map((l) => l.id));
      const laneOf = new Map<string, string | null>();
      for (const n of shapes) {
        let p = parents.get(n.id) ?? null;
        while (p && !laneIds.has(p)) p = parents.get(p) ?? null;
        laneOf.set(n.id, p);
      }
      laid = laneLayout(lanes.map(box), shapes.map(box), laneOf, flat);
    } else {
      laid = await tidy(
        kind,
        data.nodes.map((n) => ({ ...box(n), container: !!nodeTypeInfo(kind, n.type, n.icon).container, parent: parents.get(n.id) ?? null })),
        data.edges
      );
    }
    app.change((d) => {
      for (const n of (d.data as GraphData).nodes) {
        const p = laid.get(n.id);
        if (!p) continue;
        n.x = p.x;
        n.y = p.y;
        if (isContainer(n) && p.w && p.h) {
          n.w = Math.round(p.w);
          n.h = Math.round(p.h);
        }
      }
    });
    setTimeout(fitNow, 60);
  }

  /* ----------------------------------------------------- palette drag */

  function dropAt(t: NodeTypeInfo, clientX: number, clientY: number) {
    const r = wrapper?.getBoundingClientRect();
    if (!r || clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return false;
    addNode(t, flow.screenToFlowPosition({ x: clientX, y: clientY }));
    return true;
  }

  function onPaneDbl(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('svelte-flow__pane')) return;
    const pos = flow.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    if (auto) {
      const root = mindmapRoot(data.nodes);
      if (root) addChild(root.id);
      return;
    }
    // The main shape of the kind (first non-container in the palette).
    const t = palette.nodes.find((n) => !n.container && !n.hidden && n.shape !== 'initial' && n.shape !== 'actor') ?? palette.nodes[0];
    addNode(t, pos);
  }

  /* ----------------------------------------------------- export */

  onMount(() => {
    app.setImageSource(() => {
      const el = wrapper!.querySelector<HTMLElement>('.svelte-flow__viewport')!;
      const b = flow.getNodesBounds(nodes.map((n) => n.id));
      const pad = 40;
      return {
        el,
        width: b.width + pad * 2,
        height: b.height + pad * 2,
        style: { width: `${b.width + pad * 2}px`, height: `${b.height + pad * 2}px`, transform: `translate(${pad - b.x}px, ${pad - b.y}px) scale(1)` }
      };
    });
  });
  onDestroy(() => app.setImageSource(null));

  /* ----------------------------------------------------- traceability headers */

  const headers = $derived.by(() => {
    if (kind !== 'traceability') return [];
    const cols = new Map<number, { x: number; y: number; label: string }>();
    for (const n of data.nodes) {
      const info = nodeTypeInfo(kind, n.type);
      if (info.column === undefined) continue;
      const c = cols.get(info.column);
      const label = ['Requisitos', 'Elementos de diseño', 'Componentes software', 'Casos de prueba'][info.column];
      if (!c) cols.set(info.column, { x: n.x, y: n.y, label });
      else cols.set(info.column, { x: Math.min(c.x, n.x), y: Math.min(c.y, n.y), label });
    }
    const top = Math.min(...[...cols.values()].map((c) => c.y));
    return [...cols.values()].map((c) => ({ ...c, y: top - 34 }));
  });

  const empty = $derived(data.nodes.length === 0);
  const selectedNode = $derived(selNodes.length === 1 ? data.nodes.find((n) => n.id === selNodes[0]) : undefined);
</script>

<svelte:window onkeydown={onKey} />

<div class="canvas" bind:this={wrapper} ondblclick={onPaneDbl} role="application" aria-label="{kindInfo(kind).label} canvas">
  <SvelteFlow
    bind:nodes
    bind:edges
    {nodeTypes}
    {edgeTypes}
    fitView={data.nodes.length > 0}
    fitViewOptions={fitOptions}
    minZoom={0.15}
    maxZoom={3}
    snapGrid={[10, 10]}
    connectionMode={ConnectionMode.Loose}
    connectionRadius={24}
    elevateNodesOnSelect={false}
    elevateEdgesOnSelect={false}
    zoomOnDoubleClick={false}
    selectionKey="Shift"
    multiSelectionKey={['Control', 'Meta', 'Shift']}
    deleteKey={['Delete', 'Backspace']}
    nodeDragThreshold={2}
    onnodedragstart={onDragStart}
    onnodedrag={onDrag}
    onnodedragstop={onDragStop}
    onconnectend={onConnectEnd}
    ondelete={onDelete}
    onpaneclick={() => (editing = null)}
  >
    <Background gap={20} size={1.2} />
    <Controls showLock={false} position="bottom-left" />
    {#if headers.length}
      <ViewportPortal target="front">
        {#each headers as h (h.label)}
          <div class="col-head" style:transform="translate({h.x}px, {h.y}px)">{h.label}</div>
        {/each}
      </ViewportPortal>
    {/if}
  </SvelteFlow>

  <Toolbar {kind} {palette} bind:relation onAdd={(t) => addNode(t)} onDrop={dropAt} onTidy={runTidy} onFit={fitNow} routing={data.routing} panelOpen={selNodes.length + selEdges.length > 0} />

  {#if empty}
    <div class="empty-hint"><div class="stack">
      <p><strong>{kindInfo(kind).es}</strong></p>
      {#if FIRST_STEP[kind]}<p class="small first">{FIRST_STEP[kind]}</p>{/if}
      <p class="small">Add shapes from the toolbar (or double-click the canvas), then drag from the dot on a shape to another one to connect them.</p>
    </div></div>
  {/if}

  <Inspector {kind} nodeIds={selNodes} edgeIds={selEdges} {focusEdgeLabel} onDelete={() => removeIds(selNodes, selEdges)} onAddChild={addChild} onAddSibling={addSibling} {selectedNode} />
</div>

<style>
  .first {
    max-width: 460px;
    margin-inline: auto;
    color: var(--ink-2);
  }
  .canvas {
    position: absolute;
    inset: 0;
  }
  .canvas :global(.svelte-flow__node.selected),
  .canvas :global(.svelte-flow__node:focus-visible) {
    outline: none;
  }
  .canvas :global(.svelte-flow__node.is-container) {
    /* Containers only catch the pointer on their frame and title, so shapes inside stay clickable. */
    pointer-events: all;
  }
  .canvas :global(.svelte-flow__edge .gedge) {
    cursor: pointer;
  }
  .canvas :global(.svelte-flow__controls) {
    margin: var(--edge);
  }
  .col-head {
    position: absolute;
    left: 0;
    top: 0;
    font-size: 13px;
    font-weight: 700;
    color: var(--d-ink);
    white-space: nowrap;
    pointer-events: none;
  }
</style>
