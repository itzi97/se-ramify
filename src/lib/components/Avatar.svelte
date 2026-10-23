<script lang="ts">
  /**
   * A team member: their initial on their own colour. A ring says they are in
   * the diagram right now: green when they have it open, amber while they
   * edit it (two people editing one diagram end up with two versions).
   */
  import { initials, personColor } from '../model/people';
  import { app } from '../stores/app.svelte';

  let {
    name,
    size = 20,
    letters = 1,
    state = null,
    title
  }: { name: string; size?: number; letters?: number; state?: 'here' | 'editing' | null; title?: string } = $props();
</script>

<span
  class="av {state ?? ''}"
  style:--who={personColor(name, app.team)}
  style:width="{size}px"
  style:height="{size}px"
  style:font-size="{Math.round(size * (letters > 1 ? 0.42 : 0.52))}px"
  title={title ?? name}
  aria-label={title ?? name}
  role="img">{initials(name, letters)}</span
>

<style>
  .av {
    flex: none;
    display: inline-grid;
    place-items: center;
    border-radius: 50%;
    background: var(--who);
    color: #fff;
    font-weight: 700;
    line-height: 1;
    letter-spacing: 0.02em;
    user-select: none;
  }
  .here {
    box-shadow: 0 0 0 2px var(--panel), 0 0 0 3.5px var(--ok);
  }
  .editing {
    box-shadow: 0 0 0 2px var(--panel), 0 0 0 3.5px var(--warn);
  }
</style>
