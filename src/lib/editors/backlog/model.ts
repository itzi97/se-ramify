/**
 * Product backlog: edits, codes, checks and exports as pure functions
 * (tests/backlog.test.ts).
 *
 * Codes. An epic's code is its own `code`, or `EP-01`, `EP-02`… by its
 * position in the backlog when left empty. A story's code is derived from its
 * epic: `HU-<epic number>.<position>` — EP-03's second story is `HU-03.2`
 * (an epic with a custom code "CAT-1" gives "HU-CAT-1.2"). Codes follow the
 * order, so reordering renumbers; they are never stored.
 */
import type { AiBrief, BacklogData, Epic, UserStory } from '../../model/types';
import { MOSCOW, SCENARIO_TEMPLATE, buildFeature, storySentence, storyTitle, totalPoints, type FeatureGroup } from '../../model/stories';
import { slug, uid } from '../../model/diagram';

export { MOSCOW, SCENARIO_TEMPLATE, storySentence, storyTitle, totalPoints };

/* ------------------------------------------------------------------ codes */

export function epicCode(data: BacklogData, epic: Epic): string {
  if (epic.code.trim()) return epic.code.trim();
  const i = data.epics.indexOf(epic);
  return `EP-${String((i < 0 ? data.epics.length : i) + 1).padStart(2, '0')}`;
}

export function storyCode(data: BacklogData, epic: Epic, story: UserStory): string {
  const base = epicCode(data, epic).replace(/^EP-/i, '');
  const i = epic.stories.indexOf(story);
  return `HU-${base}.${(i < 0 ? epic.stories.length : i) + 1}`;
}

/* ------------------------------------------------------------------ edits */

export function blankEpic(component = ''): Epic {
  return { id: uid(), code: '', title: '', description: '', component, priority: '', stories: [] };
}

export function blankBacklogStory(): UserStory {
  return { id: uid(), title: '', asA: '', iWant: '', soThat: '', gherkin: '', points: undefined, priority: '', epic: '' };
}

/** Adds an epic (after `after`, or at the end); returns its id. */
export function addEpic(data: BacklogData, component = '', after?: string): string {
  const e = blankEpic(component);
  const i = after ? data.epics.findIndex((x) => x.id === after) : -1;
  if (i >= 0) data.epics.splice(i + 1, 0, e);
  else data.epics.push(e);
  return e.id;
}

export function removeEpic(data: BacklogData, id: string): void {
  data.epics = data.epics.filter((e) => e.id !== id);
}

/** Swap an item with its neighbour. */
export function shift<T extends { id: string }>(list: T[], id: string, dir: -1 | 1): boolean {
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return false;
  [list[i], list[j]] = [list[j], list[i]];
  return true;
}

export function moveEpic(data: BacklogData, id: string, dir: -1 | 1): boolean {
  return shift(data.epics, id, dir);
}

export function addStory(data: BacklogData, epicId: string): string | null {
  const e = data.epics.find((x) => x.id === epicId);
  if (!e) return null;
  const s = blankBacklogStory();
  e.stories.push(s);
  return s.id;
}

export function removeStory(data: BacklogData, epicId: string, storyId: string): void {
  const e = data.epics.find((x) => x.id === epicId);
  if (e) e.stories = e.stories.filter((s) => s.id !== storyId);
}

export function moveStory(data: BacklogData, epicId: string, storyId: string, dir: -1 | 1): boolean {
  const e = data.epics.find((x) => x.id === epicId);
  return e ? shift(e.stories, storyId, dir) : false;
}

/** Move a story to the end of another epic. */
export function moveStoryToEpic(data: BacklogData, storyId: string, toEpicId: string): void {
  const from = data.epics.find((e) => e.stories.some((s) => s.id === storyId));
  const to = data.epics.find((e) => e.id === toEpicId);
  if (!from || !to || from === to) return;
  const s = from.stories.find((x) => x.id === storyId)!;
  from.stories = from.stories.filter((x) => x.id !== storyId);
  to.stories.push(s);
}

/* ------------------------------------------------------- grouping & counts */

export const NO_COMPONENT = 'Sin componente';

/** Components in the backlog's order, then any used only by epics, then epics without one. */
export function componentsOf(data: BacklogData): string[] {
  const out = data.components.map((c) => c.trim()).filter(Boolean);
  for (const e of data.epics) {
    const c = e.component.trim();
    if (c && !out.includes(c)) out.push(c);
  }
  return [...new Set(out)];
}

