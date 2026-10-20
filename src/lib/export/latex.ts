/**
 * LaTeX from the memoria's Markdown (and the one-figure snippet), pure so it
 * can be tested. The output compiles with plain pdflatex: no fontspec, and
 * characters pdflatex's utf8 input can't take are swapped for commands.
 *
 * `memoriaLatex` gives a complete document; `memoriaLatexBody` the same
 * content one heading level down and without preamble, to `\input` into
 * the group's own template (it only needs graphicx, longtable, booktabs and
 * fvextra, and defines its figure macro with \providecommand).
 */
import { Lexer, type Token, type Tokens } from 'marked';
import { slug } from '../model/diagram';
import { columnWidths } from './tables';

/* ------------------------------------------------------------- escaping */

/** Characters pdflatex's utf8 + T1 can't print, as commands (or plain stand-ins). */
const SWAPS: Record<string, string> = {
  '→': '$\\rightarrow$',
  '←': '$\\leftarrow$',
  '↔': '$\\leftrightarrow$',
  '⇒': '$\\Rightarrow$',
  '↳': '$\\hookrightarrow$',
  '↑': '$\\uparrow$',
  '↓': '$\\downarrow$',
  '●': '$\\bullet$',
  '○': '$\\circ$',
  '◐': '$\\bullet$',
  '◆': '$\\diamond$',
  '■': '$\\blacksquare$',
  '□': '$\\square$',
  '≥': '$\\geq$',
  '≤': '$\\leq$',
  '≠': '$\\neq$',
  '≈': '$\\approx$',
  '−': '-',
  '✓': '$\\checkmark$',
  '✔': '$\\checkmark$',
  '✗': '$\\times$',
  '✘': '$\\times$',
  '★': '$\\star$',
  '☆': '$\\star$',
  '∞': '$\\infty$',
  '…': '\\dots{}',
  '\u00a0': '~',
  '\u2009': '\\,',
  '\u202f': '\\,'
};

/** Printable as-is under utf8 + T1: ASCII, Latin-1, Latin Extended-A and the usual punctuation. */
function printable(ch: string): boolean {
  const c = ch.codePointAt(0)!;
  return c < 0x0180 || '–—‘’‚“”„†‡•‰‹›€™'.includes(ch);
}

/** Escape text for LaTeX (outside verbatim). */
export function latexEscape(text: string): string {
  let out = '';
  for (const ch of text) {
    switch (ch) {
      case '\\':
        out += '\\textbackslash{}';
        break;
      case '&':
      case '%':
      case '$':
      case '#':
      case '_':
      case '{':
      case '}':
        out += '\\' + ch;
        break;
      case '~':
        out += '\\textasciitilde{}';
        break;
      case '^':
        out += '\\textasciicircum{}';
        break;
      case '<':
        out += '\\textless{}';
        break;
      case '>':
        out += '\\textgreater{}';
        break;
      case '|':
        out += '\\textbar{}';
        break;
      default:
        if (SWAPS[ch] !== undefined) out += SWAPS[ch];
        else if (ch === '\t') out += ' ';
        else if (printable(ch) || ch === '\n') out += ch;
        else out += '?';
    }
  }
  return out;
}

/** Code blocks keep their text; only what pdflatex can't print is swapped. */
function verbatimSafe(text: string): string {
  let out = '';
  for (const ch of text) out += printable(ch) || ch === '\n' || ch === '\t' ? ch : (SWAPS[ch]?.replace(/^\$\\|\$$/g, '').replace(/^\\|\{\}$/g, '') ?? '?');
  return out;
}

/** The snippet to paste for one exported image (Export → Copy LaTeX figure). */
export function figureSnippet(fileName: string, caption: string): string {
  return [
    '\\begin{figure}[htbp]',
    '  \\centering',
    `  \\includegraphics[width=\\linewidth]{${fileName}}`,
    `  \\caption{${latexEscape(caption)}}`,
    `  \\label{fig:${slug(caption, 50) || 'diagrama'}}`,
    '\\end{figure}'
  ].join('\n');
}

/* ----------------------------------------------------------- converter */

/** The figure macro: natural size (the PNG's pHYs), shrunk to fit the page when bigger. */
const FIGURE_MACRO = [
  '% se-ramify: an image at its natural size, shrunk to fit the text block when bigger.',
  '\\providecommand{\\seramifyfigura}[1]{%',
  '  \\sbox0{\\includegraphics{#1}}%',
  '  \\ifdim\\wd0>\\linewidth',
  '    \\includegraphics[width=\\linewidth,height=0.78\\textheight,keepaspectratio]{#1}%',
  '  \\else\\ifdim\\ht0>0.78\\textheight',
  '    \\includegraphics[height=0.78\\textheight,keepaspectratio]{#1}%',
  '  \\else\\usebox0\\fi\\fi}'
].join('\n');

