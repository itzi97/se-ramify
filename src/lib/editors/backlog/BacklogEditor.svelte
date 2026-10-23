<script lang="ts">
  import { app } from '../../stores/app.svelte';
  import { storage } from '../../storage/diagrams';
  import { slug } from '../../model/diagram';
  import type { AiBrief, BacklogData, Epic, UserStory } from '../../model/types';
  import Icon from '../../components/Icon.svelte';
  import StoryCard from './StoryCard.svelte';
  import Overview from './Overview.svelte';
  import { priorityBadge } from '../../model/badges';
  import {
    AI_FIELDS,
    MOSCOW,
    NO_COMPONENT,
    PREFILL_GUARDRAILS,
    PREFILL_PROCESS,
    addEpic,
    addStory,
    aiPack,
    backlogStats,
    byComponent,
    checkBacklog,
    componentsOf,
    epicCode,
    epicStats,
    moveEpic,
    moveStory,
    moveStoryToEpic,
    removeEpic,
    removeStory,
    storyCode
  } from './model';

  const doc = $derived(app.docOf('backlog'));
  const data = $derived(doc.data);

  let view = $state<'epics' | 'ai' | 'overview'>('epics');
  let selectedId = $state<string | null>(null);
  let openStory = $state<string | null>(null);
  let filter = $state('');
  let showAllChecks = $state(false);

  const selected = $derived(data.epics.find((e) => e.id === selectedId) ?? data.epics[0] ?? null);
  const groups = $derived(byComponent(data, filter || undefined));
  const components = $derived(componentsOf(data));
  const stats = $derived(backlogStats(data));
  const problems = $derived(checkBacklog(data));
  const errors = $derived(problems.filter((p) => p.level === 'error').length);

  function edit(fn: (d: BacklogData) => void, key?: string) {
    app.change((d) => fn((d as typeof doc).data), key);
  }

  function focusSoon(selector: string) {
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLInputElement>(selector);
        el?.focus();
        el?.select();
      })
    );
  }

  /* -------------------------------------------------------------- epics */

  function newEpic(component = '') {
    let id = '';
    edit((d) => (id = addEpic(d, component === NO_COMPONENT ? '' : component, selected?.component === component ? selected?.id : undefined)));
    selectedId = id;
    openStory = null;
    view = 'epics';
    focusSoon('[data-epic-title]');
  }

  function setEpic(id: string, patch: Partial<Epic>, key?: string) {
    edit((d) => {
      const e = d.epics.find((x) => x.id === id);
      if (e) Object.assign(e, patch);
    }, key ? `epic:${id}:${key}` : undefined);
  }

  async function deleteEpic(e: Epic) {
    if (e.stories.length && !(await (await storage()).confirm(`Delete "${e.title || epicCode(data, e)}" and its ${e.stories.length} ${e.stories.length === 1 ? 'story' : 'stories'}?`, 'Backlog'))) return;
    const i = data.epics.indexOf(e);
    edit((d) => removeEpic(d, e.id));
    selectedId = data.epics[Math.max(0, i - 1)]?.id ?? null;
  }

  /* ------------------------------------------------------------ stories */

  function newStory(epicId: string) {
    let id: string | null = null;
    edit((d) => (id = addStory(d, epicId)));
    openStory = id;
    if (id) focusSoon(`[data-story-title="${id}"]`);
  }

  function setStory(epicId: string, storyId: string, patch: Partial<UserStory>, key?: string) {
    edit((d) => {
      const s = d.epics.find((e) => e.id === epicId)?.stories.find((x) => x.id === storyId);
      if (s) Object.assign(s, patch);
    }, key ? `story:${storyId}:${key}` : undefined);
  }

  /* --------------------------------------------------------- components */

  let newComponent = $state('');
  function addComponent() {
    const c = newComponent.trim();
    if (!c || data.components.includes(c)) return;
    edit((d) => d.components.push(c));
    newComponent = '';
  }
  function removeComponent(c: string) {
    edit((d) => (d.components = d.components.filter((x) => x !== c)));
    if (filter === c) filter = '';
  }

  /* ----------------------------------------------------------------- AI */

  function setAi(key: keyof AiBrief, value: string) {
    edit((d) => (d.ai[key] = value), `ai:${key}`);
  }

  function prefill() {
    edit((d) => {
      if (!d.ai.guardrails.trim()) d.ai.guardrails = PREFILL_GUARDRAILS;
      else d.ai.guardrails = `${d.ai.guardrails.trimEnd()}\n${PREFILL_GUARDRAILS}`;
      if (!d.ai.process.trim()) d.ai.process = PREFILL_PROCESS;
    });
  }

  async function exportPack() {
    try {
      const s = await storage();
      const dir = await s.pickExportDir('Export the AI pack into…');
      if (!dir) return;
      const sep = dir.includes('\\') && !dir.includes('/') ? '\\' : '/';
      const root = dir === 'downloads' ? dir : `${dir}${sep}${slug(`${data.product || doc.title} ia`, 50) || 'ia'}`;
      const files = aiPack(doc.title, data);
      for (const f of files) {
        const i = f.path.lastIndexOf('/');
        const sub = i < 0 ? '' : f.path.slice(0, i);
        const name = i < 0 ? f.path : f.path.slice(i + 1);
        await s.writeInto(sub && root !== 'downloads' ? `${root}${sep}${sub.replaceAll('/', sep)}` : root, name, f.content);
      }
      app.notify(`Exported the AI pack (${files.length} files)${root === 'downloads' ? ' to your downloads' : ` to ${root}`}.`);
    } catch (err) {
      app.notify(`AI pack export failed: ${err instanceof Error ? err.message : err}`, 'error');
    }
  }

  function goTo(p: { epicId?: string; storyId?: string }) {
    if (!p.epicId) return;
    selectedId = p.epicId;
    openStory = p.storyId ?? null;
    view = 'epics';
  }

  const otherEpics = (e: Epic) => data.epics.filter((x) => x.id !== e.id).map((x) => ({ id: x.id, label: `${epicCode(data, x)} ${x.title}` }));
