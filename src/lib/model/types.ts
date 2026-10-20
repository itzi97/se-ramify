/**
 * The data model. One diagram = one JSON file. Every diagram shares the
 * envelope (`Diagram`); `data` depends on `kind`.
 *
 * Two families:
 *  - graph kinds (UML and maps): nodes and edges on a canvas, drawn with
 *    Svelte Flow (editors/graph). Positions are absolute; containers
 *    (system boundary, swimlane, package, deployment node…) hold whatever
 *    sits geometrically inside them.
 *  - structured kinds: their own data and their own editor (sequence,
 *    Gantt, story map, Kanban, stakeholders, empathy map, canvas, vision).
 */

export const FORMAT = 'se-ramify/1';

export type GraphKind =
  | 'usecase'
  | 'class'
  | 'activity'
  | 'state'
  | 'communication'
  | 'deployment'
  | 'architecture'
  | 'flowchart'
  | 'er'
  | 'dfd'
  | 'screenflow'
  | 'traceability'
  | 'mindmap'
  | 'conceptmap'
  | 'orgchart';

/** Sticky-note boards that differ only in their template (editors/board/templates.ts). */
export type BoardKind = 'empathy' | 'canvas' | 'context' | 'persona' | 'brainstorm' | 'crazy8' | 'sixhats';

export type StructuredKind = 'sequence' | 'gantt' | 'storymap' | 'kanban' | 'stakeholder' | 'journey' | 'vision' | 'tco' | 'backlog' | 'minutes' | 'up' | BoardKind;

export type DiagramKind = GraphKind | StructuredKind;

export interface DiagramBase {
  format: typeof FORMAT;
  id: string;
  kind: DiagramKind;
  title: string;
  /** Free text that groups diagrams in the list ("AñadaMaster", "Examen"). */
  project: string;
  /** Free notes about the whole diagram (Markdown-ish plain text). */
  notes: string;
  created: string;
  updated: string;
  archived?: boolean;
}

/* ------------------------------------------------------------------ graph */

export interface GNode {
  id: string;
  /** One of the node types the kind's palette offers (see kinds.ts). */
  type: string;
  x: number;
  y: number;
  /** Size, only for node types that are resizable (containers, notes). */
  w?: number;
  h?: number;
  /** Name / text. For a class: the class name. For a lifeline-ish object: "obj:Clase". */
  label: string;
  /** «stereotype» shown above the name, without the guillemets. */
  stereotype?: string;
  /** Class: attribute lines ("- nombre: String"). State: internal activities ("entry / …"). */
  attrs?: string[];
  /** Class: operation lines ("+ reservar(fecha: Date): Reserva"). */
  ops?: string[];
  /** Class: abstract (italic name). */
  abstract?: boolean;
  /** Architecture: Lucide icon name. Mind map: optional icon. */
  icon?: string;
  /** Optional colour (hex) for maps and architecture zones. */
  color?: string;
  /** Free notes, shown in the inspector only. */
  note?: string;
  /** Use case specification (use case nodes only). */
  spec?: UseCaseSpec;
  /** Mind map: parent idea (the tree); the root has none. */
  parent?: string;
  /** Mind map: order among siblings. */
  order?: number;
  /** Org chart: the person holding the role. */
  person?: string;
}

export interface CommMessage {
  /** "1", "1.1", "2a"… the sequence number as written. */
  seq: string;
  text: string;
  /** Which way the arrow points along the link. */
  dir: 'forward' | 'back';
}

export interface GEdge {
  id: string;
  /** One of the edge types the kind's palette offers. */
  type: string;
  from: string;
  to: string;
  label?: string;
  /** Class associations: multiplicity / role at each end. */
  fromLabel?: string;
  toLabel?: string;
  /** Communication diagrams: the numbered messages on this link. */
  messages?: CommMessage[];
}

export interface UseCaseSpec {
  code: string;
  primaryActor: string;
  secondaryActors: string;
  description: string;
  preconditions: string;
  trigger: string;
  /** One step per line. */
  mainFlow: string;
  /** One per line, "3a. …" style. */
  alternativeFlows: string;
  postconditions: string;
  priority: string;
  frequency: string;
}

