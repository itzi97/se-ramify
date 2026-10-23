// The project's model across diagrams: a class diagram typed as PlantUML,
// a sequence diagram checked against it (with its one-click fixes), and the
// UML checks on a use case diagram.
//   node tests/e2e/model.mjs <port>
import { chromium } from 'playwright';

const [port] = process.argv.slice(2);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
const fail = (m) => {
  console.log('FAIL', m);
  process.exitCode = 1;
};
page.on('pageerror', (e) => errors.push(String(e)));
page.on('dialog', (d) => d.accept());
const until = (fn, arg, what) => page.waitForFunction(fn, arg, { timeout: 6000 }).catch(() => fail(what));

await page.goto(`http://localhost:${port}/?debug`);
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem('se-ramify:dir', 'browser-localStorage');
  localStorage.setItem('se-ramify:setting:checkUpdates', 'false');
});
await page.reload();
await page.waitForFunction(() => window.__app?.ready);

// 1. A class diagram written as text: the drawing follows.
await page.evaluate(() => window.__app.create('class', 'Clases', 'Parchís'));
await page.getByRole('button', { name: /^Text$/ }).click();
await page.getByRole('textbox', { name: 'PlantUML' }).fill(`class Jugador {
  + realizarJugada(): void
}
class Dado {
  + tirar(): int
}
class Tablero {
  + mover(int actual, int unidades): boolean
}
Jugador "*" --> "2" Dado
Jugador "*" --> "1" Tablero`);
await until(() => window.__app.doc?.data.nodes.length === 3 && window.__app.doc.data.edges.length === 2, null, 'the text did not draw three classes and two lines');
const placed = await page.evaluate(() => new Set(window.__app.doc.data.nodes.map((n) => `${n.x},${n.y}`)).size);
if (placed !== 3) fail('the classes from the text were drawn on top of each other');

// 2. A sequence diagram in the same folder: a typo and an unknown operation are caught and fixed in one click each.
await page.evaluate(() =>
  window.__app.create('sequence', 'Jugada', 'Parchís', {
    participants: [
      { id: 'u', name: 'Usuario', kind: 'actor' },
      { id: 'j', name: 'j:Jugador', kind: 'object' },
      { id: 't', name: 't:Tablero', kind: 'object' }
    ],
    items: [
      { id: 'm1', t: 'msg', from: 'u', to: 'j', text: 'realizarJugada()', style: 'sync' },
      { id: 'm2', t: 'msg', from: 'j', to: 't', text: 'moverr(c, n)', style: 'sync' },
      { id: 'm3', t: 'msg', from: 'j', to: 't', text: 'reiniciar()', style: 'sync' }
    ],
    activations: true,
    autonumber: true
  })
);
await page.getByText(/2 things to check against the class diagram/).waitFor({ timeout: 6000 }).catch(() => fail('the sequence was not checked against the class diagram'));
if (!(await page.locator('.seq .msg.flag').count())) fail('the wrong messages are not marked in the drawing');
await page.getByRole('button', { name: 'Use mover()' }).click();
await until(() => window.__app.doc?.data.items.find((i) => i.id === 'm2')?.text === 'mover(c, n)', null, 'the "Use mover()" fix');
await page.getByRole('button', { name: /Add reiniciar\(\) to Tablero/ }).click();
await page.getByText(/Matches the class diagram/).waitFor({ timeout: 6000 }).catch(() => fail('adding the operation to the class did not clear the check'));
const ops = await page.evaluate(async () => {
  const m = window.__app.list.find((x) => x.kind === 'class');
  return JSON.parse(localStorage.getItem(m.path)).data.nodes.find((n) => n.label === 'Tablero').ops;
});
if (!ops.includes('+ reiniciar()')) fail(`Tablero's operations: ${ops}`);
// Suggestions: the classes for participants, the target's operations for messages.
const opts = await page.evaluate(() => [...document.querySelectorAll('#seq-ops-t option')].map((o) => o.value));
if (!opts.includes('mover(actual, unidades)')) fail(`suggested messages to t:Tablero: ${opts}`);
if (!(await page.locator('.quick .chip', { hasText: ':Dado' }).count())) fail('Dado is not offered as a participant');

// 3. Use case checks: an actor with no use case is marked and listed.
await page.evaluate(() => {
  const d = window.__modules.usecase.example();
  d.nodes.push({ id: 'lone', type: 'actor', x: 900, y: 500, label: 'Invitado' });
  return window.__app.create('usecase', 'Casos', 'Parchís', d);
});
await page.locator('.checks-pill', { hasText: '1 to check' }).waitFor({ timeout: 6000 }).catch(() => fail('no checks pill for the lone actor'));
if (!(await page.locator('.svelte-flow__node.flagged').count())) fail('the lone actor is not marked');
await page.locator('.checks-pill').click();
await page.locator('.checks-pop .link-like').first().click();
await until(() => document.querySelector('.svelte-flow__node.selected')?.textContent?.includes('Invitado'), null, 'clicking the check did not select the actor');

if (errors.length) fail(errors.join('\n'));
console.log(process.exitCode ? 'model: FAILED' : 'model: all good');
await browser.close();
