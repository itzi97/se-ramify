// Turn every *-memoria.md under a folder into an A4 PDF next to it, with
// its images: pandoc renders the HTML, Chromium prints it.
//   node tests/e2e/memoria-pdf.mjs <dir>
// Needs pandoc on the PATH.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(process.argv[2]);
const files = [];
const walk = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('-memoria.md')) files.push(p);
  }
};
walk(root);

const css = `
@page { size: A4; margin: 18mm 16mm 20mm; }
html { font: 10.5pt/1.45 'Atkinson Hyperlegible', 'Noto Sans', 'DejaVu Sans', sans-serif; color: #1d2125; }
body { margin: 0; }
h1 { font-size: 20pt; margin: 0 0 4pt; line-height: 1.2; }
h2 { font-size: 14pt; margin: 22pt 0 6pt; padding-bottom: 3pt; border-bottom: 1.5pt solid #1d2125; break-after: avoid; }
h3 { font-size: 11.5pt; margin: 14pt 0 4pt; break-after: avoid; }
h4, h5, h6 { font-size: 10.5pt; margin: 10pt 0 3pt; break-after: avoid; }
p, li { orphans: 3; widows: 3; }
em:first-child:last-child { color: #5d646b; }
img { display: block; max-width: 100%; max-height: 235mm; margin: 6pt auto 10pt; break-inside: avoid; }
figure { margin: 0; break-inside: avoid; }
figcaption { display: none; }
table { width: 100%; border-collapse: collapse; margin: 6pt 0 10pt; font-size: 9pt; break-inside: auto; }
tr { break-inside: avoid; }
th, td { border: 0.6pt solid #c9ced3; padding: 3pt 5pt; vertical-align: top; text-align: left; }
th { background: #f1f3f5; }
code, pre { font-family: 'JetBrains Mono', 'DejaVu Sans Mono', monospace; font-size: 8.5pt; }
pre { background: #f4f5f7; padding: 6pt 8pt; white-space: pre-wrap; break-inside: avoid; border-radius: 3pt; }
blockquote { margin: 8pt 0; padding: 4pt 10pt; border-left: 3pt solid #c98a12; background: #fdf6e7; }
a { color: inherit; text-decoration: none; }
nav, #TOC { display: none; }
`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage();
for (const md of files) {
  const dir = dirname(md);
  const html = join(dir, `.${basename(md, '.md')}.html`);
  const cssFile = join(dir, '.memoria.css');
  writeFileSync(cssFile, css);
  execFileSync('pandoc', [md, '-f', 'gfm', '-t', 'html5', '-s', '--metadata', `pagetitle=${basename(md, '.md')}`, '-c', '.memoria.css', '-o', html], { cwd: dir });
  await page.goto(pathToFileURL(html).href, { waitUntil: 'load' });
  const pdf = md.replace(/\.md$/, '.pdf');
  await page.pdf({
    path: pdf,
    format: 'A4',
    printBackground: true,
    preferCSSPageSize: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="width:100%;font:8pt sans-serif;color:#888;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>'
  });
  rmSync(html);
  rmSync(cssFile);
  console.log(pdf);
}
await browser.close();
