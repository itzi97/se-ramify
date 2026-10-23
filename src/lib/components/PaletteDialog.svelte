<script lang="ts">
  /**
   * A project's colours: start from a preset or the company's own colours
   * (typed, pasted as hex codes or taken from the logo), see them on a small
   * diagram, save them for the whole group.
   */
  import { app } from '../stores/app.svelte';
  import { palettes } from '../stores/palette.svelte';
  import { DEFAULT_PALETTE, MAX_COLORS, PRESETS, colorName, colorsFromPixels, hexesIn, normHex, type Palette, type Swatch } from '../model/palette';
  import { inkOn } from '../model/colors';
  import { focusIn } from './focus';
  import Icon from './Icon.svelte';

  const project = palettes.editing ?? '';
  const where = project ? project.split('/').pop() : (app.dir?.split(/[\\/]/).pop() ?? 'the top folder');

  const start = palettes.byProject[project] ?? null;
  let name = $state(start?.name ?? '');
  let colors = $state<Swatch[]>((start ?? DEFAULT_PALETTE).colors.map((c) => ({ ...c })));
  let pasted = $state('');
  let fileInput = $state<HTMLInputElement | null>(null);
  let busy = $state(false);

  const close = () => (palettes.editing = null);

  function usePreset(p: Palette) {
    colors = p.colors.map((c) => ({ ...c }));
    if (!name || PRESETS.some((x) => x.name === name)) name = p.name;
  }
  function setHex(i: number, v: string) {
    const h = normHex(v);
    if (h) colors[i].hex = h;
  }
  function add(hex = '#4a7fc1') {
    if (colors.length >= MAX_COLORS) return;
    colors.push({ name: colorName(hex), hex });
  }
  function move(i: number, d: number) {
    const j = i + d;
    if (j < 0 || j >= colors.length) return;
    [colors[i], colors[j]] = [colors[j], colors[i]];
  }
  function fromPaste() {
    const hs = hexesIn(pasted);
    if (!hs.length) return app.notify('No colour codes found there: write them like #003366.', 'warn');
    colors = hs.slice(0, MAX_COLORS).map((hex) => ({ name: colorName(hex), hex }));
    pasted = '';
  }
  async function fromLogo(file: File | undefined) {
    if (!file) return;
    busy = true;
    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      await new Promise((ok, ko) => ((img.onload = ok), (img.onerror = ko), (img.src = url)));
      const k = Math.min(1, 160 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.width * k));
      c.height = Math.max(1, Math.round(img.height * k));
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const hs = colorsFromPixels(ctx.getImageData(0, 0, c.width, c.height).data);
      if (!hs.length) app.notify('That image has no clear colours (only white, black or transparent).', 'warn');
      else {
        colors = hs.map((hex) => ({ name: colorName(hex), hex }));
        if (!name) name = file.name.replace(/\.[^.]+$/, '');
      }
    } catch {
      app.notify("Couldn't read that image.", 'error');
    } finally {
      busy = false;
      if (fileInput) fileInput.value = '';
    }
  }
  async function save() {
    const clean = colors.filter((c) => normHex(c.hex)).map((c) => ({ name: c.name.trim() || colorName(c.hex), hex: c.hex }));
    if (!clean.length) return;
    await palettes.save(project, { name: name.trim() || where || 'Paleta', colors: clean });
    close();
  }
  async function reset() {
    await palettes.save(project, null);
    close();
  }
  const c = (i: number) => colors[i % Math.max(1, colors.length)]?.hex ?? '#8d949c';
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (e.stopPropagation(), close())} />

