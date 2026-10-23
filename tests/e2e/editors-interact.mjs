// The structured editors are linked both ways: what you click or hover in a
// drawing, chart or preview lights up (and selects, or focuses) its row or
// field in the panel, and the other way round. None of it reaches an export.
//   node tests/e2e/editors-interact.mjs <port>
import { chromium } from 'playwright';

const [port] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1360, height: 820 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const fail = (m) => {
  console.log('FAIL', m);
  process.exitCode = 1;
};
const check = async (what, fn) => {
  if (!(await page.evaluate(fn))) fail(what);
};

await page.goto(`http://localhost:${port}/?debug`);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('se-ramify:dir', 'browser-localStorage');
  localStorage.setItem('se-ramify:setting:checkUpdates', 'false');
});
await page.reload();
await page.waitForFunction(() => window.__app?.ready);

async function open(kind) {
  await page.evaluate((k) => window.__app.create(k, `Interact ${k}`, 'Pruebas', window.__modules[k].example()), kind);
  await page.waitForTimeout(600);
}
/** Click the middle of the n-th match (bounding box, so SVG parts work too). */
async function clickAt(sel, n = 0, fx = 0.5, fy = 0.5) {
  await page.locator(sel).nth(n).scrollIntoViewIfNeeded();
  const b = await page.locator(sel).nth(n).boundingBox();
  await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy);
  await page.waitForTimeout(150);
}
async function hoverAt(sel, n = 0, fx = 0.5, fy = 0.5) {
  await page.locator(sel).nth(n).scrollIntoViewIfNeeded();
  const b = await page.locator(sel).nth(n).boundingBox();
  await page.mouse.move(b.x + b.width * fx, b.y + b.height * fy);
  await page.waitForTimeout(150);
}

// Sequence: a lifeline picks its participant; a row lights its message; a message picks its row.
await open('sequence');
await clickAt('svg.seq g.part', 1);
await check('sequence: a head selects its participant row', () => document.querySelectorAll('.prow.sel').length === 1);
await page.keyboard.press('Escape');
await page.locator('svg.seq g.life').nth(2).dispatchEvent('click');
await check('sequence: a lifeline selects its participant row', () => document.querySelector('.prow.sel')?.id === `seq-part-${window.__app.doc.data.participants[2].id}`);
await hoverAt('.item.msg', 2);
await check('sequence: row hover lights its message', () => document.querySelectorAll('svg.seq g.msg.hot').length === 1);
await clickAt('svg.seq g.msg text', 1);
await check('sequence: message selects its row', () => !!document.querySelector('.item.msg.sel') && !document.querySelector('.prow.sel'));
await check('sequence: the selection colour stays out of exports', () => {
  const el = document.querySelector('svg.seq g.msg.sel .sc');
  const screen = getComputedStyle(el).stroke;
  document.documentElement.classList.add('exporting');
  const exported = getComputedStyle(el).stroke;
  document.documentElement.classList.remove('exporting');
  return screen !== exported;
});

// Gantt: bar ↔ row.
await open('gantt');
await hoverAt('.task', 1);
await check('gantt: bar hover lights its row', () => document.querySelectorAll('.tr.hot').length === 1);
await clickAt('.task', 1);
await check('gantt: bar click selects its row', () => !!document.querySelector('.tr.sel'));
await hoverAt('.tr', 6);
await check('gantt: row hover lights its bar', () => document.querySelectorAll('.task.hot, .grp.hot, .ms.hot').length === 1);

// Story map and Kanban: MoSCoW colours and lit drop targets while dragging.
await open('storymap');
await check('storymap: Must is red', () => [...document.querySelectorAll('.prio')].some((p) => p.textContent === 'M' && getComputedStyle(p).backgroundColor === 'rgb(217, 83, 79)'));
await open('kanban');
{
  const card = await page.locator('.card').nth(1).boundingBox();
  const target = await page.locator('.cards').nth(1).boundingBox();
  await page.mouse.move(card.x + 20, card.y + 10);
  await page.mouse.down();
  await page.mouse.move(target.x + 40, target.y + 30, { steps: 8 });
  await check('kanban: the column under a dragged card lights up', () => !!document.querySelector('.board.dragging .cards.target'));
  await page.mouse.up();
}

// Stakeholders: dot ↔ list row; the background lets go.
await open('stakeholder');
await clickAt('.dot', 2);
await check('stakeholder: dot selects its row', () => !!document.querySelector('.person.on'));
await hoverAt('.person', 5);
await check('stakeholder: row hover lights its dot', () => document.querySelectorAll('.who.hot').length === 1);
await clickAt('.chart', 0, 0.02, 0.5);
await check('stakeholder: background click deselects', () => !document.querySelector('.person.on'));

// Journey: a click anywhere in a cell edits it; the curve previews where a click puts the point.
await open('journey');
await clickAt('.cell', 7, 0.5, 0.95);
await check('journey: cell click focuses its text', () => document.activeElement?.tagName === 'TEXTAREA');
await hoverAt('.emo svg', 0, 0.62, 0.2);
await check('journey: the curve shows a preview', () => !!document.querySelector('.emo .pt-label'));

// Vision: a blank opens its field, and the field lights its blank.
await open('vision');
await clickAt('.blank', 3);
await check('vision: blank click focuses its field', () => document.activeElement?.id === 'vision-isA');
await check('vision: the focused field lights its blank and row', () => !!document.querySelector('.blank.on') && !!document.querySelector('tr.on'));

// TCO: the summary chart picks an alternative; an unpriced line is amber.
await open('tco');
await page.evaluate(() => window.__app.change((d) => (d.data.alternatives[0].lines[1].unitCost = 0)));
await page.waitForTimeout(200);
await check('tco: an unpriced cell is tinted', () => !!document.querySelector('.amount.unpriced'));
await page.locator('.chart .bar').nth(1).scrollIntoViewIfNeeded();
await clickAt('.chart .bar', 1);
await check('tco: a bar opens its alternative', () => document.querySelector('.tabs [aria-selected="true"]')?.textContent?.includes('Nube'));

// Backlog: the overview opens a story in the editor.
await open('backlog');
await page.getByRole('radio', { name: /Overview/ }).click();
await page.waitForTimeout(300);
await clickAt('.overview-wrap .story', 1);
await check('backlog: an overview card opens its story', () => !!document.querySelector('.story.open'));

// Acta: the document points at the form.
await open('minutes');
await page.locator('.acta li.item').nth(5).scrollIntoViewIfNeeded();
await clickAt('.acta li.item', 5);
await page.waitForTimeout(300);
await check('minutes: a document line focuses its field', () => document.activeElement?.id?.startsWith('min-'));

// UP: rows pick disciplines, headers phases, milestones their field.
await open('up');
await clickAt('.row-hit', 3, 0.6);
await check('up: a row selects its discipline', () => !!document.querySelector('.dblock.on'));
await clickAt('.phase', 1);
await check('up: a header selects its phase', () => !!document.querySelector('.phase-card.on'));
await clickAt('.ms', 2);
await page.waitForTimeout(200);
await check('up: a milestone focuses its field', () => document.activeElement?.dataset?.milestone !== undefined);

// Boards: hover shows the note's tools; the colour button opens the swatches.
await open('brainstorm');
await hoverAt('.note', 1);
await clickAt('.tool-color', 1);
await check('board: the colour button opens the swatches', () => !!document.querySelector('.color-pop'));

if (errors.length) fail(errors.join('\n'));
console.log(process.exitCode ? 'editors-interact: FAILED' : 'editors-interact: all good');
await browser.close();
