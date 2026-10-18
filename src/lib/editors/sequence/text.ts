/**
 * Sequence diagrams as text: a PlantUML subset that round-trips with the
 * structured data, plus a Mermaid export. Pure, so it can be tested.
 *
 *   actor Socio
 *   boundary ":PantallaPréstamo" as P1
 *   Socio -> P1: prestar(libro)       synchronous
 *   P1 ->> Log: registrar()           asynchronous
 *   P1 --> Socio: ok                  reply
 *   create P2 / destroy P2            next / previous message creates / destroys
 *   alt disponible / else / end, opt, loop, par, break, critical, group ref [x] / ref over A, B: x
 *   note over A, B: text              (or note left of / right of, or note over A … end note)
 *   autonumber, autoactivate on|off
 */
import { uid } from '../../model/diagram';
import type { MessageStyle, Participant, ParticipantKind, SeqItem, SequenceData } from '../../model/types';

const KINDS: ParticipantKind[] = ['actor', 'object', 'boundary', 'control', 'entity', 'database'];
const OPS = ['alt', 'opt', 'loop', 'par', 'break', 'critical', 'ref'] as const;
type Op = (typeof OPS)[number];

/** A participant's name as an identifier when it is one, otherwise null. */
function bareName(name: string): string | null {
  return /^[\p{L}_][\p{L}\p{N}_]*$/u.test(name) ? name : null;
}

/** Stable aliases for the text: the name itself when it's an identifier, P1, P2… otherwise. */
export function aliases(parts: Participant[]): Map<string, string> {
  const out = new Map<string, string>();
  const used = new Set<string>();
  for (const p of parts) {
    const bare = bareName(p.name);
    if (bare && !used.has(bare)) {
      out.set(p.id, bare);
      used.add(bare);
    }
  }
  let n = 1;
  for (const p of parts) {
    if (out.has(p.id)) continue;
    while (used.has(`P${n}`)) n++;
    out.set(p.id, `P${n}`);
    used.add(`P${n}`);
  }
  return out;
}

const ARROW: Record<MessageStyle, string> = { sync: '->', async: '->>', reply: '-->', create: '->', destroy: '->' };

/** Structured data → PlantUML-subset text (also valid PlantUML). */
export function toPlantUml(data: SequenceData, title = ''): string {
  const al = aliases(data.participants);
  const out: string[] = ['@startuml'];
  if (title) out.push(`title ${title}`);
  if (data.autonumber) out.push('autonumber');
  out.push(`autoactivate ${data.activations ? 'on' : 'off'}`);
  out.push('');
  for (const p of data.participants) {
    const a = al.get(p.id)!;
    const kw = p.kind === 'object' ? 'participant' : p.kind;
    out.push(a === p.name ? `${kw} ${a}` : `${kw} "${p.name.replace(/"/g, "'")}" as ${a}`);
  }
  if (data.participants.length) out.push('');
  const name = (id: string) => al.get(id) ?? id;
  let indent = 0;
  const pad = () => '  '.repeat(indent);
  const items = data.items;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    switch (it.t) {
      case 'msg': {
        if (it.style === 'create') out.push(`${pad()}create ${name(it.to)}`);
        out.push(`${pad()}${name(it.from)} ${ARROW[it.style]} ${name(it.to)}${it.text ? `: ${it.text}` : ''}`);
        if (it.style === 'destroy') out.push(`${pad()}destroy ${name(it.to)}`);
        break;
      }
      case 'open': {
        if (it.op === 'ref') {
          const next = items[i + 1];
          if (next?.t === 'close') {
            const span = refOver(it)?.filter((id) => data.participants.some((p) => p.id === id));
            const all = (span?.length ? span : data.participants.map((p) => p.id)).map(name).join(', ');
            out.push(`${pad()}ref over ${all}${it.guard ? `: ${it.guard}` : ''}`);
            i++;
            break;
          }
          out.push(`${pad()}group ref [${it.guard}]`);
        } else {
          out.push(`${pad()}${it.op}${it.guard ? ` ${it.guard}` : ''}`);
        }
        indent++;
        break;
      }
      case 'else':
        out.push(`${'  '.repeat(Math.max(0, indent - 1))}else${it.guard ? ` ${it.guard}` : ''}`);
        break;
      case 'close':
        indent = Math.max(0, indent - 1);
        out.push(`${pad()}end`);
        break;
      case 'note': {
        const kind = noteKind(it.text);
        if (kind !== 'note' && it.over.length === 0) {
          out.push(`${pad()}${it.text}`);
          break;
        }
        const over = it.over.map(name).join(', ') || name(data.participants[0]?.id ?? '');
        if (it.text.includes('\n')) {
          out.push(`${pad()}note over ${over}`);
          for (const l of it.text.split('\n')) out.push(`${pad()}  ${l}`);
          out.push(`${pad()}end note`);
        } else out.push(`${pad()}note over ${over}: ${it.text}`);
        break;
      }
    }
  }
  out.push('@enduml', '');
  return out.join('\n');
}

