/** Customer journey: stages, rows of notes, the emotion curve and moments of truth. */
import JourneyEditor from './JourneyEditor.svelte';
import type { EditorModule } from '../types';
import { journeyExample, journeyMarkdown } from './model';

export const journeyModule: EditorModule<'journey'> = {
  component: JourneyEditor,
  example: journeyExample,
  exports: (doc) => [{ label: 'Markdown (.md)', ext: 'md', mime: 'text/markdown', build: () => journeyMarkdown(doc.title, doc.data) }]
};
