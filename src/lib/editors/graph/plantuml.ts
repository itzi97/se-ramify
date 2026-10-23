/**
 * PlantUML in: class and use case diagrams typed as text (the same text the
 * PlantUML export writes, and most of what people write by hand), merged into
 * the drawing so shapes that already exist keep their place, colour, notes
 * and specifications. Pure functions; the editor lays out what is new.
 */
import type { GEdge, GNode, GraphData, GraphKind } from '../../model/types';
import { uid } from '../../model/diagram';

export interface ParsedNode {
  key: string;
  type: string;
  label: string;
  attrs?: string[];
  ops?: string[];
  abstract?: boolean;
  stereotype?: string;
  /** The key of the package / system boundary it is inside. */
  parent?: string;
}
export interface ParsedEdge {
  from: string;
  to: string;
  type: string;
  label?: string;
  fromLabel?: string;
  toLabel?: string;
}
export interface ParsedGraph {
  nodes: ParsedNode[];
  edges: ParsedEdge[];
  warnings: { line: number; message: string }[];
}

export const TEXT_KINDS: GraphKind[] = ['class', 'usecase'];

const unq = (s: string) => s.trim().replace(/^"(.*)"$/, '$1').trim();
/** Drop a colour or style in an arrow: "-[#C00]->" → "-->". */
const plainArrow = (a: string) => a.replace(/\[[^\]]*\]/g, '');

/* ------------------------------------------------------------------ class */

// Arrow → [type, reversed]. Reversed: the line is written from the target ("<|--": parent on the left).
const CLASS_ARROWS: Record<string, [string, boolean]> = {
  '--': ['association', false],
  '-': ['association', false],
  '..': ['dependency', false],
  '-->': ['directed', false],
  '->': ['directed', false],
  '<--': ['directed', true],
  '<-': ['directed', true],
  'o--': ['aggregation', false],
  '--o': ['aggregation', true],
  '*--': ['composition', false],
  '--*': ['composition', true],
  '--|>': ['generalization', false],
  '-|>': ['generalization', false],
  '<|--': ['generalization', true],
  '<|-': ['generalization', true],
  '..|>': ['realization', false],
  '.|>': ['realization', false],
  '<|..': ['realization', true],
  '<|.': ['realization', true],
  '..>': ['dependency', false],
  '.>': ['dependency', false],
  '<..': ['dependency', true],
  '<.': ['dependency', true]
};

/** `A "1" -- "0..*" B : label`, with names quoted or not. */
const REL = /^("[^"]+"|[\p{L}\p{N}_.$]+)\s*(?:"([^"]*)")?\s*([<>|o*.\-]*(?:\[[^\]]*\])?[<>|o*.\-]+)\s*(?:"([^"]*)")?\s*("[^"]+"|[\p{L}\p{N}_.$]+)\s*(?::\s*(.*))?$/u;

