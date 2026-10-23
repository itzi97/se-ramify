/**
 * The catalogue: every diagram kind the app makes, where it sits in the
 * course, and — for graph kinds — the node and edge types its palette offers.
 * Labels are English (like the rest of the UI); `es` is the name used in
 * class, shown next to it.
 */
import type { DiagramKind, GraphKind } from './types';

export type Family = 'graph' | 'structured';

export interface KindInfo {
  kind: DiagramKind;
  family: Family;
  label: string;
  es: string;
  icon: string;
  /** One line: what it's for. */
  blurb: string;
  /** Which part of the course / project it belongs to. */
  group: 'Company' | 'UML' | 'Requirements' | 'Design thinking' | 'Planning' | 'Architecture';
  /** Where it shows up in the course (topic or deliverable). */
  course: string;
}

export const KINDS: KindInfo[] = [
  // Company (E1)
  { kind: 'orgchart', family: 'graph', label: 'Org chart / roles', es: 'Organigrama y roles', icon: 'Building2', group: 'Company', course: 'E1 Empresa: jerarquía y roles', blurb: 'The company hierarchy: each role, who holds it and what they are responsible for.' },
  { kind: 'tco', family: 'structured', label: 'TCO calculator', es: 'TCO (coste total de propiedad)', icon: 'Calculator', group: 'Company', course: 'T2 TCO · E1', blurb: 'Cost lines per alternative (local / cloud): CAPEX and OPEX by year, 3-year totals, a comparison chart and a reasoned recommendation.' },
  { kind: 'minutes', family: 'structured', label: 'Meeting minutes', es: 'Acta de reunión', icon: 'NotebookPen', group: 'Company', course: 'E3 Actas con el cliente · Entrega final post mortem', blurb: 'Client meetings, team meetings, post mortem and retrospectives: attendees, agenda, decisions, actions, what went well and what to improve.' },
  // UML
  { kind: 'usecase', family: 'graph', label: 'System / use case diagram', es: 'Diagrama de sistema / casos de uso', icon: 'PersonStanding', group: 'UML', course: 'T3 Requisitos · T4 UML · E2', blurb: 'Actors outside, use cases inside the system boundary, «include» / «extend» — and a specification for each use case.' },
  { kind: 'class', family: 'graph', label: 'Class diagram', es: 'Diagrama de clases', icon: 'Boxes', group: 'UML', course: 'T3 Requisitos · T4 UML · E2', blurb: 'Classes with attributes and operations; association, aggregation, composition, inheritance, realisation, dependency.' },
  { kind: 'sequence', family: 'structured', label: 'Sequence diagram', es: 'Diagrama de secuencia', icon: 'ArrowRightLeft', group: 'UML', course: 'T4 UML · E2', blurb: 'Lifelines and messages in time order, activation bars, alt / opt / loop fragments. Type it or click it.' },
  { kind: 'communication', family: 'graph', label: 'Communication diagram', es: 'Diagrama de comunicación', icon: 'Waypoints', group: 'UML', course: 'T4 UML', blurb: 'The same interaction as a sequence diagram, drawn as objects and links with numbered messages.' },
  { kind: 'activity', family: 'graph', label: 'Activity diagram', es: 'Diagrama de actividad', icon: 'Workflow', group: 'UML', course: 'T4 UML', blurb: 'Actions, decisions, fork / join and swimlanes — a use case flow or a business process.' },
  { kind: 'state', family: 'graph', label: 'State machine diagram', es: 'Diagrama de estados', icon: 'CircleDot', group: 'UML', course: 'T4 UML', blurb: 'States, transitions "evento [guarda] / acción", composite states and choices.' },
  { kind: 'deployment', family: 'graph', label: 'Deployment / component diagram', es: 'Diagrama de despliegue / componentes', icon: 'Container', group: 'UML', course: 'T4 UML · E1', blurb: 'Nodes, devices and execution environments, with the artifacts and components deployed on them.' },
  // Requirements & analysis
  { kind: 'er', family: 'graph', label: 'Entity–relationship model', es: 'Modelo entidad / relación', icon: 'Table2', group: 'Requirements', course: 'T3 De requisitos a diseño', blurb: 'Chen notation: entities, attributes (key underlined) and relationships with cardinalities.' },
  { kind: 'dfd', family: 'graph', label: 'Data flow diagram', es: 'Diagrama de flujo de datos (DFD)', icon: 'ArrowRightLeft', group: 'Requirements', course: 'T3 De requisitos a diseño', blurb: 'Context diagram and its levels: external entities, processes, data stores and named flows.' },
  { kind: 'screenflow', family: 'graph', label: 'Screen design / flow', es: 'Diseño de pantallas', icon: 'AppWindow', group: 'Requirements', course: 'T3 De requisitos a diseño', blurb: 'Rough screens (title, fields, buttons) and the transitions between them.' },
  { kind: 'traceability', family: 'graph', label: 'Requirements traceability', es: 'Trazabilidad de requisitos', icon: 'Route', group: 'Requirements', course: 'T3 Requisitos', blurb: 'Requirements → acceptance criteria → design elements → components → test cases, in columns.' },
  { kind: 'stakeholder', family: 'structured', label: 'Stakeholder map', es: 'Mapa de stakeholders', icon: 'Users', group: 'Requirements', course: 'T3 Requisitos · E2', blurb: 'Power / interest grid and the onion (decisores, clientes, influyentes, proveedores) — the same stakeholders in both formats.' },
  { kind: 'vision', family: 'structured', label: 'Vision (elevator pitch)', es: 'Visión — elevator pitch', icon: 'Megaphone', group: 'Requirements', course: 'T5 Visión · E2', blurb: "Moore's template: para / que / el producto / es un / que / a diferencia de / nuestro producto." },
  { kind: 'canvas', family: 'structured', label: 'Business model canvas', es: 'Lienzo de modelo de negocio', icon: 'LayoutDashboard', group: 'Company', course: 'E1 Empresa y modelo de negocio', blurb: 'The nine blocks of a business model, as sticky notes.' },
  // Design thinking
  { kind: 'mindmap', family: 'graph', label: 'Mind map', es: 'Mapa mental', icon: 'Network', group: 'Design thinking', course: 'T3 · 1 Comprender', blurb: 'One central idea and branches of keywords, laid out for you (Tab adds under, Enter beside).' },
  { kind: 'context', family: 'structured', label: 'Context map', es: 'Mapa de contexto', icon: 'Telescope', group: 'Design thinking', course: 'T3 · 1 Comprender', blurb: 'The challenge at a glance: stakeholders, competition, uncertainties, strengths, trends.' },
  { kind: 'persona', family: 'structured', label: 'Customer persona', es: 'Customer persona (arquetipo)', icon: 'Contact', group: 'Design thinking', course: 'T3 · 3 Definir', blurb: 'An archetype of the target user: profile, goals, frustrations, motivations, channels.' },
  { kind: 'journey', family: 'structured', label: 'Customer journey', es: 'Customer journey', icon: 'Footprints', group: 'Design thinking', course: 'T3 · 3 Definir', blurb: 'Stages across, actions / touchpoints / thoughts / pains below, and the emotion curve with moments of truth.' },
  { kind: 'empathy', family: 'structured', label: 'Empathy map', es: 'Mapa de empatía', icon: 'HeartHandshake', group: 'Design thinking', course: 'T3 · 3 Definir', blurb: 'What the user thinks and feels, sees, hears, says and does — with pains and gains.' },
  { kind: 'brainstorm', family: 'structured', label: 'Brainstorming', es: 'Brainstorming', icon: 'Lightbulb', group: 'Design thinking', course: 'T3 · 4 Idear', blurb: 'Diverge (as many ideas as possible, random-word stimulus), then converge on impact and feasibility.' },
  { kind: 'crazy8', family: 'structured', label: 'Crazy eight', es: 'Crazy eight', icon: 'Grid3x3', group: 'Design thinking', course: 'T3 · 4 Idear', blurb: 'Eight panels, eight ideas, one minute each — with a timer.' },
  { kind: 'sixhats', family: 'structured', label: 'Six thinking hats', es: '6 sombreros', icon: 'GraduationCap', group: 'Design thinking', course: 'T3 · 4 Idear', blurb: "De Bono's six perspectives: creativity, optimism, caution, facts, emotions, process." },
  { kind: 'conceptmap', family: 'graph', label: 'Concept map', es: 'Mapa conceptual', icon: 'Share2', group: 'Design thinking', course: 'Estudio', blurb: 'Concepts joined by labelled arrows ("es un", "tiene", "causa").' },
  // Planning & process
  { kind: 'backlog', family: 'structured', label: 'Product backlog', es: 'Backlog de producto (épicas e historias)', icon: 'ListTree', group: 'Planning', course: 'T5 Épicas e historias · E3 · Entrega final', blurb: 'Every epic, broken down into user stories with Gherkin criteria — and the brief for generating the app with AI (vibe coding).' },
  { kind: 'up', family: 'structured', label: 'Unified Process plan', es: 'Proceso Unificado (fases y artefactos)', icon: 'Layers', group: 'Planning', course: 'T8 Proceso Unificado · E3', blurb: 'The four phases with their iterations and milestones, the disciplines\' effort curves, and the artefacts of each phase linked to your diagrams.' },
  { kind: 'storymap', family: 'structured', label: 'User story map', es: 'User Story Mapping', icon: 'Map', group: 'Planning', course: 'T5 Épicas e historias · Entrega final', blurb: 'Activities and steps across the top, user stories below, sliced into sprints — with Gherkin criteria.' },
  { kind: 'kanban', family: 'structured', label: 'Kanban board', es: 'Tablero Kanban', icon: 'SquareKanban', group: 'Planning', course: 'T10 Kanban y XP', blurb: 'Columns with WIP limits and cards for epics, stories, tasks and bugs.' },
  { kind: 'gantt', family: 'structured', label: 'Gantt chart', es: 'Diagrama de Gantt', icon: 'ChartGantt', group: 'Planning', course: 'T8 Proceso unificado · E3', blurb: 'Phases, tasks, milestones and dependencies on a timeline — the PUD plan.' },
  { kind: 'flowchart', family: 'graph', label: 'Process / flowchart', es: 'Diagrama de flujo / modelo de proceso', icon: 'GitBranch', group: 'Planning', course: 'T7 Modelos y metodologías · E3', blurb: 'A plain flowchart: life-cycle models (cascada, espiral, iterativo) or your own development model.' },
  // Architecture
  { kind: 'architecture', family: 'graph', label: 'Infrastructure diagram', es: 'Diagrama de arquitectura / equipos', icon: 'Server', group: 'Architecture', course: 'T2 TCO · E1', blurb: 'Every machine and service of a solution (local or cloud) as icons in zones — the picture behind a TCO.' }
];

