<script lang="ts">
  import { app } from '../../stores/app.svelte';
  import { uid } from '../../model/diagram';
  import { initials, storyTitle, totalPoints } from '../../model/stories';
  import { storage } from '../../storage/diagrams';
  import type { CardType, KanbanCard, KanbanData, UserStory } from '../../model/types';
  import Icon from '../../components/Icon.svelte';
  import StoryFields from '../../components/StoryFields.svelte';
  import { startCardDrag, type DropTarget } from '../storymap/cardDrag';
  import { shift } from '../storymap/ops';
  import { CARD_TYPES, cardsIn, moveCard, newCard, overLimit, removeColumn, typeInfo } from './ops';

  const doc = $derived(app.docOf('kanban'));
  const data = $derived(doc.data);

  let selected = $state<string | null>(null);
  let hover = $state<DropTarget | null>(null);
  let dragging = $state<string | null>(null);
  let colMenu = $state<string | null>(null);

  const sel = $derived(selected ? data.cards.find((c) => c.id === selected) ?? null : null);
  const epics = $derived([...new Set(data.cards.map((c) => c.epic?.trim()).filter((e): e is string => !!e))].sort());
  const people = $derived([...new Set(data.cards.map((c) => c.assignee.trim()).filter(Boolean))].sort());

  function edit(fn: (k: KanbanData) => void, key?: string) {
    app.change((d) => fn((d as typeof doc).data), key);
  }

  function updateCard(id: string, patch: Partial<KanbanCard>, key?: string) {
    edit((k) => {
      const c = k.cards.find((x) => x.id === id);
      if (c) Object.assign(c, patch);
    }, key ? `card:${id}:${key}` : undefined);
  }

  function addCard(colId: string) {
    const c = newCard(colId, cardsIn(data, colId).length);
    edit((k) => k.cards.push(c));
    selected = c.id;
    requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.inspector .story-fields input[type="text"]')?.focus());
  }

  function deleteCard(id: string) {
    edit((k) => {
      k.cards = k.cards.filter((c) => c.id !== id);
    });
    if (selected === id) selected = null;
  }

  function addColumn() {
    const id = uid();
    edit((k) => k.columns.push({ id, name: 'Nueva columna', wip: 0 }));
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLInputElement>(`[data-col-input="${id}"]`);
      el?.focus();
      el?.select();
    });
  }

  async function deleteColumn(id: string) {
    colMenu = null;
    const col = data.columns.find((c) => c.id === id);
    const n = cardsIn(data, id).length;
    if (n) {
      const ok = await (await storage()).confirm(
        data.columns.length > 1 ? `Delete "${col?.name}"? Its ${n} card(s) move to the next column over.` : `Delete "${col?.name}" and its ${n} card(s)?`,
        'Kanban'
      );
      if (!ok) return;
    }
    edit((k) => removeColumn(k, id));
  }

  function onCardDown(e: PointerEvent, c: KanbanCard) {
    startCardDrag(e, {
      id: c.id,
      onStart: () => (dragging = c.id),
      onEnd: () => (dragging = null),
      onHover: (t) => (hover = t),
      onDrop: (t) => edit((k) => moveCard(k, c.id, t.cell, t.index)),
      onClick: () => (selected = selected === c.id ? null : c.id)
    });
  }

  function otherIndex(list: KanbanCard[], c: KanbanCard): number {
    if (c.id === dragging) return -1;
    return list.filter((x) => x.id !== dragging).findIndex((x) => x.id === c.id);
  }

  function onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return;
    if (e.key === 'Escape') {
      if (colMenu) colMenu = null;
      else selected = null;
    } else if ((e.key === 'Delete' || e.key === 'Backspace') && selected) {
      e.preventDefault();
      deleteCard(selected);
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="scroll-canvas">
  <div class="board" data-export-root>
    {#each data.columns as col, ci (col.id)}
      {@const list = cardsIn(data, col.id)}
      {@const over = overLimit(data, col.id)}
      {@const others = list.filter((x) => x.id !== dragging).length}
      {@const pts = totalPoints(list)}
      <section class="col" class:over aria-label={col.name}>
        <header class="col-head">
          <input
            class="ghost-input col-in"
            data-col-input={col.id}
            type="text"
            value={col.name}
            aria-label="Column name"
            oninput={(e) => edit((k) => {
              const x = k.columns.find((y) => y.id === col.id);
              if (x) x.name = e.currentTarget.value;
            }, `col:${col.id}`)}
          />
          <span class="count" class:over title={col.wip ? `WIP limit ${col.wip}` : 'No WIP limit'}>{list.length}{col.wip ? `/${col.wip}` : ''}</span>
          <span class="menu-anchor" data-no-export>
            <button class="icon small" aria-label="Column options" title="Column options" onclick={() => (colMenu = colMenu === col.id ? null : col.id)}><Icon name="Ellipsis" size={15} /></button>
            {#if colMenu === col.id}
              <button class="scrim" aria-label="Close" tabindex="-1" onclick={() => (colMenu = null)}></button>
              <div class="col-menu float arrive">
                <label class="field">
                  WIP limit (0 = none)
                  <input type="number" min="0" value={col.wip} oninput={(e) => edit((k) => {
                    const x = k.columns.find((y) => y.id === col.id);
                    if (x) x.wip = Math.max(0, Math.round(+e.currentTarget.value || 0));
                  }, `wip:${col.id}`)} />
                </label>
                <button class="menu-row" disabled={ci === 0} onclick={() => edit((k) => void shift(k.columns, col.id, -1))}><Icon name="ChevronLeft" size={15} /> Move left</button>
                <button class="menu-row" disabled={ci === data.columns.length - 1} onclick={() => edit((k) => void shift(k.columns, col.id, 1))}><Icon name="ChevronRight" size={15} /> Move right</button>
                <button class="menu-row danger" onclick={() => deleteColumn(col.id)}><Icon name="Trash2" size={15} /> Delete column</button>
              </div>
            {/if}
          </span>
        </header>
        {#if over}<p class="tiny warn">Over the WIP limit — finish something before pulling more.</p>{/if}
        <div class="cards" class:target={hover?.cell === col.id} data-drop-cell={col.id}>
          {#each list as c (c.id)}
            {@const t = typeInfo(c.type)}
            {@const oi = otherIndex(list, c)}
            {#if hover?.cell === col.id && hover.index === oi}<div class="drop-line"></div>{/if}
            <div
              class="card"
              class:sel={selected === c.id}
              class:epic={c.type === 'epic'}
              data-card={c.id}
              role="button"
              tabindex="0"
              style:--t={t.color}
              onpointerdown={(e) => onCardDown(e, c)}
              onkeydown={(e) => e.key === 'Enter' && (selected = c.id)}
            >
              <span class="row top">
                <span class="tag">{t.es}</span>
                {#if c.epic && c.type !== 'epic'}<span class="epic-name">{c.epic}</span>{/if}
              </span>
              <span class="title" class:untitled={!c.title.trim() && !c.iWant.trim()}>{storyTitle(c)}</span>
              <span class="row foot">
                {#if c.gherkin.trim()}<span class="muted" title="Has acceptance criteria"><Icon name="ListChecks" size={12} /></span>{/if}
                {#if c.priority}<span class="pill">{c.priority}</span>{/if}
                <span class="spacer"></span>
                {#if typeof c.points === 'number'}<span class="pill strong" title="Story points">{c.points}</span>{/if}
                {#if c.assignee.trim()}<span class="who" title={c.assignee}>{initials(c.assignee)}</span>{/if}
              </span>
            </div>
          {/each}
          {#if hover?.cell === col.id && hover.index >= others}<div class="drop-line"></div>{/if}
          <button class="add" data-no-export onclick={() => addCard(col.id)}><Icon name="Plus" size={14} /> Card</button>
        </div>
        {#if pts}<p class="tiny muted sum">{pts} pts</p>{/if}
      </section>
    {/each}
    <div class="add-col" data-no-export>
      <button class="secondary small" onclick={addColumn}><Icon name="Plus" size={14} /> Column</button>
    </div>
  </div>
</div>

{#if sel}
  <aside class="inspector float arrive" aria-label="Card">
    <div class="inspector-head">
      <Icon name="SquareKanban" size={16} />
      <strong class="spacer">Card</strong>
      <button class="icon small danger" title="Delete card (Del)" aria-label="Delete card" onclick={() => deleteCard(sel.id)}><Icon name="Trash2" size={15} /></button>
      <button class="icon" aria-label="Close" onclick={() => (selected = null)}><Icon name="X" size={16} /></button>
    </div>
    <div class="inspector-body">
      <div class="seg types" role="radiogroup" aria-label="Card type">
        {#each CARD_TYPES as t (t.type)}
          <button class:active={sel.type === t.type} role="radio" aria-checked={sel.type === t.type} onclick={() => updateCard(sel.id, { type: t.type as CardType })}>
            <span class="dot" style:background={t.color}></span>{t.label}
          </button>
        {/each}
      </div>
      <div class="two">
        <label class="field">
          Column
          <select value={sel.colId} onchange={(e) => edit((k) => moveCard(k, sel.id, e.currentTarget.value, Infinity))}>
            {#each data.columns as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
          </select>
        </label>
        <label class="field">
          Assignee
          <input type="text" list="kanban-people" value={sel.assignee} oninput={(e) => updateCard(sel.id, { assignee: e.currentTarget.value }, 'assignee')} />
          <datalist id="kanban-people">{#each people as p (p)}<option value={p}></option>{/each}</datalist>
        </label>
      </div>
      <StoryFields story={sel} {epics} update={(patch: Partial<UserStory>, key) => updateCard(sel.id, patch, key)} />
    </div>
  </aside>
{/if}

<style>
  .board {
    display: inline-flex;
    align-items: flex-start;
    gap: var(--sp-3);
    min-width: 100%;
    min-height: 100%;
    padding: var(--sp-4);
  }
  .col {
    flex: none;
    width: 264px;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    padding: var(--sp-2);
    border-radius: var(--r-card);
    background: var(--panel-2);
    border: 1px solid var(--line);
  }
  .col.over {
    background: color-mix(in srgb, var(--danger) 9%, var(--panel-2));
    border-color: color-mix(in srgb, var(--danger) 45%, var(--line));
  }
  .col-head {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .col-in {
    flex: 1;
    min-width: 0;
    font-weight: 700;
  }
  .count {
    padding: 0 7px;
    height: 20px;
    line-height: 20px;
    border-radius: var(--r-pill);
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--ink-2);
    background: color-mix(in srgb, var(--ink) 9%, transparent);
  }
  .count.over {
    background: var(--danger);
    color: #fff;
  }
  .warn {
    color: var(--danger);
    padding: 0 4px;
  }
  .menu-anchor {
    position: relative;
  }
  .col-menu {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 30;
    width: 220px;
    padding: var(--sp-2);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .col-menu .field {
    margin-bottom: var(--sp-2);
  }
  .cards {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-height: 48px;
    padding: 2px;
    border-radius: var(--r-control);
  }
  .cards.target {
    background: color-mix(in srgb, var(--accent) 9%, transparent);
  }
  .card {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 8px 9px;
    border-radius: var(--r-control);
    background: var(--panel);
    border: 1px solid var(--line);
    border-left: 3px solid var(--t);
    box-shadow: 0 1px 2px rgba(22, 25, 29, 0.08);
    font-size: var(--fs-sm);
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .card.epic {
    background: color-mix(in srgb, var(--t) 12%, var(--panel));
  }
  .card.sel {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
  }
  :global(.card.drag-source) {
    opacity: 0.35;
  }
  .top {
    gap: 6px;
    min-width: 0;
  }
  .tag {
    flex: none;
    padding: 0 6px;
    border-radius: var(--r-pill);
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.03em;
    color: #fff;
    background: var(--t);
  }
  .epic-name {
    font-size: var(--fs-xs);
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .title {
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .title.untitled {
    color: var(--muted);
    font-style: italic;
  }
  .foot {
    gap: 4px;
    font-size: var(--fs-xs);
  }
  .pill {
    padding: 0 6px;
    height: 18px;
    line-height: 18px;
    border-radius: var(--r-pill);
    color: var(--muted);
    background: color-mix(in srgb, var(--ink) 7%, transparent);
  }
  .pill.strong {
    font-weight: 700;
    color: var(--ink-2);
  }
  .who {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    display: inline-grid;
    place-items: center;
    font-size: 10px;
    font-weight: 700;
    color: var(--accent-ink);
    background: var(--accent);
  }
  .drop-line {
    height: 3px;
    border-radius: 2px;
    background: var(--accent);
    margin: -2px 0;
  }
  .add {
    justify-content: center;
    height: 28px;
    color: var(--muted);
    border: 1px dashed transparent;
    border-radius: var(--r-control);
  }
  .add:hover {
    border-color: var(--line);
  }
  .sum {
    text-align: right;
    padding: 0 4px;
  }
  .add-col {
    flex: none;
    padding-top: 4px;
  }
  .types {
    flex-wrap: wrap;
    border-radius: var(--r-card);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-2);
  }
</style>
