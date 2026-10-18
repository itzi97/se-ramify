import KanbanEditor from './KanbanEditor.svelte';
import type { EditorModule } from '../types';
import { kanbanExample, toMarkdown } from './ops';
import { buildFeature, groupByEpic } from '../../model/stories';

export const kanbanModule: EditorModule<'kanban'> = {
  component: KanbanEditor,
  example: kanbanExample,
  exports: (doc) => [
    { label: 'Markdown (.md)', ext: 'md', mime: 'text/markdown', build: () => toMarkdown(doc.title, doc.data) },
    {
      label: 'Gherkin for stories (.feature)',
      ext: 'feature',
      mime: 'text/plain',
      build: () => buildFeature(groupByEpic(doc.data.cards.filter((c) => c.type === 'story'), doc.title || 'Tablero'))
    }
  ]
};