export const GROUP_ORDER: KindInfo['group'][] = ['Company', 'UML', 'Requirements', 'Design thinking', 'Planning', 'Architecture'];

/** Each group's colour token (app.css) and its short name, for badges, chips and filters. */
export const FAMILIES: Record<KindInfo['group'], { key: string; color: string; label: string }> = {
  Company: { key: 'company', color: 'var(--fam-company)', label: 'Company' },
  UML: { key: 'uml', color: 'var(--fam-uml)', label: 'UML' },
  Requirements: { key: 'req', color: 'var(--fam-req)', label: 'Requirements' },
  'Design thinking': { key: 'dt', color: 'var(--fam-dt)', label: 'Design thinking' },
  Planning: { key: 'plan', color: 'var(--fam-plan)', label: 'Planning' },
  Architecture: { key: 'arch', color: 'var(--fam-arch)', label: 'Architecture' }
};

/** What people call each kind in class, short enough for a chip ("Casos de uso", "Gantt"). */
const SHORT_ES: Partial<Record<DiagramKind, string>> = {
  orgchart: 'Organigrama',
  tco: 'TCO',
  minutes: 'Acta',
  canvas: 'Modelo de negocio',
  usecase: 'Casos de uso',
  class: 'Clases',
  sequence: 'Secuencia',
  communication: 'Comunicación',
  activity: 'Actividad',
  state: 'Estados',
  deployment: 'Despliegue',
  er: 'Entidad / relación',
  dfd: 'DFD',
  screenflow: 'Pantallas',
  traceability: 'Trazabilidad',
  stakeholder: 'Stakeholders',
  vision: 'Visión',
  mindmap: 'Mapa mental',
  context: 'Mapa de contexto',
  persona: 'Persona',
  journey: 'Customer journey',
  empathy: 'Mapa de empatía',
  brainstorm: 'Brainstorming',
  crazy8: 'Crazy eight',
  sixhats: '6 sombreros',
  conceptmap: 'Mapa conceptual',
  backlog: 'Backlog',
  up: 'Proceso Unificado',
  storymap: 'Story map',
  kanban: 'Kanban',
  gantt: 'Gantt',
  flowchart: 'Diagrama de flujo',
  architecture: 'Arquitectura'
};