</script>

<div class="stage">
  <div class="toolbar float">
    <div class="seg" role="radiogroup" aria-label="View">
      <button class:active={view === 'epics'} role="radio" aria-checked={view === 'epics'} onclick={() => (view = 'epics')}><Icon name="ListTree" size={14} /> Epics &amp; stories</button>
      <button class:active={view === 'ai'} role="radio" aria-checked={view === 'ai'} onclick={() => (view = 'ai')}><Icon name="Bot" size={14} /> AI brief (vibe coding)</button>
      <button class:active={view === 'overview'} role="radio" aria-checked={view === 'overview'} onclick={() => (view = 'overview')}><Icon name="FileText" size={14} /> Overview</button>
    </div>
    <span class="sep"></span>
    <label class="row small muted product">
      Product
      <input type="text" value={data.product} placeholder="Nombre del producto" oninput={(e) => edit((d) => (d.product = e.currentTarget.value), 'product')} />
    </label>
    <span class="sep"></span>
    <span class="small muted stat">{stats.epics} epics · {stats.stories} stories{stats.points ? ` · ${stats.points} pts` : ''}</span>
  </div>

  {#if view === 'epics'}
    <div class="panes">
      <aside class="list float" aria-label="Epics">
        <div class="list-head row between">
          <strong>Epics</strong>
          <button class="secondary small" onclick={() => newEpic(filter)}><Icon name="Plus" size={14} /> Epic</button>
        </div>
        {#if components.length}
          <div class="filters">
            <button class="chipbtn" class:active={!filter} onclick={() => (filter = '')}>All</button>
            {#each components as c (c)}<button class="chipbtn" class:active={filter === c} onclick={() => (filter = filter === c ? '' : c)}>{c}</button>{/each}
          </div>
        {/if}
        <div class="list-body">
          {#each groups as g (g.component)}
            <div class="sect group">{g.component}</div>
            {#each g.epics as e (e.id)}
              {@const st = epicStats(e)}
              <button class="epic-row" class:on={selected?.id === e.id} onclick={() => ((selectedId = e.id), (openStory = null))}>
                <span class="code">{epicCode(data, e)}</span>
                <span class="etitle" class:placeholder={!e.title.trim()}>{e.title || 'Sin título'}</span>
                {#if e.priority}
                  {@const pb = priorityBadge(e.priority)}
                  <span class="prio" style:--p={pb?.c} style:--pi={pb?.ink} title={pb?.label}>{e.priority}</span>
                {/if}
                <span class="count" title="{st.stories} stories, {st.points} points">{st.stories ? `${st.stories} HU` : '—'}{st.points ? ` · ${st.points}` : ''}</span>
              </button>
            {/each}
            {#if !g.epics.length}<p class="tiny muted empty-group">No epics yet.</p>{/if}
          {:else}
            <p class="small muted pad">No epics yet. Add the big blocks of functionality first, then break one down into stories.</p>
          {/each}
        </div>

        {#if data.epics.length}
        <div class="checks">
          <button class="inline check-head" class:bad={errors > 0} class:warned={!errors && problems.length > 0} class:good={!problems.length} onclick={() => (showAllChecks = !showAllChecks)} aria-expanded={showAllChecks}>
            <Icon name={problems.length ? (errors ? 'CircleX' : 'TriangleAlert') : 'CircleCheck'} size={14} />
            {#if problems.length}{errors} {errors === 1 ? 'problem' : 'problems'}, {problems.length - errors} {problems.length - errors === 1 ? 'warning' : 'warnings'}{:else}Every story is complete{/if}
          </button>
          {#if problems.length}
            <ul>
              {#each showAllChecks ? problems : problems.slice(0, 4) as p, i (i)}
                <li class:warn={p.level === 'warn'}>
                  <button class="inline" onclick={() => goTo(p)}>{#if p.where}<span class="code">{p.where}</span>{/if} {p.text}</button>
                </li>
              {/each}
              {#if !showAllChecks && problems.length > 4}<li><button class="inline more" onclick={() => (showAllChecks = true)}>+ {problems.length - 4} more</button></li>{/if}
            </ul>
          {/if}
        </div>
        {/if}
      </aside>

      <section class="detail float" aria-label="Epic">
        {#if selected}
          {@const e = selected}
          {@const st = epicStats(e)}
          <div class="detail-head row">
            <span class="code big">{epicCode(data, e)}</span>
            <input class="ghost-input title-input" data-epic-title type="text" value={e.title} placeholder="Nombre de la épica" oninput={(ev) => setEpic(e.id, { title: ev.currentTarget.value }, 'title')} />
            <button class="icon small" aria-label="Move epic up" title="Move up" disabled={data.epics[0]?.id === e.id} onclick={() => edit((d) => moveEpic(d, e.id, -1))}><Icon name="ArrowUp" size={14} /></button>
            <button class="icon small" aria-label="Move epic down" title="Move down" disabled={data.epics[data.epics.length - 1]?.id === e.id} onclick={() => edit((d) => moveEpic(d, e.id, 1))}><Icon name="ArrowDown" size={14} /></button>
            <button class="icon small" aria-label="Delete epic" title="Delete epic" onclick={() => deleteEpic(e)}><Icon name="Trash2" size={14} /></button>
          </div>
          <div class="detail-body stack">
            <div class="fields">
              <label class="field">Code <input type="text" value={e.code} placeholder={`EP-${String(data.epics.indexOf(e) + 1).padStart(2, '0')}`} title="Leave empty to number it by position" oninput={(ev) => setEpic(e.id, { code: ev.currentTarget.value }, 'code')} /></label>
              <label class="field">
                Component
                <input type="text" list="backlog-components" value={e.component} placeholder="Componente" oninput={(ev) => setEpic(e.id, { component: ev.currentTarget.value }, 'component')} />
                <datalist id="backlog-components">{#each components as c (c)}<option value={c}></option>{/each}</datalist>
              </label>
              <label class="field">
                Priority
                <select value={e.priority} onchange={(ev) => setEpic(e.id, { priority: ev.currentTarget.value })}>
                  <option value="">—</option>
                  {#each MOSCOW as p (p)}<option value={p}>{p}</option>{/each}
                </select>
              </label>
            </div>
            <label class="field">Description <textarea rows="3" value={e.description} placeholder="Qué bloque de funcionalidad cubre y para quién" oninput={(ev) => setEpic(e.id, { description: ev.currentTarget.value }, 'description')}></textarea></label>

            <div class="row between">
              <div class="sect">User stories <span class="muted">· {st.stories}{st.points ? ` · ${st.points} pts` : ''}{st.incomplete ? ` · ${st.incomplete} incomplete` : ''}</span></div>
              <button class="secondary small" onclick={() => newStory(e.id)}><Icon name="Plus" size={14} /> Story</button>
            </div>
            {#each e.stories as s, i (s.id)}
              <StoryCard
                story={s}
                code={storyCode(data, e, s)}
                open={openStory === s.id}
                first={i === 0}
                last={i === e.stories.length - 1}
                toggle={() => (openStory = openStory === s.id ? null : s.id)}
                update={(patch, key) => setStory(e.id, s.id, patch, key)}
                move={(dir) => edit((d) => moveStory(d, e.id, s.id, dir))}
                remove={() => edit((d) => removeStory(d, e.id, s.id))}
                epics={otherEpics(e)}
                moveTo={(to) => edit((d) => moveStoryToEpic(d, s.id, to))}
              />
            {:else}
              <p class="small muted">Not broken down yet. Add the stories that make up this epic — each small enough for one sprint, with its Gherkin acceptance criteria.</p>
            {/each}
          </div>
        {:else}
          <div class="detail-body"><p class="muted">Add your first epic with <strong>+ Epic</strong>: one big block of functionality (e.g. "Gestión de préstamos"). The checklist of what each story still needs appears once there is one.</p></div>
        {/if}
      </section>
    </div>
  {:else if view === 'ai'}
    <div class="scroll">
      <div class="ai float stack">
        <div>
          <div class="row between">
            <div class="sect">AI brief — vibe coding</div>
            <div class="row">
              <button class="secondary small" onclick={prefill}><Icon name="WandSparkles" size={14} /> Prefill guardrails &amp; process</button>
              <button class="primary small" onclick={exportPack}><Icon name="FolderDown" size={14} /> Export AI pack…</button>
            </div>
          </div>
          <p class="small muted">Everything a model needs, besides the stories and their Gherkin, to generate the app and test it: the definitions, the rules it must follow and the process the client repeats to change it later. "Export AI pack" writes README, PROMPT, SPEC and GUARDRAILS files and one .feature per epic.</p>
        </div>
        {#each AI_FIELDS as f (f.key)}
          <label class="field">{f.label}<textarea rows={f.rows} placeholder={f.hint} value={data.ai[f.key]} oninput={(ev) => setAi(f.key, ev.currentTarget.value)}></textarea></label>
        {/each}
        <p class="tiny muted">The stories come from the backlog: {stats.brokenDown} of {stats.epics} epics broken down, {stats.withCriteria} of {stats.stories} stories with usable Gherkin.</p>
      </div>
    </div>
  {:else}
    <div class="scroll">
      <div class="overview-wrap"><Overview {data} title={doc.title} onPick={(epicId, storyId) => goTo({ epicId, storyId })} /></div>
    </div>
  {/if}

  {#if view !== 'overview'}
    <!-- The printable overview, off screen, so image export works from any view. -->
    <div class="offscreen" aria-hidden="true"><Overview {data} title={doc.title} /></div>
  {/if}
</div>

<style>
  .stage {
    position: absolute;
    inset: 0;
    background: var(--paper);
  }
  .product input {
    width: 180px;
  }
  .stat {
    padding: 0 8px;
    white-space: nowrap;
  }
  .toolbar {
    max-width: calc(100% - 2 * var(--edge));
  }
  .panes {
    position: absolute;
    inset: calc(var(--edge) + 52px) var(--edge) var(--edge) var(--edge);
    display: flex;
    gap: var(--edge);
  }
  .list {
    width: 320px;
    flex: none;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .list-head {
    padding: var(--sp-3) var(--sp-3) var(--sp-2) var(--sp-4);
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 0 var(--sp-3) var(--sp-2);
  }
  .chipbtn {
    height: 24px;
    padding: 0 10px;
    font-size: var(--fs-sm);
    border: 1px solid var(--line);
    border-radius: var(--r-pill);
    background: transparent;
  }
  .chipbtn.active {
    background: var(--accent);
    color: var(--accent-ink);
    border-color: var(--accent);
  }
  .list-body {
    flex: 1;
    overflow: auto;
    padding: 0 var(--sp-2) var(--sp-3);
  }
  .group {
    margin: var(--sp-3) var(--sp-2) var(--sp-1);
  }
  .empty-group,
  .pad {
    padding: 0 var(--sp-2);
  }
  .epic-row {
    width: 100%;
    height: auto;
    min-height: 34px;
    padding: 4px 8px;
    gap: 8px;
    justify-content: flex-start;
    background: transparent;
    text-align: left;
    border-radius: var(--r-control);
  }
  .epic-row:hover {
    background: color-mix(in srgb, var(--accent) 7%, transparent);
  }
  .epic-row.on,
  .epic-row.on:hover {
    background: var(--selected);
    box-shadow: inset 3px 0 0 var(--accent);
    color: var(--ink);
  }
  .epic-row.on .code {
    color: var(--accent);
  }
  .epic-row.on .etitle {
    font-weight: 700;
  }
  .etitle {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .placeholder {
    color: var(--muted);
    font-style: italic;
  }
  .count {
    font-size: var(--fs-xs);
    color: var(--muted);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
  .code {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
  }
  .code.big {
    font-size: 13px;
  }
  /* MoSCoW: Must red, Should orange, Could amber, Won't grey (same chips as the story map and Kanban). */
  .prio {
    padding: 0 7px;
    border-radius: var(--r-pill);
    font-size: var(--fs-xs);
    font-weight: 700;
    background: var(--p);
    color: var(--pi);
  }
  .checks {
    border-top: 1px solid var(--line);
    padding: var(--sp-2) var(--sp-3) var(--sp-3);
    max-height: 40%;
    overflow: auto;
    font-size: var(--fs-sm);
  }
  .check-head {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
    gap: 6px;
    font-weight: 700;
  }
  .check-head.bad :global(svg) {
    color: var(--danger);
  }
  .check-head.warned :global(svg) {
    color: var(--warn);
  }
  .check-head.good :global(svg) {
    color: var(--ok);
  }
  .checks ul {
    margin: 4px 0 0;
    padding: 0;
    list-style: none;
  }
  .checks li button {
    display: block;
    text-decoration: none;
    text-align: left;
    color: var(--danger);
    font-size: var(--fs-sm);
    height: auto;
    padding: 2px 4px;
    white-space: normal;
    justify-content: flex-start;
  }
  .checks li.warn button {
    color: color-mix(in srgb, var(--warn) 75%, var(--ink));
  }
  .checks li button:hover {
    background: var(--hover);
  }
  .checks .more {
    color: var(--ink-2) !important;
  }
  .detail {
    flex: 1;
    min-width: 0;
    max-width: 860px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .detail-head {
    gap: 6px;
    padding: var(--sp-3) var(--sp-3) var(--sp-2) var(--sp-4);
    border-bottom: 1px solid var(--line);
  }
  .title-input {
    flex: 1;
    font-size: var(--fs-lg);
    font-weight: 700;
  }
  .detail-body {
    flex: 1;
    overflow: auto;
    padding: var(--sp-3) var(--sp-4) var(--sp-5);
  }
  .fields {
    display: grid;
    grid-template-columns: 120px 1fr 120px;
    gap: var(--sp-2);
  }
  .scroll {
    position: absolute;
    inset: calc(var(--edge) + 52px) 0 0 0;
    overflow: auto;
  }
  .ai {
    max-width: 820px;
    margin: 0 var(--edge) var(--sp-5);
    padding: var(--sp-4);
  }
  .overview-wrap {
    padding: 0 var(--sp-5) var(--sp-5) var(--edge);
    width: max-content;
  }
  .offscreen {
    position: fixed;
    left: -100000px;
    top: 0;
    pointer-events: none;
  }
</style>
