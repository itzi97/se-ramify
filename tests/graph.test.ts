import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boundaryPoint, orthogonalRoute, straightRoute, parentsOf, descendantsOf, markAt, inset } from '../src/lib/editors/graph/geometry';
import { mindmapLayout } from '../src/lib/editors/graph/layout';
import { graphExample } from '../src/lib/editors/graph/examples';
import { graphExports, traceRows, useCaseSpecsMarkdown } from '../src/lib/editors/graph/export';
import { newDiagram } from '../src/lib/model/diagram';
import { PALETTES, KINDS } from '../src/lib/model/kinds';
import type { DiagramOf, GraphKind } from '../src/lib/model/types';

const near = (a: number, b: number, eps = 0.5) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('lines end on the outline of each shape', () => {
  const r = { x: 0, y: 0, w: 100, h: 50 };
  const right = boundaryPoint(r, 'rect', { x: 500, y: 25 });
  near(right.x, 100);
  near(right.y, 25);
  const top = boundaryPoint(r, 'ellipse', { x: 50, y: -500 });
  near(top.x, 50);
  near(top.y, 0);
  const diag = boundaryPoint({ x: 0, y: 0, w: 100, h: 100 }, 'diamond', { x: 1000, y: 1000 });
  near(diag.x, 75);
  near(diag.y, 75);
});

test('straight route joins the two outlines; offset lines stay parallel', () => {
  const a = { x: 0, y: 0, w: 100, h: 50 };
  const b = { x: 300, y: 0, w: 100, h: 50 };
  const r = straightRoute(a, 'rect', b, 'rect');
  near(r.points[0].x, 100);
  near(r.points[1].x, 300);
  const o = straightRoute(a, 'rect', b, 'rect', 10);
  near(o.points[0].y - o.points[1].y, 0);
  assert.ok(Math.abs(o.points[0].y - 25) > 5);
});

test('orthogonal route only turns at right angles', () => {
  const r = orthogonalRoute({ x: 0, y: 0, w: 100, h: 50 }, { x: 300, y: 200, w: 100, h: 50 });
  for (let i = 1; i < r.points.length; i++) {
    const p = r.points[i - 1];
    const q = r.points[i];
    assert.ok(p.x === q.x || p.y === q.y, 'segment is axis-aligned');
  }
  const back = orthogonalRoute({ x: 0, y: 300, w: 100, h: 50 }, { x: 0, y: 0, w: 100, h: 50 }, true);
  assert.ok(back.points.every((p) => p.x >= 100), 'loop-back goes round the right side');
});

test('marks point along the line and lines stop short of hollow marks', () => {
  const m = markAt('triangle', { x: 100, y: 0 }, { x: 0, y: 0 })!;
  assert.equal(m.points[0].x, 100);
  assert.ok(m.points[1].x < 100 && m.points[2].x < 100);
  const pts = inset([{ x: 0, y: 0 }, { x: 100, y: 0 }], 0, 14);
  near(pts[1].x, 86);
});

test('containment finds the smallest container, at any depth', () => {
  const rects = new Map([
    ['big', { x: 0, y: 0, w: 500, h: 500 }],
    ['small', { x: 50, y: 50, w: 200, h: 200 }],
    ['leaf', { x: 60, y: 60, w: 50, h: 30 }],
    ['out', { x: 600, y: 0, w: 50, h: 30 }]
  ]);
  const parents = parentsOf(rects, new Set(['big', 'small']));
  assert.equal(parents.get('leaf'), 'small');
  assert.equal(parents.get('small'), 'big');
  assert.equal(parents.get('out'), null);
  assert.deepEqual(descendantsOf('big', parents).sort(), ['leaf', 'small']);
});

test('mind map: every idea placed, branches on both sides, no overlaps', () => {
  const g = graphExample('mindmap');
  const size = () => ({ w: 100, h: 30 });
  const placed = mindmapLayout(g.nodes, size);
  assert.equal(placed.size, g.nodes.length);
  const sides = new Set([...placed.values()].map((p) => p.side).filter(Boolean));
  assert.deepEqual([...sides].sort(), ['left', 'right']);
  const boxes = [...placed.values()];
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const overlap = a.x < b.x + 100 && b.x < a.x + 100 && a.y < b.y + 30 && b.y < a.y + 30;
      assert.ok(!overlap, 'ideas overlap');
    }
});

