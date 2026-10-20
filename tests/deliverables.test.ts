import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DELIVERABLES, review, reviewNeed, deliverableDocs } from '../src/lib/model/deliverables';
import { blankData, newDiagram } from '../src/lib/model/diagram';
import { stakeholderExample } from '../src/lib/editors/stakeholder/example';
import { useCases } from '../src/lib/examples/parts';
import type { Diagram } from '../src/lib/model/types';

const byId = (id: string) => DELIVERABLES.find((d) => d.id === id)!;
const need = (deliverable: string, id: string) => byId(deliverable).parts.flatMap((p) => p.needs).find((n) => n.id === id)!;

test('the four hand-ins follow the brief, with weights adding up to 100 %', () => {
  assert.deepEqual(
    DELIVERABLES.map((d) => d.id),
    ['E1', 'E2', 'E3', 'Final']
  );
  for (const d of DELIVERABLES) {
    const total = d.parts.reduce((s, p) => s + Number(p.weight.replace(/[^\d]/g, '')), 0);
    assert.equal(total, 100, d.id);
  }
});

test('an empty project has everything missing, text parts are reminders', () => {
  const r = review(byId('E2'), []);
  assert.equal(r.done, 0);
  assert.equal(r.total, 5);
  assert.ok(r.parts.flatMap((p) => p.needs).every((n) => n.state === 'missing'));
  const e1 = review(byId('E1'), []);
  assert.ok(e1.parts[0].needs.some((n) => n.state === 'text'));
});

test('stakeholders: fewer than six is partial, the example passes', () => {
  const few = newDiagram('stakeholder', 'Mapa', 'P', { ...stakeholderExample(), stakeholders: stakeholderExample().stakeholders.slice(0, 4) });
  const r = reviewNeed(need('E2', 'stk'), [few]);
  assert.equal(r.state, 'partial');
  assert.match(r.problems[0], /4 stakeholders/);
  assert.equal(reviewNeed(need('E2', 'stk'), [newDiagram('stakeholder', 'Mapa', 'P', stakeholderExample())]).state, 'done');
});

test('use cases need a specification each', () => {
  const full = newDiagram('usecase', 'CU', 'P', useCases());
  assert.equal(reviewNeed(need('E2', 'uc'), [full]).state, 'done');
  const data = useCases();
  data.nodes.find((n) => n.type === 'usecase')!.spec = undefined;
  const r = reviewNeed(need('E2', 'uc'), [newDiagram('usecase', 'CU', 'P', data)]);
  assert.equal(r.state, 'partial');
  assert.match(r.problems.join(), /1 of 6 use cases without a specification/);
});

test('two architecture diagrams are needed; actas count by their type', () => {
  const arch = newDiagram('architecture', 'Local', 'P');
  assert.equal(reviewNeed(need('E1', 'arch'), [arch]).state, 'partial');
  const client = newDiagram('minutes', 'Acta', 'P', { ...blankData('minutes'), type: 'client' });
  assert.equal(reviewNeed(need('Final', 'pm'), [client]).state, 'missing');
  assert.equal(reviewNeed(need('E3', 'client'), [client]).docs.length, 1);
});

test('archived diagrams do not count, and the export lists each diagram once in order', () => {
  const tco = newDiagram('tco', 'TCO', 'P');
  const old = { ...newDiagram('tco', 'TCO viejo', 'P'), archived: true } as Diagram;
  const r = review(byId('E1'), [tco, old]);
  const docs = deliverableDocs(r);
  assert.deepEqual(
    docs.map((d) => d.title),
    ['TCO']
  );
});
