/**
 * What each hand-in of the course project asks for (Enunciado Caso Práctico
 * 2026-27 V 2.0, "Distribución de las entregas", pp. 10–12), and which
 * diagrams of a project cover it. Pure, so it can be tested: the panel
 * (components/Deliverables.svelte) loads the project's diagrams and calls
 * `review`.
 *
 * A requirement ("need") is met by diagrams of the listed kinds; `check`
 * looks inside them for what the rubric's "completitud" would miss (a use
 * case without its specification, fewer than six stakeholders…).
 */
import type { Diagram, DiagramKind, DiagramOf, GraphData } from './types';

export type DeliverableId = 'E1' | 'E2' | 'E3' | 'Final';

export interface Need {
  id: string;
  /** What the hand-in asks for, in the brief's words. */
  label: string;
  kinds: DiagramKind[];
  /** How many diagrams of those kinds (two architectures: local and cloud). */
  min?: number;
  /** Not required ("si os reunís con el cliente"). */
  optional?: boolean;
  /** Title a diagram created from the checklist gets. */
  title: string;
  /** Problems found inside the matching diagrams; empty when complete. */
  check?: (docs: Diagram[]) => string[];
  /** Covered outside the app (the written report); shown as a reminder. */
  text?: boolean;
}

export interface Part {
  /** "TCO a 3 años". */
  label: string;
  /** Weight inside the hand-in, as written ("25 %"). */
  weight: string;
  needs: Need[];
}

export interface Deliverable {
  id: DeliverableId;
  title: string;
  /** One line on what it is. */
  blurb: string;
  parts: Part[];
}

/* ------------------------------------------------------------------ checks */

const of = <K extends DiagramKind>(docs: Diagram[], kind: K) => docs.filter((d) => d.kind === kind) as DiagramOf<K>[];
const nodes = (d: Diagram, type: string) => ((d.data as GraphData).nodes ?? []).filter((n) => n.type === type);
const filled = (s: string | undefined) => !!s && s.trim().length > 0;

function usecaseCheck(docs: Diagram[]): string[] {
  const out: string[] = [];
  for (const d of of(docs, 'usecase')) {
    const ucs = nodes(d, 'usecase');
    if (!nodes(d, 'actor').length) out.push(`"${d.title}": no actors`);
    if (!ucs.length) out.push(`"${d.title}": no use cases`);
    const bare = ucs.filter((n) => !filled(n.spec?.mainFlow));
    if (bare.length) out.push(`"${d.title}": ${bare.length} of ${ucs.length} use cases without a specification (main flow) — ${bare.slice(0, 3).map((n) => n.label).join(', ')}${bare.length > 3 ? '…' : ''}`);
  }
  return out;
}

function classCheck(docs: Diagram[]): string[] {
  const out: string[] = [];
  for (const d of of(docs, 'class')) {
    const cls = nodes(d, 'class');
    if (cls.length < 2) out.push(`"${d.title}": fewer than two classes`);
    const noOps = cls.filter((n) => !(n.ops ?? []).length);
    // Design classes (p. 8: "diagramas de clase de diseño") have operations, not just attributes.
    if (cls.length && noOps.length === cls.length) out.push(`"${d.title}": no class has operations — design classes need methods and types`);
  }
  return out;
}

function sequenceCheck(docs: Diagram[]): string[] {
  return of(docs, 'sequence')
    .filter((d) => d.data.items.filter((i) => i.t === 'msg').length < 2)
    .map((d) => `"${d.title}": fewer than two messages`);
}

function stakeholderCheck(docs: Diagram[]): string[] {
  const out: string[] = [];
  for (const d of of(docs, 'stakeholder')) {
    const n = d.data.stakeholders.length;
    if (n < 6) out.push(`"${d.title}": ${n} stakeholders — the brief asks for at least six`);
    const noRole = d.data.stakeholders.filter((s) => !filled(s.role)).length;
    if (noRole) out.push(`"${d.title}": ${noRole} without their role in the project`);
  }
  return out;
}

function visionCheck(docs: Diagram[]): string[] {
  return of(docs, 'vision').flatMap((d) => {
    const empty = Object.entries(d.data).filter(([, v]) => !filled(v as string)).length;
    return empty ? [`"${d.title}": ${empty} blanks of the elevator pitch still empty`] : [];
  });
}

