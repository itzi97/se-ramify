import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lintGraph } from '../src/lib/model/lint';
import { buildModel, checkSequence } from '../src/lib/model/uml-model';
import { exampleProject } from '../src/lib/examples/project';
import { graphExample } from '../src/lib/editors/graph/examples';
import type { GraphData, GraphKind, SequenceData } from '../src/lib/model/types';

const node = (id: string, type: string, label = '') => ({ id, type, x: 0, y: 0, label });
const edge = (id: string, from: string, to: string, type: string, extra = {}) => ({ id, from, to, type, ...extra });
const g = (nodes: GraphData['nodes'], edges: GraphData['edges']): GraphData => ({ nodes, edges, routing: 'orthogonal' });

test('the examples, and the example project, pass every check', () => {
  for (const k of ['usecase', 'class', 'activity', 'state', 'communication'] as GraphKind[]) assert.deepEqual(lintGraph(k, graphExample(k)), [], k);
  const docs = exampleProject('Ejemplo');
  const model = buildModel(docs);
  for (const d of docs) {
    if (['usecase', 'class', 'activity', 'state', 'communication'].includes(d.kind)) assert.deepEqual(lintGraph(d.kind as GraphKind, d.data as GraphData, model), [], d.title);
    if (d.kind === 'sequence') assert.deepEqual(checkSequence(d.data as SequenceData, model), [], d.title);
  }
});

test('use cases: lone actor, use case nobody starts, wrong lines', () => {
  const issues = lintGraph(
    'usecase',
    g(
      [node('a', 'actor', 'Socio'), node('b', 'actor', 'Invitado'), node('u1', 'usecase', 'Prestar'), node('u2', 'usecase', 'Identificar'), node('u3', 'usecase', 'Huérfano'), node('u4', 'usecase', 'Pegado')],
      [edge('1', 'a', 'u1', 'association'), edge('2', 'u1', 'u2', 'include'), edge('3', 'u1', 'u4', 'association')]
    )
  );
  const texts = issues.map((i) => i.text).join('\n');
  assert.match(texts, /Invitado.*isn't connected/);
  assert.match(texts, /No actor starts "Huérfano"/);
  assert.doesNotMatch(texts, /No actor starts "Identificar"/);
  assert.match(texts, /plain line/);
});

test('activities: no start, a step leading nowhere, a decision with no guard', () => {
  const issues = lintGraph('activity', g([node('a', 'action', 'Buscar'), node('d', 'decision'), node('b', 'action', 'Pedir'), node('c', 'action', 'Cancelar'), node('f', 'final')], [edge('1', 'a', 'd', 'flow'), edge('2', 'd', 'b', 'flow', { label: '[hay]' }), edge('3', 'd', 'c', 'flow'), edge('4', 'b', 'f', 'flow')]));
  const texts = issues.map((i) => i.text).join('\n');
  assert.match(texts, /No initial node/);
  assert.match(texts, /"Cancelar" leads nowhere/);
  assert.match(texts, /without a guard/);
});

test('states: unreachable state', () => {
  const issues = lintGraph('state', g([node('i', 'initial'), node('a', 'state', 'Libre'), node('b', 'state', 'Perdido')], [edge('1', 'i', 'a', 'transition'), edge('2', 'a', 'a', 'transition', { label: 'reservar' })]));
  assert.ok(issues.some((i) => i.nodeId === 'b' && /No path/.test(i.text)));
});

test('classes: operations written wrong, missing types and multiplicities', () => {
  const c = { ...node('c', 'class', 'Socio'), attrs: ['- nombre'], ops: ['pagar'] };
  const issues = lintGraph('class', g([c, node('d', 'class', 'Prestamo')], [edge('1', 'c', 'd', 'association')]));
  const texts = issues.map((i) => i.text).join('\n');
  assert.match(texts, /"pagar" isn't written as an operation/);
  assert.match(texts, /"- nombre" has no type/);
  assert.match(texts, /no multiplicity/);
});
