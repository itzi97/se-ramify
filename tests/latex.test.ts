import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latexEscape, figureSnippet, memoriaLatex, memoriaLatexBody } from '../src/lib/export/latex';

test('escapes LaTeX specials and swaps what pdflatex cannot print', () => {
  assert.equal(latexEscape('50 % & $5 #1 a_b {x} ~ ^ \\'), '50 \\% \\& \\$5 \\#1 a\\_b \\{x\\} \\textasciitilde{} \\textasciicircum{} \\textbackslash{}');
  assert.equal(latexEscape('Préstamo «ñandú» — 1.200 €'), 'Préstamo «ñandú» — 1.200 €');
  assert.equal(latexEscape('A → B ● ○ ≥'), 'A $\\rightarrow$ B $\\bullet$ $\\circ$ $\\geq$');
  assert.equal(latexEscape('emoji 🙂'), 'emoji ?');
});

test('figure snippet', () => {
  assert.equal(
    figureSnippet('class-diagrama-de-clases.png', 'Diagrama de clases & más'),
    '\\begin{figure}[htbp]\n  \\centering\n  \\includegraphics[width=\\linewidth]{class-diagrama-de-clases.png}\n  \\caption{Diagrama de clases \\& más}\n  \\label{fig:diagrama-de-clases-mas}\n\\end{figure}'
  );
});

const MD = `# Proyecto — Entrega 2

_Exportado con se-ramify._

## Índice

1. [Casos de uso](#1-casos) — Diagrama

## 1. Casos de uso

*Diagrama de sistema*

![Casos de uso](01-casos.png)

| Campo | Contenido |
|---|---|
| Flujo | 1. Uno<br>2. Dos |
| **Precio** | 50 % |

\`\`\`gherkin
Escenario: «uno»
  Dado que x_y
\`\`\`

> **Pendiente**: algo
`;

test('a whole document: preamble, title, contents, figure, table, code', () => {
  const tex = memoriaLatex(MD, 'Proyecto');
  assert.match(tex, /\\documentclass\[11pt,a4paper\]\{article\}/);
  assert.match(tex, /\\usepackage\[spanish,es-noshorthands,es-tabla\]\{babel\}/);
  assert.match(tex, /\\LARGE\\bfseries Proyecto — Entrega 2/);
  assert.match(tex, /\\tableofcontents/);
  assert.ok(!tex.includes('[Casos de uso](#'), 'the Markdown index becomes the table of contents');
  assert.match(tex, /\\section\*\{1\. Casos de uso\}\n\\addcontentsline\{toc\}\{section\}/);
  assert.match(tex, /\\seramifyfigura\{01-casos\.png\}\n\\caption\{Casos de uso\}/);
  assert.match(tex, /\\begin\{longtable\}/);
  assert.match(tex, /\\textbf\{Campo\} & \\textbf\{Contenido\} \\\\/);
  assert.match(tex, /1\. Uno\\newline\{\}2\. Dos/);
  assert.match(tex, /\\textbf\{Precio\} & 50 \\% \\\\/);
  assert.ok(!/\\textbf\{Flujo\}/.test(tex), 'only header cells are bold');
  assert.match(tex, /\\begin\{Verbatim\}[^\n]*\nEscenario: «uno»\n  Dado que x_y\n\\end\{Verbatim\}/);
  assert.match(tex, /\\begin\{quote\}\n\\textbf\{Pendiente\}: algo\n\\end\{quote\}/);
  assert.match(tex, /\\end\{document\}\n$/);
});

test('the body for \\input has no preamble and is one level down', () => {
  const body = memoriaLatexBody(MD);
  assert.ok(!body.includes('\\documentclass'));
  assert.ok(!body.includes('\\tableofcontents'));
  assert.match(body, /\\providecommand\{\\seramifyfigura\}/);
  assert.match(body, /\\section\*\{Proyecto — Entrega 2\}/);
  assert.match(body, /\\subsection\*\{1\. Casos de uso\}/);
});