export class SeqParseError extends Error {
  constructor(public problems: { line: number; message: string }[]) {
    super(problems.map((p) => `line ${p.line}: ${p.message}`).join('\n'));
  }
}

export interface SeqWarning {
  line: number;
  message: string;
}

export interface SeqParseResult {
  data: SequenceData;
  /** Lines that were skipped or patched up; the rest of the file still came through. */
  warnings: SeqWarning[];
}

const NAME = String.raw`(?:"[^"]+"|[\p{L}\p{N}_.]+)`;
/** Any PlantUML arrow: optional head on the left, one or two dashes, an optional [#colour], a head on the right. */
const ARROW_RE = new RegExp(String.raw`^(${NAME})\s*((?:<<|<|x|o|\\\\|\\|//|/)?-{1,2}(?:\[[^\]]*\])?-?(?:>>|>|\\\\|\\|//|/)?(?:x|o)?)\s*(${NAME})\s*(\*\*|!!|\+\+|--)?\s*(?::\s*(.*))?$`, 'u');

/**
 * Text → structured data, leniently: lines it doesn't understand are skipped
 * and reported as warnings, unclosed fragments are closed at the end, and the
 * rest of the file still comes through — teachers' files are full of extras.
 * Keeps the ids of participants whose names match `current`.
 */
