<script lang="ts">
  /**
   * Shows a drawing of a fixed size scaled to fill the space it has, centred:
   * a small diagram grows (up to `max`, and only as far as the height
   * allows), a wide one shrinks to the width (down to `min`, then it scrolls). Only the screen changes; exports read the drawing at its
   * own size, since the scale is on this wrapper, not on the drawing.
   */
  import type { Snippet } from 'svelte';

  let { width, height, max = 1.6, min = 0.85, pad = 24, children }: { width: number; height: number; max?: number; min?: number; pad?: number; children: Snippet } = $props();

  let host = $state<HTMLDivElement | null>(null);
  let avail = $state({ w: 0, h: 0 });

  $effect(() => {
    const area = host?.parentElement;
    if (!area) return;
    const ro = new ResizeObserver(() => (avail = { w: area.clientWidth, h: area.clientHeight }));
    ro.observe(area);
    return () => ro.disconnect();
  });

  const scale = $derived.by(() => {
    if (!avail.w || !width || !height) return 1;
    // Fill the width; grow only as far as the height allows, but never shrink to fit the height (it scrolls instead).
    const sw = (avail.w - pad * 2) / width;
    const sh = (avail.h - pad * 2) / height;
    const s = Math.min(sw, Math.max(1, sh));
    return Math.round(Math.max(min, Math.min(max, s)) * 1000) / 1000;
  });
</script>

<div class="fit-host" bind:this={host} style:--pad="{pad}px">
  <div class="fit-box" style:width="{width * scale}px" style:height="{height * scale}px">
    <div class="fit-in" style:width="{width}px" style:height="{height}px" style:transform="scale({scale})">
      {@render children()}
    </div>
  </div>
</div>

<style>
  .fit-host {
    display: grid;
    place-items: center;
    min-width: 100%;
    min-height: 100%;
    width: max-content;
    padding: var(--pad);
    box-sizing: border-box;
  }
  .fit-box {
    position: relative;
  }
  .fit-in {
    position: absolute;
    left: 0;
    top: 0;
    transform-origin: 0 0;
  }
</style>
