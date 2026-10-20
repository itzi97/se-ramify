import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addEpic,
  addStory,
  aiBriefMarkdown,
  aiPack,
  backlogStats,
  byComponent,
  checkBacklog,
  epicCode,
  epicStats,
  gherkinProblems,
  moveEpic,
  moveStory,
  moveStoryToEpic,
  removeEpic,
  storyCode,
  toFeature,
  toMarkdown
} from '../src/lib/editors/backlog/model.ts';
import { backlogExample } from '../src/lib/editors/backlog/example.ts';
import { blankData } from '../src/lib/model/diagram.ts';
import type { BacklogData } from '../src/lib/model/types.ts';

const GOOD = 'Escenario: ok\n  Dado algo\n  Cuando hago\n  Entonces pasa';

function small(): BacklogData {
  const d = blankData('backlog');
  const a = addEpic(d, 'Préstamos');
  const b = addEpic(d, 'Catálogo');
  d.epics[0].title = 'Préstamo';
  d.epics[1].title = 'Alta de fondos';
  d.epics[1].priority = 'Must';
  addStory(d, b);
  addStory(d, b);
  Object.assign(d.epics[1].stories[0], { title: 'Registrar obra', asA: 'bibliotecario', iWant: 'registrar una obra', soThat: 'que aparezca', gherkin: GOOD, points: 3 });
  Object.assign(d.epics[1].stories[1], { title: 'Añadir ejemplar', asA: 'bibliotecario', iWant: 'añadir', soThat: '', points: 2 });
  void a;
  return d;
}

test('epic and story codes follow position; custom codes are kept', () => {
  const d = small();
  const [e1, e2] = d.epics;
  assert.equal(epicCode(d, e1), 'EP-01');
  assert.equal(epicCode(d, e2), 'EP-02');
  assert.equal(storyCode(d, e2, e2.stories[0]), 'HU-02.1');
  assert.equal(storyCode(d, e2, e2.stories[1]), 'HU-02.2');
  moveEpic(d, e2.id, -1);
  assert.equal(epicCode(d, e2), 'EP-01');
  assert.equal(storyCode(d, e2, e2.stories[0]), 'HU-01.1');
  e2.code = 'CAT-1';
  assert.equal(storyCode(d, e2, e2.stories[1]), 'HU-CAT-1.2');
  moveStory(d, e2.id, e2.stories[1].id, -1);
  assert.equal(e2.stories[0].title, 'Añadir ejemplar');
});

test('moving a story to another epic, removing an epic, grouping by component', () => {
  const d = small();
  const [e1, e2] = d.epics;
  moveStoryToEpic(d, e2.stories[1].id, e1.id);
  assert.equal(e1.stories.length, 1);
  assert.equal(e2.stories.length, 1);
  const groups = byComponent(d);
  assert.deepEqual(groups.map((g) => g.component), ['Préstamos', 'Catálogo']);
  assert.equal(byComponent(d, 'Catálogo')[0].epics[0].id, e2.id);
  removeEpic(d, e1.id);
  assert.equal(d.epics.length, 1);
});

test('counts', () => {
  const d = small();
  assert.deepEqual(epicStats(d.epics[1]), { stories: 2, points: 5, incomplete: 1 });
  const s = backlogStats(d);
  assert.equal(s.epics, 2);
  assert.equal(s.withoutStories, 1);
  assert.equal(s.withCriteria, 1);
});

test('gherkin checks', () => {
  assert.deepEqual(gherkinProblems(GOOD), []);
  assert.equal(gherkinProblems('Dado algo')[0].level, 'error');
  const noThen = gherkinProblems('Escenario: x\nDado a\nCuando b');
  assert.ok(noThen.some((p) => p.level === 'error' && /Entonces/.test(p.text)));
  const twoWhens = gherkinProblems('Escenario: x\nDado a\nCuando b\nEntonces c\nCuando d\nEntonces e');
  assert.ok(twoWhens.some((p) => p.level === 'warn' && /2 Cuando/.test(p.text)));
  assert.ok(gherkinProblems('Escenario: <nombre>\nDado <x>\nCuando y\nEntonces z').some((p) => /placeholders/.test(p.text)));
});