export function parseClassPuml(text: string): ParsedGraph {
  const nodes: ParsedNode[] = [];
  const edges: ParsedEdge[] = [];
  const warnings: ParsedGraph['warnings'] = [];
  const byKey = new Map<string, ParsedNode>();
  const stack: string[] = [];
  const skip = new Set<string>();
  let open: ParsedNode | null = null;
  const ensure = (ref: string): ParsedNode => {
    const k = unq(ref);
    let n = byKey.get(k);
    if (!n) {
      n = { key: k, type: 'class', label: k, attrs: [], ops: [], parent: stack[stack.length - 1] };
      byKey.set(k, n);
      nodes.push(n);
    }
    return n;
  };
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const t = raw.trim();
    if (!t || t.startsWith("'") || /^@(start|end)uml/i.test(t) || /^(hide|show|skinparam|left to right|top to bottom|title|scale)\b/i.test(t)) continue;
    if (open) {
      if (t === '}') {
        open = null;
        continue;
      }
      const m = t.replace(/^\{static\}\s*/, '_').replace(/^\{abstract\}\s*/, '');
      if (open.type === 'enum') open.attrs!.push(m.replace(/,$/, ''));
      else if (m.includes('(')) open.ops!.push(m);
      else open.attrs!.push(m);
      continue;
    }
    // Notes: skipped (the canvas keeps its own); their links too.
    if (/^note\b/i.test(t)) {
      const alias = /\bas\s+([\p{L}\p{N}_.$]+)\s*$/u.exec(t);
      if (alias) skip.add(alias[1]);
      else if (!t.includes(':')) {
        while (i + 1 < lines.length && !/^\s*end ?note/i.test(lines[i + 1])) i++;
        i++;
      }
      continue;
    }
    const pkg = /^(package|namespace)\s+("[^"]+"|\S+)(?:\s+as\s+(\S+))?.*\{\s*$/i.exec(t);
    if (pkg) {
      const label = unq(pkg[2]);
      const key = pkg[3] ?? label;
      const n: ParsedNode = { key, type: 'package', label, parent: stack[stack.length - 1] };
      byKey.set(key, n);
      nodes.push(n);
      stack.push(key);
      continue;
    }
    if (t === '}') {
      stack.pop();
      continue;
    }
    const decl = /^(abstract\s+class|abstract|class|interface|enum)\s+("[^"]+"|[\p{L}\p{N}_.$]+)(?:\s+as\s+([\p{L}\p{N}_.$]+))?\s*(?:<<\s*([^>]+?)\s*>>)?[^{]*?(\{)?\s*(\})?\s*$/iu.exec(t);
    if (decl) {
      const kw = decl[1].toLowerCase().replace(/\s+/g, ' ');
      const label = unq(decl[2]);
      const key = decl[3] ?? label;
      let n = byKey.get(key);
      if (!n) {
        n = { key, type: 'class', label, attrs: [], ops: [], parent: stack[stack.length - 1] };
        byKey.set(key, n);
        nodes.push(n);
      }
      n.label = label;
      n.type = kw === 'interface' ? 'interface' : kw === 'enum' ? 'enum' : 'class';
      n.abstract = kw.startsWith('abstract') || undefined;
      if (decl[4] && !['interface', 'enumeration'].includes(decl[4])) n.stereotype = decl[4];
      if (decl[5] && !decl[6]) open = n;
      continue;
    }
    // "Clase : + metodo()" adds a member.
    const member = /^("[^"]+"|[\p{L}\p{N}_.$]+)\s*:\s*(.+)$/u.exec(t);
    if (member && !REL.test(t)) {
      const n = ensure(member[1]);
      const m = member[2].trim();
      (m.includes('(') ? n.ops! : n.attrs!).push(m);
      continue;
    }
    const rel = REL.exec(t);
    if (rel) {
      const arrow = plainArrow(rel[3]);
      const known = CLASS_ARROWS[arrow] ?? CLASS_ARROWS[arrow.replace(/-+/g, '--').replace(/\.+/g, '..')];
      if (!known) {
        warnings.push({ line: i + 1, message: `unknown line "${rel[3]}"` });
        continue;
      }
      const [type, reversed] = known;
      if (skip.has(unq(rel[1])) || skip.has(unq(rel[5]))) continue;
      const a = ensure(rel[1]).key;
      const b = ensure(rel[5]).key;
      const label = rel[6]?.trim().replace(/^[<>]\s*|\s*[<>]$/g, '') || undefined;
      edges.push(reversed ? { from: b, to: a, type, label, fromLabel: rel[4] || undefined, toLabel: rel[2] || undefined } : { from: a, to: b, type, label, fromLabel: rel[2] || undefined, toLabel: rel[4] || undefined });
      continue;
    }
    warnings.push({ line: i + 1, message: `not understood: ${t.slice(0, 60)}` });
  }
  return { nodes, edges, warnings };
}

/* --------------------------------------------------------------- use case */

const UC_ARROWS: Record<string, [string, boolean]> = {
  '--': ['association', false],
  '-': ['association', false],
  '-->': ['association', false],
  '->': ['association', false],
  '<--': ['association', true],
  '<-': ['association', true],
  '..>': ['dependency', false],
  '.>': ['dependency', false],
  '<..': ['dependency', true],
  '<.': ['dependency', true],
  '..': ['dependency', false],
  '--|>': ['generalization', false],
  '-|>': ['generalization', false],
  '<|--': ['generalization', true],
  '<|-': ['generalization', true]
};

