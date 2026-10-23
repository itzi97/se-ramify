<script lang="ts">
  import { app } from '../../stores/app.svelte';
  import type { DiagramOf, VisionData } from '../../model/types';
  import { VISION_FIELDS, visionPieces } from './text';

  const doc = $derived(app.docOf('vision'));
  const data = $derived(doc.data);
  const pieces = $derived(visionPieces(data));
  const filled = $derived(VISION_FIELDS.filter((f) => data[f.key]?.trim()).length);

  function set(key: keyof VisionData, value: string) {
    app.change((d) => ((d as DiagramOf<'vision'>).data[key] = value), `vision-${key}`);
  }

  /** The field being typed in, and the one under the pointer (in the form, the sentence or the table): lit in all three. */
  let active = $state<keyof VisionData | null>(null);
  let hoverKey = $state<keyof VisionData | null>(null);
  const hoverOn = (k: keyof VisionData) => () => (hoverKey = k);
  const hoverOff = (k: keyof VisionData) => () => hoverKey === k && (hoverKey = null);

  function focusField(key: keyof VisionData) {
    const el = document.getElementById(`vision-${key}`) as HTMLTextAreaElement | null;
    el?.focus();
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
</script>

<div class="scroll-canvas">
  <div class="wrap">
    <form class="form float stack" onsubmit={(e) => e.preventDefault()} aria-label="Elevator pitch">
      <div>
        <div class="sect">Elevator pitch</div>
        <p class="small muted">Geoffrey Moore's template for the product vision. Fill each blank; the card reads it back as one sentence.</p>
      </div>
      {#each VISION_FIELDS as f (f.key)}
        <label class="field" class:hot={hoverKey === f.key} class:on={active === f.key} onpointerenter={hoverOn(f.key)} onpointerleave={hoverOff(f.key)}>
          <span class="flabel"><span class="state" class:done={!!data[f.key]?.trim()}></span>{f.label}</span>
          <textarea
            id="vision-{f.key}"
            rows="2"
            placeholder="e.g. {f.hint}"
            value={data[f.key]}
            oninput={(e) => set(f.key, e.currentTarget.value)}
            onfocus={() => (active = f.key)}
            onblur={() => active === f.key && (active = null)}
          ></textarea>
        </label>
      {/each}
      <div class="progress">
        {#each VISION_FIELDS as f (f.key)}
          <button
            type="button"
            class="bar"
            class:done={!!data[f.key]?.trim()}
            class:hot={hoverKey === f.key || active === f.key}
            title="{f.label}{data[f.key]?.trim() ? '' : ' · still empty'}"
            aria-label="{f.label}{data[f.key]?.trim() ? '' : ', empty'}"
            onclick={() => focusField(f.key)}
            onpointerenter={hoverOn(f.key)}
            onpointerleave={hoverOff(f.key)}
          ></button>
        {/each}
        <span class="tiny muted">{filled} of {VISION_FIELDS.length} filled{filled === VISION_FIELDS.length ? '' : ' · click a gap to fill it'}.</span>
      </div>
    </form>

    <div class="card-col">
      <article class="card" data-export-root>
        <header>
          <div class="kicker">Visión del producto</div>
          <h2>{data.product.trim() || doc.title}</h2>
        </header>
        <p class="pitch">{#each pieces as p, i (i)}{#if p.t === 'lead'}{p.text}{:else}<span class="blank" class:empty={p.empty} class:on={active === p.key} class:hot={hoverKey === p.key} role="button" tabindex="0" title="Click to edit" onclick={() => focusField(p.key)} onpointerenter={hoverOn(p.key)} onpointerleave={hoverOff(p.key)} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), focusField(p.key))}>{p.text}</span>{/if}{/each}</p>
        <table>
          <tbody>
            {#each VISION_FIELDS as f (f.key)}
              <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
              <tr class:on={active === f.key} class:hot={hoverKey === f.key} onclick={() => focusField(f.key)} onpointerenter={hoverOn(f.key)} onpointerleave={hoverOff(f.key)}>
                <th scope="row">{(f.lead || 'Producto').replace(/^./, (c) => c.toUpperCase())}</th>
                <td class:missing={!data[f.key]?.trim()}>{data[f.key]?.trim() || '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </article>
    </div>
  </div>
</div>

<style>
  .scroll-canvas {
    container-type: inline-size;
  }
  .wrap {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-5);
    padding: var(--sp-5);
    min-width: max-content;
  }
  .form {
    width: 340px;
    flex: none;
    padding: var(--sp-4);
  }
  .card-col {
    flex: 0 1 660px;
    min-width: 440px;
    position: sticky;
    top: var(--sp-5);
  }
  .card {
    width: 100%;
    padding: 36px 40px 32px;
    background: var(--d-fill);
    color: var(--d-ink);
    border: 1px solid var(--line);
    border-radius: var(--r-card);
    box-shadow: var(--shadow);
  }
  header {
    margin-bottom: var(--sp-4);
  }
  .kicker {
    font-size: var(--fs-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  h2 {
    margin: 4px 0 0;
    font-size: 24px;
    line-height: 1.2;
  }
  .pitch {
    margin: 0 0 var(--sp-5);
    font-size: 19px;
    line-height: 1.6;
  }
  .blank {
    border-radius: 3px;
    font-weight: 700;
    color: var(--d-ink);
    text-decoration: underline;
    text-decoration-color: var(--line);
    text-decoration-thickness: 2px;
    text-underline-offset: 5px;
    cursor: pointer;
    transition: background-color var(--t), text-decoration-color var(--t);
  }
  .blank.empty {
    font-weight: 400;
    font-style: italic;
    color: var(--muted);
    text-decoration-style: dashed;
    text-decoration-color: color-mix(in srgb, var(--warn) 70%, transparent);
  }
  /* Hover (or hovering its field or row) shows the blank can be clicked: accent underline and a wash.
     The blank being typed in keeps the wash. None of it reaches the exported card. */
  .blank:hover,
  .blank.hot {
    text-decoration-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 9%, transparent);
  }
  .blank.on {
    text-decoration-color: var(--accent);
    background: var(--selected);
  }
  :global(html.exporting) .blank {
    background: none;
    text-decoration-color: var(--line);
  }
  :global(html.exporting) .blank.empty {
    text-decoration-color: var(--muted);
  }
  .flabel {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    transition: color var(--t);
  }
  /* Each field says whether it's filled: green when it is, amber while it's empty. */
  .state {
    flex: none;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--warn);
  }
  .state.done {
    background: var(--ok);
  }
  .field.hot .flabel,
  .field.on .flabel {
    color: var(--accent);
  }
  .field.hot textarea {
    border-color: var(--accent);
  }
  .progress {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 3px;
  }
  .progress .tiny {
    flex-basis: 100%;
    margin-top: 2px;
  }
  .bar {
    width: 36px;
    height: 14px;
    padding: 0;
    border-radius: var(--r-control);
  }
  .bar::before {
    content: '';
    display: block;
    width: 100%;
    height: 6px;
    border-radius: 3px;
    background: color-mix(in srgb, var(--warn) 45%, transparent);
    transition: background-color var(--t), box-shadow var(--t);
  }
  .bar.done::before {
    background: var(--ok);
  }
  .bar:hover,
  .bar.hot {
    background: transparent;
  }
  .bar:hover::before,
  .bar.hot::before {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 45%, transparent);
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
  th {
    width: 150px;
    font-weight: 700;
    color: var(--ink-2);
    white-space: nowrap;
  }
  td.missing {
    color: var(--warn);
  }
  tr {
    cursor: pointer;
    transition: background-color var(--t);
  }
  tr:hover,
  tr.hot {
    background: var(--hover);
  }
  tr.on {
    background: var(--selected);
  }
  :global(html.exporting) tr {
    background: none;
  }
  :global(html.exporting) td.missing {
    color: var(--faint);
  }
  .wrap {
    min-width: 0;
  }
  /* Form above the card only when the editor itself is narrow; at 1280 px with the list open they stay side by side. */
  @container (max-width: 860px) {
    .wrap {
      flex-direction: column;
    }
    .card-col {
      position: static;
      width: min(660px, 100%);
      min-width: 0;
    }
  }
</style>
