import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
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
  wouldCycle
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

test('mermaid export has sections, ids, durations and milestones', () => {
  const data = ganttExample();
  const m = toMermaid('Plan PUD: biblioteca', data);
  assert.match(m, /^gantt\n/);
  assert.match(m, /title Plan PUD - biblioteca/);
  assert.match(m, /section Inicio/);
  assert.match(m, /section Transición/);
  assert.match(m, /Hito - objetivos del ciclo de vida :milestone, t\d+, \d{4}-\d{2}-\d{2}, 0d/);
  assert.match(m, /I1 · Visión y alcance :done, t\d+, \d{4}-\d{2}-\d{2}, 5d/);
  assert.doesNotMatch(m, /section .*\n\s*section/);
});

test('csv export quotes and lists dependencies by name', () => {
  const data: GanttData = { scale: 'week', showWeekends: true, tasks: [t('a', '2026-10-19', '2026-10-20', { name: 'Diseño, fase 1' }), t('b', '2026-10-21', '2026-10-22', { deps: ['a'] })] };
  const csv = toCsv(data).trim().split('\n');
  assert.equal(csv.length, 3);
  assert.match(csv[1], /^"Diseño, fase 1",Tarea,2026-10-19,2026-10-20,2,0,,,$/);
  assert.match(csv[2], /"Diseño, fase 1"$/);
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
