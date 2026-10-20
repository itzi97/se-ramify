import UpEditor from './UpEditor.svelte';
import { upExample } from './example';
import { upMarkdown } from './model';
import { app } from '../../stores/app.svelte';
import type { EditorModule } from '../types';

export const upModule: EditorModule<'up'> = {
  component: UpEditor,
  example: upExample,
  exports: (doc) => [
    {
      label: 'Markdown (.md)',
      ext: 'md',
      mime: 'text/markdown',
      build: () => upMarkdown(doc.data, doc.title, (id) => app.list.find((m) => m.id === id)?.title)
    }
  ]
};
