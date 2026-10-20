<script lang="ts">
  import type { BacklogData } from '../../model/types';
  import { backlogStats, epicCode, epicStats, storyCode, storySentence, storyTitle } from './model';

  /** The printable backlog: the epic table, then the story cards of every broken-down epic. */
  let { data, title, exportRoot = true }: { data: BacklogData; title: string; exportRoot?: boolean } = $props();

  const stats = $derived(backlogStats(data));
  const broken = $derived(data.epics.filter((e) => e.stories.length));
  const prio = (p: string) => (p || '').toLowerCase().replace(/[^a-z]/g, '');
</script>

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
        <tr>
          <td class="code">{epicCode(data, e)}</td>
          <td><strong>{e.title || 'Sin título'}</strong>{#if e.description.trim()}<div class="desc">{e.description}</div>{/if}</td>
          <td>{e.component || '—'}</td>
          <td>{#if e.priority}<span class="prio {prio(e.priority)}">{e.priority}</span>{:else}—{/if}</td>
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
          <div class="story">
            <div class="top">
              <span class="code">{storyCode(data, e, s)}</span>
              <span class="spacer"></span>
              {#if s.priority}<span class="prio {prio(s.priority)}">{s.priority}</span>{/if}
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
  .prio.must {
    background: var(--tier-S);
    color: var(--on-tier-S);
    border-color: transparent;
  }
  .prio.should {
    background: var(--tier-A);
    color: var(--on-tier-A);
    border-color: transparent;
  }
  .prio.could {
    background: var(--tier-B);
    color: var(--on-tier-B);
    border-color: transparent;
  }
  .prio.wont {
    background: var(--panel-2);
    color: var(--muted);
  }
</style>
