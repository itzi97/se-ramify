/** Meeting minutes (acta): client meetings, team meetings, post mortem and retrospectives. */
import MinutesEditor from './MinutesEditor.svelte';
import type { EditorModule } from '../types';
import { minutesExample } from './example';
import { minutesCsv, minutesMarkdown } from './model';

export const minutesModule: EditorModule<'minutes'> = {
  component: MinutesEditor,
  example: minutesExample,
  exports: (doc) => [
    { label: 'Markdown (.md)', ext: 'md', mime: 'text/markdown', build: () => minutesMarkdown(doc.title, doc.data) },
    { label: 'Action list (.csv)', ext: 'csv', mime: 'text/csv', build: () => minutesCsv(doc.data) }
  ]
};
