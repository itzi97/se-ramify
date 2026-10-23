<script lang="ts">
  import { app } from '../../stores/app.svelte';
  import { palettes } from '../../stores/palette.svelte';
  import { storage } from '../../storage/diagrams';
  import type { TcoAlternative, TcoData, TcoLine } from '../../model/types';
  import Icon from '../../components/Icon.svelte';
  import Swatches from '../../components/Swatches.svelte';
  import { autosize } from '../board/actions';
  import { inkOn } from '../../model/colors';
  import {
    BLOCKS,
    MAX_ALTERNATIVES,
    MIN_ALTERNATIVES,
    SUGGESTED_CRITERIA,
    WHEN,
    addAlternative,
    addCriterion,
    altColor,
    amountText,
    bestScored,
    blankLine,
    cheapest,
    cloudTemplate,
    eur,
    horizon,
    lineYears,
    localTemplate,
    moveItem,
    parseAmount,
    removeAlternative,
    removeCriterion,
    scoreKey,
    scoreOf,
    sum,
    summarizeAll,
    templateFor,
    weightShare,
    weightedScore
  } from './model';

  /**
   * TCO calculator. Above: the cost lines of each alternative (a tab each)
   * and the qualitative comparison with the recommendation. Below: the
   * summary card — the part that is exported as an image.
   */

  const data = $derived(app.docOf('tco').data);
  /** An alternative's colour: its own, or the next of the project's palette. */
  const ac = (a: TcoAlternative) => altColor(data, a, palettes.custom ? palettes.hexes : undefined);
  const title = $derived(app.docOf('tco').title);
  const years = $derived(horizon(data));
  const yearIdx = $derived(Array.from({ length: years }, (_, i) => i));
  const sums = $derived(summarizeAll(data));
  const best = $derived(cheapest(data));
  const bestScore = $derived(bestScored(data));

  let tab = $state<string>('');
  /** The alternative under the pointer in the summary (row, bar, line, legend): the others fade in the chart. */
  let hoverAlt = $state<string | null>(null);
  let editEl = $state<HTMLElement | null>(null);

  /** Anything about an alternative in the summary opens its tab above (and brings the tabs into view). */
  function pickAlt(id: string) {
    tab = id;
    editEl?.querySelector('.head')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
  const over = (id: string) => () => (hoverAlt = id);
  const out = (id: string) => () => hoverAlt === id && (hoverAlt = null);
  function keyPick(e: KeyboardEvent, id: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      pickAlt(id);
    }
  }
  const alt = $derived(data.alternatives.find((a) => a.id === tab) ?? null);
  const altIndex = $derived(data.alternatives.findIndex((a) => a.id === tab));
  $effect(() => {
    if (tab !== 'compare' && !data.alternatives.some((a) => a.id === tab)) tab = data.alternatives[0]?.id ?? 'compare';
  });

  function td(d: { data: unknown }): TcoData {
    return d.data as TcoData;
  }
  function altOf(d: { data: unknown }, id: string): TcoAlternative | undefined {
    return td(d).alternatives.find((a) => a.id === id);
  }

  /* ------------------------------------------------------------- edits */

  function setAlt(id: string, patch: Partial<TcoAlternative>, key?: string) {
    app.change((d) => Object.assign(altOf(d, id) ?? {}, patch), key);
  }
  function setLine(altId: string, lineId: string, patch: Partial<TcoLine>, key?: string) {
    app.change((d) => {
      const l = altOf(d, altId)?.lines.find((x) => x.id === lineId);
      if (l) Object.assign(l, patch);
    }, key);
  }
  function addLine(altId: string, block: TcoLine['block']) {
    app.change((d) => {
      const a = altOf(d, altId);
      if (!a) return;
      // After the last line of the same block, so the table stays grouped.
      let at = -1;
      a.lines.forEach((l, i) => l.block === block && (at = i));
      const line = blankLine({ block, nature: block === 'ops' ? 'opex' : 'capex', when: block === 'ops' ? 'yearly' : 'once' });
      a.lines.splice(at < 0 ? a.lines.length : at + 1, 0, line);
      setTimeout(() => (document.querySelector(`[data-line="${line.id}"] input`) as HTMLInputElement | null)?.focus(), 30);
    });
  }
  function removeLine(altId: string, lineId: string) {
    app.change((d) => {
      const a = altOf(d, altId);
      if (a) a.lines = a.lines.filter((l) => l.id !== lineId);
    });
  }
  /** Up or down among the lines of the same block. */
  function moveLine(altId: string, lineId: string, by: -1 | 1) {
    app.change((d) => {
      const a = altOf(d, altId);
      if (!a) return;
      const i = a.lines.findIndex((l) => l.id === lineId);
      let j = i + by;
      while (j >= 0 && j < a.lines.length && a.lines[j].block !== a.lines[i].block) j += by;
      if (j < 0 || j >= a.lines.length) return;
      [a.lines[i], a.lines[j]] = [a.lines[j], a.lines[i]];
    });
  }
  function addTemplate(altId: string, which: 'local' | 'cloud') {
    app.change((d) => {
      const a = altOf(d, altId);
      if (!a) return;
      const have = new Set(a.lines.map((l) => l.name.trim().toLowerCase()));
      const add = (which === 'local' ? localTemplate() : cloudTemplate()).filter((l) => !have.has(l.name.toLowerCase()));
      // Keep the table grouped: merge and sort by block, stable.
      const order = BLOCKS.map((b) => b.key);
      a.lines = [...a.lines, ...add].map((l, i) => ({ l, i })).sort((x, y) => order.indexOf(x.l.block) - order.indexOf(y.l.block) || x.i - y.i).map((x) => x.l);
    });
  }
  function newAlternative() {
    let id = '';
    app.change((d) => {
      id = addAlternative(td(d))?.id ?? '';
    });
    if (id) tab = id;
  }
  async function deleteAlternative(id: string) {
    const i = data.alternatives.findIndex((a) => a.id === id);
    const alt = data.alternatives[i];
    if (alt?.lines.length && !(await (await storage()).confirm(`Delete "${alt.name}" and its ${alt.lines.length} cost ${alt.lines.length === 1 ? 'line' : 'lines'}? Ctrl+Z brings it back.`, 'TCO'))) return;
    app.change((d) => removeAlternative(td(d), id));
    tab = data.alternatives[Math.max(0, i - 1)]?.id ?? '';
  }
  function moveAlternative(by: -1 | 1) {
    const i = altIndex;
    app.change((d) => moveItem(td(d).alternatives, i, by));
  }

  function suggestCriteria() {
    app.change((d) => {
      for (const [name, weight] of SUGGESTED_CRITERIA) addCriterion(td(d), name).weight = weight;
    });
  }
  function setScore(cId: string, aId: string, v: number) {
    app.change((d) => {
      if (v) td(d).scores[scoreKey(cId, aId)] = v;
      else delete td(d).scores[scoreKey(cId, aId)];
    });
  }

  /** Number fields commit on change (blur / Enter), so "12," isn't rewritten while typing. */
  function numberField(node: HTMLInputElement) {
    const onKey = (e: KeyboardEvent) => e.key === 'Enter' && node.blur();
    node.addEventListener('keydown', onKey);
    return { destroy: () => node.removeEventListener('keydown', onKey) };
  }

  /* ------------------------------------------------------------- chart */

  const CH = { w: 760, h: 250, left: 74, right: 16, top: 16, bottom: 34 };
  const chartMax = $derived(niceMax(Math.max(1, ...sums.flatMap((s) => [...s.perYear, ...s.cumulative]))));
  const ticks = $derived([0, 0.25, 0.5, 0.75, 1].map((f) => f * chartMax));
  const plotW = CH.w - CH.left - CH.right;
  const plotH = CH.h - CH.top - CH.bottom;
  const groupW = $derived(plotW / years);
  const barW = $derived(Math.min(46, (groupW * 0.62) / Math.max(1, sums.length)));
  const yOf = (v: number) => CH.top + plotH - (v / chartMax) * plotH;
  const groupX = (i: number) => CH.left + groupW * i + groupW / 2;
  const barX = (gi: number, ai: number) => groupX(gi) - (barW * sums.length) / 2 + ai * barW;

  function niceMax(v: number): number {
    const p = 10 ** Math.floor(Math.log10(v));
    for (const m of [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }
  /** "84 k€" on the axis. */
  function short(v: number): string {
    if (v >= 1000) return `${(v / 1000).toLocaleString('es-ES', { maximumFractionDigits: v % 1000 ? 1 : 0 })} k€`;
    return `${Math.round(v)} €`;
  }

  const blockMax = $derived(Math.max(1, ...sums.map((s) => s.total)));
</script>

<div class="scroll-canvas">
  <div class="page">
    <!-- ───────────────────────────── editing ───────────────────────────── -->
    <section class="edit float" aria-label="TCO lines" bind:this={editEl}>
      <div class="head row between">
        <div class="row tabs-row">
          <div class="seg tabs" role="tablist" aria-label="Alternatives">
            {#each data.alternatives as a, i (a.id)}
              <button role="tab" class:active={tab === a.id} aria-selected={tab === a.id} onclick={() => (tab = a.id)}>
                <span class="dot" style:background={ac(a)}></span>{a.name || `Alternativa ${i + 1}`}
              </button>
            {/each}
            <button role="tab" class:active={tab === 'compare'} aria-selected={tab === 'compare'} onclick={() => (tab = 'compare')}><Icon name="Scale" size={14} /> Comparison</button>
          </div>
          <button class="icon small" title="Add an alternative" aria-label="Add an alternative" disabled={data.alternatives.length >= MAX_ALTERNATIVES} onclick={newAlternative}><Icon name="Plus" size={15} /></button>
        </div>
        <div class="row settings">
          <label class="row tiny-field">
            <span class="small muted">Years</span>
            <select value={years} onchange={(e) => app.change((d) => (td(d).years = +e.currentTarget.value))} aria-label="Years">
              {#each [1, 2, 3, 4, 5] as y (y)}<option value={y}>{y}</option>{/each}
            </select>
          </label>
          <label class="row tiny-field">
            <span class="small muted">Users</span>
            <input type="text" inputmode="numeric" class="users" placeholder="—" value={data.users || ''} use:numberField onchange={(e) => app.change((d) => (td(d).users = Math.max(0, Math.round(parseAmount(e.currentTarget.value)))))} aria-label="Number of users, for the cost per user" title="For the cost per user (optional)" />
          </label>
        </div>
      </div>

      <div class="totals row">
        {#each sums as s (s.id)}
          <button class="total-chip" class:best={best?.id === s.id} class:cur={tab === s.id} title="Open {s.name}" onclick={() => (tab = s.id)}
            ><span class="dot" style:background={s.color}></span>{s.name}: <strong>{eur(s.total)}</strong>{#if s.unpriced}<span class="unpriced-note">· {s.unpriced} sin precio</span>{/if}</button
          >
        {/each}
      </div>

      {#if alt}
        {@const a = alt}
        <div class="alt-head row">
          <input type="text" class="ghost-input alt-name" value={a.name} aria-label="Alternative name" oninput={(e) => setAlt(a.id, { name: e.currentTarget.value }, `alt-name:${a.id}`)} />
          <Swatches value={ac(a)} allowNone={false} onPick={(hex) => setAlt(a.id, { color: hex })} />
          <span class="spacer"></span>
          <button class="icon small" title="Move left" aria-label="Move left" disabled={altIndex <= 0} onclick={() => moveAlternative(-1)}><Icon name="ChevronLeft" size={14} /></button>
          <button class="icon small" title="Move right" aria-label="Move right" disabled={altIndex >= data.alternatives.length - 1} onclick={() => moveAlternative(1)}><Icon name="ChevronRight" size={14} /></button>
          <button class="icon small" title={data.alternatives.length <= MIN_ALTERNATIVES ? 'A TCO compares at least two alternatives' : 'Delete alternative'} aria-label="Delete alternative" disabled={data.alternatives.length <= MIN_ALTERNATIVES} onclick={() => deleteAlternative(a.id)}><Icon name="Trash2" size={14} /></button>
        </div>
        <label class="field">
          <span class="small muted">Architecture — what this alternative is (machines, where they are, how redundancy works)</span>
          <textarea rows="2" value={a.description} use:autosize={a.description} oninput={(e) => setAlt(a.id, { description: e.currentTarget.value }, `alt-desc:${a.id}`)}></textarea>
        </label>

        <div class="table-wrap">
          <table class="lines">
            <thead>
              <tr>
                <th class="c-name">Concepto</th>
                <th>Tipo</th>
                <th class="num">€ / unidad</th>
                <th class="num">Cant.</th>
                <th>Pago</th>
                <th class="num">Año</th>
                {#each yearIdx as i (i)}<th class="num yr">Año {i + 1}</th>{/each}
                <th class="num yr">Total</th>
                <th></th>
              </tr>
            </thead>
            {#each BLOCKS as b (b.key)}
              {@const rows = a.lines.filter((l) => l.block === b.key)}
              {@const sub = sums[altIndex]?.byBlock[b.key] ?? 0}
              <tbody>
                <tr class="block-row">
                  <th colspan={6} scope="rowgroup"><span class="bdot" style:background={b.color}></span>{b.label}</th>
                  {#each yearIdx as i (i)}<td class="num yr muted">{eur(sum(rows.map((l) => lineYears(l, years)[i])))}</td>{/each}
                  <td class="num yr"><strong>{eur(sub)}</strong></td>
                  <td></td>
                </tr>
                {#each rows as l (l.id)}
                  {@const ys = lineYears(l, years)}
                  <tr data-line={l.id}>
                    <td class="c-name">
                      <input type="text" value={l.name} placeholder="Concepto (modelo concreto)" aria-label="Concept" title={l.name} oninput={(e) => setLine(a.id, l.id, { name: e.currentTarget.value }, `ln:${l.id}`)} />
                      <input type="text" class="src" class:missing={!l.source.trim()} value={l.source} placeholder="Fuente del precio (enlace, tienda, calculadora)" aria-label="Source of the price" title={l.source} oninput={(e) => setLine(a.id, l.id, { source: e.currentTarget.value }, `src:${l.id}`)} />
                    </td>
                    <td>
                      <select value={l.nature} aria-label="CAPEX or OPEX" onchange={(e) => setLine(a.id, l.id, { nature: e.currentTarget.value as TcoLine['nature'] })}>
                        <option value="capex">CAPEX</option>
                        <option value="opex">OPEX</option>
                      </select>
                    </td>
                    <td class="num"><input type="text" inputmode="decimal" class="amount" class:unpriced={!l.unitCost} value={amountText(l.unitCost)} placeholder="0" aria-label="Price per unit (€)" use:numberField onchange={(e) => setLine(a.id, l.id, { unitCost: parseAmount(e.currentTarget.value) })} /></td>
                    <td class="num"><input type="text" inputmode="decimal" class="qty" value={amountText(l.qty)} placeholder="0" aria-label="Quantity" use:numberField onchange={(e) => setLine(a.id, l.id, { qty: parseAmount(e.currentTarget.value) })} /></td>
                    <td>
                      <select value={l.when} aria-label="Paid" onchange={(e) => setLine(a.id, l.id, { when: e.currentTarget.value as TcoLine['when'] })}>
                        {#each WHEN as w (w.key)}<option value={w.key}>{w.label}</option>{/each}
                      </select>
                    </td>
                    <td class="num">
                      <select value={l.year} aria-label={l.when === 'once' ? 'Year it is paid' : 'First year'} title={l.when === 'once' ? 'Year it is paid' : 'From this year on'} onchange={(e) => setLine(a.id, l.id, { year: +e.currentTarget.value })}>
                        {#each yearIdx as i (i)}<option value={i + 1}>{l.when === 'once' ? '' : '≥ '}{i + 1}</option>{/each}
                      </select>
                    </td>
                    {#each ys as v, i (i)}<td class="num yr" class:zero={!v}>{v ? eur(v) : '—'}</td>{/each}
                    <td class="num yr"><strong>{eur(sum(ys))}</strong></td>
                    <td class="acts">
                      <button class="icon small" aria-label="Move up" title="Move up" onclick={() => moveLine(a.id, l.id, -1)}><Icon name="ArrowUp" size={13} /></button>
                      <button class="icon small" aria-label="Move down" title="Move down" onclick={() => moveLine(a.id, l.id, 1)}><Icon name="ArrowDown" size={13} /></button>
                      <button class="icon small" aria-label="Delete line" title="Delete line" onclick={() => removeLine(a.id, l.id)}><Icon name="X" size={13} /></button>
                    </td>
                  </tr>
                {/each}
                <tr class="add-row">
                  <td colspan={8 + years}><button class="small quiet-btn" onclick={() => addLine(a.id, b.key)}><Icon name="Plus" size={13} /> Line in {b.short}</button></td>
                </tr>
              </tbody>
            {/each}
            <tfoot>
              <tr>
                <th colspan={6} scope="row">Total {a.name}</th>
                {#each yearIdx as i (i)}<td class="num yr"><strong>{eur(sums[altIndex]?.perYear[i] ?? 0)}</strong></td>{/each}
                <td class="num yr"><strong>{eur(sums[altIndex]?.total ?? 0)}</strong></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div class="row foot">
          <button class="small" onclick={() => addTemplate(a.id, templateFor(a))}><Icon name="ListPlus" size={14} /> Add typical {templateFor(a) === 'cloud' ? 'cloud' : 'local'} lines</button>
          <button class="small quiet-btn" onclick={() => addTemplate(a.id, templateFor(a) === 'cloud' ? 'local' : 'cloud')}><Icon name="ListPlus" size={14} /> …or {templateFor(a) === 'cloud' ? 'local' : 'cloud'} ones</button>
          <span class="spacer"></span>
          <span class="tiny muted">Typical lines come without prices: put real market prices (shop PVP, the cloud provider's calculator, salary tables) and their source. No inflation or discount rate, as in class.</span>
        </div>
      {:else}
        <!-- comparison -->
        <div class="compare stack">
          <div>
            <div class="sect">Qualitative comparison</div>
            <p class="small muted">Beyond the money: score each alternative from 1 (worst) to 5 (best) on what the client asked for. Weights are relative.</p>
          </div>
          {#if data.criteria.length}
            <table class="crit">
              <thead>
                <tr>
                  <th>Criterio</th>
                  <th class="num">Peso</th>
                  {#each data.alternatives as a (a.id)}<th class="num"><span class="dot" style:background={ac(a)}></span>{a.name}</th>{/each}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {#each data.criteria as c, ci (c.id)}
                  <tr>
                    <td><input type="text" value={c.name} aria-label="Criterion" oninput={(e) => app.change((d) => (td(d).criteria[ci].name = e.currentTarget.value), `crit:${c.id}`)} /></td>
                    <td class="num">
                      <input type="text" inputmode="decimal" class="qty" value={amountText(c.weight)} aria-label="Weight" use:numberField onchange={(e) => app.change((d) => (td(d).criteria[ci].weight = Math.max(0, parseAmount(e.currentTarget.value))))} />
                      <span class="tiny muted share">{Math.round(weightShare(data, c) * 100)} %</span>
                    </td>
                    {#each data.alternatives as a (a.id)}
                      {@const v = scoreOf(data, c.id, a.id)}
                      <td class="num">
                        <div class="seg scores" role="radiogroup" aria-label="{c.name} — {a.name}" style:--alt={ac(a)} style:--alt-ink={inkOn(ac(a))}>
                          {#each [1, 2, 3, 4, 5] as n (n)}
                            <button class:active={v === n} role="radio" aria-checked={v === n} onclick={() => setScore(c.id, a.id, v === n ? 0 : n)}>{n}</button>
                          {/each}
                        </div>
                      </td>
                    {/each}
                    <td class="acts">
                      <button class="icon small" aria-label="Move up" title="Move up" disabled={ci === 0} onclick={() => app.change((d) => moveItem(td(d).criteria, ci, -1))}><Icon name="ArrowUp" size={13} /></button>
                      <button class="icon small" aria-label="Delete criterion" title="Delete criterion" onclick={() => app.change((d) => removeCriterion(td(d), c.id))}><Icon name="X" size={13} /></button>
                    </td>
                  </tr>
                {/each}
              </tbody>
              <tfoot>
                <tr>
                  <th colspan="2" scope="row">Puntuación ponderada (de 5)</th>
                  {#each data.alternatives as a (a.id)}<td class="num"><strong>{weightedScore(data, a.id).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></td>{/each}
                  <td></td>
                </tr>
              </tfoot>
            </table>
          {/if}
          <div class="row">
            <button class="small" onclick={() => app.change((d) => void addCriterion(td(d)))}><Icon name="Plus" size={13} /> Criterion</button>
            {#if !data.criteria.length}<button class="small quiet-btn" onclick={suggestCriteria}><Icon name="ListPlus" size={13} /> Add the client's requirements as criteria</button>{/if}
          </div>

          <label class="field">
            <span class="sect">Recommendation</span>
            <span class="small muted">
              Reasoned: why this alternative for this client, not just the lower number.
              {#if best}<br />Cheapest over {years} years: <strong>{best.name}</strong>, {eur(best.saving)} less than {best.against}.{/if}
              {#if bestScore}{best ? ' ' : ''}Best on the criteria: <strong>{bestScore.name}</strong>.{/if}
            </span>
            <textarea rows="5" value={data.recommendation} use:autosize={data.recommendation} placeholder="Recomendamos… porque…" oninput={(e) => app.change((d) => (td(d).recommendation = e.currentTarget.value), 'tco-rec')}></textarea>
          </label>
        </div>
      {/if}
    </section>

    <!-- ───────────────────────────── summary (exported) ───────────────────────────── -->
    <article class="card" data-export-root>
      <header>
        <div class="kicker">Coste total de propiedad (TCO) · {years} {years === 1 ? 'año' : 'años'}</div>
        <h2>{title}</h2>
      </header>

      <table class="summary">
        <thead>
          <tr>
            <th>Alternativa</th>
            {#each yearIdx as i (i)}<th class="num">Año {i + 1}</th>{/each}
            <th class="num">Total</th>
            <th class="num">CAPEX</th>
            <th class="num">OPEX</th>
            {#if data.users > 0}<th class="num">Por usuario</th>{/if}
          </tr>
        </thead>
        <tbody>
          {#each sums as s (s.id)}
            <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
            <tr class:best={best?.id === s.id} class:cur={tab === s.id} class:hot={hoverAlt === s.id} tabindex="0" title="Open {s.name}" onclick={() => pickAlt(s.id)} onkeydown={(e) => keyPick(e, s.id)} onpointerenter={over(s.id)} onpointerleave={out(s.id)}>
              <th scope="row"><span class="dot" style:background={s.color}></span>{s.name}{#if best?.id === s.id}<span class="badge">más barata</span>{/if}</th>
              {#each s.perYear as v, i (i)}<td class="num">{eur(v)}</td>{/each}
              <td class="num total">{eur(s.total)}</td>
              <td class="num">{eur(s.capex)}</td>
              <td class="num">{eur(s.opex)}</td>
              {#if s.perUser !== null}<td class="num">{eur(s.perUser)}</td>{/if}
            </tr>
          {/each}
        </tbody>
      </table>
      {#if best}
        <p class="saving">A {years} {years === 1 ? 'año' : 'años'}, <strong>{best.name}</strong> cuesta {eur(best.saving)} menos que {best.against}.{#if best.unpriced}&nbsp;<span class="warn-note">Aún faltan {best.unpriced} precios: la comparación no es definitiva.</span>{/if}{#if data.users > 0}&nbsp;Calculado para {data.users} usuarios.{/if}</p>
      {/if}

      <figure class="chart">
        <figcaption>Coste por año (barras) y acumulado (líneas)</figcaption>
        <svg viewBox="0 0 {CH.w} {CH.h}" width={CH.w} height={CH.h} role="img" aria-label="Coste por año y acumulado">
          {#each ticks as t (t)}
            <line class="grid" x1={CH.left} x2={CH.w - CH.right} y1={yOf(t)} y2={yOf(t)} />
            <text class="tick" x={CH.left - 8} y={yOf(t) + 4} text-anchor="end">{short(t)}</text>
          {/each}
          {#each yearIdx as gi (gi)}
            {#each sums as s, ai (s.id)}
              {@const v = s.perYear[gi]}
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <rect
                class="bar pick"
                class:dim={hoverAlt && hoverAlt !== s.id}
                x={barX(gi, ai) + 2}
                y={yOf(v)}
                width={Math.max(0, barW - 4)}
                height={Math.max(0, CH.top + plotH - yOf(v))}
                rx="3"
                fill={s.color}
                onclick={() => pickAlt(s.id)}
                onpointerenter={over(s.id)}
                onpointerleave={out(s.id)}><title>{s.name} · año {gi + 1}: {eur(v)}</title></rect
              >
            {/each}
            <text class="tick" x={groupX(gi)} y={CH.h - 12} text-anchor="middle">Año {gi + 1}</text>
          {/each}
          {#each sums as s (s.id)}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <g class="series pick" class:dim={hoverAlt && hoverAlt !== s.id} class:hot={hoverAlt === s.id} onclick={() => pickAlt(s.id)} onpointerenter={over(s.id)} onpointerleave={out(s.id)}>
              <title>{s.name} · acumulado: {eur(s.total)}</title>
              <polyline class="hit" points={s.cumulative.map((v, i) => `${groupX(i)},${yOf(v)}`).join(' ')} />
              <polyline class="cum" points={s.cumulative.map((v, i) => `${groupX(i)},${yOf(v)}`).join(' ')} stroke={s.color} />
              {#each s.cumulative as v, i (i)}<circle cx={groupX(i)} cy={yOf(v)} r="4" fill="var(--panel)" stroke={s.color} stroke-width="2.5" />{/each}
              <text class="cum-label" x={groupX(years - 1) + 8} y={yOf(s.cumulative[years - 1] ?? 0) + 4} fill={s.color}>{short(s.total)}</text>
            </g>
          {/each}
          <line class="axis" x1={CH.left} x2={CH.w - CH.right} y1={CH.top + plotH} y2={CH.top + plotH} />
        </svg>
        <div class="legend row">
          {#each sums as s (s.id)}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <span class="row pick" class:hot={hoverAlt === s.id} onclick={() => pickAlt(s.id)} onpointerenter={over(s.id)} onpointerleave={out(s.id)}><span class="dot" style:background={s.color}></span>{s.name}</span>
          {/each}
        </div>
      </figure>

      <section class="blocks">
        <h3>Por bloque de coste</h3>
        {#each sums as s (s.id)}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
          <div class="block-bar pick" class:hot={hoverAlt === s.id} class:dim={hoverAlt && hoverAlt !== s.id} onclick={() => pickAlt(s.id)} onpointerenter={over(s.id)} onpointerleave={out(s.id)}>
            <div class="bb-name"><span class="dot" style:background={s.color}></span>{s.name}</div>
            <div class="bb-track">
              {#each BLOCKS as b (b.key)}
                {#if s.byBlock[b.key] > 0}
                  <span class="bb-seg" style:width="{(s.byBlock[b.key] / blockMax) * 100}%" style:background={b.color} title="{b.label}: {eur(s.byBlock[b.key])}"></span>
                {/if}
              {/each}
            </div>
            <div class="bb-total">{eur(s.total)}</div>
          </div>
        {/each}
        <table class="block-table">
          <thead>
            <tr><th>Bloque</th>{#each sums as s (s.id)}<th class="num">{s.name}</th>{/each}</tr>
          </thead>
          <tbody>
            {#each BLOCKS as b (b.key)}
              <tr><th scope="row"><span class="bdot" style:background={b.color}></span>{b.label}</th>{#each sums as s (s.id)}<td class="num">{eur(s.byBlock[b.key])}</td>{/each}</tr>
            {/each}
          </tbody>
        </table>
      </section>

      {#if data.alternatives.some((a) => a.description.trim())}
        <section class="archs">
          <h3>Arquitectura de cada alternativa</h3>
          <div class="arch-grid" style:grid-template-columns="repeat({Math.min(2, data.alternatives.length)}, 1fr)">
            {#each data.alternatives as a (a.id)}
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
              <div class="arch pick" class:hot={hoverAlt === a.id} style:border-top-color={ac(a)} title="Open {a.name}" onclick={() => pickAlt(a.id)} onpointerenter={over(a.id)} onpointerleave={out(a.id)}>
                <strong>{a.name}</strong>
                <p>{a.description.trim() || '—'}</p>
              </div>
            {/each}
          </div>
        </section>
      {/if}

      {#if data.criteria.length}
        <section>
          <h3>Comparación cualitativa <span class="h-note">puntuación 1–5, ponderada</span></h3>
          <table class="crit-out">
            <thead>
              <tr><th>Criterio</th><th class="num">Peso</th>{#each data.alternatives as a (a.id)}<th class="num">{a.name}</th>{/each}</tr>
            </thead>
            <tbody>
              {#each data.criteria as c (c.id)}
                <tr>
                  <th scope="row">{c.name}</th>
                  <td class="num">{Math.round(weightShare(data, c) * 100)} %</td>
                  {#each data.alternatives as a (a.id)}
                    {@const v = scoreOf(data, c.id, a.id)}
                    <td class="num"><span class="pips" aria-label="{v} de 5">{#each [1, 2, 3, 4, 5] as n (n)}<span class="pip" class:on={n <= v} style:--c={ac(a)}></span>{/each}</span></td>
                  {/each}
                </tr>
              {/each}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colspan="2">Puntuación ponderada</th>
                {#each data.alternatives as a (a.id)}<td class="num"><strong>{weightedScore(data, a.id).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> / 5</td>{/each}
              </tr>
            </tfoot>
          </table>
        </section>
      {/if}

      {#if data.recommendation.trim()}
        <section class="rec">
          <h3>Recomendación</h3>
          <p>{data.recommendation.trim()}</p>
        </section>
      {/if}
    </article>
  </div>
</div>

<style>
  .scroll-canvas {
    container-type: inline-size;
  }
  .page {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--sp-5);
    padding: var(--sp-5);
    min-width: max-content;
  }
  /* Narrower than the summary card: keep the editing card on screen, the summary scrolls. */
  @container (max-width: 960px) {
    .page {
      align-items: flex-start;
    }
  }
  .edit {
    /* Fits the window down to small laptops; the lines table scrolls on its own. */
    width: min(1180px, max(600px, calc(100cqw - 48px)));
    min-width: 0;
    padding: var(--sp-3) var(--sp-4) var(--sp-4);
    display: flex;
    flex-direction: column;
    gap: var(--sp-3);
  }
  .head {
    flex-wrap: wrap;
    gap: var(--sp-3);
  }
  .tabs-row {
    flex-wrap: wrap;
  }
  .tabs button {
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .settings {
    gap: var(--sp-3);
  }
  .tiny-field select {
    width: 64px;
    height: 28px;
    padding: 2px 6px;
  }
  .users {
    width: 64px !important;
    height: 28px;
    text-align: right;
  }
  .dot {
    display: inline-block;
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-right: 6px;
    vertical-align: 0;
  }
  .bdot {
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 2px;
    margin-right: 6px;
  }
  .totals {
    flex-wrap: wrap;
    gap: var(--sp-2);
  }
  .total-chip {
    display: inline-flex;
    align-items: center;
    gap: 0;
    height: auto;
    padding: 3px 10px;
    border-radius: var(--r-pill);
    background: var(--panel-2);
    color: var(--ink);
    font-size: var(--fs-sm);
  }
  .total-chip:hover {
    background: color-mix(in srgb, var(--ink) 9%, var(--panel-2));
  }
  .total-chip.cur {
    background: var(--selected);
  }
  .unpriced-note {
    margin-left: 5px;
    color: color-mix(in srgb, var(--warn) 80%, var(--ink));
  }
  .total-chip strong {
    margin-left: 4px;
  }
  .total-chip.best {
    box-shadow: inset 0 0 0 1.5px var(--ok);
  }
  .alt-head {
    gap: var(--sp-3);
    flex-wrap: wrap;
  }
  .alt-name {
    font-size: var(--fs-lg);
    font-weight: 700;
    width: 320px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--sp-1);
  }
  .table-wrap {
    overflow-x: auto;
    border: 1px solid var(--line);
    border-radius: var(--r-control);
  }
  table {
    border-collapse: collapse;
    font-size: var(--fs-sm);
  }
  .lines {
    width: 100%;
  }
  .lines th,
  .lines td {
    padding: 3px 4px;
    border-bottom: 1px solid var(--line);
    text-align: left;
    white-space: nowrap;
  }
  .lines thead th {
    position: sticky;
    top: 0;
    background: var(--panel-2);
    font-size: var(--fs-xs);
    font-weight: 700;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 6px 4px;
  }
  .lines input,
  .lines select,
  .crit input {
    height: 26px;
    padding: 2px 6px;
    font-size: var(--fs-sm);
    border-color: transparent;
    background: transparent;
  }
  .lines input:hover,
  .lines select:hover,
  .crit input:hover {
    border-color: var(--line);
  }
  .lines input:focus,
  .lines select:focus,
  .crit input:focus {
    border-color: var(--accent);
    background: var(--panel);
  }
  .c-name {
    min-width: 300px;
    width: 100%;
  }
  .c-name input {
    display: block;
    width: 100%;
  }
  .lines input.src {
    height: 20px;
    font-size: var(--fs-xs);
    color: var(--muted);
  }
  .lines input.src.missing {
    color: var(--faint);
  }
  .num {
    text-align: right !important;
  }
  .amount {
    width: 88px;
    text-align: right;
  }
  .warn-note {
    color: color-mix(in srgb, var(--warn) 80%, var(--ink));
  }
  /* A line without a price yet: amber until someone puts the market price in. */
  .amount.unpriced {
    background: color-mix(in srgb, var(--warn) 18%, transparent) !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--warn) 55%, transparent);
  }
  .qty {
    width: 56px;
    text-align: right;
  }
  .lines select {
    width: auto;
  }
  .yr {
    font-variant-numeric: tabular-nums;
    min-width: 76px;
  }
  .zero {
    color: var(--faint);
  }
  .block-row th,
  .block-row td {
    background: color-mix(in srgb, var(--ink) 3%, var(--panel));
    padding-top: 6px;
    padding-bottom: 6px;
  }
  .block-row th {
    font-weight: 700;
  }
  .add-row td {
    border-bottom: 1px solid var(--line);
    padding: 2px 4px 4px;
  }
  .quiet-btn {
    border-color: transparent;
    background: transparent;
    color: var(--muted);
  }
  .quiet-btn:hover {
    color: var(--ink);
  }
  .acts {
    width: 1%;
    white-space: nowrap;
  }
  .lines tbody tr:not(.block-row, .add-row) td {
    transition: background-color var(--t);
  }
  .lines tbody tr:not(.block-row, .add-row):hover td,
  .lines tbody tr:not(.block-row, .add-row):focus-within td {
    background: color-mix(in srgb, var(--ink) 4%, var(--panel));
  }
  .crit tbody tr:hover td {
    background: color-mix(in srgb, var(--ink) 4%, var(--panel));
  }
  .acts button {
    opacity: 0.35;
  }
  tr:hover .acts button,
  .acts button:focus-visible {
    opacity: 1;
  }
  tfoot th,
  tfoot td {
    padding: 8px 4px;
    font-weight: 700;
    border-bottom: 0;
  }
  .foot {
    flex-wrap: wrap;
  }
  .foot .tiny {
    max-width: 520px;
  }

  /* comparison */
  .crit {
    width: 100%;
  }
  .crit th,
  .crit td {
    padding: 4px 6px;
    border-bottom: 1px solid var(--line);
    text-align: left;
  }
  .crit thead th {
    font-size: var(--fs-xs);
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .crit td:first-child {
    min-width: 260px;
  }
  .share {
    display: inline-block;
    width: 34px;
  }
  .scores button {
    width: 26px;
    padding: 0;
    justify-content: center;
  }
  /* A score is drawn in its alternative's colour, as in the chart and the summary. */
  .scores button.active,
  .scores button.active:hover {
    background: var(--alt);
    color: var(--alt-ink);
  }

  /* ───────── summary card ───────── */
  .card {
    width: 860px;
    flex: none;
    padding: 28px 32px 32px;
    background: var(--panel);
    border: 1px solid var(--line);
    border-radius: var(--r-card);
    color: var(--ink);
  }
  :global(.exporting) .card {
    border-radius: 0;
    border-color: transparent;
  }
  .kicker {
    font-size: var(--fs-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  h2 {
    margin: 4px 0 18px;
    font-size: 22px;
  }
  h3 {
    margin: 26px 0 10px;
    font-size: 15px;
  }
  .h-note {
    font-weight: 400;
    font-size: var(--fs-sm);
    color: var(--muted);
    margin-left: 6px;
  }
  .summary,
  .block-table,
  .crit-out {
    width: 100%;
    font-size: var(--fs-md);
  }
  .summary th,
  .summary td,
  .block-table th,
  .block-table td,
  .crit-out th,
  .crit-out td {
    padding: 7px 8px;
    border-bottom: 1px solid var(--line);
    text-align: left;
    font-variant-numeric: tabular-nums;
  }
  .summary thead th,
  .block-table thead th,
  .crit-out thead th {
    font-size: var(--fs-xs);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--muted);
    border-bottom: 2px solid var(--ink-2);
  }
  .summary tbody th,
  .block-table tbody th,
  .crit-out tbody th {
    font-weight: 400;
  }
  .summary .total {
    font-weight: 700;
  }
  /* The summary is a way in: a row, a bar, a line or a legend entry opens that alternative.
     Hover and the open one show on screen only; the exported card stays plain. */
  .pick {
    cursor: pointer;
  }
  .summary tbody tr {
    transition: background-color var(--t);
  }
  .summary tbody tr:focus-visible {
    outline-offset: -2px;
  }
  :global(html:not(.exporting)) .summary tbody tr:is(:hover, .hot) {
    background: var(--hover);
  }
  :global(html:not(.exporting)) .summary tbody tr.cur {
    background: var(--selected);
  }
  :global(html:not(.exporting)) .summary tbody tr.cur th:first-child {
    box-shadow: inset 3px 0 0 var(--accent);
  }
  .bar,
  .series,
  .block-bar,
  .legend .row,
  .arch {
    transition: opacity var(--t), background-color var(--t), border-color var(--t);
  }
  :global(html:not(.exporting)) .chart .dim,
  :global(html:not(.exporting)) .block-bar.dim {
    opacity: 0.3;
  }
  .series .hit {
    fill: none;
    stroke: transparent;
    stroke-width: 14;
  }
  :global(html:not(.exporting)) .series.hot .cum {
    stroke-width: 3.5;
  }
  :global(html:not(.exporting)) .legend .row:is(:hover, .hot) {
    color: var(--ink);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  :global(html:not(.exporting)) .arch:is(:hover, .hot) {
    border-color: color-mix(in srgb, var(--ink) 30%, var(--line));
    background: color-mix(in srgb, var(--ink) 3%, var(--panel));
  }
  .summary tr.best th,
  .summary tr.best .total {
    font-weight: 700;
  }
  .summary thead th {
    white-space: nowrap;
  }
  .badge {
    white-space: nowrap;
    margin-left: 8px;
    padding: 1px 7px;
    border-radius: var(--r-pill);
    font-size: var(--fs-xs);
    font-weight: 700;
    color: #fff;
    background: var(--ok);
  }
  .saving {
    margin: 10px 0 0;
    font-size: var(--fs-md);
    color: var(--ink-2);
  }
  .chart {
    margin: 22px 0 0;
  }
  .chart figcaption {
    font-size: 15px;
    font-weight: 700;
    margin-bottom: 8px;
  }
  .chart svg {
    display: block;
    font-family: var(--font);
  }
  .grid {
    stroke: var(--line);
    stroke-width: 1;
  }
  .axis {
    stroke: var(--ink-2);
    stroke-width: 1.5;
  }
  .tick {
    font-size: 11.5px;
    fill: var(--muted);
  }
  .cum {
    fill: none;
    stroke-width: 2.5;
    stroke-dasharray: 6 4;
  }
  .cum-label {
    font-size: 12px;
    font-weight: 700;
  }
  .legend {
    gap: var(--sp-4);
    font-size: var(--fs-sm);
    color: var(--ink-2);
    margin-top: 4px;
    padding-left: 74px;
  }
  .legend .row {
    gap: 0;
  }
  .block-bar {
    display: grid;
    grid-template-columns: 210px 1fr 96px;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
    font-size: var(--fs-md);
  }
  .bb-name {
    display: flex;
    align-items: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .bb-track {
    display: flex;
    height: 18px;
    border-radius: 4px;
    overflow: hidden;
    background: var(--panel-2);
  }
  .bb-seg {
    display: block;
    height: 100%;
  }
  .bb-seg + .bb-seg {
    border-left: 2px solid var(--panel);
  }
  .bb-total {
    text-align: right;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .block-table {
    margin-top: 10px;
  }
  .arch-grid {
    display: grid;
    gap: 14px;
  }
  .arch {
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-top: 4px solid var(--ink-2);
    border-radius: var(--r-control);
    font-size: var(--fs-md);
  }
  .arch p {
    margin: 6px 0 0;
    line-height: 1.5;
    color: var(--ink-2);
  }
  .crit-out tfoot th,
  .crit-out tfoot td {
    padding: 8px;
    border-bottom: 0;
  }
  .pips {
    display: inline-flex;
    gap: 3px;
  }
  .pip {
    width: 11px;
    height: 11px;
    border-radius: 50%;
    border: 1.5px solid var(--c);
  }
  .pip.on {
    background: var(--c);
  }
  .rec p {
    margin: 0;
    padding: 12px 14px;
    border-left: 4px solid var(--ok);
    background: color-mix(in srgb, var(--ok) 8%, var(--panel));
    border-radius: 0 var(--r-control) var(--r-control) 0;
    line-height: 1.55;
    font-size: var(--fs-md);
    white-space: pre-wrap;
  }
</style>
