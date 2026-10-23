<script lang="ts" module>
  /** One row of a right-click menu. */
  import type { EdgeTypeInfo } from '../../model/kinds';

  export type MenuEntry =
    | {
        kind?: 'item';
        label: string;
        icon?: string;
        /** Its shortcut, shown on the right. */
        hint?: string;
        danger?: boolean;
        disabled?: boolean;
        /** One of a set (a radio), or with `checkbox` an on / off switch. */
        checked?: boolean;
        checkbox?: boolean;
        /** Draw a sample of this kind of line before the label. */
        line?: EdgeTypeInfo;
        run: () => void;
      }
    | { kind: 'sep' }
    | { kind: 'head'; label: string; icon?: string; sub?: string }
    | { kind: 'swatches'; value: string | undefined; pick: (hex: string | undefined) => void }
    | { kind: 'tiles'; tiles: { label: string; title: string; icon: string; color?: string; run: () => void }[] };
</script>

<script lang="ts">
  import { onMount, tick } from 'svelte';
  import Icon from '../../components/Icon.svelte';
  import { palettes } from '../../stores/palette.svelte';
  import LineGlyph from './LineGlyph.svelte';

  let {
    x,
    y,
    label,
    entries,
    onClose
  }: {
    x: number;
    y: number;
    label: string;
    entries: MenuEntry[];
    /** `refocus`: the menu was closed from the keyboard (or ran an item), so focus goes back where it was. */
    onClose: (refocus: boolean) => void;
  } = $props();

  let el = $state<HTMLDivElement | null>(null);
  let pos = $state<{ left: number; top: number } | null>(null);

  const items = () => [...(el?.querySelectorAll<HTMLElement>('[role^="menuitem"]:not(:disabled)') ?? [])];

  onMount(() => {
    // Open where the pointer is, but never off screen.
    const r = el!.getBoundingClientRect();
    pos = {
      left: Math.max(8, Math.min(x, innerWidth - r.width - 8)),
      top: y + r.height > innerHeight - 8 ? Math.max(8, Math.min(y, innerHeight - 8) - r.height) : y
    };
    // Once it is shown (a hidden element can't take focus), the keyboard starts on the first item.
    void tick().then(() => items()[0]?.focus({ preventScroll: true }));
    // Anything pressed outside the menu closes it (and still does what it does).
    const away = (e: PointerEvent) => {
      if (!el?.contains(e.target as Node)) onClose(false);
    };
    const gone = () => onClose(false);
    document.addEventListener('pointerdown', away, true);
    window.addEventListener('blur', gone);
    window.addEventListener('resize', gone);
    return () => {
      document.removeEventListener('pointerdown', away, true);
      window.removeEventListener('blur', gone);
      window.removeEventListener('resize', gone);
    };
  });

  function onKey(e: KeyboardEvent) {
    // Keys stay in the menu: Delete or Escape here mustn't reach the canvas.
    e.stopPropagation();
    const list = items();
    const i = list.indexOf(document.activeElement as HTMLElement);
    const go = (j: number) => list[(j + list.length) % list.length]?.focus();
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      go(i + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      go(i < 0 ? -1 : i - 1);
    } else if (e.key === 'Home' || e.key === 'PageUp') {
      e.preventDefault();
      go(0);
    } else if (e.key === 'End' || e.key === 'PageDown') {
      e.preventDefault();
      go(-1);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      onClose(true);
    }
  }

  function run(fn: () => void) {
    onClose(true);
    fn();
  }
</script>

<div
  bind:this={el}
  class="cmenu float arrive"
  class:placed={!!pos}
  style:left="{pos?.left ?? x}px"
  style:top="{pos?.top ?? y}px"
  role="menu"
  aria-label={label}
  tabindex="-1"
  data-no-export
  onkeydown={onKey}
  oncontextmenu={(e) => e.preventDefault()}
