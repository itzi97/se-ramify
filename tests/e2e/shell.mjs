// The window around the diagrams: the list's row menu (rename, move, archive,
// delete, each undoable), the family filter, F2, the palette and the home
// screen's hand-in meters.
//   node tests/e2e/shell.mjs <port>
import { chromium } from 'playwright';

const [port] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1300, height: 800 } });
const errors = [];
const fail = (m) => {
  console.log('FAIL', m);
  process.exitCode = 1;
};
page.on('pageerror', (e) => errors.push(String(e)));
page.on('dialog', (d) => d.accept());

await page.goto(`http://localhost:${port}/?debug`);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('se-ramify:dir', 'browser-localStorage');
  localStorage.setItem('se-ramify:setting:checkUpdates', 'false');
});
await page.reload();
await page.waitForFunction(() => window.__app?.ready);
await page.evaluate(() => window.__app.setUserName('Itziar'));
await page.evaluate(() => window.__app.create('class', 'Dominio', 'Neuranet', window.__modules.class.example()));
await page.evaluate(() => window.__app.create('usecase', 'Casos', 'Neuranet', window.__modules.usecase.example()));
await page.evaluate(() => window.__app.create('gantt', 'Plan', 'Otro', window.__modules.gantt.example()));
const row = (t) => page.locator('.list .item .main', { hasText: t });
const until = (fn, arg, what) => page.waitForFunction(fn, arg, { timeout: 5000 }).catch(() => fail(what));

const cd = (rel) => page.evaluate((r) => window.__app.cd(r), rel);

// 0. A new diagram goes into the folder it was made for, and the list follows it there.
if ((await page.evaluate(() => window.__app.cwd)) !== 'Otro') fail('the list did not follow the new diagram into its folder');

// 1. Rename a diagram that isn't open, from its row menu; the open one stays open.
await cd('Neuranet');
await row('Dominio').click({ button: 'right' });
await page.getByRole('menuitem', { name: /Rename/ }).click();
await page.keyboard.type('Modelo de dominio');
await page.keyboard.press('Enter');
await until(() => window.__app.list.some((m) => m.title === 'Modelo de dominio'), null, 'rename from the menu');
if ((await page.evaluate(() => window.__app.doc?.title)) !== 'Plan') fail('renaming another diagram changed the open one');

// 2. Move it to another folder; the notice's Undo moves it back.
await row('Modelo de dominio').click({ button: 'right' });
await page.getByRole('menuitem', { name: /Move to folder/ }).click();
await page.getByRole('menuitem', { name: 'Otro' }).click();
await until(() => window.__app.list.find((m) => m.title === 'Modelo de dominio')?.project === 'Otro', null, 'move to folder');
await page.locator('.notices').getByRole('button', { name: 'Undo' }).last().click();
await until(() => window.__app.list.find((m) => m.title === 'Modelo de dominio')?.project === 'Neuranet', null, 'undo the move');

// 3. Delete from the menu; Undo brings it back.
await row('Casos').click({ button: 'right' });
await page.getByRole('menuitem', { name: /Delete/ }).click();
await until(() => !window.__app.list.some((m) => m.title === 'Casos'), null, 'delete from the menu');
await page.locator('.notices').getByRole('button', { name: 'Undo' }).last().click();
await until(() => window.__app.list.some((m) => m.title === 'Casos'), null, 'undo the delete');

// 4. Archive hides it; "Show archived" in the sort menu lists it again.
await row('Modelo de dominio').click({ button: 'right' });
await page.getByRole('menuitem', { name: 'Archive' }).click();
await page.waitForTimeout(400);
if (await row('Modelo de dominio').count()) fail('an archived diagram is still listed');
await page.getByRole('button', { name: 'Sort and show' }).click();
await page.getByLabel(/Show archived/).check();
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
if (!(await row('Modelo de dominio').count())) fail('"Show archived" did not list it');

