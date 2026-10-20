<script lang="ts">
  import type { UserStory } from '../../model/types';
  import { MOSCOW, SCENARIO_TEMPLATE, gherkinProblems, hasCriteria, storySentence, storyTitle } from './model';
  import Icon from '../../components/Icon.svelte';

  /** One story of an epic: a header row that opens into its fields. The parent owns the data. */
  let {
    story,
    code,
    open,
    first,
    last,
    toggle,
    update,
    move,
    remove,
    epics,
    moveTo
  }: {
    story: UserStory;
    code: string;
    open: boolean;
    first: boolean;
    last: boolean;
    toggle: () => void;
    update: (patch: Partial<UserStory>, key?: string) => void;
    move: (dir: -1 | 1) => void;
    remove: () => void;
    /** Other epics this story could move to. */
    epics: { id: string; label: string }[];
    moveTo: (epicId: string) => void;
  } = $props();

  const sentence = $derived(storySentence(story));
  const complete = $derived(!!story.asA.trim() && !!story.iWant.trim() && !!story.soThat.trim() && hasCriteria(story));
  const problems = $derived(story.gherkin.trim() ? gherkinProblems(story.gherkin) : []);

  let gherkinEl: HTMLTextAreaElement | undefined = $state();

  function insertScenario() {
    const cur = story.gherkin.replace(/\s+$/, '');
    const next = cur ? `${cur}\n\n${SCENARIO_TEMPLATE}` : SCENARIO_TEMPLATE;
    update({ gherkin: next });
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

<div class="story" class:open>
  <div class="head">
    <button class="grow" onclick={toggle} aria-expanded={open}>
      <Icon name={open ? 'ChevronDown' : 'ChevronRight'} size={14} />
      <span class="code">{code}</span>
      <span class="name" class:placeholder={!story.title.trim() && !story.iWant.trim()}>{storyTitle(story)}</span>
    </button>
    {#if story.priority}<span class="chip">{story.priority}</span>{/if}
    {#if typeof story.points === 'number'}<span class="chip">{story.points} pt</span>{/if}
    <span class="state" class:ok={complete} title={complete ? 'Complete' : 'Missing Como / quiero / para or Gherkin'}><Icon name={complete ? 'CircleCheck' : 'CircleDashed'} size={15} /></span>
  </div>
  {#if !open && sentence}<p class="sentence-line">{sentence}.</p>{/if}

  {#if open}
    <div class="body stack">
      <label class="field">Title <input type="text" data-story-title={story.id} value={story.title} placeholder="Short name" oninput={(e) => update({ title: e.currentTarget.value }, 'title')} /></label>
      <div class="three">
        <label class="field">Como <input type="text" value={story.asA} placeholder="rol" oninput={(e) => update({ asA: e.currentTarget.value }, 'asA')} /></label>
        <label class="field">quiero <input type="text" value={story.iWant} placeholder="objetivo" oninput={(e) => update({ iWant: e.currentTarget.value }, 'iWant')} /></label>
        <label class="field">para <input type="text" value={story.soThat} placeholder="beneficio" oninput={(e) => update({ soThat: e.currentTarget.value }, 'soThat')} /></label>
      </div>
      {#if sentence}<p class="small sentence">{sentence}.</p>{/if}
      <div class="row meta">
        <label class="field pts">Points <input type="number" min="0" step="1" value={story.points ?? ''} oninput={(e) => onPoints(e.currentTarget.value)} /></label>
        <label class="field">
          Priority
          <select value={story.priority ?? ''} onchange={(e) => update({ priority: e.currentTarget.value })}>
            <option value="">—</option>
            {#each MOSCOW as p (p)}<option value={p}>{p}</option>{/each}
          </select>
        </label>
        <span class="spacer"></span>
        <button class="icon small" aria-label="Move up" title="Move up" disabled={first} onclick={() => move(-1)}><Icon name="ArrowUp" size={14} /></button>
        <button class="icon small" aria-label="Move down" title="Move down" disabled={last} onclick={() => move(1)}><Icon name="ArrowDown" size={14} /></button>
        {#if epics.length}
          <select class="move-to" aria-label="Move to epic" value="" onchange={(e) => e.currentTarget.value && moveTo(e.currentTarget.value)}>
            <option value="">Move to epic…</option>
            {#each epics as ep (ep.id)}<option value={ep.id}>{ep.label}</option>{/each}
          </select>
        {/if}
        <button class="icon small" aria-label="Delete story" title="Delete story" onclick={remove}><Icon name="Trash2" size={14} /></button>
      </div>
      <div class="stack tight">
        <div class="row between">
          <span class="sect">Acceptance criteria (Gherkin)</span>
          <button class="secondary small" onclick={insertScenario}><Icon name="Plus" size={14} /> Insert scenario template</button>
        </div>
        <textarea bind:this={gherkinEl} class="gherkin" rows="10" spellcheck="false" placeholder={SCENARIO_TEMPLATE} value={story.gherkin} oninput={(e) => update({ gherkin: e.currentTarget.value }, 'gherkin')}></textarea>
        {#if problems.length}
          <ul class="problems">
            {#each problems as p, i (i)}<li class:warn={p.level === 'warn'}><Icon name={p.level === 'warn' ? 'TriangleAlert' : 'CircleX'} size={13} /> {p.text}</li>{/each}
          </ul>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .story {
    border: 1px solid var(--line);
    border-radius: var(--r-control);
    background: var(--panel);
  }
  .story.open {
    border-color: var(--ink-2);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px 6px 4px;
  }
  .grow {
    flex: 1;
    min-width: 0;
    height: auto;
    padding: 2px 6px;
    background: transparent;
    justify-content: flex-start;
    gap: 6px;
    text-align: left;
  }
  .code {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--muted);
    flex: none;
  }
  .name {
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .name.placeholder {
    color: var(--muted);
    font-weight: 400;
    font-style: italic;
  }
  .chip {
    padding: 1px 8px;
    border: 1px solid var(--line);
    border-radius: var(--r-pill);
    font-size: var(--fs-xs);
    font-weight: 700;
    white-space: nowrap;
  }
  .state {
    display: inline-flex;
    color: var(--faint);
  }
  .state.ok {
    color: var(--ok);
  }
  .sentence-line {
    margin: -2px 12px 8px 30px;
    font-size: var(--fs-sm);
    color: var(--muted);
    font-style: italic;
  }
  .body {
    padding: 4px 12px 12px;
    border-top: 1px solid var(--line);
    padding-top: 12px;
  }
  .three {
    display: grid;
    grid-template-columns: 1fr 1.4fr 1.4fr;
    gap: var(--sp-2);
  }
  .meta {
    align-items: flex-end;
    gap: var(--sp-2);
    flex-wrap: wrap;
  }
  .pts {
    width: 80px;
  }
  .move-to {
    width: 150px;
  }
  .tight {
    gap: var(--sp-2);
  }
  .sentence {
    margin: 0;
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
  .problems {
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: var(--fs-sm);
    color: var(--danger);
  }
  .problems li {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .problems li.warn {
    color: var(--muted);
  }
</style>
