/**
 * The project's model: what its diagrams say about the system, read across
 * diagrams. The class diagrams give the classes with their attributes and
 * operations (and who inherits from whom); the use case diagrams give the
 * actors and use cases. Other diagrams are checked against it, as StarUML or
 * Visual Paradigm do: a sequence message should be an operation of the class
 * it is sent to.
 */
import type { Diagram, GraphData, SequenceData, SeqItem } from './types';

export interface Param {
  name: string;
  type: string;
}
export interface Operation {
  /** The line as written in the class ("+ mover(actual: int, unidades: int): boolean"). */
  line: string;
  vis: string;
  name: string;
  params: Param[];
  ret: string;
}
export interface ClassInfo {
  name: string;
  attrs: string[];
  ops: Operation[];
  /** Names of the classes it inherits from (generalisation, realisation). */
  parents: string[];
  abstract: boolean;
  /** Where it is drawn, for "Add to …" fixes. */
  diagramId: string;
  diagramTitle: string;
  nodeId: string;
}
export interface UmlModel {
  /** By lower-case name. */
  classes: Map<string, ClassInfo>;
  actors: string[];
  useCases: string[];
}

const fold = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** "+ mover(actual: int, unidades: int): boolean" or "+ mover(int actual, int unidades): boolean". */
export function parseOperation(line: string): Operation | null {
  const m = /^\s*([+\-#~])?\s*([\p{L}_$][\p{L}\p{N}_$]*)\s*\(([^)]*)\)\s*(?::\s*(.+))?$/u.exec(line);
  if (!m) return null;
  const params = m[3]
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p): Param => {
      // "nombre: Tipo" (UML) or "Tipo nombre" (Java style).
      const colon = /^([\p{L}\p{N}_$]+)\s*:\s*(.+)$/u.exec(p);
      if (colon) return { name: colon[1], type: colon[2].trim() };
      const parts = p.split(/\s+/);
      return parts.length > 1 ? { name: parts[parts.length - 1], type: parts.slice(0, -1).join(' ') } : { name: p, type: '' };
    });
  return { line: line.trim(), vis: m[1] ?? '', name: m[2], params, ret: (m[4] ?? '').trim() };
}

/** "j:Jugador", ":Jugador", "j : Jugador", "Jugador" → the instance name and the class. */
export function parseLifeline(name: string): { obj: string; type: string } {
  const i = name.indexOf(':');
  if (i < 0) return { obj: '', type: name.trim() };
  return { obj: name.slice(0, i).trim(), type: name.slice(i + 1).trim() };
}

/** "mover(casillaActual, v1 + v2)" → the operation name and how many arguments; "v1" (a reply) or "x = y" → null. */
export function parseCall(text: string): { name: string; args: number } | null {
  const t = text.replace(/^\s*(«[^»]*»|<<[^>]*>>)\s*/, '').trim();
  const m = /^(?:[\p{L}\p{N}_$]+\s*=\s*)?([\p{L}_$][\p{L}\p{N}_$]*)\s*\((.*)\)\s*$/u.exec(t);
  if (!m) return null;
  let depth = 0;
  let args = m[2].trim() ? 1 : 0;
  for (const ch of m[2]) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) args++;
  }
  return { name: m[1], args };
}

const INHERIT = new Set(['generalization', 'realization', 'inheritance', 'implements']);

export function buildModel(docs: Diagram[]): UmlModel {
  const classes = new Map<string, ClassInfo>();
  const actors = new Set<string>();
  const useCases = new Set<string>();
  for (const d of docs) {
    if (d.kind === 'class') {
      const g = d.data as GraphData;
      const byId = new Map(g.nodes.map((n) => [n.id, n]));
      for (const n of g.nodes) {
        if (n.type !== 'class' && n.type !== 'interface' && n.type !== 'abstract' && n.type !== 'enum') continue;
        const name = n.label.trim();
        if (!name) continue;
        const ops = (n.ops ?? []).map(parseOperation).filter((o): o is Operation => !!o);
        const prev = classes.get(fold(name));
        // The same class drawn in two diagrams: one class with everything either says.
        if (prev) {
          for (const o of ops) if (!prev.ops.some((p) => p.name === o.name && p.params.length === o.params.length)) prev.ops.push(o);
          for (const a of n.attrs ?? []) if (!prev.attrs.includes(a)) prev.attrs.push(a);
          continue;
        }
        classes.set(fold(name), { name, attrs: [...(n.attrs ?? [])], ops, parents: [], abstract: !!n.abstract || n.type === 'abstract', diagramId: d.id, diagramTitle: d.title, nodeId: n.id });
      }
      for (const e of g.edges) {
        if (!INHERIT.has(e.type)) continue;
        const child = byId.get(e.from)?.label.trim();
        const parent = byId.get(e.to)?.label.trim();
        const c = child && classes.get(fold(child));
        if (c && parent && !c.parents.includes(parent)) c.parents.push(parent);
      }
    } else if (d.kind === 'usecase') {
      for (const n of (d.data as GraphData).nodes) {
        if (n.type === 'actor' && n.label.trim()) actors.add(n.label.trim());
        if (n.type === 'usecase' && n.label.trim()) useCases.add(n.label.trim());
      }
    }
  }
  return { classes, actors: [...actors].sort(), useCases: [...useCases].sort() };
}

