/**
 * Colour helpers. Diagrams are ink on paper; colour is opt-in (zones,
 * sticky notes, Gantt bars, mind-map branches) and always from this set, so
 * it reads in both themes.
 */

/** Relative luminance of a 0..1 RGB triple. */
export function luminance([r, g, b]: [number, number, number]): number {
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Black or white text for a background of this luminance. */
export function inkFor(lum: number): string {
  return lum > 0.4 ? '#16191d' : '#ffffff';
}

export function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function inkOn(hex: string): string {
  const rgb = hexToRgb(hex);
  return rgb ? inkFor(luminance(rgb)) : 'var(--ink)';
}

/** The colours offered anywhere a colour can be picked. Mid-tone, readable with white or black ink. */
export const SWATCHES: { name: string; hex: string }[] = [
  { name: 'Red', hex: '#d9534f' },
  { name: 'Orange', hex: '#e8873a' },
  { name: 'Yellow', hex: '#e2c044' },
  { name: 'Green', hex: '#58a55c' },
  { name: 'Teal', hex: '#3a9e9a' },
  { name: 'Blue', hex: '#4a7fc1' },
  { name: 'Purple', hex: '#8a63c4' },
  { name: 'Pink', hex: '#d0679d' },
  { name: 'Grey', hex: '#8d949c' }
];

/** Mind-map branch colours, in order. */
export const BRANCH_COLORS = ['#4a7fc1', '#e8873a', '#58a55c', '#8a63c4', '#d9534f', '#3a9e9a', '#d0679d', '#c9a227'];

/** Sticky-note tint: the colour mixed into the panel, so it works in light and dark. */
export function stickyBg(hex?: string): string {
  return hex ? `color-mix(in srgb, ${hex} 28%, var(--panel))` : 'color-mix(in srgb, #e2c044 30%, var(--panel))';
}
