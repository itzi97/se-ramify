/**
 * Which documents a project / hand-in export writes besides the PNGs and
 * the Markdown memoria. `chooseFormats` opens the small chooser
 * (components/ExportFormats.svelte, mounted once in App.svelte) and
 * resolves with the ticked formats, or null if cancelled. The choice is
 * remembered.
 */
import { storage } from '../storage/diagrams';

export type DocFormat = 'docx' | 'latex' | 'pptx';

export const DOC_FORMATS: { id: DocFormat; label: string; hint: string }[] = [
  { id: 'docx', label: 'Word (.docx)', hint: 'The memoria with headings, tables and the images, ready to edit in Word, LibreOffice or Google Docs.' },
  { id: 'latex', label: 'LaTeX (.tex)', hint: 'A complete document for pdflatex, plus a "-cuerpo.tex" body to \\input into your own template.' },
  { id: 'pptx', label: 'PowerPoint (.pptx)', hint: 'A deck for the presentation: title, the parts of the hand-in, one slide per diagram.' }
];

interface Prompt {
  title: string;
  count: number;
  chosen: Record<DocFormat, boolean>;
  resolve: (v: Set<DocFormat> | null) => void;
}

class FormatPrompt {
  current = $state<Prompt | null>(null);

  answer(ok: boolean) {
    const p = this.current;
    if (!p) return;
    this.current = null;
    if (!ok) return p.resolve(null);
    const set = new Set((Object.keys(p.chosen) as DocFormat[]).filter((k) => p.chosen[k]));
    void storage().then((s) => s.setSetting('exportFormats', [...set]));
    p.resolve(set);
  }
}

export const formatPrompt = new FormatPrompt();

export async function chooseFormats(title: string, count: number): Promise<Set<DocFormat> | null> {
  const saved = (await (await storage()).getSetting<DocFormat[]>('exportFormats')) ?? ['docx'];
  return new Promise((resolve) => {
    formatPrompt.current = { title, count, chosen: { docx: saved.includes('docx'), latex: saved.includes('latex'), pptx: saved.includes('pptx') }, resolve };
  });
}
