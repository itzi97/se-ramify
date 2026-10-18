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
            const all = data.participants.map((p) => name(p.id)).join(', ');
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

/**
 * Text → structured data. Keeps the ids of participants whose names match
 * `current`, so a round trip doesn't churn ids. Throws SeqParseError (with
 * every problem and its line) instead of returning half a diagram.
 */
export function parsePlantUml(text: string, current?: SequenceData): SequenceData {
  const problems: { line: number; message: string }[] = [];
  const parts: Participant[] = [];
  const byAlias = new Map<string, Participant>();
  const oldByName = new Map((current?.participants ?? []).map((p) => [p.name, p]));
  const usedIds = new Set<string>();
  const items: SeqItem[] = [];
  let autonumber = false;
  let activations = current?.activations ?? true;
  let pendingCreate: { alias: string; line: number } | null = null;
  const openStack: { op: string; line: number }[] = [];

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
  const ref = (alias: string): Participant => byAlias.get(alias) ?? declare(alias, alias, 'object');

  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const n = i + 1;
    const raw = lines[i];
    const line = raw.trim();
    if (!line || line.startsWith("'") || line.startsWith('//')) continue;
    if (/^@(start|end)uml/i.test(line) || /^(title|skinparam|hide|show|header|footer)\b/i.test(line)) continue;
    let m: RegExpMatchArray | null;

    if (/^autonumber\b/i.test(line)) {
      autonumber = true;
      continue;
    }
    if ((m = line.match(/^autoactivate\s+(on|off)\s*$/i))) {
      activations = m[1].toLowerCase() === 'on';
      continue;
    }
    // Declarations: participant X, actor "Name" as X, boundary X as "Name"
    if ((m = line.match(/^(participant|actor|boundary|control|entity|database|collections|queue)\s+(.+)$/i))) {
      const kw = m[1].toLowerCase();
      const kind: ParticipantKind = KINDS.includes(kw as ParticipantKind) ? (kw as ParticipantKind) : 'object';
      const rest = m[2].trim();
      let d: RegExpMatchArray | null;
      if ((d = rest.match(/^"([^"]*)"\s+as\s+([\p{L}\p{N}_]+)$/u))) declare(d[2], d[1], kind);
      else if ((d = rest.match(/^([\p{L}\p{N}_]+)\s+as\s+"([^"]*)"$/u))) declare(d[1], d[2], kind);
      else if ((d = rest.match(/^([\p{L}\p{N}_]+)$/u))) declare(d[1], d[1], kind);
      else if ((d = rest.match(/^"([^"]*)"$/))) declare(d[1], d[1], kind);
      else problems.push({ line: n, message: `can't read the participant "${rest}" (use: ${kw} Name, or ${kw} "Long name" as Alias)` });
      continue;
    }
    if ((m = line.match(/^create\s+(?:\w+\s+)?([\p{L}\p{N}_]+)\s*$/u))) {
      ref(m[1]);
      pendingCreate = { alias: m[1], line: n };
      continue;
    }
    if ((m = line.match(/^destroy\s+([\p{L}\p{N}_]+)\s*$/u))) {
      const target = ref(m[1]);
      const last = [...items].reverse().find((it) => it.t === 'msg');
      if (last && last.t === 'msg' && last.to === target.id) last.style = 'destroy';
      else problems.push({ line: n, message: `"destroy ${m[1]}" must come right after a message to ${m[1]}` });
      continue;
    }
    // Multi-line note: note over A, B … end note
    if ((m = line.match(/^note\s+(over|left of|right of)\s+([^:]+)$/i))) {
      const over = m[2].split(',').map((s) => ref(s.trim()).id);
      const body: string[] = [];
      let j = i + 1;
      while (j < lines.length && !/^\s*end\s*note\s*$/i.test(lines[j])) body.push(lines[j].trim()), j++;
      if (j >= lines.length) problems.push({ line: n, message: 'note without "end note"' });
      items.push({ id: uid(), t: 'note', over, text: body.join('\n') });
      i = j;
      continue;
    }
    if ((m = line.match(/^note\s+(over|left of|right of)\s+([^:]+):\s*(.*)$/i))) {
      const over = m[2].split(',').map((s) => ref(s.trim()).id);
      items.push({ id: uid(), t: 'note', over, text: m[3].replace(/\\n/g, '\n') });
      continue;
    }
    if ((m = line.match(/^ref\s+over\s+([^:]+)(?::\s*(.*))?$/i))) {
      for (const s of m[1].split(',')) ref(s.trim());
      items.push({ id: uid(), t: 'open', op: 'ref', guard: (m[2] ?? '').trim() });
      items.push({ id: uid(), t: 'close' });
      continue;
    }
    if ((m = line.match(/^group\s+ref\s*(?:\[(.*)\])?\s*$/i))) {
      items.push({ id: uid(), t: 'open', op: 'ref', guard: (m[1] ?? '').trim() });
      openStack.push({ op: 'ref', line: n });
      continue;
    }
    if ((m = line.match(/^(alt|opt|loop|par|break|critical)\b\s*(.*)$/i))) {
      const op = m[1].toLowerCase() as Op;
      items.push({ id: uid(), t: 'open', op: op as Exclude<Op, never>, guard: m[2].trim() });
      openStack.push({ op, line: n });
      continue;
    }
    if ((m = line.match(/^(else|and)\b\s*(.*)$/i))) {
      if (!openStack.length) problems.push({ line: n, message: `"${m[1]}" outside alt / par` });
      items.push({ id: uid(), t: 'else', guard: m[2].trim() });
      continue;
    }
    if (/^end\s*$/i.test(line)) {
      if (!openStack.pop()) {
        problems.push({ line: n, message: '"end" without an open fragment' });
        continue;
      }
      items.push({ id: uid(), t: 'close' });
      continue;
    }
    // Messages: A -> B: text, A ->> B, A --> B, A -->> B, A -\ B, B <- A
    if ((m = line.match(/^([\p{L}\p{N}_]+)\s*(-->>|->>|-->|->|-\\|<--|<-)\s*([\p{L}\p{N}_]+)\s*[+\-*]*\s*(?::\s*(.*))?$/u))) {
      let [, a, arrow, b] = m;
      const text = (m[4] ?? '').trim();
      if (arrow.startsWith('<')) {
        [a, b] = [b, a];
        arrow = arrow === '<--' ? '-->' : '->';
      }
      const from = ref(a);
      const to = ref(b);
      let style: MessageStyle = arrow === '->' ? 'sync' : arrow === '->>' || arrow === '-\\' ? 'async' : 'reply';
      if (pendingCreate && pendingCreate.alias === b) {
        style = 'create';
        pendingCreate = null;
      }
      items.push({ id: uid(), t: 'msg', from: from.id, to: to.id, text, style });
      continue;
    }
    if ((m = line.match(/^(activate|deactivate|return)\b/i))) continue; // drawn automatically
    problems.push({ line: n, message: `don't understand "${line.length > 40 ? line.slice(0, 40) + '…' : line}"` });
  }
  if (pendingCreate) problems.push({ line: pendingCreate.line, message: `"create ${pendingCreate.alias}" has no message to ${pendingCreate.alias} after it` });
  for (const o of openStack) problems.push({ line: o.line, message: `"${o.op}" is never closed with "end"` });
  if (problems.length) throw new SeqParseError(problems);
  return { participants: parts, items, activations, autonumber };
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
          const all = data.participants.map((p) => name(p.id));
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
        const ids = it.over.map(name);
        const over = ids.length > 1 ? `${ids[0]},${ids[ids.length - 1]}` : ids[0] ?? name(data.participants[0]?.id ?? '');
        out.push(`${pad()}Note over ${over}: ${it.text.replace(/\n/g, '<br/>')}`);
        break;
      }
    }
  }
  return out.join('\n') + '\n';
}
