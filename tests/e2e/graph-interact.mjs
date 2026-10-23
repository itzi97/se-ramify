// Graph editor smoke: add shapes from the toolbar, connect them by dragging, rename inline,
// delete, undo; tidy; PNG export; right-click menus (colour, line type, add here) and the
// mini map; mind map Tab / Enter.
import { chromium } from 'playwright';
const port = process.argv[2] ?? '1430';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const fail = (m) => { console.log('FAIL', m); process.exitCode = 1; };
await page.goto(`http://localhost:${port}/?debug`);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('se-ramify:dir', 'b'); });
await page.reload();
await page.waitForFunction(() => window.__app?.ready);
await page.evaluate(() => window.__app.create('class', 'Interact', 'T'));
await page.waitForTimeout(600);
const data = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__app.doc.data)));

// 1. add two classes with the toolbar
await page.getByRole('button', { name: 'Class', exact: true }).click(); await page.waitForTimeout(300);
await page.keyboard.type('Socio');
await page.keyboard.press('Enter');
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'Class', exact: true }).click(); await page.waitForTimeout(300);
await page.keyboard.type('Prestamo');
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
let d = await data();
if (d.nodes.length !== 2 || d.nodes[0].label !== 'Socio' || d.nodes[1].label !== 'Prestamo') fail('add+rename: ' + JSON.stringify(d.nodes.map((n) => n.label)));
// move the second one away so they don't overlap
await page.evaluate(() => window.__app.change((doc) => { doc.data.nodes[1].x += 320; }));
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Fit to window' }).click();
await page.waitForTimeout(500);

// 2. connect by dragging from the source dot to the other node
const a = page.locator('.svelte-flow__node').nth(0);
const b = page.locator('.svelte-flow__node').nth(1);
await a.hover();
const dot = a.locator('.connect-dot');
const db = await dot.boundingBox();
const bb = await b.boundingBox();
await page.mouse.move(db.x + db.width / 2, db.y + db.height / 2);
await page.mouse.down();
await page.mouse.move(bb.x + bb.width / 2, bb.y + 20, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(300);
d = await data();
if (d.edges.length !== 1) fail('connect: ' + d.edges.length);
else console.log('connected', d.edges[0].type);

// 3. delete the edge with the keyboard, then undo
await page.keyboard.press('Delete');
await page.waitForTimeout(200);
d = await data();
if (d.edges.length !== 0) fail('delete edge');
await page.keyboard.press('Control+z');
await page.waitForTimeout(200);
d = await data();
if (d.edges.length !== 1) fail('undo');

// 4. tidy
await page.getByRole('button', { name: /Tidy/ }).click();
await page.waitForTimeout(800);

// 5. PNG export
const dl = page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
await page.getByRole('button', { name: 'Export', exact: true }).click();
await page.getByRole('menuitem', { name: /PNG/ }).click();
const file = await dl;
if (!file) fail('no png download');
else { const p = await file.path(); const fs = await import('node:fs'); console.log('png bytes', fs.statSync(p).size); fs.copyFileSync(p, (await import('node:path')).join((await import('node:os')).tmpdir(), 'se-ramify-export-class.png')); }

// 5b. right-click menus: colour a shape, retype a line, add a shape where the canvas was clicked;
//     the mini map is remembered for the kind
const menu = page.getByRole('menu');
await page.locator('.svelte-flow__node').nth(0).click({ button: 'right' });
await menu.getByRole('menuitemradio', { name: 'Green' }).click();
await page.waitForTimeout(200);
d = await data();
if (d.nodes[0].color !== '#58a55c') fail('menu colour: ' + d.nodes[0].color);
if (await menu.count()) fail('menu stayed open');
const mid = await page.locator('.svelte-flow__edge .hit').first().evaluate((el) => {
  const p = el.getPointAtLength(el.getTotalLength() / 2);
  const m = el.getScreenCTM();
  return { x: p.x * m.a + m.e, y: p.y * m.d + m.f };
});
await page.mouse.click(mid.x, mid.y, { button: 'right' });
await menu.getByRole('menuitemradio', { name: 'Composición' }).click();
await page.waitForTimeout(200);
d = await data();
if (d.edges[0].type !== 'composition') fail('menu line type: ' + d.edges[0].type);
await page.locator('.svelte-flow__pane').click({ button: 'right', position: { x: 60, y: 160 } });
await menu.locator('.tile', { hasText: 'Interfaz' }).click();
await page.waitForTimeout(300);
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
d = await data();
if (!d.nodes.some((n) => n.type === 'interface')) fail('add from the canvas menu');
await page.getByRole('button', { name: 'Mini map' }).click();
await page.waitForTimeout(200);
if (!(await page.locator('.graph-minimap').count())) fail('mini map not shown');
if ((await page.evaluate(() => localStorage.getItem('se-ramify:ui:minimap:class'))) !== '1') fail('mini map not remembered');

// 6. mind map: Tab adds under, Enter beside
await page.evaluate(() => window.__app.create('mindmap', 'MM', 'T'));
await page.waitForTimeout(600);
await page.locator('.svelte-flow__node').first().click();
await page.keyboard.press('Tab'); await page.waitForTimeout(250);
await page.keyboard.type('Rama A');
await page.keyboard.press('Enter'); await page.waitForTimeout(250);
await page.keyboard.type('Rama B');
await page.keyboard.press('Tab'); await page.waitForTimeout(250);
await page.keyboard.type('Sub B1');
await page.keyboard.press('Shift+Enter');
await page.waitForTimeout(400);
d = await data();
const labels = d.nodes.map((n) => n.label);
console.log('mindmap', labels.join(' | '));
if (!labels.includes('Rama A') || !labels.includes('Rama B') || !labels.includes('Sub B1')) fail('mindmap keys');
await page.screenshot({ path: (await import('node:path')).join((await import('node:os')).tmpdir(), 'se-ramify-mm-interact.png') });
if (errors.length) fail('page errors: ' + errors.join('\n'));
await browser.close();
console.log(process.exitCode ? 'FAILED' : 'all passed');
