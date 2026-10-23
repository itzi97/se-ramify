// Two people on one folder: two tabs share the browser build's storage the
// way two computers share a synced folder. Checks that changes arrive, that
// a simultaneous edit never loses anyone's work, copies and git conflicts.
//   node tests/e2e/team.mjs <port>
import { chromium } from 'playwright';

const [port] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const ctx = await browser.newContext({ viewport: { width: 1300, height: 800 } });
const errors = [];
const fail = (m) => {
  console.log('FAIL', m);
  process.exitCode = 1;
};
const setup = async (page, name) => {
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${port}/?debug`);
  await page.waitForFunction(() => window.__app?.ready);
  await page.evaluate((n) => window.__app.setUserName(n), name);
};

const a = await ctx.newPage();
await a.goto(`http://localhost:${port}/?debug`);
await a.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('se-ramify:dir', 'browser-localStorage');
});
await setup(a, 'Ana');
const b = await ctx.newPage();
await setup(b, 'Bruno');

// 1. Ana creates a diagram; Bruno's list picks it up without reloading.
await a.evaluate(() => window.__app.create('class', 'Modelo del dominio', 'Equipo', window.__modules.class.example()));
await b.waitForFunction(() => window.__app.list.some((m) => m.title === 'Modelo del dominio'), null, { timeout: 10000 }).catch(() => fail('B never saw the new diagram'));
const meta = await b.evaluate(() => window.__app.list.find((m) => m.title === 'Modelo del dominio'));
if (meta?.updatedBy !== 'Ana') fail(`updatedBy is ${meta?.updatedBy}`);
await b.evaluate((p) => window.__app.open(p), meta.path);

// 2. Ana renames it; Bruno has it open and idle: it updates in place.
await a.evaluate(() => window.__app.change((d) => (d.title = 'Modelo del dominio v2')));
await b.waitForFunction(() => window.__app.doc?.title === 'Modelo del dominio v2', null, { timeout: 10000 }).catch(() => fail('open doc not refreshed'));

// 3. Both edit at once: Bruno's save finds Ana's newer file and keeps his as a copy.
await a.evaluate(() => window.__app.change((d) => d.data.nodes.push({ id: 'ana1', type: 'class', x: 900, y: 0, label: 'DeAna' })));
await a.waitForTimeout(800); // Ana's save lands
await b.evaluate(() => window.__app.change((d) => d.data.nodes.push({ id: 'bru1', type: 'class', x: 900, y: 200, label: 'DeBruno' })));
await b.waitForTimeout(6000);
const all = await b.evaluate(() =>
  Object.keys(localStorage)
    .filter((k) => k.startsWith('se-ramify:diagram:'))
    .map((k) => JSON.parse(localStorage.getItem(k)))
);
const labels = all.flatMap((d) => d.data.nodes.map((n) => n.label));
if (!labels.includes('DeAna')) fail("Ana's class was lost");
if (!labels.includes('DeBruno')) fail("Bruno's class was lost");
console.log('diagrams after simultaneous edit:', all.map((d) => `${d.title} [${d.updatedBy}]`).join(' | '));

// 4. A file with the same id (a sync app's copy) is flagged and can be kept apart.
await a.evaluate(() => {
  const k = Object.keys(localStorage).find((k) => k.startsWith('se-ramify:diagram:'));
  localStorage.setItem(k + '-copy', localStorage.getItem(k));
});
await a.evaluate(() => window.__app.sync());
const dups = await a.evaluate(() => window.__app.list.filter((m) => m.dupOf).length);
if (dups !== 1) fail(`expected 1 duplicate, got ${dups}`);

// 5. A file left with git conflict markers is listed and resolved from the app.
await a.evaluate(() => {
  const d = window.__modules.vision.example();
  const base = { format: 'se-ramify/1', id: 'gitconf', kind: 'vision', project: 'Equipo', notes: '', created: '2026-10-20T10:00:00.000Z', data: d };
  const text = JSON.stringify({ ...base, title: 'TITLE', updated: 'UPD' }, null, 2)
    .replace('  "title": "TITLE",', '<<<<<<< HEAD\n  "title": "Visión (mía)",\n=======\n  "title": "Visión (suya)",\n>>>>>>> origin/main');
  localStorage.setItem('se-ramify:diagram:gitconf', text.replace('UPD', '2026-10-20T10:00:00.000Z'));
});
await a.evaluate(() => window.__app.sync());
await a.waitForTimeout(300);
const probs = await a.evaluate(() => window.__app.problems.map((p) => p.gitConflict));
if (probs.join() !== 'true') fail(`problems: ${probs}`);
await a.getByRole('button', { name: 'Theirs' }).click();
await a.waitForTimeout(500);
const resolved = await a.evaluate(() => window.__app.list.find((m) => m.id === 'gitconf')?.title);
if (resolved !== 'Visión (suya)') fail(`resolved title ${resolved}`);

// 6. Presence: Bruno has the diagram open and edits it; Ana's list says so.
const domain = await b.evaluate(() => window.__app.list.find((m) => m.title === 'Modelo del dominio v2' && !m.dupOf));
await b.evaluate((p) => window.__app.open(p), domain.path);
await b.evaluate(() => window.__app.change((d) => (d.notes = 'nota de Bruno')));
await a.waitForFunction((id) => window.__app.presence[id]?.some((p) => p.name === 'Bruno' && p.editing), domain.id, { timeout: 10000 }).catch(() => fail('Ana never saw Bruno editing'));
const line = await a.evaluate((id) => window.__app.presenceLine(id), domain.id);
if (line !== 'Bruno is editing it') fail(`presence line: ${line}`);
await b.evaluate(() => window.__app.close());
await a.waitForFunction((id) => !window.__app.presence[id], domain.id, { timeout: 10000 }).catch(() => fail('presence did not clear on close'));

// 7. Checklist changes are shared: Ana asks for use cases in E1 too; Bruno sees it.
await a.evaluate(() => window.__app.cd('Equipo'));
await a.getByRole('button', { name: 'Hand-in checklist for Equipo' }).click();
await a.getByRole('button', { name: /Edit checklist/ }).click();
await a.waitForTimeout(400);
await a.getByRole('tab', { name: /^E2/ }).click();
await a.waitForFunction(() => document.querySelector('[role="dialog"] [role="tab"][aria-selected="true"]')?.textContent?.trim().startsWith('E2'), null, { timeout: 5000 }).catch(() => fail('E2 tab not selected'));
await a.getByRole('combobox', { name: /Move or copy Casos de uso/ }).selectOption('copy:E1');
await a.waitForTimeout(300);
await a.keyboard.press('Escape');
await b.evaluate(() => window.__app.cd('Equipo'));
await b.getByRole('button', { name: 'Hand-in checklist for Equipo' }).click();
await b.waitForTimeout(500);
const e1 = await b.getByRole('dialog', { name: 'Hand-in checklist' }).textContent();
if (!e1.includes('Añadido por el grupo') || !e1.includes('Casos de uso con especificaciones')) fail('shared checklist change not visible to B');
await b.keyboard.press('Escape');

if (errors.length) fail(errors.join('\n'));
console.log(process.exitCode ? 'team: FAILED' : 'team: all good');
await browser.close();
