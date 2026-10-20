import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankData } from '../src/lib/model/diagram';
import type { TcoData } from '../src/lib/model/types';
import { addAlternative, blankLine, cheapest, cloudTemplate, eur, lineYears, localTemplate, parseAmount, removeAlternative, removeCriterion, scoreKey, summarize, summarizeAll, weightedScore } from '../src/lib/editors/tco/model';
import { tcoCsv, tcoMarkdown } from '../src/lib/editors/tco/text';
import { tcoExample } from '../src/lib/editors/tco/example';

test('a line costs once, every year or every month from its year on', () => {
  assert.deepEqual(lineYears(blankLine({ when: 'once', unitCost: 1000, qty: 2, year: 1 }), 3), [2000, 0, 0]);
  assert.deepEqual(lineYears(blankLine({ when: 'once', unitCost: 500, qty: 1, year: 3 }), 3), [0, 0, 500]);
  assert.deepEqual(lineYears(blankLine({ when: 'yearly', unitCost: 190, qty: 2, year: 2 }), 3), [0, 380, 380]);
  assert.deepEqual(lineYears(blankLine({ when: 'monthly', unitCost: 35, qty: 2, year: 1 }), 3), [840, 840, 840]);
});

test('totals per year, CAPEX / OPEX, blocks and per user', () => {
  const d: TcoData = blankData('tco');
  d.users = 10;
  const a = d.alternatives[0];
  a.lines = [
    blankLine({ block: 'hwsw', nature: 'capex', when: 'once', unitCost: 1650, qty: 2 }),
    blankLine({ block: 'ops', nature: 'opex', when: 'yearly', unitCost: 7600, qty: 1 }),
    blankLine({ block: 'long', nature: 'capex', when: 'once', unitCost: 480, qty: 1, year: 3 })
  ];
  const s = summarize(d, a);
  assert.deepEqual(s.perYear, [10900, 7600, 8080]);
  assert.deepEqual(s.cumulative, [10900, 18500, 26580]);
  assert.equal(s.total, 26580);
  assert.equal(s.capex, 3780);
  assert.equal(s.opex, 22800);
  assert.equal(s.byBlock.hwsw, 3300);
  assert.equal(s.byBlock.ops, 22800);
  assert.equal(s.perUser, 2658);
  d.users = 0;
  assert.equal(summarize(d, a).perUser, null);
});

test('the example: cloud is cheaper over three years', () => {
  const d = tcoExample();
  const [local, cloud] = summarizeAll(d);
  assert.equal(local.total, 84300);
  assert.equal(cloud.total, 73076);
  const c = cheapest(d)!;
  assert.equal(c.id, d.alternatives[1].id);
  assert.equal(c.saving, 84300 - 73076);
  assert.equal(local.unpriced, 0);
});

test('weighted criteria scores are normalised to 0..5', () => {
  const d = tcoExample();
  const [local, cloud] = d.alternatives;
  // weights 3,3,2,1,1 → 0.3,0.3,0.2,0.1,0.1
  assert.ok(Math.abs(weightedScore(d, local.id) - (0.3 * 3 + 0.3 * 3 + 0.2 * 2 + 0.1 * 2 + 0.1 * 5)) < 1e-9);
  assert.ok(Math.abs(weightedScore(d, cloud.id) - (0.3 * 5 + 0.3 * 5 + 0.2 * 4 + 0.1 * 5 + 0.1 * 2)) < 1e-9);
  removeCriterion(d, d.criteria[0].id);
  assert.equal(Object.keys(d.scores).filter((k) => k.startsWith(`${d.criteria[0].id}:`)).length, 2);
  assert.equal(Object.keys(d.scores).length, 8);
});

test('two to four alternatives; removing one drops its scores', () => {
  const d = tcoExample();
  assert.ok(addAlternative(d));
  assert.ok(addAlternative(d));
  assert.equal(addAlternative(d), null);
  const extra = d.alternatives[3];
  d.scores[scoreKey(d.criteria[0].id, extra.id)] = 4;
  assert.ok(removeAlternative(d, extra.id));
  assert.ok(!Object.keys(d.scores).some((k) => k.endsWith(extra.id)));
  removeAlternative(d, d.alternatives[2].id);
  assert.equal(removeAlternative(d, d.alternatives[0].id), false);
});

test('templates come unpriced, with a source hint', () => {
  for (const t of [localTemplate(), cloudTemplate()]) {
    assert.ok(t.length >= 10);
    assert.ok(t.every((l) => l.unitCost === 0 && l.source));
  }
  assert.ok(localTemplate().some((l) => /SAI/.test(l.name) && l.nature === 'capex'));
  assert.ok(cloudTemplate().some((l) => /zona/.test(l.name) && l.when === 'monthly'));
});

test('Spanish amounts: parse and format', () => {
  assert.equal(parseAmount('1.234,5'), 1234.5);
  assert.equal(parseAmount('1234.5'), 1234.5);
  assert.equal(parseAmount('12.000'), 12000);
  assert.equal(parseAmount('35 €'), 35);
  assert.equal(parseAmount('abc'), 0);
  assert.equal(eur(84300).replace(/\s/g, ' '), '84.300 €');
  assert.equal(eur(1650).replace(/\s/g, ' '), '1.650 €');
});

test('markdown has every alternative, the totals, the criteria and the recommendation', () => {
  const md = tcoMarkdown(tcoExample(), 'TCO BiblioYa').replace(/ /g, ' ');
  assert.match(md, /^# TCO BiblioYa/);
  assert.match(md, /^## Local \(on-premises\)/m);
  assert.match(md, /^## Nube \(AWS, región España\)/m);
  assert.match(md, /\| Local \(on-premises\) \| [^\n]*\*\*84\.300 €\*\*/);
  assert.match(md, /\*\*Nube \(AWS, región España\)\*\* \(73\.076 €\), 11\.224 € menos/);
  assert.match(md, /^## Comparación cualitativa/m);
  assert.match(md, /^## Recomendación\n\nRecomendamos/m);
});

test('CSV: BOM, semicolons, decimal comma, one row per line', () => {
  const d = tcoExample();
  d.alternatives[0].lines[0].unitCost = 35.5;
  const csv = tcoCsv(d);
  assert.ok(csv.startsWith('﻿Alternativa;Bloque;Concepto;'));
  const rows = csv.trim().split('\r\n');
  assert.equal(rows.length, 1 + d.alternatives.reduce((n, a) => n + a.lines.length, 0));
  assert.equal(rows[0].split(';').length, 8 + 3 + 2);
  assert.match(rows[1], /;35,5;1200;42600;0;0;42600;/);
});
