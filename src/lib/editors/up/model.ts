/**
 * Unified Process plan logic, free of Svelte so the tests can use it:
 * the textbook artefacts of each phase, which diagram kind makes each one,
 * linking artefacts to the project's diagrams, progress, the geometry of the
 * classic "hump" chart and the Markdown export.
 *
 * Operations mutate the data they get (they run inside `app.change`).
 */
import { uid } from '../../model/diagram';
import type { DiagramKind, UpArtifact, UpData, UpDiscipline, UpPhase } from '../../model/types';

export type Status = UpArtifact['status'];

export const STATUSES: { status: Status; label: string; color: string }[] = [
  { status: 'todo', label: 'Pendiente', color: '#8d949c' },
  { status: 'draft', label: 'En curso', color: '#e8873a' },
  { status: 'done', label: 'Hecho', color: '#58a55c' }
];

export function statusInfo(s: Status | undefined) {
  return STATUSES.find((x) => x.status === s) ?? STATUSES[0];
}

export const MAX_EFFORT = 4;

/* -------------------------------------------------------- suggestions */

export interface Suggestion {
  /** 0 = Inicio … 3 = Transición. */
  phase: number;
  /** Discipline name, matched against the plan's disciplines. */
  discipline: string;
  name: string;
  /** The diagram kind that is (or holds) this artefact, if the app makes it. */
  kind?: DiagramKind;
}

/** The artefacts usually produced in each phase (Jacobson, Booch y Rumbaugh; Tema 8). */
export const SUGGESTED: Suggestion[] = [
  // Inicio
  { phase: 0, discipline: 'Modelado del negocio', name: 'Visión', kind: 'vision' },
  { phase: 0, discipline: 'Modelado del negocio', name: 'Caso de negocio' },
  { phase: 0, discipline: 'Gestión del proyecto', name: 'Lista de riesgos' },
  { phase: 0, discipline: 'Requisitos', name: 'Modelo de casos de uso inicial', kind: 'usecase' },
  { phase: 0, discipline: 'Gestión del proyecto', name: 'Plan del proyecto (Gantt)', kind: 'gantt' },
  { phase: 0, discipline: 'Requisitos', name: 'Glosario' },
  // Elaboración
  { phase: 1, discipline: 'Requisitos', name: 'Modelo de casos de uso con especificaciones', kind: 'usecase' },
  { phase: 1, discipline: 'Modelado del negocio', name: 'Modelo del dominio', kind: 'class' },
  { phase: 1, discipline: 'Análisis y diseño', name: 'Modelo de análisis', kind: 'communication' },
  { phase: 1, discipline: 'Análisis y diseño', name: 'Arquitectura base / descripción de la arquitectura', kind: 'deployment' },
  { phase: 1, discipline: 'Gestión del proyecto', name: 'Plan de iteraciones', kind: 'gantt' },
  { phase: 1, discipline: 'Requisitos', name: 'Prototipo', kind: 'screenflow' },
  // Construcción
  { phase: 2, discipline: 'Análisis y diseño', name: 'Modelo de diseño (clases de diseño)', kind: 'class' },
  { phase: 2, discipline: 'Análisis y diseño', name: 'Diagramas de secuencia', kind: 'sequence' },
  { phase: 2, discipline: 'Análisis y diseño', name: 'Modelo de datos (E/R)', kind: 'er' },
  { phase: 2, discipline: 'Implementación', name: 'Código / componentes' },
  { phase: 2, discipline: 'Pruebas', name: 'Plan y casos de prueba', kind: 'traceability' },
  { phase: 2, discipline: 'Despliegue', name: 'Diagrama de despliegue', kind: 'deployment' },
  // Transición
  { phase: 3, discipline: 'Despliegue', name: 'Plan de despliegue', kind: 'gantt' },
  { phase: 3, discipline: 'Despliegue', name: 'Manual de usuario' },
  { phase: 3, discipline: 'Despliegue', name: 'Formación' },
  { phase: 3, discipline: 'Pruebas', name: 'Versión beta y feedback' },
  { phase: 3, discipline: 'Gestión del proyecto', name: 'Acta de cierre / post mortem', kind: 'minutes' }
];