/** An actor or use case as written in a line: `:Socio:`, `(Prestar libro)`, `"x"` or an alias. */
const UC_REF = String.raw`(:[^:]+:|\([^)]+\)|"[^"]+"|[\p{L}\p{N}_.$]+)`;
const UC_REL = new RegExp(`^${UC_REF}\\s*([<>|.\\-]*(?:\\[[^\\]]*\\])?[<>|.\\-]+)\\s*${UC_REF}\\s*(?::\\s*(.*))?$`, 'u');

export function parseUsecasePuml(text: string): ParsedGraph {
  const nodes: ParsedNode[] = [];
  const edges: ParsedEdge[] = [];
  const warnings: ParsedGraph['warnings'] = [];
  const byKey = new Map<string, ParsedNode>();
  const stack: string[] = [];
  const skip = new Set<string>();
  const add = (key: string, type: string, label: string) => {
    let n = byKey.get(key);
    if (!n) {
      n = { key, type, label, parent: type === 'usecase' ? stack[stack.length - 1] : undefined };
      byKey.set(key, n);
      nodes.push(n);
    } else {
      n.type = type;
      n.label = label;
    }
    return n;
  };
  const ref = (r: string): ParsedNode => {
    if (r.startsWith(':')) return add(r.slice(1, -1).trim(), 'actor', r.slice(1, -1).trim());
    if (r.startsWith('(')) return add(r.slice(1, -1).trim(), 'usecase', r.slice(1, -1).trim());
    const k = unq(r);
    return byKey.get(k) ?? add(k, 'usecase', k);
  };
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t || t.startsWith("'") || /^@(start|end)uml/i.test(t) || /^(skinparam|left to right|top to bottom|title|scale|hide|show)\b/i.test(t)) continue;
    // Notes: skipped (the canvas keeps its own); their links too.
    if (/^note\b/i.test(t)) {
      const alias = /\bas\s+([\p{L}\p{N}_.$]+)\s*$/u.exec(t);
      if (alias) skip.add(alias[1]);
      else if (!t.includes(':')) {
        while (i + 1 < lines.length && !/^\s*end ?note/i.test(lines[i + 1])) i++;
        i++;
      }
      continue;
    }
    const box = /^(rectangle|package)\s+("[^"]+"|\S+)(?:\s+as\s+(\S+))?.*\{\s*$/i.exec(t);
    if (box) {
      const label = unq(box[2]);
      const key = box[3] ?? label;
      const n = add(key, 'boundary', label);
      n.parent = stack[stack.length - 1];
      stack.push(key);
      continue;
    }
    if (t === '}') {
      stack.pop();
      continue;
    }
    const actor = /^actor\s+("[^"]+"|:[^:]+:|[\p{L}\p{N}_.$]+)(?:\s+as\s+([\p{L}\p{N}_.$]+))?/iu.exec(t) ?? /^(:[^:]+:)\s+as\s+([\p{L}\p{N}_.$]+)/u.exec(t);
    if (actor) {
      const label = unq(actor[1].replace(/^:|:$/g, ''));
      add(actor[2] ?? label, 'actor', label);
      continue;
    }
    const uc = /^usecase\s+("[^"]+"|\([^)]+\)|[\p{L}\p{N}_.$]+)(?:\s+as\s+([\p{L}\p{N}_.$]+))?/iu.exec(t) ?? /^(\([^)]+\))\s+as\s+([\p{L}\p{N}_.$]+)/u.exec(t);
    if (uc) {
      const label = unq(uc[1].replace(/^\(|\)$/g, ''));
      add(uc[2] ?? label, 'usecase', label);
      continue;
    }
    const rel = UC_REL.exec(t);
    if (rel) {
      const arrow = plainArrow(rel[2]);
      const known = UC_ARROWS[arrow] ?? UC_ARROWS[arrow.replace(/-+/g, '--').replace(/\.+/g, '..')];
      if (!known) {
        warnings.push({ line: i + 1, message: `unknown line "${rel[2]}"` });
        continue;
      }
      let [type, reversed] = known;
      if (skip.has(unq(rel[1])) || skip.has(unq(rel[3]))) continue;
      const a = ref(rel[1]).key;
      const b = ref(rel[3]).key;
      let label = rel[4]?.trim();
      const st = label && /<<\s*(include|extend)\s*>>/i.exec(label);
      if (st) {
        type = st[1].toLowerCase();
        label = label!.replace(st[0], '').trim();
      }
      edges.push(reversed ? { from: b, to: a, type, label: label || undefined } : { from: a, to: b, type, label: label || undefined });
      continue;
    }
    warnings.push({ line: i + 1, message: `not understood: ${t.slice(0, 60)}` });
  }
  return { nodes, edges, warnings };
}

