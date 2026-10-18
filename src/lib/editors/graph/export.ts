/**
 * Text exports for the canvas kinds: PlantUML and Mermaid where the
 * notation exists, Markdown and CSV for the rest (and for use case
 * specifications, inventories and traceability matrices). Pure functions.
 */
import { nodeTypeInfo, PALETTES } from '../../model/kinds';
import type { DiagramOf, GEdge, GNode, GraphData, GraphKind } from '../../model/types';
import { blankSpec } from '../../model/diagram';
import type { TextExport } from '../types';
import { parentsOf, type Rect } from './geometry';
import { childrenMap, mindmapRoot } from './layout';
import { estimateSize } from './sizing';

const md = (label: string, build: () => string): TextExport => ({ label: `${label} (Markdown)`, ext: 'md', mime: 'text/markdown', build });
const puml = (build: () => string): TextExport => ({ label: 'PlantUML (.puml)', ext: 'puml', mime: 'text/plain', build });
const mmd = (build: () => string): TextExport => ({ label: 'Mermaid (.mmd)', ext: 'mmd', mime: 'text/plain', build });
const csv = (label: string, build: () => string): TextExport => ({ label: `${label} (CSV)`, ext: 'csv', mime: 'text/csv', build });

/** One line, quotes escaped, for PlantUML / Mermaid labels. */
const one = (s: string) => (s ?? '').replace(/\s*\n\s*/g, ' ').replace(/"/g, "'").trim();
const cell = (s: string) => (s ?? '').replace(/\|/g, '\\|').replace(/\n/g, '<br>');
const csvCell = (s: string) => `"${(s ?? '').replace(/"/g, '""')}"`;

/** Stable short aliases (A1, UC2…) so the text stays readable. */
function aliases(nodes: GNode[], prefix: (n: GNode) => string): Map<string, string> {
  const count = new Map<string, number>();
  const out = new Map<string, string>();
  for (const n of nodes) {
    const p = prefix(n);
    const i = (count.get(p) ?? 0) + 1;
    count.set(p, i);
    out.set(n.id, `${p}${i}`);
  }
  return out;
}

/** Which container holds each node, from the drawing (sizes estimated when there's no DOM). */
function containment(kind: GraphKind, g: GraphData): Map<string, string | null> {
  const rects = new Map<string, Rect>();
  const containers = new Set<string>();
  for (const n of g.nodes) {
    const info = nodeTypeInfo(kind, n.type, n.icon);
    const s = estimateSize(kind, n, info);
    rects.set(n.id, { x: n.x, y: n.y, w: s.w, h: s.h });
    if (info.container) containers.add(n.id);
  }
  return parentsOf(rects, containers);
}

/** Emit nodes nested in their containers: `open(n)` / `close(n)` for containers, `leaf(n)` for the rest. */
function nested(kind: GraphKind, g: GraphData, open: (n: GNode, depth: number) => string, close: (n: GNode, depth: number) => string, leaf: (n: GNode, depth: number) => string | null): string[] {
  const parents = containment(kind, g);
  const out: string[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const n of g.nodes.filter((x) => (parents.get(x.id) ?? null) === parent)) {
      const info = nodeTypeInfo(kind, n.type, n.icon);
      if (info.container) {
        out.push(open(n, depth));
        walk(n.id, depth + 1);
        out.push(close(n, depth));
      } else {
        const l = leaf(n, depth);
        if (l !== null) out.push(l);
      }
    }
  };
  walk(null, 0);
  return out;
}

const pad = (d: number) => '  '.repeat(d);
const byId = (g: GraphData) => new Map(g.nodes.map((n) => [n.id, n]));

/* ---------------------------------------------------------------- use case */