export type EdgeRouting = 'straight' | 'orthogonal';

export interface GraphData {
  nodes: GNode[];
  edges: GEdge[];
  routing: EdgeRouting;
}

/* --------------------------------------------------------------- sequence */

export type ParticipantKind = 'actor' | 'object' | 'boundary' | 'control' | 'entity' | 'database';

export interface Participant {
  id: string;
  name: string;
  kind: ParticipantKind;
}

export type MessageStyle = 'sync' | 'async' | 'reply' | 'create' | 'destroy';

export type SeqItem =
  | { id: string; t: 'msg'; from: string; to: string; text: string; style: MessageStyle }
  | { id: string; t: 'open'; op: 'alt' | 'opt' | 'loop' | 'par' | 'break' | 'critical' | 'ref'; guard: string }
  | { id: string; t: 'else'; guard: string }
  | { id: string; t: 'close' }
  | { id: string; t: 'note'; over: string[]; text: string };

export interface SequenceData {
  participants: Participant[];
  items: SeqItem[];
  /** Draw activation bars automatically (sync call opens, reply closes). */
  activations: boolean;
  /** Number the messages 1, 2, 3… */
  autonumber: boolean;
}

/* ------------------------------------------------------------------ gantt */

export interface GanttTask {
  id: string;
  name: string;
  /** ISO dates (YYYY-MM-DD), inclusive. A milestone has start === end. */
  start: string;
  end: string;
  /** 0..100 */
  progress: number;
  milestone: boolean;
  /** A group row (a PUD phase, an iteration); its bar spans its children. */
  group: boolean;
  /** The group this task belongs to, if any. */
  parent?: string;
  /** Finish-to-start dependencies: ids of tasks that must end first. */
  deps: string[];
  owner: string;
  color?: string;
}

export interface GanttData {
  tasks: GanttTask[];
  /** Timeline unit for the grid. */
  scale: 'day' | 'week' | 'month';
  /** Skip Saturdays and Sundays when shading. */
  showWeekends: boolean;
}

/* --------------------------------------------------- user stories (shared) */

export interface UserStory {
  id: string;
  /** Short title shown on the card. */
  title: string;
  /** "Como <rol> quiero <objetivo> para <beneficio>" — the three parts. */
  asA: string;
  iWant: string;
  soThat: string;
  /** Gherkin acceptance criteria (Escenario / Dado / Cuando / Entonces), free text. */
  gherkin: string;
  points?: number;
  /** MoSCoW or free priority. */
  priority?: string;
  epic?: string;
}

/* --------------------------------------------------------------- storymap */

export interface StoryMapActivity {
  id: string;
  title: string;
  steps: { id: string; title: string }[];
}

export interface StoryMapRelease {
  id: string;
  /** "Sprint 1", "MVP"… */
  name: string;
}

export interface StoryMapData {
  /** Who the map is about (persona / user). */
  persona: string;
  activities: StoryMapActivity[];
  releases: StoryMapRelease[];
  /** A story sits under one step, in one release, in order. */
  stories: (UserStory & { stepId: string; releaseId: string; order: number })[];
}

/* ----------------------------------------------------------------- kanban */

export interface KanbanColumn {
  id: string;
  name: string;
  /** WIP limit; 0 = none. */
  wip: number;
}

export type CardType = 'epic' | 'story' | 'task' | 'bug' | 'spike';

export interface KanbanCard extends UserStory {
  colId: string;
  order: number;
  type: CardType;
  assignee: string;
}

export interface KanbanData {
  columns: KanbanColumn[];
  cards: KanbanCard[];
}

/* ------------------------------------------------------------ stakeholder */

export interface Stakeholder {
  id: string;
  name: string;
  /** What they are to the project ("Cliente — dueño de la bodega"). */
  role: string;
  /** 0..1 */
  power: number;
  /** 0..1 */
  interest: number;
  /**
   * Onion ring, as in the Tema 3 slide: 0 = "Es vital involucrarlo",
   * 1 = "Es necesario involucrarlos", 2 = "Estaría bien involucrarlos",
   * 3 = "Informar por cortesía".
   */
  ring: 0 | 1 | 2 | 3;
  /** Onion sector: who they are to the project (the four labels around the onion). */
  sector: 'decisores' | 'clientes' | 'influyentes' | 'proveedores';
  attitude: 'supporter' | 'neutral' | 'critic';
  notes: string;
}

