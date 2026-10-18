/**
 * Pure helpers for user stories: the "Como … quiero … para …" sentence,
 * Gherkin `.feature` files and Markdown. Shared by the story map and Kanban.
 */
import type { UserStory } from './types';

export const MOSCOW = ['Must', 'Should', 'Could', "Won't"] as const;

export const SCENARIO_TEMPLATE = `Escenario: <nombre del escenario>
  Dado <contexto inicial>
  Cuando <acción del usuario>
  Entonces <resultado esperado>`;

/** "Como socio, quiero reservar un libro, para recogerlo mañana" — parts left empty are skipped. */
export function storySentence(s: Pick<UserStory, 'asA' | 'iWant' | 'soThat'>): string {
  const parts: string[] = [];
  if (s.asA.trim()) parts.push(`Como ${s.asA.trim()}`);
  if (s.iWant.trim()) parts.push(`quiero ${s.iWant.trim()}`);
  if (s.soThat.trim()) parts.push(`para ${s.soThat.trim()}`);
  return parts.join(', ');
}

/** A story's display title: its own title, else the "quiero" part, else "Historia sin título". */
export function storyTitle(s: Pick<UserStory, 'title' | 'iWant'>): string {
  return s.title.trim() || s.iWant.trim() || 'Historia sin título';
}

/** Indent every non-empty line of a Gherkin block by `pad`, normalising the indentation it came with. */
function indentGherkin(text: string, pad: string): string {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  return lines
    .map((l) => l.trim())
    .map((l) => {
      if (!l) return '';
      // Scenario headers sit at `pad`, steps one level deeper.
      if (/^(Escenario|Esquema del escenario|Antecedentes|Ejemplos|Scenario|Background|Examples)\b/i.test(l)) return pad + l;
      if (l.startsWith('|')) return pad + '    ' + l;
      return pad + '  ' + l;
    })
    .join('\n');
}

export interface FeatureGroup {
  /** Característica name. */
  name: string;
  /** Free text under the Característica line. */
  description?: string;
  stories: UserStory[];
}

/** Group stories by epic (stories without one go under `fallback`). Keeps first-seen order. */
export function groupByEpic(stories: UserStory[], fallback: string): FeatureGroup[] {
  const map = new Map<string, UserStory[]>();
  for (const s of stories) {
    const key = s.epic?.trim() || fallback;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return [...map.entries()].map(([name, stories]) => ({ name, stories }));
}

/**
 * A Gherkin feature file in Spanish. One `Característica` per group; each
 * story becomes a comment with its sentence, followed by its scenarios (or a
 * placeholder scenario when it has none yet).
 */
export function buildFeature(groups: FeatureGroup[]): string {
  const out: string[] = ['# language: es'];
  for (const g of groups) {
    out.push('', `Característica: ${g.name}`);
    if (g.description?.trim()) for (const line of g.description.trim().split('\n')) out.push(`  ${line.trim()}`);
    for (const s of g.stories) {
      out.push('', `  # ${storyTitle(s)}`);
      const sentence = storySentence(s);
      if (sentence) out.push(`  # ${sentence}`);
      if (s.gherkin.trim()) out.push(indentGherkin(s.gherkin, '  '));
      else out.push(`  Escenario: ${storyTitle(s)}`, '    # Pendiente: criterios de aceptación');
    }
  }
  return out.join('\n') + '\n';
}

/** One story as a Markdown block: heading, sentence, metadata, Gherkin in a fenced block. */
export function storyMarkdown(s: UserStory, level = 3): string {
  const h = '#'.repeat(level);
  const out = [`${h} ${storyTitle(s)}`];
  const sentence = storySentence(s);
  if (sentence) out.push('', `> ${sentence}.`);
  const meta: string[] = [];
  if (s.epic?.trim()) meta.push(`Épica: ${s.epic.trim()}`);
  if (s.priority?.trim()) meta.push(`Prioridad: ${s.priority.trim()}`);
  if (typeof s.points === 'number' && !Number.isNaN(s.points)) meta.push(`Puntos: ${s.points}`);
  if (meta.length) out.push('', meta.join(' · '));
  if (s.gherkin.trim()) out.push('', '```gherkin', s.gherkin.trim(), '```');
  return out.join('\n');
}

/** Sum of story points, ignoring stories without an estimate. */
export function totalPoints(stories: Pick<UserStory, 'points'>[]): number {
  return stories.reduce((n, s) => n + (typeof s.points === 'number' && !Number.isNaN(s.points) ? s.points : 0), 0);
}

/** "Ana García" → "AG"; "ana" → "AN"; "" → "". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}