function usecasePuml(g: GraphData): string {
  const al = aliases(g.nodes, (n) => (n.type === 'actor' ? 'A' : n.type === 'usecase' ? 'UC' : n.type === 'note' ? 'N' : 'S'));
  const lines = ['@startuml', 'left to right direction', 'skinparam packageStyle rectangle', ''];
  lines.push(
    ...nested(
      'usecase',
      g,
      (n, d) => `${pad(d)}rectangle "${one(n.label)}" as ${al.get(n.id)} {`,
      (_n, d) => `${pad(d)}}`,
      (n, d) => (n.type === 'actor' ? `${pad(d)}actor "${one(n.label)}" as ${al.get(n.id)}` : n.type === 'usecase' ? `${pad(d)}usecase "${one(n.label)}" as ${al.get(n.id)}` : n.type === 'note' ? `${pad(d)}note "${one(n.label)}" as ${al.get(n.id)}` : null)
    )
  );
  lines.push('');
  for (const e of g.edges) {
    const a = al.get(e.from);
    const b = al.get(e.to);
    const label = e.label ? ` : ${one(e.label)}` : '';
    if (e.type === 'association') lines.push(`${a} -- ${b}${label}`);
    else if (e.type === 'include') lines.push(`${a} ..> ${b} : <<include>>${e.label ? ' ' + one(e.label) : ''}`);
    else if (e.type === 'extend') lines.push(`${a} ..> ${b} : <<extend>>${e.label ? ' ' + one(e.label) : ''}`);
    else if (e.type === 'generalization') lines.push(`${a} --|> ${b}`);
    else lines.push(`${a} .. ${b}`);
  }
  lines.push('@enduml');
  return lines.join('\n');
}

export function useCaseSpecsMarkdown(doc: DiagramOf<'usecase'>): string {
  const filled = (n: GNode) => !!n.spec && Object.entries(n.spec).some(([k, v]) => k !== 'code' && typeof v === 'string' && v.trim());
  const all = doc.data.nodes.filter((n) => n.type === 'usecase');
  const codeNum = (n: GNode) => Number(/^CU-?(\d+)/i.exec(n.spec?.code ?? '')?.[1] ?? Infinity);
  // Only use cases with something written get a table, in code order; the rest are listed at the end.
  const ucs = all.filter(filled).sort((a, b) => codeNum(a) - codeNum(b) || a.label.localeCompare(b.label, 'es'));
  const pending = all.filter((n) => !filled(n));
  // Use cases without a code get the next free number after the ones typed in.
  const used = all.map((n) => /^CU-?(\d+)/i.exec(n.spec?.code ?? '')?.[1]).filter(Boolean).map(Number);
  let next = used.length ? Math.max(...used) : 0;
  const out = [`# ${doc.title} — especificaciones de casos de uso`, ''];
  ucs.forEach((n, i) => {
    const s = { ...blankSpec(), ...(n.spec ?? {}) };
    const code = s.code || `CU-${String(++next).padStart(2, '0')}`;
    void i;
    const steps = (t: string) =>
      t
        .split('\n')
        .filter((l) => l.trim())
        .map((l, k) => cell(/^\s*\d+[a-z]?\./.test(l) ? l.trim() : `${k + 1}. ${l.trim()}`))
        .join('<br>');
    out.push(`## ${code} ${n.label}`, '', '| Campo | Contenido |', '|---|---|');
    const rows: [string, string][] = [
      ['Código', code],
      ['Nombre', n.label],
      ['Actor principal', s.primaryActor],
      ['Actores secundarios', s.secondaryActors],
      ['Descripción', s.description],
      ['Disparador', s.trigger],
      ['Precondiciones', s.preconditions],
      ['Flujo principal', steps(s.mainFlow)],
      ['Flujos alternativos', s.alternativeFlows.split('\n').filter((l) => l.trim()).map(cell).join('<br>')],
      ['Postcondiciones', s.postconditions],
      ['Prioridad', s.priority],
      ['Frecuencia', s.frequency]
    ];
    for (const [k, v] of rows) out.push(`| ${k} | ${k === 'Flujo principal' || k === 'Flujos alternativos' ? v : cell(v)} |`);
    out.push('');
  });
  if (pending.length) out.push(`**Sin especificar todavía:** ${pending.map((n) => n.label).join(', ')}.`, '');
  if (!all.length) out.push('_No hay casos de uso._');
  return out.join('\n');
}

/* ------------------------------------------------------------------- class */

