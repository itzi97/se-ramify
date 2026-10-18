/**
 * The diagram's colours as real values, not CSS variables.
 *
 * html-to-image clones an <svg> wholesale without copying the computed
 * styles of its children, so anything set through classes or var() inside
 * the SVG is lost in a PNG/SVG export. The diagram therefore paints with
 * attributes holding resolved colours, re-read whenever the theme changes
 * (the store flips to light paper for exports and waits a frame).
 */
export interface DiagramPalette {
  ink: string;
  fill: string;
  line: string;
  soft: string;
  accent: string;
  muted: string;
  note: string;
  font: string;
}

function rgb(c: string): [number, number, number] | null {
  const h = /^#([0-9a-f]{6})$/i.exec(c.trim());
  if (h) {
    const n = parseInt(h[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i.exec(c.trim());
  return m ? [+m[1], +m[2], +m[3]] : null;
}

/** `a` mixed into `b` by `t` (0..1), as #rrggbb; `b` if either can't be read. */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  if (!x || !y) return b;
  return '#' + x.map((v, i) => Math.round(v * t + y[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
}

function read(): DiagramPalette {
  if (typeof document === 'undefined') return { ink: '#16191d', fill: '#ffffff', line: '#3b4148', soft: '#f3f4f6', accent: '#16191d', muted: '#6c737a', note: '#f6edc6', font: 'sans-serif' };
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string, fb: string) => cs.getPropertyValue(n).trim() || fb;
  const fill = v('--d-fill', '#ffffff');
  return {
    ink: v('--d-ink', '#16191d'),
    fill,
    line: v('--d-line', '#3b4148'),
    soft: v('--d-soft', '#f3f4f6'),
    accent: v('--accent', '#16191d'),
    muted: v('--muted', '#6c737a'),
    note: mix('#e2c044', fill, 0.22),
    font: v('--font', 'sans-serif')
  };
}

export function diagramPalette(): { readonly current: DiagramPalette } {
  let pal = $state(read());
  $effect(() => {
    const update = () => (pal = read());
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style', 'data-accent'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', update);
    return () => {
      mo.disconnect();
      mq.removeEventListener('change', update);
    };
  });
  return {
    get current() {
      return pal;
    }
  };
}
