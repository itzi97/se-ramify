<script lang="ts">
  import { messageLabel, type Layout, type MessageBox } from './layout';
  import { diagramPalette } from './palette.svelte';

  /**
   * Draws a laid-out sequence diagram. Colours are attributes with resolved
   * values (see palette.svelte.ts) so PNG / SVG exports look like the screen.
   */
  let {
    layout,
    selected = null,
    onSelect,
    onEdit
  }: { layout: Layout; selected?: string | null; onSelect?: (id: string | null) => void; onEdit?: (id: string) => void } = $props();

  const palette = diagramPalette();
  const p = $derived(palette.current);

  const HEAD = 10;

  /** Arrowhead points for a line ending at (x, y) travelling in direction `dir` (+1 = right). */
  function head(x: number, y: number, dir: number): string {
    return `${x - dir * HEAD},${y - 5} ${x},${y} ${x - dir * HEAD},${y + 5}`;
  }

  function selfPath(m: MessageBox): string {
    return `M ${m.x1} ${m.y} H ${m.x1 + 36} V ${m.y + 20} H ${m.x2}`;
  }

  const fragOf = $derived(new Map(layout.fragments.flatMap((f) => [[f.itemId, f], ...(f.closeId ? [[f.closeId, f]] : []), ...f.elses.map((e) => [e.itemId, f])] as [string, typeof f][])));
  const selFrag = $derived(selected ? fragOf.get(selected) : undefined);

  function pick(e: Event, id: string) {
    e.stopPropagation();
    onSelect?.(id);
  }
  function edit(e: Event, id: string) {
    e.stopPropagation();
    onEdit?.(id);
  }
  function keyPick(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.(id);
    }
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<svg
  class="seq"
  width={layout.width}
  height={layout.height}
  viewBox="0 0 {layout.width} {layout.height}"
  xmlns="http://www.w3.org/2000/svg"
  font-family={p.font}
  font-size="13"
  onclick={() => onSelect?.(null)}