function canvasCheck(docs: Diagram[]): string[] {
  return of(docs, 'canvas').flatMap((d) => {
    const empty = 9 - Object.values(d.data.sections).filter((s) => s.length).length;
    return empty > 0 ? [`"${d.title}": ${empty} of the nine blocks empty`] : [];
  });
}

function orgCheck(docs: Diagram[]): string[] {
  return of(docs, 'orgchart').flatMap((d) => {
    const roles = nodes(d, 'role');
    const out: string[] = [];
    if (roles.length < 4) out.push(`"${d.title}": ${roles.length} roles — one per member of the group at least`);
    const nobody = roles.filter((r) => !filled(r.person)).length;
    if (nobody) out.push(`"${d.title}": ${nobody} roles without a person`);
    return out;
  });
}

function architectureCheck(docs: Diagram[]): string[] {
  return [...of(docs, 'architecture'), ...of(docs, 'deployment')].filter((d) => (d.data as GraphData).nodes.length < 3).map((d) => `"${d.title}": almost empty`);
}

function tcoCheck(docs: Diagram[]): string[] {
  const out: string[] = [];
  for (const d of of(docs, 'tco')) {
    if (d.data.alternatives.length < 2) out.push(`"${d.title}": the client asks for two alternatives (local and cloud)`);
    for (const a of d.data.alternatives) {
      if (!a.lines.length) out.push(`"${d.title}": "${a.name}" has no cost lines`);
      const free = a.lines.filter((l) => !(l.unitCost > 0)).length;
      if (free) out.push(`"${d.title}": "${a.name}" has ${free} lines without a price`);
      const unsourced = a.lines.filter((l) => !filled(l.source)).length;
      if (unsourced) out.push(`"${d.title}": "${a.name}" has ${unsourced} lines without a source (market data)`);
      if (!filled(a.description)) out.push(`"${d.title}": "${a.name}" has no description of its architecture`);
    }
  }
  return out;
}

function recommendationCheck(docs: Diagram[]): string[] {
  return of(docs, 'tco').flatMap((d) => (filled(d.data.recommendation) ? [] : [`"${d.title}": no recommendation written`]));
}

function gherkinOk(g: string): boolean {
  return /escenario|scenario|ejemplo/i.test(g) && /\b(dado|dada|dados|dadas|given)\b/i.test(g) && /\b(cuando|when)\b/i.test(g) && /\b(entonces|then)\b/i.test(g);
}

function backlogEpicsCheck(docs: Diagram[]): string[] {
  const out: string[] = [];
  for (const d of of(docs, 'backlog')) {
    if (d.data.epics.length < 3) out.push(`"${d.title}": ${d.data.epics.length} epics — the backlog must be complete at epic level`);
    if (!d.data.epics.some((e) => e.stories.length)) out.push(`"${d.title}": no epic broken down into user stories yet (E3 asks for one)`);
    const vague = d.data.epics.flatMap((e) => e.stories).filter((s) => !filled(s.asA) || !filled(s.iWant) || !filled(s.soThat)).length;
    if (vague) out.push(`"${d.title}": ${vague} stories missing "Como / quiero / para"`);
  }
  return out;
}

function backlogFinalCheck(docs: Diagram[]): string[] {
  const out: string[] = [];
  for (const d of of(docs, 'backlog')) {
    const notBroken = d.data.epics.filter((e) => !e.stories.length);
    // The final asks for every epic of one component; say which components are complete.
    const comps = [...new Set(d.data.epics.map((e) => e.component.trim()).filter(Boolean))];
    const complete = comps.filter((c) => d.data.epics.filter((e) => e.component.trim() === c).every((e) => e.stories.length));
    if (comps.length && !complete.length) out.push(`"${d.title}": no component has all its epics in user stories`);
    else if (!comps.length && notBroken.length) out.push(`"${d.title}": ${notBroken.length} epics without stories (set a component on each epic to see which one is complete)`);
    const stories = d.data.epics.filter((e) => !comps.length || complete.includes(e.component.trim())).flatMap((e) => e.stories);
    const noG = stories.filter((s) => !gherkinOk(s.gherkin)).length;
    if (noG) out.push(`"${d.title}": ${noG} stories without complete Gherkin (Escenario / Dado / Cuando / Entonces)`);
    const ai = d.data.ai;
    const missing = (['context', 'stack', 'guardrails', 'process'] as const).filter((k) => !filled(ai[k]));
    if (missing.length) out.push(`"${d.title}": AI brief missing ${missing.join(', ')}`);
  }
  return out;
}

