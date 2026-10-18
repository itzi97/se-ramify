import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  planRange,
  addDays,
  diffDays,
  durationDays,
  headerTicks,
  indent,
  isoWeek,
  mondayOf,
  moveAmongSiblings,
  moveTask,
  outdent,
  removeTask,
  resizeTask,
  setDuration,
  setStart,
  span,
  timelineRange,
  toCsv,
  toMermaid,
  visibleRows,
  wouldCycle,
  enforceDeps,
  placeNew,
  esDate,
  parseEsDate
} from '../src/lib/editors/gantt/time.ts';
import { ganttExample } from '../src/lib/editors/gantt/example.ts';
import type { GanttData, GanttTask } from '../src/lib/model/types.ts';

function t(id: string, start: string, end: string, extra: Partial<GanttTask> = {}): GanttTask {
  return { id, name: id.toUpperCase(), start, end, progress: 0, milestone: false, group: false, deps: [], owner: '', ...extra };
}

test('dates are whole UTC days', () => {
  assert.equal(addDays('2026-10-30', 3), '2026-11-02');
  assert.equal(addDays('2026-03-28', 2), '2026-03-30'); // across the DST change
  assert.equal(diffDays('2026-10-19', '2026-10-23'), 4);
  assert.equal(durationDays({ start: '2026-10-19', end: '2026-10-23', milestone: false }), 5);
  assert.equal(durationDays({ start: '2026-10-19', end: '2026-10-19', milestone: true }), 0);
  assert.equal(mondayOf('2026-10-18'), '2026-10-12'); // Sunday belongs to the week before
  assert.equal(mondayOf('2026-10-19'), '2026-10-19');
  assert.equal(isoWeek('2026-10-19'), 43);
  assert.equal(isoWeek('2027-01-01'), 53);
});

test('rows nest children under groups and hide collapsed ones', () => {
  const tasks = [t('g', '2026-10-19', '2026-10-19', { group: true }), t('a', '2026-10-19', '2026-10-20', { parent: 'g' }), t('b', '2026-10-21', '2026-10-22')];
  assert.deepEqual(visibleRows(tasks).map((r) => [r.task.id, r.depth]), [['g', 0], ['a', 1], ['b', 0]]);
  assert.deepEqual(visibleRows(tasks, new Set(['g'])).map((r) => r.task.id), ['g', 'b']);
  // Orphans (parent deleted by hand) still show.
  assert.equal(visibleRows([t('x', '2026-10-19', '2026-10-19', { parent: 'gone' })]).length, 1);
});

test('a group spans its descendants', () => {
  const tasks = [
    t('g', '2026-01-01', '2026-01-01', { group: true }),
    t('a', '2026-10-19', '2026-10-20', { parent: 'g' }),
    t('h', '2026-10-01', '2026-10-01', { group: true, parent: 'g' }),
    t('b', '2026-10-25', '2026-10-30', { parent: 'h' })
  ];
  assert.deepEqual(span(tasks, tasks[0]), { start: '2026-10-19', end: '2026-10-30' });
});

test('move shifts a group with everything in it; resize keeps at least a day', () => {
  const data: GanttData = { scale: 'week', showWeekends: true, tasks: [t('g', '2026-10-19', '2026-10-19', { group: true }), t('a', '2026-10-19', '2026-10-20', { parent: 'g' }), t('b', '2026-10-19', '2026-10-20')] };
  moveTask(data, 'g', 7);
  assert.equal(data.tasks[1].start, '2026-10-26');
  assert.equal(data.tasks[2].start, '2026-10-19');
  resizeTask(data, 'b', 'end', -5);
  assert.equal(data.tasks[2].end, '2026-10-19');
  resizeTask(data, 'b', 'start', 3);
  assert.equal(data.tasks[2].start, '2026-10-19', 'start never passes the end');
  setDuration(data.tasks[2], 10);
  assert.equal(data.tasks[2].end, '2026-10-28');
  setStart(data.tasks[2], '2026-11-02');
  assert.equal(data.tasks[2].end, '2026-11-11', 'setStart keeps the duration');
});

test('indent goes into the group above; outdent comes back out', () => {
  const data: GanttData = { scale: 'week', showWeekends: true, tasks: [t('g', '2026-10-19', '2026-10-19', { group: true }), t('a', '2026-10-19', '2026-10-20', { parent: 'g' }), t('b', '2026-10-21', '2026-10-22')] };
  assert.equal(indent(data, 'b'), true);
  assert.equal(data.tasks.find((x) => x.id === 'b')!.parent, 'g');
  assert.deepEqual(visibleRows(data.tasks).map((r) => r.task.id), ['g', 'a', 'b']);
  assert.equal(indent(data, 'g'), false, 'nothing above to go into');
  assert.equal(outdent(data, 'a'), true);
  assert.deepEqual(visibleRows(data.tasks).map((r) => [r.task.id, r.depth]), [['g', 0], ['b', 1], ['a', 0]]);
});