>
  <!-- fragment frames (behind everything; their labels are drawn last) -->
  {#each layout.fragments as f (f.itemId)}
    {@const c = selFrag === f ? p.accent : p.ink}
    <rect x={f.x1} y={f.y1} width={f.x2 - f.x1} height={f.y2 - f.y1} fill="none" stroke={c} stroke-width={selFrag === f ? 2 : 1.2} />
    {#each f.elses as e (e.itemId)}
      <line x1={f.x1} x2={f.x2} y1={e.y} y2={e.y} stroke={c} stroke-width="1.1" stroke-dasharray="6 4" />
    {/each}
  {/each}

  <!-- lifelines -->
  {#each layout.lifelines as l (l.id)}
    <line x1={l.x} x2={l.x} y1={l.y1} y2={l.y2} stroke={p.line} stroke-width="1" stroke-dasharray="6 5" />
  {/each}
  {#each layout.crosses as c, i (i)}
    <path d="M {c.x - 9} {c.y - 9} L {c.x + 9} {c.y + 9} M {c.x + 9} {c.y - 9} L {c.x - 9} {c.y + 9}" stroke={p.ink} stroke-width="2" />
  {/each}

  <!-- activation bars -->
  {#each layout.activations as a, i (i)}
    <rect x={a.x} y={a.y1} width="10" height={a.y2 - a.y1} fill={p.fill} stroke={p.ink} stroke-width="1.2" />
  {/each}

  <!-- heads -->
  {#each layout.heads as h (h.id)}
    {@const cx = h.x}
    {@const top = h.y}
    {@const gy = top + 4}
    <g fill={p.fill} stroke={p.ink} stroke-width="1.5" stroke-linecap="round">
      {#if h.kind === 'object'}
        <rect x={cx - h.w / 2} y={top} width={h.w} height={h.h} rx="2" />
      {:else if h.kind === 'actor'}
        <circle cx={cx} cy={gy + 6} r="6" />
        <path fill="none" d="M {cx} {gy + 12} V {gy + 26} M {cx - 11} {gy + 17} H {cx + 11} M {cx} {gy + 26} L {cx - 9} {gy + 38} M {cx} {gy + 26} L {cx + 9} {gy + 38}" />
      {:else if h.kind === 'boundary'}
        <circle cx={cx + 5} cy={gy + 20} r="13" />
        <path fill="none" d="M {cx - 16} {gy + 8} V {gy + 32} M {cx - 16} {gy + 20} H {cx - 8}" />
      {:else if h.kind === 'control'}
        <circle cx={cx} cy={gy + 21} r="13" />
        <path fill="none" d="M {cx + 1} {gy + 8} L {cx - 5} {gy + 3.5} M {cx + 1} {gy + 8} L {cx - 5} {gy + 12.5}" />
      {:else if h.kind === 'entity'}
        <circle cx={cx} cy={gy + 19} r="13" />
        <path fill="none" d="M {cx - 13} {gy + 34} H {cx + 13}" />
      {:else if h.kind === 'database'}
        <path d="M {cx - 14} {gy + 6} V {gy + 32} A 14 5 0 0 0 {cx + 14} {gy + 32} V {gy + 6}" />
        <ellipse cx={cx} cy={gy + 6} rx="14" ry="5" />
      {/if}
    </g>
    {#if h.kind === 'object'}
      <text x={cx} y={top + h.h / 2 + 4.5} text-anchor="middle" fill={p.ink} text-decoration="underline">{h.name}</text>
    {:else}
      <text x={cx} y={top + h.h - 6} text-anchor="middle" fill={p.ink}>{h.name}</text>
    {/if}
  {/each}

  <!-- notes -->
  {#each layout.notes as n (n.itemId)}
    {@const c = selected === n.itemId ? p.accent : p.ink}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <g class="pickable" onclick={(e) => pick(e, n.itemId)} ondblclick={(e) => edit(e, n.itemId)}>
      <path d="M {n.x} {n.y} H {n.x + n.w - 10} L {n.x + n.w} {n.y + 10} V {n.y + n.h} H {n.x} Z" fill={p.note} stroke={c} stroke-width={selected === n.itemId ? 2 : 1.1} />
      <path d="M {n.x + n.w - 10} {n.y} V {n.y + 10} H {n.x + n.w}" fill="none" stroke={c} stroke-width="1.1" />
      {#each n.lines as l, i (i)}
        <text x={n.x + 10} y={n.y + 20 + i * 16} font-size="12" fill={p.ink}>{l}</text>
      {/each}
    </g>
  {/each}

  <!-- fragment labels: on top of lifelines and bars -->
  {#each layout.fragments as f (f.itemId)}
    {@const tw = f.op.length * 7.5 + 18}
    {@const c = selFrag === f ? p.accent : p.ink}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <g class="pickable" onclick={(e) => pick(e, f.itemId)}>
      <path d="M {f.x1} {f.y1 + 20} H {f.x1 + tw} L {f.x1 + tw + 8} {f.y1 + 12} V {f.y1} H {f.x1} Z" fill={p.soft} stroke={c} stroke-width={selFrag === f ? 2 : 1.2} />
      <text x={f.x1 + 6} y={f.y1 + 14} font-size="12" font-weight="700" fill={p.ink} role="button" tabindex="-1" onkeydown={(e) => keyPick(e, f.itemId)}>{f.op}</text>
    </g>
    {#if f.op === 'ref'}
      <text x={(f.x1 + f.x2) / 2} y={f.y1 + 34} text-anchor="middle" fill={p.ink} paint-order="stroke" stroke={p.fill} stroke-width="4" stroke-linejoin="round">{f.guard}</text>
    {:else if f.guard}
      <text x={f.x1 + tw + 16} y={f.y1 + 14} font-size="12" fill={p.ink} paint-order="stroke" stroke={p.fill} stroke-width="4" stroke-linejoin="round">[{f.guard}]</text>
    {/if}
    {#each f.elses as e (e.itemId)}
      {#if e.guard}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <text class="pickable" x={f.x1 + 10} y={e.y + 16} font-size="12" fill={p.ink} paint-order="stroke" stroke={p.fill} stroke-width="4" stroke-linejoin="round" onclick={(ev) => pick(ev, e.itemId)}>[{e.guard}]</text>
      {/if}
    {/each}
  {/each}

  <!-- messages -->
  {#each layout.messages as m (m.itemId)}
    {@const dashed = m.style === 'reply' || m.style === 'create' ? '6 4' : undefined}
    {@const open = m.style !== 'sync' && m.style !== 'destroy'}
    {@const sel = selected === m.itemId}
    {@const c = sel ? p.accent : p.ink}
    {@const w = sel ? 2.2 : 1.3}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <g class="msg pickable" onclick={(e) => pick(e, m.itemId)} ondblclick={(e) => edit(e, m.itemId)}>
      {#if m.self}
        <path d={selfPath(m)} class="hit" fill="none" stroke="transparent" stroke-width="14" />
        <path d={selfPath(m)} fill="none" stroke={c} stroke-width={w} stroke-dasharray={dashed} />
        {#if open}
          <polyline points={head(m.x2, m.y + 20, -1)} fill="none" stroke={c} stroke-width={w} stroke-linejoin="round" />
        {:else}
          <polygon points={head(m.x2, m.y + 20, -1)} fill={c} stroke={c} stroke-width="1" stroke-linejoin="round" />
        {/if}
      {:else}
        {@const dir = m.x2 >= m.x1 ? 1 : -1}
        <line x1={m.x1} x2={m.x2} y1={m.y} y2={m.y} class="hit" stroke="transparent" stroke-width="14" />
        <line x1={m.x1} x2={m.x2} y1={m.y} y2={m.y} stroke={c} stroke-width={w} stroke-dasharray={dashed} />
        {#if open}
          <polyline points={head(m.x2, m.y, dir)} fill="none" stroke={c} stroke-width={w} stroke-linejoin="round" />
        {:else}
          <polygon points={head(m.x2, m.y, dir)} fill={c} stroke={c} stroke-width="1" stroke-linejoin="round" />
        {/if}
      {/if}
      <text x={m.labelX} y={m.labelY} text-anchor={m.labelAnchor} fill={c} font-weight={sel ? 700 : 400} paint-order="stroke" stroke={p.fill} stroke-width="4" stroke-linejoin="round">{messageLabel(m.text, m.style, m.num)}</text>
    </g>
  {/each}
</svg>

<style>
  .seq {
    display: block;
    user-select: none;
  }
  .pickable {
    cursor: pointer;
  }
  .msg:hover .hit {
    stroke: color-mix(in srgb, var(--accent) 14%, transparent);
  }
</style>