export function shortName(kind: DiagramKind): string {
  return SHORT_ES[kind] ?? kindInfo(kind).es;
}

export function familyOf(kind: DiagramKind) {
  return FAMILIES[kindInfo(kind).group];
}

export function kindInfo(kind: DiagramKind): KindInfo {
  return KINDS.find((k) => k.kind === kind)!;
}

export function isGraphKind(kind: DiagramKind): kind is GraphKind {
  return kindInfo(kind).family === 'graph';
}

/* ---------------------------------------------------------------- palettes */

/** How a node type is drawn (editors/graph/GraphNode.svelte switches on this). */
export type Shape =
  | 'actor'
  | 'ellipse'
  | 'container'
  | 'note'
  | 'class'
  | 'package'
  | 'initial'
  | 'final'
  | 'flowFinal'
  | 'action'
  | 'diamond'
  | 'bar'
  | 'rect'
  | 'swimlane'
  | 'state'
  | 'history'
  | 'object'
  | 'box3d'
  | 'artifact'
  | 'component'
  | 'cylinder'
  | 'lollipop'
  | 'device'
  | 'zone'
  | 'terminator'
  | 'parallelogram'
  | 'document'
  | 'subprocess'
  | 'central'
  | 'topic'
  | 'concept'
  | 'entity'
  | 'weakEntity'
  | 'attribute'
  | 'relationship'
  | 'process'
  | 'external'
  | 'datastore'
  | 'screen'
  | 'trace'
  | 'role';

