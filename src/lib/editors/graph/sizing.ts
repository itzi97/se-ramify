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
    case 'ellipse': {
      const t = block(n.label, 13);
      return { w: Math.max(120, t.w + 52 + 3), h: Math.max(54, t.h + 28 + 3) };
    }
    default: {
      const t = block(n.label, 13, info.shape === 'class' || info.shape === 'entity');
      return { w: Math.max(100, t.w + 32), h: Math.max(40, t.h + 18) };
    }
  }
}

/** Traceability: where a new shape of this column goes — under the last one in its column. */
export function traceColumnX(nodes: GNode[], t: NodeTypeInfo, infoOf: (n: GNode) => NodeTypeInfo, size: Size): { x: number; y: number } {
  const col = t.column ?? 0;
  const inCol = nodes.filter((n) => infoOf(n).column === col && (col !== 0 || n.type === t.type || t.type === 'req'));
  const x = col * 230 + (t.type === 'criterion' ? 28 : 0);
  const y = inCol.length ? Math.max(...inCol.map((n) => n.y)) + 50 : 0;
  return { x: x, y: y + (size.h ? 0 : 0) };
}
