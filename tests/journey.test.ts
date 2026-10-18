import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampEmotion, emotionInfo, journeyExample, journeyMarkdown, smoothPath } from '../src/lib/editors/journey/model';
import { blankData } from '../src/lib/model/diagram';

test('example is complete', () => {
  const d = journeyExample();
  assert.equal(d.stages.length, 5);
  for (const r of d.rows) for (const s of d.stages) assert.ok(d.cells[`${r.id}:${s.id}`], 'every cell filled');
  for (const s of d.stages) assert.ok(s.id in d.emotion);
  assert.equal(d.moments.length, 1);
});

test('emotion helpers', () => {
  assert.equal(clampEmotion(7), 2);
  assert.equal(clampEmotion(-3.4), -2);
  assert.equal(clampEmotion(0.4), 0);
  assert.equal(emotionInfo(-2).label, 'Muy mal');
  assert.equal(smoothPath([]), '');
  assert.match(smoothPath([{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: 0 }]), /^M 0 0 C .* C /);
});

test('Markdown export: a table of stages with emotion and moments', () => {
  const d = journeyExample();
  const md = journeyMarkdown('Préstamo', d);
  assert.match(md, /^# Préstamo/);
  assert.ok(md.includes('| | Buscar el libro | Reservar | Recoger ★ |'));
  assert.ok(md.includes('| **Emoción** | Mal (-1) | Bien (+1) | Muy mal (-2) | Muy bien (+2) | Neutral (0) |'));
  assert.ok(md.includes('★ Momentos de la verdad: Recoger'));
  const blank = journeyMarkdown('Vacío', blankData('journey'));
  assert.ok(blank.includes('| | Descubrir | Decidir | Usar | Después |'));
});