// 5. Folders: the top folder lists them; a click goes in, the path bar and Backspace come back out.
await cd('');
await page.waitForTimeout(200);
const top = await page.locator('.list .item .main').allTextContents();
if (!top.some((t) => t.includes('Neuranet')) || !top.some((t) => t.includes('Otro'))) fail(`the top folder shows: ${top.join(', ')}`);
await row('Neuranet').click();
await until(() => window.__app.cwd === 'Neuranet', null, 'clicking a folder did not go in');
await row('Casos').focus();
await page.keyboard.press('Backspace');
await until(() => window.__app.cwd === '', null, 'Backspace did not go up a folder');
await page.getByRole('button', { name: 'New folder', exact: true }).click();
await page.keyboard.type('Borradores');
await page.keyboard.press('Enter');
await until(() => window.__app.entries.some((e) => e.type === 'folder' && e.rel === 'Borradores'), null, 'new folder');

// 6. The family filter searches this folder and the ones inside it.
await page.getByRole('button', { name: /^Planning:/ }).click();
const shown = await page.locator('.list .item .main').allTextContents();
if (shown.length !== 1 || !shown[0].includes('Plan') || !shown[0].includes('Otro')) fail(`the planning filter shows: ${shown.join(', ')}`);
await page.getByRole('button', { name: /^All/ }).click();

// 7. F2 renames the focused row; Escape cancels.
await cd('Otro');
await row('Plan').focus();
await page.keyboard.press('F2');
await page.keyboard.type('XXX');
await page.keyboard.press('Escape');
await page.waitForTimeout(300);
if (await page.evaluate(() => window.__app.list.some((m) => m.title.includes('XXX')))) fail('Escape did not cancel the rename');

// 8. Dragging a row onto ".." moves it up a folder; Undo puts it back.
{
  const from = await row('Plan').boundingBox();
  const to = await page.locator('.list .item.up').boundingBox();
  await page.mouse.move(from.x + 40, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 60, from.y + from.height / 2 - 10, { steps: 4 });
  await page.mouse.move(to.x + 60, to.y + to.height / 2, { steps: 8 });
  if (!(await page.locator('.ghost').count())) fail('no drag ghost');
  await page.mouse.up();
  await until(() => window.__app.list.find((m) => m.title === 'Plan')?.project === '', null, 'drag onto ..');
  await page.locator('.notices').getByRole('button', { name: 'Undo' }).last().click();
  await until(() => window.__app.list.find((m) => m.title === 'Plan')?.project === 'Otro', null, 'undo the drag');
}

// 9. Tabs: every opened diagram gets one; Ctrl+W closes the one in front and shows the next.
await cd('Neuranet');
await row('Casos').click();
await until(() => window.__app.doc?.title === 'Casos', null, 'open from the list');
const tabNames = await page.locator('.doc-tabs [role="tab"]').allTextContents();
if (!tabNames.some((t) => t.includes('Casos')) || !tabNames.some((t) => t.includes('Plan'))) fail(`tabs: ${tabNames}`);
await page.locator('.doc-tabs [role="tab"]', { hasText: 'Plan' }).click();
await until(() => window.__app.doc?.title === 'Plan', null, 'a tab did not switch');
await page.locator('.react-flow, .editor-area').first().click({ position: { x: 5, y: 5 } }).catch(() => {});
await page.keyboard.press('Control+w');
await until((n) => window.__app.doc && window.__app.doc.title !== 'Plan' && window.__app.tabs.length === n - 1, tabNames.length, 'Ctrl+W did not close the tab');

// 10. Ctrl+K finds a diagram by the name of its kind and opens it.
await page.keyboard.press('Control+k');
await page.keyboard.type('casos de uso');
await page.keyboard.press('Enter');
await until(() => window.__app.doc?.title === 'Casos', null, 'the palette did not open the use case diagram');

// 11. Home: the hand-in meters open the checklist on that entrega.
await page.getByRole('button', { name: 'Home' }).click();
await until(() => !window.__app.doc, null, 'Home did not close the diagram');
await page.locator('.meter', { hasText: 'E2' }).first().click();
const tab = await page.locator('[role="dialog"] [role="tab"][aria-selected="true"]').textContent();
if (!tab?.trim().startsWith('E2')) fail(`the checklist opened on ${tab}`);
await page.keyboard.press('Escape');

if (errors.length) fail(errors.join('\n'));
console.log(process.exitCode ? 'shell: FAILED' : 'shell: all good');
await browser.close();
