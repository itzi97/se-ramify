<script lang="ts">
  import { palettes } from '../stores/palette.svelte';
  import Icon from './Icon.svelte';

  /** A row of colour dots plus "none". `value` is a hex or undefined. */
  let { value, onPick, allowNone = true }: { value: string | undefined; onPick: (hex: string | undefined) => void; allowNone?: boolean } = $props();
</script>

<div class="row swatches" role="radiogroup" aria-label="Colour">
  {#if allowNone}
    <button class="swatch none" class:on={!value} role="radio" aria-checked={!value} title="No colour" onclick={() => onPick(undefined)}>
      <Icon name="Ban" size={12} />
    </button>
  {/if}
  {#each palettes.colors as s (s.hex)}
    <button class="swatch" class:on={value === s.hex} style:background={s.hex} role="radio" aria-checked={value === s.hex} title={s.name} aria-label={s.name} onclick={() => onPick(s.hex)}></button>
  {/each}
  {#if value && !palettes.colors.some((s) => s.hex === value)}
    <!-- A colour from another palette: still shown, so you see what it has. -->
    <span class="swatch on other" style:background={value} title="{value} (not in this folder's colours)"></span>
  {/if}
  <button class="swatch edit" title="Colours of this folder: the company's, a preset…" aria-label="Edit the colours" onclick={() => (palettes.editing = palettes.project)}><Icon name="Palette" size={12} /></button>
</div>

<style>
  .swatches {
    gap: 6px;
    flex-wrap: wrap;
  }
  .none {
    display: grid;
    place-items: center;
    background: var(--panel-2);
    color: var(--muted);
  }
  /* The dots carry their own colour, so hover and focus show as a ring around them. */
  .swatch {
    transition: box-shadow var(--t);
  }
  .swatch:hover {
    box-shadow: 0 0 0 2px var(--panel), 0 0 0 3.5px var(--muted);
  }
  .edit {
    display: grid;
    place-items: center;
    background: transparent;
    color: var(--muted);
    box-shadow: inset 0 0 0 1px var(--line);
  }
  .edit:hover {
    color: var(--accent);
  }
  .other {
    cursor: default;
  }
  .swatch:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px var(--panel), 0 0 0 4px var(--accent);
  }
</style>
