<script lang="ts">
  import { app } from '../../stores/app.svelte';
  import Icon from '../../components/Icon.svelte';
  import type { NodeTypeInfo, Palette } from '../../model/kinds';
  import type { EdgeRouting, GraphData, GraphKind } from '../../model/types';

  let {
    kind,
    palette,
    relation = $bindable(),
    routing,
    onAdd,
    onDrop,
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
    onTidy: () => void;
    onFit: () => void;
    /** The inspector is showing: keep clear of it (otherwise the toolbar may use the whole width). */
    panelOpen?: boolean;
  } = $props();

  const shown = $derived(palette.nodes.filter((n) => !n.hidden));
  /** Long palettes (infrastructure devices) open as a grid instead of a row. */
  const grid = $derived(shown.length > 10);
  let open = $state(false);

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
  }
  function up(e: PointerEvent) {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.moved) {
      if (onDrop(d.t, e.clientX, e.clientY)) open = false;
    } else {
      onAdd(d.t);
      open = false;
    }
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
</script>

<div class="toolbar float" class:wide={!panelOpen} role="toolbar" aria-label="Shapes" data-no-export>
  {#if grid}
    <div class="anchor">
      <button class:active={open} onclick={() => (open = !open)} aria-expanded={open}><Icon name="Plus" size={16} /> Add</button>
      {#if open}
        <button class="scrim" aria-label="Close" tabindex="-1" onclick={() => (open = false)}></button>
        <div class="pop float arrive">
          {#each shown as t (t.label)}
            <button class="tile" title="{t.label} · {t.es}" onpointerdown={(e) => down(e, t)} onpointermove={move} onpointerup={up} onclick={(e) => keyAdd(e, t)}>
              <Icon name={t.icon} size={20} />
              <span>{t.es}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {:else}
    {#each shown as t (t.label)}
      <button class="icon" title="{t.es} · {t.label}" aria-label={t.label} onpointerdown={(e) => down(e, t)} onpointermove={move} onpointerup={up} onclick={(e) => keyAdd(e, t)}>
        <Icon name={t.icon} size={17} />
      </button>
    {/each}
  {/if}
  <span class="sep"></span>
  <label class="rel" title="Kind of line a new connection gets">
    <Icon name="Spline" size={15} />
    <select bind:value={relation} aria-label="New connection type">
      {#each palette.edges as e (e.type)}
        <option value={e.type}>{e.es}</option>
      {/each}
    </select>
  </label>
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
  <div class="ghost float" style:left="{drag.x}px" style:top="{drag.y}px"><Icon name={drag.t.icon} size={18} /> {drag.t.es}</div>
{/if}

<style>
  .rel {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding-left: 6px;
    color: var(--muted);
  }
  .rel select {
    width: auto;
    max-width: 200px;
    height: 28px;
    padding: 2px 6px;
    color: var(--ink);
  }
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
</style>
