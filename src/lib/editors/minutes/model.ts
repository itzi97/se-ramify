/**
 * Meeting minutes ("acta"): templates per type, list operations, a checker
 * of what an acta still lacks, and the Markdown / CSV exports. Pure, so the
 * node tests can call it.
 */
import { uid } from '../../model/diagram';
import type { MinutesData, MinutesType } from '../../model/types';

export interface MinutesTypeInfo {
  type: MinutesType;
  /** UI label (English, like the rest of the app). */
  label: string;
  /** Title of the document. */
  title: string;
  /** Default agenda. */
  agenda: string[];
  /** Shows the questions & answers section. */
  questions: boolean;
  /** Shows the well / bad / improve review. */
  review: boolean;
}

export const MINUTES_TYPES: MinutesTypeInfo[] = [
  {
    type: 'client',
    label: 'Client meeting',
    title: 'Acta de reunión con el cliente',
    agenda: ['Presentación de los asistentes', 'Aclarar requisitos de …', 'Dudas del equipo', 'Próximos pasos'],
    questions: true,
    review: false
  },
  {
    type: 'team',
    label: 'Team meeting',
    title: 'Acta de reunión de equipo',
    agenda: ['Estado del trabajo', 'Reparto de tareas', 'Riesgos y bloqueos', 'Próximos pasos'],
    questions: false,
    review: false
  },
  {
    type: 'postmortem',
    label: 'Post mortem',
    title: 'Acta de reunión post mortem',
    agenda: ['Qué ha funcionado bien', 'Qué ha ido mal', 'Qué mejoraríamos', 'Acciones para el próximo proyecto'],
    questions: false,
    review: true
  },
  {
    type: 'retro',
    label: 'Retrospective',
    title: 'Acta de retrospectiva',
    agenda: ['Qué ha ido bien', 'Qué ha ido mal', 'Qué es mejorable', 'Acuerdos para el próximo sprint'],
    questions: false,
    review: true
  }
];

export function typeInfo(type: MinutesType): MinutesTypeInfo {
  return MINUTES_TYPES.find((t) => t.type === type) ?? MINUTES_TYPES[0];
}

export const REVIEW_KINDS: { kind: 'well' | 'bad' | 'improve'; label: string; es: string }[] = [
  { kind: 'well', label: 'Went well', es: 'Bien' },
  { kind: 'bad', label: 'Went badly', es: 'Mal' },
  { kind: 'improve', label: 'To improve', es: 'Mejorable' }
];

export const REVIEW_AREAS: { area: 'team' | 'method'; label: string; es: string }[] = [
  { area: 'team', label: 'Team', es: 'Equipo' },
  { area: 'method', label: 'Methodology', es: 'Metodología' }
];

/* ---------------------------------------------------------- normalising */

/** Fill in anything a hand-edited or older file lacks. */
export function normMinutes(d: Partial<MinutesData>): MinutesData {
  const arr = <T>(v: T[] | undefined) => (Array.isArray(v) ? v : []);
  return {
    type: MINUTES_TYPES.some((t) => t.type === d.type) ? d.type! : 'client',
    number: d.number ?? '',
    date: d.date ?? '',
    start: d.start ?? '',
    end: d.end ?? '',
    place: d.place ?? '',
    attendees: arr(d.attendees).map((a) => ({ id: a.id ?? uid(), name: a.name ?? '', role: a.role ?? '', present: a.present !== false })),
    agenda: arr(d.agenda).map((a) => ({ id: a.id ?? uid(), text: a.text ?? '' })),
    discussion: d.discussion ?? '',
    decisions: arr(d.decisions).map((a) => ({ id: a.id ?? uid(), text: a.text ?? '' })),
    actions: arr(d.actions).map((a) => ({ id: a.id ?? uid(), text: a.text ?? '', owner: a.owner ?? '', due: a.due ?? '', done: !!a.done })),
    questions: arr(d.questions).map((a) => ({ id: a.id ?? uid(), text: a.text ?? '', answer: a.answer ?? '' })),
    review: arr(d.review).map((a) => ({
      id: a.id ?? uid(),
      text: a.text ?? '',
      kind: a.kind === 'bad' || a.kind === 'improve' ? a.kind : 'well',
      area: a.area === 'method' ? 'method' : 'team'
    })),
    next: d.next ?? ''
  };
}

/* ------------------------------------------------------------ templates */

/** The agenda the type starts with. */
export function templateAgenda(type: MinutesType): { id: string; text: string }[] {
  return typeInfo(type).agenda.map((text) => ({ id: uid(), text }));
}

