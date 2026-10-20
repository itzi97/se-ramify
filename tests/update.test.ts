import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNewer, latestRelease } from '../src/lib/desktop/update';

test('version comparison', () => {
  assert.ok(isNewer('v0.4.0', '0.3.0'));
  assert.ok(isNewer('0.10.0', '0.9.9'));
  assert.ok(!isNewer('v0.3.0', '0.3.0'));
  assert.ok(!isNewer('0.2.9', '0.3.0'));
  assert.ok(!isNewer('nightly', '0.3.0'));
});

test('latest release: version and page, or null on any failure', async () => {
  const ok = (async () => new Response(JSON.stringify({ tag_name: 'v0.4.0', html_url: 'https://github.com/itzi97/se-ramify/releases/tag/v0.4.0' }))) as typeof fetch;
  assert.deepEqual(await latestRelease(ok), { version: '0.4.0', url: 'https://github.com/itzi97/se-ramify/releases/tag/v0.4.0' });
  const down = (async () => new Response('x', { status: 403 })) as typeof fetch;
  assert.equal(await latestRelease(down), null);
  const offline = (async () => {
    throw new TypeError('offline');
  }) as typeof fetch;
  assert.equal(await latestRelease(offline), null);
});