export function byComponent(data: BacklogData, only?: string): { component: string; epics: Epic[] }[] {
  const groups = componentsOf(data).map((component) => ({ component, epics: data.epics.filter((e) => e.component.trim() === component) }));
  const loose = data.epics.filter((e) => !e.component.trim());
  if (loose.length) groups.push({ component: NO_COMPONENT, epics: loose });
  return only ? groups.filter((g) => g.component === only) : groups.filter((g) => g.epics.length || data.components.includes(g.component));
}

/** A story with acceptance criteria that at least name a scenario and its steps. */
export function hasCriteria(s: UserStory): boolean {
  return s.gherkin.trim() !== '' && gherkinProblems(s.gherkin).every((p) => p.level === 'warn');
}

export interface EpicStats {
  stories: number;
  points: number;
  /** Stories without complete Como/quiero/para or without usable Gherkin. */
  incomplete: number;
}

export function epicStats(e: Epic): EpicStats {
  return {
    stories: e.stories.length,
    points: totalPoints(e.stories),
    incomplete: e.stories.filter((s) => !s.asA.trim() || !s.iWant.trim() || !s.soThat.trim() || !hasCriteria(s)).length
  };
}

export function backlogStats(data: BacklogData) {
  const stories = data.epics.flatMap((e) => e.stories);
  return {
    epics: data.epics.length,
    brokenDown: data.epics.filter((e) => e.stories.length).length,
    withoutStories: data.epics.filter((e) => !e.stories.length).length,
    stories: stories.length,
    points: totalPoints(stories),
    withCriteria: stories.filter(hasCriteria).length
  };
}

/* ----------------------------------------------------------------- checks */

export interface Problem {
  level: 'error' | 'warn';
  /** Code of the epic or story it is about ("EP-02", "HU-02.1"), empty for the backlog. */
  where: string;
  text: string;
  epicId?: string;
  storyId?: string;
}

const SCENARIO = /^\s*(Escenario|Esquema del escenario|Ejemplo|Scenario|Scenario Outline|Example)\s*:/i;
const GIVEN = /^\s*(Dad[oa]s?|Given)\b/i;
const WHEN = /^\s*(Cuando|When)\b/i;
const THEN = /^\s*(Entonces|Then)\b/i;

