/**
 * Sticky-note boards: empathy map, business model canvas, context map,
 * customer persona, brainstorming, crazy eight and six thinking hats. One
 * editor, one data shape (BoardData), a template per kind.
 */
import GridBoardEditor from './GridBoardEditor.svelte';
import type { BoardKind, DataByKind, DiagramOf } from '../../model/types';
import type { EditorModule } from '../types';
import { boardExample } from './examples';
import { boardExports } from './export';

export function boardModule<K extends BoardKind>(kind: K): EditorModule<K> {
  return {
    component: GridBoardEditor,
    example: () => boardExample(kind) as DataByKind[K],
    exports: (doc) => boardExports(doc as unknown as DiagramOf<BoardKind>)
  };
}
