<script lang="ts">
  /** The "which documents?" step of a project or hand-in export (export/formats.svelte.ts). */
  import { formatPrompt, DOC_FORMATS } from '../export/formats.svelte';
  import Icon from './Icon.svelte';

  const p = $derived(formatPrompt.current);

  function onKey(e: KeyboardEvent) {
    if (!p) return;
    if (e.key === 'Escape') formatPrompt.answer(false);
    else if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
      e.preventDefault();
      formatPrompt.answer(true);
    }
  }
</script>

<svelte:window onkeydown={onKey} />

{#if p}
  <button class="scrim veil" aria-label="Cancel" tabindex="-1" onclick={() => formatPrompt.answer(false)}></button>
  <div class="dialog float arrive" role="dialog" aria-modal="true" aria-label="Export formats">
    <header class="row between">
      <div class="stack tight">
        <strong>Export {p.title}</strong>
        <span class="tiny muted">{p.count} diagram{p.count === 1 ? '' : 's'} as numbered PNGs (plus PlantUML and Gherkin files) and a Markdown memoria. Also write:</span>
      </div>
      <button class="icon" aria-label="Cancel" onclick={() => formatPrompt.answer(false)}><Icon name="X" /></button>
    </header>
    <div class="body stack">
      {#each DOC_FORMATS as f (f.id)}
        <label class="opt">
          <input type="checkbox" bind:checked={p.chosen[f.id]} />
          <span class="stack tight">
            <strong>{f.label}</strong>
            <span class="tiny muted">{f.hint}</span>
          </span>
        </label>
      {/each}
    </div>
    <footer class="row between">
      <span class="tiny muted">Next you pick the folder.</span>
      <span class="row gap">
        <button class="secondary" onclick={() => formatPrompt.answer(false)}>Cancel</button>
        <button class="primary" onclick={() => formatPrompt.answer(true)}><Icon name="PackageOpen" size={16} /> Export…</button>
      </span>
    </footer>
  </div>
{/if}

<style>
  .veil {
    background: var(--veil) !important;
    z-index: 90;
  }
  .dialog {
    position: fixed;
    top: 14vh;
    left: 50%;
    transform: translateX(-50%);
    width: min(520px, 92vw);
    z-index: 91;
    overflow: hidden;
  }
  header {
    padding: var(--sp-3) var(--sp-3) var(--sp-3) var(--sp-4);
    border-bottom: 1px solid var(--line);
    gap: var(--sp-3);
  }
  .tight {
    gap: 2px;
  }
  .body {
    padding: var(--sp-3) var(--sp-4);
    gap: var(--sp-2);
  }
  .opt {
    display: flex;
    gap: var(--sp-3);
    align-items: flex-start;
    padding: var(--sp-2) var(--sp-3);
    border: 1px solid var(--line);
    border-radius: var(--r-card);
    cursor: pointer;
  }
  .opt {
    transition: border-color var(--t), background-color var(--t);
  }
  .opt:hover {
    border-color: var(--muted);
  }
  .opt:has(input:checked) {
    border-color: var(--accent);
    background: var(--selected);
  }
  .opt input {
    margin-top: 3px;
  }
  footer {
    padding: var(--sp-3) var(--sp-4);
    border-top: 1px solid var(--line);
  }
  .gap {
    gap: var(--sp-2);
  }
</style>
