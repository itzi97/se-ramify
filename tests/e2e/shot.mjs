// Screenshot one diagram kind in the browser build (dev server or preview).
//   node tests/e2e/shot.mjs <port> <kind> <out.png> [example|blank] [light|dark] [width] [height]
// Starts from a clean localStorage, creates the diagram through the debug hook, waits, screenshots.
import { chromium } from 'playwright';

const [port, kind, out, start = 'example', theme = 'light', w = '1440', h = '900'] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: +w, height: +h }, colorScheme: theme === 'dark' ? 'dark' : 'light' });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://localhost:${port}/?debug`);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('se-ramify:dir', 'browser-localStorage'); });
await page.reload();
await page.waitForFunction(() => window.__app?.ready);
await page.evaluate(async ([kind, start]) => {
  const data = start === 'example' ? window.__modules[kind].example() : undefined;
  await window.__app.create(kind, 'Test ' + kind, 'Pruebas', data);
}, [kind, start]);
await page.waitForTimeout(1200);
await page.screenshot({ path: out });
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
else console.log('ok, no console errors');
await browser.close();
