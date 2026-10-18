import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ONION,
  gridLabels,
  gridPoint,
  gridValueAt,
  normStakeholder,
  onionCellAt,
  onionLayout,
  quadrantOf,
  ringBand,
  stakeholderCsv,
  stakeholderMarkdown
} from '../src/lib/editors/stakeholder/model';
import { stakeholderExample } from '../src/lib/editors/stakeholder/example';
import type { Stakeholder } from '../src/lib/model/types';

test('Mendelow quadrants', () => {
  assert.equal(quadrantOf({ power: 0.9, interest: 0.9 }).title, 'Gestionar de cerca');
  assert.equal(quadrantOf({ power: 0.9, interest: 0.1 }).title, 'Mantener satisfechos');
  assert.equal(quadrantOf({ power: 0.1, interest: 0.9 }).title, 'Mantener informados');
  assert.equal(quadrantOf({ power: 0.1, interest: 0.1 }).title, 'Monitorizar');
});

test('normalising fills a missing sector and clamps values', () => {
  const s = normStakeholder({ id: 'x', name: 'A', power: 3, interest: -1, ring: 9 as never } as Partial<Stakeholder> & { id: string });
  assert.equal(s.sector, 'clientes');
  assert.equal(s.power, 1);
  assert.equal(s.interest, 0);
  assert.equal(s.ring, 2);
  assert.equal(s.attitude, 'neutral');
});

test('grid coordinates round-trip', () => {
  const p = gridPoint({ power: 0.25, interest: 0.75 });
  assert.deepEqual(gridValueAt(p.x, p.y), { power: 0.25, interest: 0.75 });
});

test('grid labels never overlap each other', () => {
  const list = stakeholderExample().stakeholders;
  const labels = gridLabels(list);
  const boxes = labels.map((l) => {
    const w = list.find((s) => s.id === l.id)!.name.length * 7;
    return { x0: l.anchor === 'start' ? l.lx : l.lx - w, x1: l.anchor === 'start' ? l.lx + w : l.lx, y0: l.ly - 12, y1: l.ly + 3 };
  });
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      assert.ok(!(a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1), `labels ${i} and ${j} overlap`);
    }
});

test('onion spots sit inside their ring and sector', () => {
  const list = stakeholderExample().stakeholders;
  // Crowd one cell to exercise two-row placement.
  for (let i = 0; i < 6; i++) list.push({ ...list[0], id: `extra${i}`, name: `Extra ${i}`, ring: 3, sector: 'influyentes' });
  const spots = onionLayout(list);
  assert.equal(spots.length, list.length);
  for (const sp of spots) {
    const s = list.find((x) => x.id === sp.id)!;
    assert.ok(Number.isFinite(sp.x) && Number.isFinite(sp.y));
    const cell = onionCellAt(sp.x, sp.y);
    assert.equal(cell.ring, s.ring, `${s.name} ring`);
    assert.equal(cell.sector, s.sector, `${s.name} sector`);
    assert.ok(sp.lx >= 0 && sp.lx <= ONION.width);
  }
});

test('onion hit-testing', () => {
  const [, r1] = ringBand(0);
  assert.deepEqual(onionCellAt(ONION.cx, ONION.cy - (r1 - 10)), { ring: 0, sector: 'decisores' });
  assert.deepEqual(onionCellAt(ONION.cx + ONION.radii[3] - 5, ONION.cy), { ring: 3, sector: 'clientes' });
  assert.deepEqual(onionCellAt(ONION.cx, ONION.cy + 2000), { ring: 3, sector: 'influyentes' });
  assert.equal(onionCellAt(ONION.cx - 200, ONION.cy).sector, 'proveedores');
});

test('exports: Markdown table and CSV', () => {
  const data = stakeholderExample();
  const md = stakeholderMarkdown('Mapa', data);
  assert.match(md, /\| Stakeholder \| Rol \| Poder\/Influencia \| Interés \| Estrategia/);
  assert.equal(md.split('\n').filter((l) => l.startsWith('| ') && !l.startsWith('| Stakeholder')).length, data.stakeholders.length);
  assert.ok(md.includes('**Gestionar de cerca**'));
  data.stakeholders[0].notes = 'Dice "sí", pero, bueno';
  const csv = stakeholderCsv(data);
  const lines = csv.trim().split('\n');
  assert.equal(lines.length, data.stakeholders.length + 1);
  assert.ok(lines[1].includes('"Dice ""sí"", pero, bueno"'));
});
