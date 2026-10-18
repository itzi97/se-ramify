import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES, areaNames, randomWord, RANDOM_WORDS } from '../src/lib/editors/board/templates';
import { boardExample } from '../src/lib/editors/board/examples';
import { boardMarkdown } from '../src/lib/editors/board/export';
import { newDiagram } from '../src/lib/model/diagram';
import type { BoardKind, DiagramOf } from '../src/lib/model/types';

const KINDS: BoardKind[] = ['empathy', 'canvas', 'context', 'persona', 'brainstorm', 'crazy8', 'sixhats'];

test('every board kind has a template whose grid is consistent', () => {
  for (const kind of KINDS) {
    const t = TEMPLATES[kind];
    assert.equal(t.kind, kind);
    assert.equal(t.rowMin.length, t.areas.length, `${kind}: one row height per row`);
    const cols = t.areas.map((r) => r.split(/\s+/).length);
    assert.ok(cols.every((c) => c === cols[0]), `${kind}: every grid row has the same number of cells`);
    const names = areaNames(t);
    const used = [...t.sections.map((s) => s.area), ...t.decor.map((d) => d.area)];
    assert.equal(new Set(used).size, used.length, `${kind}: areas used once`);
    for (const a of used) assert.ok(names.has(a), `${kind}: area ${a} is in the grid`);
    for (const a of names) assert.ok(used.includes(a), `${kind}: grid area ${a} is used`);
    const ids = t.sections.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, `${kind}: unique section ids`);
    assert.ok(ids.includes(t.defaultSection), `${kind}: default section exists`);
  }
});

test('the six hats follow the slide', () => {
  assert.deepEqual(TEMPLATES.sixhats.sections.map((s) => s.title), ['Creatividad', 'Positivismo', 'Negativismo', 'Analítico', 'Emocional', 'Moderador']);
  assert.equal(TEMPLATES.crazy8.sections.length, 8);
  assert.equal(TEMPLATES.canvas.sections.length, 9);
});

test('examples only use sections of their template', () => {
  for (const kind of KINDS) {
    const ex = boardExample(kind);
    const ids = new Set(TEMPLATES[kind].sections.map((s) => s.id));
    assert.ok(ex.subject.length > 0);
    for (const k of Object.keys(ex.sections)) assert.ok(ids.has(k), `${kind}: example section ${k}`);
    const all = Object.values(ex.sections).flat();
    assert.ok(all.length >= 6, `${kind}: example has content`);
    assert.equal(new Set(all.map((s) => s.id)).size, all.length, `${kind}: sticky ids unique`);
  }
});

test('Markdown export lists every section and sticky', () => {
  const doc = newDiagram('empathy', 'Mapa de Lucía', '', boardExample('empathy')) as DiagramOf<'empathy'>;
  const md = boardMarkdown(doc);
  assert.match(md, /^# Mapa de Lucía/);
  assert.match(md, /\*\*Persona:\*\* Lucía/);
  for (const s of TEMPLATES.empathy.sections) assert.ok(md.includes(`## ${s.title}`));
  assert.ok(md.includes('- Reservar desde el móvil'));
  const empty = boardMarkdown(newDiagram('sixhats', 'Vacío', '') as DiagramOf<'sixhats'>);
  assert.equal((empty.match(/_\(vacío\)_/g) ?? []).length, 6);
});

test('random stimulus never repeats the previous word', () => {
  for (let i = 0; i < 50; i++) {
    const w = randomWord(RANDOM_WORDS[0]);
    assert.notEqual(w, RANDOM_WORDS[0]);
  }
});
