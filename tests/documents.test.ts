import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { memoriaDocx } from '../src/lib/export/docx';
import { buildDeck } from '../src/lib/export/pptx';
import { agendaFrom } from '../src/lib/export/agenda';
import { withPhys } from '../src/lib/export/png';
import { tinyPng } from './helpers';

/** File names in a zip (central directory), and one file's text. */
function zip(bytes: Uint8Array) {
  const b = Buffer.from(bytes);
  const names: string[] = [];
  const files = new Map<string, string>();
  let at = b.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = b.readUInt16LE(at + 10);
  let cd = b.readUInt32LE(at + 16);
  for (let i = 0; i < count; i++) {
    const method = b.readUInt16LE(cd + 10);
    const size = b.readUInt32LE(cd + 20);
    const nameLen = b.readUInt16LE(cd + 28);
    const extra = b.readUInt16LE(cd + 30);
    const comment = b.readUInt16LE(cd + 32);
    const local = b.readUInt32LE(cd + 42);
    const name = b.toString('utf8', cd + 46, cd + 46 + nameLen);
    names.push(name);
    const dataAt = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
    const data = b.subarray(dataAt, dataAt + size);
    if (name.endsWith('.xml')) files.set(name, (method === 8 ? inflateRawSync(data) : data).toString('utf8'));
    cd += 46 + nameLen + extra + comment;
  }
  return { names, files };
}

const MD = '# Proyecto\n\n## 1. Clases\n\n![Clases](01-clases.png)\n\n| A | B |\n|---|---|\n| x<br>y | **z** |\n\n- uno\n- dos\n\n```gherkin\nDado algo\n```\n';

test('the Word memoria is a docx with headings, the image, a table and Spanish set', async () => {
  const png = withPhys(tinyPng(400, 200), 2);
  const bytes = await memoriaDocx(MD, new Map([['01-clases.png', png]]), 'Proyecto');
  assert.equal(String.fromCharCode(bytes[0], bytes[1]), 'PK');
  const z = zip(bytes);
  assert.ok(z.names.includes('word/document.xml'));
  assert.ok(z.names.some((n) => n.startsWith('word/media/') && n.endsWith('.png')));
  const doc = z.files.get('word/document.xml')!;
  assert.match(doc, /w:val="Title"/);
  assert.match(doc, /w:val="Heading1"/);
  assert.match(doc, /<w:tbl>/);
  assert.match(doc, /Figura 1\. /);
  assert.match(doc, /Consolas/);
  // 400 px at 192 dpi = 200 px at 96 dpi = 1905000 EMU wide
  assert.match(doc, /<wp:extent cx="1905000" cy="952500"\/>/);
  assert.match(z.files.get('word/styles.xml')!, /es-ES/);
});

test('the deck is a pptx: title, agenda, one slide per diagram', async () => {
  const bytes = await buildDeck({
    title: 'Proyecto — Entrega 2',
    subtitle: '20 de octubre de 2026',
    agenda: agendaFrom(['| Apartado | Peso | Diagramas |', '|---|---|---|', '| UML | 60 % | Clases |', '| Visión | 20 % | Visión |']),
    slides: [
      { title: 'Clases', kind: 'Diagrama de clases', notes: '', png: tinyPng(40, 20) },
      { title: 'Acta', kind: 'Acta de reunión', notes: 'Notas del acta', png: tinyPng(20, 60) }
    ]
  });
  assert.equal(String.fromCharCode(bytes[0], bytes[1]), 'PK');
  const z = zip(bytes);
  for (const n of [1, 2, 3, 4]) assert.ok(z.names.includes(`ppt/slides/slide${n}.xml`), `slide ${n}`);
  assert.match(z.files.get('ppt/slides/slide1.xml')!, /Proyecto — Entrega 2/);
  assert.match(z.files.get('ppt/slides/slide2.xml')!, /60 %/);
  assert.match(z.files.get('ppt/slides/slide3.xml')!, /Diagrama de clases/);
  assert.match(z.files.get('ppt/slides/slide4.xml')!, /Notas del acta/);
});

test('agenda rows come from the hand-in intro table', () => {
  assert.deepEqual(agendaFrom(['## Contenido', '', '| Apartado | Peso | Diagramas |', '|---|---|---|', '| UML | 60 % | Clases; Secuencia |']), [{ label: 'UML', weight: '60 %' }]);
});
