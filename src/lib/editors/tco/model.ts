/**
 * TCO arithmetic and edits, pure so the tests can call them.
 *
 * As in class (Tema 2), no inflation and no discount rate: a cost is counted
 * in the year it is paid. A line is paid once (in `year`), or every year from
 * `year` on (yearly, or monthly × 12).
 */
import { uid } from '../../model/diagram';
import { SWATCHES } from '../../model/colors';
import type { TcoAlternative, TcoBlock, TcoCriterion, TcoData, TcoLine } from '../../model/types';

export const BLOCKS: { key: TcoBlock; label: string; short: string; color: string }[] = [
  { key: 'dev', label: 'Desarrollo y despliegue', short: 'Desarrollo', color: '#8a63c4' },
  { key: 'hwsw', label: 'Hardware y software', short: 'HW y SW', color: '#4a7fc1' },
  { key: 'ops', label: 'Operaciones', short: 'Operaciones', color: '#3a9e9a' },
  { key: 'long', label: 'Gastos a largo plazo', short: 'Largo plazo', color: '#e8873a' }
];

export const WHEN: { key: TcoLine['when']; label: string }[] = [
  { key: 'once', label: 'Una vez' },
  { key: 'yearly', label: 'Al año' },
  { key: 'monthly', label: 'Al mes' }
];

/** Colours alternatives get when they have none of their own: blue, orange, green, purple. */
const ALT_COLORS = ['#4a7fc1', '#e8873a', '#58a55c', '#8a63c4'];

export const MIN_ALTERNATIVES = 2;
export const MAX_ALTERNATIVES = 4;

export function blockInfo(b: TcoBlock) {
  return BLOCKS.find((x) => x.key === b) ?? BLOCKS[1];
}

export function altColor(data: TcoData, alt: TcoAlternative, colors: string[] = ALT_COLORS): string {
  if (alt.color) return alt.color;
  const i = data.alternatives.findIndex((a) => a.id === alt.id);
  return colors[Math.max(0, i) % colors.length];
}

/* -------------------------------------------------------------- numbers */

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function horizon(data: TcoData): number {
  return Math.max(1, Math.min(10, Math.round(num(data.years) || 3)));
}

/** What one line costs in a given year (1-based). */
export function lineYearCost(line: TcoLine, year: number): number {
  const start = Math.max(1, Math.round(num(line.year) || 1));
  const amount = num(line.unitCost) * num(line.qty);
  if (line.when === 'once') return year === start ? amount : 0;
  if (year < start) return 0;
  return line.when === 'monthly' ? amount * 12 : amount;
}

/** Cost per year, index 0 = year 1. */
export function lineYears(line: TcoLine, years: number): number[] {
  return Array.from({ length: years }, (_, i) => lineYearCost(line, i + 1));
}

export function lineTotal(line: TcoLine, years: number): number {
  return sum(lineYears(line, years));
}

export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

export interface AltSummary {
  id: string;
  name: string;
  color: string;
  /** Cost per year, index 0 = year 1. */
  perYear: number[];
  /** Running total per year. */
  cumulative: number[];
  total: number;
  capex: number;
  opex: number;
  byBlock: Record<TcoBlock, number>;
  /** Total / users, or null when the number of users isn't set. */
  perUser: number | null;
  /** Lines with no price yet (unitCost or qty is 0). */
  unpriced: number;
}

export function summarize(data: TcoData, alt: TcoAlternative): AltSummary {
  const years = horizon(data);
  const perYear = Array.from({ length: years }, () => 0);
  const byBlock: Record<TcoBlock, number> = { dev: 0, hwsw: 0, ops: 0, long: 0 };
  let capex = 0;
  let opex = 0;
  let unpriced = 0;
  for (const line of alt.lines) {
    const ys = lineYears(line, years);
    ys.forEach((v, i) => (perYear[i] += v));
    const t = sum(ys);
    byBlock[line.block in byBlock ? line.block : 'hwsw'] += t;
    if (line.nature === 'capex') capex += t;
    else opex += t;
    if (!num(line.unitCost) || !num(line.qty)) unpriced++;
  }
  const cumulative: number[] = [];
  perYear.reduce((acc, v, i) => (cumulative[i] = acc + v), 0);
  const total = sum(perYear);
  const users = Math.round(num(data.users));
  return { id: alt.id, name: alt.name, color: altColor(data, alt), perYear, cumulative, total, capex, opex, byBlock, perUser: users > 0 ? total / users : null, unpriced };
}

export function summarizeAll(data: TcoData): AltSummary[] {
  return data.alternatives.map((a) => summarize(data, a));
}

/** The cheapest alternative over the horizon and how much it saves against the next one. */
/**
 * The cheapest priced alternative and its saving against the next one.
 * `unpriced` counts lines still without a price in the alternatives compared,
 * so the comparison can say it isn't final yet.
 */
export function cheapest(data: TcoData): { id: string; name: string; total: number; saving: number; against: string; unpriced: number } | null {
  const s = summarizeAll(data).filter((x) => x.total > 0);
  if (s.length < 2) return null;
  const sorted = [...s].sort((a, b) => a.total - b.total);
  const unpriced = s.reduce((n, x) => n + x.unpriced, 0);
  return { id: sorted[0].id, name: sorted[0].name, total: sorted[0].total, saving: sorted[1].total - sorted[0].total, against: sorted[1].name, unpriced };
}

