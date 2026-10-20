/**
 * A Word document (.docx) from the memoria's Markdown, with its images.
 * Headings use Word's built-in styles (so the navigation pane and an
 * inserted table of contents work), tables are real tables, images sit at
 * their natural size (the PNG's pHYs) shrunk to the page, each with a
 * "Figura N." caption. Works in the browser and in node (tests).
 */
import { Lexer, type Token, type Tokens } from 'marked';
import { pngInches, isPng } from './png';
import { columnWidths } from './tables';

type Docx = typeof import('docx');

/** A4 with 2.2 cm margins, in twips (1/1440 in). */
const PAGE = { w: 11906, h: 16838, margin: 1247 };
const TEXT_W_PX = ((PAGE.w - 2 * PAGE.margin) / 1440) * 96;
const TEXT_H_PX = ((PAGE.h - 2 * PAGE.margin) / 1440) * 96;

const BORDER = 'C9CED3';

function decode(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

interface Style {
  bold?: boolean;
  italics?: boolean;
  code?: boolean;
  size?: number;
}

export async function memoriaDocx(md: string, images: Map<string, Uint8Array>, title: string): Promise<Uint8Array> {
  const d: Docx = await import('docx');
  const { Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, ImageRun, AlignmentType, ShadingType, BorderStyle, LevelFormat, LineRuleType, Document, Packer } = d;
  let figures = 0;
  let listInstance = 0;

  const runs = (tokens: Token[] | undefined, st: Style = {}): InstanceType<Docx['TextRun']>[] => {
    const out: InstanceType<Docx['TextRun']>[] = [];
    const text = (t: string, s: Style) =>
      out.push(new TextRun({ text: decode(t), bold: s.bold, italics: s.italics, size: s.size, font: s.code ? 'Consolas' : undefined, shading: s.code ? { type: ShadingType.CLEAR, fill: 'F1F3F5', color: 'auto' } : undefined }));
    for (const t of tokens ?? []) {
      switch (t.type) {
        case 'text': {
          const x = t as Tokens.Text;
          if (x.tokens?.length) out.push(...runs(x.tokens, st));
          else text(x.text, st);
          break;
        }
        case 'escape':
          text((t as Tokens.Escape).text, st);
          break;
        case 'strong':
          out.push(...runs((t as Tokens.Strong).tokens, { ...st, bold: true }));
          break;
        case 'em':
          out.push(...runs((t as Tokens.Em).tokens, { ...st, italics: true }));
          break;
        case 'del':
          out.push(...runs((t as Tokens.Del).tokens, st));
          break;
        case 'codespan':
          text((t as Tokens.Codespan).text, { ...st, code: true });
          break;
        case 'br':
          out.push(new TextRun({ text: '', break: 1 }));
          break;
        case 'html':
          if (/^<br\s*\/?>$/i.test((t as Tokens.HTML).text.trim())) out.push(new TextRun({ text: '', break: 1, size: st.size }));
          break;
        case 'link':
          out.push(...runs((t as Tokens.Link).tokens, st));
          break;
        case 'image':
          text((t as Tokens.Image).text, st);
          break;
        default:
          if ('text' in t) text(String((t as { text: string }).text), st);
      }
    }
    return out;
  };

  const figure = (img: Tokens.Image): InstanceType<Docx['Paragraph']>[] => {
    const bytes = images.get(img.href);
    if (!bytes || !isPng(bytes)) return [new Paragraph({ children: [new TextRun({ text: `[${img.text}]`, italics: true })] })];
    const inch = pngInches(bytes);
    let w = inch.width * 96;
    let h = inch.height * 96;
    const fit = Math.min(1, TEXT_W_PX / w, (TEXT_H_PX * 0.82) / h);
    w = Math.round(w * fit);
    h = Math.round(h * fit);
    figures++;
    return [
      new Paragraph({ alignment: AlignmentType.CENTER, keepNext: true, spacing: { before: 120, after: 60, line: 240, lineRule: LineRuleType.AUTO }, children: [new ImageRun({ type: 'png', data: bytes, transformation: { width: w, height: h }, altText: { title: img.text, description: img.text, name: img.href } })] }),
      new Paragraph({ style: 'Caption', alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Figura ${figures}. `, bold: true }), new TextRun({ text: decode(img.text) })] })
    ];
  };

  const table = (t: Tokens.Table): InstanceType<Docx['Table']> => {
    const cols = t.header.length;
    const size = cols >= 7 ? 15 : cols >= 5 ? 17 : 19;
    const widthTw = PAGE.w - 2 * PAGE.margin;
    // Cell padding is 90 twips a side: 9 pt per column.
    const pts = columnWidths(
      t.header.map((h) => h.text),
      t.rows.map((r) => r.map((c) => c.text)),
      size / 2,
      widthTw / 20 - 9 * cols
    );
    const widths = pts.map((p) => Math.round((p + 9) * 20));
    const border = { style: BorderStyle.SINGLE, size: 4, color: BORDER };
    const borders = { top: border, bottom: border, left: border, right: border };
    const cell = (c: Tokens.TableCell, header: boolean, i: number) =>
      new TableCell({
        width: { size: widths[i], type: WidthType.DXA },
        borders,
        shading: header ? { type: ShadingType.CLEAR, fill: 'F1F3F5', color: 'auto' } : undefined,
        margins: { top: 50, bottom: 50, left: 90, right: 90 },
        children: [new Paragraph({ spacing: { before: 0, after: 0 }, children: runs(c.tokens, { bold: header || undefined, size }) })]
      });
    return new Table({
      width: { size: widthTw, type: WidthType.DXA },
      columnWidths: widths,
      rows: [
        new TableRow({ tableHeader: true, cantSplit: true, children: t.header.map((c, i) => cell(c, true, i)) }),
        ...t.rows.map((r) => new TableRow({ cantSplit: true, children: r.map((c, i) => cell(c, false, i)) }))
      ]
    });
  };

  const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5];
  let titleDone = false;

  const blocks = (tokens: Token[], ctx: { quote?: boolean; list?: { ordered: boolean; level: number; instance: number } } = {}) => {
    const out: (InstanceType<Docx['Paragraph']> | InstanceType<Docx['Table']>)[] = [];
    const para = (children: InstanceType<Docx['TextRun']>[]) =>
      new Paragraph({
        children,
        numbering: ctx.list ? { reference: ctx.list.ordered ? 'numbers' : 'bullets', level: ctx.list.level, instance: ctx.list.instance } : undefined,
        indent: ctx.quote && !ctx.list ? { left: 360 } : undefined,
        border: ctx.quote ? { left: { style: BorderStyle.SINGLE, size: 18, color: 'C98A12', space: 8 } } : undefined,
        shading: ctx.quote ? { type: ShadingType.CLEAR, fill: 'FDF6E7', color: 'auto' } : undefined
      });
    for (const t of tokens) {
      switch (t.type) {
        case 'space':
        case 'def':
          break;
        case 'heading': {
          const h = t as Tokens.Heading;
          if (h.depth === 1 && !titleDone) {
            titleDone = true;
            out.push(new Paragraph({ heading: HeadingLevel.TITLE, children: runs(h.tokens) }));
          } else out.push(new Paragraph({ heading: HEADINGS[Math.max(0, Math.min(4, h.depth - 2))], keepNext: true, children: runs(h.tokens) }));
          break;
        }
        case 'paragraph': {
          const p = t as Tokens.Paragraph;
          const real = p.tokens.filter((x) => !(x.type === 'text' && !(x as Tokens.Text).text.trim()));
          if (real.length === 1 && real[0].type === 'image') out.push(...figure(real[0] as Tokens.Image));
          else out.push(para(runs(p.tokens)));
          break;
        }
        case 'text': {
          const x = t as Tokens.Text;
          const children = x.tokens?.length ? runs(x.tokens) : [new TextRun(decode(x.text))];
          out.push(para(children));
          break;
        }
        case 'table':
          out.push(table(t as Tokens.Table), new Paragraph({ spacing: { after: 60 }, children: [] }));
          break;
        case 'code': {
          const lines = (t as Tokens.Code).text.split('\n');
          lines.forEach((line, i) =>
            out.push(
              new Paragraph({
                spacing: { before: i === 0 ? 120 : 0, after: i === lines.length - 1 ? 120 : 0, line: 260, lineRule: LineRuleType.AUTO },
                shading: { type: ShadingType.CLEAR, fill: 'F4F5F7', color: 'auto' },
                keepLines: true,
                children: [new TextRun({ text: line || ' ', font: 'Consolas', size: 17 })]
              })
            )
          );
          break;
        }
        case 'blockquote':
          out.push(...blocks((t as Tokens.Blockquote).tokens, { ...ctx, quote: true }));
          break;
        case 'list': {
          const l = t as Tokens.List;
          const level = ctx.list ? Math.min(ctx.list.level + 1, 4) : 0;
          const instance = l.ordered ? ++listInstance : 0;
          for (const it of l.items) out.push(...blocks(it.tokens, { ...ctx, list: { ordered: l.ordered, level, instance } }));
          break;
        }
        case 'hr':
          out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BORDER, space: 1 } }, children: [] }));
          break;
        default:
          if ('text' in t && String((t as { text: string }).text).trim()) out.push(para([new TextRun(decode(String((t as { text: string }).text)))]));
      }
    }
    return out;
  };

  const children = blocks(Lexer.lex(md));
  const level = (i: number, format: (typeof LevelFormat)[keyof typeof LevelFormat], text: string) => ({
    level: i,
    format,
    text,
    alignment: AlignmentType.LEFT,
    style: { paragraph: { indent: { left: 400 + i * 360, hanging: 300 } } }
  });
  const doc = new Document({
    creator: 'se-ramify',
    title,
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22, language: { value: 'es-ES' } }, paragraph: { spacing: { after: 120, line: 276, lineRule: LineRuleType.AUTO } } },
        title: { run: { size: 44, bold: true, color: '1D2125' }, paragraph: { spacing: { after: 240 } } },
        heading1: { run: { size: 32, bold: true, color: '1D2125' }, paragraph: { spacing: { before: 360, after: 120 } } },
        heading2: { run: { size: 26, bold: true, color: '2B3137' }, paragraph: { spacing: { before: 240, after: 80 } } },
        heading3: { run: { size: 23, bold: true, color: '2B3137' }, paragraph: { spacing: { before: 200, after: 60 } } }
      },
      paragraphStyles: [{ id: 'Caption', name: 'Caption', basedOn: 'Normal', next: 'Normal', run: { size: 18, italics: true, color: '5D646B' }, paragraph: { spacing: { before: 0, after: 200 } } }]
    },
    numbering: {
      config: [
        { reference: 'bullets', levels: [0, 1, 2, 3, 4].map((i) => level(i, LevelFormat.BULLET, ['•', '◦', '▪', '•', '◦'][i])) },
        { reference: 'numbers', levels: [0, 1, 2, 3, 4].map((i) => level(i, LevelFormat.DECIMAL, `%${i + 1}.`)) }
      ]
    },
    sections: [{ properties: { page: { size: { width: PAGE.w, height: PAGE.h }, margin: { top: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin, right: PAGE.margin } } }, children }]
  });
  return new Uint8Array(await Packer.toArrayBuffer(doc));
}
