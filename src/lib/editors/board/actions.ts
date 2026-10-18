/** Small Svelte actions shared by the board, journey and stakeholder editors. */

/** Grow a textarea to fit its text (WebKitGTK has no `field-sizing`). */
export function autosize(node: HTMLTextAreaElement, _value?: string) {
  const fit = () => {
    node.style.height = 'auto';
    node.style.height = `${node.scrollHeight}px`;
  };
  node.addEventListener('input', fit);
  queueMicrotask(fit);
  return {
    update() {
      queueMicrotask(fit);
    },
    destroy() {
      node.removeEventListener('input', fit);
    }
  };
}

/** Focus on mount, caret at the end. */
export function focusEnd(node: HTMLInputElement | HTMLTextAreaElement) {
  queueMicrotask(() => {
    node.focus();
    const n = node.value.length;
    node.setSelectionRange(n, n);
  });
}