/** True when the agenda is empty or still exactly some type's template (safe to replace). */
export function agendaIsTemplate(d: MinutesData): boolean {
  const texts = d.agenda.map((a) => a.text.trim()).filter(Boolean);
  if (!texts.length) return true;
  return MINUTES_TYPES.some((t) => t.agenda.length === texts.length && t.agenda.every((x, i) => x === texts[i]));
}

/**
 * Switch the type. The agenda follows the new type's template when it is
 * empty or still an untouched template; a written agenda is kept.
 */
export function setType(d: MinutesData, type: MinutesType): void {
  const replace = agendaIsTemplate(d);
  d.type = type;
  if (replace) d.agenda = templateAgenda(type);
}

/** Put the type's template agenda back (on demand). */
export function resetAgenda(d: MinutesData): void {
  d.agenda = templateAgenda(d.type);
}

/* ------------------------------------------------------------- list ops */

export type ListKey = 'attendees' | 'agenda' | 'decisions' | 'actions' | 'questions' | 'review';

type Row<K extends ListKey> = MinutesData[K][number];

/** A fresh row for a list. */
export function blankRow<K extends ListKey>(key: K, extra: Partial<Row<K>> = {}): Row<K> {
  const id = uid();
  const base: Record<ListKey, Record<string, unknown>> = {
    attendees: { id, name: '', role: '', present: true },
    agenda: { id, text: '' },
    decisions: { id, text: '' },
    actions: { id, text: '', owner: '', due: '', done: false },
    questions: { id, text: '', answer: '' },
    review: { id, text: '', kind: 'well', area: 'team' }
  };
  return { ...base[key], ...extra } as Row<K>;
}

export function addRow<K extends ListKey>(d: MinutesData, key: K, extra: Partial<Row<K>> = {}): string {
  const row = blankRow(key, extra);
  (d[key] as Row<K>[]).push(row);
  return row.id;
}

export function updateRow<K extends ListKey>(d: MinutesData, key: K, id: string, patch: Partial<Row<K>>): void {
  const list = d[key] as Row<K>[];
  const i = list.findIndex((r) => r.id === id);
  if (i >= 0) list[i] = { ...list[i], ...patch };
}

export function removeRow(d: MinutesData, key: ListKey, id: string): void {
  const list = d[key] as { id: string }[];
  const i = list.findIndex((r) => r.id === id);
  if (i >= 0) list.splice(i, 1);
}

/** Move a row up (-1) or down (+1). */
export function moveRow(d: MinutesData, key: ListKey, id: string, delta: -1 | 1): void {
  const list = d[key] as { id: string }[];
  const i = list.findIndex((r) => r.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
}

/* -------------------------------------------------------------- checker */

/** What the acta still lacks, as short English sentences for the UI. Empty when complete. */
export function missing(d: MinutesData): string[] {
  const out: string[] = [];
  const info = typeInfo(d.type);
  const filled = <T extends { text: string }>(l: T[]) => l.filter((x) => x.text.trim());
  if (!d.date) out.push('No date.');
  if (!d.attendees.some((a) => a.name.trim())) out.push('No attendees.');
  if (!filled(d.agenda).length) out.push('No agenda.');
  if (d.agenda.some((a) => a.text.includes('…'))) out.push('An agenda item still has "…" to fill in.');
  const actions = filled(d.actions);
  if (!filled(d.decisions).length && !actions.length) out.push('No decisions or actions agreed.');
  const noOwner = actions.filter((a) => !a.owner.trim()).length;
  const noDue = actions.filter((a) => !a.due).length;
  if (noOwner) out.push(`${noOwner} action${noOwner > 1 ? 's' : ''} without an owner.`);
  if (noDue) out.push(`${noDue} action${noDue > 1 ? 's' : ''} without a due date.`);
  if (info.questions && !d.questions.some((q) => q.text.trim())) out.push('No questions recorded for the client.');
  if (info.questions && d.questions.some((q) => q.text.trim() && !q.answer.trim())) out.push('A question has no answer yet.');
  if (info.review) {
    const items = filled(d.review);
    if (!items.some((r) => r.area === 'team')) out.push('Nothing about the team (Equipo).');
    if (!items.some((r) => r.area === 'method')) out.push('Nothing about the methodology (Metodología).');
    for (const k of REVIEW_KINDS) if (!items.some((r) => r.kind === k.kind)) out.push(`Nothing under "${k.es}".`);
  }
  return out;
}

/* ------------------------------------------------------------ formatting */

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** "martes, 20 de octubre de 2026" from an ISO date; '' when empty or invalid. */
export function longDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  if (!m) return '';
  const [y, mo, da] = [+m[1], +m[2], +m[3]];
  const dow = new Date(Date.UTC(y, mo - 1, da)).getUTCDay();
  return `${DAYS[dow]}, ${da} de ${MONTHS[mo - 1]} de ${y}`;
}

