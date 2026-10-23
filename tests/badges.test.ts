import { test } from 'node:test';
import assert from 'node:assert/strict';
import { personBadge, priorityBadge } from '../src/lib/model/badges.ts';
import { personColor, roster } from '../src/lib/model/people.ts';
import { hexToRgb, luminance } from '../src/lib/model/colors.ts';

const contrast = (a: string, b: string) => {
  const la = luminance(hexToRgb(a)!);
  const lb = luminance(hexToRgb(b)!);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

test('MoSCoW priorities carry their colour: Must red, Should orange, Could amber, Won\'t grey', () => {
  assert.equal(priorityBadge('Must')?.c, '#d9534f');
  assert.equal(priorityBadge('Should')?.c, '#e8873a');
  assert.equal(priorityBadge('Could')?.c, '#e2c044');
  assert.equal(priorityBadge("Won't")?.c, '#8d949c');
  // Typed by hand, in any case: still recognised.
  assert.equal(priorityBadge('  must ')?.c, '#d9534f');
  assert.equal(priorityBadge('could')?.label, 'Could have');
  // Unknown: neutral grey, labelled as typed. Empty: no badge.
  assert.deepEqual(priorityBadge('Alta'), { c: '#8d949c', ink: '#16191d', label: 'Alta' });
  assert.equal(priorityBadge(''), null);
  assert.equal(priorityBadge(undefined), null);
});

test('priority badge text stays readable on its fill', () => {
  for (const p of ['Must', 'Should', 'Could', "Won't"]) {
    const b = priorityBadge(p)!;
    assert.ok(contrast(b.c, b.ink) >= 3.5, `${p}: ${contrast(b.c, b.ink).toFixed(2)}`);
  }
});

test('people on one board get different colours; a name keeps its colour', () => {
  const people = ['Ana García', 'Luis Pérez', 'Marta Ruiz', 'Pablo Gil'];
  const colours = people.map((n) => personBadge(n, people).c);
  assert.equal(new Set(colours).size, people.length);
  assert.equal(personBadge('ana garcía', people).c, colours[0], 'case does not matter');
  assert.equal(personBadge('Zoe').c, personBadge('Zoe').c, 'stable without a roster');
  for (const n of [...people, 'Zoe', 'Bruno Díaz']) {
    const { c, ink } = personBadge(n, people);
    assert.notEqual(c, '#d9534f', 'red is kept for warnings and Must');
    assert.ok(contrast(c, ink) >= 4.5, `${n}: initials contrast ${contrast(c, ink).toFixed(2)}`);
  }
});

test('teammates keep their colour on a board: the team comes first, other assignees after', () => {
  const team = ['Itziar', 'Bruno', 'Carla'];
  const board = roster(team, ['Cliente', 'bruno ', 'Ana']);
  assert.deepEqual(board, ['Bruno', 'Carla', 'Itziar', 'Ana', 'Cliente']);
  for (const n of team) assert.equal(personColor(n, board), personColor(n, roster(team)), n);
  assert.equal(new Set(board.map((n) => personColor(n, board))).size, board.length);
});