export interface NodeTypeInfo {
  type: string;
  label: string;
  es: string;
  shape: Shape;
  /** Text a new node of this type starts with. */
  defaultLabel: string;
  stereotype?: string;
  /** Lucide icon for the palette button. */
  icon: string;
  /** Holds other nodes (drawn behind, drags what's inside it, resizable). */
  container?: boolean;
  /** Can be resized by hand (containers are always). */
  resizable?: boolean;
  /** Starting size for resizable nodes. */
  size?: { w: number; h: number };
  /** Architecture presets: the icon a new device gets. */
  presetIcon?: string;
  /** Hidden from the palette (e.g. the mind map's root is made once). */
  hidden?: boolean;
  /** Traceability: the column this type sits in (0 = left). Tidy lays columns out left to right. */
  column?: number;
  /** Fixed tint for the type (traceability columns). */
  tint?: string;
}

export type EndMark = 'none' | 'arrow' | 'filled' | 'triangle' | 'diamond' | 'filledDiamond';

export interface EdgeTypeInfo {
  type: string;
  label: string;
  es: string;
  dashed?: boolean;
  /** Mark at the target end. */
  end: EndMark;
  /** Mark at the source end (aggregation / composition diamonds sit on the whole). */
  start?: EndMark;
  /** Fixed text drawn on the line («include», «deploy»). */
  stereotype?: string;
  /** Shows the multiplicity / role fields in the inspector. */
  ends?: boolean;
  /** Shows the numbered messages list (communication diagrams). */
  messages?: boolean;
}

export interface Palette {
  nodes: NodeTypeInfo[];
  edges: EdgeTypeInfo[];
  /** Edge type a new connection gets. */
  defaultEdge: string;
  /** Laid out automatically (mind map) instead of placed by hand. */
  autoLayout?: boolean;
}

const note: NodeTypeInfo = { type: 'note', label: 'Note', es: 'Nota', shape: 'note', defaultLabel: 'Nota', icon: 'StickyNote', resizable: true, size: { w: 160, h: 70 } };
const noteLink: EdgeTypeInfo = { type: 'noteLink', label: 'Note link', es: 'Anclaje de nota', dashed: true, end: 'none' };

