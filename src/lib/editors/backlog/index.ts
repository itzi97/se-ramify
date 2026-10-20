import BacklogEditor from './BacklogEditor.svelte';
import { backlogExample } from './example';
import { aiBriefMarkdown, toFeature, toMarkdown } from './model';
import type { EditorModule } from '../types';

export const backlogModule: EditorModule<'backlog'> = {
  component: BacklogEditor,
  example: backlogExample,
  exports: (doc) => [
    { label: 'Markdown backlog (.md)', ext: 'md', mime: 'text/markdown', build: () => toMarkdown(doc.title, doc.data) },
    { label: 'Gherkin (.feature)', ext: 'feature', mime: 'text/plain', build: () => toFeature(doc.data) },
    // Not "md": the project memoria only takes the backlog itself, and this one would repeat every story.
    { label: 'AI brief (.md)', ext: 'brief.md', mime: 'text/markdown', build: () => aiBriefMarkdown(doc.title, doc.data) }
  ]
};
