<script lang="ts">
  import { app } from '../../stores/app.svelte';
  import { uid } from '../../model/diagram';
  import { BRANCH_COLORS, inkOn } from '../../model/colors';
  import { storyTitle, totalPoints } from '../../model/stories';
  import { storage } from '../../storage/diagrams';
  import type { StoryMapData, UserStory } from '../../model/types';
  import Icon from '../../components/Icon.svelte';
  import StoryFields from '../../components/StoryFields.svelte';
  import { startCardDrag, type DropTarget } from './cardDrag';
  import { cellKey, moveStory, parseCell, removeActivity, removeRelease, removeStep, shift, storiesIn, type MapStory } from './ops';

  const doc = $derived(app.docOf('storymap'));
  const data = $derived(doc.data);

  let selected = $state<string | null>(null);
  let hover = $state<DropTarget | null>(null);
  let dragging = $state<string | null>(null);

  /** One column per step; an activity without steps still gets one (empty) column. */
  const cols = $derived(
    data.activities.flatMap((a, ai) =>
      a.steps.length ? a.steps.map((st, si) => ({ a, ai, step: st as { id: string; title: string } | null, si })) : [{ a, ai, step: null, si: 0 }]
    )
  );
  const sel = $derived(selected ? data.stories.find((s) => s.id === selected) ?? null : null);
  const epics = $derived([...new Set(data.stories.map((s) => s.epic?.trim()).filter((e): e is string => !!e))].sort());

  function edit(fn: (m: StoryMapData) => void, key?: string) {
    app.change((d) => fn((d as typeof doc).data), key);
  }

  function colorOf(ai: number): string {
    return BRANCH_COLORS[ai % BRANCH_COLORS.length];
  }

  async function confirm(msg: string): Promise<boolean> {
    return (await storage()).confirm(msg, 'Story map');
  }

  function focusSoon(selector: string) {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLInputElement>(selector);
      el?.focus();
      el?.select();
    });
  }

  /* ---------------------------------------------------------- structure */

  function addActivity() {
    const id = uid();
    edit((m) => m.activities.push({ id, title: 'Nueva actividad', steps: [{ id: uid(), title: 'Nuevo paso' }] }));
    focusSoon(`[data-activity-input="${id}"]`);
  }

  function addStep(activityId: string, after?: string) {
    const id = uid();
    edit((m) => {
      const a = m.activities.find((x) => x.id === activityId);
      if (!a) return;
      const i = after ? a.steps.findIndex((s) => s.id === after) + 1 : a.steps.length;
      a.steps.splice(i, 0, { id, title: 'Nuevo paso' });
    });
    focusSoon(`[data-step-input="${id}"]`);
  }

  async function deleteActivity(id: string) {
    const a = data.activities.find((x) => x.id === id);
    if (!a) return;
    const n = data.stories.filter((s) => a.steps.some((st) => st.id === s.stepId)).length;
    if (n && !(await confirm(`Delete "${a.title}" and its ${n} ${n === 1 ? 'story' : 'stories'}?`))) return;
    edit((m) => removeActivity(m, id));
  }

  async function deleteStep(id: string) {
    const n = data.stories.filter((s) => s.stepId === id).length;
    if (n && !(await confirm(`Delete this step and its ${n} ${n === 1 ? 'story' : 'stories'}?`))) return;
    edit((m) => removeStep(m, id));
  }

  function moveStep(activityId: string, stepId: string, dir: -1 | 1) {
    edit((m) => {
      const a = m.activities.find((x) => x.id === activityId);
      if (a) shift(a.steps, stepId, dir);
    });
  }

  function addRelease() {
    const id = uid();
    edit((m) => m.releases.push({ id, name: `Sprint ${m.releases.length + 1}` }));
    focusSoon(`[data-release-input="${id}"]`);
  }

  async function deleteRelease(id: string) {
    const r = data.releases.find((x) => x.id === id);
    const n = data.stories.filter((s) => s.releaseId === id).length;
    if (n && !(await confirm(`Delete "${r?.name}" and its ${n} ${n === 1 ? 'story' : 'stories'}?`))) return;
    edit((m) => removeRelease(m, id));
  }

  /* ------------------------------------------------------------ stories */

  function addStory(stepId: string, releaseId: string) {
    const id = uid();
    edit((m) => {
      const order = storiesIn(m, stepId, releaseId).length;
      m.stories.push({ id, stepId, releaseId, order, title: '', asA: '', iWant: '', soThat: '', gherkin: '', points: undefined, priority: '', epic: '' });
    });
    selected = id;
    focusSoon('.inspector input[type="text"]');
  }

  function updateStory(id: string, patch: Partial<UserStory>, key?: string) {
    edit((m) => {
      const s = m.stories.find((x) => x.id === id);
      if (s) Object.assign(s, patch);
    }, key ? `story:${id}:${key}` : undefined);
  }

  function deleteStory(id: string) {
    edit((m) => {
      m.stories = m.stories.filter((s) => s.id !== id);
    });
    if (selected === id) selected = null;
  }

  function onCardDown(e: PointerEvent, s: MapStory) {
    startCardDrag(e, {
      id: s.id,
      onStart: () => (dragging = s.id),
      onEnd: () => (dragging = null),
      onHover: (t) => (hover = t),
      onDrop: (t) => {
        const { stepId, releaseId } = parseCell(t.cell);
        edit((m) => moveStory(m, s.id, stepId, releaseId, t.index));
      },
      onClick: () => (selected = selected === s.id ? null : s.id)
    });
  }

  function onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    if (e.key === 'Escape' && selected) selected = null;
    else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
      e.preventDefault();
      deleteStory(selected);
    }
  }

  /** Position of a story among the cell's cards other than the one being dragged (−1 for that one). */
  function otherIndex(list: MapStory[], s: MapStory): number {
    if (s.id === dragging) return -1;
    return list.filter((x) => x.id !== dragging).findIndex((x) => x.id === s.id);
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="scroll-canvas">
  <div class="map" data-export-root style:--cols={cols.length}>
    <div class="persona">
      <Icon name="User" size={18} />
      <span class="sect">Persona</span>
      <input
        class="ghost-input persona-in"
        type="text"
        placeholder="Who is this map about? (p. ej. socio de la biblioteca)"
        value={data.persona}
        oninput={(e) => edit((m) => (m.persona = e.currentTarget.value), 'persona')}
      />
    </div>

    <div class="grid">
      <!-- Backbone: activities -->
      <div class="lane-head corner sect">Activities</div>
      {#each data.activities as a, ai (a.id)}
        {@const c = colorOf(ai)}
        <div class="activity" style:grid-column="span {Math.max(1, a.steps.length)}" style:--c={c} style:--on={inkOn(c)}>
          <input
            class="ghost-input act-in"
            data-activity-input={a.id}
            type="text"
            value={a.title}
            aria-label="Activity"
            oninput={(e) => edit((m) => {
              const x = m.activities.find((y) => y.id === a.id);
              if (x) x.title = e.currentTarget.value;
            }, `act:${a.id}`)}
          />
          <span class="tools" data-no-export>
            <button class="icon small" title="Add a step" aria-label="Add a step" onclick={() => addStep(a.id)}><Icon name="Plus" size={14} /></button>
            <button class="icon small" title="Move left" aria-label="Move left" disabled={ai === 0} onclick={() => edit((m) => void shift(m.activities, a.id, -1))}><Icon name="ChevronLeft" size={14} /></button>
            <button class="icon small" title="Move right" aria-label="Move right" disabled={ai === data.activities.length - 1} onclick={() => edit((m) => void shift(m.activities, a.id, 1))}><Icon name="ChevronRight" size={14} /></button>
            <button class="icon small" title="Delete activity" aria-label="Delete activity" onclick={() => deleteActivity(a.id)}><Icon name="Trash2" size={14} /></button>
          </span>
        </div>
      {/each}
      <div class="add-col">
        <button class="secondary small" data-no-export onclick={addActivity}><Icon name="Plus" size={14} /> Activity</button>
      </div>

      <!-- Backbone: steps -->
      <div class="lane-head corner sect">Steps</div>
      {#each cols as col (col.step?.id ?? `empty-${col.a.id}`)}
        {#if col.step}
          {@const st = col.step}
          <div class="step" style:--c={colorOf(col.ai)}>
            <input
              class="ghost-input step-in"
              data-step-input={st.id}
              type="text"
              value={st.title}
              aria-label="Step"
              oninput={(e) => edit((m) => {
                const x = m.activities.find((y) => y.id === col.a.id)?.steps.find((y) => y.id === st.id);
                if (x) x.title = e.currentTarget.value;
              }, `step:${st.id}`)}
            />
            <span class="tools" data-no-export>
              <button class="icon small" title="Add a step after" aria-label="Add a step after" onclick={() => addStep(col.a.id, st.id)}><Icon name="Plus" size={13} /></button>
              <button class="icon small" title="Move left" aria-label="Move left" disabled={col.si === 0} onclick={() => moveStep(col.a.id, st.id, -1)}><Icon name="ChevronLeft" size={13} /></button>
              <button class="icon small" title="Move right" aria-label="Move right" disabled={col.si === col.a.steps.length - 1} onclick={() => moveStep(col.a.id, st.id, 1)}><Icon name="ChevronRight" size={13} /></button>
              <button class="icon small" title="Delete step" aria-label="Delete step" onclick={() => deleteStep(st.id)}><Icon name="X" size={13} /></button>
            </span>
          </div>
        {:else}
          <div class="step empty">
            <button class="small" data-no-export onclick={() => addStep(col.a.id)}><Icon name="Plus" size={14} /> Step</button>
          </div>
        {/if}
      {/each}
      <div></div>

      <!-- Releases / sprints -->
      {#each data.releases as r, ri (r.id)}
        {@const pts = totalPoints(data.stories.filter((s) => s.releaseId === r.id))}
        <div class="lane-line" style:grid-column="1 / -1"></div>
        <div class="lane-head">
          <input
            class="ghost-input rel-in"
            data-release-input={r.id}
            type="text"
            value={r.name}
            aria-label="Sprint / release"
            oninput={(e) => edit((m) => {
              const x = m.releases.find((y) => y.id === r.id);
              if (x) x.name = e.currentTarget.value;
            }, `rel:${r.id}`)}
          />
          <span class="tiny muted pts">{data.stories.filter((s) => s.releaseId === r.id).length} stories{pts ? ` · ${pts} pts` : ''}</span>
          <span class="tools" data-no-export>
            <button class="icon small" title="Move up" aria-label="Move up" disabled={ri === 0} onclick={() => edit((m) => void shift(m.releases, r.id, -1))}><Icon name="ChevronUp" size={13} /></button>
            <button class="icon small" title="Move down" aria-label="Move down" disabled={ri === data.releases.length - 1} onclick={() => edit((m) => void shift(m.releases, r.id, 1))}><Icon name="ChevronDown" size={13} /></button>
            <button class="icon small" title="Delete sprint" aria-label="Delete sprint" onclick={() => deleteRelease(r.id)}><Icon name="Trash2" size={13} /></button>
          </span>
        </div>
        {#each cols as col (col.step?.id ?? `empty-${col.a.id}`)}
          {#if col.step}
            {@const key = cellKey(col.step.id, r.id)}
            {@const list = storiesIn(data, col.step.id, r.id)}
            {@const others = list.filter((x) => x.id !== dragging).length}
            <div class="cell" class:target={hover?.cell === key} data-drop-cell={key}>
              {#each list as s (s.id)}
                {@const oi = otherIndex(list, s)}
                {#if hover?.cell === key && hover.index === oi}<div class="drop-line"></div>{/if}
                <div
                  class="card"
                  class:sel={selected === s.id}
                  data-card={s.id}
                  role="button"
                  tabindex="0"
                  style:--c={colorOf(col.ai)}
                  onpointerdown={(e) => onCardDown(e, s)}
                  onkeydown={(e) => e.key === 'Enter' && (selected = s.id)}
                >
                  <span class="card-title" class:untitled={!s.title.trim() && !s.iWant.trim()}>{storyTitle(s)}</span>
                  <span class="meta">
                    {#if s.epic}<span class="epic">{s.epic}</span>{/if}
                    <span class="spacer"></span>
                    {#if s.gherkin.trim()}<span class="has-g" title="Has acceptance criteria"><Icon name="ListChecks" size={12} /></span>{/if}
                    {#if s.priority}<span class="prio">{s.priority[0]}</span>{/if}
                    {#if typeof s.points === 'number'}<span class="pts-badge">{s.points}</span>{/if}
                  </span>
                </div>
              {/each}
              {#if hover?.cell === key && hover.index >= others}<div class="drop-line"></div>{/if}
              <button class="add-story" class:lonely={!list.length} data-no-export title="Add a story here" aria-label="Add a story" onclick={() => addStory(col.step!.id, r.id)}><Icon name="Plus" size={14} /></button>
            </div>
          {:else}
            <div class="cell blank"></div>
          {/if}
        {/each}
        <div></div>
      {/each}

      <div class="lane-line" style:grid-column="1 / -1"></div>
      <div class="lane-head">
        <button class="secondary small" data-no-export onclick={addRelease}><Icon name="Plus" size={14} /> Sprint</button>
      </div>
    </div>

    {#if !data.activities.length}
      <p class="muted small hint" data-no-export>Start with the backbone: add the activities the user goes through, left to right, then the steps under each, then the stories under each step, sliced into sprints.</p>
    {/if}
  </div>
</div>

{#if sel}
  <aside class="inspector float arrive" aria-label="Story">
    <div class="inspector-head">
      <Icon name="BookOpen" size={16} />
      <strong class="spacer">User story</strong>
      <button class="icon small danger" title="Delete story (Del)" aria-label="Delete story" onclick={() => deleteStory(sel.id)}><Icon name="Trash2" size={15} /></button>
      <button class="icon" aria-label="Close" onclick={() => (selected = null)}><Icon name="X" size={16} /></button>
    </div>
    <div class="inspector-body">
      <div class="two">
        <label class="field">
          Step
          <select value={sel.stepId} onchange={(e) => edit((m) => moveStory(m, sel.id, e.currentTarget.value, sel.releaseId, Infinity))}>
            {#each data.activities as a (a.id)}
              <optgroup label={a.title}>
                {#each a.steps as st (st.id)}<option value={st.id}>{st.title}</option>{/each}
              </optgroup>
            {/each}
          </select>
        </label>
        <label class="field">
          Sprint
          <select value={sel.releaseId} onchange={(e) => edit((m) => moveStory(m, sel.id, sel.stepId, e.currentTarget.value, Infinity))}>
            {#each data.releases as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
          </select>
        </label>
      </div>
      <StoryFields story={sel} {epics} update={(patch, key) => updateStory(sel.id, patch, key)} />
    </div>
  </aside>
{/if}

<style>
  .map {
    display: inline-block;
    min-width: 100%;
    padding: var(--sp-4) var(--sp-5) var(--sp-5);
  }
  .persona {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    margin-bottom: var(--sp-4);
    color: var(--muted);
  }
  .persona-in {
    width: 520px;
    font-size: var(--fs-lg);
    color: var(--ink);
  }
  .grid {
    display: grid;
    grid-template-columns: 150px repeat(var(--cols), 176px) 140px;
    column-gap: 10px;
    row-gap: 8px;
    align-items: stretch;
  }
  .lane-head {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 4px 6px 4px 0;
  }
  .lane-head.corner {
    justify-content: center;
  }
  .lane-head .tools {
    display: flex;
    opacity: 0;
    transition: opacity var(--t);
  }
  .lane-head:hover .tools,
  .lane-head:focus-within .tools {
    opacity: 1;
  }
  .rel-in {
    width: 100%;
    font-weight: 700;
  }
  .pts {
    padding-left: 6px;
  }
  .lane-line {
    height: 0;
    border-top: 1px dashed var(--line);
    margin: 6px 0 2px;
  }
  .activity {
    position: relative;
    display: flex;
    align-items: center;
    min-height: 44px;
    padding: 4px 6px;
    border-radius: var(--r-control);
    background: var(--c);
    color: var(--on);
    box-shadow: 0 1px 2px rgba(22, 25, 29, 0.12);
  }
  .act-in {
    flex: 1;
    min-width: 0;
    font-weight: 700;
    color: inherit;
  }
  .act-in:focus {
    color: var(--ink);
  }
  .activity .tools,
  .step .tools {
    display: flex;
    opacity: 0;
    transition: opacity var(--t);
  }
  .activity .tools button {
    color: inherit;
  }
  .activity:hover .tools,
  .activity:focus-within .tools,
  .step:hover .tools,
  .step:focus-within .tools {
    opacity: 1;
  }
  .step {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px;
    min-height: 44px;
    border-radius: var(--r-control);
    background: color-mix(in srgb, var(--c) 18%, var(--panel));
    border-top: 3px solid var(--c);
  }
  .step .tools {
    position: absolute;
    right: 2px;
    bottom: -22px;
    z-index: 3;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--r-control);
    box-shadow: var(--shadow);
  }
  .step-in {
    width: 100%;
    font-weight: 700;
    font-size: var(--fs-sm) !important;
  }
  .step.empty {
    align-items: center;
    justify-content: center;
    background: transparent;
    border: 1px dashed var(--line);
  }
  .add-col {
    display: flex;
    align-items: center;
  }
  .cell {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 64px;
    padding: 4px;
    border-radius: var(--r-control);
  }
  .cell.target {
    background: color-mix(in srgb, var(--accent) 8%, transparent);
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 7px 8px;
    border-radius: var(--r-control);
    background: color-mix(in srgb, #e2c044 26%, var(--panel));
    border-left: 3px solid var(--c);
    box-shadow: 0 1px 2px rgba(22, 25, 29, 0.14);
    font-size: var(--fs-sm);
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .card.sel {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  :global(.card.drag-source) {
    opacity: 0.35;
  }
  .card-title {
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .card-title.untitled {
    color: var(--muted);
    font-style: italic;
  }
  .meta {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: var(--fs-xs);
    color: var(--muted);
  }
  .epic {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 90px;
  }
  .pts-badge,
  .prio {
    min-width: 18px;
    height: 18px;
    padding: 0 4px;
    border-radius: var(--r-pill);
    display: inline-grid;
    place-items: center;
    font-weight: 700;
    color: var(--ink-2);
    background: color-mix(in srgb, var(--ink) 9%, transparent);
  }
  .has-g {
    display: inline-flex;
  }
  .drop-line {
    height: 3px;
    border-radius: 2px;
    background: var(--accent);
    margin: -2px 0;
  }
  .add-story {
    align-self: stretch;
    justify-content: center;
    height: 24px;
    border: 1px dashed transparent;
    border-radius: var(--r-control);
    color: var(--muted);
    opacity: 0;
  }
  .cell:hover .add-story,
  .add-story:focus-visible {
    opacity: 1;
    border-color: var(--line);
  }
  .add-story.lonely {
    opacity: 0.35;
  }
  .hint {
    margin-top: var(--sp-4);
    max-width: 520px;
  }
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-2);
  }
</style>
