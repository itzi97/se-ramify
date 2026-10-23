/**
 * Colour palettes for diagrams: the set of colours offered wherever a colour
 * is picked (shapes, lines, notes, Gantt bars, board zones) and used by
 * "Colour by kind". A project (folder) can have its own, for the company's
 * brand colours, shared with the group through the folder.
 */
import { SWATCHES, hexToRgb, luminance } from './colors';

export interface Swatch {
  name: string;
  hex: string;
}
export interface Palette {
  name: string;
  colors: Swatch[];
}

export const MAX_COLORS = 10;

export const PRESETS: Palette[] = [
  { name: 'se-ramify', colors: SWATCHES },
  {
    name: 'Sobria',
    colors: [
      { name: 'Azul marino', hex: '#2c4a6e' },
      { name: 'Azul', hex: '#4a7fc1' },
      { name: 'Cian', hex: '#3a9eb5' },
      { name: 'Pizarra', hex: '#5b6b7c' },
      { name: 'Gris', hex: '#8d949c' },
      { name: 'Ámbar', hex: '#d9a03a' }
    ]
  },
  {
    name: 'Pastel',
    colors: [
      { name: 'Rosa', hex: '#e8a0b4' },
      { name: 'Melocotón', hex: '#f0b98d' },
      { name: 'Mantequilla', hex: '#ead68a' },
      { name: 'Menta', hex: '#9fd3b0' },
      { name: 'Cielo', hex: '#9cc3e6' },
      { name: 'Lavanda', hex: '#b9a6e0' }
    ]
  },
  {
    name: 'Alto contraste',
    colors: [
      { name: 'Negro', hex: '#1d1d1f' },
      { name: 'Azul', hex: '#0057b8' },
      { name: 'Rojo', hex: '#c8102e' },
      { name: 'Verde', hex: '#007a3d' },
      { name: 'Naranja', hex: '#e35205' },
      { name: 'Morado', hex: '#5f259f' }
    ]
  }
];

export const DEFAULT_PALETTE = PRESETS[0];

/** "#3a9" → "#33aa99"; anything else → null. */
export function normHex(s: string): string | null {
  const t = s.trim().replace(/^#?/, '#').toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(t)) return t;
  if (/^#[0-9a-f]{3}$/.test(t)) return `#${t[1]}${t[1]}${t[2]}${t[2]}${t[3]}${t[3]}`;
  return null;
}

/** Every hex colour in a pasted text ("#003366, #ff9900 / 3a9"), in order, once each. */
export function hexesIn(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/#?\b([0-9a-f]{6}|[0-9a-f]{3})\b/gi)) {
    const h = normHex(m[1]);
    if (h && !out.includes(h)) out.push(h);
  }
  return out;
}

/** A stored palette, tolerating anything missing or wrong. */
export function parsePalette(text: string | null): Palette | null {
  if (!text) return null;
  try {
    const p = JSON.parse(text) as Partial<Palette>;
    const colors = (Array.isArray(p.colors) ? p.colors : [])
      .map((c) => ({ name: String(c?.name ?? '').slice(0, 40), hex: normHex(String(c?.hex ?? '')) }))
      .filter((c): c is Swatch => !!c.hex)
      .slice(0, MAX_COLORS);
    return colors.length ? { name: String(p.name ?? 'Paleta').slice(0, 60) || 'Paleta', colors } : null;
  } catch {
    return null;
  }
}

/** A name for a colour nobody named: its hue in Spanish. */
export function colorName(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  if (sat < 0.15) return l < 0.2 ? 'Negro' : l > 0.85 ? 'Blanco' : 'Gris';
  let h = 0;
  if (max === r) h = ((g - b) / (max - min)) % 6;
  else if (max === g) h = (b - r) / (max - min) + 2;
  else h = (r - g) / (max - min) + 4;
  h = (h * 60 + 360) % 360;
  const names: [number, string][] = [
    [15, 'Rojo'],
    [40, 'Naranja'],
    [65, 'Amarillo'],
    [160, 'Verde'],
    [195, 'Turquesa'],
    [250, 'Azul'],
    [290, 'Morado'],
    [335, 'Rosa'],
    [360, 'Rojo']
  ];
  const base = names.find(([max]) => h < max)![1];
  return l < 0.3 ? `${base} oscuro` : l > 0.75 ? `${base} claro` : base;
}

/**
 * The main colours of an image (a logo): pixels in buckets, near-white,
 * near-black and transparent ones left out unless that's all there is, the
 * biggest buckets that differ enough from each other.
 */
export function colorsFromPixels(data: Uint8ClampedArray, max = 6): string[] {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  let plain = 0;
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 128) continue;
    const l = luminance([r / 255, g / 255, b / 255]);
    if (l > 0.9 || l < 0.01) {
      plain++;
      continue;
    }
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bk = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
    bk.n++;
    bk.r += r;
    bk.g += g;
    bk.b += b;
    buckets.set(key, bk);
  }
  const ranked = [...buckets.values()].sort((a, b) => b.n - a.n).map((bk) => [bk.r / bk.n, bk.g / bk.n, bk.b / bk.n] as const);
  const out: (readonly [number, number, number])[] = [];
  for (const c of ranked) {
    if (out.length >= max) break;
    if (out.every((o) => Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2]) > 48)) out.push(c);
  }
  void plain;
  const hex = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return out.map(([r, g, b]) => `#${hex(r)}${hex(g)}${hex(b)}`);
}

/**
 * "Colour by kind": each kind of shape gets the next colour of the palette,
 * in the order the toolbar offers them (actors, then use cases; classes,
 * interfaces, enums…). Notes keep theirs.
 */
export function colourByKind(nodeTypes: string[], nodes: { id: string; type: string }[], colors: string[]): Map<string, string> {
  const order = nodeTypes.filter((t) => t !== 'note' && nodes.some((n) => n.type === t));
  const out = new Map<string, string>();
  for (const n of nodes) {
    const i = order.indexOf(n.type);
    if (i >= 0 && colors.length) out.set(n.id, colors[i % colors.length]);
  }
  return out;
}
