<script lang="ts">
  import { esDate, parseEsDate } from './time';

  /**
   * A date typed the Spanish way (dd/mm/aaaa). Plain text instead of
   * <input type="date">: the same in every WebKit build and locale, and it
   * exports as text (no calendar icon in the picture).
   */
  let { value, onCommit, label, cls = '' }: { value: string; onCommit: (iso: string) => void; label: string; cls?: string } = $props();
  let bad = $state(false);

  function commit(el: HTMLInputElement) {
    const iso = parseEsDate(el.value);
    if (!iso) {
      bad = el.value.trim() !== '';
      el.value = esDate(value);
      return;
    }
    bad = false;
    el.value = esDate(iso);
    if (iso !== value) onCommit(iso);
  }
</script>

<input
  class="{cls} date-field"
  class:bad
  type="text"
  inputmode="numeric"
  placeholder="dd/mm/aaaa"
  aria-label={label}
  title="dd/mm/aaaa"
  value={esDate(value)}
  onchange={(e) => commit(e.currentTarget)}
  onblur={(e) => {
    // Whatever was typed (5/10/26, 2026-10-05…), the field always ends up showing dd/mm/aaaa.
    const iso = parseEsDate(e.currentTarget.value);
    if (iso) e.currentTarget.value = esDate(iso);
  }}
  onkeydown={(e) => {
    if (e.key === 'Enter') commit(e.currentTarget);
    if (e.key === 'Escape') {
      e.currentTarget.value = esDate(value);
      e.currentTarget.blur();
    }
  }}
/>

<style>
  .date-field {
    font-variant-numeric: normal;
  }
  .bad {
    border-color: var(--danger) !important;
  }
</style>