function classPuml(g: GraphData): string {
  const al = aliases(g.nodes, (n) => (n.type === 'note' ? 'N' : n.type === 'package' ? 'P' : 'C'));
  const lines = ['@startuml', 'hide empty members', ''];
  const body = (n: GNode, d: number) =>
    [...(n.attrs ?? []), ...(n.type === 'enum' ? [] : n.ops ?? [])].map((m) => `${pad(d + 1)}${(m.startsWith('_') ? `{static} ${m.slice(1)}` : m).replace(/\s+/g, ' ').trim()}`);
  lines.push(
    ...nested(
      'class',
      g,
      (n, d) => `${pad(d)}package "${one(n.label)}" as ${al.get(n.id)} {`,
      (_n, d) => `${pad(d)}}`,
      (n, d) => {
        if (n.type === 'note') return `${pad(d)}note "${one(n.label)}" as ${al.get(n.id)}`;
        const kw = n.type === 'interface' ? 'interface' : n.type === 'enum' ? 'enum' : n.abstract ? 'abstract class' : 'class';
        const st = n.stereotype && n.stereotype !== 'interface' && n.stereotype !== 'enumeration' ? ` <<${n.stereotype}>>` : '';
        return [`${pad(d)}${kw} "${one(n.label)}" as ${al.get(n.id)}${st} {`, ...body(n, d), `${pad(d)}}`].join('\n');
      }
    )
  );
  lines.push('');
  for (const e of g.edges) {
    const a = al.get(e.from);
    const b = al.get(e.to);
    const fl = e.fromLabel ? ` "${one(e.fromLabel)}"` : '';
    const tl = e.toLabel ? `"${one(e.toLabel)}" ` : '';
    const label = e.label ? ` : ${one(e.label)}` : '';
    const arrow: Record<string, string> = { association: '--', directed: '-->', aggregation: 'o--', composition: '*--', generalization: '--|>', realization: '..|>', dependency: '..>', noteLink: '..' };
    lines.push(`${a}${fl} ${arrow[e.type] ?? '--'} ${tl}${b}${label}`);
  }
  lines.push('@enduml');
  return lines.join('\n');
}

function classMermaid(g: GraphData): string {
  const al = aliases(g.nodes, () => 'C');
  const lines = ['classDiagram'];
  for (const n of g.nodes) {
    if (n.type === 'note' || n.type === 'package') continue;
    const id = al.get(n.id)!;
    lines.push(`  class ${id}["${one(n.label)}"] {`);
    if (n.type === 'interface') lines.push('    <<interface>>');
    if (n.type === 'enum') lines.push('    <<enumeration>>');
    if (n.abstract) lines.push('    <<abstract>>');
    for (const m of [...(n.attrs ?? []), ...(n.type === 'enum' ? [] : n.ops ?? [])]) lines.push(`    ${mermaidMember(m)}`);
    lines.push('  }');
  }
  const arrow: Record<string, string> = { association: '--', directed: '-->', aggregation: 'o--', composition: '*--', generalization: '--|>', realization: '..|>', dependency: '..>' };
  const declared = new Set(g.nodes.filter((n) => n.type !== 'note' && n.type !== 'package').map((n) => n.id));
  for (const e of g.edges) {
    if (!(e.type in arrow) || !declared.has(e.from) || !declared.has(e.to)) continue;
    const fl = e.fromLabel ? ` "${one(e.fromLabel)}"` : '';
    const tl = e.toLabel ? `"${one(e.toLabel)}" ` : '';
    lines.push(`  ${al.get(e.from)}${fl} ${arrow[e.type]} ${tl}${al.get(e.to)}${e.label ? ` : ${one(e.label)}` : ''}`);
  }
  return lines.join('\n');
}

