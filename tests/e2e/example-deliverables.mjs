// Load the example project in the browser build, check its hand-in
// checklist and export every hand-in (E1, E2, E3, Final) through the real
// buttons, saving the downloaded files into <out>/<id>/.
//   node tests/e2e/example-deliverables.mjs <port> <outDir> [shotsDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [port, outDir, shots] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://localhost:${port}/?debug`);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('se-ramify:dir', 'browser-localStorage');
});
await page.reload();
await page.waitForFunction(() => window.__app?.ready);

await page.getByRole('button', { name: 'Load the example project' }).click();
await page.getByRole('dialog', { name: 'Hand-in checklist' }).waitFor();
await page.waitForTimeout(800);

let failed = false;
for (const id of ['E1', 'E2', 'E3', 'Final']) {
  await page.getByRole('tab', { name: new RegExp(`^${id}`) }).click();
  await page.waitForTimeout(300);
  const count = await page.getByRole('tab', { name: new RegExp(`^${id}`) }).locator('.count').textContent();
  const [done, total] = count.split('/').map(Number);
  console.log(`${id}: ${count}`);
  if (done !== total) failed = true;
  if (shots) await page.screenshot({ path: join(shots, `checklist-${id}.png`) });
  const dir = join(outDir, id);
  mkdirSync(dir, { recursive: true });
  const saved = [];
  const onDownload = async (d) => {
    const name = d.suggestedFilename();
    saved.push(name);
    await d.saveAs(join(dir, name));
  };
  page.on('download', onDownload);
  await page.getByRole('button', { name: new RegExp(`^Export ${id}`) }).click();
  // Which documents: tick them all.
  const chooser = page.getByRole('dialog', { name: 'Export formats' });
  await chooser.waitFor();
  for (const box of await chooser.getByRole('checkbox').all()) await box.check();
  await chooser.getByRole('button', { name: /^Export/ }).click();
  // The export opens every diagram in turn; it ends with the memoria, then the documents, the deck last.
  const last = `-${id.toLowerCase()}-presentacion.pptx`;
  for (let i = 0; i < 960 && !saved.some((n) => n.endsWith(last)); i++) await page.waitForTimeout(250);
  for (const ext of ['memoria.md', 'memoria.docx', 'memoria.tex', 'memoria-cuerpo.tex', 'presentacion.pptx'])
    if (!saved.some((n) => n.endsWith(`-${id.toLowerCase()}-${ext}`))) (console.log(`  no ${ext} for ${id}`), (failed = true));
  await page.waitForTimeout(500);
  page.off('download', onDownload);
  console.log(`  ${saved.length} files`);
  // The checklist stays open over the export; wait for the notice to clear before the next one.
  await page.waitForTimeout(500);
}
if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
await browser.close();
if (failed || errors.length) process.exit(1);
