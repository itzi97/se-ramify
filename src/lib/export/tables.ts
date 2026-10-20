/**
 * Column widths for the memoria's tables in LaTeX and Word, so a column is
 * never narrower than its longest word (bold in the header) and the rest of
 * the width goes to the columns with the most text.
 */

/** Rough widths in em of a sans/serif text face: capitals wide, spaces and i/l narrow. */
export function textWidth(s: string, fontPt: number): number {
  return [...s].reduce((sum, ch) => sum + (/[A-ZÁÉÍÓÚÑ€%MW]/.test(ch) ? 0.78 : /[0-9]/.test(ch) ? 0.58 : /\s/.test(ch) ? 0.36 : /[il.,:;'!|]/.test(ch) ? 0.32 : 0.56), 0) * fontPt;
}

const plain = (s: string) => s.replace(/\*\*|`|\\/g, '');
const lines = (s: string) => plain(s).split(/<br\s*\/?>/i);
/** Words break at ordinary spaces only: "1.200 €" with a no-break space stays one. */
const words = (s: string) => plain(s).split(/[ \t\n]+|<br\s*\/?>/i);

/**
 * Widths in points for a table of `header` and `rows` cell texts (Markdown)
 * at `fontPt`, filling `totalPt` (cell padding excluded).
 */
export function columnWidths(header: string[], rows: string[][], fontPt: number, totalPt: number): number[] {
  const col = (i: number) => [header[i], ...rows.map((r) => r[i] ?? '')];
  const minW = header.map((_, i) => Math.max(...col(i).flatMap((c, k) => words(c).map((w) => textWidth(w, fontPt) * (k === 0 ? 1.08 : 1)))) + 2);
  const wantW = header.map((_, i) => Math.max(minW[i], ...col(i).flatMap((c, k) => lines(c).map((l) => textWidth(l, fontPt) * (k === 0 ? 1.08 : 1)))));
  const minSum = minW.reduce((x, y) => x + y, 0);
  const wantSum = wantW.reduce((x, y) => x + y, 0);
  if (wantSum <= totalPt) return wantW.map((w) => (w / wantSum) * totalPt);
  if (minSum >= totalPt) return minW.map((w) => (w / minSum) * totalPt);
  // Each column gets its minimum; what's left goes by how much more text it holds (capped, so one long column doesn't take everything).
  const extra = wantW.map((w, i) => Math.min(w - minW[i], 220));
  const extraSum = extra.reduce((x, y) => x + y, 0) || 1;
  return minW.map((m, i) => m + (extra[i] / extraSum) * (totalPt - minSum));
}