interface Options {
  /** Body for \input: headings one level down, no title block, no table of contents. */
  body: boolean;
}

function inline(tokens: Token[] | undefined): string {
  if (!tokens) return '';
  return tokens
    .map((t) => {
      switch (t.type) {
        case 'text':
          return 'tokens' in t && t.tokens?.length ? inline(t.tokens) : latexEscape(decode((t as Tokens.Text).text));
        case 'escape':
          return latexEscape((t as Tokens.Escape).text);
        case 'strong':
          return `\\textbf{${inline((t as Tokens.Strong).tokens)}}`;
        case 'em':
          return `\\emph{${inline((t as Tokens.Em).tokens)}}`;
        case 'del':
          return inline((t as Tokens.Del).tokens);
        case 'codespan':
          return `\\texttt{${latexEscape(decode((t as Tokens.Codespan).text))}}`;
        case 'br':
          return '\\newline{}';
        case 'html':
          return /^<br\s*\/?>$/i.test((t as Tokens.HTML).text.trim()) ? '\\newline{}' : '';
        case 'link': {
          const l = t as Tokens.Link;
          const text = inline(l.tokens);
          return /^https?:/.test(l.href) ? `\\href{${l.href.replace(/([%#\\])/g, '\\$1')}}{${text}}` : text;
        }
        case 'image':
          return latexEscape((t as Tokens.Image).text);
        default:
          return 'text' in t ? latexEscape(String((t as { text: string }).text)) : '';
      }
    })
    .join('');
}

/** Undo the few entities the memoria might carry. */
function decode(s: string): string {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

const HEADINGS = ['\\section', '\\subsection', '\\subsubsection', '\\paragraph', '\\subparagraph'];

function heading(depth: number, text: string, o: Options): string {
  // Full document: # is the title block, ## a section. Body: # is a section.
  const level = Math.max(0, Math.min(HEADINGS.length - 1, depth - (o.body ? 1 : 2)));
  const cmd = HEADINGS[level];
  // Only sections go in the table of contents: specifications and stories would make it pages long.
  const toc = level === 0 ? `\n\\addcontentsline{toc}{section}{${text}}` : '';
  return `${cmd}*{${text}}${toc}`;
}

function table(t: Tokens.Table): string {
  const cols = t.header.length;
  // Widths for a ~470 pt text block (A4, 2.2 cm margins), as fractions of \\linewidth.
  const fs = cols >= 7 ? 8 : cols >= 5 ? 9 : 10;
  const sep = cols >= 7 ? 3 : cols >= 5 ? 4 : 6;
  const size = cols >= 7 ? `\\scriptsize\\setlength{\\tabcolsep}{${sep}pt}` : cols >= 5 ? `\\footnotesize\\setlength{\\tabcolsep}{${sep}pt}` : '\\small';
  const widths = columnWidths(
    t.header.map((h) => h.text),
    t.rows.map((r) => r.map((c) => c.text)),
    fs,
    470 - 2 * sep * cols
  );
  const spec = widths.map((w) => `>{\\raggedright\\arraybackslash}p{${(w / 470).toFixed(3)}\\linewidth}`).join('');
  const row = (cells: Tokens.TableCell[], bold = false) => cells.map((c) => (bold ? `\\textbf{${inline(c.tokens)}}` : inline(c.tokens))).join(' & ') + ' \\\\';
  return [
    `{${size}`,
    `\\begin{longtable}{@{}${spec}@{}}`,
    '\\toprule',
    row(t.header, true),
    '\\midrule',
    '\\endhead',
    ...t.rows.map((r) => row(r)),
    '\\bottomrule',
    '\\end{longtable}}'
  ].join('\n');
}

function block(tokens: Token[], o: Options, out: string[], ctx: { skipToc: boolean; figures: number }) {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    switch (t.type) {
      case 'space':
      case 'def':
        break;
      case 'heading': {
        const h = t as Tokens.Heading;
        // The Markdown index is a list of links: LaTeX makes a real table of contents.
        if (/^índice$/i.test(h.text.trim()) && tokens[i + 2]?.type === 'list' && tokens[i + 1]?.type === 'space') {
          if (!o.body) out.push('\\tableofcontents', '\\bigskip');
          i += 2;
          break;
        }
        if (/^índice$/i.test(h.text.trim()) && tokens[i + 1]?.type === 'list') {
          if (!o.body) out.push('\\tableofcontents', '\\bigskip');
          i += 1;
          break;
        }
        if (h.depth === 1 && !o.body) out.push(`\\begin{center}\n{\\LARGE\\bfseries ${inline(h.tokens)}\\par}\n\\end{center}`);
        else out.push(heading(h.depth, inline(h.tokens), o));
        break;
      }
      case 'paragraph': {
        const p = t as Tokens.Paragraph;
        const real = p.tokens.filter((x) => !(x.type === 'text' && !(x as Tokens.Text).text.trim()));
        if (real.length === 1 && real[0].type === 'image') {
          const img = real[0] as Tokens.Image;
          ctx.figures++;
          out.push(['\\begin{figure}[H]', '\\centering', `\\seramifyfigura{${img.href}}`, `\\caption{${latexEscape(img.text)}}`, '\\end{figure}'].join('\n'));
        } else out.push(inline(p.tokens));
        break;
      }
      case 'table':
        out.push(table(t as Tokens.Table));
        break;
      case 'code': {
        const c = t as Tokens.Code;
        out.push(['\\begin{Verbatim}[breaklines,fontsize=\\small,frame=single,framerule=0.4pt,rulecolor=\\color{black!25}]', verbatimSafe(c.text), '\\end{Verbatim}'].join('\n'));
        break;
      }
      case 'blockquote': {
        const inner: string[] = [];
        block((t as Tokens.Blockquote).tokens, o, inner, ctx);
        out.push(['\\begin{quote}', ...inner, '\\end{quote}'].join('\n'));
        break;
      }
      case 'list': {
        const l = t as Tokens.List;
        const env = l.ordered ? 'enumerate' : 'itemize';
        const items = l.items.map((it) => {
          const inner: string[] = [];
          block(it.tokens, o, inner, ctx);
          return `\\item ${inner.join('\n\n')}`;
        });
        out.push([`\\begin{${env}}`, ...items, `\\end{${env}}`].join('\n'));
        break;
      }
      case 'text': {
        const x = t as Tokens.Text;
        out.push(x.tokens?.length ? inline(x.tokens) : latexEscape(decode(x.text)));
        break;
      }
      case 'hr':
        out.push('\\medskip\\hrule\\medskip');
        break;
      case 'html':
        if (/<br/i.test((t as Tokens.HTML).text)) out.push('\\newline{}');
        break;
      default:
        if ('text' in t) out.push(latexEscape(String((t as { text: string }).text)));
    }
  }
}

