/**
 * Creating, validating and normalising diagrams. No Svelte here, so the
 * node tests can import it.
 */
import { FORMAT, type DataByKind, type Diagram, type DiagramKind, type DiagramMeta, type UpData, type UpDiscipline, type UpPhase, type UseCaseSpec, type UserStory } from './types';
import { KINDS } from './kinds';

export function uid(): string {
  return (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`).replace(/-/g, '').slice(0, 12);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Empty data for each kind. Every field present, so editors never meet `undefined`. */
export function blankData<K extends DiagramKind>(kind: K): DataByKind[K] {
  const graph = { nodes: [], edges: [], routing: 'orthogonal' as const };
  const all: { [P in DiagramKind]: () => DataByKind[P] } = {
    usecase: () => ({ ...graph, nodes: [], edges: [] }),
    class: () => ({ ...graph, nodes: [], edges: [] }),
    activity: () => ({ ...graph, nodes: [], edges: [] }),
    state: () => ({ ...graph, nodes: [], edges: [] }),
    communication: () => ({ ...graph, nodes: [], edges: [], routing: 'straight' }),
    deployment: () => ({ ...graph, nodes: [], edges: [] }),
    architecture: () => ({ ...graph, nodes: [], edges: [] }),
    flowchart: () => ({ ...graph, nodes: [], edges: [] }),
    er: () => ({ ...graph, nodes: [], edges: [], routing: 'straight' }),
    dfd: () => ({ ...graph, nodes: [], edges: [], routing: 'straight' }),
    screenflow: () => ({ ...graph, nodes: [], edges: [] }),
    traceability: () => ({ ...graph, nodes: [], edges: [], routing: 'straight' }),
    mindmap: () => ({ nodes: [{ id: uid(), type: 'central', x: 0, y: 0, label: 'Idea central' }], edges: [], routing: 'straight' }),
    conceptmap: () => ({ ...graph, nodes: [], edges: [], routing: 'straight' }),
    orgchart: () => ({ ...graph, nodes: [], edges: [] }),
    sequence: () => ({ participants: [], items: [], activations: true, autonumber: false }),
    gantt: () => ({ tasks: [], scale: 'week', showWeekends: true }),
    storymap: () => ({ persona: '', activities: [], releases: [{ id: uid(), name: 'Sprint 1' }, { id: uid(), name: 'Sprint 2' }], stories: [] }),
    kanban: () => ({
      columns: [
        { id: uid(), name: 'Backlog', wip: 0 },
        { id: uid(), name: 'Por hacer', wip: 0 },
        { id: uid(), name: 'En curso', wip: 3 },
        { id: uid(), name: 'En revisión', wip: 2 },
        { id: uid(), name: 'Hecho', wip: 0 }
      ],
      cards: []
    }),
    stakeholder: () => ({ stakeholders: [], view: 'grid', product: '' }),
    journey: () => ({
      persona: '',
      scenario: '',
      stages: ['Descubrir', 'Decidir', 'Usar', 'Después'].map((name) => ({ id: uid(), name })),
      rows: ['Acciones', 'Puntos de contacto', 'Piensa y siente', 'Pains', 'Oportunidades'].map((name) => ({ id: uid(), name })),
      cells: {},
      emotion: {},
      moments: []
    }),
    empathy: () => ({ subject: '', sections: {} }),
    canvas: () => ({ subject: '', sections: {} }),
    context: () => ({ subject: '', sections: {} }),
    persona: () => ({ subject: '', sections: {} }),
    brainstorm: () => ({ subject: '', sections: {} }),
    crazy8: () => ({ subject: '', sections: {} }),
    sixhats: () => ({ subject: '', sections: {} }),
    vision: () => ({ forWho: '', who: '', product: '', isA: '', that: '', unlike: '', ourProduct: '' }),
    tco: () => ({
      years: 3,
      users: 0,
      alternatives: [
        { id: uid(), name: 'Local (on-premises)', description: '', lines: [] },
        { id: uid(), name: 'Nube', description: '', lines: [] }
      ],
      criteria: [],
      scores: {},
      recommendation: ''
    }),
    backlog: () => ({ product: '', components: [], epics: [], ai: { context: '', stack: '', guardrails: '', glossary: '', outOfScope: '', process: '' } }),
    minutes: () => ({
      type: 'client',
      number: '',
      date: new Date().toISOString().slice(0, 10),
      start: '',
      end: '',
      place: '',
      attendees: [],
      agenda: [],
      discussion: '',
      decisions: [],
      actions: [],
      questions: [],
      review: [],
      next: ''
    }),
    up: () => blankUp()
  };
  return all[kind]() as DataByKind[K];
}

/** The four UP phases and the usual disciplines, with the textbook effort curves. */
export function blankUp(): UpData {
  const phases: UpPhase[] = [
    { name: 'Inicio', goal: '¿Merece la pena? Alcance, visión y viabilidad.', milestone: 'Objetivos del ciclo de vida', iterations: ['I1'] },
    { name: 'Elaboración', goal: 'Estabilizar los requisitos y la arquitectura.', milestone: 'Arquitectura del ciclo de vida', iterations: ['E1', 'E2'] },
    { name: 'Construcción', goal: 'Construir el sistema por iteraciones.', milestone: 'Capacidad operativa inicial', iterations: ['C1', 'C2', 'C3'] },
    { name: 'Transición', goal: 'Entregarlo a los usuarios.', milestone: 'Entrega del producto', iterations: ['T1'] }
  ].map((p) => ({ id: uid(), ...p }));
  const disciplines: UpDiscipline[] = (
    [
      ['Modelado del negocio', [3, 2, 0, 0]],
      ['Requisitos', [3, 4, 1, 0]],
      ['Análisis y diseño', [1, 4, 2, 0]],
      ['Implementación', [0, 2, 4, 1]],
      ['Pruebas', [0, 1, 4, 2]],
      ['Despliegue', [0, 0, 1, 4]],
      ['Gestión de configuración y cambios', [1, 1, 2, 2]],
      ['Gestión del proyecto', [2, 2, 2, 2]],
      ['Entorno', [2, 2, 1, 1]]
    ] as [string, number[]][]
  ).map(([name, effort]) => ({ id: uid(), name, effort }));
  return { phases, disciplines, artifacts: [] };
}

export function blankSpec(): UseCaseSpec {
  return { code: '', primaryActor: '', secondaryActors: '', description: '', preconditions: '', trigger: '', mainFlow: '', alternativeFlows: '', postconditions: '', priority: '', frequency: '' };
}

export function blankStory(): UserStory {
  return { id: uid(), title: '', asA: '', iWant: '', soThat: '', gherkin: '', points: undefined, priority: '', epic: '' };
}

export function newDiagram<K extends DiagramKind>(kind: K, title: string, project = '', data?: DataByKind[K]): Diagram {
  const now = nowIso();
  return { format: FORMAT, id: uid(), kind, title: title.trim() || 'Sin título', project: project.trim(), notes: '', created: now, updated: now, data: data ?? blankData(kind) } as Diagram;
}

const KIND_SET = new Set(KINDS.map((k) => k.kind));

/** Problems that make a file unreadable as a diagram; empty when it's fine. */
export function validateDiagram(raw: unknown): string[] {
  const out: string[] = [];
  if (!raw || typeof raw !== 'object') return ['not an object'];
  const r = raw as Record<string, unknown>;
  if (r.format !== FORMAT) out.push(`format is ${JSON.stringify(r.format)}, expected ${FORMAT}`);
  if (typeof r.id !== 'string' || !r.id) out.push('missing id');
  if (typeof r.kind !== 'string' || !KIND_SET.has(r.kind as DiagramKind)) out.push(`unknown kind ${JSON.stringify(r.kind)}`);
  if (!r.data || typeof r.data !== 'object') out.push('missing data');
  return out;
}

/** Fill in anything missing (older files, hand edits) so editors can rely on every field. */
export function normalizeDiagram(raw: Diagram): Diagram {
  const blank = blankData(raw.kind) as unknown as Record<string, unknown>;
  const data = { ...blank, ...(raw.data as unknown as Record<string, unknown>) };
  // Arrays and maps that must exist even in a half-written file.
  for (const [k, v] of Object.entries(blank)) {
    if (Array.isArray(v) && !Array.isArray(data[k])) data[k] = [];
    if (v && typeof v === 'object' && !Array.isArray(v) && (typeof data[k] !== 'object' || data[k] === null)) data[k] = {};
  }
  if ('nodes' in data) {
    data.nodes = (data.nodes as Record<string, unknown>[]).filter((n) => n && typeof n.id === 'string').map((n) => ({ label: '', x: 0, y: 0, ...n }));
    const ids = new Set((data.nodes as { id: string }[]).map((n) => n.id));
    data.edges = (data.edges as { from: string; to: string }[]).filter((e) => e && ids.has(e.from) && ids.has(e.to));
  }
  return {
    ...raw,
    title: typeof raw.title === 'string' ? raw.title : 'Sin título',
    project: typeof raw.project === 'string' ? raw.project : '',
    notes: typeof raw.notes === 'string' ? raw.notes : '',
    created: raw.created || nowIso(),
    updated: raw.updated || nowIso(),
    data
  } as unknown as Diagram;
}

export function metaOf(d: Diagram, path: string): DiagramMeta {
  return { id: d.id, kind: d.kind, title: d.title, project: d.project, updated: d.updated, archived: d.archived, path };
}

/** "Mapa de stakeholders — Bodega" → "mapa-de-stakeholders-bodega" (for file names). */
export function slug(s: string, max = 40): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);
}
