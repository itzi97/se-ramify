/** Board exports: Markdown, one heading per section, one bullet per sticky. */
import type { BoardKind, DiagramOf } from '../../model/types';
import type { TextExport } from '../types';
import { TEMPLATES } from './templates';

function oneLine(text: string): string {
  return text.replace(/\s*\n\s*/g, ' ').trim();
}

export function boardMarkdown(doc: DiagramOf<BoardKind>): string {
  const t = TEMPLATES[doc.kind];
  const out: string[] = [`# ${doc.title}`, ''];
  if (doc.data.subject.trim()) out.push(`**${t.subjectLabel}:** ${oneLine(doc.data.subject)}`, '');
  for (const sec of t.sections) {
    const items = doc.data.sections[sec.id] ?? [];
    out.push(`## ${sec.title}`, '');
    if (items.length) for (const s of items) out.push(`- ${oneLine(s.text) || '…'}`);
    else out.push('_(vacío)_');
    out.push('');
  }
  if (doc.notes.trim()) out.push('## Notas', '', doc.notes.trim(), '');
  return out.join('\n');
}

export function boardExports(doc: DiagramOf<BoardKind>): TextExport[] {
  return [{ label: 'Markdown (.md)', ext: 'md', mime: 'text/markdown', build: () => boardMarkdown(doc) }];
}
