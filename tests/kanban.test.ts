import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardsIn, kanbanExample, moveCard, newCard, overLimit, removeColumn, toMarkdown } from '../src/lib/editors/kanban/ops.ts';

test('the example shows one column over its WIP limit', () => {
  const d = kanbanExample();
  const over = d.columns.filter((c) => overLimit(d, c.id)).map((c) => c.name);
  assert.deepEqual(over, ['En curso']);
});

test('moving cards between and within columns keeps orders dense', () => {
  const d = kanbanExample();
  const [backlog, todo] = d.columns;
  const card = cardsIn(d, backlog.id)[0];
  moveCard(d, card.id, todo.id, 1);
  assert.deepEqual(cardsIn(d, todo.id).map((c) => c.order), [0, 1, 2]);
  assert.equal(cardsIn(d, todo.id)[1].id, card.id);
  assert.deepEqual(cardsIn(d, backlog.id).map((c) => c.order), [0, 1]);
  moveCard(d, card.id, todo.id, 0);
  assert.equal(cardsIn(d, todo.id)[0].id, card.id);
  moveCard(d, card.id, 'nope', 0);
  assert.equal(card.colId, todo.id, 'unknown column is ignored');
});

test('removing a column hands its cards to the neighbour', () => {
  const d = kanbanExample();
  const [backlog, todo] = d.columns;
  const n = cardsIn(d, backlog.id).length + cardsIn(d, todo.id).length;
  removeColumn(d, todo.id);
  assert.equal(cardsIn(d, backlog.id).length, n);
  assert.deepEqual(cardsIn(d, backlog.id).map((c) => c.order), [...Array(n).keys()]);
  const solo = { columns: [{ id: 'a', name: 'A', wip: 0 }], cards: [newCard('a', 0)] };
  removeColumn(solo, 'a');
  assert.equal(solo.cards.length, 0);
});

test('markdown lists columns with counts and limits', () => {
  const md = toMarkdown('Tablero', kanbanExample());
  assert.match(md, /^# Tablero\n/);
  assert.match(md, /## En curso \(4\/3 · 11 pts\)/);
  assert.match(md, /- \*\*\[Error\]\*\* La búsqueda no encuentra títulos con tilde \(1 pts\) — Pablo Gil/);
  assert.match(md, /### \[Historia\] Reservar un libro disponible — Ana García/);
  assert.match(md, /```gherkin/);
});