export const PALETTES: Record<GraphKind, Palette> = {
  usecase: {
    defaultEdge: 'association',
    nodes: [
      { type: 'actor', label: 'Actor', es: 'Actor', shape: 'actor', defaultLabel: 'Actor', icon: 'PersonStanding' },
      { type: 'usecase', label: 'Use case', es: 'Caso de uso', shape: 'ellipse', defaultLabel: 'Caso de uso', icon: 'Circle' },
      { type: 'boundary', label: 'System boundary', es: 'Límite del sistema', shape: 'container', defaultLabel: 'Sistema', icon: 'Square', container: true, size: { w: 360, h: 420 } },
      note
    ],
    edges: [
      { type: 'association', label: 'Association', es: 'Asociación', end: 'none' },
      { type: 'include', label: 'Include', es: 'Inclusión', dashed: true, end: 'arrow', stereotype: 'include' },
      { type: 'extend', label: 'Extend', es: 'Extensión', dashed: true, end: 'arrow', stereotype: 'extend' },
      { type: 'generalization', label: 'Generalisation', es: 'Generalización', end: 'triangle' },
      noteLink
    ]
  },
  class: {
    defaultEdge: 'association',
    nodes: [
      { type: 'class', label: 'Class', es: 'Clase', shape: 'class', defaultLabel: 'Clase', icon: 'RectangleHorizontal' },
      { type: 'interface', label: 'Interface', es: 'Interfaz', shape: 'class', defaultLabel: 'Interfaz', stereotype: 'interface', icon: 'Plug' },
      { type: 'enum', label: 'Enumeration', es: 'Enumeración', shape: 'class', defaultLabel: 'Enumeracion', stereotype: 'enumeration', icon: 'ListOrdered' },
      { type: 'package', label: 'Package', es: 'Paquete', shape: 'package', defaultLabel: 'paquete', icon: 'Folder', container: true, size: { w: 420, h: 300 } },
      note
    ],
    edges: [
      { type: 'association', label: 'Association', es: 'Asociación', end: 'none', ends: true },
      { type: 'directed', label: 'Directed association', es: 'Asociación dirigida', end: 'arrow', ends: true },
      { type: 'aggregation', label: 'Aggregation', es: 'Agregación', end: 'none', start: 'diamond', ends: true },
      { type: 'composition', label: 'Composition', es: 'Composición', end: 'none', start: 'filledDiamond', ends: true },
      { type: 'generalization', label: 'Inheritance', es: 'Herencia / generalización', end: 'triangle' },
      { type: 'realization', label: 'Realisation', es: 'Realización', dashed: true, end: 'triangle' },
      { type: 'dependency', label: 'Dependency', es: 'Dependencia', dashed: true, end: 'arrow' },
      noteLink
    ]
  },
  activity: {
    defaultEdge: 'flow',
    nodes: [
      { type: 'initial', label: 'Initial node', es: 'Nodo inicial', shape: 'initial', defaultLabel: '', icon: 'CircleDot' },
      { type: 'action', label: 'Action', es: 'Acción', shape: 'action', defaultLabel: 'Acción', icon: 'RectangleHorizontal' },
      { type: 'decision', label: 'Decision / merge', es: 'Decisión / fusión', shape: 'diamond', defaultLabel: '', icon: 'Diamond' },
      { type: 'fork', label: 'Fork / join', es: 'Bifurcación / unión', shape: 'bar', defaultLabel: '', icon: 'Minus', resizable: true, size: { w: 160, h: 8 } },
      { type: 'object', label: 'Object node', es: 'Nodo objeto', shape: 'rect', defaultLabel: 'Objeto', icon: 'Square' },
      { type: 'final', label: 'Activity final', es: 'Nodo final', shape: 'final', defaultLabel: '', icon: 'CircleStop' },
      { type: 'flowFinal', label: 'Flow final', es: 'Fin de flujo', shape: 'flowFinal', defaultLabel: '', icon: 'CircleX' },
      { type: 'partition', label: 'Swimlane', es: 'Calle (partición)', shape: 'swimlane', defaultLabel: 'Calle', icon: 'Columns2', container: true, size: { w: 260, h: 520 } },
      note
    ],
    edges: [{ type: 'flow', label: 'Control flow', es: 'Flujo de control', end: 'filled' }, { type: 'objectFlow', label: 'Object flow', es: 'Flujo de objetos', dashed: true, end: 'filled' }, noteLink]
  },
  state: {
    defaultEdge: 'transition',
    nodes: [
      { type: 'initial', label: 'Initial state', es: 'Estado inicial', shape: 'initial', defaultLabel: '', icon: 'CircleDot' },
      { type: 'state', label: 'State', es: 'Estado', shape: 'state', defaultLabel: 'Estado', icon: 'RectangleHorizontal' },
      { type: 'composite', label: 'Composite state', es: 'Estado compuesto', shape: 'container', defaultLabel: 'Estado compuesto', icon: 'SquareDashed', container: true, size: { w: 360, h: 240 } },
      { type: 'choice', label: 'Choice', es: 'Elección', shape: 'diamond', defaultLabel: '', icon: 'Diamond' },
      { type: 'history', label: 'History', es: 'Historia', shape: 'history', defaultLabel: 'H', icon: 'History' },
      { type: 'final', label: 'Final state', es: 'Estado final', shape: 'final', defaultLabel: '', icon: 'CircleStop' },
      note
    ],
    edges: [{ type: 'transition', label: 'Transition', es: 'Transición', end: 'filled' }, noteLink]
  },
  communication: {
    defaultEdge: 'link',
    nodes: [
      { type: 'actor', label: 'Actor', es: 'Actor', shape: 'actor', defaultLabel: 'Actor', icon: 'PersonStanding' },
      { type: 'object', label: 'Object', es: 'Objeto', shape: 'object', defaultLabel: 'objeto:Clase', icon: 'Square' },
      note
    ],
    edges: [{ type: 'link', label: 'Link', es: 'Enlace', end: 'none', messages: true }, noteLink]
  },
  deployment: {
    defaultEdge: 'path',
    nodes: [
      { type: 'node', label: 'Node', es: 'Nodo', shape: 'box3d', defaultLabel: 'Servidor', icon: 'Box', container: true, size: { w: 300, h: 200 } },
      { type: 'device', label: 'Device', es: 'Dispositivo', shape: 'box3d', defaultLabel: 'PC', stereotype: 'device', icon: 'Monitor', container: true, size: { w: 260, h: 170 } },
      { type: 'execEnv', label: 'Execution environment', es: 'Entorno de ejecución', shape: 'box3d', defaultLabel: 'JVM', stereotype: 'executionEnvironment', icon: 'Cpu', container: true, size: { w: 240, h: 150 } },
      { type: 'artifact', label: 'Artifact', es: 'Artefacto', shape: 'artifact', defaultLabel: 'app.jar', stereotype: 'artifact', icon: 'FileCode' },
      { type: 'component', label: 'Component', es: 'Componente', shape: 'component', defaultLabel: 'Componente', icon: 'Puzzle' },
      { type: 'interface', label: 'Provided interface', es: 'Interfaz ofrecida', shape: 'lollipop', defaultLabel: 'IInterfaz', icon: 'CircleDot' },
      { type: 'database', label: 'Database', es: 'Base de datos', shape: 'cylinder', defaultLabel: 'BD', icon: 'Database' },
      note
    ],
    edges: [
      { type: 'path', label: 'Communication path', es: 'Ruta de comunicación', end: 'none' },
      { type: 'dependency', label: 'Dependency', es: 'Dependencia', dashed: true, end: 'arrow' },
      { type: 'deploy', label: 'Deploy', es: 'Despliegue', dashed: true, end: 'arrow', stereotype: 'deploy' },
      { type: 'realization', label: 'Realisation', es: 'Realización', dashed: true, end: 'triangle' },
      noteLink
    ]
  },
  architecture: {
    defaultEdge: 'wired',
    nodes: [
      { type: 'device', label: 'Server', es: 'Servidor', shape: 'device', defaultLabel: 'Servidor', icon: 'Server', presetIcon: 'Server' },
      { type: 'device', label: 'Desktop PC', es: 'PC de sobremesa', shape: 'device', defaultLabel: 'PC', icon: 'Monitor', presetIcon: 'Monitor' },
      { type: 'device', label: 'Laptop', es: 'Portátil', shape: 'device', defaultLabel: 'Portátil', icon: 'Laptop', presetIcon: 'Laptop' },
      { type: 'device', label: 'Tablet', es: 'Tablet', shape: 'device', defaultLabel: 'Tablet', icon: 'Tablet', presetIcon: 'Tablet' },
      { type: 'device', label: 'Phone', es: 'Móvil', shape: 'device', defaultLabel: 'Móvil', icon: 'Smartphone', presetIcon: 'Smartphone' },
      { type: 'device', label: 'Point of sale', es: 'TPV', shape: 'device', defaultLabel: 'TPV', icon: 'CreditCard', presetIcon: 'CreditCard' },
      { type: 'device', label: 'Printer', es: 'Impresora', shape: 'device', defaultLabel: 'Impresora', icon: 'Printer', presetIcon: 'Printer' },
      { type: 'device', label: 'Router', es: 'Router', shape: 'device', defaultLabel: 'Router', icon: 'Router', presetIcon: 'Router' },
      { type: 'device', label: 'Switch', es: 'Switch', shape: 'device', defaultLabel: 'Switch', icon: 'Network', presetIcon: 'Network' },
      { type: 'device', label: 'Wi-Fi access point', es: 'Punto de acceso Wi-Fi', shape: 'device', defaultLabel: 'AP Wi-Fi', icon: 'Wifi', presetIcon: 'Wifi' },
      { type: 'device', label: 'Firewall', es: 'Cortafuegos', shape: 'device', defaultLabel: 'Firewall', icon: 'Shield', presetIcon: 'Shield' },
      { type: 'device', label: 'NAS / backup', es: 'NAS / copias', shape: 'device', defaultLabel: 'NAS', icon: 'HardDrive', presetIcon: 'HardDrive' },
      { type: 'device', label: 'UPS', es: 'SAI', shape: 'device', defaultLabel: 'SAI', icon: 'BatteryCharging', presetIcon: 'BatteryCharging' },
      { type: 'device', label: 'Database', es: 'Base de datos', shape: 'device', defaultLabel: 'Base de datos', icon: 'Database', presetIcon: 'Database' },
      { type: 'device', label: 'Cloud service', es: 'Servicio en la nube', shape: 'device', defaultLabel: 'Servicio cloud', icon: 'Cloud', presetIcon: 'Cloud' },
      { type: 'device', label: 'Internet', es: 'Internet', shape: 'device', defaultLabel: 'Internet', icon: 'Globe', presetIcon: 'Globe' },
      { type: 'device', label: 'Users', es: 'Usuarios', shape: 'device', defaultLabel: 'Usuarios', icon: 'Users', presetIcon: 'Users' },
      { type: 'zone', label: 'Zone', es: 'Zona / red', shape: 'zone', defaultLabel: 'Zona', icon: 'SquareDashed', container: true, size: { w: 420, h: 280 } },
      note
    ],
    edges: [
      { type: 'wired', label: 'Wired', es: 'Cable', end: 'none' },
      { type: 'wireless', label: 'Wireless / VPN', es: 'Inalámbrica / VPN', dashed: true, end: 'none' },
      { type: 'flow', label: 'Data flow', es: 'Flujo de datos', end: 'filled' },
      noteLink
    ]
  },
  flowchart: {
    defaultEdge: 'flow',
    nodes: [
      { type: 'terminator', label: 'Start / end', es: 'Inicio / fin', shape: 'terminator', defaultLabel: 'Inicio', icon: 'Pill' },
      { type: 'process', label: 'Process', es: 'Proceso', shape: 'rect', defaultLabel: 'Proceso', icon: 'Square' },
      { type: 'decision', label: 'Decision', es: 'Decisión', shape: 'diamond', defaultLabel: '¿?', icon: 'Diamond' },
      { type: 'io', label: 'Input / output', es: 'Entrada / salida', shape: 'parallelogram', defaultLabel: 'Datos', icon: 'Slash' },
      { type: 'document', label: 'Document', es: 'Documento', shape: 'document', defaultLabel: 'Documento', icon: 'FileText' },
      { type: 'subprocess', label: 'Subprocess', es: 'Subproceso', shape: 'subprocess', defaultLabel: 'Subproceso', icon: 'SquareSplitHorizontal' },
      { type: 'store', label: 'Data store', es: 'Almacén de datos', shape: 'cylinder', defaultLabel: 'Datos', icon: 'Database' },
      { type: 'lane', label: 'Phase / lane', es: 'Fase / calle', shape: 'swimlane', defaultLabel: 'Fase', icon: 'Columns2', container: true, size: { w: 260, h: 480 } },
      note
    ],
    edges: [{ type: 'flow', label: 'Flow', es: 'Flujo', end: 'filled' }, { type: 'feedback', label: 'Feedback / iteration', es: 'Retroalimentación', dashed: true, end: 'filled' }, noteLink]
  },
  er: {
    defaultEdge: 'line',
    nodes: [
      { type: 'entity', label: 'Entity', es: 'Entidad', shape: 'entity', defaultLabel: 'Entidad', icon: 'Square' },
      { type: 'weakEntity', label: 'Weak entity', es: 'Entidad débil', shape: 'weakEntity', defaultLabel: 'Entidad débil', icon: 'SquareSquare' },
      { type: 'attribute', label: 'Attribute', es: 'Atributo', shape: 'attribute', defaultLabel: 'atributo', icon: 'Circle' },
      { type: 'key', label: 'Key attribute', es: 'Atributo clave', shape: 'attribute', defaultLabel: 'id', icon: 'KeyRound' },
      { type: 'multivalued', label: 'Multivalued attribute', es: 'Atributo multivaluado', shape: 'attribute', defaultLabel: 'telefonos', icon: 'CircleDot' },
      { type: 'derived', label: 'Derived attribute', es: 'Atributo derivado', shape: 'attribute', defaultLabel: 'edad', icon: 'CircleDashed' },
      { type: 'relationship', label: 'Relationship', es: 'Relación', shape: 'relationship', defaultLabel: 'relación', icon: 'Diamond' },
      { type: 'identifying', label: 'Identifying relationship', es: 'Relación identificativa (débil)', shape: 'relationship', defaultLabel: 'tiene', icon: 'Gem' },
      note
    ],
    edges: [
      { type: 'line', label: 'Line (cardinality)', es: 'Línea (cardinalidad)', end: 'none', ends: true },
      { type: 'total', label: 'Total participation', es: 'Participación total', end: 'none', ends: true },
      { type: 'isa', label: 'IS-A (specialisation)', es: 'Especialización (ES-UN)', end: 'triangle' }
    ]
  },
  dfd: {
    defaultEdge: 'flow',
    nodes: [
      { type: 'external', label: 'External entity', es: 'Entidad externa', shape: 'external', defaultLabel: 'Usuario', icon: 'Square' },
      { type: 'process', label: 'Process', es: 'Proceso', shape: 'process', defaultLabel: '1 Proceso', icon: 'Circle' },
      { type: 'store', label: 'Data store', es: 'Almacén de datos', shape: 'datastore', defaultLabel: 'D1 Almacén', icon: 'Database' },
      { type: 'system', label: 'System (context diagram)', es: 'Sistema (diagrama de contexto)', shape: 'process', defaultLabel: '0 Sistema', icon: 'CircleDot' },
      note
    ],
    edges: [{ type: 'flow', label: 'Data flow', es: 'Flujo de datos', end: 'filled' }, { type: 'both', label: 'Two-way flow', es: 'Flujo bidireccional', end: 'filled', start: 'filled' }]
  },
  screenflow: {
    defaultEdge: 'go',
    nodes: [
      { type: 'screen', label: 'Screen', es: 'Pantalla', shape: 'screen', defaultLabel: 'Pantalla', icon: 'AppWindow', resizable: true, size: { w: 200, h: 150 } },
      { type: 'dialog', label: 'Message / dialog', es: 'Aviso / diálogo', shape: 'screen', defaultLabel: 'Aviso', stereotype: 'aviso', icon: 'MessageSquareWarning', resizable: true, size: { w: 170, h: 110 } },
      note
    ],
    edges: [{ type: 'go', label: 'Goes to', es: 'Navega a', end: 'filled' }, { type: 'error', label: 'On error', es: 'En caso de error', dashed: true, end: 'filled' }]
  },
  traceability: {
    defaultEdge: 'trace',
    nodes: [
      { type: 'req', label: 'Requirement', es: 'Requisito', shape: 'trace', defaultLabel: 'RQ1', icon: 'FileCheck', column: 0, tint: '#4a7fc1' },
      { type: 'criterion', label: 'Acceptance criterion', es: 'Criterio de aceptación', shape: 'trace', defaultLabel: 'CA1.1', icon: 'ListChecks', column: 0, tint: '#3a9e9a' },
      { type: 'design', label: 'Design element', es: 'Elemento de diseño', shape: 'trace', defaultLabel: 'ED1', icon: 'PenTool', column: 1, tint: '#58a55c' },
      { type: 'component', label: 'Software component', es: 'Componente software', shape: 'trace', defaultLabel: 'CS1', icon: 'Puzzle', column: 2, tint: '#e8873a' },
      { type: 'test', label: 'Test case', es: 'Caso de prueba', shape: 'trace', defaultLabel: 'TC1', icon: 'FlaskConical', column: 3, tint: '#d9534f' },
      note
    ],
    edges: [{ type: 'trace', label: 'Traces to', es: 'Se traza a', end: 'filled' }, { type: 'refines', label: 'Refined by', es: 'Se detalla en', end: 'none' }]
  },
  orgchart: {
    defaultEdge: 'reports',
    nodes: [
      { type: 'role', label: 'Role', es: 'Rol', shape: 'role', defaultLabel: 'Rol', icon: 'UserRound' },
      { type: 'unit', label: 'Area / team', es: 'Área / equipo', shape: 'zone', defaultLabel: 'Área', icon: 'Square', container: true, size: { w: 420, h: 260 } },
      note
    ],
    edges: [
      { type: 'reports', label: 'Reports to', es: 'Depende de', end: 'none' },
      { type: 'collab', label: 'Works with', es: 'Colabora con', dashed: true, end: 'none' },
      noteLink
    ]
  },
  mindmap: {
    defaultEdge: 'crosslink',
    autoLayout: true,
    nodes: [
      { type: 'central', label: 'Central idea', es: 'Idea central', shape: 'central', defaultLabel: 'Idea central', icon: 'Sun', hidden: true },
      { type: 'topic', label: 'Branch', es: 'Rama', shape: 'topic', defaultLabel: 'Rama', icon: 'GitFork' },
      note
    ],
    edges: [{ type: 'crosslink', label: 'Cross-link', es: 'Enlace cruzado', dashed: true, end: 'arrow' }]
  },
  conceptmap: {
    defaultEdge: 'relation',
    nodes: [{ type: 'concept', label: 'Concept', es: 'Concepto', shape: 'concept', defaultLabel: 'Concepto', icon: 'RectangleHorizontal' }, note],
    edges: [{ type: 'relation', label: 'Relation', es: 'Relación', end: 'filled' }, { type: 'plain', label: 'Line', es: 'Línea', end: 'none' }]
  }
};

export function nodeTypeInfo(kind: GraphKind, type: string, icon?: string): NodeTypeInfo {
  const p = PALETTES[kind].nodes;
  return (icon && p.find((n) => n.type === type && n.presetIcon === icon)) || p.find((n) => n.type === type) || note;
}

export function edgeTypeInfo(kind: GraphKind, type: string): EdgeTypeInfo {
  const p = PALETTES[kind].edges;
  return p.find((e) => e.type === type) ?? p[0];
}
