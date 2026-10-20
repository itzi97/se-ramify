/**
 * Export a whole project for a hand-in: every diagram as a PNG, plus one
 * Markdown "memoria" that shows them in order with their notes and their
 * text exports (use case specifications, stories, tables…).
 */
import { tick } from 'svelte';
import { app } from '../stores/app.svelte';
import { storage } from '../storage/diagrams';
import { slug } from '../model/diagram';
import { moduleFor } from '../editors/registry';
import type { Diagram, DiagramMeta } from '../model/types';
import type { TextExport } from '../editors/types';
import { memoria } from './memoria';
import { chooseFormats } from './formats.svelte';
import { kindInfo } from '../model/kinds';
import { agendaFrom } from './agenda';

const settle = async () => {
  await tick();
  // Let the editor mount and Svelte Flow measure its shapes (and fit the view).
  for (let i = 0; i < 3; i++) await new Promise((r) => requestAnimationFrame(r));
  await new Promise((r) => setTimeout(r, 450));
};

export async function exportProject(project: string) {
  const items: DiagramMeta[] = app.list.filter((m) => (m.project || '') === project && !m.archived).sort((a, b) => a.title.localeCompare(b.title, 'es'));
  await exportSet(items, project || 'Diagramas', slug(project, 50) || 'diagramas');
}

/**
 * Export a set of diagrams in the given order: numbered PNGs, their
 * Gherkin / PlantUML files, and a memoria titled `title` (with `intro`
 * lines after the title, e.g. a hand-in's checklist) — as Markdown and,
 * as chosen, Word, LaTeX (whole document and a body to \input) and a
 * PowerPoint deck for the presentation.
 */
export async function exportSet(items: DiagramMeta[], title: string, fileBase: string, intro: string[] = [], dirTitle?: string) {
  if (!items.length) return;
  const formats = await chooseFormats(title, items.length);
  if (!formats) return;
  const s = await storage();
  const dir = await s.pickExportDir(dirTitle ?? `Export "${title}" into…`);
  if (!dir) return;
  const images = new Map<string, Uint8Array>();
  const pngs = new Map<string, Uint8Array>();
  const project = title;
  const back = app.path;
  const parts: { doc: Diagram; image: string | null; markdown: string[] }[] = [];
  app.notify(`Exporting ${items.length} diagrams…`);
  try {
    for (const [i, m] of items.entries()) {
      await app.open(m.path);
      await settle();
      const doc = app.doc!;
      // An empty canvas would only add a blank image.
      if ('nodes' in doc.data && (doc.data as { nodes: unknown[] }).nodes.length === 0) continue;
      const base = `${String(i + 1).padStart(2, '0')}-${slug(doc.title, 50) || doc.kind}`;
      let image: string | null = `${base}.png`;
      try {
        const png = await app.renderImage('png');
        await s.writeInto(dir, image, png);
        images.set(image, png);
        pngs.set(doc.id, png);
      } catch {
        image = null;
      }
      const exports = (moduleFor(doc.kind).exports as (d: Diagram) => TextExport[])(doc);
      const markdown = exports.filter((x) => x.ext === 'md').map((x) => x.build());
      // Gherkin, PlantUML and the AI brief go next to the images, as files of their own.
      for (const x of exports.filter((x) => x.ext === 'feature' || x.ext === 'puml' || x.ext === 'brief.md')) await s.writeInto(dir, `${base}.${x.ext}`, x.build());
      parts.push({ doc: JSON.parse(JSON.stringify(doc)) as Diagram, image, markdown });
    }
    const md = memoria(project, parts, intro);
    await s.writeInto(dir, `${fileBase}-memoria.md`, md);
    const written = ['Markdown'];
    if (formats.has('docx')) {
      const { memoriaDocx } = await import('./docx');
      await s.writeInto(dir, `${fileBase}-memoria.docx`, await memoriaDocx(md, images, project));
      written.push('Word');
    }
    if (formats.has('latex')) {
      const { memoriaLatex, memoriaLatexBody } = await import('./latex');
      await s.writeInto(dir, `${fileBase}-memoria.tex`, memoriaLatex(md, project));
      await s.writeInto(dir, `${fileBase}-memoria-cuerpo.tex`, memoriaLatexBody(md));
      written.push('LaTeX');
    }
    if (formats.has('pptx')) {
      const { buildDeck } = await import('./pptx');
      const deck = await buildDeck({
        title: project,
        subtitle: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
        agenda: agendaFrom(intro),
        slides: parts.map((p) => ({ title: p.doc.title, kind: kindInfo(p.doc.kind).es, notes: p.doc.notes, png: pngs.get(p.doc.id) ?? null }))
      });
      await s.writeInto(dir, `${fileBase}-presentacion.pptx`, deck);
      written.push('PowerPoint');
    }
    app.notify(`Exported ${parts.length} diagrams and the memoria (${written.join(', ')}) to ${dir === 'downloads' ? 'your downloads' : dir}.`);
  } catch (err) {
    console.error('project export', err);
    app.notify(`Project export stopped: ${err instanceof Error ? err.message : err}`, 'error');
  } finally {
    if (back) await app.open(back);
  }
}
