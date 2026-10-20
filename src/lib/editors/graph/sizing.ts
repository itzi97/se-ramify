/**
 * Size estimates for shapes before the browser has measured them: the mind
 * map is laid out from these (so it never jumps), and new shapes are
 * centred with them. Keep in step with the CSS in GraphNode.svelte.
 */
import type { NodeTypeInfo } from '../../model/kinds';
import type { GNode, GraphKind } from '../../model/types';
import type { Size } from './layout';

let ctx: CanvasRenderingContext2D | null | undefined;

/** Width of a line of text in the app font (a character-count guess outside the browser). */
export function textWidth(text: string, px = 13, bold = false): number {
  if (ctx === undefined) ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  if (!ctx) return text.length * px * 0.55;
  ctx.font = `${bold ? 700 : 400} ${px}px 'Atkinson Hyperlegible', system-ui, sans-serif`;
  return ctx.measureText(text).width;
}

function block(label: string, px: number, bold = false): Size {
  const lines = (label || ' ').split('\n');
  return { w: Math.max(...lines.map((l) => textWidth(l, px, bold))), h: lines.length * px * 1.3 };
}

export function estimateSize(_kind: GraphKind, n: GNode, info: NodeTypeInfo): Size {
  if (info.container || info.resizable) return { w: n.w ?? info.size?.w ?? 200, h: n.h ?? info.size?.h ?? 120 };
  switch (info.shape) {
    case 'central': {
      const t = block(n.label, 16, true);
      return { w: Math.max(120, t.w + 44 + 2), h: t.h + 24 };
    }
    case 'topic': {
      const t = block(n.label, 13);
      return { w: Math.max(40, t.w + 24 + 4 + 2), h: t.h + 10 + 4 };
    }
    case 'actor':
    case 'device': {
      const t = block(n.label, 13);
      return { w: Math.max(64, Math.min(140, t.w) + 8), h: 60 + t.h };
    }
    case 'initial':
      return { w: 22, h: 22 };
    case 'final':
    case 'flowFinal':
      return { w: 26, h: 26 };
    case 'class': {
      const members = [...(n.attrs ?? []), ...(n.ops ?? [])];
      const w = Math.max(150, textWidth(n.label, 13, true) + 28, ...members.map((m) => textWidth(m, 12) + 20));
      const rows = (n.attrs?.length ?? 0) + (n.ops?.length ?? 0);
      return { w, h: 34 + (n.stereotype || info.stereotype ? 14 : 0) + rows * 16 + 2 * 10 };
    }
    case 'role': {
      const items = n.attrs ?? [];
      const w = Math.min(260, Math.max(170, textWidth(n.label, 13, true) + 28, textWidth(n.person ?? '', 12) + 28, ...items.map((m) => textWidth(m, 12) + 26)));
      const wrapped = items.reduce((k, m) => k + Math.max(1, Math.ceil((textWidth(m, 12) + 26) / w)), 0);
      return { w, h: 5 + 30 + (n.person ? 18 : 0) + (items.length ? 10 + wrapped * 16 : 0) };
    }
    case 'ellipse': {
      const t = block(n.label, 13);
      return { w: Math.max(120, t.w + 52 + 3), h: Math.max(54, t.h + 28 + 3) };
    }
    default: {
      const t = block(n.label, 13, info.shape === 'entity');
      return { w: Math.max(100, t.w + 32), h: Math.max(40, t.h + 18) };
    }
  }
}

/** Traceability: where a new shape goes — at the bottom of its column (criteria indented). */
export function traceColumnX(nodes: GNode[], t: NodeTypeInfo, infoOf: (n: GNode) => NodeTypeInfo, size: Size): { x: number; y: number } {
  const col = t.column ?? 0;
  const inCol = nodes.filter((n) => infoOf(n).column === col);
  const xs = inCol.filter((n) => n.type !== 'criterion').map((n) => n.x);
  const base = xs.length ? Math.min(...xs) : col * 260;
  const y = inCol.length ? Math.max(...inCol.map((n) => n.y)) + 44 : 0;
  return { x: base + (t.type === 'criterion' ? 28 : 0), y: y + 0 * size.h };
}
