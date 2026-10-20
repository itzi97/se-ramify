/**
 * Working on one folder as a team (a synced folder or a git repository):
 * the pure parts, so they can be tested.
 */
import type { DiagramMeta } from '../model/types';

/** Nextcloud / Syncthing / Dropbox / OneDrive conflict copies. */
export function isConflictCopy(name: string): boolean {
  return /conflicted copy|sync-conflict|\(conflict|conflicto|-conflict-/i.test(name);
}

/**
 * Files that share an id are copies (a sync app's "(1)" copy, a file copied
 * by hand). The one whose name looks like an original stays the diagram;
 * the others get `dupOf` so the list can offer to keep or drop them.
 */
export function markDuplicates(metas: DiagramMeta[]): DiagramMeta[] {
  const byId = new Map<string, DiagramMeta[]>();
  for (const m of metas) {
    if (!byId.has(m.id)) byId.set(m.id, []);
    byId.get(m.id)!.push(m);
  }
  for (const group of byId.values()) {
    if (group.length < 2) continue;
    const name = (m: DiagramMeta) => m.path.split(/[\\/]/).pop() ?? m.path;
    // Originals first: not a conflict copy, no " (1)" / " copy" suffix, then the shortest name.
    const score = (m: DiagramMeta) => (m.conflict || isConflictCopy(name(m)) ? 2 : 0) + (/\(\d+\)|copy|copia/i.test(name(m)) ? 1 : 0);
    const sorted = [...group].sort((a, b) => score(a) - score(b) || name(a).length - name(b).length || name(a).localeCompare(name(b)));
    for (const m of sorted.slice(1)) m.dupOf = sorted[0].path;
  }
  return metas;
}

export interface ConflictSides {
  ours: string;
  theirs: string;
  /** What git wrote after the markers ("HEAD", a branch or commit). */
  oursLabel: string;
  theirsLabel: string;
}

/** True when a file still has git's conflict markers in it. */
export function hasConflictMarkers(text: string): boolean {
  return /^<{7}( |$)/m.test(text) && /^={7}$/m.test(text) && /^>{7}( |$)/m.test(text);
}

/**
 * Split a file with git conflict markers into the two whole versions
 * (also handles the diff3 style with a ||||||| base section). Null when
 * there are no markers or they don't nest properly.
 */
export function splitConflict(text: string): ConflictSides | null {
  if (!hasConflictMarkers(text)) return null;
  const ours: string[] = [];
  const theirs: string[] = [];
  let state: 'both' | 'ours' | 'base' | 'theirs' = 'both';
  let oursLabel = '';
  let theirsLabel = '';
  for (const line of text.split(/\r?\n/)) {
    if (/^<{7}( |$)/.test(line)) {
      if (state !== 'both') return null;
      state = 'ours';
      oursLabel ||= line.slice(8).trim();
    } else if (/^\|{7}( |$)/.test(line) && state === 'ours') {
      state = 'base';
    } else if (/^={7}$/.test(line) && (state === 'ours' || state === 'base')) {
      state = 'theirs';
    } else if (/^>{7}( |$)/.test(line) && state === 'theirs') {
      state = 'both';
      theirsLabel ||= line.slice(8).trim();
    } else if (state === 'both') {
      ours.push(line);
      theirs.push(line);
    } else if (state === 'ours') ours.push(line);
    else if (state === 'theirs') theirs.push(line);
  }
  if (state !== 'both') return null;
  return { ours: ours.join('\n'), theirs: theirs.join('\n'), oursLabel, theirsLabel };
}

/** "Bruno, hace 5 min" style line for tooltips. */
export function editedLine(updated: string, by: string | undefined, now = Date.now()): string {
  const t = Date.parse(updated);
  if (Number.isNaN(t)) return by ? `Edited by ${by}` : '';
  const mins = Math.round((now - t) / 60000);
  const when =
    mins < 1 ? 'just now' : mins < 60 ? `${mins} min ago` : mins < 60 * 24 ? `${Math.round(mins / 60)} h ago` : new Date(t).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  return by ? `Edited by ${by}, ${when}` : `Edited ${when}`;
}
