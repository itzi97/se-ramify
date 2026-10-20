/** The Markdown "memoria" a project export writes. Pure, so it can be tested. */
import { kindInfo } from '../model/kinds';
import { slug } from '../model/diagram';
import type { Diagram } from '../model/types';

/** Push every heading down `by` levels, so a diagram's export nests under its section. */
export function demoteHeadings(md: string, by: number): string {
  return md.replace(/^(#{1,6}) /gm, (_m, h: string) => `${'#'.repeat(Math.min(6, h.length + by))} `);
}

/** The memoria for a project, given each diagram, its image name and its Markdown exports. */
export function memoria(project: string, parts: { doc: Diagram; image: string | null; markdown: string[] }[], intro: string[] = []): string {
  const out = [`# ${project || 'Diagramas'}`, '', `_Exportado con se-ramify el ${new Date().toLocaleDateString('es-ES')}._`, ''];
  if (intro.length) out.push(...intro, '');
  out.push('## Índice', '');
  parts.forEach((p, i) => out.push(`${i + 1}. [${p.doc.title}](#${slug(`${i + 1} ${p.doc.title}`, 80)}) — ${kindInfo(p.doc.kind).es}`));
  out.push('');
  parts.forEach((p, i) => {
    out.push(`## ${i + 1}. ${p.doc.title}`, '', `*${kindInfo(p.doc.kind).es}*`, '');
    if (p.image) out.push(`![${p.doc.title}](${p.image})`, '');
    if (p.doc.notes.trim()) out.push(p.doc.notes.trim(), '');
    for (const md of p.markdown) {
      // Drop the export's own title line: the section already names the diagram.
      const body = md.replace(/^# .*\n+/, '');
      out.push(demoteHeadings(body, 1).trim(), '');
    }
  });
  return out.join('\n');
}