test('reordering siblings carries subtrees', () => {
  const data: GanttData = {
    scale: 'week',
    showWeekends: true,
    tasks: [t('g', '2026-10-19', '2026-10-19', { group: true }), t('a', '2026-10-19', '2026-10-20', { parent: 'g' }), t('b', '2026-10-21', '2026-10-22'), t('c', '2026-10-21', '2026-10-22')]
  };
  assert.equal(moveAmongSiblings(data, 'g', 1), true);
  assert.deepEqual(visibleRows(data.tasks).map((r) => r.task.id), ['b', 'g', 'a', 'c']);
  assert.equal(moveAmongSiblings(data, 'c', -1), true);
  assert.deepEqual(visibleRows(data.tasks).map((r) => r.task.id), ['b', 'c', 'g', 'a']);
  assert.equal(moveAmongSiblings(data, 'b', -1), false);
});

test('removing a group removes its subtree and dependencies on it', () => {
  const data: GanttData = { scale: 'week', showWeekends: true, tasks: [t('g', '2026-10-19', '2026-10-19', { group: true }), t('a', '2026-10-19', '2026-10-20', { parent: 'g' }), t('b', '2026-10-21', '2026-10-22', { deps: ['a'] })] };
  removeTask(data, 'g');
  assert.deepEqual(data.tasks.map((x) => x.id), ['b']);
  assert.deepEqual(data.tasks[0].deps, []);
});

test('dependency loops are detected', () => {
  const tasks = [t('a', '2026-10-19', '2026-10-20'), t('b', '2026-10-21', '2026-10-22', { deps: ['a'] }), t('c', '2026-10-23', '2026-10-24', { deps: ['b'] })];
  assert.equal(wouldCycle(tasks, 'c', 'a'), true, 'a after c would loop');
  assert.equal(wouldCycle(tasks, 'a', 'c'), false);
  assert.equal(wouldCycle(tasks, 'a', 'a'), true);
});

test('timeline range covers tasks and today, snapped to weeks', () => {
  const r = timelineRange([t('a', '2026-10-21', '2026-10-30')], 'week', '2026-10-18');
  assert.equal(r.start, '2026-10-12');
  assert.equal(new Date(Date.parse(r.end)).getUTCDay(), 1, 'ends on a Monday');
  assert.ok(r.days >= 70);
  const ticks = headerTicks(r, 'week');
  assert.equal(ticks.bottom[0].label.startsWith('S42'), true);
  assert.equal(ticks.top.reduce((n, x) => n + x.span, 0), r.days, 'month bands cover the whole range');
});

test('mermaid export has sections, ids, exclusive end dates and milestones', () => {
  const data = ganttExample();
  const m = toMermaid('Plan PUD: biblioteca', data);
  assert.match(m, /^gantt\n/);
  assert.match(m, /title Plan PUD - biblioteca/);
  assert.match(m, /section Inicio/);
  assert.match(m, /section Transición/);
  assert.match(m, /Hito - objetivos del ciclo de vida :milestone, t\d+, (after t\d+( t\d+)*|\d{4}-\d{2}-\d{2}), 0d/);
  // Visión: 5 days from the plan's Monday → exclusive end 5 days later.
  const v = data.tasks.find((x) => x.name.startsWith('I1 · Visión'))!;
  assert.ok(m.includes(`I1 · Visión y alcance :done, t2, ${v.start}, ${addDays(v.end, 1)}`));
  assert.doesNotMatch(m, /section .*\n\s*section/);
  // Every task line follows Mermaid's gantt grammar: name :[tags,] id, start|after ids, end|duration
  for (const line of m.split('\n').filter((l) => l.includes(' :'))) {
    assert.match(line, /^ {2}[^:]+ :((done|active|crit|milestone), )*t\d+, (\d{4}-\d{2}-\d{2}|after( t\d+)+), (\d{4}-\d{2}-\d{2}|0d)$/, line);
  }
});

test('mermaid: dependencies become `after`, and dates stay exact when weekends are excluded', () => {
  const data: GanttData = {
    scale: 'week',
    showWeekends: false,
    tasks: [t('a', '2026-10-19', '2026-10-30'), t('b', '2026-10-31', '2026-11-06', { deps: ['a'] }), t('c', '2026-11-09', '2026-11-10', { deps: ['b'] })]
  };
  const m = toMermaid('P', data);
  assert.match(m, /excludes weekends/);
  assert.match(m, /A :t1, 2026-10-19, 2026-10-31/, 'two calendar weeks, end date not a duration');
  assert.match(m, /B :t2, after t1, 2026-11-07/);
  // C starts later than right after B (a gap over the weekend): explicit start keeps it exact.
  assert.match(m, /C :t3, 2026-11-09, 2026-11-11/);
});

