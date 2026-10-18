import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visionMarkdown, visionSentence } from '../src/lib/editors/vision/text';
import { visionExample } from '../src/lib/editors/vision/example';
import { blankData } from '../src/lib/model/diagram';

test('the sentence follows Moore\'s template', () => {
  const s = visionSentence(visionExample());
  assert.equal(
    s,
    'Para los socios de las bibliotecas municipales que quieren saber si un libro está disponible y llevárselo sin colas, BiblioYa es un servicio web y móvil de préstamos que permite buscar, reservar y renovar préstamos en dos clics. A diferencia del catálogo en línea actual, que solo informa, nuestro producto avisa cuando el libro vuelve, gestiona la cola de reservas y recuerda las devoluciones.'
  );
});

test('empty blanks show what goes there', () => {
  const s = visionSentence(blankData('vision'));
  assert.match(s, /^Para \[cliente objetivo\] que \[necesidad u oportunidad\], \[nombre\] es \[categoría, con su artículo\]/);
  assert.ok(s.endsWith('nuestro producto [diferenciador].'));
});

test('markdown has the sentence and a row per blank', () => {
  const md = visionMarkdown(visionExample(), 'Visión');
  assert.match(md, /^# Visión\n\n> Para /);
  assert.equal((md.match(/^\| (Para|Que|Producto|Es|A diferencia de|Nuestro producto)/gm) ?? []).length, 7);
});

test('no fixed article before the product; the category carries its own', () => {
  const s = visionSentence({ ...visionExample(), product: 'GymBook', isA: 'una aplicación móvil' });
  assert.match(s, /, GymBook es una aplicación móvil que /);
  assert.doesNotMatch(s, / el GymBook/);
});
