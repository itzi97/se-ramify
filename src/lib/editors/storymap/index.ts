import StoryMapEditor from './StoryMapEditor.svelte';
import type { EditorModule } from '../types';
import { storymapExample } from './example';
import { toFeature, toMarkdown } from './ops';

export const storymapModule: EditorModule<'storymap'> = {
  component: StoryMapEditor,
  example: storymapExample,
  exports: (doc) => [
    { label: 'Markdown by sprint (.md)', ext: 'md', mime: 'text/markdown', build: () => toMarkdown(doc.title, doc.data) },
    { label: 'Gherkin (.feature)', ext: 'feature', mime: 'text/plain', build: () => toFeature(doc.title, doc.data) }
  ]
};