const fold = (t: string) =>
  t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Words in an artefact's name that point to a diagram kind (custom artefacts too). */
const KEYWORDS: [RegExp, DiagramKind][] = [
  [/secuencia/, 'sequence'],
  [/comunicacion/, 'communication'],
  [/casos? de uso/, 'usecase'],
  [/clases?|dominio/, 'class'],
  [/entidad|e\/r|modelo de datos/, 'er'],
  [/despliegue|componentes/, 'deployment'],
  [/arquitectura|infraestructura/, 'architecture'],
  [/actividad/, 'activity'],
  [/estados/, 'state'],
  [/gantt|planificacion|plan del proyecto|plan de iteraciones/, 'gantt'],
  [/vision|elevator/, 'vision'],
  [/stakeholder|interesados/, 'stakeholder'],
  [/acta|post ?mortem|retrospectiva/, 'minutes'],
  [/pantalla|prototipo|wireframe/, 'screenflow'],
  [/trazabilidad|casos de prueba/, 'traceability'],
  [/backlog|epica|historias/, 'backlog'],
  [/flujo de datos|dfd/, 'dfd'],
  [/tco|coste/, 'tco']
];

/** The diagram kind that makes an artefact: from the suggestion list, else from words in its name. */
export function kindFor(name: string): DiagramKind | undefined {
  const f = fold(name);
  if (!f) return undefined;
  const s = SUGGESTED.find((x) => fold(x.name) === f);
  if (s) return s.kind;
  for (const [re, kind] of KEYWORDS) if (re.test(f)) return kind;
  return undefined;
}

function disciplineFor(data: UpData, name: string): string {
  const f = fold(name);
  return (data.disciplines.find((d) => fold(d.name) === f) ?? data.disciplines.find((d) => fold(d.name).startsWith(f.split(' ')[0])) ?? data.disciplines[0])?.id ?? '';
}

/** Suggested artefacts not in the plan yet (same name in the same phase), ready to append. */
export function suggestedArtifacts(data: UpData): UpArtifact[] {
  const out: UpArtifact[] = [];
  for (const s of SUGGESTED) {
    const phase = data.phases[s.phase];
    if (!phase) continue;
    if (data.artifacts.some((a) => a.phaseId === phase.id && fold(a.name) === fold(s.name))) continue;
    out.push({ id: uid(), phaseId: phase.id, disciplineId: disciplineFor(data, s.discipline), name: s.name, status: 'todo', note: '' });
  }
  return out;
}

/** Append the missing suggested artefacts; returns how many were added. */
export function addSuggested(data: UpData): number {
  const more = suggestedArtifacts(data);
  data.artifacts.push(...more);
  return more.length;
}

/* --------------------------------------------------------------- links */

export interface DiagramRef {
  id: string;
  kind: DiagramKind;
  title: string;
}

/**
 * Link each unlinked artefact to a diagram of the kind that makes it.
 * Prefers a diagram whose title shares words with the artefact's name, and a
 * diagram no other artefact uses yet. Returns a new list and how many it linked.
 */
