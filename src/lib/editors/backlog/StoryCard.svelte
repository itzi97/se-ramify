<script lang="ts">
  import type { UserStory } from '../../model/types';
  import { MOSCOW, SCENARIO_TEMPLATE, gherkinProblems, hasCriteria, storySentence, storyTitle } from './model';
  import Icon from '../../components/Icon.svelte';
  import { priorityBadge } from '../../model/badges';

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
  const pb = $derived(priorityBadge(story.priority));
  /** The whole header (and the sentence under a closed card) opens it, not only the title. */
  function headClick(e: MouseEvent) {
    if (!(e.target as HTMLElement).closest('button, input, select, textarea')) toggle();
  }

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
  <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
  <div class="head" onclick={headClick}>
    <button class="grow" onclick={toggle} aria-expanded={open} title={open ? 'Fold' : 'Open the story'}>
      <span class="chev" class:rot={open}><Icon name="ChevronRight" size={14} /></span>
      <span class="code">{code}</span>
      <span class="name" class:placeholder={!story.title.trim() && !story.iWant.trim()}>{storyTitle(story)}</span>
    </button>
    {#if pb}<span class="chip prio" style:--p={pb.c} style:--pi={pb.ink} title={pb.label}>{story.priority}</span>{/if}
    {#if typeof story.points === 'number'}<span class="chip" title="Story points">{story.points} pt</span>{/if}
    <span class="state" class:ok={complete} title={complete ? 'Complete' : 'Missing Como / quiero / para or Gherkin'}><Icon name={complete ? 'CircleCheck' : 'CircleDashed'} size={15} /></span>
  </div>
  {#if !open && sentence}
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
    <p class="sentence-line" onclick={toggle}>{sentence}.</p>
  {/if}

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
    transition: border-color var(--t), box-shadow var(--t);
  }
  .story:hover {
    border-color: color-mix(in srgb, var(--ink) 28%, var(--line));
  }
  /* The open story is the one being edited: outlined in the accent. */
  .story.open {
    border-color: var(--accent);
    box-shadow: 0 0 0 1px var(--selected-line);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px 6px 4px;
    border-radius: var(--r-control) var(--r-control) 0 0;
    cursor: pointer;
    transition: background-color var(--t);
  }
  .story:not(.open) .head:hover {
    background: color-mix(in srgb, var(--ink) 3%, transparent);
  }
  .chev {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    color: var(--ink-2);
    background: color-mix(in srgb, var(--ink) 7%, transparent);
    transition: transform var(--t), background-color var(--t), color var(--t);
  }
  .chev.rot {
    transform: rotate(90deg);
    background: var(--accent);
    color: var(--accent-ink);
  }
  .head:hover .chev:not(.rot) {
    background: color-mix(in srgb, var(--ink) 14%, transparent);
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
  /* MoSCoW: Must red, Should orange, Could amber, Won't grey. */
  .chip.prio {
    border-color: transparent;
    background: var(--p);
    color: var(--pi);
  }
  .state {
    display: inline-flex;
    color: var(--faint);
  }
  .state.ok {
    color: var(--ok);
  }
  .sentence-line {
    margin: -2px 12px 8px 36px;
    font-size: var(--fs-sm);
    color: var(--muted);
    font-style: italic;
    cursor: pointer;
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
