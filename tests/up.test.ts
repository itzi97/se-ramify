import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SUGGESTED,
  addIteration,
  addSuggested,
  autoLink,
  chartLayout,
  humpPath,
  kindFor,
  moveArtifact,
  progress,
  removeDiscipline,
  removeIteration,
  setEffort,
  suggestedArtifacts,
  upMarkdown,
  wrapText
} from '../src/lib/editors/up/model';
import { upExample } from '../src/lib/editors/up/example';
import { blankUp } from '../src/lib/model/diagram';

test('suggested artefacts cover the four phases and the three required UML artefacts', () => {
  const data = blankUp();
  const s = suggestedArtifacts(data);
  assert.equal(s.length, SUGGESTED.length);
  for (const p of data.phases) assert.ok(s.some((a) => a.phaseId === p.id), `phase ${p.name} has artefacts`);
  const kinds = new Set(SUGGESTED.map((x) => x.kind));
  for (const k of ['usecase', 'class', 'sequence', 'gantt', 'minutes'] as const) assert.ok(kinds.has(k), `a suggestion makes ${k}`);
  assert.ok(SUGGESTED.some((x) => /especificaciones/.test(x.name) && x.kind === 'usecase'));
  assert.ok(SUGGESTED.some((x) => /clases de diseño/.test(x.name) && x.kind === 'class'));
  // Every suggestion lands on a real discipline.
  for (const a of s) assert.ok(data.disciplines.some((d) => d.id === a.disciplineId), a.name);
});

test('adding suggestions twice does not duplicate them', () => {
  const data = blankUp();
  const n = addSuggested(data);
  assert.equal(n, SUGGESTED.length);
  assert.equal(addSuggested(data), 0);
  assert.equal(data.artifacts.length, n);
});

test('kindFor reads custom names too', () => {
  assert.equal(kindFor('Diagramas de secuencia'), 'sequence');
  assert.equal(kindFor('diagrama de SECUENCIA del préstamo'), 'sequence');
  assert.equal(kindFor('Clases de diseño — módulo préstamos'), 'class');
  assert.equal(kindFor('Acta de la reunión con el cliente'), 'minutes');
  assert.equal(kindFor('Caso de negocio'), undefined);
});

test('autoLink links by kind, prefers matching titles and unused diagrams', () => {
  const data = blankUp();
  addSuggested(data);
  const diagrams = [
    { id: 'd1', kind: 'sequence' as const, title: 'Secuencia — prestar' },
    { id: 'd2', kind: 'class' as const, title: 'Modelo del dominio' },
    { id: 'd3', kind: 'class' as const, title: 'Clases de diseño' },
    { id: 'd4', kind: 'usecase' as const, title: 'Casos de uso' }
  ];
  const r = autoLink(data.artifacts, diagrams);
  const by = (name: string) => r.artifacts.find((a) => a.name === name)!;
  assert.equal(by('Diagramas de secuencia').diagramId, 'd1');
  assert.equal(by('Modelo del dominio').diagramId, 'd2');
  assert.equal(by('Modelo de diseño (clases de diseño)').diagramId, 'd3');
  assert.equal(by('Caso de negocio').diagramId, undefined);
  assert.ok(r.linked >= 4);
  // Already linked ones stay as they are.
  const again = autoLink(r.artifacts, diagrams);
  assert.equal(again.artifacts.find((a) => a.name === 'Diagramas de secuencia')!.diagramId, 'd1');
});

test('progress counts per phase and overall', () => {
  const data = upExample();
  const all = progress(data);
  assert.equal(all.total, data.artifacts.length);
  assert.equal(all.done + all.draft + all.todo, all.total);
  const inicio = progress(data, data.phases[0].id);
  assert.ok(inicio.done >= 4);
  assert.equal(progress(data, data.phases[3].id).done, 0);
});

test('iterations, efforts and disciplines stay valid', () => {
  const data = blankUp();
  const p = data.phases[2];
  addIteration(data, p.id);
  assert.deepEqual(p.iterations, ['C1', 'C2', 'C3', 'C4']);
  const t = data.phases[3];
  removeIteration(data, t.id, 0);
  assert.equal(t.iterations.length, 1, 'a phase keeps one iteration');
  const d = data.disciplines[0];
  setEffort(data, d.id, 1, 9);
  assert.equal(d.effort[1], 4);
  setEffort(data, d.id, 2, -3);
  assert.equal(d.effort[2], 0);
  addSuggested(data);
  const victim = data.disciplines.find((x) => x.name === 'Pruebas')!;
  removeDiscipline(data, victim.id);
  assert.ok(data.artifacts.every((a) => data.disciplines.some((x) => x.id === a.disciplineId)));
});

test('moving an artefact only swaps within its phase', () => {
  const data = blankUp();
  addSuggested(data);
  const inicio = data.artifacts.filter((a) => a.phaseId === data.phases[0].id);
  moveArtifact(data, inicio[1].id, -1);
  const after = data.artifacts.filter((a) => a.phaseId === data.phases[0].id);
  assert.equal(after[0].id, inicio[1].id);
  assert.equal(after[1].id, inicio[0].id);
  // The first of a phase can't go further up.
  moveArtifact(data, after[0].id, -1);
  assert.equal(data.artifacts.filter((a) => a.phaseId === data.phases[0].id)[0].id, inicio[1].id);
});

test('chart layout and humps', () => {
  const data = blankUp();
  const L = chartLayout(data);
  assert.equal(L.phases.length, 4);
  // Construcción has three iterations: wider than Inicio.
  assert.ok(L.phases[2].w > L.phases[0].w);
  const h = humpPath(L.phases, [0, 4, 1, 0], 100);
  assert.match(h.area, /^M .* Z$/);
  // Never above the peak nor below the baseline.
  const ys = [...h.line.matchAll(/-?\d+(\.\d+)?/g)].map((m) => +m[0]).filter((_, i) => i % 2 === 1);
  assert.ok(Math.min(...ys) >= 100 - 30 - 0.01 && Math.max(...ys) <= 100.01, `${Math.min(...ys)}..${Math.max(...ys)}`);
});

test('wrapText keeps lines short', () => {
  assert.deepEqual(wrapText('Arquitectura del ciclo de vida', 14), ['Arquitectura', 'del ciclo de', 'vida']);
  assert.equal(wrapText('a b c d e f g h i j', 3, 2).length, 2);
});

test('markdown lists phases, artefacts and efforts', () => {
  const data = upExample();
  data.artifacts[0].diagramId = 'x1';
  const md = upMarkdown(data, 'PUD BiblioYa', (id) => (id === 'x1' ? 'Visión de BiblioYa' : undefined));
  assert.match(md, /^# PUD BiblioYa/);
  assert.match(md, /## 1\. Inicio/);
  assert.match(md, /## 4\. Transición/);
  assert.match(md, /\*\*Hito:\*\* Objetivos del ciclo de vida/);
  assert.match(md, /\*\*Iteraciones:\*\* C1, C2, C3/);
  assert.match(md, /\| Visión — .* \| Modelado del negocio \| Hecho \| Visión de BiblioYa \|/);
  assert.match(md, /## Esfuerzo por disciplina/);
  assert.match(md, /\| Requisitos \| ●●●○ \| ●●●● \| ●○○○ \| ○○○○ \|/);
});
