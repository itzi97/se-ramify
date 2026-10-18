/**
 * Which editor, example and exports belong to each kind.
 */
import type { DiagramKind } from '../model/types';
import type { EditorModule } from './types';
import { graphModule } from './graph';
import { sequenceModule } from './sequence';
import { ganttModule } from './gantt';
import { kanbanModule } from './kanban';
import { storymapModule } from './storymap';
import { stakeholderModule } from './stakeholder';
import { journeyModule } from './journey';
import { visionModule } from './vision';
import { boardModule } from './board';

export const MODULES: { [K in DiagramKind]: EditorModule<K> } = {
  usecase: graphModule('usecase'),
  class: graphModule('class'),
  activity: graphModule('activity'),
  state: graphModule('state'),
  communication: graphModule('communication'),
  deployment: graphModule('deployment'),
  architecture: graphModule('architecture'),
  flowchart: graphModule('flowchart'),
  er: graphModule('er'),
  dfd: graphModule('dfd'),
  screenflow: graphModule('screenflow'),
  traceability: graphModule('traceability'),
  mindmap: graphModule('mindmap'),
  conceptmap: graphModule('conceptmap'),
  sequence: sequenceModule,
  gantt: ganttModule,
  kanban: kanbanModule,
  storymap: storymapModule,
  stakeholder: stakeholderModule,
  journey: journeyModule,
  vision: visionModule,
  empathy: boardModule('empathy'),
  canvas: boardModule('canvas'),
  context: boardModule('context'),
  persona: boardModule('persona'),
  brainstorm: boardModule('brainstorm'),
  crazy8: boardModule('crazy8'),
  sixhats: boardModule('sixhats')
};

export function moduleFor<K extends DiagramKind>(kind: K): EditorModule<K> {
  return MODULES[kind];
}