/** What's wrong with one story's Gherkin text (empty text is reported by the caller). */
export function gherkinProblems(text: string): { level: 'error' | 'warn'; text: string }[] {
  const out: { level: 'error' | 'warn'; text: string }[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const scenarios: { name: string; given: number; when: number; then: number }[] = [];
  let background = false;
  for (const l of lines) {
    if (SCENARIO.test(l)) scenarios.push({ name: l.replace(SCENARIO, '').trim() || 'sin nombre', given: 0, when: 0, then: 0 });
    else if (/^\s*(Antecedentes|Background)\s*:/i.test(l)) background = true;
    else if (scenarios.length) {
      const s = scenarios[scenarios.length - 1];
      if (GIVEN.test(l)) s.given++;
      else if (WHEN.test(l)) s.when++;
      else if (THEN.test(l)) s.then++;
    }
  }
  if (!scenarios.length) {
    out.push({ level: 'error', text: 'Gherkin without any "Escenario:"' });
    return out;
  }
  for (const s of scenarios) {
    if (!s.given && !background) out.push({ level: 'warn', text: `"${s.name}": no Dado (context)` });
    if (!s.when) out.push({ level: 'error', text: `"${s.name}": no Cuando (action)` });
    if (!s.then) out.push({ level: 'error', text: `"${s.name}": no Entonces (expected result)` });
    if (s.when > 1) out.push({ level: 'warn', text: `"${s.name}": ${s.when} Cuando steps — one action per scenario reads better` });
  }
  if (/<[^>\n]+>/.test(text) && !/^\s*(Ejemplos|Examples)\s*:/im.test(text)) out.push({ level: 'warn', text: 'template placeholders <…> left in the text' });
  return out;
}

/** Everything a reviewer would flag: missing story parts, missing or broken Gherkin, epics without priority. */
export function checkBacklog(data: BacklogData): Problem[] {
  const out: Problem[] = [];
  if (!data.epics.length) out.push({ level: 'error', where: '', text: 'The backlog has no epics yet' });
  for (const e of data.epics) {
    const code = epicCode(data, e);
    const at = { epicId: e.id };
    if (!e.title.trim()) out.push({ level: 'error', where: code, text: 'epic without a title', ...at });
    if (!e.priority.trim()) out.push({ level: 'warn', where: code, text: 'epic without a priority', ...at });
    for (const s of e.stories) {
      const sc = storyCode(data, e, s);
      const st = { epicId: e.id, storyId: s.id };
      const missing = [!s.asA.trim() && 'Como', !s.iWant.trim() && 'quiero', !s.soThat.trim() && 'para'].filter(Boolean);
      if (missing.length) out.push({ level: 'error', where: sc, text: `story missing ${missing.join(' / ')}`, ...st });
      if (!s.gherkin.trim()) out.push({ level: 'error', where: sc, text: 'no acceptance criteria (Gherkin)', ...st });
      else for (const p of gherkinProblems(s.gherkin)) out.push({ ...p, where: sc, ...st });
    }
  }
  if (data.epics.length && !data.epics.some((e) => e.stories.length)) out.push({ level: 'warn', where: '', text: 'no epic is broken down into user stories yet' });
  return out;
}

/* ---------------------------------------------------------------- exports */

const cell = (t: string) => t.replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();

/** A story copy titled with its code, for the shared Markdown / Gherkin builders. */
function coded(data: BacklogData, e: Epic, s: UserStory): UserStory {
  return { ...s, title: `${storyCode(data, e, s)} ${storyTitle(s)}`, epic: '' };
}

function storyBlock(data: BacklogData, e: Epic, s: UserStory, level: number): string {
  const h = '#'.repeat(level);
  const out = [`${h} ${storyCode(data, e, s)} · ${storyTitle(s)}`];
  const sentence = storySentence(s);
  if (sentence) out.push('', `> ${sentence}.`);
  const meta: string[] = [];
  if (s.priority?.trim()) meta.push(`Prioridad: ${s.priority.trim()}`);
  if (typeof s.points === 'number' && !Number.isNaN(s.points)) meta.push(`Puntos: ${s.points}`);
  if (meta.length) out.push('', meta.join(' · '));
  if (s.gherkin.trim()) out.push('', '```gherkin', s.gherkin.trim(), '```');
  else out.push('', '_Criterios de aceptación pendientes._');
  return out.join('\n');
}

export function epicTable(data: BacklogData): string {
  const rows = data.epics.map((e) => {
    const st = epicStats(e);
    return `| ${epicCode(data, e)} | ${cell(e.title || 'Sin título')} | ${cell(e.component || '—')} | ${e.priority || '—'} | ${st.stories} | ${st.points || '—'} |`;
  });
  return ['| Código | Épica | Componente | Prioridad | Historias | Puntos |', '|---|---|---|---|---:|---:|', ...rows].join('\n');
}

export function toMarkdown(title: string, data: BacklogData): string {
  const st = backlogStats(data);
  const out = [`# ${title}`, ''];
  if (data.product.trim()) out.push(`**Producto:** ${data.product.trim()}`, '');
  out.push(`${st.epics} épicas · ${st.stories} historias de usuario${st.points ? ` · ${st.points} puntos` : ''}.`, '', '## Épicas', '', epicTable(data));
  for (const e of data.epics) {
    out.push('', `## ${epicCode(data, e)} · ${e.title || 'Sin título'}`, '');
    const meta = [e.component.trim() && `Componente: ${e.component.trim()}`, e.priority.trim() && `Prioridad: ${e.priority.trim()}`].filter(Boolean);
    if (meta.length) out.push(meta.join(' · '), '');
    if (e.description.trim()) out.push(e.description.trim(), '');
    if (!e.stories.length) {
      out.push('_Sin desglosar en historias de usuario._');
      continue;
    }
    for (const s of e.stories) out.push(storyBlock(data, e, s, 3), '');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function featureGroup(data: BacklogData, e: Epic): FeatureGroup {
  const description = [e.component.trim() && `Componente: ${e.component.trim()}`, e.description.trim()].filter(Boolean).join('\n');
  return { name: `${epicCode(data, e)} ${e.title || 'Sin título'}`, description, stories: e.stories.map((s) => coded(data, e, s)) };
}

/** All broken-down epics as one feature file (one Característica per epic). */
export function toFeature(data: BacklogData): string {
  const epics = data.epics.filter((e) => e.stories.length);
  if (!epics.length) return '# language: es\n\n# Ninguna épica tiene historias todavía.\n';
  return buildFeature(epics.map((e) => featureGroup(data, e)));
}

export function epicFeature(data: BacklogData, e: Epic): string {
  return buildFeature([featureGroup(data, e)]);
}

/* ------------------------------------------------------------- AI brief */

export const AI_FIELDS: { key: keyof AiBrief; label: string; hint: string; rows: number }[] = [
  { key: 'context', label: 'Context — what the product is and for whom', hint: 'Aplicación web para… que permite…', rows: 4 },
  { key: 'stack', label: 'Stack — language, framework, database, how it runs', hint: 'TypeScript, SvelteKit, SQLite; se ejecuta con npm run dev', rows: 3 },
  { key: 'glossary', label: 'Glossary — one "Término: definición" per line', hint: 'Ejemplar: copia física de un libro…', rows: 5 },
  { key: 'outOfScope', label: 'Out of scope', hint: 'Lo que no hay que construir', rows: 3 },
  { key: 'guardrails', label: 'Guardrails — rules the model must follow, one per line', hint: 'Implementa solo lo que describen las historias…', rows: 7 },
  { key: 'process', label: 'Process — how to generate, run and test it (for the client)', hint: '1. Abre el modelo…', rows: 7 }
];

export const PREFILL_GUARDRAILS = [
  'Implementa solo lo que describen las historias de usuario y sus criterios de aceptación; no añadas funciones que no estén pedidas.',
  'Cada escenario Gherkin debe tener una prueba automática que lo ejecute; la tarea no está terminada hasta que todas pasen.',
  'No inventes campos, entidades ni reglas de negocio: si algo no está definido, pregunta o déjalo anotado como duda.',
  'Usa los términos del glosario tal cual, en el código, la interfaz y los mensajes.',
  'Respeta el stack indicado; no cambies de lenguaje, framework ni base de datos.',
  'Valida todas las entradas del usuario y muestra los mensajes de error que indican los criterios.',
  'No guardes datos personales que no pidan las historias (RGPD).',
  'Explica cada cambio que hagas y qué historias y escenarios cubre.'
].join('\n');

export const PREFILL_PROCESS = [
  '1. Abre una conversación nueva con el modelo de IA (por ejemplo, un asistente de programación con acceso a ficheros).',
  '2. Adjunta SPEC.md, GUARDRAILS.md y la carpeta features/, y pega el contenido de PROMPT.md como primer mensaje.',
  '3. Pide primero el plan (estructura de ficheros y modelo de datos) y revísalo antes de dejar que escriba código.',
  '4. Genera la aplicación épica a épica, en el orden del backlog, y ejecuta las pruebas al terminar cada una.',
  '5. Si una prueba falla, pega el error y el escenario Gherkin afectado y pide que lo corrija sin tocar lo que ya funciona.',
  '6. Prueba a mano el camino feliz de cada historia y revisa el código antes de darlo por bueno.',
  '7. Para cambiar la aplicación más adelante: edita primero la historia y sus criterios Gherkin, y repite los pasos 2–6 solo con las épicas afectadas.'
].join('\n');

const bullets = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => (/^([-*]|\d+[.)])\s/.test(l) ? l : `- ${l}`))
    .join('\n');

function glossaryTable(text: string): string {
  const rows = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(':');
      return i > 0 ? `| ${cell(l.slice(0, i))} | ${cell(l.slice(i + 1))} |` : `| ${cell(l)} | |`;
    });
  return rows.length ? ['| Término | Definición |', '|---|---|', ...rows].join('\n') : '_Sin glosario._';
}