test('dependencies push dependents later, in a cascade, keeping their length', () => {
  const data: GanttData = {
    scale: 'week',
    showWeekends: true,
    tasks: [t('a', '2026-10-19', '2026-10-23'), t('b', '2026-10-26', '2026-10-28', { deps: ['a'] }), t('c', '2026-10-29', '2026-10-30', { deps: ['b'] }), t('m', '2026-10-31', '2026-10-31', { milestone: true, deps: ['c'] })]
  };
  moveTask(data, 'a', 7);
  const moved = enforceDeps(data);
  assert.deepEqual(moved.sort(), ['b', 'c', 'm']);
  const b = data.tasks[1];
  const c = data.tasks[2];
  assert.equal(b.start, '2026-10-31');
  assert.equal(durationDays(b), 3);
  assert.equal(c.start, addDays(b.end, 1));
  assert.equal(data.tasks[3].start, addDays(c.end, 1));
  // A dependent dragged before its prerequisite snaps back after it.
  moveTask(data, 'b', -20);
  enforceDeps(data);
  assert.equal(data.tasks[1].start, addDays(data.tasks[0].end, 1));
  // Nothing to do when everything is already in order.
  assert.deepEqual(enforceDeps(data), []);
});

test('a new phase is top level after the current one; a new task starts after the previous one', () => {
  const g1 = t('g1', '2026-10-19', '2026-10-19', { group: true });
  const a = t('a', '2026-10-19', '2026-10-23', { parent: 'g1' });
  const data: GanttData = { scale: 'week', showWeekends: true, tasks: [g1, a] };
  const phase = placeNew(data, 'group', 'a', '2026-10-18');
  assert.equal(phase.parent, undefined);
  assert.equal(phase.index, 2);
  assert.equal(phase.start, '2026-10-26', 'after Fri 23 the next workday is Mon 26');
  const task = placeNew(data, 'task', 'g1', '2026-10-18');
  assert.equal(task.parent, 'g1');
  assert.equal(task.start, '2026-10-26');
  const first = placeNew({ scale: 'week', showWeekends: true, tasks: [g1] }, 'task', 'g1', '2026-10-18');
  assert.equal(first.start, g1.start, "an empty phase's first task starts with the phase");
  const none = placeNew({ scale: 'week', showWeekends: true, tasks: [] }, 'task', null, '2026-10-21');
  assert.equal(none.start, '2026-10-19', 'a blank plan starts on Monday');
});

test('csv is for Spanish Excel: BOM, semicolons, dd/mm/aaaa, quoted when needed', () => {
  const data: GanttData = { scale: 'week', showWeekends: true, tasks: [t('a', '2026-10-19', '2026-10-20', { name: 'Diseño; fase 1' }), t('b', '2026-10-21', '2026-10-22', { deps: ['a'] })] };
  const raw = toCsv(data);
  assert.equal(raw.charCodeAt(0), 0xfeff);
  const csv = raw.slice(1).trim().split('\r\n');
  assert.equal(csv.length, 3);
  assert.match(csv[0], /^Nombre;Tipo;Inicio;Fin;/);
  assert.match(csv[1], /^"Diseño; fase 1";Tarea;19\/10\/2026;20\/10\/2026;2;0;;;$/);
  assert.match(csv[2], /"Diseño; fase 1"$/);
});

test('Spanish dates in and out', () => {
  assert.equal(esDate('2026-10-05'), '05/10/2026');
  assert.equal(parseEsDate('5/10/2026'), '2026-10-05');
  assert.equal(parseEsDate('05-10-26'), '2026-10-05');
  assert.equal(parseEsDate('2026-10-05'), '2026-10-05');
  assert.equal(parseEsDate('31/02/2026'), null);
  assert.equal(parseEsDate('mañana'), null);
});

test('the example is a sane PUD plan', () => {
  const d = ganttExample();
  const groups = d.tasks.filter((x) => x.group).map((x) => x.name);
  assert.deepEqual(groups, ['Inicio', 'Elaboración', 'Construcción', 'Transición']);
  for (const x of d.tasks) {
    assert.ok(x.start <= x.end, x.name);
    for (const dep of x.deps) {
      const p = d.tasks.find((y) => y.id === dep)!;
      assert.ok(p.end <= x.start, `${p.name} ends before ${x.name} starts`);
    }
  }
  assert.equal(new Date(Date.parse(d.tasks[1].start)).getUTCDay(), 1, 'starts on a Monday');
});

test('planRange: only the plan, about one unit of margin, no today', () => {
  const tasks = [
    { id: 'a', name: 'A', start: '2026-10-31', end: '2026-11-04', progress: 0, milestone: false, group: false, deps: [], owner: '' },
    { id: 'b', name: 'B', start: '2026-11-22', end: '2026-11-26', progress: 0, milestone: false, group: false, deps: [], owner: '' }
  ];
  const m = planRange(tasks, 'month', '2026-01-15');
  assert.equal(m.start, '2026-10-01');
  assert.equal(m.end, '2026-12-01');
  const w = planRange(tasks, 'week', '2026-01-15');
  assert.equal(w.start, '2026-10-19');
  assert.equal(w.end, '2026-12-07');
  const d = planRange(tasks, 'day', '2027-06-01');
  assert.equal(d.start, '2026-10-30');
  assert.equal(d.end, '2026-11-28');
  assert.equal(planRange([], 'day', '2026-10-18').start, '2026-10-17');
});
