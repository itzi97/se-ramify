import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PERSON_COLORS, ago, initials, personColor, roster } from '../src/lib/model/people';

test('a person keeps the same colour, whatever the case or spacing of their name', () => {
  assert.equal(personColor('Itziar'), personColor(' itziar '));
  assert.ok(PERSON_COLORS.includes(personColor('Bruno')));
});

test('with the team roster, teammates never share a colour (up to ten of them)', () => {
  const team = roster(['Itziar', 'Bruno', 'Carla', 'Diego', 'Elena', 'Fran', 'Gema', 'Hugo', 'Iker', 'Julia']);
  assert.equal(new Set(team.map((n) => personColor(n, team))).size, 10);
});

test('initials: one letter by default, two on request, never empty', () => {
  assert.equal(initials('ana maría'), 'A');
  assert.equal(initials('ana maría', 2), 'AM');
  assert.equal(initials('Íñigo'), 'Í');
  assert.equal(initials('   '), '?');
});

test('ago: short and plain', () => {
  const now = Date.parse('2026-10-23T12:00:00Z');
  assert.equal(ago('2026-10-23T11:59:30Z', now), 'just now');
  assert.equal(ago('2026-10-23T11:55:00Z', now), '5 min ago');
  assert.equal(ago('2026-10-23T09:00:00Z', now), '3 h ago');
  assert.equal(ago('2026-10-22T09:00:00Z', now), 'yesterday');
  assert.equal(ago('2026-10-20T09:00:00Z', now), '3 days ago');
  assert.equal(ago('not a date', now), '');
});