const orPending = (t: string) => t.trim() || '_Pendiente._';

export function specMarkdown(title: string, data: BacklogData): string {
  const ai = data.ai;
  return [
    `# Especificación — ${data.product.trim() || title}`,
    '',
    '## Contexto',
    '',
    orPending(ai.context),
    '',
    '## Stack',
    '',
    orPending(ai.stack),
    '',
    '## Glosario',
    '',
    glossaryTable(ai.glossary),
    '',
    '## Fuera de alcance',
    '',
    ai.outOfScope.trim() ? bullets(ai.outOfScope) : '_Nada indicado._',
    '',
    '## Épicas',
    '',
    epicTable(data),
    ''
  ].join('\n');
}

export function guardrailsMarkdown(data: BacklogData): string {
  return ['# Guardrails', '', 'Reglas que el modelo debe seguir siempre al generar o modificar la aplicación.', '', data.ai.guardrails.trim() ? bullets(data.ai.guardrails) : '_Pendiente._', ''].join('\n');
}

/** The single file a client pastes into a model: everything in one place. */
export function aiBriefMarkdown(title: string, data: BacklogData): string {
  const name = data.product.trim() || title;
  const out = [
    `# Brief para generar ${name} con IA`,
    '',
    'Este documento define formalmente el producto. Las historias de usuario y sus criterios de aceptación en Gherkin son la especificación: la aplicación generada debe cumplir todos los escenarios.',
    '',
    '## Contexto',
    '',
    orPending(data.ai.context),
    '',
    '## Stack',
    '',
    orPending(data.ai.stack),
    '',
    '## Glosario',
    '',
    glossaryTable(data.ai.glossary),
    '',
    '## Fuera de alcance',
    '',
    data.ai.outOfScope.trim() ? bullets(data.ai.outOfScope) : '_Nada indicado._',
    '',
    '## Guardrails',
    '',
    data.ai.guardrails.trim() ? bullets(data.ai.guardrails) : '_Pendiente._',
    '',
    '## Proceso para generar y probar',
    '',
    data.ai.process.trim() ? bullets(data.ai.process) : '_Pendiente._',
    '',
    '## Historias de usuario y criterios de aceptación',
    ''
  ];
  for (const e of data.epics.filter((x) => x.stories.length)) {
    out.push(`### ${epicCode(data, e)} · ${e.title || 'Sin título'}`, '');
    if (e.description.trim()) out.push(e.description.trim(), '');
    for (const s of e.stories) out.push(storyBlock(data, e, s, 4), '');
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

export function promptMarkdown(title: string, data: BacklogData, featureFiles: string[]): string {
  const name = data.product.trim() || title;
  return [
    `# Prompt — generar ${name}`,
    '',
    `Vas a construir ${name}. Lee primero estos ficheros adjuntos:`,
    '',
    '- `SPEC.md`: contexto, stack, glosario, lo que queda fuera y la lista de épicas.',
    '- `GUARDRAILS.md`: reglas que debes cumplir siempre.',
    ...featureFiles.map((f) => `- \`${f}\`: historias de usuario y criterios de aceptación en Gherkin.`),
    '',
    'Instrucciones:',
    '',
    '1. Antes de escribir código, propón la estructura de ficheros y el modelo de datos, y espera mi confirmación.',
    '2. Implementa las épicas en el orden de `SPEC.md`. Cada escenario Gherkin es un requisito: escribe una prueba automática por escenario.',
    '3. Al terminar cada épica, ejecuta todas las pruebas y dime cuáles pasan y cuáles no.',
    '4. Si algo no está definido en la especificación, no lo inventes: pregúntame.',
    '5. Usa los términos del glosario tal cual en el código y en la interfaz.',
    ''
  ].join('\n');
}

export function readmeMarkdown(title: string, data: BacklogData): string {
  const name = data.product.trim() || title;
  return [
    `# ${name} — material para generar y probar la aplicación con IA`,
    '',
    'Contenido de esta carpeta:',
    '',
    '- `PROMPT.md`: el primer mensaje para el modelo.',
    '- `SPEC.md`: definición del producto (contexto, stack, glosario, fuera de alcance, épicas).',
    '- `GUARDRAILS.md`: reglas que el modelo debe respetar.',
    '- `features/`: un fichero Gherkin por épica con sus historias y criterios de aceptación.',
    '',
    '## Proceso',
    '',
    data.ai.process.trim() ? bullets(data.ai.process) : '_Pendiente._',
    ''
  ].join('\n');
}

/** Every file of the AI pack, as relative path → content. */
export function aiPack(title: string, data: BacklogData): { path: string; content: string }[] {
  const features = data.epics
    .filter((e) => e.stories.length)
    .map((e) => {
      const code = epicCode(data, e);
      const name = slug(`${code} ${e.title}`, 60) || slug(code, 20) || 'epica';
      return { path: `features/${name}.feature`, content: epicFeature(data, e) };
    });
  return [
    { path: 'README.md', content: readmeMarkdown(title, data) },
    { path: 'PROMPT.md', content: promptMarkdown(title, data, features.map((f) => f.path)) },
    { path: 'SPEC.md', content: specMarkdown(title, data) },
    { path: 'GUARDRAILS.md', content: guardrailsMarkdown(data) },
    ...features
  ];
}
