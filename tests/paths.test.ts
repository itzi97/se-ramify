import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseName, crumbs, fileIcon, isHidden, joinRel, parentOf, safeFolder, safeName, within } from '../src/lib/storage/paths';

test('safeName keeps names valid on every system', () => {
  assert.equal(safeName('E2: secuencia?'), 'E2- secuencia-');
  assert.equal(safeName('  Neuranet  '), 'Neuranet');
  assert.equal(safeName('fin. '), 'fin');
  assert.equal(safeName('..'), 'Sin nombre');
  assert.equal(safeName(''), 'Sin nombre');
  assert.equal(safeName('.NET'), 'NET');
  assert.equal(safeName('node_modules'), '_node_modules');
  assert.equal(safeName('CON'), '_CON');
});

test('safeFolder cleans every part and drops empty or dot parts', () => {
  assert.equal(safeFolder(' Neuranet / E2 '), 'Neuranet/E2');
  assert.equal(safeFolder('a\\b//c'), 'a/b/c');
  assert.equal(safeFolder('../x/./y'), 'x/y');
  assert.equal(safeFolder(''), '');
});

test('folder path helpers', () => {
  assert.equal(parentOf('a/b/c'), 'a/b');
  assert.equal(parentOf('a'), '');
  assert.equal(baseName('a/b/c'), 'c');
  assert.equal(joinRel('', 'x'), 'x');
  assert.equal(joinRel('a', ''), 'a');
  assert.equal(joinRel('a', 'b'), 'a/b');
  assert.deepEqual(crumbs(''), ['']);
  assert.deepEqual(crumbs('a/b'), ['', 'a', 'a/b']);
});

test('within: the folder itself and what is inside, not a sibling with the same start', () => {
  assert.ok(within('a', ''));
  assert.ok(within('a', 'a'));
  assert.ok(within('a/b', 'a'));
  assert.ok(!within('ab', 'a'));
  assert.ok(!within('', 'a'));
});

test('hidden folders and files stay out of the browser', () => {
  for (const n of ['.git', 'se-ramify-config', 'node_modules', '__pycache__', 'x.tmp.json']) assert.ok(isHidden(n), n);
  assert.ok(!isHidden('Neuranet'));
});

test('fileIcon by extension', () => {
  assert.equal(fileIcon('Foto.PNG'), 'FileImage');
  assert.equal(fileIcon('memoria.docx'), 'FileText');
  assert.equal(fileIcon('notas.xlsx'), 'FileSpreadsheet');
  assert.equal(fileIcon('README'), 'File');
});