/** "- {static} total: int" → "-total: int$"; Mermaid wants the classifier at the end. */
export function mermaidMember(m: string): string {
  let s = m.trim();
  let mark = '';
  if (s.startsWith('_')) {
    s = s.slice(1);
    mark = '$';
  }
  if (s.includes('{static}')) mark = '$';
  if (s.includes('{abstract}')) mark = '*';
  s = s.replace('{static}', '').replace('{abstract}', '').replace(/^([+\-#~])\s*/, '$1').replace(/\s+/g, ' ').trim();
  return s + mark;
}

/* ------------------------------------------------- activity / flowchart */

function flowMermaid(kind: GraphKind, g: GraphData): string {
  const al = aliases(g.nodes, () => 'n');
  const lines = ['flowchart TD'];
  const shape = (n: GNode): string => {
    const t = one(n.label) || ' ';
    switch (nodeTypeInfo(kind, n.type).shape) {
      case 'initial':
        return '(("●"))';
      case 'final':
        return '(((" ")))';
      case 'flowFinal':
        return '(("⊗"))';
      case 'diamond':
        return `{"${t}"}`;
      case 'terminator':
      case 'action':
        return `(["${t}"])`;
      case 'parallelogram':
        return `[/"${t}"/]`;
      case 'subprocess':
        return `[["${t}"]]`;
      case 'cylinder':
        return `[("${t}")]`;
      case 'bar':
        return '["━━"]';
      default:
        return `["${t}"]`;
    }
  };
  const parents = containment(kind, g);
  const lanes = g.nodes.filter((n) => nodeTypeInfo(kind, n.type).container);
  for (const lane of lanes) {
    lines.push(`  subgraph ${al.get(lane.id)}["${one(lane.label)}"]`);
    for (const n of g.nodes.filter((x) => parents.get(x.id) === lane.id && x.type !== 'note')) lines.push(`    ${al.get(n.id)}${shape(n)}`);
    lines.push('  end');
  }
  for (const n of g.nodes.filter((x) => !parents.get(x.id) && !nodeTypeInfo(kind, x.type).container && x.type !== 'note')) lines.push(`  ${al.get(n.id)}${shape(n)}`);
  for (const e of g.edges) {
    if (e.type === 'noteLink') continue;
    const dashed = e.type === 'feedback' || e.type === 'objectFlow';
    lines.push(`  ${al.get(e.from)} ${dashed ? '-.->' : '-->'}${e.label ? `|"${one(e.label)}"|` : ''} ${al.get(e.to)}`);
  }
  return lines.join('\n');
}

/* ------------------------------------------------------------------- state */

function statePuml(g: GraphData, mermaid: boolean): string {
  const al = aliases(g.nodes, () => 'S');
  const nodes = byId(g);
  const parents = containment('state', g);
  const ref = (id: string, asTarget: boolean) => {
    const n = nodes.get(id)!;
    if (n.type === 'initial' || (n.type === 'final' && asTarget)) return '[*]';
    return al.get(id)!;
  };
  // A transition from an inner initial state, or into an inner final state, belongs inside that composite.
  const scopeOf = (e: GEdge): string | null => {
    const from = nodes.get(e.from)!;
    const to = nodes.get(e.to)!;
    if (from.type === 'initial') return parents.get(from.id) ?? null;
    if (to.type === 'final') return parents.get(to.id) ?? null;
    return null;
  };
  const transitions = g.edges.filter((e) => e.type === 'transition');
  const ind = mermaid ? '  ' : '';
  const line = (e: GEdge, d: number) => `${ind}${pad(d)}${ref(e.from, false)} --> ${ref(e.to, true)}${e.label ? ` : ${one(e.label)}` : ''}`;
  const lines = mermaid ? ['stateDiagram-v2'] : ['@startuml', 'hide empty description', ''];
  lines.push(
    ...nested(
      'state',
      g,
      (n, d) => `${ind}${pad(d)}state "${one(n.label)}" as ${al.get(n.id)} {`,
      (n, d) => [...transitions.filter((e) => scopeOf(e) === n.id).map((e) => line(e, d + 1)), `${ind}${pad(d)}}`].join('\n'),
      (n, d) => {
        if (n.type === 'state') {
          const head = mermaid ? `${ind}${pad(d)}${al.get(n.id)} : ${one(n.label)}` : `${pad(d)}state "${one(n.label)}" as ${al.get(n.id)}`;
          return [head, ...(n.attrs ?? []).map((a) => `${ind}${pad(d)}${al.get(n.id)} : ${one(a)}`)].join('\n');
        }
        if (n.type === 'choice') return `${ind}${pad(d)}state ${al.get(n.id)} <<choice>>`;
        if (n.type === 'history') return mermaid ? null : `${pad(d)}state ${al.get(n.id)} <<history>>`;
        return null;
      }
    )
  );
  for (const e of transitions.filter((x) => scopeOf(x) === null)) lines.push(line(e, 0));
  if (!mermaid) lines.push('@enduml');
  return lines.join('\n');
}

/* -------------------------------------------------------------- deployment */

function deploymentPuml(g: GraphData): string {
  const al = aliases(g.nodes, () => 'D');
  const kw: Record<string, string> = { node: 'node', device: 'node', execEnv: 'node', artifact: 'artifact', component: 'component', interface: 'interface', database: 'database', note: 'note' };
  const lines = ['@startuml', ''];
  lines.push(
    ...nested(
      'deployment',
      g,
      (n, d) => {
        const st = n.stereotype ?? nodeTypeInfo('deployment', n.type).stereotype;
        return `${pad(d)}node "${one(n.label)}" as ${al.get(n.id)}${st ? ` <<${st}>>` : ''} {`;
      },
      (_n, d) => `${pad(d)}}`,
      (n, d) => `${pad(d)}${kw[n.type] ?? 'rectangle'} "${one(n.label)}" as ${al.get(n.id)}`
    )
  );
  lines.push('');
  for (const e of g.edges) {
    const label = e.type === 'deploy' ? ' : <<deploy>>' : e.label ? ` : ${one(e.label)}` : '';
    const arrow = e.type === 'path' ? '--' : e.type === 'realization' ? '..|>' : e.type === 'noteLink' ? '..' : '..>';
    lines.push(`${al.get(e.from)} ${arrow} ${al.get(e.to)}${label}`);
  }
  lines.push('@enduml');
  return lines.join('\n');
}

/* ------------------------------------------------------------ architecture */

function inventory(g: GraphData): { zone: string; label: string; kind: string }[] {
  const parents = containment('architecture', g);
  const nodes = byId(g);
  return g.nodes
    .filter((n) => n.type === 'device')
    .map((n) => {
      const p = parents.get(n.id);
      return { zone: p ? nodes.get(p)!.label : '', label: n.label, kind: nodeTypeInfo('architecture', n.type, n.icon).es };
    });
}

function architectureMarkdown(doc: DiagramOf<'architecture'>): string {
  const rows = inventory(doc.data);
  const zones = [...new Set(rows.map((r) => r.zone))];
  const out = [`# ${doc.title} — inventario de equipos`, ''];
  for (const z of zones) {
    out.push(`## ${z || 'Fuera de zonas'}`, '', '| Equipo | Tipo |', '|---|---|');
    for (const r of rows.filter((x) => x.zone === z)) out.push(`| ${cell(r.label)} | ${r.kind} |`);
    out.push('');
  }
  const nodes = byId(doc.data);
  if (doc.data.edges.length) {
    out.push('## Conexiones', '');
    for (const e of doc.data.edges) out.push(`- ${nodes.get(e.from)?.label} → ${nodes.get(e.to)?.label}${e.label ? ` (${e.label})` : ''}`);
  }
  return out.join('\n');
}

/* --------------------------------------------------------------------- E/R */

function erMarkdown(doc: DiagramOf<'er'>): string {
  const g = doc.data;
  const nodes = byId(g);
  const neighbours = (id: string) => g.edges.filter((e) => e.from === id || e.to === id).map((e) => ({ e, other: nodes.get(e.from === id ? e.to : e.from)! }));
  const out = [`# ${doc.title} — modelo E/R`, '', '## Entidades', ''];
  for (const n of g.nodes.filter((x) => x.type === 'entity' || x.type === 'weakEntity')) {
    const attrs = neighbours(n.id)
      .filter(({ other }) => ['attribute', 'key', 'multivalued', 'derived'].includes(other.type))
      .map(({ other }) => (other.type === 'key' ? `**${other.label}** (clave)` : other.type === 'multivalued' ? `${other.label} (multivaluado)` : other.type === 'derived' ? `${other.label} (derivado)` : other.label));
    out.push(`- **${n.label}**${n.type === 'weakEntity' ? ' (débil)' : ''}: ${attrs.join(', ') || '—'}`);
  }
  out.push('', '## Relaciones', '');
  for (const r of g.nodes.filter((x) => x.type === 'relationship' || x.type === 'identifying')) {
    const ends = neighbours(r.id).filter(({ other }) => other.type === 'entity' || other.type === 'weakEntity');
    const card = ends.map(({ e, other }) => `${other.label} (${(e.from === r.id ? e.toLabel : e.fromLabel) || '?'}${e.type === 'total' ? ', total' : ''})`);
    const attrs = neighbours(r.id).filter(({ other }) => ['attribute', 'key', 'multivalued'].includes(other.type)).map(({ other }) => other.label);
    out.push(`- **${r.label}**${r.type === 'identifying' ? ' (identificativa)' : ''}: ${card.join(' — ')}${attrs.length ? `; atributos: ${attrs.join(', ')}` : ''}`);
  }
  return out.join('\n');
}

/* --------------------------------------------------------------------- DFD */

function dfdMarkdown(doc: DiagramOf<'dfd'>): string {
  const g = doc.data;
  const nodes = byId(g);
  const of = (t: string) => g.nodes.filter((n) => n.type === t).map((n) => `- ${n.label}`);
  return [
    `# ${doc.title} — DFD`,
    '',
    '## Entidades externas',
    ...of('external'),
    '',
    '## Procesos',
    ...of('process'),
    ...of('system'),
    '',
    '## Almacenes',
    ...of('store'),
    '',
    '## Flujos de datos',
    '',
    '| Origen | Datos | Destino |',
    '|---|---|---|',
    ...g.edges.map((e) => `| ${cell(nodes.get(e.from)?.label ?? '')} | ${cell(e.label ?? '')}${e.type === 'both' ? ' (↔)' : ''} | ${cell(nodes.get(e.to)?.label ?? '')} |`)
  ].join('\n');
}

/* --------------------------------------------------------------- screens */

function screensMarkdown(doc: DiagramOf<'screenflow'>): string {
  const g = doc.data;
  const nodes = byId(g);
  const out = [`# ${doc.title} — pantallas`, ''];
  for (const n of g.nodes.filter((x) => x.type !== 'note')) {
    const [title, ...rest] = n.label.split('\n');
    const lines = rest.map((l) => {
      const t = l.trim();
      const b = /^\[(.+)\]$/.exec(t);
      if (b) return `- Botón «${b[1]}»`;
      if (/_{3,}/.test(t)) return `- Campo: ${t.replace(/_{3,}/, '').replace(/:\s*$/, '').trim()}`;
      if (t.startsWith('# ')) return `- **${t.slice(2)}**`;
      return `- ${t}`;
    });
    out.push(`## ${title}${n.type === 'dialog' ? ' (aviso)' : ''}`, '', ...lines, '');
    const outs = g.edges.filter((e) => e.from === n.id);
    if (outs.length) out.push('Navegación:', ...outs.map((e) => `- ${e.label || '→'}: ${nodes.get(e.to)?.label.split('\n')[0]}${e.type === 'error' ? ' (error)' : ''}`), '');
  }
  return out.join('\n');
}

/* ----------------------------------------------------------- traceability */

/** Every requirement → design → component → test chain, one row each. */
export function traceRows(g: GraphData): string[][] {
  const nodes = byId(g);
  const next = (id: string, type: string) => g.edges.filter((e) => e.type === 'trace' && e.from === id).map((e) => nodes.get(e.to)!).filter((n) => n?.type === type);
  const rows: string[][] = [];
  for (const r of g.nodes.filter((n) => n.type === 'req')) {
    // Criteria hang from their requirement by any line, in either direction.
    const crit = g.edges
      .filter((e) => (e.from === r.id && nodes.get(e.to)?.type === 'criterion') || (e.to === r.id && nodes.get(e.from)?.type === 'criterion'))
      .map((e) => nodes.get(e.from === r.id ? e.to : e.from)?.label ?? '')
      .join(', ');
    const designs = next(r.id, 'design');
    if (!designs.length) rows.push([r.label, crit, '', '', '']);
    for (const d of designs) {
      const comps = next(d.id, 'component');
      if (!comps.length) rows.push([r.label, crit, d.label, '', '']);
      for (const c of comps) {
        const tests = next(c.id, 'test');
        rows.push([r.label, crit, d.label, c.label, tests.map((t) => t.label).join(', ')]);
      }
    }
  }
  return rows;
}

function traceMarkdown(doc: DiagramOf<'traceability'>): string {
  const rows = traceRows(doc.data);
  const out = [`# ${doc.title} — matriz de trazabilidad`, '', '| Requisito | Criterios de aceptación | Elemento de diseño | Componente | Casos de prueba |', '|---|---|---|---|---|'];
  for (const r of rows) out.push(`| ${r.map(cell).join(' | ')} |`);
  const untested = doc.data.nodes.filter((n) => n.type === 'req').filter((r) => !rows.some((row) => row[0] === r.label && row[4]));
  if (untested.length) out.push('', `**Sin casos de prueba:** ${untested.map((n) => n.label).join(', ')}`);
  return out.join('\n');
}

/* --------------------------------------------------------------- mind map */

function mindmapOutline(g: GraphData, plant: boolean): string {
  const root = mindmapRoot(g.nodes);
  if (!root) return '';
  const kids = childrenMap(g.nodes);
  const out: string[] = plant ? ['@startmindmap', `* ${one(root.label)}`] : [`# ${root.label}`, ''];
  const walk = (n: GNode, depth: number) => {
    for (const c of kids.get(n.id) ?? []) {
      out.push(plant ? `${'*'.repeat(depth + 2)} ${one(c.label)}` : `${'  '.repeat(depth)}- ${one(c.label)}`);
      walk(c, depth + 1);
    }
  };
  walk(root, 0);
  if (plant) out.push('@endmindmap');
  return out.join('\n');
}

/* ------------------------------------------------- concept map / generic */

function propositions(doc: DiagramOf<GraphKind>): string {
  const nodes = byId(doc.data);
  return [`# ${doc.title}`, '', ...doc.data.edges.map((e) => `- ${nodes.get(e.from)?.label} — ${e.label || 'se relaciona con'} → ${nodes.get(e.to)?.label}`)].join('\n');
}

function communicationMarkdown(doc: DiagramOf<'communication'>): string {
  const nodes = byId(doc.data);
  const msgs: { seq: string; text: string; from: string; to: string }[] = [];
  for (const e of doc.data.edges) {
    for (const m of e.messages ?? []) {
      const [a, b] = m.dir === 'forward' ? [e.from, e.to] : [e.to, e.from];
      msgs.push({ seq: m.seq, text: m.text, from: nodes.get(a)?.label ?? '', to: nodes.get(b)?.label ?? '' });
    }
  }
  const key = (s: string) => s.split(/[.]/).map((p) => p.padStart(4, '0')).join('.');
  msgs.sort((x, y) => key(x.seq).localeCompare(key(y.seq)));
  return [`# ${doc.title} — mensajes`, '', '| Nº | Mensaje | De | A |', '|---|---|---|---|', ...msgs.map((m) => `| ${m.seq} | ${cell(m.text)} | ${cell(m.from)} | ${cell(m.to)} |`)].join('\n');
}

/* ------------------------------------------------------------------ index */

export function graphExports(doc: DiagramOf<GraphKind>): TextExport[] {
  const g = doc.data as GraphData;
  switch (doc.kind) {
    case 'usecase':
      return [puml(() => usecasePuml(g)), md('Use case specifications', () => useCaseSpecsMarkdown(doc as DiagramOf<'usecase'>))];
    case 'class':
      return [puml(() => classPuml(g)), mmd(() => classMermaid(g))];
    case 'activity':
    case 'flowchart':
      return [mmd(() => flowMermaid(doc.kind, g))];
    case 'state':
      return [puml(() => statePuml(g, false)), mmd(() => statePuml(g, true))];
    case 'deployment':
      return [puml(() => deploymentPuml(g))];
    case 'architecture':
      return [
        md('Equipment inventory', () => architectureMarkdown(doc as DiagramOf<'architecture'>)),
        csv('Equipment inventory', () => ['Zona,Equipo,Tipo', ...inventory(g).map((r) => [r.zone, r.label, r.kind].map(csvCell).join(','))].join('\n'))
      ];
    case 'er':
      return [md('Entities and relationships', () => erMarkdown(doc as DiagramOf<'er'>))];
    case 'dfd':
      return [md('Processes, stores and flows', () => dfdMarkdown(doc as DiagramOf<'dfd'>))];
    case 'screenflow':
      return [md('Screens and navigation', () => screensMarkdown(doc as DiagramOf<'screenflow'>))];
    case 'traceability':
      return [
        md('Traceability matrix', () => traceMarkdown(doc as DiagramOf<'traceability'>)),
        csv('Traceability matrix', () => ['Requisito,Criterios,Elemento de diseño,Componente,Casos de prueba', ...traceRows(g).map((r) => r.map(csvCell).join(','))].join('\n'))
      ];
    case 'mindmap':
      return [md('Outline', () => mindmapOutline(g, false)), puml(() => mindmapOutline(g, true))];
    case 'conceptmap':
      return [md('Propositions', () => propositions(doc))];
    case 'communication':
      return [md('Messages in order', () => communicationMarkdown(doc as DiagramOf<'communication'>))];
  }
}

/** For tests: every edge type in a palette has an arrow in the PlantUML maps above. */
export const _paletteKinds = Object.keys(PALETTES) as GraphKind[];
export type { GEdge };