export function parsePlantUmlLenient(source: string, current?: SequenceData): SeqParseResult {
  const warnings: SeqWarning[] = [];
  const parts: Participant[] = [];
  const byAlias = new Map<string, Participant>();
  const oldByName = new Map((current?.participants ?? []).map((p) => [p.name, p]));
  const usedIds = new Set<string>();
  const items: SeqItem[] = [];
  let autonumber = false;
  let activations = current?.activations ?? true;
  let pendingCreate: { alias: string; line: number } | null = null;
  const openStack: { op: string; line: number }[] = [];
  /** Who called whom, so `return x` knows where the reply goes. */
  const calls: { caller: string; callee: string }[] = [];

  const unquote = (s: string) => s.trim().replace(/^"(.*)"$/, '$1');
  const declare = (alias: string, name: string, kind: ParticipantKind): Participant => {
    const existing = byAlias.get(alias);
    if (existing) {
      existing.name = name;
      existing.kind = kind;
      return existing;
    }
    const old = oldByName.get(name);
    const id = old && !usedIds.has(old.id) ? old.id : uid();
    usedIds.add(id);
    const p: Participant = { id, name, kind };
    parts.push(p);
    byAlias.set(alias, p);
    return p;
  };
  /** A participant by alias, by quoted name, or new. */
  const ref = (raw: string): Participant => {
    const key = unquote(raw);
    return byAlias.get(key) ?? parts.find((p) => p.name === key) ?? declare(key, key, 'object');
  };

  // Block comments /' … '/ go first, keeping the line count.
  const text = source.replace(/\/'[\s\S]*?'\//g, (m) => m.replace(/[^\n]/g, ''));
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const n = i + 1;
    const line = lines[i].trim();
    if (!line || line.startsWith("'") || line.startsWith('//')) continue;
    if (/^@(start|end)uml/i.test(line) || /^(title|skinparam|hide|show|header|footer|legend|endlegend|scale|caption|newpage|!|left to right|top to bottom)/i.test(line)) continue;
    if (/^(activate|deactivate)\b/i.test(line) || /^space\b/i.test(line) || /^\|\|\d*\|\|$/.test(line)) continue; // bars are drawn from the calls
    let m: RegExpMatchArray | null;

    if (/^autonumber\b/i.test(line)) {
      autonumber = true;
      continue;
    }
    if ((m = line.match(/^autoactivate\s+(on|off)\s*$/i))) {
      activations = m[1].toLowerCase() === 'on';
      continue;
    }
    // Dividers and delays become full-width notes that round-trip back to the same syntax.
    if ((m = line.match(/^==\s*(.*?)\s*==$/))) {
      items.push({ id: uid(), t: 'note', over: [], text: `== ${m[1]} ==` });
      continue;
    }
    if ((m = line.match(/^\.\.\.\s*(.*?)\s*(?:\.\.\.)?$/))) {
      items.push({ id: uid(), t: 'note', over: [], text: m[1] ? `... ${m[1]} ...` : '...' });
      continue;
    }
    // Declarations: participant X, actor "Name" as X, boundary X as "Name", optional #colour / order n.
    if ((m = line.match(/^(participant|actor|boundary|control|entity|database|collections|queue)\s+(.+)$/i))) {
      const kw = m[1].toLowerCase();
      const kind: ParticipantKind = KINDS.includes(kw as ParticipantKind) ? (kw as ParticipantKind) : 'object';
      const rest = m[2].replace(/\s+order\s+\d+/i, '').replace(/\s+#\S+\s*$/, '').trim();
      let d: RegExpMatchArray | null;
      if ((d = rest.match(/^"([^"]*)"\s+as\s+([\p{L}\p{N}_]+)$/u))) declare(d[2], d[1], kind);
      else if ((d = rest.match(/^([\p{L}\p{N}_]+)\s+as\s+"([^"]*)"$/u))) declare(d[1], d[2], kind);
      else if ((d = rest.match(/^([\p{L}\p{N}_.:]+)\s+as\s+([\p{L}\p{N}_]+)$/u))) declare(d[2], d[1], kind);
      else if ((d = rest.match(/^([\p{L}\p{N}_.:]+)$/u))) declare(d[1], d[1], kind);
      else if ((d = rest.match(/^"([^"]*)"$/))) declare(d[1], d[1], kind);
      else warnings.push({ line: n, message: `skipped: can't read the participant "${rest}"` });
      continue;
    }
    if ((m = line.match(new RegExp(String.raw`^create\s+(?:(?:participant|actor|boundary|control|entity|database)\s+)?(${NAME})\s*$`, 'iu')))) {
      const p = ref(m[1]);
      pendingCreate = { alias: [...byAlias].find(([, v]) => v === p)![0], line: n };
      continue;
    }
    if ((m = line.match(new RegExp(String.raw`^destroy\s+(${NAME})\s*$`, 'iu')))) {
      const target = ref(m[1]);
      const last = [...items].reverse().find((it) => it.t === 'msg');
      if (last && last.t === 'msg' && last.to === target.id) last.style = 'destroy';
      else warnings.push({ line: n, message: `"destroy" ignored: it must come right after a message to ${unquote(m[1])}` });
      continue;
    }
    // Multi-line note: note over A, B … end note (left of / right of become "over").
    if ((m = line.match(/^[hr]?note\s+(over|left of|right of|left|right)\s*([^:]*)$/i))) {
      const over = m[2].trim() ? m[2].split(',').map((s) => ref(s.trim()).id) : [];
      const body: string[] = [];
      let j = i + 1;
      while (j < lines.length && !/^\s*end\s*[hr]?note\s*$/i.test(lines[j])) body.push(lines[j].trim()), j++;
      if (j >= lines.length) warnings.push({ line: n, message: 'note without "end note": it runs to the end of the file' });
      items.push({ id: uid(), t: 'note', over, text: body.join('\n') });
      i = j;
      continue;
    }
    if ((m = line.match(/^[hr]?note\s+(over|left of|right of)\s+([^:]+):\s*(.*)$/i))) {
      const over = m[2].split(',').map((s) => ref(s.trim()).id);
      items.push({ id: uid(), t: 'note', over, text: m[3].replace(/\\n/g, '\n') });
      continue;
    }
    if ((m = line.match(/^ref\s+over\s+([^:]+)(?::\s*(.*))?$/i))) {
      const over = m[1].split(',').map((s) => ref(s.trim()).id);
      if (m[2] !== undefined) {
        items.push({ id: uid(), t: 'open', op: 'ref', guard: m[2].trim(), over } as SeqItem);
        items.push({ id: uid(), t: 'close' });
      } else {
        // ref over A, B … end ref
        const body: string[] = [];
        let j = i + 1;
        while (j < lines.length && !/^\s*end\s*ref\s*$/i.test(lines[j])) body.push(lines[j].trim()), j++;
        items.push({ id: uid(), t: 'open', op: 'ref', guard: body.join(' '), over } as SeqItem);
        items.push({ id: uid(), t: 'close' });
        i = j;
      }
      continue;
    }
    if ((m = line.match(/^group\s+ref\s*(?:\[(.*)\])?\s*$/i))) {
      items.push({ id: uid(), t: 'open', op: 'ref', guard: (m[1] ?? '').trim() });
      openStack.push({ op: 'ref', line: n });
      continue;
    }
    if ((m = line.match(/^(alt|opt|loop|par|break|critical|group)\b\s*(.*)$/i))) {
      const kw = m[1].toLowerCase();
      // "group label" has no UML operator of its own: kept as an opt-like box with its label.
      const op = (kw === 'group' ? 'critical' : kw) as Op;
      if (kw === 'group') warnings.push({ line: n, message: '"group" is drawn as a "critical" fragment (UML has no plain group)' });
      items.push({ id: uid(), t: 'open', op, guard: m[2].replace(/^\[(.*)\]$/, '$1').trim() });
      openStack.push({ op, line: n });
      continue;
    }
    if ((m = line.match(/^(else|and)\b\s*(.*)$/i))) {
      if (!openStack.length) {
        warnings.push({ line: n, message: `"${m[1]}" ignored: it's outside alt / par` });
        continue;
      }
      items.push({ id: uid(), t: 'else', guard: m[2].replace(/^\[(.*)\]$/, '$1').trim() });
      continue;
    }
    if (/^end\s*$/i.test(line)) {
      if (!openStack.pop()) {
        warnings.push({ line: n, message: '"end" ignored: no fragment is open' });
        continue;
      }
      items.push({ id: uid(), t: 'close' });
      continue;
    }
    if ((m = line.match(/^return\b\s*(.*)$/i))) {
      const call = calls.pop();
      if (!call) {
        warnings.push({ line: n, message: '"return" ignored: no call is waiting for a reply' });
        continue;
      }
      items.push({ id: uid(), t: 'msg', from: call.callee, to: call.caller, text: m[1].trim(), style: 'reply' });
      continue;
    }
    if ((m = line.match(ARROW_RE))) {
      let [, a, arrow, b] = m;
      const mod = m[4];
      const text = (m[5] ?? '').trim();
      const plain = arrow.replace(/\[[^\]]*\]/, '');
      const dashed = plain.includes('--');
      const left = /^(<<|<|\\\\|\\|\/\/|\/)-/.test(plain) && !/-(>>|>)/.test(plain);
      if (left) [a, b] = [b, a];
      const head = left ? plain.match(/^(<<|<|\\\\|\\|\/\/|\/)/)![1] : (plain.match(/-(>>|>|\\\\|\\|\/\/|\/)/)?.[1] ?? '>');
      const from = ref(a);
      const to = ref(b);
      let style: MessageStyle = dashed ? 'reply' : head === '>' || head === '<' ? 'sync' : 'async';
      if (/x$/.test(plain) && !dashed) style = 'async'; // a lost message: drawn as asynchronous
      const bAlias = [...byAlias].find(([, v]) => v === to)?.[0];
      if (mod === '**' || (pendingCreate && pendingCreate.alias === bAlias)) {
        style = 'create';
        pendingCreate = null;
      }
      items.push({ id: uid(), t: 'msg', from: from.id, to: to.id, text, style });
      if (mod === '!!') (items[items.length - 1] as { style: MessageStyle }).style = 'destroy';
      // Track calls and their replies for `return`.
      if (style === 'sync' && from.id !== to.id) calls.push({ caller: from.id, callee: to.id });
      if (style === 'reply') {
        const k = calls.map((c) => c.callee === from.id && c.caller === to.id).lastIndexOf(true);
        if (k >= 0) calls.splice(k, 1);
      }
      continue;
    }
    warnings.push({ line: n, message: `skipped: "${line.length > 40 ? line.slice(0, 40) + '…' : line}"` });
  }
  if (pendingCreate) warnings.push({ line: pendingCreate.line, message: `"create" ignored: no message to ${pendingCreate.alias} follows it` });
  for (const o of openStack.reverse()) {
    warnings.push({ line: o.line, message: `"${o.op}" had no "end": closed at the end of the file` });
    items.push({ id: uid(), t: 'close' });
  }
  return { data: { participants: parts, items, activations, autonumber }, warnings };
}

/** Text → structured data (lenient: see parsePlantUmlLenient; warnings are dropped). */
export function parsePlantUml(text: string, current?: SequenceData): SequenceData {
  return parsePlantUmlLenient(text, current).data;
}

/** The participants a `ref` box spans when it names them (`ref over A, B`); all of them otherwise. */
export function refOver(it: SeqItem): string[] | undefined {
  return it.t === 'open' ? (it as SeqItem & { over?: string[] }).over : undefined;
}

/** Notes that stand for a PlantUML divider (`== x ==`) or delay (`... x ...`). */
export function noteKind(text: string): 'divider' | 'delay' | 'note' {
  if (/^==\s.*\s==$|^====$/.test(text)) return 'divider';
  if (/^\.\.\.(\s.*\s\.\.\.)?$/.test(text)) return 'delay';
  return 'note';
}

/** Mermaid sequenceDiagram. */
export function toMermaid(data: SequenceData, title = ''): string {
  const al = aliases(data.participants);
  const name = (id: string) => al.get(id) ?? id;
  const out: string[] = ['sequenceDiagram'];
  if (title) out.push(`  title ${title}`);
  if (data.autonumber) out.push('  autonumber');
  const created = new Set(data.items.filter((it) => it.t === 'msg' && it.style === 'create').map((it) => (it as { to: string }).to));
  for (const p of data.participants) {
    if (created.has(p.id)) continue;
    const kw = p.kind === 'actor' ? 'actor' : 'participant';
    out.push(`  ${kw} ${al.get(p.id)}${al.get(p.id) === p.name ? '' : ` as ${p.name}`}`);
  }
  const active = new Map<string, number>();
  const createdDone = new Set<string>();
  const opStack: string[] = [];
  let indent = 1;
  const pad = () => '  '.repeat(indent);
  for (const it of data.items) {
    switch (it.t) {
      case 'msg': {
        let arrow = it.style === 'async' ? '-)' : it.style === 'reply' ? '-->>' : '->>';
        if (it.style === 'destroy') arrow = '-x';
        let suffix = '';
        if (it.style === 'create' && !createdDone.has(it.to)) {
          const p = data.participants.find((q) => q.id === it.to)!;
          out.push(`${pad()}create ${p.kind === 'actor' ? 'actor' : 'participant'} ${name(it.to)}${name(it.to) === p.name ? '' : ` as ${p.name}`}`);
          createdDone.add(it.to);
        }
        if (it.style === 'destroy') out.push(`${pad()}destroy ${name(it.to)}`);
        if (data.activations && it.from !== it.to) {
          if (it.style === 'sync') {
            suffix = '+';
            active.set(it.to, (active.get(it.to) ?? 0) + 1);
          } else if (it.style === 'reply' && (active.get(it.from) ?? 0) > 0) {
            suffix = '-';
            active.set(it.from, active.get(it.from)! - 1);
          }
        }
        out.push(`${pad()}${name(it.from)}${arrow}${suffix}${name(it.to)}: ${it.text.replace(/[;#]/g, ' ') || ' '}`);
        break;
      }
      case 'open': {
        if (it.op === 'ref') {
          const span = refOver(it)?.filter((id) => data.participants.some((p) => p.id === id));
          const all = (span?.length ? span : data.participants.map((p) => p.id)).map(name);
          out.push(`${pad()}Note over ${all[0]}${all.length > 1 ? `,${all[all.length - 1]}` : ''}: ref ${it.guard}`);
          opStack.push('ref');
          break;
        }
        out.push(`${pad()}${it.op} ${it.guard}`.trimEnd());
        opStack.push(it.op);
        indent++;
        break;
      }
      case 'else': {
        const op = opStack[opStack.length - 1];
        const kw = op === 'par' ? 'and' : op === 'critical' ? 'option' : 'else';
        out.push(`${'  '.repeat(indent - 1)}${kw} ${it.guard}`.trimEnd());
        break;
      }
      case 'close': {
        const op = opStack.pop();
        if (op === 'ref') break;
        indent = Math.max(1, indent - 1);
        out.push(`${pad()}end`);
        break;
      }
      case 'note': {
        const ids = (it.over.length ? it.over : noteKind(it.text) !== 'note' ? data.participants.map((p) => p.id) : []).map(name);
        const over = ids.length > 1 ? `${ids[0]},${ids[ids.length - 1]}` : ids[0] ?? name(data.participants[0]?.id ?? '');
        out.push(`${pad()}Note over ${over}: ${it.text.replace(/\n/g, '<br/>')}`);
        break;
      }
    }
  }
  return out.join('\n') + '\n';
}
