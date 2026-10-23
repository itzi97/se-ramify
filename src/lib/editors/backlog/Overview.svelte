<script lang="ts">
  import type { BacklogData } from '../../model/types';
  import { backlogStats, epicCode, epicStats, storyCode, storySentence, storyTitle } from './model';
  import { priorityBadge } from '../../model/badges';

  /**
   * The printable backlog: the epic table, then the story cards of every
   * broken-down epic. With `onPick`, an epic row or a story card opens it in
   * the editor (hover shows on screen only, never in the exported image).
   */
  let {
    data,
    title,
    exportRoot = true,
    onPick
  }: { data: BacklogData; title: string; exportRoot?: boolean; onPick?: (epicId: string, storyId?: string) => void } = $props();

  const stats = $derived(backlogStats(data));
  const broken = $derived(data.epics.filter((e) => e.stories.length));
  function key(e: KeyboardEvent, epicId: string, storyId?: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPick?.(epicId, storyId);
    }
  }
</script>

{#snippet chip(p: string)}
  {@const pb = priorityBadge(p)}
  <span class="prio" style:--p={pb?.c} style:--pi={pb?.ink}>{p}</span>
{/snippet}

<article class="doc" data-export-root={exportRoot ? '' : undefined}>
  <header>
    <div class="kicker">Product backlog</div>
    <h2>{data.product.trim() || title}</h2>
    <p class="sum">{stats.epics} épicas · {stats.stories} historias de usuario{stats.points ? ` · ${stats.points} puntos` : ''}</p>
  </header>

  <table>
    <thead>
      <tr><th>Código</th><th>Épica</th><th>Componente</th><th>Prioridad</th><th class="num">Historias</th><th class="num">Puntos</th></tr>
    </thead>
    <tbody>
      {#each data.epics as e (e.id)}
        {@const st = epicStats(e)}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
        <tr class:pick={!!onPick} tabindex={onPick ? 0 : undefined} title={onPick ? 'Open this epic' : undefined} onclick={() => onPick?.(e.id)} onkeydown={(ev) => key(ev, e.id)}>
          <td class="code">{epicCode(data, e)}</td>
          <td><strong>{e.title || 'Sin título'}</strong>{#if e.description.trim()}<div class="desc">{e.description}</div>{/if}</td>
          <td>{e.component || '—'}</td>
          <td>{#if e.priority}{@render chip(e.priority)}{:else}—{/if}</td>
          <td class="num">{st.stories || '—'}</td>
          <td class="num">{st.points || '—'}</td>
        </tr>
      {:else}
        <tr><td colspan="6" class="none">Sin épicas.</td></tr>
      {/each}
    </tbody>
  </table>

  {#each broken as e (e.id)}
    <section>
      <h3><span class="code">{epicCode(data, e)}</span> {e.title || 'Sin título'}</h3>
      <div class="cards">
        {#each e.stories as s (s.id)}
          <!-- svelte-ignore a11y_no_static_element_interactions, a11y_no_noninteractive_tabindex -->
          <div class="story" class:pick={!!onPick} role={onPick ? 'button' : undefined} tabindex={onPick ? 0 : undefined} title={onPick ? 'Open this story' : undefined} onclick={() => onPick?.(e.id, s.id)} onkeydown={(ev) => key(ev, e.id, s.id)}>
            <div class="top">
              <span class="code">{storyCode(data, e, s)}</span>
              <span class="spacer"></span>
              {#if s.priority}{@render chip(s.priority)}{/if}
              {#if typeof s.points === 'number'}<span class="pts">{s.points} pt</span>{/if}
            </div>
            <div class="title">{storyTitle(s)}</div>
            {#if storySentence(s)}<p class="sentence">{storySentence(s)}.</p>{/if}
            {#if s.gherkin.trim()}<pre class="gherkin">{s.gherkin.trim()}</pre>{:else}<p class="pending">Criterios de aceptación pendientes</p>{/if}
          </div>
        {/each}
      </div>
    </section>
  {/each}
</article>

<style>
  .doc {
    width: 980px;
    padding: 36px 40px 40px;
    background: var(--d-fill);
    color: var(--d-ink);
    border: 1px solid var(--line);
    border-radius: var(--r-card);
    box-shadow: var(--shadow);
  }
  .kicker {
    font-size: var(--fs-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  h2 {
    margin: 4px 0 2px;
    font-size: 24px;
    line-height: 1.2;
  }
  .sum {
    margin: 0 0 var(--sp-4);
    color: var(--muted);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--fs-md);
  }
  th,
  td {
    padding: 7px 10px;
    border-top: 1px solid var(--line);
    text-align: left;
    vertical-align: top;
  }
  thead th {
    border-top: 0;
    border-bottom: 2px solid var(--d-line);
    font-size: var(--fs-sm);
    color: var(--ink-2);
  }
  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .code {
    font-family: var(--mono);
    font-size: 12px;
    white-space: nowrap;
    color: var(--ink-2);
  }
  .desc {
    margin-top: 2px;
    font-size: var(--fs-sm);
    color: var(--muted);
  }
  .none {
    color: var(--muted);
  }
  section {
    margin-top: 28px;
  }
  h3 {
    margin: 0 0 var(--sp-3);
    font-size: var(--fs-lg);
    padding-bottom: 6px;
    border-bottom: 2px solid var(--d-line);
  }
  h3 .code {
    font-size: 13px;
    margin-right: 6px;
  }
  .cards {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: start;
    gap: var(--sp-3);
  }
  .story {
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-left: 4px solid var(--d-line);
    border-radius: var(--r-control);
    background: var(--d-fill);
    break-inside: avoid;
  }
  .top {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .spacer {
    flex: 1;
  }
  .title {
    margin-top: 4px;
    font-weight: 700;
  }
  .sentence {
    margin: 4px 0 8px;
    font-style: italic;
    font-size: var(--fs-sm);
    color: var(--ink-2);
  }
  .gherkin {
    margin: 0;
    padding: 8px 10px;
    font-family: var(--mono);
    font-size: 11px;
    line-height: 1.45;
    white-space: pre-wrap;
    background: var(--d-soft);
    border-radius: var(--r-control);
    color: var(--d-ink);
  }
  .pending {
    margin: 0;
    font-size: var(--fs-sm);
    color: var(--muted);
    font-style: italic;
  }
  .prio,
  .pts {
    display: inline-block;
    padding: 1px 8px;
    border-radius: var(--r-pill);
    font-size: var(--fs-xs);
    font-weight: 700;
    border: 1px solid var(--line);
    white-space: nowrap;
  }
  /* MoSCoW: Must red, Should orange, Could amber, Won't grey. */
  .prio {
    border-color: transparent;
    background: var(--p);
    color: var(--pi);
  }
  .pick {
    cursor: pointer;
  }
  tr.pick,
  .story.pick {
    transition: background-color var(--t), border-color var(--t);
  }
  :global(html:not(.exporting)) tr.pick:hover {
    background: var(--hover);
  }
  :global(html:not(.exporting)) .story.pick:hover {
    border-color: color-mix(in srgb, var(--ink) 30%, var(--line));
    background: color-mix(in srgb, var(--ink) 2%, var(--d-fill));
  }
</style>
