import TcoEditor from './TcoEditor.svelte';
import { tcoExample } from './example';
import { tcoCsv, tcoMarkdown } from './text';
import type { EditorModule } from '../types';

export const tcoModule: EditorModule<'tco'> = {
  component: TcoEditor,
  example: tcoExample,
  exports: (doc) => [
    { label: 'Markdown (.md)', ext: 'md', mime: 'text/markdown', build: () => tcoMarkdown(doc.data, doc.title) },
    { label: 'CSV table (.csv)', ext: 'csv', mime: 'text/csv', build: () => tcoCsv(doc.data) }
  ]
};
