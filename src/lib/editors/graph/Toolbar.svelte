<script lang="ts">
  import { tick } from 'svelte';
  import { app } from '../../stores/app.svelte';
  import Icon from '../../components/Icon.svelte';
  import { familyOf, type NodeTypeInfo, type Palette } from '../../model/kinds';
  import type { EdgeRouting, GraphData, GraphKind } from '../../model/types';
  import LineGlyph from './LineGlyph.svelte';

  let {
    kind,
    palette,
    relation = $bindable(),
    routing,
    onAdd,
    onDrop,
    onDragOver,
    onTidy,
    onFit,
    panelOpen = false
  }: {
    kind: GraphKind;
    palette: Palette;
    relation: string;
    routing: EdgeRouting;
    onAdd: (t: NodeTypeInfo) => void;
    onDrop: (t: NodeTypeInfo, x: number, y: number) => boolean;
    /** A shape dragged from here is over the canvas at (x, y); null when the drag ends. */
    onDragOver?: (t: NodeTypeInfo | null, x: number, y: number) => void;
    onTidy: () => void;
    onFit: () => void;
    /** The inspector is showing: keep clear of it (otherwise the toolbar may use the whole width). */
    panelOpen?: boolean;
  } = $props();

  const shown = $derived(palette.nodes.filter((n) => !n.hidden));
  /** Long palettes (infrastructure devices) open as a grid instead of a row. */
  const grid = $derived(shown.length > 10);
  /** Shape icons wear the diagram family's colour (UML blue, requirements violet…). */
  const fam = $derived(familyOf(kind));
  let open = $state(false);

  const tip = (t: NodeTypeInfo) => `${t.es}${t.es !== t.label ? ` (${t.label})` : ''} · click to add · drag to place`;

  // Pointer-based drag from the palette (HTML5 drag and drop is unreliable on Wayland / WebKitGTK).
  let drag = $state<{ t: NodeTypeInfo; x: number; y: number; moved: boolean } | null>(null);

  function down(e: PointerEvent, t: NodeTypeInfo) {
    if (e.button !== 0) return;
    drag = { t, x: e.clientX, y: e.clientY, moved: false };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 6) return;
    drag = { ...drag, x: e.clientX, y: e.clientY, moved: true };
    onDragOver?.(drag.t, e.clientX, e.clientY);
  }
  function up(e: PointerEvent) {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.moved) onDragOver?.(null, e.clientX, e.clientY);
    if (d.moved) {
      if (onDrop(d.t, e.clientX, e.clientY)) open = false;
    } else {
      onAdd(d.t);
      open = false;
    }
  }

  function cancelDrag(e: PointerEvent) {
    if (drag?.moved) onDragOver?.(null, e.clientX, e.clientY);
    drag = null;
  }

  /** Enter / Space on a shape button (a click with no pointer behind it). */
  function keyAdd(e: MouseEvent, t: NodeTypeInfo) {
    if (e.detail !== 0) return;
    onAdd(t);
    open = false;
  }

  function setRouting(r: EdgeRouting) {
    app.change((d) => ((d.data as GraphData).routing = r));
  }

  /* --- the kind of line new connections get: a list that shows each line --- */
  const current = $derived(palette.edges.find((e) => e.type === relation) ?? palette.edges[0]);
  let relOpen = $state(false);
  let relBtn = $state<HTMLButtonElement | null>(null);
  let relList = $state<HTMLDivElement | null>(null);

  async function openRel() {
    relOpen = true;
    await tick();
    (relList?.querySelector<HTMLElement>('[aria-selected="true"]') ?? relList?.querySelector<HTMLElement>('[role="option"]'))?.focus();
  }
  function closeRel(refocus = true) {
    relOpen = false;
    if (refocus) relBtn?.focus();
  }
  function pickRel(type: string) {
    relation = type;
    closeRel();
  }
  function relBtnKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      void openRel();
    }
  }
  function relKey(e: KeyboardEvent) {
    e.stopPropagation();
    const opts = [...(relList?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const i = opts.indexOf(document.activeElement as HTMLElement);
    const go = (j: number) => opts[(j + opts.length) % opts.length]?.focus();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      go(i + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      go(i - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      go(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      go(-1);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeRel();
    } else if (e.key === 'Tab') {
      closeRel(false);
    }
  }
</script>

<div class="toolbar float" class:wide={!panelOpen} role="toolbar" aria-label="Shapes" data-no-export>
  {#if grid}
    <div class="anchor">
      <button class:active={open} onclick={() => (open = !open)} aria-expanded={open} title="Add a shape"><Icon name="Plus" size={16} /> Add</button>
      {#if open}
        <button class="scrim" aria-label="Close" tabindex="-1" onclick={() => (open = false)}></button>
        <div class="pop float arrive">
          {#each shown as t (t.label)}
            <button class="tile" title={tip(t)} onpointerdown={(e) => down(e, t)} onpointermove={move} onpointerup={up} onpointercancel={cancelDrag} onclick={(e) => keyAdd(e, t)}>
              <span class="ticon" style:color={fam.color}><Icon name={t.icon} size={20} /></span>
              <span>{t.es}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    {#each shown as t (t.label)}
      <button class="icon shape" title={tip(t)} aria-label={t.label} onpointerdown={(e) => down(e, t)} onpointermove={move} onpointerup={up} onpointercancel={cancelDrag} onclick={(e) => keyAdd(e, t)}>
        <span class="ticon" style:color={fam.color}><Icon name={t.icon} size={17} /></span>
      </button>
    {/each}
  {/if}
  <span class="sep"></span>
  <div class="anchor">
    <button
      bind:this={relBtn}
      class="rel"
      class:open={relOpen}
      aria-haspopup="listbox"
      aria-expanded={relOpen}
      aria-label="New connection type: {current.es}"
      title="Kind of line a new connection gets"
      onclick={() => (relOpen ? closeRel() : void openRel())}
      onkeydown={relBtnKey}
    >
      <LineGlyph info={current} width={30} />
      <span class="rel-name">{current.es}</span>
      <Icon name="ChevronDown" size={14} />
    </button>
    {#if relOpen}
      <button class="scrim" aria-label="Close" tabindex="-1" onclick={() => closeRel(false)}></button>
      <div class="pop rel-pop float arrive" role="listbox" aria-label="New connection type" tabindex="-1" bind:this={relList} onkeydown={relKey}>
        {#each palette.edges as e (e.type)}
          <button class="opt" class:on={e.type === relation} role="option" aria-selected={e.type === relation} onclick={() => pickRel(e.type)}>
            <LineGlyph info={e} width={36} />
            <span class="opt-name">{e.es}</span>
            {#if e.label !== e.es}<span class="opt-sub">{e.label}</span>{/if}
            <span class="opt-check">{#if e.type === relation}<Icon name="Check" size={14} />{/if}</span>
          </button>
        {/each}
      </div>
    {/if}
  </div>
  <span class="sep"></span>
  {#if !palette.autoLayout}
    <div class="seg" role="radiogroup" aria-label="Line routing">
      <button class="icon" class:active={routing === 'straight'} role="radio" aria-checked={routing === 'straight'} title="Straight lines" onclick={() => setRouting('straight')}><Icon name="Slash" size={15} /></button>
      <button class="icon" class:active={routing === 'orthogonal'} role="radio" aria-checked={routing === 'orthogonal'} title="Right-angle lines" onclick={() => setRouting('orthogonal')}><Icon name="CornerDownRight" size={15} /></button>
    </div>
    <button onclick={onTidy} title="Lay the diagram out automatically (undo brings it back)"><Icon name="WandSparkles" size={16} /> Tidy</button>
  {/if}
  <button class="icon" onclick={onFit} title="Fit to window" aria-label="Fit to window"><Icon name="Maximize" size={16} /></button>
</div>

{#if drag?.moved}
  <div class="ghost float" style:left="{drag.x}px" style:top="{drag.y}px"><span class="ticon" style:color={fam.color}><Icon name={drag.t.icon} size={18} /></span> {drag.t.es}</div>
{/if}

<style>
  .anchor {
    position: relative;
  }
  .pop {
    position: absolute;
    top: calc(100% + 8px);
    left: -4px;
    z-index: 50;
    display: grid;
    grid-template-columns: repeat(4, 96px);
    gap: 4px;
    padding: 6px;
  }
  .tile {
    flex-direction: column;
    height: auto;
    padding: 8px 4px;
    gap: 4px;
    border-radius: var(--r-control);
    white-space: normal;
    font-size: var(--fs-xs);
    line-height: 1.2;
    text-align: center;
  }
  .ticon {
    display: inline-grid;
    place-items: center;
  }
  .ghost {
    position: fixed;
    z-index: 200;
    pointer-events: none;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    transform: translate(-50%, -50%);
    font-size: var(--fs-sm);
  }
  .toolbar button {
    touch-action: none;
  }
  .toolbar.wide {
    max-width: calc(100% - 2 * var(--edge));
  }
  /* A shape button: grab it to drag a shape out. */
  .shape:active:not(:disabled) {
    cursor: grabbing;
  }

  /* The line picker: shows the line it will draw. */
  .rel {
    gap: 6px;
    padding: 0 8px 0 10px;
    max-width: 230px;
    color: var(--ink);
  }
  .rel.open {
    background: var(--press);
  }
  .rel :global(.glyph) {
    color: var(--ink-2);
  }
  .rel-name {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .rel-pop {
    grid-template-columns: 1fr;
    gap: 1px;
    width: max-content;
    min-width: 230px;
    max-width: 340px;
    padding: 4px;
    outline: none;
  }
  .opt {
    justify-content: flex-start;
    gap: 10px;
    height: 32px;
    padding: 0 8px;
    border-radius: var(--r-control);
    color: var(--ink);
  }
  .opt :global(.glyph) {
    color: var(--ink-2);
  }
  .opt.on {
    background: var(--selected);
  }
  .opt.on :global(.glyph) {
    color: var(--accent);
  }
  .opt:focus-visible {
    outline: none;
    box-shadow: inset 0 0 0 1.5px var(--selected-line);
  }
  .opt-sub {
    color: var(--muted);
    font-size: var(--fs-sm);
  }
  .opt-check {
    display: inline-grid;
    place-items: center;
    width: 14px;
    margin-left: auto;
    color: var(--accent);
  }
</style>