export function autoLink(artifacts: UpArtifact[], diagrams: DiagramRef[]): { artifacts: UpArtifact[]; linked: number } {
  const used = new Set(artifacts.map((a) => a.diagramId).filter(Boolean) as string[]);
  const words = (t: string) => new Set(fold(t).split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  let linked = 0;
  const out = artifacts.map((a) => {
    if (a.diagramId && diagrams.some((d) => d.id === a.diagramId)) return a;
    const kind = kindFor(a.name);
    if (!kind) return a;
    const candidates = diagrams.filter((d) => d.kind === kind);
    if (!candidates.length) return a;
    const mine = words(a.name);
    const score = (d: DiagramRef) => [...words(d.title)].filter((w) => mine.has(w)).length * 2 + (used.has(d.id) ? 0 : 1);
    const best = [...candidates].sort((x, y) => score(y) - score(x))[0];
    used.add(best.id);
    linked++;
    return { ...a, diagramId: best.id };
  });
  return { artifacts: out, linked };
}

/* ------------------------------------------------------------ progress */

export interface Progress {
  done: number;
  draft: number;
  todo: number;
  total: number;
}

export function progress(data: UpData, phaseId?: string): Progress {
  const list = phaseId ? data.artifacts.filter((a) => a.phaseId === phaseId) : data.artifacts;
  const p = { done: 0, draft: 0, todo: 0, total: list.length };
  for (const a of list) p[a.status in p ? a.status : 'todo']++;
  return p;
}

export function artifactsOf(data: UpData, phaseId: string): UpArtifact[] {
  return data.artifacts.filter((a) => a.phaseId === phaseId);
}

/* ---------------------------------------------------------- operations */

export function iterationsOf(p: UpPhase): string[] {
  return p.iterations?.length ? p.iterations : [''];
}

export function setPhase(data: UpData, id: string, patch: Partial<Omit<UpPhase, 'id'>>) {
  const p = data.phases.find((x) => x.id === id);
  if (p) Object.assign(p, patch);
}

/** Next iteration name: the phase's initial and a number ("C4"). */
export function nextIterationName(p: UpPhase): string {
  const its = p.iterations ?? [];
  const prefix = (its.find((i) => /^\D+\d+$/.test(i))?.replace(/\d+$/, '') ?? p.name.trim().charAt(0).toUpperCase()) || 'I';
  let n = its.length + 1;
  while (its.includes(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

export function addIteration(data: UpData, phaseId: string) {
  const p = data.phases.find((x) => x.id === phaseId);
  if (!p) return;
  p.iterations = [...(p.iterations ?? []), nextIterationName(p)];
}

/** Removes an iteration; a phase always keeps one. */
export function removeIteration(data: UpData, phaseId: string, index: number) {
  const p = data.phases.find((x) => x.id === phaseId);
  if (!p || (p.iterations?.length ?? 0) <= 1) return;
  p.iterations = p.iterations.filter((_, i) => i !== index);
}

export function renameIteration(data: UpData, phaseId: string, index: number, name: string) {
  const p = data.phases.find((x) => x.id === phaseId);
  if (p && p.iterations?.[index] !== undefined) p.iterations[index] = name;
}

export function addDiscipline(data: UpData, name = 'Nueva disciplina'): string {
  const id = uid();
  data.disciplines.push({ id, name, effort: data.phases.map(() => 0) });
  return id;
}

/** Removes a discipline; its artefacts move to the first remaining one. */
export function removeDiscipline(data: UpData, id: string) {
  if (data.disciplines.length <= 1) return;
  data.disciplines = data.disciplines.filter((d) => d.id !== id);
  const first = data.disciplines[0].id;
  for (const a of data.artifacts) if (a.disciplineId === id) a.disciplineId = first;
}

export function renameDiscipline(data: UpData, id: string, name: string) {
  const d = data.disciplines.find((x) => x.id === id);
  if (d) d.name = name;
}

export function moveDiscipline(data: UpData, id: string, by: -1 | 1) {
  const i = data.disciplines.findIndex((d) => d.id === id);
  const j = i + by;
  if (i < 0 || j < 0 || j >= data.disciplines.length) return;
  const [d] = data.disciplines.splice(i, 1);
  data.disciplines.splice(j, 0, d);
}

export function effortAt(d: UpDiscipline, phase: number): number {
  const v = Number(d.effort?.[phase] ?? 0);
  return Number.isFinite(v) ? Math.max(0, Math.min(MAX_EFFORT, v)) : 0;
}

export function setEffort(data: UpData, id: string, phase: number, value: number) {
  const d = data.disciplines.find((x) => x.id === id);
  if (!d || phase < 0 || phase >= data.phases.length) return;
  const effort = data.phases.map((_, i) => effortAt(d, i));
  effort[phase] = Math.max(0, Math.min(MAX_EFFORT, Math.round(Number(value) || 0)));
  d.effort = effort;
}

export function addArtifact(data: UpData, phaseId: string, name = 'Nuevo artefacto', disciplineId?: string): string {
  const id = uid();
  data.artifacts.push({ id, phaseId, disciplineId: disciplineId ?? data.disciplines[0]?.id ?? '', name, status: 'todo', note: '' });
  return id;
}

export function removeArtifact(data: UpData, id: string) {
  data.artifacts = data.artifacts.filter((a) => a.id !== id);
}

export function updateArtifact(data: UpData, id: string, patch: Partial<Omit<UpArtifact, 'id'>>) {
  const a = data.artifacts.find((x) => x.id === id);
  if (!a) return;
  Object.assign(a, patch);
  if ('diagramId' in patch && !patch.diagramId) delete a.diagramId;
}

/** Moves an artefact to another phase (to the end of its list). */
export function moveArtifactToPhase(data: UpData, id: string, phaseId: string) {
  const i = data.artifacts.findIndex((a) => a.id === id);
  if (i < 0 || !data.phases.some((p) => p.id === phaseId)) return;
  const [a] = data.artifacts.splice(i, 1);
  a.phaseId = phaseId;
  data.artifacts.push(a);
}

/** Moves an artefact up or down among the artefacts of its phase. */
export function moveArtifact(data: UpData, id: string, by: -1 | 1) {
  const a = data.artifacts.find((x) => x.id === id);
  if (!a) return;
  const same = data.artifacts.filter((x) => x.phaseId === a.phaseId);
  const k = same.indexOf(a);
  const other = same[k + by];
  if (!other) return;
  const i = data.artifacts.indexOf(a);
  const j = data.artifacts.indexOf(other);
  data.artifacts[i] = other;
  data.artifacts[j] = a;
}

/* ------------------------------------------------------- chart geometry */

export const CHART = {
  labelW: 200,
  /** Width per iteration; a phase is at least `minPhaseW` wide. */
  iterW: 86,
  minPhaseW: 152,
  headH: 34,
  rowH: 38,
  /** Height of a full (4) hump inside its row. */
  humpH: 30,
  iterH: 28,
  milestoneH: 64,
  pad: 12
};

export interface PhaseBox {
  id: string;
  x: number;
  w: number;
  /** Iteration cells. */
  iters: { name: string; x: number; w: number }[];
}

export function chartLayout(data: UpData) {
  const C = CHART;
  let x = C.labelW;
  const phases: PhaseBox[] = data.phases.map((p) => {
    const its = iterationsOf(p);
    const w = Math.max(C.minPhaseW, its.length * C.iterW);
    const iw = w / its.length;
    const box = { id: p.id, x, w, iters: its.map((name, i) => ({ name, x: x + i * iw, w: iw })) };
    x += w;
    return box;
  });
  const width = x + C.pad;
  const rowsTop = C.headH;
  const rowsBottom = rowsTop + data.disciplines.length * C.rowH;
  const iterTop = rowsBottom;
  const milestoneTop = iterTop + C.iterH;
  const height = milestoneTop + C.milestoneH;
  return { phases, width, height, rowsTop, rowsBottom, iterTop, milestoneTop };
}

/** Baseline (bottom) of a discipline's row. */
export function rowBaseline(index: number): number {
  return CHART.headH + (index + 1) * CHART.rowH - 4;
}

/**
 * The hump of one discipline: a smooth, filled area through the effort of
 * each phase (at the phase's middle), flat to the chart's edges, never
 * dipping below the baseline (monotone cubic, Fritsch–Carlson).
 */
export function humpPath(phases: PhaseBox[], effort: number[], baseline: number, humpH = CHART.humpH): { area: string; line: string } {
  if (!phases.length) return { area: '', line: '' };
  const y = (v: number) => baseline - (Math.max(0, Math.min(MAX_EFFORT, v)) / MAX_EFFORT) * humpH;
  const left = phases[0].x;
  const right = phases[phases.length - 1].x + phases[phases.length - 1].w;
  const pts: [number, number][] = [[left, y(effort[0] ?? 0)]];
  phases.forEach((p, i) => pts.push([p.x + p.w / 2, y(effort[i] ?? 0)]));
  pts.push([right, y(effort[phases.length - 1] ?? 0)]);
  const n = pts.length;
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]);
  const slope = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / (dx[i] || 1));
  const m: number[] = new Array(n).fill(0);
  for (let i = 1; i < n - 1; i++) m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  m[0] = slope[0];
  m[n - 1] = slope[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }
  const f = (v: number) => Math.round(v * 10) / 10;
  let line = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    const d = dx[i] / 3;
    line += ` C ${f(x0 + d)} ${f(y0 + m[i] * d)} ${f(x1 - d)} ${f(y1 - m[i + 1] * d)} ${f(x1)} ${f(y1)}`;
  }
  const area = `${line} L ${f(right)} ${f(baseline)} L ${f(left)} ${f(baseline)} Z`;
  return { area, line };
}

