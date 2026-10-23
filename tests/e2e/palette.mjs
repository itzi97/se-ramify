// Company colours: a folder's palette (pasted hex codes), offered in the
// colour picker, used by "Colour by kind", and saved in the shared folder.
//   node tests/e2e/palette.mjs <port> [screenshotDir]
import { chromium } from 'playwright';

const [port, shots] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const fail = (m) => {
  console.log('FAIL', m);
  process.exitCode = 1;
};
page.on('pageerror', (e) => errors.push(String(e)));
const until = (fn, arg, what) => page.waitForFunction(fn, arg, { timeout: 6000 }).catch(() => fail(what));

await page.goto(`http://localhost:${port}/?debug`);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('se-ramify:dir', 'browser-localStorage');
  localStorage.setItem('se-ramify:setting:checkUpdates', 'false');
});
await page.reload();
await page.waitForFunction(() => window.__app?.ready);
await page.evaluate(() => window.__app.create('usecase', 'Casos', 'Neuranet', window.__modules.usecase.example()));
await page.waitForTimeout(800);

// 1. The folder's colours from the brand guide's hex codes.
await page.getByRole('button', { name: 'Colours of Neuranet' }).click();
await page.getByLabel('Name', { exact: true }).fill('Neuranet');
await page.getByLabel('Paste colour codes').fill('#0b3d91 #f28c28 #2bb3a3');
await page.getByRole('button', { name: 'Use', exact: true }).click();
if (shots) await page.screenshot({ path: `${shots}/palette-dialog.png` });
await page.getByRole('button', { name: 'Save colours' }).click();
const saved = await page.evaluate(() => Object.entries(localStorage).find(([k]) => k.includes('palette-neuranet'))?.[1]);
if (!saved || !saved.includes('#0b3d91')) fail(`the palette was not saved in the folder's config: ${saved}`);

// 2. Colour by kind (canvas menu): actors and use cases in the first two colours.
await page.waitForTimeout(400);
await page.locator('.svelte-flow__pane').click({ button: 'right', position: { x: 30, y: 400 } });
await page.getByRole('menuitem', { name: /Colour by kind/ }).click();
await until(
  () => {
    const n = window.__app.doc.data.nodes;
    return n.filter((x) => x.type === 'actor').every((x) => x.color === '#0b3d91') && n.filter((x) => x.type === 'usecase').every((x) => x.color === '#f28c28');
  },
  null,
  'colour by kind did not use the palette'
);
await page.waitForTimeout(500);
if (shots) await page.screenshot({ path: `${shots}/palette-canvas.png` });

// 3. The colour picker offers the palette.
await page.evaluate(() => {
  const id = window.__app.doc.data.nodes.find((n) => n.label === 'Socio').id;
  document.querySelector(`.svelte-flow__node[data-id="${id}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.locator('.inspector .swatches').first().waitFor({ timeout: 5000 }).catch(() => fail('no colour picker for the selected actor'));
const offered = await page.locator('.inspector .swatches .swatch[aria-label]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')));
if (!offered.some((l) => /Azul/.test(l))) fail(`the picker offers: ${offered}`);

if (errors.length) fail(errors.join('\n'));
console.log(process.exitCode ? 'palette: FAILED' : 'palette: all good');
await browser.close();
