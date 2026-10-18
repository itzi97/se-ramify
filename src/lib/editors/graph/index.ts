/**
 * Every canvas kind (UML, maps, DFD, E/R, screens, traceability,
 * infrastructure) shares one editor; examples and text exports differ.
 */
import GraphEditor from './GraphEditor.svelte';
import type { GraphKind } from '../../model/types';
import type { EditorModule } from '../types';
import { graphExample } from './examples';
import { graphExports } from './export';

export function graphModule<K extends GraphKind>(kind: K): EditorModule<K> {
  return {
    component: GraphEditor,
    example: () => graphExample(kind) as never,
    exports: (doc) => graphExports(doc)
  };
}