/** Effort for a pointer at height `y` within a row with this baseline. */
export function effortFromY(y: number, baseline: number, humpH = CHART.humpH): number {
  return Math.max(0, Math.min(MAX_EFFORT, Math.round(((baseline - y) / humpH) * MAX_EFFORT)));
}

/** Split a milestone's text into lines that fit a phase column. */
export function wrapText(text: string, maxChars: number, maxLines = 3): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= maxChars) cur += ' ' + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, '') + '…';
    return kept;
  }
  return lines;
}

/* ------------------------------------------------------------- markdown */

const cell = (t: string) => (t ?? '').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();

/** The plan as Markdown: each phase with its goal, milestone, iterations and artefacts, then the effort table. */
export function upMarkdown(data: UpData, title: string, titleOf: (id: string) => string | undefined = () => undefined): string {
  const out = [`# ${title}`, ''];
  const discName = (id: string) => data.disciplines.find((d) => d.id === id)?.name ?? '';
  const all = progress(data);
  if (all.total) out.push(`Artefactos: ${all.done} hechos, ${all.draft} en curso y ${all.todo} pendientes (${all.total} en total).`, '');
  data.phases.forEach((p, i) => {
    out.push(`## ${i + 1}. ${p.name}`, '');
    if (p.goal.trim()) out.push(`**Objetivo:** ${p.goal.trim()}`, '');
    if (p.milestone.trim()) out.push(`**Hito:** ${p.milestone.trim()}`, '');
    const its = iterationsOf(p).filter((x) => x.trim());
    if (its.length) out.push(`**Iteraciones:** ${its.join(', ')}`, '');
    const arts = artifactsOf(data, p.id);
    if (!arts.length) {
      out.push('_Sin artefactos._', '');
      return;
    }
    out.push('| Artefacto | Disciplina | Estado | Diagrama |', '|---|---|---|---|');
    for (const a of arts) {
      const linked = a.diagramId ? titleOf(a.diagramId) : undefined;
      const name = a.note.trim() ? `${cell(a.name)} — ${cell(a.note)}` : cell(a.name);
      out.push(`| ${name} | ${cell(discName(a.disciplineId))} | ${statusInfo(a.status).label} | ${linked ? cell(linked) : '—'} |`);
    }
    out.push('');
  });
  if (data.disciplines.length && data.phases.length) {
    out.push('## Esfuerzo por disciplina', '', `_De 0 (nada) a ${MAX_EFFORT} (máximo), por fase._`, '');
    out.push(`| Disciplina | ${data.phases.map((p) => cell(p.name)).join(' | ')} |`, `|---|${data.phases.map(() => ':-:').join('|')}|`);
    for (const d of data.disciplines) out.push(`| ${cell(d.name)} | ${data.phases.map((_, i) => '●'.repeat(effortAt(d, i)) + '○'.repeat(MAX_EFFORT - effortAt(d, i))).join(' | ')} |`);
    out.push('');
  }
  return out.join('\n').trimEnd() + '\n';
}
