import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MINUTES_TYPES,
  addRow,
  agendaIsTemplate,
  heading,
  longDate,
  minutesCsv,
  minutesMarkdown,
  missing,
  moveRow,
  normMinutes,
  removeRow,
  resetAgenda,
  setType,
  templateAgenda,
  updateRow
} from '../src/lib/editors/minutes/model';
import { minutesExample, postmortemExample, retroExample } from '../src/lib/editors/minutes/example';
import { blankData } from '../src/lib/model/diagram';

test('every type has a template agenda; post mortem asks the three questions', () => {
  for (const t of MINUTES_TYPES) assert.ok(templateAgenda(t.type).length >= 3, t.type);
  assert.deepEqual(
    templateAgenda('postmortem').map((a) => a.text),
    ['Qué ha funcionado bien', 'Qué ha ido mal', 'Qué mejoraríamos', 'Acciones para el próximo proyecto']
  );
  assert.ok(templateAgenda('client').some((a) => a.text.startsWith('Aclarar requisitos de')));
});

test('switching type replaces an untouched agenda but keeps a written one', () => {
  const d = normMinutes(blankData('minutes'));
  setType(d, 'client');
  assert.equal(d.agenda[0].text, 'Presentación de los asistentes');
  setType(d, 'postmortem');
  assert.equal(d.agenda[0].text, 'Qué ha funcionado bien');
  assert.ok(agendaIsTemplate(d));
  d.agenda[1].text = 'Retrasos en la entrega 3';
  setType(d, 'retro');
  assert.equal(d.type, 'retro');
  assert.equal(d.agenda[1].text, 'Retrasos en la entrega 3');
  resetAgenda(d);
  assert.equal(d.agenda[0].text, 'Qué ha ido bien');
});

test('list operations add, update, move and remove rows', () => {
  const d = normMinutes(blankData('minutes'));
  const a = addRow(d, 'decisions', { text: 'A' });
  const b = addRow(d, 'decisions', { text: 'B' });
  updateRow(d, 'decisions', a, { text: 'A2' });
  moveRow(d, 'decisions', b, -1);
  assert.deepEqual(d.decisions.map((x) => x.text), ['B', 'A2']);
  moveRow(d, 'decisions', b, -1); // already first: no change
  removeRow(d, 'decisions', b);
  removeRow(d, 'decisions', 'nope');
  assert.deepEqual(d.decisions.map((x) => x.text), ['A2']);
  const r = addRow(d, 'review', { kind: 'bad', area: 'method' });
  assert.equal(d.review.find((x) => x.id === r)!.area, 'method');
});

test('the checker lists what a blank acta lacks', () => {
  const d = normMinutes({ ...blankData('minutes'), date: '' });
  const m = missing(d);
  assert.ok(m.includes('No date.'));
  assert.ok(m.includes('No attendees.'));
  assert.ok(m.includes('No agenda.'));
  assert.ok(m.includes('No decisions or actions agreed.'));
  assert.ok(m.includes('No questions recorded for the client.'));
});

test('actions without owner or date, and a template "…" are flagged', () => {
  const d = normMinutes(minutesExample());
  assert.ok(missing(d).length === 0, missing(d).join(' '));
  d.actions.push({ id: 'x', text: 'Algo', owner: '', due: '', done: false });
  d.agenda.push({ id: 'y', text: 'Aclarar requisitos de …' });
  const m = missing(d);
  assert.ok(m.includes('1 action without an owner.'));
  assert.ok(m.includes('1 action without a due date.'));
  assert.ok(m.some((x) => x.includes('"…"')));
});

test('a post mortem needs both team and methodology, and all three columns', () => {
  const d = normMinutes(postmortemExample());
  assert.deepEqual(missing(d), []);
  d.review = d.review.filter((r) => r.area === 'team' && r.kind !== 'improve');
  const m = missing(d);
  assert.ok(m.includes('Nothing about the methodology (Metodología).'));
  assert.ok(m.includes('Nothing under "Mejorable".'));
  assert.ok(!m.includes('No questions recorded for the client.'));
});

test('heading and Spanish long date', () => {
  assert.equal(heading(minutesExample()), 'Acta de reunión con el cliente nº 1');
  assert.equal(longDate('2026-10-21'), 'miércoles, 21 de octubre de 2026');
  assert.equal(longDate(''), '');
});

test('client markdown has questions, decisions, actions; no review', () => {
  const md = minutesMarkdown('Reunión 1', minutesExample());
  assert.match(md, /^# Reunión 1\n\n\*\*Acta de reunión con el cliente nº 1\*\*/);
  for (const h of ['## Asistentes', '## Ausentes', '## Orden del día', '## Desarrollo de la reunión', '## Preguntas y respuestas', '## Acuerdos', '## Acciones', '## Próxima reunión']) assert.ok(md.includes(h), h);
  assert.ok(!md.includes('## Valoración'));
  assert.match(md, /\| Pasar esta acta a todos los asistentes \| Ana López \| 22\/10\/2026 \| Hecha \|/);
  assert.match(md, /- David Martín — Desarrollo y pruebas/);
});

test('post mortem markdown groups the review by team and methodology', () => {
  const md = minutesMarkdown('Post mortem', postmortemExample());
  assert.ok(md.includes('## Valoración'));
  const team = md.indexOf('### Equipo');
  const method = md.indexOf('### Metodología');
  assert.ok(team > 0 && method > team);
  assert.ok(md.includes('**Mejorable**'));
  assert.ok(!md.includes('## Preguntas y respuestas'));
});

test('empty sections are left out of the markdown', () => {
  const md = minutesMarkdown('Vacía', blankData('minutes'));
  assert.ok(!md.includes('## Acuerdos'));
  assert.ok(!md.includes('## Acciones'));
  assert.match(md, /\| — \| — \| — \||\| .+ \| — \| — \|/);
});

test('CSV of actions: BOM, semicolons, quoting', () => {
  const d = minutesExample();
  d.actions[0].text = 'Revisar; corregir "todo"';
  const csv = minutesCsv(d);
  assert.ok(csv.startsWith('﻿Acción;Responsable;Fecha límite;Estado\n'));
  assert.ok(csv.includes('"Revisar; corregir ""todo""";Bruno Díaz;26/10/2026;Pendiente'));
  assert.equal(csv.trim().split('\n').length, 1 + d.actions.length);
});

test('normalising heals a half-written file', () => {
  const d = normMinutes({ type: 'bogus' as never, review: [{ id: 'a', text: 'x' } as never] });
  assert.equal(d.type, 'client');
  assert.deepEqual(d.attendees, []);
  assert.equal(d.review[0].kind, 'well');
  assert.equal(d.review[0].area, 'team');
});

test('the retrospective example is complete: every kind and both areas', () => {
  const d = normMinutes(retroExample());
  assert.equal(d.type, 'retro');
  assert.deepEqual(missing(d), []);
  for (const kind of ['well', 'bad', 'improve'] as const) assert.ok(d.review.some((r) => r.kind === kind), kind);
  assert.ok(d.review.some((r) => r.area === 'team') && d.review.some((r) => r.area === 'method'));
  assert.match(minutesMarkdown('Retro', d), /\*\*Acta de retrospectiva nº 8\*\*/);
});