export function parseGraphPuml(kind: GraphKind, text: string): ParsedGraph {
  return kind === 'class' ? parseClassPuml(text) : parseUsecasePuml(text);
}

/* ------------------------------------------------------------------ merge */

const fold = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const group = (type: string) => (['class', 'interface', 'enum'].includes(type) ? 'class' : type);

/**
 * The drawing after the text: shapes with the same name (and kind) keep their
 * id, place, colour and the rest; new ones come without a place (`placed`
 * says which ones need laying out). Notes on the canvas stay.
 */
export function mergeGraph(current: GraphData, parsed: ParsedGraph): { data: GraphData; fresh: Set<string>; parentOf: Map<string, string> } {
  const used = new Set<string>();
  const old = current.nodes.filter((n) => n.type !== 'note');
  const idOf = new Map<string, string>();
  const fresh = new Set<string>();
  const nodes: GNode[] = [];
  for (const p of parsed.nodes) {
    const same = old.find((n) => !used.has(n.id) && group(n.type) === group(p.type) && fold(n.label) === fold(p.label));
    if (same) {
      used.add(same.id);
      idOf.set(p.key, same.id);
      const next: GNode = { ...same, type: p.type, label: p.label };
      if (p.type === 'class' || p.type === 'interface' || p.type === 'enum') {
        next.attrs = p.attrs ?? [];
        next.ops = p.ops ?? [];
        next.abstract = p.abstract;
        next.stereotype = p.stereotype;
      }
      nodes.push(next);
    } else {
      const id = uid();
      idOf.set(p.key, id);
      fresh.add(id);
      const n: GNode = { id, type: p.type, x: 0, y: 0, label: p.label };
      if (p.attrs) n.attrs = p.attrs;
      if (p.ops) n.ops = p.ops;
      if (p.abstract) n.abstract = true;
      if (p.stereotype) n.stereotype = p.stereotype;
      nodes.push(n);
    }
  }
  const notes = current.nodes.filter((n) => n.type === 'note');
  const ids = new Set(nodes.map((n) => n.id));
  const edges: GEdge[] = [];
  const oldEdges = [...current.edges];
  for (const e of parsed.edges) {
    const from = idOf.get(e.from)!;
    const to = idOf.get(e.to)!;
    const same = oldEdges.findIndex((o) => o.from === from && o.to === to && o.type === e.type);
    const base = same >= 0 ? oldEdges.splice(same, 1)[0] : { id: uid(), from, to, type: e.type };
    edges.push({ ...base, label: e.label, fromLabel: e.fromLabel, toLabel: e.toLabel });
  }
  // Note links to shapes that are still there.
  for (const o of current.edges) if (o.type === 'noteLink' && (ids.has(o.from) || ids.has(o.to))) edges.push(o);
  const parentOf = new Map<string, string>();
  for (const p of parsed.nodes) if (p.parent && idOf.has(p.parent)) parentOf.set(idOf.get(p.key)!, idOf.get(p.parent)!);
  return { data: { ...current, nodes: [...nodes, ...notes], edges: edges.map(clean) }, fresh, parentOf };
}

/** No undefined fields in what is saved. */
function clean(e: GEdge): GEdge {
  const out = { ...e } as Record<string, unknown>;
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out as unknown as GEdge;
}
