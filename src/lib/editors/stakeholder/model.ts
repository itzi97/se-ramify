/**
 * Stakeholder map logic, kept free of Svelte so the tests can use it:
 * the Mendelow quadrant of each stakeholder, the onion's rings and sectors,
 * and where each stakeholder sits in the onion.
 */
import type { Stakeholder, StakeholderData } from '../../model/types';

export type Sector = Stakeholder['sector'];
export type Ring = Stakeholder['ring'];
export type Attitude = Stakeholder['attitude'];

export interface Quadrant {
  id: 'manage' | 'satisfied' | 'informed' | 'monitor';
  /** The strategy, as on the slide. */
  title: string;
  /** Who usually sits there (the slide's small caps). */
  who: string;
  tint: string;
}

export const QUADRANTS: Record<Quadrant['id'], Quadrant> = {
  satisfied: { id: 'satisfied', title: 'Mantener satisfechos', who: 'Context setters · Blockers', tint: '#e8873a' },
  manage: { id: 'manage', title: 'Gestionar de cerca', who: 'Champions · Drivers', tint: '#4a7fc1' },
  monitor: { id: 'monitor', title: 'Monitorizar', who: 'Crowd · Bystanders', tint: '#58a55c' },
  informed: { id: 'informed', title: 'Mantener informados', who: 'Defenders · Subjects', tint: '#8a63c4' }
};

export function quadrantOf(s: Pick<Stakeholder, 'power' | 'interest'>): Quadrant {
  const highPower = s.power >= 0.5;
  const highInterest = s.interest >= 0.5;
  if (highPower && highInterest) return QUADRANTS.manage;
  if (highPower) return QUADRANTS.satisfied;
  if (highInterest) return QUADRANTS.informed;
  return QUADRANTS.monitor;
}

/** The onion's rings, from the centre out (Tema 3, "Gestión de stakeholders"). */
export const RINGS: { ring: Ring; label: string }[] = [
  { ring: 0, label: 'Es vital involucrarlo' },
  { ring: 1, label: 'Es necesario involucrarlos' },
  { ring: 2, label: 'Estaría bien involucrarlos' },
  { ring: 3, label: 'Informar por cortesía' }
];

/** Sectors with the angle (degrees, screen coordinates, 0 = right, 90 = down) at their middle. */
export const SECTORS: { sector: Sector; label: string; angle: number }[] = [
  { sector: 'decisores', label: 'Decisores', angle: -90 },
  { sector: 'clientes', label: 'Clientes', angle: 0 },
  { sector: 'influyentes', label: 'Influyentes', angle: 90 },
  { sector: 'proveedores', label: 'Proveedores', angle: 180 }
];

export const ATTITUDES: { attitude: Attitude; label: string; color: string }[] = [
  { attitude: 'supporter', label: 'A favor', color: '#58a55c' },
  { attitude: 'neutral', label: 'Neutral', color: '#8d949c' },
  { attitude: 'critic', label: 'En contra', color: '#d9534f' }
];

export function attitudeColor(a: Attitude | undefined): string {
  return (ATTITUDES.find((x) => x.attitude === a) ?? ATTITUDES[1]).color;
}

const SECTOR_IDS = new Set<Sector>(['decisores', 'clientes', 'influyentes', 'proveedores']);

const clamp01 = (n: unknown, fallback = 0.5) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback);

/** A stakeholder with every field valid (older or hand-edited files). */
export function normStakeholder(s: Partial<Stakeholder> & { id: string }): Stakeholder {
  const ring = typeof s.ring === 'number' && s.ring >= 0 && s.ring <= 3 ? (Math.round(s.ring) as Ring) : 2;
  return {
    id: s.id,
    name: typeof s.name === 'string' ? s.name : '',
    role: typeof s.role === 'string' ? s.role : '',
    power: clamp01(s.power),
    interest: clamp01(s.interest),
    ring,
    sector: s.sector && SECTOR_IDS.has(s.sector) ? s.sector : 'clientes',
    attitude: s.attitude === 'supporter' || s.attitude === 'critic' ? s.attitude : 'neutral',
    notes: typeof s.notes === 'string' ? s.notes : ''
  };
}

/* ------------------------------------------------------------- the onion */

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;


export const ONION = {
  width: 1080,
  height: 740,
  cx: 540,
  cy: 370,
  /** Radius of the product disc in the middle. */
  core: 42,
  /** Outer radius of each ring, 0..3. */
  radii: [126, 196, 266, 334]
} as const;

export function ringBand(ring: Ring): [number, number] {
  return [ring === 0 ? ONION.core : ONION.radii[ring - 1], ONION.radii[ring]];
}

/** Ring labels are drawn along the band's middle arc, centred on the -135° diagonal. */
export const RING_LABEL_ANGLE = -135;
const LABEL_CHAR_W = 6.9;

