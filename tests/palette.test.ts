import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colorName, colorsFromPixels, colourByKind, hexesIn, normHex, parsePalette } from '../src/lib/model/palette';

test('hex codes, however they are written', () => {
  assert.equal(normHex('3A9'), '#33aa99');
  assert.equal(normHex('#003366'), '#003366');
  assert.equal(normHex('blue'), null);
  assert.deepEqual(hexesIn('Primario #003366, secundario FF9900; acento #3a9 y otra vez #003366'), ['#003366', '#ff9900', '#33aa99']);
});

test('a stored palette is read safely', () => {
  assert.equal(parsePalette('nope'), null);
  assert.equal(parsePalette('{"name":"X","colors":[]}'), null);
  assert.deepEqual(parsePalette('{"name":"Neuranet","colors":[{"name":"Azul","hex":"#036"},{"hex":"zzz"}]}'), { name: 'Neuranet', colors: [{ name: 'Azul', hex: '#003366' }] });
});

test('colour names in Spanish', () => {
  assert.equal(colorName('#003366'), 'Azul oscuro');
  assert.equal(colorName('#e8873a'), 'Naranja');
  assert.equal(colorName('#8d949c'), 'Gris');
});

test('the main colours of a logo, without its white background', () => {
  const px: number[] = [];
  const put = (r: number, g: number, b: number, n: number) => {
    for (let i = 0; i < n; i++) px.push(r, g, b, 255);
  };
  put(255, 255, 255, 500);
  put(0, 51, 102, 300);
  put(255, 153, 0, 100);
  put(2, 52, 100, 50);
  assert.deepEqual(colorsFromPixels(new Uint8ClampedArray(px)), ['#003366', '#ff9900']);
});

test('colour by kind: one colour per kind, in the toolbar order', () => {
  const m = colourByKind(['actor', 'usecase', 'boundary', 'note'], [{ id: 'a', type: 'actor' }, { id: 'u', type: 'usecase' }, { id: 'n', type: 'note' }, { id: 'b', type: 'actor' }], ['#111111', '#222222']);
  assert.deepEqual([...m], [['a', '#111111'], ['u', '#222222'], ['b', '#111111']]);
});