test('backlog checker flags missing parts, missing Gherkin and priority', () => {
  const d = small();
  const p = checkBacklog(d);
  assert.ok(p.some((x) => x.where === 'EP-01' && /priority/.test(x.text) && x.level === 'warn'));
  assert.ok(p.some((x) => x.where === 'HU-02.2' && /para/.test(x.text) && x.level === 'error'));
  assert.ok(p.some((x) => x.where === 'HU-02.2' && /Gherkin/.test(x.text)));
  assert.ok(!p.some((x) => x.where === 'HU-02.1'));
  assert.ok(checkBacklog(blankData('backlog')).some((x) => /no epics/.test(x.text)));
});

test('markdown: epic table, stories with sentence and gherkin, pending epics', () => {
  const md = toMarkdown('Backlog', small());
  assert.match(md, /^# Backlog\n/);
  assert.match(md, /\| EP-02 \| Alta de fondos \| Catálogo \| Must \| 2 \| 5 \|/);
  assert.match(md, /### HU-02\.1 · Registrar obra/);
  assert.match(md, /> Como bibliotecario, quiero registrar una obra, para que aparezca\./);
  assert.match(md, /```gherkin\nEscenario: ok/);
  assert.match(md, /## EP-01 · Préstamo[\s\S]*_Sin desglosar/);
});

test('feature: language once, one Característica per broken-down epic, coded stories', () => {
  const f = toFeature(small());
  assert.equal(f.match(/# language: es/g)!.length, 1);
  assert.match(f, /\nCaracterística: EP-02 Alta de fondos\n  Componente: Catálogo\n/);
  assert.doesNotMatch(f, /Característica: EP-01/);
  assert.match(f, /  # HU-02\.1 Registrar obra\n/);
  assert.match(f, /\n  Escenario: ok\n    Dado algo\n/);
});

test('AI brief and pack: glossary, guardrails, every story', () => {
  const d = backlogExample();
  const brief = aiBriefMarkdown('Backlog', d);
  assert.match(brief, /## Glosario\n\n\| Término \| Definición \|/);
  assert.match(brief, /\| Ejemplar \| cada copia física/);
  assert.match(brief, /## Guardrails\n\n- Implementa solo/);
  for (const e of d.epics) for (const s of e.stories) assert.ok(brief.includes(s.iWant), s.iWant);
  const pack = aiPack('Backlog', d);
  const paths = pack.map((f) => f.path);
  assert.deepEqual(paths.slice(0, 4), ['README.md', 'PROMPT.md', 'SPEC.md', 'GUARDRAILS.md']);
  const features = paths.filter((p) => p.startsWith('features/'));
  assert.equal(features.length, d.epics.filter((e) => e.stories.length).length);
  assert.ok(features.every((p) => /^features\/ep-\d\d-[a-z0-9-]+\.feature$/.test(p)), features.join());
  const prompt = pack.find((f) => f.path === 'PROMPT.md')!.content;
  for (const p of features) assert.ok(prompt.includes(p));
});

test('example: Catálogo epics fully broken down with valid Gherkin', () => {
  const d = backlogExample();
  assert.ok(d.epics.length >= 7);
  const cat = d.epics.filter((e) => e.component === 'Catálogo');
  assert.ok(cat.length >= 3 && cat.every((e) => e.stories.length));
  const problems = checkBacklog(d).filter((p) => cat.some((e) => e.id === p.epicId));
  assert.deepEqual(problems, []);
  assert.doesNotMatch(JSON.stringify(d), /\bbodegas?\b|\bvinos?\b|AñadaMaster/i);
});