function convert(md: string, o: Options): string {
  const out: string[] = [];
  block(Lexer.lex(md), o, out, { skipToc: o.body, figures: 0 });
  return out.join('\n\n');
}

export function memoriaLatexBody(md: string): string {
  return [`% Generado con se-ramify. Para incluirlo en vuestra plantilla: \\input{...}`, '% Necesita graphicx, longtable, booktabs, float, xcolor y fvextra.', FIGURE_MACRO, '', convert(md, { body: true }), ''].join('\n');
}

export function memoriaLatex(md: string, title: string): string {
  return [
    '% Generado con se-ramify. Compila con pdflatex (o latexmk -pdf) junto a las imágenes.',
    '\\documentclass[11pt,a4paper]{article}',
    '\\usepackage[utf8]{inputenc}',
    '\\usepackage[T1]{fontenc}',
    // Scalable Latin Modern and microtype when installed; plain Computer Modern otherwise.
    '\\IfFileExists{lmodern.sty}{\\usepackage{lmodern}\\usepackage{microtype}}{}',
    '\\usepackage[spanish,es-noshorthands,es-tabla]{babel}',
    '\\usepackage[a4paper,margin=2.2cm]{geometry}',
    '\\usepackage{graphicx}',
    '\\usepackage{float}',
    '\\usepackage{longtable}',
    '\\usepackage{booktabs}',
    '\\usepackage{array}',
    '\\usepackage[table]{xcolor}',
    '\\usepackage{amssymb}',
    '\\usepackage{fvextra}',
    `\\usepackage[hidelinks,pdftitle={${latexEscape(title)}}]{hyperref}`,
    '\\setlength{\\parskip}{0.5em}',
    '\\setlength{\\parindent}{0pt}',
    '\\renewcommand{\\arraystretch}{1.25}',
    FIGURE_MACRO,
    '',
    '\\begin{document}',
    '',
    convert(md, { body: false }),
    '',
    '\\end{document}',
    ''
  ].join('\n');
}
