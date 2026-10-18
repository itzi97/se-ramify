// Graph editor smoke: add shapes from the toolbar, connect them by dragging, rename inline,
// delete, undo; mind map Tab / Enter; tidy; PNG export.
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
await page.getByRole('button', { name: /Export/ }).click();
await page.getByRole('menuitem', { name: /PNG/ }).click();
const file = await dl;
if (!file) fail('no png download');
else { const p = await file.path(); const fs = await import('node:fs'); console.log('png bytes', fs.statSync(p).size); fs.copyFileSync(p, '/tmp/claude-0/export-class.png'); }

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
await page.screenshot({ path: '/tmp/claude-0/mm-interact.png' });
if (errors.length) fail('page errors: ' + errors.join('\n'));
await browser.close();
console.log(process.exitCode ? 'FAILED' : 'all passed');
