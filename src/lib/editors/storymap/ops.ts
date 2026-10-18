/**
 * Story map edits and exports as pure functions (tests/storymap.test.ts).
 */
import type { StoryMapData } from '../../model/types';
import { buildFeature, groupByEpic, storyMarkdown, totalPoints, storyTitle } from '../../model/stories';

export type MapStory = StoryMapData['stories'][number];

export function cellKey(stepId: string, releaseId: string): string {
  return `${stepId}|${releaseId}`;
}

export function parseCell(key: string): { stepId: string; releaseId: string } {
  const [stepId, releaseId] = key.split('|');
  return { stepId, releaseId };
}

/** Stories in one step × release cell, in order. */
export function storiesIn(data: StoryMapData, stepId: string, releaseId: string): MapStory[] {
  return data.stories.filter((s) => s.stepId === stepId && s.releaseId === releaseId).sort((a, b) => a.order - b.order);
}

function renumber(list: MapStory[]) {
  list.forEach((s, i) => (s.order = i));
}

/** Move a story to a cell, at `index` among the other stories there. */
export function moveStory(data: StoryMapData, id: string, stepId: string, releaseId: string, index: number): void {
  const s = data.stories.find((x) => x.id === id);
  if (!s) return;
  const from = storiesIn(data, s.stepId, s.releaseId).filter((x) => x.id !== id);
  const to = s.stepId === stepId && s.releaseId === releaseId ? from : storiesIn(data, stepId, releaseId).filter((x) => x.id !== id);
  s.stepId = stepId;
  s.releaseId = releaseId;
  to.splice(Math.max(0, Math.min(index, to.length)), 0, s);
  renumber(to);
  if (from !== to) renumber(from);
}

/** All steps, left to right, with their activity. */
export function allSteps(data: StoryMapData): { activityId: string; stepId: string; title: string }[] {
  return data.activities.flatMap((a) => a.steps.map((st) => ({ activityId: a.id, stepId: st.id, title: st.title })));
}

export function removeStep(data: StoryMapData, stepId: string): void {
  for (const a of data.activities) a.steps = a.steps.filter((s) => s.id !== stepId);
  data.stories = data.stories.filter((s) => s.stepId !== stepId);
}

export function removeActivity(data: StoryMapData, activityId: string): void {
  const a = data.activities.find((x) => x.id === activityId);
  if (!a) return;
  const steps = new Set(a.steps.map((s) => s.id));
  data.activities = data.activities.filter((x) => x.id !== activityId);
  data.stories = data.stories.filter((s) => !steps.has(s.stepId));
}

export function removeRelease(data: StoryMapData, releaseId: string): void {
  data.releases = data.releases.filter((r) => r.id !== releaseId);
  data.stories = data.stories.filter((s) => s.releaseId !== releaseId);
}

/** Swap an item with its neighbour in an array. */
export function shift<T extends { id: string }>(list: T[], id: string, dir: -1 | 1): boolean {
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return false;
  [list[i], list[j]] = [list[j], list[i]];
  return true;
}

/** Stories in reading order: release, then activity / step, then position. */
export function orderedStories(data: StoryMapData): MapStory[] {
  const out: MapStory[] = [];
  for (const r of data.releases) for (const st of allSteps(data)) out.push(...storiesIn(data, st.stepId, r.id));
  return out;
}

export function toMarkdown(title: string, data: StoryMapData): string {
  const out = [`# ${title}`, ''];
  if (data.persona.trim()) out.push(`**Persona:** ${data.persona.trim()}`, '');
  out.push('## Backbone', '');
  for (const a of data.activities) {
    out.push(`- **${a.title || 'Actividad'}**`);
    for (const st of a.steps) out.push(`  - ${st.title || 'Paso'}`);
  }
  for (const r of data.releases) {
    const inRelease = data.stories.filter((s) => s.releaseId === r.id);
    const pts = totalPoints(inRelease);
    out.push('', `## ${r.name || 'Release'}${pts ? ` (${pts} pts)` : ''}`);
    if (!inRelease.length) {
      out.push('', '_Sin historias._');
      continue;
    }
    for (const a of data.activities) {
      for (const st of a.steps) {
        const list = storiesIn(data, st.id, r.id);
        if (!list.length) continue;
        out.push('', `### ${a.title || 'Actividad'} › ${st.title || 'Paso'}`);
        for (const s of list) out.push('', storyMarkdown(s, 4));
      }
    }
  }
  return out.join('\n') + '\n';
}

/** Gherkin: one Característica per epic; stories without an epic go under the map's title. */
export function toFeature(title: string, data: StoryMapData): string {
  const groups = groupByEpic(orderedStories(data), title || 'Mapa de historias');
  if (data.persona.trim()) for (const g of groups) g.description = `Para: ${data.persona.trim()}`;
  return buildFeature(groups);
}

export { storyTitle };
