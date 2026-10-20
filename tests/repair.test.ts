import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDiagram, newDiagram, uid } from '../src/lib/model/diagram';
import { repairData } from '../src/lib/model/repair';
import type { Diagram } from '../src/lib/model/types';

const broken = (kind: string, data: unknown) => normalizeDiagram({ ...newDiagram(kind as never, 'X'), data } as unknown as Diagram).data as never as Record<string, any>;

test('TCO: alternatives and lines get every field', () => {
  const d = broken('tco', { alternatives: [{ id: 'a', name: 'Local', lines: [{ id: 'l', name: 'Servidor', unitCost: '12' }, null] }, 'junk'], years: 'x', scores: { 'c:a': 4, bad: 'x' } });
  assert.equal(d.years, 3);
  assert.equal(d.alternatives.length, 1);
  assert.deepEqual(d.alternatives[0].lines[0], { id: 'l', name: 'Servidor', block: 'hwsw', nature: 'capex', unitCost: 0, qty: 1, when: 'once', year: 1, source: '' });
  assert.deepEqual(d.criteria, []);
  assert.deepEqual(d.scores, { 'c:a': 4 });
});

test('backlog: epics without stories or ai, stories without fields', () => {
  const d = broken('backlog', { epics: [{ title: 'E' }, null, { id: 'e2', stories: [{ title: 'S', points: 'x' }] }], components: null });
  assert.equal(d.epics.length, 2);
  assert.ok(d.epics[0].id);
  assert.deepEqual(d.epics[0].stories, []);
  assert.equal(d.epics[1].stories[0].asA, '');
  assert.equal(d.epics[1].stories[0].points, undefined);
  assert.equal(d.ai.guardrails, '');
  assert.deepEqual(d.components, []);
});

test('acta: unknown type and missing lists', () => {
  const d = broken('minutes', { type: 'bogus', actions: [{ text: 'x' }], review: [{ text: 'r', kind: 'meh' }] });
  assert.equal(d.type, 'client');
  assert.deepEqual(d.attendees, []);
  assert.equal(d.actions[0].owner, '');
  assert.equal(d.review[0].kind, 'well');
  assert.equal(d.review[0].area, 'team');
});

test('UP: efforts match the phases, orphan artefacts move to the first phase', () => {
  const d = broken('up', { phases: [{ id: 'p1', name: 'Inicio' }, { id: 'p2', name: 'Elaboración', iterations: ['E1', 2] }], disciplines: [{ id: 'd', name: 'Req', effort: [9] }], artifacts: [{ id: 'a', phaseId: 'gone', name: 'Visión', status: 'x' }] });
  assert.deepEqual(d.phases[0].iterations, ['I1']);
  assert.deepEqual(d.phases[1].iterations, ['E1']);
  assert.deepEqual(d.disciplines[0].effort, [4, 0]);
  assert.equal(d.artifacts[0].phaseId, 'p1');
  assert.equal(d.artifacts[0].status, 'todo');
});

test('kinds without repair are untouched; repairing twice changes nothing', () => {
  const data = { anything: 1 };
  assert.equal(repairData('usecase', data, uid), data);
  const once = repairData('tco', { alternatives: [{ lines: [{}] }] }, uid);
  assert.deepEqual(repairData('tco', JSON.parse(JSON.stringify(once)), uid), once);
});