/* ------------------------------------------------------------- criteria */

export const scoreKey = (criterionId: string, altId: string) => `${criterionId}:${altId}`;

export function weightShare(data: TcoData, c: TcoCriterion): number {
  const total = sum(data.criteria.map((x) => Math.max(0, num(x.weight))));
  return total > 0 ? Math.max(0, num(c.weight)) / total : 0;
}

export function scoreOf(data: TcoData, criterionId: string, altId: string): number {
  const v = num(data.scores[scoreKey(criterionId, altId)]);
  return v >= 1 && v <= 5 ? v : 0;
}

/** Weighted score 0..5 per alternative (criteria without a score count as 0). */
export function weightedScore(data: TcoData, altId: string): number {
  return sum(data.criteria.map((c) => weightShare(data, c) * scoreOf(data, c.id, altId)));
}

/** The best weighted score, or null when nothing is scored. */
export function bestScored(data: TcoData): { id: string; name: string; score: number } | null {
  if (!data.criteria.length) return null;
  const s = data.alternatives.map((a) => ({ id: a.id, name: a.name, score: weightedScore(data, a.id) })).sort((a, b) => b.score - a.score);
  return s[0] && s[0].score > 0 ? s[0] : null;
}

/* ------------------------------------------------------------ formatting */

const EUR = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0, minimumFractionDigits: 0 });
const EUR2 = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2, minimumFractionDigits: 2 });
const NUM = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 });

/** "12.345 €" (whole euros; cents only for small amounts like a monthly fee). */
export function eur(v: number, cents = false): string {
  // es-ES leaves 4-digit numbers ungrouped ("1234 €"); group them too, so columns line up.
  const s = (cents || (Math.abs(v) < 100 && v % 1 !== 0) ? EUR2 : EUR).format(v);
  return s.replace(/^(-?)(\d)(\d{3})(\D)/, '$1$2.$3$4');
}

/**
 * A number as typed in Spanish: "1.234,5" → 1234.5. Also accepts "1234.5",
 * and a price pasted from an English page ("$1,234.50"): with both marks,
 * the last one is the decimal separator.
 */
export function parseAmount(text: string): number {
  let t = text.replace(/USD|EUR|US|[€$£\s]/gi, '');
  if (!t) return 0;
  if (t.includes(',') && t.includes('.') && t.lastIndexOf('.') > t.lastIndexOf(',')) t = t.replace(/,/g, '');
  else if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const v = Number(t);
  return Number.isFinite(v) ? v : 0;
}

/** A number for an input: "1234,5" (no grouping, so it edits cleanly). */
export function amountText(v: number): string {
  return num(v) ? String(Math.round(num(v) * 100) / 100).replace('.', ',') : '';
}

export function plainNumber(v: number): string {
  return NUM.format(v);
}

/* ------------------------------------------------------------------ edits */

export function blankLine(patch: Partial<TcoLine> = {}): TcoLine {
  return { id: uid(), name: '', block: 'hwsw', nature: 'capex', unitCost: 0, qty: 1, when: 'once', year: 1, source: '', ...patch };
}

export function addAlternative(data: TcoData, name?: string): TcoAlternative | null {
  if (data.alternatives.length >= MAX_ALTERNATIVES) return null;
  const alt: TcoAlternative = { id: uid(), name: name ?? `Alternativa ${data.alternatives.length + 1}`, description: '', lines: [] };
  data.alternatives.push(alt);
  return alt;
}

export function removeAlternative(data: TcoData, id: string): boolean {
  if (data.alternatives.length <= MIN_ALTERNATIVES) return false;
  data.alternatives = data.alternatives.filter((a) => a.id !== id);
  for (const k of Object.keys(data.scores)) if (k.endsWith(`:${id}`)) delete data.scores[k];
  return true;
}

export function moveItem<T>(xs: T[], i: number, by: number): void {
  const j = i + by;
  if (i < 0 || j < 0 || i >= xs.length || j >= xs.length) return;
  [xs[i], xs[j]] = [xs[j], xs[i]];
}

export function addCriterion(data: TcoData, name = 'Nuevo criterio'): TcoCriterion {
  const c = { id: uid(), name, weight: 1 };
  data.criteria.push(c);
  return c;
}

export function removeCriterion(data: TcoData, id: string): void {
  data.criteria = data.criteria.filter((c) => c.id !== id);
  for (const k of Object.keys(data.scores)) if (k.startsWith(`${id}:`)) delete data.scores[k];
}

/* -------------------------------------------------------------- templates */

const SHOP = 'PVP en tienda (enlace)';
const CALC = 'Calculadora del proveedor (enlace)';
const SALARY = 'Coste salarial anual (fuente)';

