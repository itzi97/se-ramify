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
        <p class="small muted">Geoffrey Moore's template for the product vision. Fill each blank; the card on the right reads it back as one sentence.</p>
      </div>
      {#each VISION_FIELDS as f (f.key)}
        <label class="field">
          {f.label}
          <textarea id="vision-{f.key}" rows="2" placeholder={f.hint} value={data[f.key]} oninput={(e) => set(f.key, e.currentTarget.value)}></textarea>
        </label>
      {/each}
      <p class="tiny muted">{filled} of {VISION_FIELDS.length} filled.</p>
    </form>

    <div class="card-col">
      <article class="card" data-export-root>
        <header>
          <div class="kicker">Visión del producto</div>
          <h2>{data.product.trim() || doc.title}</h2>
        </header>
        <p class="pitch">{#each pieces as p, i (i)}{#if p.t === 'lead'}{p.text}{:else}<span class="blank" class:empty={p.empty} role="button" tabindex="0" onclick={() => focusField(p.key)} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), focusField(p.key))}>{p.text}</span>{/if}{/each}</p>
        <table>
          <tbody>
            {#each VISION_FIELDS as f (f.key)}
              <tr>
                <th scope="row">{f.lead.replace(/^./, (c) => c.toUpperCase())}</th>
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
  .wrap {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-5);
    padding: var(--sp-5);
    min-width: max-content;
  }
  .form {
    width: 380px;
    flex: none;
    padding: var(--sp-4);
  }
  .card-col {
    flex: none;
  }
  .card {
    width: 660px;
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
    text-underline-offset: 4px;
    cursor: text;
  }
  .blank.empty {
    font-weight: 400;
    font-style: italic;
    color: var(--muted);
    text-decoration-style: dashed;
    text-decoration-color: var(--muted);
  }
  .blank:hover {
    background: var(--hover);
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
    color: var(--faint);
  }
  @media (max-width: 1180px) {
    .wrap {
      flex-direction: column;
      min-width: 0;
    }
  }
</style>
