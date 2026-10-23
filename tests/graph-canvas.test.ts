import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bringToFront, canPaint, commonColor, dropTarget, lighten, paint, reverseEdge, sendToBack } from '../src/lib/editors/graph/ops';
import { graphExample } from '../src/lib/editors/graph/examples';
import { graphExports } from '../src/lib/editors/graph/export';
import { newDiagram } from '../src/lib/model/diagram';
import { nodeTypeInfo } from '../src/lib/model/kinds';
import type { DiagramOf, GraphData } from '../src/lib/model/types';

const graph = (): GraphData => ({
  routing: 'straight',
  nodes: [
    { id: 'a', type: 'action', x: 0, y: 0, label: 'A' },
    { id: 'b', type: 'action', x: 200, y: 0, label: 'B' },
    { id: 'start', type: 'initial', x: 0, y: -100, label: '' },
    { id: 'lane', type: 'partition', x: -50, y: -150, w: 600, h: 400, label: 'Lane' }
  ],
  edges: [
    { id: 'e1', type: 'flow', from: 'a', to: 'b', fromLabel: '1', label: 'go' },
    { id: 'e2', type: 'flow', from: 'start', to: 'a' }
  ]
});
const shapeOf = (type: string, icon?: string) => nodeTypeInfo('activity', type, icon).shape;

test('every shape but the small symbolic ones takes a colour', () => {
  for (const s of ['initial', 'final', 'flowFinal', 'bar', 'history', 'lollipop'] as const) assert.equal(canPaint(s), false, s);
  for (const s of ['class', 'actor', 'ellipse', 'container', 'zone', 'device', 'diamond', 'note', 'central'] as const) assert.equal(canPaint(s), true, s);
});

test('paint colours shapes and lines, skips start dots, and clears with undefined', () => {
  const g = graph();
  assert.equal(paint(g, ['a', 'start', 'lane'], ['e1'], '#58a55c', shapeOf), 3);
  assert.equal(g.nodes.find((n) => n.id === 'a')!.color, '#58a55c');
  assert.equal(g.nodes.find((n) => n.id === 'lane')!.color, '#58a55c');
  assert.equal(g.nodes.find((n) => n.id === 'start')!.color, undefined);
  assert.equal(g.edges[0].color, '#58a55c');
  assert.equal(g.edges[1].color, undefined);
  // Painting again with the same colour changes nothing.
  assert.equal(paint(g, ['a'], ['e1'], '#58a55c', shapeOf), 0);
  assert.equal(paint(g, ['a'], ['e1'], undefined, shapeOf), 2);
  assert.ok(!('color' in g.nodes[0]));
  assert.ok(!('color' in g.edges[0]));
});

test('a selection shows its one colour, or none, or "mixed"', () => {
  assert.equal(commonColor([]), undefined);
  assert.equal(commonColor([undefined, undefined]), undefined);
  assert.equal(commonColor(['#d9534f', '#d9534f']), '#d9534f');
  assert.equal(commonColor(['#d9534f', undefined]), 'mixed');
});

test('bring to front draws last; send to back draws first; the rest keep their order', () => {
  const g = graph();
  bringToFront(g, ['a']);
  assert.deepEqual(g.nodes.map((n) => n.id), ['b', 'start', 'lane', 'a']);
  sendToBack(g, ['b', 'a']);
  assert.deepEqual(g.nodes.map((n) => n.id), ['b', 'a', 'start', 'lane']);
});

test('reversing a line swaps its ends, end labels and message arrows', () => {
  const e = { id: 'x', type: 'link', from: 'p', to: 'q', fromLabel: '1', messages: [{ seq: '1', text: 'm()', dir: 'forward' as const }] };
  reverseEdge(e);
  assert.equal(e.from, 'q');
  assert.equal(e.to, 'p');
  assert.equal((e as { fromLabel?: string }).fromLabel, undefined);
  assert.equal((e as { toLabel?: string }).toLabel, '1');
  assert.equal(e.messages[0].dir, 'back');
});

test('a dragged shape lands in the smallest container that holds all of it', () => {
  const containers = [
    { id: 'big', rect: { x: 0, y: 0, w: 1000, h: 800 } },
    { id: 'small', rect: { x: 100, y: 100, w: 300, h: 300 } }
  ];
  assert.equal(dropTarget({ x: 150, y: 150, w: 100, h: 50 }, containers, new Set()), 'small');
  // Half outside the small one: the big one.
  assert.equal(dropTarget({ x: 350, y: 150, w: 100, h: 50 }, containers, new Set()), 'big');
  // Outside everything.
  assert.equal(dropTarget({ x: 1200, y: 150, w: 100, h: 50 }, containers, new Set()), null);
  // A container never lands in itself (or in what it carries).
  assert.equal(dropTarget({ x: 150, y: 150, w: 100, h: 50 }, containers, new Set(['small'])), 'big');
  // Something bigger than a container doesn't go in it.
  assert.equal(dropTarget({ x: 100, y: 100, w: 300, h: 300 }, containers, new Set()), 'big');
});

test('lighten mixes towards white', () => {
  assert.equal(lighten('#000000', 0), '#ffffff');
  assert.equal(lighten('#d9534f', 1), '#d9534f');
  assert.equal(lighten('#d9534f', 0.22), '#f7d9d8');
  assert.equal(lighten('not a colour', 0.5), 'not a colour');
});

test('class PlantUML carries colours: a light fill and border on classes, the colour on links', () => {
  const data = graphExample('class') as GraphData;
  const socio = data.nodes.find((n) => n.label === 'Socio')!;
  socio.color = '#d9534f';
  data.edges[0].color = '#8a63c4';
  const doc = newDiagram('class', 'T', '', data as never) as DiagramOf<'class'>;
  const text = graphExports(doc)[0].build();
  assert.match(text, /class "Socio" as C\d+ #F7D9D8 ##D9534F \{/);
  assert.match(text, /[-.]\[#8A63C4\][-.]/);
  // Uncoloured shapes and the Mermaid export are untouched.
  assert.match(text, /class "Prestamo" as C\d+ \{/);
  const mermaid = graphExports(doc).find((x) => x.ext === 'mmd')!.build();
  assert.doesNotMatch(mermaid, /#d9534f|#8a63c4/i);
});
