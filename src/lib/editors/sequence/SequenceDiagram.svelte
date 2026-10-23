<script lang="ts">
  import { messageLabel, type Layout, type MessageBox } from './layout';
  import { diagramPalette } from './palette.svelte';

  /**
   * Draws a laid-out sequence diagram. Colours are attributes with resolved
   * values (see palette.svelte.ts) so PNG / SVG exports look like the screen.
   * Selection and hover only add classes; the accent they paint is CSS under
   * `html:not(.exporting)`, so an exported image never carries it.
   *
   * Everything drawn can be clicked: a message, note or fragment selects its
   * row in the panel; a head, lifeline or activation bar selects its
   * participant. Hover keys are item ids, or `p:<participant id>`.
   */
  let {
    layout,
    selected = null,
    selectedPart = null,
    hovered = null,
    onSelect,
    onEdit,
    onSelectPart,
    onEditPart,
    onHover
  }: {
    layout: Layout;
    selected?: string | null;
    /** The participant chosen in the drawing or the panel. */
    selectedPart?: string | null;
    /** What the pointer is over in the panel (an item id or `p:<id>`), lit here too. */
    hovered?: string | null;
    onSelect?: (id: string | null) => void;
    onEdit?: (id: string) => void;
    onSelectPart?: (id: string) => void;
    onEditPart?: (id: string) => void;
    onHover?: (key: string | null) => void;
  } = $props();

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

  /** Under the pointer here, else what the panel's pointer is over. */
  let over = $state<string | null>(null);
  const hot = $derived(over ?? hovered);
  const hotFrag = $derived(hot ? fragOf.get(hot) : undefined);

  function enter(key: string) {
    over = key;
    onHover?.(key);
  }
  function leave(key: string) {
    if (over !== key) return;
    over = null;
    onHover?.(null);
  }

  function pick(e: Event, id: string) {
    e.stopPropagation();
    onSelect?.(id);
  }
  function edit(e: Event, id: string) {
    e.stopPropagation();
    onEdit?.(id);
  }
  function pickPart(e: Event, id: string) {
    e.stopPropagation();
    onSelectPart?.(id);
  }
  function editPart(e: Event, id: string) {
    e.stopPropagation();
    onEditPart?.(id);
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
  <!-- fragment frames (behind everything; their labels are drawn last). The wide
       transparent border is what you hover and click; the whole frame lights up. -->
  {#each layout.fragments as f (f.itemId)}
    <g class="frag" class:sel={selFrag === f} class:hot={hotFrag === f}>
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <rect
        class="hit pickable"
        x={f.x1}
        y={f.y1}
        width={f.x2 - f.x1}
        height={f.y2 - f.y1}
        fill="none"
        stroke="transparent"
        stroke-width="10"
        pointer-events="stroke"
        onclick={(e) => pick(e, f.itemId)}
        ondblclick={(e) => edit(e, f.itemId)}
        onmouseenter={() => enter(f.itemId)}
        onmouseleave={() => leave(f.itemId)}
      />
      <rect class="sc sw" x={f.x1} y={f.y1} width={f.x2 - f.x1} height={f.y2 - f.y1} fill="none" stroke={p.ink} stroke-width="1.2" pointer-events="none" />
      {#each f.elses as e (e.itemId)}
        <line class="sc" x1={f.x1} x2={f.x2} y1={e.y} y2={e.y} stroke={p.ink} stroke-width="1.1" stroke-dasharray="6 4" pointer-events="none" />
      {/each}
    </g>
  {/each}

  <!-- lifelines: click to pick the participant -->
  {#each layout.lifelines as l (l.id)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <g
      class="life pickable"
      class:sel={selectedPart === l.id}
      class:hot={hot === 'p:' + l.id}
      onclick={(e) => pickPart(e, l.id)}
      ondblclick={(e) => editPart(e, l.id)}
      onmouseenter={() => enter('p:' + l.id)}
      onmouseleave={() => leave('p:' + l.id)}
    >
      <line class="hit" x1={l.x} x2={l.x} y1={l.y1} y2={l.y2} stroke="transparent" stroke-width="14" />
      <line class="sc" x1={l.x} x2={l.x} y1={l.y1} y2={l.y2} stroke={p.line} stroke-width="1" stroke-dasharray="6 5" />
    </g>
  {/each}
  {#each layout.crosses as c, i (i)}
    <path d="M {c.x - 9} {c.y - 9} L {c.x + 9} {c.y + 9} M {c.x + 9} {c.y - 9} L {c.x - 9} {c.y + 9}" stroke={p.ink} stroke-width="2" pointer-events="none" />
  {/each}

  <!-- activation bars belong to their participant -->
  {#each layout.activations as a, i (i)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <rect
      class="bar pickable"
      class:sel={selectedPart === a.pid}
      class:hot={hot === 'p:' + a.pid}
      x={a.x}
      y={a.y1}
      width="10"
      height={a.y2 - a.y1}
      fill={p.fill}
      stroke={p.ink}
      stroke-width="1.2"
      onclick={(e) => pickPart(e, a.pid)}
      ondblclick={(e) => editPart(e, a.pid)}
      onmouseenter={() => enter('p:' + a.pid)}
      onmouseleave={() => leave('p:' + a.pid)}
    />
  {/each}

  <!-- heads -->
  {#each layout.heads as h (h.id)}
    {@const cx = h.x}
    {@const top = h.y}
    {@const gy = top + 4}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <g
      class="part pickable"
      class:sel={selectedPart === h.id}
      class:hot={hot === 'p:' + h.id}
      onclick={(e) => pickPart(e, h.id)}
      ondblclick={(e) => editPart(e, h.id)}
      onmouseenter={() => enter('p:' + h.id)}
      onmouseleave={() => leave('p:' + h.id)}
    >
      <rect class="halo" x={cx - h.w / 2 - 6} y={top - 5} width={h.w + 12} height={h.h + 10} rx="8" fill="transparent" />
      <g class="sc" fill={p.fill} stroke={p.ink} stroke-width="1.5" stroke-linecap="round">
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
        <text class="fc" x={cx} y={top + h.h / 2 + 4.5} text-anchor="middle" fill={p.ink} text-decoration="underline">{h.name}</text>
      {:else}
        <text class="fc" x={cx} y={top + h.h - 6} text-anchor="middle" fill={p.ink}>{h.name}</text>
      {/if}
    </g>
  {/each}

  <!-- notes -->
  {#each layout.notes as n (n.itemId)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <g
      class="note pickable"
      class:sel={selected === n.itemId}
      class:hot={hot === n.itemId}
      onclick={(e) => pick(e, n.itemId)}
      ondblclick={(e) => edit(e, n.itemId)}
      onmouseenter={() => enter(n.itemId)}
      onmouseleave={() => leave(n.itemId)}
    >
      <rect class="halo" x={n.x - 5} y={n.y - 5} width={n.w + 10} height={n.h + 10} rx="6" fill="transparent" />
      {#if n.kind === 'divider'}
        {@const mid = n.y + n.h / 2}
        {@const lw = n.lines.length ? n.lines[0].length * 7 + 24 : 0}
        <rect class="sc sw" x={n.x} y={mid - 3} width={n.w} height="6" fill={p.soft} stroke={p.ink} stroke-width="1" />
        {#if lw}
          <rect class="sc sw" x={n.x + n.w / 2 - lw / 2} y={n.y} width={lw} height={n.h} fill={p.soft} stroke={p.ink} stroke-width="1.1" />
          <text x={n.x + n.w / 2} y={mid + 4} font-size="12" font-weight="700" text-anchor="middle" fill={p.ink}>{n.lines[0]}</text>
        {/if}
      {:else if n.kind === 'delay'}
        <rect class="sc delay" x={n.x} y={n.y} width={n.w} height={n.h} fill={p.fill} opacity="0.85" stroke="none" stroke-dasharray="3 3" />
        <text x={n.x + n.w / 2} y={n.y + n.h / 2 + 4} font-size="12" font-style="italic" text-anchor="middle" fill={p.ink}>{n.lines[0] ?? '⋯'}</text>
      {:else}
        <path class="sc sw" d="M {n.x} {n.y} H {n.x + n.w - 10} L {n.x + n.w} {n.y + 10} V {n.y + n.h} H {n.x} Z" fill={p.note} stroke={p.ink} stroke-width="1.1" />
        <path class="sc" d="M {n.x + n.w - 10} {n.y} V {n.y + 10} H {n.x + n.w}" fill="none" stroke={p.ink} stroke-width="1.1" />
        {#each n.lines as l, i (i)}
          <text x={n.x + 10} y={n.y + 20 + i * 16} font-size="12" fill={p.ink}>{l}</text>
        {/each}
      {/if}
    </g>
  {/each}

  <!-- fragment labels: on top of lifelines and bars -->
  {#each layout.fragments as f (f.itemId)}
    {@const tw = f.op.length * 7.5 + 18}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <g
      class="tab pickable"
      class:sel={selFrag === f}
      class:hot={hotFrag === f}
      onclick={(e) => pick(e, f.itemId)}
      ondblclick={(e) => edit(e, f.itemId)}
      onmouseenter={() => enter(f.itemId)}
      onmouseleave={() => leave(f.itemId)}
    >
      <path class="sc sw tabfill" d="M {f.x1} {f.y1 + 20} H {f.x1 + tw} L {f.x1 + tw + 8} {f.y1 + 12} V {f.y1} H {f.x1} Z" fill={p.soft} stroke={p.ink} stroke-width="1.2" />
      <text x={f.x1 + 6} y={f.y1 + 14} font-size="12" font-weight="700" fill={p.ink} role="button" tabindex="-1" onkeydown={(e) => keyPick(e, f.itemId)}>{f.op}</text>
    </g>
    {#if f.op === 'ref'}
      <text x={(f.x1 + f.x2) / 2} y={f.y1 + 34} text-anchor="middle" fill={p.ink} paint-order="stroke" stroke={p.fill} stroke-width="4" stroke-linejoin="round" pointer-events="none">{f.guard}</text>
    {:else if f.guard}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <text
        class="guard pickable"
        class:hot={hotFrag === f}
        x={f.x1 + tw + 16}
        y={f.y1 + 14}
        font-size="12"
        fill={p.ink}
        paint-order="stroke"
        stroke={p.fill}
        stroke-width="4"
        stroke-linejoin="round"
        onclick={(ev) => pick(ev, f.itemId)}
        ondblclick={(ev) => edit(ev, f.itemId)}
        onmouseenter={() => enter(f.itemId)}
        onmouseleave={() => leave(f.itemId)}>[{f.guard}]</text
      >
    {/if}
    {#each f.elses as e (e.itemId)}
      {#if e.guard}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <text
          class="guard pickable"
          class:sel={selected === e.itemId}
          x={f.x1 + 10}
          y={e.y + 16}
          font-size="12"
          fill={p.ink}
          paint-order="stroke"
          stroke={p.fill}
          stroke-width="4"
          stroke-linejoin="round"
          onclick={(ev) => pick(ev, e.itemId)}
          ondblclick={(ev) => edit(ev, e.itemId)}
          onmouseenter={() => enter(e.itemId)}
          onmouseleave={() => leave(e.itemId)}>[{e.guard}]</text
        >
      {/if}
    {/each}
  {/each}

  <!-- messages -->
  {#each layout.messages as m (m.itemId)}
    {@const dashed = m.style === 'reply' || m.style === 'create' ? '6 4' : undefined}
    {@const open = m.style !== 'sync' && m.style !== 'destroy'}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <g
      class="msg pickable"
      class:sel={selected === m.itemId}
      class:hot={hot === m.itemId}
      onclick={(e) => pick(e, m.itemId)}
      ondblclick={(e) => edit(e, m.itemId)}
      onmouseenter={() => enter(m.itemId)}
      onmouseleave={() => leave(m.itemId)}
    >
      {#if m.self}
        <path d={selfPath(m)} class="hit" fill="none" stroke="transparent" stroke-width="14" />
        <path class="sc sw" d={selfPath(m)} fill="none" stroke={p.ink} stroke-width="1.3" stroke-dasharray={dashed} />
        {#if open}
          <polyline class="sc sw" points={head(m.x2, m.y + 20, -1)} fill="none" stroke={p.ink} stroke-width="1.3" stroke-linejoin="round" />
        {:else}
          <polygon class="sc fc" points={head(m.x2, m.y + 20, -1)} fill={p.ink} stroke={p.ink} stroke-width="1" stroke-linejoin="round" />
        {/if}
      {:else}
        {@const dir = m.x2 >= m.x1 ? 1 : -1}
        <line x1={m.x1} x2={m.x2} y1={m.y} y2={m.y} class="hit" stroke="transparent" stroke-width="14" />
        <line class="sc sw" x1={m.x1} x2={m.x2} y1={m.y} y2={m.y} stroke={p.ink} stroke-width="1.3" stroke-dasharray={dashed} />
        {#if open}
          <polyline class="sc sw" points={head(m.x2, m.y, dir)} fill="none" stroke={p.ink} stroke-width="1.3" stroke-linejoin="round" />
        {:else}
          <polygon class="sc fc" points={head(m.x2, m.y, dir)} fill={p.ink} stroke={p.ink} stroke-width="1" stroke-linejoin="round" />
        {/if}
      {/if}
      <text class="fc label" x={m.labelX} y={m.labelY} text-anchor={m.labelAnchor} fill={p.ink} paint-order="stroke" stroke={p.fill} stroke-width="4" stroke-linejoin="round">{messageLabel(m.text, m.style, m.num)}</text>
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
  .hit {
    transition: stroke var(--t);
  }
  .halo {
    transition: fill var(--t);
  }
  /* What the pointer is over (here or on its row in the panel) gets a soft accent
     halo; what is selected is drawn in the accent. Neither reaches an export:
     under .exporting these rules drop away and the attributes' ink shows. */
  :global(html:not(.exporting)) .seq :is(.hot, .pickable:hover) > .hit {
    stroke: color-mix(in srgb, var(--accent) 18%, transparent);
  }
  :global(html:not(.exporting)) .seq :is(.hot, .pickable:hover) > .halo {
    fill: color-mix(in srgb, var(--accent) 11%, transparent);
  }
  :global(html:not(.exporting)) .seq .bar:is(.hot, :hover) {
    fill: color-mix(in srgb, var(--accent) 16%, var(--d-fill));
  }
  :global(html:not(.exporting)) .seq .tab:is(.hot, :hover) .tabfill {
    fill: color-mix(in srgb, var(--accent) 16%, var(--d-soft));
  }
  :global(html:not(.exporting)) .seq .sel .sc,
  :global(html:not(.exporting)) .seq .bar.sel {
    stroke: var(--accent);
  }
  :global(html:not(.exporting)) .seq .sel .fc,
  :global(html:not(.exporting)) .seq .guard.sel {
    fill: var(--accent);
  }
  :global(html:not(.exporting)) .seq .sel .sw {
    stroke-width: 2.2px;
  }
  :global(html:not(.exporting)) .seq .life.sel .sc {
    stroke-width: 1.6px;
  }
  :global(html:not(.exporting)) .seq :is(.msg, .part).sel text {
    font-weight: 700;
  }
</style>
