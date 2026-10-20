/**
 * Deep repair for the structured kinds whose editors walk nested lists (TCO,
 * backlog, actas, UP plan). `normalizeDiagram` fills the top level of every
 * kind; this fills each item of their lists, so a half-written file, a hand
 * edit or a file from an older version opens instead of crashing the editor.
 * Pure: `newId` is passed in (no import of diagram.ts, which calls this).
 */
import type { DiagramKind } from './types';

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : fallback);
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : fallback);
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);
const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);

function story(s: Obj, newId: () => string): Obj {
  const out: Obj = {
    ...s,
    id: str(s.id) || newId(),
    title: str(s.title),
    asA: str(s.asA),
    iWant: str(s.iWant),
    soThat: str(s.soThat),
    gherkin: str(s.gherkin),
    priority: str(s.priority),
    epic: str(s.epic)
  };
  out.points = typeof s.points === 'number' && Number.isFinite(s.points) ? s.points : undefined;
  return out;
}

function tco(d: Obj, newId: () => string): Obj {
  return {
    ...d,
    years: Math.max(1, Math.min(10, Math.round(num(d.years, 3)) || 3)),
    users: Math.max(0, num(d.users)),
    alternatives: list(d.alternatives).map((a) => ({
      ...a,
      id: str(a.id) || newId(),
      name: str(a.name, 'Alternativa'),
      description: str(a.description),
      lines: list(a.lines).map((l) => ({
        ...l,
        id: str(l.id) || newId(),
        name: str(l.name),
        block: oneOf(l.block, ['dev', 'hwsw', 'ops', 'long'] as const, 'hwsw'),
        nature: oneOf(l.nature, ['capex', 'opex'] as const, 'capex'),
        unitCost: num(l.unitCost),
        qty: num(l.qty, 1),
        when: oneOf(l.when, ['once', 'yearly', 'monthly'] as const, 'once'),
        year: Math.max(1, Math.round(num(l.year, 1))),
        source: str(l.source)
      }))
    })),
    criteria: list(d.criteria).map((c) => ({ ...c, id: str(c.id) || newId(), name: str(c.name), weight: Math.max(0, num(c.weight, 1)) })),
    scores: isObj(d.scores) ? Object.fromEntries(Object.entries(d.scores).filter(([, v]) => typeof v === 'number' && Number.isFinite(v))) : {},
    recommendation: str(d.recommendation)
  };
}

function backlog(d: Obj, newId: () => string): Obj {
  const ai = isObj(d.ai) ? d.ai : {};
  return {
    ...d,
    product: str(d.product),
    components: Array.isArray(d.components) ? d.components.filter((c): c is string => typeof c === 'string') : [],
    epics: list(d.epics).map((e) => ({
      ...e,
      id: str(e.id) || newId(),
      code: str(e.code),
      title: str(e.title),
      description: str(e.description),
      component: str(e.component),
      priority: str(e.priority),
      stories: list(e.stories).map((s) => story(s, newId))
    })),
    ai: Object.fromEntries((['context', 'stack', 'guardrails', 'glossary', 'outOfScope', 'process'] as const).map((k) => [k, str(ai[k])]))
  };
}

function minutes(d: Obj, newId: () => string): Obj {
  const items = (v: unknown) => list(v).map((a) => ({ id: str(a.id) || newId(), text: str(a.text) }));
  return {
    ...d,
    type: oneOf(d.type, ['client', 'team', 'postmortem', 'retro'] as const, 'client'),
    number: str(d.number),
    date: str(d.date),
    start: str(d.start),
    end: str(d.end),
    place: str(d.place),
    attendees: list(d.attendees).map((a) => ({ id: str(a.id) || newId(), name: str(a.name), role: str(a.role), present: a.present !== false })),
    agenda: items(d.agenda),
    discussion: str(d.discussion),
    decisions: items(d.decisions),
    actions: list(d.actions).map((a) => ({ id: str(a.id) || newId(), text: str(a.text), owner: str(a.owner), due: str(a.due), done: !!a.done })),
    questions: list(d.questions).map((a) => ({ id: str(a.id) || newId(), text: str(a.text), answer: str(a.answer) })),
    review: list(d.review).map((a) => ({
      id: str(a.id) || newId(),
      text: str(a.text),
      kind: oneOf(a.kind, ['well', 'bad', 'improve'] as const, 'well'),
      area: oneOf(a.area, ['team', 'method'] as const, 'team')
    })),
    next: str(d.next)
  };
}

function up(d: Obj, newId: () => string): Obj {
  const phases = list(d.phases).map((p, i) => {
    const its = Array.isArray(p.iterations) ? p.iterations.filter((x): x is string => typeof x === 'string') : [];
    const name = str(p.name, `Fase ${i + 1}`);
    return { ...p, id: str(p.id) || newId(), name, goal: str(p.goal), milestone: str(p.milestone), iterations: its.length ? its : [`${name.charAt(0) || 'F'}1`] };
  });
  const disciplines = list(d.disciplines).map((x) => {
    const effort = Array.isArray(x.effort) ? x.effort : [];
    return { ...x, id: str(x.id) || newId(), name: str(x.name), effort: phases.map((_, i) => Math.max(0, Math.min(4, Math.round(num(effort[i]))))) };
  });
  const phaseIds = new Set(phases.map((p) => p.id));
  const disciplineIds = new Set(disciplines.map((x) => x.id));
  const artifacts = list(d.artifacts)
    // An artefact whose phase is gone moves to the first phase; with no phases it can't be shown.
    .filter(() => phases.length > 0)
    .map((a) => ({
      ...a,
      id: str(a.id) || newId(),
      phaseId: phaseIds.has(str(a.phaseId)) ? str(a.phaseId) : phases[0].id,
      disciplineId: disciplineIds.has(str(a.disciplineId)) ? str(a.disciplineId) : (disciplines[0]?.id ?? ''),
      name: str(a.name),
      status: oneOf(a.status, ['todo', 'draft', 'done'] as const, 'todo'),
      diagramId: typeof a.diagramId === 'string' && a.diagramId ? a.diagramId : undefined,
      note: str(a.note)
    }));
  return { ...d, phases, disciplines, artifacts };
}

const REPAIRS: Partial<Record<DiagramKind, (d: Obj, newId: () => string) => Obj>> = { tco, backlog, minutes, up };

/** Repaired data for kinds that need it; other kinds come back unchanged. */
export function repairData(kind: DiagramKind, data: Obj, newId: () => string): Obj {
  const fix = REPAIRS[kind];
  return fix ? fix(data, newId) : data;
}
