<script lang="ts">
  import type { UserStory } from '../model/types';
  import { MOSCOW, SCENARIO_TEMPLATE, storySentence } from '../model/stories';
  import Icon from './Icon.svelte';

  /**
   * Edits one user story. The parent owns the data: every edit goes through
   * `update(patch, key)`, which the parent turns into `app.change` (the key
   * merges a burst of typing into one undo step).
   */
  let {
    story,
    update,
    epics = []
  }: {
    story: UserStory;
    update: (patch: Partial<UserStory>, key?: string) => void;
    /** Epics already used elsewhere, offered as suggestions. */
    epics?: string[];
  } = $props();

  const sentence = $derived(storySentence(story));
  const listId = `epics-${Math.random().toString(36).slice(2, 8)}`;

  let gherkinEl: HTMLTextAreaElement | undefined = $state();

  function insertScenario() {
    const cur = story.gherkin.replace(/\s+$/, '');
    const next = cur ? `${cur}\n\n${SCENARIO_TEMPLATE}` : SCENARIO_TEMPLATE;
    update({ gherkin: next });
    // Select the first placeholder so it can be typed over.
    requestAnimationFrame(() => {
      if (!gherkinEl) return;
      const start = next.lastIndexOf('<nombre del escenario>');
      gherkinEl.focus();
      if (start >= 0) gherkinEl.setSelectionRange(start, start + '<nombre del escenario>'.length);
    });
  }

  function onPoints(v: string) {
    const n = v.trim() === '' ? undefined : Number(v);
    update({ points: n === undefined || Number.isNaN(n) ? undefined : n }, 'points');
  }
</script>

<div class="stack story-fields">
  <label class="field">Title <input type="text" value={story.title} placeholder="Short name for the card" oninput={(e) => update({ title: e.currentTarget.value }, 'title')} /></label>

  <div class="stack tight">
    <div class="sect">User story</div>
    <label class="field">Como <input type="text" value={story.asA} placeholder="rol (p. ej. socio de la biblioteca)" oninput={(e) => update({ asA: e.currentTarget.value }, 'asA')} /></label>
    <label class="field">quiero <input type="text" value={story.iWant} placeholder="objetivo" oninput={(e) => update({ iWant: e.currentTarget.value }, 'iWant')} /></label>
    <label class="field">para <input type="text" value={story.soThat} placeholder="beneficio" oninput={(e) => update({ soThat: e.currentTarget.value }, 'soThat')} /></label>
    {#if sentence}<p class="small sentence">{sentence}.</p>{/if}
  </div>

  <div class="trio">
    <label class="field">Points <input type="number" min="0" step="1" value={story.points ?? ''} oninput={(e) => onPoints(e.currentTarget.value)} /></label>
    <label class="field">
      Priority
      <select value={story.priority ?? ''} onchange={(e) => update({ priority: e.currentTarget.value })}>
        <option value="">—</option>
        {#each MOSCOW as p (p)}<option value={p}>{p}</option>{/each}
        {#if story.priority && !(MOSCOW as readonly string[]).includes(story.priority)}<option value={story.priority}>{story.priority}</option>{/if}
      </select>
    </label>
    <label class="field">
      Epic
      <input type="text" list={listId} value={story.epic ?? ''} placeholder="Épica" oninput={(e) => update({ epic: e.currentTarget.value }, 'epic')} />
      <datalist id={listId}>{#each epics as ep (ep)}<option value={ep}></option>{/each}</datalist>
    </label>
  </div>

  <div class="stack tight">
    <div class="row between">
      <span class="sect">Acceptance criteria (Gherkin)</span>
      <button class="secondary small" onclick={insertScenario}><Icon name="Plus" size={14} /> Insert scenario</button>
    </div>
    <textarea
      bind:this={gherkinEl}
      class="gherkin"
      rows="9"
      spellcheck="false"
      placeholder={SCENARIO_TEMPLATE}
      value={story.gherkin}
      oninput={(e) => update({ gherkin: e.currentTarget.value }, 'gherkin')}
    ></textarea>
  </div>
</div>

<style>
  .tight {
    gap: var(--sp-2);
  }
  .trio {
    display: grid;
    grid-template-columns: 70px 100px 1fr;
    gap: var(--sp-2);
  }
  .sentence {
    padding: var(--sp-2) var(--sp-3);
    border-left: 3px solid var(--accent);
    background: var(--panel-2);
    border-radius: var(--r-control);
    font-style: italic;
  }
  .gherkin {
    font-family: var(--mono);
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    tab-size: 2;
  }
</style>
