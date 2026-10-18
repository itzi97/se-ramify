/**
 * Pointer-based card dragging (no HTML5 drag and drop, which is unreliable
 * in WebKitGTK on Wayland). Shared by the story map and Kanban.
 *
 * Drop zones are elements with `data-drop-cell="<key>"`; the cards inside a
 * zone carry `data-card="<id>"`. While dragging, a ghost copy follows the
 * pointer and `onHover` reports where the card would land (zone key and
 * index among the other cards); `onDrop` is called on release over a zone.
 * A press that never moves past the threshold is a click (`onClick`).
 */

export interface DropTarget {
  cell: string;
  index: number;
}

export interface CardDragOptions {
  id: string;
  /** Lay-out direction of cards inside a zone (index is computed along it). */
  axis?: 'y' | 'x';
  onHover: (t: DropTarget | null) => void;
  onDrop: (t: DropTarget) => void;
  onClick?: () => void;
  /** The press became a drag. */
  onStart?: () => void;
  /** The drag ended (dropped or cancelled). */
  onEnd?: () => void;
}

const THRESHOLD = 4;

export function startCardDrag(e: PointerEvent, opts: CardDragOptions): void {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  // Let fields and buttons inside a card work normally.
  if (target.closest('input, textarea, select, button, [contenteditable="true"]')) return;
  const card = e.currentTarget as HTMLElement;
  const x0 = e.clientX;
  const y0 = e.clientY;
  const rect = card.getBoundingClientRect();
  const offX = x0 - rect.left;
  const offY = y0 - rect.top;
  let ghost: HTMLElement | null = null;
  let last: DropTarget | null = null;
  const axis = opts.axis ?? 'y';

  const begin = () => {
    ghost = card.cloneNode(true) as HTMLElement;
    Object.assign(ghost.style, {
      position: 'fixed',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      margin: '0',
      pointerEvents: 'none',
      zIndex: '1000',
      opacity: '0.92',
      transform: 'rotate(1.5deg)',
      boxShadow: '0 10px 28px -8px rgba(0,0,0,0.35)'
    });
    ghost.removeAttribute('data-card');
    document.body.appendChild(ghost);
    card.classList.add('drag-source');
    document.body.style.cursor = 'grabbing';
    opts.onStart?.();
  };

  const hit = (x: number, y: number): DropTarget | null => {
    const zone = document.elementsFromPoint(x, y).map((el) => (el as HTMLElement).closest<HTMLElement>('[data-drop-cell]')).find(Boolean);
    if (!zone) return null;
    const cards = [...zone.querySelectorAll<HTMLElement>('[data-card]')].filter((c) => c.dataset.card !== opts.id && c.closest('[data-drop-cell]') === zone);
    let index = 0;
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      const mid = axis === 'y' ? r.top + r.height / 2 : r.left + r.width / 2;
      if ((axis === 'y' ? y : x) > mid) index++;
    }
    return { cell: zone.dataset.dropCell!, index };
  };

  const move = (ev: PointerEvent) => {
    if (!ghost) {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < THRESHOLD) return;
      begin();
    }
    ghost!.style.left = `${ev.clientX - offX}px`;
    ghost!.style.top = `${ev.clientY - offY}px`;
    const t = hit(ev.clientX, ev.clientY);
    if (t?.cell !== last?.cell || t?.index !== last?.index) {
      last = t;
      opts.onHover(t);
    }
    autoScroll(ev.clientX, ev.clientY, card);
  };

  const end = (ev: PointerEvent) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('keydown', onKey);
    if (!ghost) {
      opts.onClick?.();
      return;
    }
    const t = hit(ev.clientX, ev.clientY);
    cleanup();
    opts.onHover(null);
    if (t) opts.onDrop(t);
  };

  const cancel = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('keydown', onKey);
    cleanup();
    opts.onHover(null);
  };

  const onKey = (k: KeyboardEvent) => {
    if (k.key === 'Escape') cancel();
  };

  const cleanup = () => {
    if (ghost) opts.onEnd?.();
    ghost?.remove();
    ghost = null;
    card.classList.remove('drag-source');
    document.body.style.cursor = '';
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('keydown', onKey);
}

/** Scroll the nearest scrollable ancestor when the pointer nears its edge. */
function autoScroll(x: number, y: number, from: HTMLElement) {
  let el: HTMLElement | null = from.parentElement;
  while (el && !(el.scrollHeight > el.clientHeight || el.scrollWidth > el.clientWidth)) el = el.parentElement;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const edge = 40;
  const step = 14;
  if (x < r.left + edge) el.scrollLeft -= step;
  else if (x > r.right - edge) el.scrollLeft += step;
  if (y < r.top + edge) el.scrollTop -= step;
  else if (y > r.bottom - edge) el.scrollTop += step;
}
