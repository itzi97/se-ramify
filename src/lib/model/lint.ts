/**
 * UML checks for the canvas diagrams, the kind a teacher marks down: an actor
 * with no use case, a use case nobody starts, a decision with one way out,
 * a state you can't reach, an operation written so it isn't one. Each points
 * at the shape or line it is about, so the canvas can mark it and select it.
 * Communication diagrams are also checked against the folder's class
 * diagrams, like sequence diagrams.
 */
import type { GEdge, GNode, GraphData, GraphKind } from './types';
import { allOperations, findClass, parseCall, parseLifeline, parseOperation, type UmlModel } from './uml-model';

export interface LintIssue {
  nodeId?: string;
  edgeId?: string;
  level: 'warn' | 'info';
  text: string;
}

const name = (n: GNode) => n.label.trim() || 'sin nombre';
const isNote = (n: GNode) => n.type === 'note';
const fold = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function lintGraph(kind: GraphKind, g: GraphData, model?: UmlModel): LintIssue[] {
  const out: LintIssue[] = [];
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const edges = g.edges.filter((e) => e.type !== 'noteLink' && byId.has(e.from) && byId.has(e.to));
  const touching = (id: string, types?: string[]) => edges.filter((e) => (e.from === id || e.to === id) && (!types || types.includes(e.type)));
  const outOf = (id: string) => edges.filter((e) => e.from === id);
  const into = (id: string) => edges.filter((e) => e.to === id);
  const dupNames = (types: string[], what: string) => {
    const seen = new Map<string, GNode>();
    for (const n of g.nodes) {
      if (!types.includes(n.type) || !n.label.trim()) continue;
      const k = fold(n.label);
      if (seen.has(k)) out.push({ nodeId: n.id, level: 'warn', text: `Two ${what} called "${name(n)}". If they are the same, keep one and connect it twice.` });
      else seen.set(k, n);
    }
  };

  if (kind === 'usecase') {
    const actors = g.nodes.filter((n) => n.type === 'actor');
    const ucs = g.nodes.filter((n) => n.type === 'usecase');
    for (const a of actors) if (!touching(a.id).length) out.push({ nodeId: a.id, level: 'warn', text: `The actor "${name(a)}" isn't connected to any use case.` });
    // A use case is started by an actor, or reached from one that includes it, is extended by it, or it specialises.
    const reached = new Set<string>();
    for (const e of edges) {
      const a = byId.get(e.from)!;
      const b = byId.get(e.to)!;
      if (e.type === 'association') {
        if (a.type === 'actor' && b.type === 'usecase') reached.add(b.id);
        if (b.type === 'actor' && a.type === 'usecase') reached.add(a.id);
      }
    }
    for (let changed = true; changed; ) {
      changed = false;
      for (const e of edges) {
        // include: base → included; extend: extension → base; generalisation: child → parent.
        const pairs = e.type === 'include' ? [[e.from, e.to]] : e.type === 'extend' ? [[e.to, e.from]] : e.type === 'generalization' ? [[e.to, e.from]] : [];
        for (const [from, to] of pairs) if (reached.has(from) && !reached.has(to) && byId.get(to)?.type === 'usecase') (reached.add(to), (changed = true));
      }
    }
    for (const u of ucs) if (!reached.has(u.id)) out.push({ nodeId: u.id, level: 'warn', text: `No actor starts "${name(u)}" (no association, include or extend reaches it).` });
    for (const e of edges) {
      const a = byId.get(e.from)!;
      const b = byId.get(e.to)!;
      if ((e.type === 'include' || e.type === 'extend') && (a.type !== 'usecase' || b.type !== 'usecase')) out.push({ edgeId: e.id, level: 'warn', text: `«${e.type}» goes between two use cases, not to an actor.` });
      if (e.type === 'association' && a.type === 'usecase' && b.type === 'usecase') out.push({ edgeId: e.id, level: 'warn', text: `"${name(a)}" and "${name(b)}" are joined by a plain line: between use cases it should be «include», «extend» or a generalisation.` });
      if (e.type === 'association' && a.type === 'actor' && b.type === 'actor') out.push({ edgeId: e.id, level: 'warn', text: `Two actors joined by an association: between actors only a generalisation makes sense.` });
    }
    dupNames(['usecase'], 'use cases');
    dupNames(['actor'], 'actors');
  }

  if (kind === 'class') {
    const classes = g.nodes.filter((n) => n.type === 'class' || n.type === 'interface' || n.type === 'enum');
    for (const c of classes) {
      if (/^(clase|interfaz|enumeracion)\d*$/i.test(c.label.trim())) out.push({ nodeId: c.id, level: 'info', text: `"${name(c)}" still has its default name.` });
      for (const line of c.ops ?? []) {
        if (line.trim() && !parseOperation(line)) out.push({ nodeId: c.id, level: 'warn', text: `In ${name(c)}, "${line.trim()}" isn't written as an operation: nombre(parámetros): Tipo.` });
      }
      if (c.type === 'class') {
        for (const line of c.attrs ?? []) {
          const t = line.trim();
          if (t && !t.includes(':') && !/^\S+\s+\S+/.test(t.replace(/^[+\-#~]\s*/, ''))) out.push({ nodeId: c.id, level: 'info', text: `In ${name(c)}, the attribute "${t}" has no type (nombre: Tipo).` });
        }
      }
    }
    for (const e of edges) {
      if (!['association', 'directed', 'aggregation', 'composition'].includes(e.type)) continue;
      if (!e.fromLabel?.trim() && !e.toLabel?.trim()) out.push({ edgeId: e.id, level: 'info', text: `The ${e.type === 'directed' ? 'association' : e.type} between ${name(byId.get(e.from)!)} and ${name(byId.get(e.to)!)} has no multiplicity (1, 0..1, *…).` });
    }
    dupNames(['class', 'interface', 'enum'], 'classes');
  }

  if (kind === 'activity') {
    const initials = g.nodes.filter((n) => n.type === 'initial');
    const finals = g.nodes.filter((n) => n.type === 'final' || n.type === 'flowFinal');
    const steps = g.nodes.filter((n) => !isNote(n) && n.type !== 'partition');
    if (steps.length && !initials.length) out.push({ level: 'warn', text: 'No initial node: where does the activity start?' });
    if (steps.length && !finals.length) out.push({ level: 'warn', text: 'No final node: where does it end?' });
    for (const n of steps) {
      if (n.type === 'decision' && outOf(n.id).length === 1 && into(n.id).length === 1) out.push({ nodeId: n.id, level: 'warn', text: 'A decision with one way in and one way out decides nothing.' });
      if (n.type === 'decision' && outOf(n.id).length > 1) {
        const bare = outOf(n.id).filter((e) => !e.label?.trim());
        if (bare.length) out.push({ nodeId: n.id, level: 'info', text: `${bare.length} way${bare.length === 1 ? '' : 's'} out of a decision without a guard ([condición]).` });
      }
      if (n.type === 'action' && !outOf(n.id).length) out.push({ nodeId: n.id, level: 'warn', text: `"${name(n)}" leads nowhere: connect it to the next step or a final node.` });
      if ((n.type === 'action' || n.type === 'decision') && !into(n.id).length) out.push({ nodeId: n.id, level: 'warn', text: `Nothing leads to ${n.type === 'action' ? `"${name(n)}"` : 'this decision'}.` });
    }
    out.push(...unreachable(g, edges, initials, (n) => n.type === 'action', 'action'));
  }

  if (kind === 'state') {
    const initials = g.nodes.filter((n) => n.type === 'initial');
    const states = g.nodes.filter((n) => n.type === 'state' || n.type === 'composite');
    if (states.length && !initials.length) out.push({ level: 'warn', text: 'No initial state: which state does it start in?' });
    for (const s of states) if (s.type === 'state' && !outOf(s.id).length && !g.nodes.some((n) => n.type === 'final')) out.push({ nodeId: s.id, level: 'info', text: `"${name(s)}" has no way out.` });
    for (const e of edges) if (e.type === 'transition' && byId.get(e.from)?.type !== 'initial' && !e.label?.trim()) out.push({ edgeId: e.id, level: 'info', text: `A transition from "${name(byId.get(e.from)!)}" without its event (evento [guarda] / acción).` });
    out.push(...unreachable(g, edges, initials, (n) => n.type === 'state', 'state'));
    dupNames(['state'], 'states');
  }

  if (kind === 'communication' && model?.classes.size) {
    for (const e of edges) {
      for (const m of e.messages ?? []) {
        const target = byId.get(m.dir === 'forward' ? e.to : e.from);
        if (!target || target.type !== 'object') continue;
        const type = parseLifeline(target.label).type;
        if (!type || !findClass(model, type)) continue;
        const call = parseCall(m.text.replace(/^\s*[\d.a-z]+\s*:\s*/i, ''));
        if (call && !allOperations(model, type).some((o) => o.name === call.name)) out.push({ edgeId: e.id, level: 'warn', text: `${m.seq}: ${type} has no operation ${call.name}() in the class diagram.` });
      }
    }
    for (const n of g.nodes) {
      if (n.type !== 'object') continue;
      const type = parseLifeline(n.label).type;
      if (type && !findClass(model, type)) out.push({ nodeId: n.id, level: 'info', text: `"${type}" isn't a class in this folder's class diagrams.` });
    }
  }

  return out;
}

/** Shapes no path from an initial node reaches. */
function unreachable(g: GraphData, edges: GEdge[], initials: GNode[], counts: (n: GNode) => boolean, what: string): LintIssue[] {
  if (!initials.length) return [];
  const seen = new Set(initials.map((n) => n.id));
  const todo = [...seen];
  while (todo.length) {
    const id = todo.pop()!;
    for (const e of edges) if (e.from === id && !seen.has(e.to)) (seen.add(e.to), todo.push(e.to));
  }
  // A container (swimlane, composite state) is reached when something inside it is: skip containers.
  return g.nodes.filter((n) => counts(n) && !seen.has(n.id)).map((n) => ({ nodeId: n.id, level: 'warn' as const, text: `No path from the start reaches the ${what} "${name(n)}".` }));
}