>
  {#each entries as m, i (i)}
    {#if m.kind === 'sep'}
      <div class="sep" role="separator"></div>
    {:else if m.kind === 'head'}
      <div class="head" role="presentation">
        {#if m.icon}<Icon name={m.icon} size={14} />{/if}
        <strong>{m.label}</strong>
        {#if m.sub}<span class="sub">{m.sub}</span>{/if}
      </div>
    {:else if m.kind === 'swatches'}
      <div class="swatch-row" role="group" aria-label="Colour">
        <button class="dot none" class:on={!m.value} role="menuitemradio" aria-checked={!m.value} title="No colour" aria-label="No colour" onclick={() => run(() => m.pick(undefined))}>
          <Icon name="Ban" size={12} />
        </button>
        {#each palettes.colors as s (s.hex)}
          <button class="dot" class:on={m.value === s.hex} style:--c={s.hex} role="menuitemradio" aria-checked={m.value === s.hex} title={s.name} aria-label={s.name} onclick={() => run(() => m.pick(s.hex))}></button>
        {/each}
      </div>
    {:else if m.kind === 'tiles'}
      <div class="tiles" role="group" style:--cols={Math.min(4, m.tiles.length)}>
        {#each m.tiles as t (t.label)}
          <button class="tile" role="menuitem" title={t.title} onclick={() => run(t.run)}>
            <span class="tile-icon" style:color={t.color}><Icon name={t.icon} size={18} /></span>
            <span class="tile-label">{t.label}</span>
          </button>
        {/each}
      </div>
    {:else}
      <button
        class="menu-row"
        class:danger={m.danger}
        role={m.checked === undefined ? 'menuitem' : m.checkbox ? 'menuitemcheckbox' : 'menuitemradio'}
        aria-checked={m.checked}
        disabled={m.disabled}
        onclick={() => run(m.run)}
      >
        {#if m.checked !== undefined}
          <span class="check" class:on={m.checked}>{#if m.checked}<Icon name="Check" size={14} />{/if}</span>
        {:else if m.icon}
          <Icon name={m.icon} size={15} />
        {/if}
        {#if m.line}<span class="line-sample"><LineGlyph info={m.line} width={34} /></span>{/if}
        <span class="grow">{m.label}</span>
        {#if m.hint}<kbd class="quiet">{m.hint}</kbd>{/if}
      </button>
    {/if}
  {/each}
</div>

<style>
  .cmenu {
    position: fixed;
    z-index: 60;
    min-width: 210px;
    max-width: 340px;
    max-height: calc(100vh - 16px);
    overflow: auto;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    outline: none;
  }
  /* Measured first, then shown where it fits. */
  .cmenu:not(.placed) {
    visibility: hidden;
  }
  .menu-row:focus-visible,
  .tile:focus-visible {
    outline: none;
    background: var(--hover);
    box-shadow: inset 0 0 0 1.5px var(--selected-line);
  }
  .menu-row:active:not(:disabled) {
    background: var(--press);
  }
  .menu-row:disabled {
    color: var(--muted);
  }
  .grow {
    flex: 1;
  }
  .menu-row kbd {
    margin-left: var(--sp-3);
  }
  .check {
    display: inline-grid;
    place-items: center;
    width: 15px;
    color: var(--accent);
  }
  .line-sample {
    display: inline-flex;
    color: var(--ink-2);
  }
  .sep {
    height: 1px;
    margin: 4px 6px;
    background: var(--line);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px 4px;
    color: var(--ink);
    font-size: var(--fs-sm);
  }
  .head :global(.lucide) {
    color: var(--muted);
  }
  .sub {
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .swatch-row {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    padding: 6px 8px;
  }
  .dot {
    width: 20px;
    height: 20px;
    padding: 0;
    border: 0;
    border-radius: var(--r-pill);
    background: var(--c);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 18%, transparent);
    transition: transform var(--t), box-shadow var(--t);
  }
  .dot:hover,
  .dot:focus-visible {
    background: var(--c);
    transform: scale(1.15);
    outline: none;
    box-shadow: 0 0 0 2px var(--panel), 0 0 0 3.5px var(--selected-line);
  }
  .dot.on {
    box-shadow: 0 0 0 2px var(--panel), 0 0 0 3.5px var(--ink);
  }
  .dot.none {
    display: grid;
    place-items: center;
    background: var(--panel-2);
    color: var(--muted);
  }
  .dot.none:hover,
  .dot.none:focus-visible {
    background: var(--panel-2);
  }
  .tiles {
    display: grid;
    grid-template-columns: repeat(var(--cols), 76px);
    gap: 2px;
    padding: 2px;
  }
  .tile {
    flex-direction: column;
    justify-content: flex-start;
    height: auto;
    min-height: 58px;
    padding: 8px 4px 6px;
    gap: 4px;
    border-radius: var(--r-control);
    white-space: normal;
    font-size: var(--fs-xs);
    line-height: 1.2;
    text-align: center;
    color: var(--ink-2);
  }
  .tile:active:not(:disabled) {
    background: var(--press);
  }
  .tile-icon {
    display: grid;
    place-items: center;
  }
  .tile-label {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
  }
</style>
