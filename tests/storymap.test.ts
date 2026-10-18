import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allSteps, moveStory, orderedStories, removeActivity, removeRelease, removeStep, shift, storiesIn, toFeature, toMarkdown } from '../src/lib/editors/storymap/ops.ts';
import { storymapExample } from '../src/lib/editors/storymap/example.ts';
import { buildFeature, groupByEpic, initials, storySentence, storyTitle, totalPoints } from '../src/lib/model/stories.ts';
import { blankStory } from '../src/lib/model/diagram.ts';

test('story sentence and title', () => {
  assert.equal(storySentence({ asA: 'socio', iWant: 'reservar', soThat: 'leerlo' }), 'Como socio, quiero reservar, para leerlo');
  assert.equal(storySentence({ asA: '', iWant: 'reservar', soThat: '' }), 'quiero reservar');
  assert.equal(storyTitle({ title: ' ', iWant: 'reservar' }), 'reservar');
  assert.equal(storyTitle({ title: '', iWant: '' }), 'Historia sin título');
  assert.equal(initials('Ana García López'), 'AL');
  assert.equal(initials('ana'), 'AN');
  assert.equal(totalPoints([{ points: 3 }, { points: undefined }, { points: 2 }]), 5);
});

test('gherkin feature: language header, one Característica per epic, steps indented, placeholder when empty', () => {
  const a = { ...blankStory(), title: 'Reservar', asA: 'socio', iWant: 'reservar', soThat: 'leer', epic: 'Préstamos', gherkin: 'Escenario: ok\nDado algo\nCuando hago\nEntonces pasa' };
  const b = { ...blankStory(), title: 'Buscar', epic: '' };
  const f = buildFeature(groupByEpic([a, b], 'Mapa'));
  assert.match(f, /^# language: es\n/);
  assert.match(f, /\nCaracterística: Préstamos\n/);
  assert.match(f, /\nCaracterística: Mapa\n/);
  assert.match(f, /\n  Escenario: ok\n    Dado algo\n    Cuando hago\n    Entonces pasa\n/);
  assert.match(f, /# Como socio, quiero reservar, para leer/);
  assert.match(f, /\n  Escenario: Buscar\n    # Pendiente/);
});

test('moving a story between cells renumbers both', () => {
  const d = storymapExample();
  const [s1, s2] = d.releases;
  const reservar = d.activities[1].steps[0].id;
  const target = storiesIn(d, reservar, s2.id);
  assert.equal(target.length, 2);
  const mover = storiesIn(d, d.activities[0].steps[0].id, s1.id)[0];
  moveStory(d, mover.id, reservar, s2.id, 1);
  const after = storiesIn(d, reservar, s2.id);
  assert.deepEqual(after.map((s) => s.order), [0, 1, 2]);
  assert.equal(after[1].id, mover.id);
  // Reorder inside the cell.
  moveStory(d, mover.id, reservar, s2.id, 0);
  assert.equal(storiesIn(d, reservar, s2.id)[0].id, mover.id);
  // Past the end clamps.
  moveStory(d, mover.id, reservar, s2.id, 99);
  assert.equal(storiesIn(d, reservar, s2.id).at(-1)!.id, mover.id);
});

test('removing steps, activities and releases drops their stories', () => {
  const d = storymapExample();
  const n = d.stories.length;
  const step = d.activities[0].steps[0].id;
  const inStep = d.stories.filter((s) => s.stepId === step).length;
  removeStep(d, step);
  assert.equal(d.stories.length, n - inStep);
  assert.equal(d.activities[0].steps.length, 1);
  removeActivity(d, d.activities[0].id);
  assert.equal(d.activities.length, 3);
  removeRelease(d, d.releases[1].id);
  assert.ok(d.stories.every((s) => s.releaseId === d.releases[0].id));
  assert.equal(shift(d.activities, d.activities[0].id, -1), false);
  assert.equal(shift(d.activities, d.activities[0].id, 1), true);
});

test('exports read the map in order', () => {
  const d = storymapExample();
  const ordered = orderedStories(d);
  assert.equal(ordered.length, d.stories.length);
  assert.equal(ordered[0].releaseId, d.releases[0].id);
  assert.equal(allSteps(d).length, 8);
  const md = toMarkdown('Biblioteca', d);
  assert.match(md, /^# Biblioteca\n/);
  assert.match(md, /## Sprint 1 \(18 pts\)/);
  assert.match(md, /### Buscar libros › Buscar en el catálogo/);
  assert.ok(md.indexOf('## Sprint 1') < md.indexOf('## Sprint 2'));
  const feat = toFeature('Biblioteca', d);
  assert.match(feat, /Característica: Catálogo\n  Para: Socio de la biblioteca/);
  assert.equal((feat.match(/Característica:/g) ?? []).length, 3);
});