function storymapCheck(docs: Diagram[]): string[] {
  const out: string[] = [];
  for (const d of of(docs, 'storymap')) {
    const used = d.data.releases.filter((r) => d.data.stories.some((s) => s.releaseId === r.id));
    if (used.length < 2) out.push(`"${d.title}": stories in ${used.length} sprint(s) — the brief asks for the first two`);
    if (!d.data.activities.length) out.push(`"${d.title}": no backbone (activities)`);
  }
  return out;
}

function ganttCheck(docs: Diagram[]): string[] {
  const out: string[] = [];
  for (const d of of(docs, 'gantt')) {
    const groups = d.data.tasks.filter((t) => t.group).map((t) => t.name.toLowerCase());
    const phases = ['inicio', 'elaboraci', 'construcci', 'transici'].filter((p) => !groups.some((g) => g.includes(p)));
    if (phases.length) out.push(`"${d.title}": no group row for ${phases.length} UP phase(s) (Inicio, Elaboración, Construcción, Transición)`);
    if (!d.data.tasks.some((t) => t.milestone)) out.push(`"${d.title}": no milestones`);
  }
  return out;
}

function upCheck(docs: Diagram[]): string[] {
  const out: string[] = [];
  for (const d of of(docs, 'up')) {
    for (const p of d.data.phases) {
      const arts = d.data.artifacts.filter((a) => a.phaseId === p.id);
      if (!arts.length) out.push(`"${d.title}": ${p.name} has no artefacts`);
      else {
        // Drafts are fine for a hand-in in progress; an artefact not started is not.
        const todo = arts.filter((a) => a.status === 'todo').length;
        if (todo) out.push(`"${d.title}": ${p.name}: ${todo} of ${arts.length} artefacts not started`);
      }
    }
  }
  return out;
}

const minutesOf = (type: string) => (docs: Diagram[]) => of(docs, 'minutes').filter((d) => d.data.type === type);

function minutesCheck(type: string) {
  return (docs: Diagram[]): string[] => {
    const out: string[] = [];
    for (const d of minutesOf(type)(docs)) {
      if (!d.data.attendees.length) out.push(`"${d.title}": no attendees`);
      if (type === 'client' && !d.data.questions.length && !d.data.decisions.length) out.push(`"${d.title}": no questions or decisions recorded`);
      if (type === 'postmortem' || type === 'retro') {
        const areas = new Set(d.data.review.map((r) => r.area));
        if (!areas.has('team')) out.push(`"${d.title}": nothing about the team`);
        if (!areas.has('method')) out.push(`"${d.title}": nothing about the methodology`);
        if (type === 'retro' && !d.data.review.some((r) => r.kind === 'bad')) out.push(`"${d.title}": the brief asks for bien / mal / mejorable — nothing under "mal"`);
      }
    }
    return out;
  };
}

/* --------------------------------------------------------------- catalogue */

