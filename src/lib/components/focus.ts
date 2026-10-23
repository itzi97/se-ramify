/**
 * Put the keyboard on an element as it appears. Unlike the `autofocus`
 * attribute (which Svelte only honours when nothing else has focus), this
 * also works when the canvas or a button had it, e.g. Ctrl+K from a diagram.
 */
export function focusIn(node: HTMLElement, select = false) {
  queueMicrotask(() => {
    node.focus({ preventScroll: true });
    if (select && node instanceof HTMLInputElement) node.select();
  });
}
