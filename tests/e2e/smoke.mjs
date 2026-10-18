// Every kind, blank and example, light and dark: opens without page errors and draws something.
//   node tests/e2e/smoke.mjs [port]      (against `npm run dev` or `npx vite preview --port …`)
import { chromium } from 'playwright';
const port = process.argv[2] ?? '1420';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
let failed = 0;
for (const scheme of ['light', 'dark']) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, colorScheme: scheme });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${port}/?debug`);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('se-ramify:dir', 'smoke'); });
  await page.reload();
  await page.waitForFunction(() => window.__app?.ready);
  const kinds = await page.evaluate(() => Object.keys(window.__modules));
  for (const kind of kinds) {
    for (const start of ['blank', 'example']) {
      errors.length = 0;
      await page.evaluate(async ([k, s]) => window.__app.create(k, `${k} ${s}`, 'smoke', s === 'example' ? window.__modules[k].example() : undefined), [kind, start]);
      await page.waitForTimeout(350);
      const drawn = await page.evaluate(() => document.querySelector('.editor-area')?.innerText.length ?? 0);
      if (errors.length || (start === 'example' && drawn < 10)) {
        failed++;
        console.log(`FAIL ${scheme} ${kind} ${start}: ${errors.join(' | ') || 'nothing drawn'}`);
      }
    }
  }
  console.log(`${scheme}: ${kinds.length} kinds checked`);
  await page.close();
}
await browser.close();
if (failed) {
  console.log(`${failed} failures`);
  process.exit(1);
}
console.log('smoke: all good');
