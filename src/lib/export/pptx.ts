/**
 * A PowerPoint deck (.pptx) for the class presentation: a title slide, an
 * agenda with the hand-in's parts when there is one, then one slide per
 * diagram with its title, the image fitted to the slide and the kind in the
 * footer. Very tall images (actas, backlog, TCO) go on the right half with
 * the diagram's notes on the left. Works in the browser and in node.
 */
import { isPng, pngSize, toBase64 } from './png';

export interface DeckSlide {
  title: string;
  /** "Diagrama de clases". */
  kind: string;
  notes: string;
  png: Uint8Array | null;
}

export interface Deck {
  title: string;
  subtitle: string;
  /** Hand-in parts and their weights, for the agenda slide. */
  agenda: { label: string; weight: string }[];
  slides: DeckSlide[];
}

const W = 13.333;
const H = 7.5;
const INK = '1D2125';
const MUTED = '6C737A';
const ACCENT = '3A7BD5';
const FONT = 'Calibri';

export async function buildDeck(deck: Deck): Promise<Uint8Array> {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = deck.title;
  pptx.author = 'se-ramify';

  const total = deck.slides.length + 1 + (deck.agenda.length ? 1 : 0);
  let n = 0;
  const footer = (slide: ReturnType<typeof pptx.addSlide>, left: string) => {
    n++;
    slide.addShape('line', { x: 0.5, y: H - 0.5, w: W - 1, h: 0, line: { color: 'DDE1E5', width: 0.75 } });
    slide.addText(left, { x: 0.5, y: H - 0.45, w: W - 2.5, h: 0.3, fontSize: 10, color: MUTED, fontFace: FONT });
    slide.addText(`${n} / ${total}`, { x: W - 2, y: H - 0.45, w: 1.5, h: 0.3, fontSize: 10, color: MUTED, align: 'right', fontFace: FONT });
  };

  // Title slide
  const first = pptx.addSlide();
  first.background = { color: 'FFFFFF' };
  first.addShape('rect', { x: 0, y: 0, w: 0.28, h: H, fill: { color: ACCENT }, line: { color: ACCENT } });
  first.addText(deck.title, { x: 0.9, y: 2.3, w: W - 1.8, h: 1.6, fontSize: 36, bold: true, color: INK, fontFace: FONT, valign: 'bottom', fit: 'shrink' });
  first.addText(deck.subtitle, { x: 0.9, y: 4.05, w: W - 1.8, h: 0.6, fontSize: 18, color: MUTED, fontFace: FONT });
  n++;

  // Agenda: the parts of the hand-in with their weights
  if (deck.agenda.length) {
    const s = pptx.addSlide();
    s.addText('Contenido', { x: 0.5, y: 0.35, w: W - 1, h: 0.7, fontSize: 28, bold: true, color: INK, fontFace: FONT });
    // Up to ~20 parts (the final hand-in lists E1–E3 too) still fit on one slide.
    const size = deck.agenda.length > 16 ? 10 : deck.agenda.length > 12 ? 11 : deck.agenda.length > 7 ? 13 : 16;
    s.addTable(
      deck.agenda.map((a) => [
        { text: a.label, options: { fontSize: size, color: INK, fontFace: FONT } },
        { text: a.weight, options: { fontSize: size, color: MUTED, align: 'right', fontFace: FONT } }
      ]),
      { x: 0.5, y: 1.25, w: W - 1, colW: [W - 2.6, 1.6], border: { type: 'solid', color: 'E3E6E9', pt: 0.75 }, valign: 'middle', margin: 0.06 }
    );
    footer(s, deck.title);
  }

  // One slide per diagram
  for (const d of deck.slides) {
    const s = pptx.addSlide();
    s.addText(d.title, { x: 0.5, y: 0.3, w: W - 1, h: 0.75, fontSize: 26, bold: true, color: INK, fontFace: FONT, fit: 'shrink' });
    const top = 1.2;
    const bottom = H - 0.65;
    if (d.png && isPng(d.png)) {
      const { width, height } = pngSize(d.png);
      const ratio = height / width;
      const tall = ratio > 1.6 && d.notes.trim();
      const box = tall ? { x: W / 2, y: top, w: W / 2 - 0.5, h: bottom - top } : { x: 0.5, y: top, w: W - 1, h: bottom - top };
      let w = box.w;
      let h = w * ratio;
      if (h > box.h) (h = box.h), (w = h / ratio);
      s.addImage({ data: `data:image/png;base64,${toBase64(d.png)}`, x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h, altText: d.title });
      if (tall) s.addText(d.notes.trim(), { x: 0.5, y: top, w: W / 2 - 0.9, h: bottom - top, fontSize: 16, color: INK, fontFace: FONT, valign: 'top', fit: 'shrink' });
    } else if (d.notes.trim()) {
      s.addText(d.notes.trim(), { x: 0.5, y: top, w: W - 1, h: bottom - top, fontSize: 18, color: INK, fontFace: FONT, valign: 'top' });
    }
    if (d.notes.trim()) s.addNotes(d.notes.trim());
    footer(s, d.kind);
  }

  const out = await pptx.write({ outputType: 'uint8array' });
  return out as Uint8Array;
}
