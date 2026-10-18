<script lang="ts">
  import { iconData } from '../model/icons';

  /** A Lucide icon by name, or any other short string (an emoji) as text. */
  let { name, size = 16, class: cls = '' }: { name: string; size?: number; class?: string } = $props();
  const data = $derived(iconData(name));
</script>

{#if data}
  <svg class="lucide {cls}" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    {#each data as [tag, attrs], i (i)}
      {#if tag === 'path'}<path {...attrs} />
      {:else if tag === 'circle'}<circle {...attrs} />
      {:else if tag === 'rect'}<rect {...attrs} />
      {:else if tag === 'line'}<line {...attrs} />
      {:else if tag === 'polyline'}<polyline {...attrs} />
      {:else if tag === 'polygon'}<polygon {...attrs} />
      {:else if tag === 'ellipse'}<ellipse {...attrs} />
      {/if}
    {/each}
  </svg>
{:else}
  <span class="glyph {cls}" aria-hidden="true">{name}</span>
{/if}

<style>
  .lucide {
    flex: none;
    display: inline-block;
    vertical-align: -0.15em;
  }
  .glyph {
    line-height: 1;
  }
</style>