export interface StakeholderData {
  stakeholders: Stakeholder[];
  /** Which of the two formats to show (both are always kept in sync). */
  view: 'grid' | 'onion';
  /** Name in the middle of the onion. */
  product: string;
}

/* --------------------------------------------------- empathy map / canvas */

export interface Sticky {
  id: string;
  text: string;
  color?: string;
}

export interface BoardData {
  /** Centre / subject (the persona of an empathy map, the business of a canvas). */
  subject: string;
  /** Sticky notes per section id (sections come from the kind's template). */
  sections: Record<string, Sticky[]>;
}

/* -------------------------------------------------------- customer journey */

export interface JourneyStage {
  id: string;
  name: string;
}

export interface JourneyRow {
  id: string;
  /** "Acciones", "Puntos de contacto", "Piensa", "Pains", "Oportunidades"… */
  name: string;
}

export interface JourneyData {
  persona: string;
  scenario: string;
  stages: JourneyStage[];
  rows: JourneyRow[];
  /** Text per cell, keyed `${rowId}:${stageId}`. */
  cells: Record<string, string>;
  /** Emotion per stage, -2 (very bad) … +2 (very good); drawn as the curve. */
  emotion: Record<string, number>;
  /** Stage ids marked as "momento de la verdad". */
  moments: string[];
}

/* ----------------------------------------------------------------- vision */

/** Geoffrey Moore's elevator pitch, the template the course asks for. */
export interface VisionData {
  forWho: string;
  who: string;
  product: string;
  isA: string;
  that: string;
  unlike: string;
  ourProduct: string;
}

/* -------------------------------------------------------------------- TCO */

/**
 * The cost blocks of Tema 2 (diap. 28: "TCO: componentes típicos en un
 * desarrollo SW"), plus development effort, which the project asks for
 * ("costes para desarrollar, desplegar y operar").
 */
export type TcoBlock = 'dev' | 'hwsw' | 'ops' | 'long';

export interface TcoLine {
  id: string;
  /** "Servidor Dell PowerEdge T150 (Xeon E-2314, 16 GB)". */
  name: string;
  block: TcoBlock;
  nature: 'capex' | 'opex';
  /** Price of one unit, in euros, for one period (`when`). */
  unitCost: number;
  qty: number;
  /** once = paid in `year`; yearly / monthly = paid every year from `year` on. */
  when: 'once' | 'yearly' | 'monthly';
  /** 1-based year it is paid in (once) or starts in (recurring). */
  year: number;
  /** Where the figure comes from (shop URL, calculator, salary table). */
  source: string;
}

export interface TcoAlternative {
  id: string;
  /** "Local (on-premises)", "Nube (AWS)". */
  name: string;
  /** Short description of the architecture. */
  description: string;
  color?: string;
  lines: TcoLine[];
}

export interface TcoCriterion {
  id: string;
  /** "Disponibilidad 9–18 h", "Redundancia", "Riesgo operativo". */
  name: string;
  /** Relative weight (any positive number; shown as a percentage of the total). */
  weight: number;
}

export interface TcoData {
  /** The horizon, 3 in the project. */
  years: number;
  /** Optional, for "TCO por usuario". 0 = not shown. */
  users: number;
  alternatives: TcoAlternative[];
  /** Qualitative comparison beside the money (the "Cada decisión impactará en el TCO" table). */
  criteria: TcoCriterion[];
  /** Score 1..5 per `${criterionId}:${alternativeId}`. */
  scores: Record<string, number>;
  /** The reasoned recommendation. */
  recommendation: string;
}

/* ---------------------------------------------------------------- backlog */

export interface Epic {
  id: string;
  /** "EP-01". Empty = numbered automatically in order. */
  code: string;
  title: string;
  description: string;
  /** Which component / module it belongs to ("Préstamos", "Catálogo"). */
  component: string;
  /** MoSCoW: Must / Should / Could / Won't. */
  priority: string;
  /** Stories of this epic, in priority order. Empty while the epic isn't broken down. */
  stories: UserStory[];
}