/** "20/10/2026". */
export function shortDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

/** "17:00–18:30", "desde las 17:00", or ''. */
export function timeRange(d: MinutesData): string {
  const s = d.start.trim();
  const e = d.end.trim();
  if (s && e) return `${s}–${e}`;
  if (s) return `desde las ${s}`;
  return e ? `hasta las ${e}` : '';
}

/** "Acta de reunión con el cliente nº 1". */
export function heading(d: MinutesData): string {
  const t = typeInfo(d.type).title;
  return d.number.trim() ? `${t} nº ${d.number.trim()}` : t;
}

/** Review items grouped by area, then by kind (only non-empty). */
export function reviewGroups(d: MinutesData) {
  return REVIEW_AREAS.map((a) => ({
    ...a,
    kinds: REVIEW_KINDS.map((k) => ({ ...k, items: d.review.filter((r) => r.area === a.area && r.kind === k.kind && r.text.trim()) }))
  }));
}

/* --------------------------------------------------------------- exports */

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();

export function minutesMarkdown(title: string, raw: MinutesData): string {
  const d = normMinutes(raw);
  const info = typeInfo(d.type);
  const has = <T extends { text: string }>(l: T[]) => l.filter((x) => x.text.trim());
  const out: string[] = [`# ${title}`, '', `**${heading(d)}**`, ''];
  out.push('| Fecha | Hora | Lugar |', '|---|---|---|', `| ${longDate(d.date) || '—'} | ${timeRange(d) || '—'} | ${cell(d.place) || '—'} |`, '');

  const people = d.attendees.filter((a) => a.name.trim());
  const present = people.filter((a) => a.present);
  const absent = people.filter((a) => !a.present);
  const who = (a: (typeof people)[number]) => `- ${a.name.trim()}${a.role.trim() ? ` — ${a.role.trim()}` : ''}`;
  if (present.length) out.push('## Asistentes', '', ...present.map(who), '');
  if (absent.length) out.push('## Ausentes', '', ...absent.map(who), '');

  const agenda = has(d.agenda);
  if (agenda.length) out.push('## Orden del día', '', ...agenda.map((a, i) => `${i + 1}. ${a.text.trim()}`), '');
  if (d.discussion.trim()) out.push('## Desarrollo de la reunión', '', d.discussion.trim(), '');

  if (info.questions) {
    const qs = d.questions.filter((q) => q.text.trim());
    if (qs.length) {
      out.push('## Preguntas y respuestas', '');
      qs.forEach((q, i) => out.push(`${i + 1}. **${q.text.trim()}**`, `   ${q.answer.trim() || '_Pendiente de respuesta._'}`));
      out.push('');
    }
  }

  if (info.review && has(d.review).length) {
    out.push('## Valoración', '');
    for (const g of reviewGroups(d)) {
      if (!g.kinds.some((k) => k.items.length)) continue;
      out.push(`### ${g.es}`, '');
      for (const k of g.kinds) if (k.items.length) out.push(`**${k.es}**`, '', ...k.items.map((r) => `- ${r.text.trim()}`), '');
    }
  }

  const decisions = has(d.decisions);
  if (decisions.length) out.push('## Acuerdos', '', ...decisions.map((x, i) => `${i + 1}. ${x.text.trim()}`), '');

  const actions = has(d.actions);
  if (actions.length) {
    out.push('## Acciones', '', '| Acción | Responsable | Fecha límite | Estado |', '|---|---|---|---|');
    for (const a of actions) out.push(`| ${cell(a.text)} | ${cell(a.owner) || '—'} | ${shortDate(a.due) || '—'} | ${a.done ? 'Hecha' : 'Pendiente'} |`);
    out.push('');
  }
  if (d.next.trim()) out.push('## Próxima reunión', '', d.next.trim(), '');
  return out.join('\n').trimEnd() + '\n';
}

function csvCell(v: string): string {
  return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** The actions as a CSV for a Spanish spreadsheet: `;` between fields and a UTF-8 BOM. */
export function minutesCsv(raw: MinutesData): string {
  const d = normMinutes(raw);
  const lines = [['Acción', 'Responsable', 'Fecha límite', 'Estado'].join(';')];
  for (const a of d.actions.filter((x) => x.text.trim())) lines.push([a.text.trim(), a.owner.trim(), shortDate(a.due), a.done ? 'Hecha' : 'Pendiente'].map(csvCell).join(';'));
  return '﻿' + lines.join('\n') + '\n';
}
