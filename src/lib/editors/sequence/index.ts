import SequenceEditor from './SequenceEditor.svelte';
import { sequenceExample } from './example';
import { parsePlantUml, toMermaid, toPlantUml } from './text';
import type { EditorModule } from '../types';

export const sequenceModule: EditorModule<'sequence'> = {
  component: SequenceEditor,
  example: sequenceExample,
  exports: (doc) => [
    { label: 'PlantUML (.puml)', ext: 'puml', mime: 'text/plain', build: () => toPlantUml(doc.data, doc.title) },
    { label: 'Mermaid (.mmd)', ext: 'mmd', mime: 'text/plain', build: () => toMermaid(doc.data, doc.title) }
  ],
  importText: { label: 'Import PlantUML', extensions: ['puml', 'plantuml', 'txt'], parse: (text, current) => parsePlantUml(text, current) }
};