/** Typical lines of a local (on-premises) solution with redundancy, unpriced, for her to fill with market prices. */
export function localTemplate(): TcoLine[] {
  const l = (name: string, block: TcoBlock, nature: TcoLine['nature'], when: TcoLine['when'], qty: number, year: number, source: string) =>
    blankLine({ name, block, nature, when, qty, year, source });
  return [
    l('Análisis, desarrollo y pruebas (horas del equipo)', 'dev', 'capex', 'once', 1, 1, 'Horas × coste/hora'),
    l('Instalación, configuración y migración de datos', 'dev', 'capex', 'once', 1, 1, 'Presupuesto / horas'),
    l('Formación de los usuarios', 'dev', 'capex', 'once', 1, 1, 'Horas × coste/hora'),
    l('Servidor (principal y réplica para redundancia)', 'hwsw', 'capex', 'once', 2, 1, SHOP),
    l('SAI (sistema de alimentación ininterrumpida)', 'hwsw', 'capex', 'once', 1, 1, SHOP),
    l('NAS para copias de seguridad', 'hwsw', 'capex', 'once', 1, 1, SHOP),
    l('Discos para el NAS', 'hwsw', 'capex', 'once', 4, 1, SHOP),
    l('Switch gestionable', 'hwsw', 'capex', 'once', 1, 1, SHOP),
    l('Cortafuegos (firewall)', 'hwsw', 'capex', 'once', 1, 1, SHOP),
    l('Armario rack', 'hwsw', 'capex', 'once', 1, 1, SHOP),
    l('Licencias de sistema operativo de servidor', 'hwsw', 'capex', 'once', 2, 1, SHOP),
    l('Licencias de base de datos', 'hwsw', 'capex', 'once', 1, 1, SHOP),
    l('Ampliación de garantía / soporte del fabricante', 'hwsw', 'opex', 'yearly', 2, 2, SHOP),
    l('Administrador de sistemas (parte de su jornada)', 'ops', 'opex', 'yearly', 1, 1, SALARY),
    l('Copia de seguridad externa (fuera de la oficina)', 'ops', 'opex', 'monthly', 1, 1, SHOP),
    l('Mantenimiento correctivo y parches', 'ops', 'opex', 'yearly', 1, 1, 'Horas × coste/hora'),
    l('Reemplazo de discos / componentes', 'long', 'capex', 'once', 1, 3, SHOP),
    l('Ampliación de capacidad', 'long', 'capex', 'once', 1, 3, SHOP)
  ];
}

/** Typical lines of a cloud solution in two zones, unpriced. */
export function cloudTemplate(): TcoLine[] {
  const l = (name: string, block: TcoBlock, nature: TcoLine['nature'], when: TcoLine['when'], qty: number, year: number, source: string) =>
    blankLine({ name, block, nature, when, qty, year, source });
  return [
    l('Análisis, desarrollo y pruebas (horas del equipo)', 'dev', 'capex', 'once', 1, 1, 'Horas × coste/hora'),
    l('Migración de datos y puesta en marcha en la nube', 'dev', 'capex', 'once', 1, 1, 'Presupuesto / horas'),
    l('Formación de los usuarios', 'dev', 'capex', 'once', 1, 1, 'Horas × coste/hora'),
    l('Máquinas virtuales (una en cada zona de disponibilidad)', 'hwsw', 'opex', 'monthly', 2, 1, CALC),
    l('Base de datos gestionada con réplica (multi-zona)', 'hwsw', 'opex', 'monthly', 1, 1, CALC),
    l('Balanceador de carga', 'hwsw', 'opex', 'monthly', 1, 1, CALC),
    l('Almacenamiento de copias de seguridad', 'hwsw', 'opex', 'monthly', 1, 1, CALC),
    l('Tráfico de salida (egress)', 'hwsw', 'opex', 'monthly', 1, 1, CALC),
    l('VPN / conexión segura con la oficina', 'hwsw', 'opex', 'monthly', 1, 1, CALC),
    l('Plan de soporte del proveedor', 'ops', 'opex', 'monthly', 1, 1, CALC),
    l('Administrador cloud (parte de su jornada)', 'ops', 'opex', 'yearly', 1, 1, SALARY),
    l('Monitorización y alertas', 'ops', 'opex', 'monthly', 1, 1, CALC),
    l('Crecimiento de uso / escalado', 'long', 'opex', 'yearly', 1, 2, CALC),
    l('Salida del proveedor (exportar datos al terminar)', 'long', 'capex', 'once', 1, 3, 'Estimación')
  ];
}

/** The template that fits an alternative's name ("nube", "cloud", AWS… → cloud). */
export function templateFor(alt: TcoAlternative): 'local' | 'cloud' {
  return /nube|cloud|aws|azure|google|gcp|ovh|hetzner|iaas|paas|saas/i.test(`${alt.name} ${alt.description}`) ? 'cloud' : 'local';
}

/** Suggested criteria (the "Cada decisión impactará en el TCO" columns plus the client's requirements). */
export const SUGGESTED_CRITERIA: [string, number][] = [
  ['Disponibilidad (9–18 h, L–V)', 3],
  ['Redundancia', 3],
  ['Riesgo operativo', 2],
  ['Escalabilidad', 1],
  ['Dependencia del proveedor', 1]
];

export { SWATCHES };