test('every canvas kind has an example whose edges point at real nodes, and its exports build', () => {
  for (const k of KINDS.filter((x) => x.family === 'graph')) {
    const kind = k.kind as GraphKind;
    const data = graphExample(kind);
    const ids = new Set(data.nodes.map((n) => n.id));
    assert.ok(data.nodes.length > 0, `${kind} example is empty`);
    for (const e of data.edges) assert.ok(ids.has(e.from) && ids.has(e.to), `${kind}: dangling edge`);
    const types = new Set(PALETTES[kind].nodes.map((n) => n.type));
    for (const n of data.nodes) assert.ok(types.has(n.type), `${kind}: unknown node type ${n.type}`);
    const doc = newDiagram(kind, 'T', '', data as never) as DiagramOf<GraphKind>;
    const xs = graphExports(doc);
    assert.ok(xs.length > 0, `${kind} has no text export`);
    for (const x of xs) assert.ok(x.build().length > 20, `${kind}: ${x.label} is empty`);
  }
});

test('PlantUML for the use case example nests use cases in the system and marks «include»', () => {
  const doc = newDiagram('usecase', 'T', '', graphExample('usecase') as never) as DiagramOf<'usecase'>;
  const text = graphExports(doc)[0].build();
  assert.match(text, /^@startuml/);
  assert.match(text, /rectangle "Sistema de préstamos — Biblioteca" as S\d+ \{\n {2}usecase/);
  assert.match(text, /\.\.> UC\d+ : <<include>>/);
  assert.match(text, /@enduml$/);
  const specs = useCaseSpecsMarkdown(doc);
  assert.match(specs, /## CU-02 Reservar libro/);
  assert.match(specs, /1\. El socio busca el libro\.<br>2\. /);
});

test('class PlantUML uses UML arrows', () => {
  const doc = newDiagram('class', 'T', '', graphExample('class') as never) as DiagramOf<'class'>;
  const text = graphExports(doc)[0].build();
  assert.match(text, /abstract class "Material"/);
  assert.match(text, /enum "EstadoEjemplar"/);
  assert.match(text, /\*-- /);
  assert.match(text, /--\|> /);
  assert.match(text, /\.\.\|> /);
});

test('traceability rows follow requirement → design → component → tests', () => {
  const rows = traceRows(graphExample('traceability'));
  const rq2 = rows.filter((r) => r[0].startsWith('RQ2'));
  assert.ok(rq2.some((r) => r[3].startsWith('CS2') && r[4] === 'TC2, TC3'));
  assert.ok(rq2[0][1].includes('CA2.1'));
});

test('state export keeps inner start / end states inside their composite', () => {
  const g = {
    routing: 'straight' as const,
    nodes: [
      { id: 'i0', type: 'initial', x: 0, y: 0, label: '' },
      { id: 'c', type: 'composite', x: 100, y: 0, w: 400, h: 300, label: 'Activo' },
      { id: 'i1', type: 'initial', x: 120, y: 60, label: '' },
      { id: 'a', type: 'state', x: 200, y: 50, label: 'A' },
      { id: 'f1', type: 'final', x: 400, y: 60, label: '' }
    ],
    edges: [
      { id: 'e0', type: 'transition', from: 'i0', to: 'c' },
      { id: 'e1', type: 'transition', from: 'i1', to: 'a' },
      { id: 'e2', type: 'transition', from: 'a', to: 'f1', label: 'fin' }
    ]
  };
  const doc = newDiagram('state', 'T', '', g as never) as DiagramOf<'state'>;
  const text = graphExports(doc)[0].build();
  const inner = text.slice(text.indexOf('state "Activo"'), text.lastIndexOf('}'));
  assert.match(inner, /\[\*\] --> S\d/);
  assert.match(inner, /S\d --> \[\*\] : fin/);
  assert.equal((text.match(/\[\*\] -->/g) ?? []).length, 2);
});

test('mermaid members put static / abstract marks at the end', async () => {
  const { mermaidMember } = await import('../src/lib/editors/graph/export');
  assert.equal(mermaidMember('- {static} total: int'), '-total: int$');
  assert.equal(mermaidMember('_contador: int'), 'contador: int$');
  assert.equal(mermaidMember('+ calcular(): int {abstract}'), '+calcular(): int*');
});