export const DELIVERABLES: Deliverable[] = [
  {
    id: 'E1',
    title: 'Entrega 1 — Empresa y TCO',
    blurb: 'Your company, and the two infrastructure alternatives the client asked for with their 3-year TCO.',
    parts: [
      {
        label: 'Definición de la empresa: nombre, marca, modelo de negocio y roles',
        weight: '25 %',
        needs: [
          { id: 'canvas', label: 'Modelo de negocio', kinds: ['canvas'], title: 'Modelo de negocio', check: canvasCheck },
          { id: 'org', label: 'Jerarquía y asignación de roles', kinds: ['orgchart'], title: 'Organigrama y roles', check: orgCheck },
          { id: 'brand', label: 'Nombre y marca (logo, lema) — in the written report', kinds: [], title: '', text: true }
        ]
      },
      {
        label: 'Descripción completa de las dos alternativas, con su arquitectura',
        weight: '25 %',
        needs: [{ id: 'arch', label: 'Diagrama de cada alternativa (local y nube)', kinds: ['architecture', 'deployment'], min: 2, title: 'Arquitectura', check: architectureCheck }]
      },
      {
        label: 'TCO a 3 años con costes completos y realistas de cada alternativa',
        weight: '25 %',
        needs: [{ id: 'tco', label: 'TCO de las dos alternativas', kinds: ['tco'], title: 'TCO a 3 años', check: tcoCheck }]
      },
      {
        label: 'Recomendación razonada de la alternativa más adecuada',
        weight: '25 %',
        needs: [{ id: 'reco', label: 'Recomendación (en el TCO)', kinds: ['tco'], title: 'TCO a 3 años', check: recommendationCheck }]
      }
    ]
  },
  {
    id: 'E2',
    title: 'Entrega 2 — UML, stakeholders y visión',
    blurb: 'All the UML diagrams with use case specifications, the stakeholder map and the elevator pitch.',
    parts: [
      {
        label: 'Todos los diagramas UML: casos de uso con especificaciones, clases y secuencia',
        weight: '60 %',
        needs: [
          { id: 'uc', label: 'Casos de uso con especificaciones', kinds: ['usecase'], title: 'Casos de uso', check: usecaseCheck },
          { id: 'class', label: 'Diagrama de clases (de diseño)', kinds: ['class'], title: 'Diagrama de clases', check: classCheck },
          { id: 'seq', label: 'Diagramas de secuencia', kinds: ['sequence'], title: 'Diagrama de secuencia', check: sequenceCheck }
        ]
      },
      {
        label: 'Mapa de stakeholders (uno de los dos formatos, mínimo seis)',
        weight: '20 %',
        needs: [{ id: 'stk', label: 'Mapa de stakeholders', kinds: ['stakeholder'], title: 'Mapa de stakeholders', check: stakeholderCheck }]
      },
      {
        label: 'Visión del proyecto según el modelo del "elevator pitch"',
        weight: '20 %',
        needs: [{ id: 'vision', label: 'Elevator pitch', kinds: ['vision'], title: 'Visión — elevator pitch', check: visionCheck }]
      }
    ]
  },
  {
    id: 'E3',
    title: 'Entrega 3 — Modelo propio, backlog y PUD',
    blurb: 'Your own development model, the epic-level backlog with one epic in stories, and the Unified Process plan.',
    parts: [
      {
        label: 'Vuestro propio modelo de desarrollo: nombre, etapas, roles, elementos clave, ventajas e inconvenientes',
        weight: '30 %',
        needs: [
          { id: 'model', label: 'Diagrama del modelo (etapas y flujo)', kinds: ['flowchart', 'activity'], title: 'Modelo de desarrollo propio' },
          { id: 'modeltext', label: 'Descripción, roles, ventajas / inconvenientes y dónde usarlo — in the written report', kinds: [], title: '', text: true }
        ]
      },
      {
        label: 'Backlog completo a nivel de épica, y una épica en historias de usuario',
        weight: '20 %',
        needs: [{ id: 'backlog', label: 'Backlog de producto', kinds: ['backlog'], title: 'Backlog de producto', check: backlogEpicsCheck }]
      },
      {
        label: 'PUD: Gantt, etapas con sus artefactos, actas e informe',
        weight: '50 %',
        needs: [
          { id: 'gantt', label: 'Planificación (Gantt)', kinds: ['gantt'], title: 'Planificación PUD', check: ganttCheck },
          { id: 'up', label: 'Las cuatro fases con sus artefactos', kinds: ['up'], title: 'Proceso Unificado', check: upCheck },
          { id: 'client', label: 'Actas de reuniones con el cliente (si las hubo)', kinds: ['minutes'], optional: true, title: 'Acta reunión con el cliente', check: minutesCheck('client') },
          { id: 'report', label: 'Informe con toda la documentación — the memoria this checklist exports, plus your text', kinds: [], title: '', text: true }
        ]
      }
    ]
  },
  {
    id: 'Final',
    title: 'Entrega final',
    blurb: 'The previous hand-ins corrected, plus post mortem, the agile report, the story map and every epic of one component in stories with Gherkin and the AI material.',
    parts: [
      {
        label: 'Elementos previos corregidos',
        weight: '30 %',
        needs: [{ id: 'prev', label: 'E1, E2 and E3 complete — see their tabs', kinds: [], title: '', text: true }]
      },
      {
        label: 'Acta post mortem: qué ha funcionado y qué mejoraríais (equipo y PUD)',
        weight: '10 %',
        needs: [{ id: 'pm', label: 'Acta post mortem', kinds: ['minutes'], title: 'Acta post mortem', check: minutesCheck('postmortem') }]
      },
      {
        label: 'Informe "¿y con metodología ágil?" y su acta (bien / mal / mejorable)',
        weight: '20 %',
        needs: [
          { id: 'retro', label: 'Acta: bien / mal / mejorable, equipo y metodología', kinds: ['minutes'], title: 'Acta retrospectiva ágil', check: minutesCheck('retro') },
          { id: 'agile', label: 'Informe: qué habría cambiado con una metodología ágil — in the written report', kinds: [], title: '', text: true }
        ]
      },
      {
        label: 'User Story Mapping de los dos primeros sprints',
        weight: '10 %',
        needs: [{ id: 'usm', label: 'User Story Mapping', kinds: ['storymap'], title: 'User Story Mapping', check: storymapCheck }]
      },
      {
        label: 'Todas las épicas del componente en historias con Gherkin, y el material para generar y probar la app con IA',
        weight: '30 %',
        needs: [{ id: 'stories', label: 'Backlog con historias, Gherkin y brief para IA', kinds: ['backlog'], title: 'Backlog de producto', check: backlogFinalCheck }]
      }
    ]
  }
];

