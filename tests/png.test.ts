import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32, withPhys, pngDpi, pngSize, pngInches, isPng } from '../src/lib/export/png';
import { tinyPng } from './helpers';

test('crc32 matches the PNG reference value', () => {
  assert.equal(crc32(new TextEncoder().encode('IEND')), 0xae426082);
});

test('withPhys adds a pHYs chunk right after IHDR, with a valid CRC', () => {
  const png = tinyPng();
  assert.equal(pngDpi(png), null);
  const out = withPhys(png, 2);
  assert.ok(isPng(out));
  assert.equal(out.length, png.length + 21);
  const at = 8 + 25; // signature + IHDR chunk
  assert.equal(String.fromCharCode(...out.subarray(at + 4, at + 8)), 'pHYs');
  const v = new DataView(out.buffer, out.byteOffset);
  assert.equal(v.getUint32(at), 9);
  assert.equal(v.getUint32(at + 8), Math.round(192 / 0.0254));
  assert.equal(out[at + 16], 1);
  assert.equal(v.getUint32(at + 17), crc32(out.subarray(at + 4, at + 17)));
  assert.equal(pngDpi(out), 192);
  assert.deepEqual(pngSize(out), { width: 3, height: 2 });
});

test('withPhys replaces an existing pHYs instead of adding a second one', () => {
  const twice = withPhys(withPhys(tinyPng(), 2), 4);
  assert.equal(pngDpi(twice), 384);
  assert.equal(tinyPng().length + 21, twice.length);
  const inch = pngInches(withPhys(tinyPng(384, 192), 4));
  assert.deepEqual(inch, { width: 1, height: 0.5 });
});

test('non-PNG bytes pass through', () => {
  const junk = new Uint8Array([1, 2, 3]);
  assert.equal(withPhys(junk, 2), junk);
});