export function ringMid(ring: Ring): number {
  const [a, b] = ringBand(ring);
  return (a + b) / 2;
}

/** Half the angle (degrees) a ring's label takes along its arc. */
export function ringLabelHalfAngle(ring: Ring): number {
  return ((RINGS[ring].label.length * LABEL_CHAR_W) / 2 / ringMid(ring)) * (180 / Math.PI);
}

const sectorRange = (sector: Sector): [number, number] => {
  const mid = SECTORS.find((x) => x.sector === sector)!.angle;
  return [mid - 45, mid + 45];
};

export interface OnionSpot {
  id: string;
  x: number;
  y: number;
  /** Where the label goes relative to the dot. */
  anchor: 'start' | 'end' | 'middle';
  lx: number;
  ly: number;
}

const ONION_CHAR_W = 8;
const SECTOR_CHAR_W = 9.6;

/**
 * Where each stakeholder sits: in its ring × sector cell, spread evenly
 * along the arc (over two radii when the cell is crowded; a lone member is
 * nudged along the arc by ring so neighbours in other rings don't line up),
 * and its label beside it on the first side that hits nothing else.
 */
export function onionLayout(list: Stakeholder[]): OnionSpot[] {
  const cells = new Map<string, Stakeholder[]>();
  for (const s of list) {
    const key = `${s.ring}:${s.sector}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key)!.push(s);
  }
  const dots: { s: Stakeholder; x: number; y: number; cos: number; sin: number }[] = [];
  for (const members of cells.values()) {
    const { ring, sector } = members[0];
    const [r0, r1] = ringBand(ring);
    const [a0, a1] = sectorRange(sector);
    // Keep clear of the diagonal sector lines, and of the ring labels that sit
    // on the upper-left diagonal (-135°, i.e. 225°).
    const pad = 9;
    const labelPad = ringLabelHalfAngle(ring) + 4;
    const lo = a0 + (sector === 'decisores' ? labelPad : pad);
    const hi = a1 - (sector === 'proveedores' ? labelPad : pad);
    const n = members.length;
    const arc = ((hi - lo) * Math.PI) / 180;
    const perArc = Math.max(1, Math.floor((arc * (r0 + r1)) / 2 / 70));
    const twoRows = n > perArc && r1 - r0 > 50;
    members.forEach((s, i) => {
      const row = twoRows ? i % 2 : 0;
      const slots = twoRows ? Math.ceil(n / 2) : n;
      const slot = twoRows ? Math.floor(i / 2) : i;
      let t = (slot + (twoRows && row ? 0.75 : 0.5)) / (slots + (twoRows ? 0.25 : 0));
      if (n === 1) t = 0.5 + (ring - 1.5) * 0.17;
      const angle = ((lo + (hi - lo) * t) * Math.PI) / 180;
      const r = twoRows ? r0 + (r1 - r0) * (row ? 0.7 : 0.32) : (r0 + r1) / 2;
      dots.push({ s, x: ONION.cx + r * Math.cos(angle), y: ONION.cy + r * Math.sin(angle), cos: Math.cos(angle), sin: Math.sin(angle) });
    });
  }

  const obstacles: Box[] = [
    ...sectorLabels().map((l) => {
      const w = l.label.length * SECTOR_CHAR_W;
      const x0 = l.anchor === 'start' ? l.x : l.anchor === 'end' ? l.x - w : l.x - w / 2;
      return { x0: x0 - 4, x1: x0 + w + 4, y0: l.y - 16, y1: l.y + 5 };
    }),
    { x0: ONION.cx - ONION.core, x1: ONION.cx + ONION.core, y0: ONION.cy - ONION.core, y1: ONION.cy + ONION.core },
    ...dots.map((d) => ({ x0: d.x - 9, x1: d.x + 9, y0: d.y - 9, y1: d.y + 9 }))
  ];
  const placed: Box[] = [];
  const out: OnionSpot[] = [];
  for (const d of dots) {
    const w = Math.max(16, d.s.name.length * ONION_CHAR_W);
    const box = (anchor: OnionSpot['anchor'], lx: number, ly: number): Box => ({
      x0: anchor === 'start' ? lx : anchor === 'end' ? lx - w : lx - w / 2,
      x1: anchor === 'start' ? lx + w : anchor === 'end' ? lx : lx + w / 2,
      y0: ly - 14,
      y1: ly + 4
    });
    const right = { anchor: 'start' as const, lx: d.x + 12, ly: d.y + 5 };
    const left = { anchor: 'end' as const, lx: d.x - 12, ly: d.y + 5 };
    const below = { anchor: 'middle' as const, lx: d.x, ly: d.y + 25 };
    const above = { anchor: 'middle' as const, lx: d.x, ly: d.y - 14 };
    const outward = Math.abs(d.cos) < 0.35 ? (d.sin < 0 ? [above, below] : [below, above]) : d.cos > 0 ? [right, below, above] : [left, below, above];
    const all = [...outward, right, left, below, above];
    const candidates = [...all, ...all.flatMap((c) => [13, -13, 26, -26].map((dy) => ({ ...c, ly: c.ly + dy })))];
    const fits = (b: Box) => b.x0 >= 2 && b.x1 <= ONION.width - 2 && !placed.some((p) => overlaps(p, b)) && !obstacles.some((o) => overlaps(o, b));
    const pick = candidates.find((c) => fits(box(c.anchor, c.lx, c.ly))) ?? outward[0];
    placed.push(box(pick.anchor, pick.lx, pick.ly));
    out.push({ id: d.s.id, x: d.x, y: d.y, anchor: pick.anchor, lx: pick.lx, ly: pick.ly });
  }
  return out;
}

/** The four sector labels around the onion. */
export function sectorLabels(): { sector: Sector; label: string; x: number; y: number; anchor: 'start' | 'end' | 'middle' }[] {
  const r = ONION.radii[3] + 16;
  return SECTORS.map((sc) => {
    const a = (sc.angle * Math.PI) / 180;
    return {
      sector: sc.sector,
      label: sc.label,
      x: ONION.cx + r * Math.cos(a),
      y: ONION.cy + r * Math.sin(a) + (sc.angle === 90 ? 16 : sc.angle === -90 ? -2 : 6),
      anchor: sc.angle === 0 ? 'start' : sc.angle === 180 ? 'end' : 'middle'
    };
  });
}

/** Split the product name into at most three short lines for the centre disc. */
export function coreLines(text: string, max = 12): string[] {
  const words = (text.trim() || 'Proyecto').split(/\s+/);
  const lines: string[] = [];
  for (const w of words) {
    const last = lines[lines.length - 1];
    if (last !== undefined && (last + ' ' + w).length <= max) lines[lines.length - 1] = last + ' ' + w;
    else lines.push(w.length > max ? w.slice(0, max - 1) + '…' : w);
  }
  if (lines.length > 3) return [...lines.slice(0, 2), lines[2].slice(0, max - 1) + '…'];
  return lines;
}

/** Which ring and sector a point of the onion (in its own coordinates) falls in. */
export function onionCellAt(x: number, y: number): { ring: Ring; sector: Sector } {
  const dx = x - ONION.cx;
  const dy = y - ONION.cy;
  const r = Math.hypot(dx, dy);
  let ring: Ring = 3;
  for (const k of [0, 1, 2, 3] as Ring[]) {
    if (r <= ONION.radii[k]) {
      ring = k;
      break;
    }
  }
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI; // -180..180
  const sector: Sector = deg >= -135 && deg < -45 ? 'decisores' : deg >= -45 && deg < 45 ? 'clientes' : deg >= 45 && deg < 135 ? 'influyentes' : 'proveedores';
  return { ring, sector };
}

/* -------------------------------------------------------------- the grid */

export const GRID = {
  width: 860,
  height: 650,
  /** Plot area. */
  x0: 78,
  x1: 840,
  y0: 20,
  y1: 556
} as const;

export function gridPoint(s: Pick<Stakeholder, 'power' | 'interest'>): { x: number; y: number } {
  return { x: GRID.x0 + s.interest * (GRID.x1 - GRID.x0), y: GRID.y1 - s.power * (GRID.y1 - GRID.y0) };
}

export function gridValueAt(x: number, y: number): { power: number; interest: number } {
  const c = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 100) / 100;
  return { interest: c((x - GRID.x0) / (GRID.x1 - GRID.x0)), power: c((GRID.y1 - y) / (GRID.y1 - GRID.y0)) };
}

export interface GridLabel {
  id: string;
  x: number;
  y: number;
  lx: number;
  ly: number;
  anchor: 'start' | 'end';
}


/** Where the four quadrant titles are drawn (centre x, baseline y of the title; the subtitle sits 17px lower). */
export function quadrantTitles(): { q: Quadrant; x: number; y: number }[] {
  const xm = (GRID.x0 + GRID.x1) / 2;
  const ym = (GRID.y0 + GRID.y1) / 2;
  const qw = (GRID.x1 - GRID.x0) / 2;
  return [
    { q: QUADRANTS.satisfied, x: GRID.x0 + qw / 2, y: GRID.y0 + 30 },
    { q: QUADRANTS.manage, x: xm + qw / 2, y: GRID.y0 + 30 },
    { q: QUADRANTS.monitor, x: GRID.x0 + qw / 2, y: ym + 30 },
    { q: QUADRANTS.informed, x: xm + qw / 2, y: ym + 30 }
  ];
}


/**
 * Labels beside their dots. Each label tries the right side, then the left,
 * then steps down / up, and takes the first spot that hits no other label,
 * dot or quadrant title.
 */
export function gridLabels(list: Stakeholder[], charW = 7): GridLabel[] {
  const titles: Box[] = quadrantTitles().map(({ q, x, y }) => {
    const w = Math.max(q.title.length * 9, q.who.length * 7) / 2 + 6;
    return { x0: x - w, x1: x + w, y0: y - 16, y1: y + 23 };
  });
  const dots: Box[] = list.map((s) => {
    const { x, y } = gridPoint(s);
    return { x0: x - 9, x1: x + 9, y0: y - 9, y1: y + 9 };
  });
  const placed: Box[] = [];
  const out: GridLabel[] = [];
  const sorted = [...list].sort((a, b) => b.power - a.power || a.interest - b.interest);
  for (const s of sorted) {
    const { x, y } = gridPoint(s);
    const w = Math.max(20, s.name.length * charW);
    const boxFor = (anchor: 'start' | 'end', ly: number): Box => {
      const lx = anchor === 'start' ? x + 12 : x - 12;
      return { x0: anchor === 'start' ? lx : lx - w, x1: anchor === 'start' ? lx + w : lx, y0: ly - 12, y1: ly + 3 };
    };
    const inside = (b: Box) => b.x0 >= GRID.x0 - 2 && b.x1 <= GRID.x1 + 30 && b.y0 >= GRID.y0 - 14 && b.y1 <= GRID.y1 + 2;
    const free = (b: Box) => inside(b) && !placed.some((p) => overlaps(p, b)) && !titles.some((t) => overlaps(t, b)) && !dots.some((d) => overlaps(d, b));
    let best: { anchor: 'start' | 'end'; ly: number } | null = null;
    const prefer: ('start' | 'end')[] = x > GRID.x1 - w - 24 ? ['end', 'start'] : ['start', 'end'];
    outer: for (const dy of [0, 14, -14, 28, -28, 42, -42, 56, -56]) {
      for (const anchor of prefer) {
        if (free(boxFor(anchor, y + 4 + dy))) {
          best = { anchor, ly: y + 4 + dy };
          break outer;
        }
      }
    }
    best ??= { anchor: prefer[0], ly: y + 4 };
    const b = boxFor(best.anchor, best.ly);
    placed.push(b);
    out.push({ id: s.id, x, y, lx: best.anchor === 'start' ? x + 12 : x - 12, ly: best.ly, anchor: best.anchor });
  }
  return out;
}

/* ---------------------------------------------------------------- exports */

const ringLabel = (r: Ring) => RINGS[r].label;
const sectorLabel = (s: Sector) => SECTORS.find((x) => x.sector === s)!.label;
const attitudeLabel = (a: Attitude) => ATTITUDES.find((x) => x.attitude === a)!.label;
const pct = (n: number) => `${Math.round(n * 100)} %`;

function rows(data: StakeholderData): string[][] {
  return data.stakeholders.map((raw) => {
    const s = normStakeholder(raw);
    return [s.name, s.role, pct(s.power), pct(s.interest), quadrantOf(s).title, ringLabel(s.ring), sectorLabel(s.sector), attitudeLabel(s.attitude), s.notes];
  });
}

const HEAD = ['Stakeholder', 'Rol', 'Poder/Influencia', 'Interés', 'Estrategia', 'Anillo', 'Sector', 'Actitud', 'Notas'];

export function stakeholderMarkdown(title: string, data: StakeholderData): string {
  const cell = (t: string) => t.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();
  const out = [`# ${title}`, ''];
  if (data.product.trim()) out.push(`**Producto / proyecto:** ${cell(data.product)}`, '');
  out.push(`| ${HEAD.join(' | ')} |`, `|${HEAD.map(() => '---').join('|')}|`);
  for (const r of rows(data)) out.push(`| ${r.map(cell).join(' | ')} |`);
  out.push('', '## Por estrategia (matriz poder/influencia – interés)', '');
  for (const q of [QUADRANTS.manage, QUADRANTS.satisfied, QUADRANTS.informed, QUADRANTS.monitor]) {
    const names = data.stakeholders.map(normStakeholder).filter((s) => quadrantOf(s).id === q.id).map((s) => s.name || '(sin nombre)');
    out.push(`- **${q.title}** (${q.who}): ${names.length ? names.join(', ') : '—'}`);
  }
  out.push('');
  return out.join('\n');
}

export function stakeholderCsv(data: StakeholderData): string {
  const esc = (t: string) => (/[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t);
  return [HEAD, ...rows(data)].map((r) => r.map(esc).join(',')).join('\n') + '\n';
}