/* ------------------------------------------------------------------ review */

export type NeedState = 'done' | 'partial' | 'missing' | 'text';

export interface NeedReview {
  need: Need;
  state: NeedState;
  /** Diagrams that count for it. */
  docs: Diagram[];
  problems: string[];
}

/** Which diagrams count for a need: of its kinds, and for actas, of the right type. */
export function matching(need: Need, docs: Diagram[]): Diagram[] {
  const type = { client: 'client', pm: 'postmortem', retro: 'retro' }[need.id];
  const live = docs.filter((d) => !d.archived && (!type || (d.kind === 'minutes' && (d as DiagramOf<'minutes'>).data.type === type)));
  // Kinds are in order of preference: an alternative kind (a deployment
  // diagram for the infrastructure, an activity diagram for the process
  // model) only counts while the preferred ones are not enough.
  const out: Diagram[] = [];
  for (const k of need.kinds) {
    if (out.length >= (need.min ?? 1)) break;
    out.push(...live.filter((d) => d.kind === k).sort((a, b) => a.title.localeCompare(b.title, 'es')));
  }
  return out;
}

export function reviewNeed(need: Need, docs: Diagram[]): NeedReview {
  if (need.text) return { need, state: 'text', docs: [], problems: [] };
  const mine = matching(need, docs);
  if (mine.length === 0) return { need, state: 'missing', docs: mine, problems: [] };
  const problems = [...(mine.length < (need.min ?? 1) ? [`${mine.length} of ${need.min} diagrams`] : []), ...(need.check?.(mine) ?? [])];
  return { need, state: problems.length ? 'partial' : 'done', docs: mine, problems };
}

export interface DeliverableReview {
  deliverable: Deliverable;
  parts: { part: Part; needs: NeedReview[] }[];
  /** Required needs (not text, not optional) met / total. */
  done: number;
  total: number;
}

export function review(deliverable: Deliverable, docs: Diagram[]): DeliverableReview {
  const parts = deliverable.parts.map((part) => ({ part, needs: part.needs.map((n) => reviewNeed(n, docs)) }));
  const required = parts.flatMap((p) => p.needs).filter((r) => r.state !== 'text' && !r.need.optional);
  return { deliverable, parts, done: required.filter((r) => r.state === 'done').length, total: required.length };
}

/** The diagrams of a hand-in, in checklist order, each once (for its export). */
export function deliverableDocs(r: DeliverableReview): Diagram[] {
  const seen = new Set<string>();
  const out: Diagram[] = [];
  for (const p of r.parts) for (const n of p.needs) for (const d of n.docs) if (!seen.has(d.id)) (seen.add(d.id), out.push(d));
  return out;
}