/** What a team hands to an AI model with the stories, to generate and test the app ("vibe coding"). */
export interface AiBrief {
  /** What the product is and for whom, in a paragraph. */
  context: string;
  /** Language, framework, database, how it runs. */
  stack: string;
  /** Rules the model must follow (one per line). */
  guardrails: string;
  /** Domain terms, "Término: definición" per line. */
  glossary: string;
  /** What is deliberately left out. */
  outOfScope: string;
  /** How to generate, run and test: the step-by-step process for the client. */
  process: string;
}

export interface BacklogData {
  product: string;
  /** Components / modules the epics are grouped by. */
  components: string[];
  epics: Epic[];
  ai: AiBrief;
}

/* ----------------------------------------------------------------- minutes */

export type MinutesType = 'client' | 'team' | 'postmortem' | 'retro';

export interface MinutesItem {
  id: string;
  text: string;
}

export interface MinutesData {
  type: MinutesType;
  /** "Acta 1", "R-03". */
  number: string;
  /** ISO date. */
  date: string;
  start: string;
  end: string;
  /** Room, or "Teams". */
  place: string;
  attendees: { id: string; name: string; role: string; present: boolean }[];
  agenda: MinutesItem[];
  /** What was discussed, free text. */
  discussion: string;
  decisions: MinutesItem[];
  actions: { id: string; text: string; owner: string; due: string; done: boolean }[];
  /** Questions asked (to the client) and their answers. */
  questions: { id: string; text: string; answer: string }[];
  /** Post mortem / retrospective: what went well, badly, what to improve — about the team or the methodology. */
  review: { id: string; text: string; kind: 'well' | 'bad' | 'improve'; area: 'team' | 'method' }[];
  /** "Próxima reunión: …". */
  next: string;
}

/* --------------------------------------------------------- unified process */

export interface UpPhase {
  id: string;
  /** Inicio, Elaboración, Construcción, Transición. */
  name: string;
  goal: string;
  /** The milestone that closes it ("Objetivos del ciclo de vida"). */
  milestone: string;
  /** Iteration names ("E1", "E2"…); at least one. */
  iterations: string[];
}

export interface UpDiscipline {
  id: string;
  /** Requisitos, Análisis y diseño, Implementación, Pruebas… */
  name: string;
  /** Effort per phase, 0..4, drawn as the hump. Same order as `phases`. */
  effort: number[];
}

export interface UpArtifact {
  id: string;
  phaseId: string;
  disciplineId: string;
  name: string;
  status: 'todo' | 'draft' | 'done';
  /** A diagram of this project that is the artefact (opened on click). */
  diagramId?: string;
  note: string;
}

export interface UpData {
  phases: UpPhase[];
  disciplines: UpDiscipline[];
  artifacts: UpArtifact[];
}

/* --------------------------------------------------------------- envelope */

export interface DataByKind {
  usecase: GraphData;
  class: GraphData;
  activity: GraphData;
  state: GraphData;
  communication: GraphData;
  deployment: GraphData;
  architecture: GraphData;
  flowchart: GraphData;
  er: GraphData;
  dfd: GraphData;
  screenflow: GraphData;
  traceability: GraphData;
  mindmap: GraphData;
  conceptmap: GraphData;
  orgchart: GraphData;
  sequence: SequenceData;
  gantt: GanttData;
  storymap: StoryMapData;
  kanban: KanbanData;
  stakeholder: StakeholderData;
  journey: JourneyData;
  vision: VisionData;
  tco: TcoData;
  backlog: BacklogData;
  minutes: MinutesData;
  up: UpData;
  empathy: BoardData;
  canvas: BoardData;
  context: BoardData;
  persona: BoardData;
  brainstorm: BoardData;
  crazy8: BoardData;
  sixhats: BoardData;
}

export type DiagramOf<K extends DiagramKind> = DiagramBase & { kind: K; data: DataByKind[K] };
export type Diagram = { [K in DiagramKind]: DiagramOf<K> }[DiagramKind];

export interface DiagramMeta {
  id: string;
  kind: DiagramKind;
  title: string;
  project: string;
  updated: string;
  archived?: boolean;
  path: string;
}