<button class="scrim veil" aria-label="Cancel" tabindex="-1" onclick={close}></button>
<div class="dialog float arrive" role="dialog" aria-modal="true" aria-label="Colours">
  <header class="row between">
    <div class="stack tight">
      <strong>Colours for {where}</strong>
      <span class="tiny muted">The colours offered for shapes, lines, notes, bars and zones in this folder, and for <em>Colour by kind</em>. Saved in the folder, so the whole group uses them.</span>
    </div>
    <button class="icon" aria-label="Cancel" onclick={close}><Icon name="X" /></button>
  </header>

  <div class="body">
    <div class="side stack">
      <span class="sect">Start from</span>
      <div class="presets">
        {#each PRESETS as p (p.name)}
          <button class="preset" onclick={() => usePreset(p)} title="Use {p.name}">
            <span class="strip">{#each p.colors as s (s.hex)}<span style:background={s.hex}></span>{/each}</span>
            <span class="small">{p.name}</span>
          </button>
        {/each}
      </div>
      <span class="sect">Or the company's</span>
      <button class="secondary" disabled={busy} onclick={() => fileInput?.click()}><Icon name="ImageUp" size={16} /> {busy ? 'Reading…' : 'Take them from the logo…'}</button>
      <input bind:this={fileInput} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" hidden onchange={(e) => fromLogo(e.currentTarget.files?.[0])} />
      <form class="paste" onsubmit={(e) => (e.preventDefault(), fromPaste())}>
        <input type="text" bind:value={pasted} placeholder="#003366 #ff9900 #1a7f5a" aria-label="Paste colour codes" />
        <button class="secondary small" disabled={!pasted.trim()}><Icon name="ClipboardPaste" size={14} /> Use</button>
      </form>
      <span class="tiny muted">From the brand guide: paste the hex codes, in any format.</span>

      <!-- What a diagram looks like in these colours. -->
      <span class="sect">Looks like</span>
      <svg class="preview" viewBox="0 0 280 150" role="img" aria-label="A small diagram in these colours">
        <line x1="70" y1="45" x2="210" y2="45" stroke="var(--d-line)" stroke-width="1.5" />
        <line x1="70" y1="45" x2="140" y2="115" stroke="var(--d-line)" stroke-width="1.5" />
        {#each [[10, 20, 0], [150, 20, 1], [80, 90, 2]] as [x, y, i] (i)}
          <rect x={x} y={y} width="120" height="44" rx="4" fill="color-mix(in srgb, {c(i)} 22%, var(--d-fill))" stroke={c(i)} stroke-width="2" />
          <rect x={x} y={y} width="120" height="16" rx="4" fill={c(i)} />
          <text x={x + 60} y={y + 12} text-anchor="middle" font-size="10" font-weight="700" fill={inkOn(c(i))}>{['Socio', 'Préstamo', 'Libro'][i]}</text>
          <text x={x + 8} y={y + 33} font-size="9" fill="var(--d-ink)">{['+ pedir()', '+ renovar()', '- isbn: String'][i]}</text>
        {/each}
      </svg>
    </div>

    <div class="main stack">
      <label class="field small">Name <input type="text" bind:value={name} placeholder="e.g. Neuranet" use:focusIn /></label>
      <ol class="colors">
        {#each colors as col, i (i)}
          <li class="crow">
            <input class="pick" type="color" value={col.hex} aria-label="Colour {i + 1}" oninput={(e) => setHex(i, e.currentTarget.value)} />
            <input class="hex" type="text" value={col.hex} aria-label="Hex code {i + 1}" spellcheck="false" onchange={(e) => setHex(i, e.currentTarget.value)} />
            <input class="cname" type="text" bind:value={col.name} aria-label="Name of colour {i + 1}" />
            <button class="icon small" aria-label="Move up" title="Earlier: Colour by kind and new branches use the first ones first" disabled={i === 0} onclick={() => move(i, -1)}><Icon name="ArrowUp" size={14} /></button>
            <button class="icon small danger" aria-label="Remove colour {i + 1}" title="Remove" disabled={colors.length === 1} onclick={() => colors.splice(i, 1)}><Icon name="Trash2" size={14} /></button>
          </li>
        {/each}
      </ol>
      <button class="small add" disabled={colors.length >= MAX_COLORS} onclick={() => add()}><Icon name="Plus" size={14} /> Add a colour{colors.length >= MAX_COLORS ? ` (${MAX_COLORS} at most)` : ''}</button>
    </div>
  </div>

  <footer class="row between">
    <button class="small" disabled={!start} onclick={reset} title={start ? 'Forget this palette: the folder uses the default colours again' : 'This folder already uses the default colours'}><Icon name="RotateCcw" size={14} /> Default colours</button>
    <span class="row acts">
      <button class="secondary" onclick={close}>Cancel</button>
      <button class="primary" onclick={save} disabled={!colors.length}><Icon name="Palette" size={16} /> Save colours</button>
    </span>
  </footer>
</div>

<style>
  .veil {
    background: var(--veil) !important;
    z-index: 90;
  }
  .dialog {
    position: fixed;
    top: 8vh;
    left: 50%;
    transform: translateX(-50%);
    width: min(820px, 94vw);
    max-height: 84vh;
    display: flex;
    flex-direction: column;
    z-index: 91;
    overflow: hidden;
  }
  header,
  footer {
    padding: var(--sp-3) var(--sp-3) var(--sp-3) var(--sp-4);
    gap: var(--sp-3);
  }
  header {
    border-bottom: 1px solid var(--line);
  }
  footer {
    border-top: 1px solid var(--line);
  }
  .acts {
    gap: var(--sp-2);
  }
  .tight {
    gap: 2px;
  }
  .body {
    display: grid;
    grid-template-columns: 300px 1fr;
    min-height: 0;
    overflow: auto;
  }
  .side {
    padding: var(--sp-3) var(--sp-4);
    gap: var(--sp-2);
    border-right: 1px solid var(--line);
    background: var(--panel-2);
  }
  .main {
    padding: var(--sp-3) var(--sp-4);
    gap: var(--sp-2);
  }
  .presets {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
  }
  .preset {
    height: auto;
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
    padding: 6px;
    border: 1px solid var(--line);
    border-radius: var(--r-control);
    background: var(--panel);
    font-weight: 400;
  }
  .preset:hover {
    border-color: var(--accent);
  }
  .strip {
    display: flex;
    height: 14px;
    border-radius: 3px;
    overflow: hidden;
  }
  .strip span {
    flex: 1;
  }
  .paste {
    display: flex;
    gap: 6px;
  }
  .paste input {
    flex: 1;
    min-width: 0;
    font-family: ui-monospace, Menlo, Consolas, monospace;
    font-size: var(--fs-sm);
  }
  .preview {
    width: 100%;
    height: auto;
    border-radius: var(--r-control);
    background: var(--d-fill);
    box-shadow: inset 0 0 0 1px var(--line);
  }
  .colors {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .crow {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pick {
    width: 40px;
    height: 32px;
    padding: 2px;
    border-radius: var(--r-control);
    cursor: pointer;
    flex: none;
  }
  .hex {
    width: 92px;
    flex: none;
    font-family: ui-monospace, Menlo, Consolas, monospace;
    font-size: var(--fs-sm);
  }
  .cname {
    flex: 1;
    min-width: 0;
  }
  .add {
    align-self: flex-start;
  }
  @media (max-width: 700px) {
    .body {
      grid-template-columns: 1fr;
    }
    .side {
      border-right: 0;
      border-bottom: 1px solid var(--line);
    }
  }
</style>
