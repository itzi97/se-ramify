import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exampleProject, EXAMPLE_PROJECT } from '../src/lib/examples/project';
import { DELIVERABLES, review } from '../src/lib/model/deliverables';
import { validateDiagram } from '../src/lib/model/diagram';

test('the example project is valid and all in one project', () => {
  const docs = exampleProject();
  assert.ok(docs.length >= 20);
  for (const d of docs) {
    assert.deepEqual(validateDiagram(d), [], d.title);
    assert.equal(d.project, EXAMPLE_PROJECT);
  }
  assert.equal(new Set(docs.map((d) => d.id)).size, docs.length);
});

test('the example project passes every hand-in checklist', () => {
  const docs = exampleProject();
  for (const d of DELIVERABLES) {
    const r = review(d, docs);
    const open = r.parts.flatMap((p) => p.needs).filter((n) => n.state === 'missing' || n.state === 'partial');
    assert.deepEqual(
      open.map((n) => `${d.id} ${n.need.label}: ${n.problems.join('; ') || n.state}`),
      [],
      d.id
    );
    assert.equal(r.done, r.total, d.id);
  }
});

test('the UP plan links its artefacts to the example diagrams', () => {
  const docs = exampleProject();
  const up = docs.find((d) => d.kind === 'up')!;
  const ids = new Set(docs.map((d) => d.id));
  const links = (up.data as { artifacts: { diagramId?: string }[] }).artifacts.filter((a) => a.diagramId);
  assert.ok(links.length >= 8, `${links.length} links`);
  assert.ok(links.every((a) => ids.has(a.diagramId!)));
});

test('nothing in the example is about the real course case', () => {
  const text = JSON.stringify(exampleProject()).toLowerCase();
  for (const word of ['añadamaster', 'bodega', 'vino', 'corereservas', 'corebodega']) assert.ok(!text.includes(word), word);
});
