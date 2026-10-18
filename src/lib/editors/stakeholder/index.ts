/** Stakeholder map: power/interest grid and the onion, one list of stakeholders. */
import StakeholderEditor from './StakeholderEditor.svelte';
import type { EditorModule } from '../types';
import { stakeholderExample } from './example';
import { stakeholderCsv, stakeholderMarkdown } from './model';

export const stakeholderModule: EditorModule<'stakeholder'> = {
  component: StakeholderEditor,
  example: stakeholderExample,
  exports: (doc) => [
    { label: 'Markdown table (.md)', ext: 'md', mime: 'text/markdown', build: () => stakeholderMarkdown(doc.title, doc.data) },
    { label: 'CSV (.csv)', ext: 'csv', mime: 'text/csv', build: () => stakeholderCsv(doc.data) }
  ]
};
