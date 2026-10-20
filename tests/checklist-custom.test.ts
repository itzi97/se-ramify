import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCustom, emptyCustom, GROUP_PART, isCustomised, parseCustom, review, DELIVERABLES } from '../src/lib/model/deliverables';
import { newDiagram } from '../src/lib/model/diagram';
import { useCases } from '../src/lib/examples/parts';

const ids = (d: ReturnType<typeof applyCustom>[number]) => d.parts.flatMap((p) => p.needs.map((n) => n.id));

test('no changes: the brief as it is', () => {
  assert.deepEqual(applyCustom(emptyCustom()), DELIVERABLES.map((d) => ({ ...d, parts: d.parts.map((p) => ({ ...p, needs: p.needs })) })));
  assert.ok(!isCustomised(emptyCustom()));
});

test('use cases also asked in E1: they show in both, and count in E1', () => {
  const c = { ...emptyCustom(), placements: [{ need: 'uc', to: 'E1' as const, keep: true }] };
  const [e1, e2] = applyCustom(c);
  assert.ok(ids(e1).includes('uc'));
  assert.ok(ids(e2).includes('uc'));
  assert.equal(e1.parts.at(-1)!.label, GROUP_PART);
  const r = review(e1, [newDiagram('usecase', 'CU', 'P', useCases())]);
  assert.equal(r.parts.at(-1)!.needs[0].state, 'done');
});

test('moved items leave their hand-in; removed ones disappear; empty parts go', () => {
  const c = { removed: ['stk'], placements: [{ need: 'vision', to: 'E1' as const, keep: false }], added: [] };
  const [e1, e2] = applyCustom(c);
  assert.ok(!ids(e2).includes('stk'));
  assert.ok(!ids(e2).includes('vision'));
  assert.ok(ids(e1).includes('vision'));
  assert.equal(e2.parts.length, 1);
});

test('added items: a diagram kind with a count, or a written part', () => {
  const c = {
    ...emptyCustom(),
    added: [
      { id: 'x1', to: 'E3' as const, label: 'Diagrama de actividad del proceso', kinds: ['activity' as const], min: 2 },
      { id: 'x2', to: 'E3' as const, label: 'Glosario', kinds: [], text: true }
    ]
  };
  const e3 = applyCustom(c)[2];
  const r = review(e3, [newDiagram('activity', 'A', 'P')]);
  const extra = r.parts.at(-1)!.needs;
  assert.equal(extra[0].state, 'partial');
  assert.equal(extra[1].state, 'text');
  assert.ok(isCustomised(c));
});

test('a damaged file reads as no changes', () => {
  assert.deepEqual(parseCustom('{oops'), emptyCustom());
  assert.deepEqual(parseCustom('{"removed": ["uc", 3], "placements": [{"need": "uc"}], "added": [{"id": "a", "label": "x"}]}'), {
    removed: ['uc'],
    placements: [],
    added: [{ id: 'a', label: 'x', kinds: [] }]
  });
});
