<script lang="ts">
  import type { EdgeTypeInfo } from '../../model/kinds';
  import { inset, markAt, markInset } from './geometry';

  /** A short sample of a kind of line (solid or dashed, with its end marks), for pickers and menus. */
  let { info, width = 40 }: { info: EdgeTypeInfo; width?: number } = $props();

  const W = 48;
  const H = 18;
  const a = { x: 2, y: H / 2 };
  const b = { x: W - 2, y: H / 2 };
  const start = $derived(info.start ?? 'none');
  const line = $derived(inset([a, b], markInset(start), markInset(info.end)));
  const marks = $derived([markAt(start, a, b), markAt(info.end, b, a)].filter((m): m is NonNullable<typeof m> => m !== null));
</script>

<svg class="glyph" viewBox="0 0 {W} {H}" width={width} height={(width * H) / W} aria-hidden="true">
  <line x1={line[0].x} y1={line[0].y} x2={line[1].x} y2={line[1].y} class:dashed={info.dashed} />
  {#each marks as m, i (i)}
    {#if m.kind === 'polyline'}
      <polyline points={m.points.map((p) => `${p.x},${p.y}`).join(' ')} />
    {:else}
      <polygon class:filled={m.filled} points={m.points.map((p) => `${p.x},${p.y}`).join(' ')} />
    {/if}
  {/each}
</svg>

<style>
  .glyph {
    flex: none;
    overflow: visible;
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    stroke-linejoin: round;
  }
  .dashed {
    stroke-dasharray: 5 3.5;
  }
  polygon {
    fill: var(--panel);
  }
  polygon.filled {
    fill: currentColor;
  }
</style>
