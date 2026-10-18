import VisionEditor from './VisionEditor.svelte';
import { visionExample } from './example';
import { visionMarkdown, visionSentence } from './text';
import type { EditorModule } from '../types';

export const visionModule: EditorModule<'vision'> = {
  component: VisionEditor,
  example: visionExample,
  exports: (doc) => [
    { label: 'Markdown (.md)', ext: 'md', mime: 'text/markdown', build: () => visionMarkdown(doc.data, doc.title) },
    { label: 'Plain sentence (.txt)', ext: 'txt', mime: 'text/plain', build: () => visionSentence(doc.data) + '\n' }
  ]
};