export function findClass(model: UmlModel, name: string): ClassInfo | undefined {
  return model.classes.get(fold(name));
}

/** A class's operations and its parents' (each once, the closest first). */
export function allOperations(model: UmlModel, name: string): Operation[] {
  const out: Operation[] = [];
  const seen = new Set<string>();
  const walk = (n: string) => {
    const c = findClass(model, n);
    if (!c || seen.has(fold(c.name))) return;
    seen.add(fold(c.name));
    for (const o of c.ops) if (!out.some((x) => x.name === o.name && x.params.length === o.params.length)) out.push(o);
    c.parents.forEach(walk);
  };
  walk(name);
  return out;
}

/** "mover(actual, unidades)": an operation as a message, for suggestions. */
export const asMessage = (o: Operation) => `${o.name}(${o.params.map((p) => p.name).join(', ')})`;

/** Edit distance, for "did you mean". */
function distance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
function closest(name: string, options: string[]): string | null {
  let best: string | null = null;
  let bd = Infinity;
  for (const o of options) {
    const dd = distance(fold(name), fold(o));
    if (dd < bd) [best, bd] = [o, dd];
  }
  return best !== null && bd <= Math.max(1, Math.floor(name.length / 4)) ? best : null;
}

export type Fix =
  | { kind: 'add-op'; className: string; line: string }
  | { kind: 'rename-part'; partId: string; to: string }
  | { kind: 'rename-call'; itemId: string; from: string; to: string };

export interface Issue {
  /** What it is about: a participant or a message (for selecting it). */
  partId?: string;
  itemId?: string;
  level: 'warn' | 'info';
  text: string;
  fix?: { label: string; fix: Fix };
}

/**
 * Check a sequence diagram against the model. Says nothing when the project
 * has no class diagram (nothing to check against).
 */
export function checkSequence(data: SequenceData, model: UmlModel): Issue[] {
  if (!model.classes.size) return [];
  const out: Issue[] = [];
  const names = [...model.classes.values()].map((c) => c.name);
  const typeOf = new Map<string, string | null>();
  for (const p of data.participants) {
    // Actors, databases and the analysis classes (boundary, control) aren't usually in the design class diagram.
    if (p.kind === 'actor' || p.kind === 'database' || p.kind === 'boundary' || p.kind === 'control') {
      typeOf.set(p.id, null);
      continue;
    }
    const { type } = parseLifeline(p.name);
    if (!type) {
      typeOf.set(p.id, null);
      continue;
    }
    const c = findClass(model, type);
    typeOf.set(p.id, c ? c.name : null);
    if (!c) {
      const near = closest(type, names);
      const { obj } = parseLifeline(p.name);
      out.push({
        partId: p.id,
        level: 'warn',
        text: `"${type}" isn't a class in this folder's class diagrams.${near ? ` Did you mean ${near}?` : ''}`,
        fix: near ? { label: `Use ${near}`, fix: { kind: 'rename-part', partId: p.id, to: `${obj}:${near}` } } : undefined
      });
    }
  }
  const visit = (items: SeqItem[]) => {
    for (const it of items) {
      if (it.t !== 'msg' || it.style === 'reply' || it.style === 'destroy') continue;
      const cls = typeOf.get(it.to);
      if (!cls) continue;
      const call = parseCall(it.text);
      if (!call) continue;
      if (it.style === 'create' && fold(call.name) === 'new') continue;
      const ops = allOperations(model, cls);
      const same = ops.filter((o) => o.name === call.name);
      if (!same.length) {
        const near = closest(
          call.name,
          ops.map((o) => o.name)
        );
        const params = Array.from({ length: call.args }, (_, i) => `p${i + 1}`).join(', ');
        out.push({
          itemId: it.id,
          level: 'warn',
          text: `${cls} has no operation ${call.name}().${near ? ` Did you mean ${near}()?` : ''}`,
          fix: near
            ? { label: `Use ${near}()`, fix: { kind: 'rename-call', itemId: it.id, from: call.name, to: near } }
            : { label: `Add ${call.name}() to ${cls}`, fix: { kind: 'add-op', className: cls, line: `+ ${call.name}(${params})` } }
        });
      } else if (!same.some((o) => o.params.length === call.args)) {
        const o = same[0];
        out.push({ itemId: it.id, level: 'info', text: `${cls}.${o.name}() takes ${o.params.length} argument${o.params.length === 1 ? '' : 's'} (${o.params.map((p) => p.name).join(', ') || 'none'}); this message passes ${call.args}.` });
      }
    }
  };
  visit(data.items);
  return out;
}
