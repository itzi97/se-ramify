import GanttEditor from './GanttEditor.svelte';
import type { EditorModule } from '../types';
import { ganttExample } from './example';
import { toCsv, toMermaid } from './time';

export const ganttModule: EditorModule<'gantt'> = {
  component: GanttEditor,
  example: ganttExample,
  exports: (doc) => [
    { label: 'Mermaid gantt (.mmd)', ext: 'mmd', mime: 'text/plain', build: () => toMermaid(doc.title, doc.data) },
    { label: 'CSV table (.csv)', ext: 'csv', mime: 'text/csv', build: () => toCsv(doc.data) }
  ]
};
