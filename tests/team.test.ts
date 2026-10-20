import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editedLine, hasConflictMarkers, isConflictCopy, markDuplicates, splitConflict } from '../src/lib/storage/team';
import type { DiagramMeta } from '../src/lib/model/types';

const meta = (id: string, path: string): DiagramMeta => ({ id, kind: 'class', title: 't', project: '', updated: '2026-10-20T10:00:00Z', path });

test('sync apps\' conflict copies are recognised', () => {
  assert.ok(isConflictCopy('class-x-ab12cd (conflicted copy 2026-10-20).json'));
  assert.ok(isConflictCopy('class-x-ab12cd.sync-conflict-20261020-101010-ABC.json'));
  assert.ok(isConflictCopy('class-x-ab12cd-DESKTOP-1-conflict-1.json'));
  assert.ok(!isConflictCopy('class-diagrama-ab12cd.json'));
});

test('files sharing an id: the original stays, copies point at it', () => {
  const list = markDuplicates([
    meta('a', '/d/class-x-aaaaaa (1).json'),
    meta('a', '/d/class-x-aaaaaa.json'),
    meta('b', '/d/usecase-y-bbbbbb.json')
  ]);
  assert.equal(list[0].dupOf, '/d/class-x-aaaaaa.json');
  assert.equal(list[1].dupOf, undefined);
  assert.equal(list[2].dupOf, undefined);
});

test('git conflict markers split into the two versions', () => {
  const text = ['{', '  "title": "A",', '<<<<<<< HEAD', '  "updated": "1",', '=======', '  "updated": "2",', '>>>>>>> origin/main', '  "kind": "class"', '}'].join('\n');
  assert.ok(hasConflictMarkers(text));
  const s = splitConflict(text)!;
  assert.equal(JSON.parse(s.ours).updated, '1');
  assert.equal(JSON.parse(s.theirs).updated, '2');
  assert.equal(s.oursLabel, 'HEAD');
  assert.equal(s.theirsLabel, 'origin/main');
});

test('diff3 style: the base section is dropped; broken markers give null', () => {
  const diff3 = ['x', '<<<<<<< ours', 'a', '||||||| base', 'b', '=======', 'c', '>>>>>>> theirs', 'y'].join('\n');
  assert.deepEqual(splitConflict(diff3), { ours: 'x\na\ny', theirs: 'x\nc\ny', oursLabel: 'ours', theirsLabel: 'theirs' });
  assert.equal(splitConflict('<<<<<<< a\nx\n=======\n'), null);
  assert.equal(splitConflict('{"a": 1}'), null);
});

test('who and when', () => {
  const now = Date.parse('2026-10-20T10:05:00Z');
  assert.equal(editedLine('2026-10-20T10:00:00Z', 'Bruno', now), 'Edited by Bruno, 5 min ago');
  assert.equal(editedLine('2026-10-20T10:04:50Z', undefined, now), 'Edited just now');
});
