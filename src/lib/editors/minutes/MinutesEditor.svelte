<script lang="ts">
  import { tick } from 'svelte';
  import { app } from '../../stores/app.svelte';
  import type { MinutesData, MinutesType } from '../../model/types';
  import Icon from '../../components/Icon.svelte';
  import DateField from '../gantt/DateField.svelte';
  import { autosize } from '../board/actions';
  import {
    MINUTES_TYPES,
    REVIEW_AREAS,
    REVIEW_KINDS,
    addRow,
    agendaIsTemplate,
    heading,
    longDate,
    missing,
    moveRow,
    normMinutes,
    removeRow,
    resetAgenda,
    reviewGroups,
    setType,
    shortDate,
    timeRange,
    typeInfo,
    updateRow,
    type ListKey
  } from './model';

  /**
   * An acta: the form on the left writes it, the document on the right is
   * what gets exported (PNG / SVG) and read in the memoria.
   */

  const doc = $derived(app.docOf('minutes'));
  const d = $derived(normMinutes(doc.data));
  const info = $derived(typeInfo(d.type));
  const todo = $derived(missing(d));
  const present = $derived(d.attendees.filter((a) => a.name.trim() && a.present));
  const absent = $derived(d.attendees.filter((a) => a.name.trim() && !a.present));
  const agenda = $derived(d.agenda.filter((a) => a.text.trim()));
  const decisions = $derived(d.decisions.filter((a) => a.text.trim()));
  const actions = $derived(d.actions.filter((a) => a.text.trim()));
  const questions = $derived(d.questions.filter((q) => q.text.trim()));
  const groups = $derived(reviewGroups(d));
  const hasReview = $derived(info.review && d.review.some((r) => r.text.trim()));

  /** Focus this row's first field after it renders. */
  let focusId = $state<string | null>(null);

  const md = (x: { data: unknown }) => x.data as MinutesData;

  function edit(fn: (m: MinutesData) => void, key?: string) {
    app.change((x) => {
      // Heal a half-written file on the first edit.
      const m = normMinutes(md(x));
      Object.assign(md(x), m);
      fn(md(x));
    }, key);
  }

  function set<K extends 'number' | 'date' | 'start' | 'end' | 'place' | 'discussion' | 'next'>(k: K, v: string) {
    edit((m) => (m[k] = v), `minutes-${k}`);
  }

  function add(key: ListKey, extra: Record<string, unknown> = {}) {
    let id = '';
    edit((m) => (id = addRow(m, key, extra as never)));
    focusId = id;
  }

  function upd(key: ListKey, id: string, patch: Record<string, unknown>, field: string) {
    edit((m) => updateRow(m, key, id, patch as never), `minutes-${key}-${id}-${field}`);
  }

  function del(key: ListKey, id: string) {
    edit((m) => removeRow(m, key, id));
  }

  function changeType(t: MinutesType) {
    edit((m) => setType(m, t));
  }

  /** Enter in a one-line row adds the next row; Backspace in an empty one removes it. */
  function rowKeys(e: KeyboardEvent, key: ListKey, id: string, empty: boolean, extra: Record<string, unknown> = {}) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      add(key, extra);
    } else if (e.key === 'Backspace' && empty) {
      e.preventDefault();
      // Keep the keyboard in the form: land on the field before the removed row.
      const form = (e.currentTarget as HTMLElement).closest('form');
      const fields = form ? [...form.querySelectorAll<HTMLElement>('input:not([type=checkbox]), textarea, select')] : [];
      const row = (e.currentTarget as HTMLElement).parentElement;
      const before = fields.filter((f) => !row?.contains(f) && f.compareDocumentPosition(e.currentTarget as Node) & Node.DOCUMENT_POSITION_FOLLOWING);
      const target = before[before.length - 1];
      del(key, id);
      void tick().then(() => target?.focus());
    }
  }

  function focusIf(node: HTMLElement, id: string) {
    if (focusId === id) {
      queueMicrotask(() => node.focus());
      focusId = null;
    }
  }
</script>

<div class="scroll-canvas">
  <div class="wrap">
    <form class="form float stack" onsubmit={(e) => e.preventDefault()} aria-label="Meeting minutes">
      <section class="stack">
        <div class="sect">Meeting</div>
        <label class="field">
          Type
          <select value={d.type} onchange={(e) => changeType(e.currentTarget.value as MinutesType)}>
            {#each MINUTES_TYPES as t (t.type)}<option value={t.type}>{t.label} — {t.title}</option>{/each}
          </select>
        </label>
        <div class="grid2">
          <label class="field">Number <input type="text" placeholder="1" value={d.number} oninput={(e) => set('number', e.currentTarget.value)} /></label>
          <label class="field">Date <DateField label="Date" value={d.date} onCommit={(iso) => set('date', iso)} /></label>
          <label class="field">Starts <input type="text" placeholder="17:00" value={d.start} oninput={(e) => set('start', e.currentTarget.value)} /></label>
          <label class="field">Ends <input type="text" placeholder="18:00" value={d.end} oninput={(e) => set('end', e.currentTarget.value)} /></label>
        </div>
        <label class="field">Place <input type="text" placeholder="Sala de reuniones, Teams…" value={d.place} oninput={(e) => set('place', e.currentTarget.value)} /></label>
      </section>

      <section class="stack">
        <div class="sect">Attendees</div>
        {#each d.attendees as a (a.id)}
          <div class="line">
            <input use:focusIf={a.id} type="text" class="grow" placeholder="Nombre" aria-label="Name" value={a.name} oninput={(e) => upd('attendees', a.id, { name: e.currentTarget.value }, 'name')} onkeydown={(e) => rowKeys(e, 'attendees', a.id, !a.name && !a.role)} />
            <input type="text" class="grow" placeholder="Rol" aria-label="Role" value={a.role} oninput={(e) => upd('attendees', a.id, { role: e.currentTarget.value }, 'role')} onkeydown={(e) => rowKeys(e, 'attendees', a.id, false)} />
            <label class="check" title="Attended"><input type="checkbox" checked={a.present} onchange={(e) => upd('attendees', a.id, { present: e.currentTarget.checked }, 'present')} /> Present</label>
            <button type="button" class="icon small" aria-label="Remove attendee" onclick={() => del('attendees', a.id)}><Icon name="X" size={14} /></button>
          </div>
        {/each}
        <button type="button" class="secondary small add" onclick={() => add('attendees')}><Icon name="Plus" size={14} /> Attendee</button>
      </section>

      <section class="stack">
        <div class="row between">
          <div class="sect">Agenda</div>
          {#if !agendaIsTemplate(d)}
            <button type="button" class="inline tiny" onclick={() => edit((m) => resetAgenda(m))} title="Replace the agenda with the {info.label.toLowerCase()} template">Use template</button>
          {/if}
        </div>
        {#each d.agenda as a, i (a.id)}
          <div class="line">
            <span class="num">{i + 1}.</span>
            <input use:focusIf={a.id} type="text" class="grow" aria-label="Agenda item {i + 1}" value={a.text} oninput={(e) => upd('agenda', a.id, { text: e.currentTarget.value }, 'text')} onkeydown={(e) => rowKeys(e, 'agenda', a.id, !a.text)} />
            <button type="button" class="icon small" aria-label="Move up" disabled={i === 0} onclick={() => edit((m) => moveRow(m, 'agenda', a.id, -1))}><Icon name="ChevronUp" size={14} /></button>
            <button type="button" class="icon small" aria-label="Move down" disabled={i === d.agenda.length - 1} onclick={() => edit((m) => moveRow(m, 'agenda', a.id, 1))}><Icon name="ChevronDown" size={14} /></button>
            <button type="button" class="icon small" aria-label="Remove item" onclick={() => del('agenda', a.id)}><Icon name="X" size={14} /></button>
          </div>
        {/each}
        <button type="button" class="secondary small add" onclick={() => add('agenda')}><Icon name="Plus" size={14} /> Item</button>
      </section>

      <section class="stack">
        <div class="sect">Discussion</div>
        <textarea use:autosize={d.discussion} rows="4" placeholder="Qué se habló, punto por punto." aria-label="Discussion" value={d.discussion} oninput={(e) => set('discussion', e.currentTarget.value)}></textarea>
      </section>

      {#if info.questions}
        <section class="stack">
          <div class="sect">Questions and answers</div>
          {#each d.questions as q, i (q.id)}
            <div class="qa stack">
              <div class="line">
                <span class="num">{i + 1}.</span>
                <input use:focusIf={q.id} type="text" class="grow" placeholder="Pregunta al cliente" aria-label="Question {i + 1}" value={q.text} oninput={(e) => upd('questions', q.id, { text: e.currentTarget.value }, 'text')} />
                <button type="button" class="icon small" aria-label="Remove question" onclick={() => del('questions', q.id)}><Icon name="X" size={14} /></button>
              </div>
              <textarea use:autosize={q.answer} rows="1" placeholder="Respuesta" aria-label="Answer {i + 1}" value={q.answer} oninput={(e) => upd('questions', q.id, { answer: e.currentTarget.value }, 'answer')}></textarea>
            </div>
          {/each}
          <button type="button" class="secondary small add" onclick={() => add('questions')}><Icon name="Plus" size={14} /> Question</button>
        </section>
      {/if}

      {#if info.review}
        <section class="stack">
          <div class="sect">Review — team and methodology</div>
          {#each REVIEW_KINDS as k (k.kind)}
            <div class="stack tight">
              <div class="small strong">{k.es} <span class="muted">· {k.label.toLowerCase()}</span></div>
              {#each d.review.filter((r) => r.kind === k.kind) as r (r.id)}
                <div class="line">
                  <textarea use:focusIf={r.id} use:autosize={r.text} rows="1" class="grow" aria-label="{k.label} item" value={r.text} oninput={(e) => upd('review', r.id, { text: e.currentTarget.value }, 'text')} onkeydown={(e) => rowKeys(e, 'review', r.id, !r.text, { kind: k.kind, area: r.area })}></textarea>
                  <div class="seg mini" role="radiogroup" aria-label="Area">
                    {#each REVIEW_AREAS as a (a.area)}
                      <button type="button" role="radio" aria-checked={r.area === a.area} class:active={r.area === a.area} onclick={() => upd('review', r.id, { area: a.area }, 'area')}>{a.es}</button>
                    {/each}
                  </div>
                  <button type="button" class="icon small" aria-label="Remove item" onclick={() => del('review', r.id)}><Icon name="X" size={14} /></button>
                </div>
              {/each}
              <div class="row">
                {#each REVIEW_AREAS as a (a.area)}
                  <button type="button" class="secondary small" onclick={() => add('review', { kind: k.kind, area: a.area })}><Icon name="Plus" size={14} /> {a.es}</button>
                {/each}
              </div>
            </div>
          {/each}
        </section>
      {/if}

      <section class="stack">
        <div class="sect">Decisions</div>
        {#each d.decisions as x, i (x.id)}
          <div class="line">
            <span class="num">{i + 1}.</span>
            <textarea use:focusIf={x.id} use:autosize={x.text} rows="1" class="grow" aria-label="Decision {i + 1}" value={x.text} oninput={(e) => upd('decisions', x.id, { text: e.currentTarget.value }, 'text')} onkeydown={(e) => rowKeys(e, 'decisions', x.id, !x.text)}></textarea>
            <button type="button" class="icon small" aria-label="Remove decision" onclick={() => del('decisions', x.id)}><Icon name="X" size={14} /></button>
          </div>
        {/each}
        <button type="button" class="secondary small add" onclick={() => add('decisions')}><Icon name="Plus" size={14} /> Decision</button>
      </section>

      <section class="stack">
        <div class="sect">Actions</div>
        {#each d.actions as a (a.id)}
          <div class="action stack tight">
            <div class="line">
              <input type="checkbox" checked={a.done} aria-label="Done" onchange={(e) => upd('actions', a.id, { done: e.currentTarget.checked }, 'done')} />
              <textarea use:focusIf={a.id} use:autosize={a.text} rows="1" class="grow" placeholder="Qué hay que hacer" aria-label="Action" value={a.text} oninput={(e) => upd('actions', a.id, { text: e.currentTarget.value }, 'text')}></textarea>
              <button type="button" class="icon small" aria-label="Remove action" onclick={() => del('actions', a.id)}><Icon name="X" size={14} /></button>
            </div>
            <div class="line indent">
              <input type="text" class="grow" placeholder="Responsable" aria-label="Owner" value={a.owner} oninput={(e) => upd('actions', a.id, { owner: e.currentTarget.value }, 'owner')} />
              <DateField cls="due" label="Due date" value={a.due} onCommit={(iso) => upd('actions', a.id, { due: iso }, 'due')} />
            </div>
          </div>
        {/each}
        <button type="button" class="secondary small add" onclick={() => add('actions')}><Icon name="Plus" size={14} /> Action</button>
      </section>

      <section class="stack">
        <div class="sect">Next meeting</div>
        <input type="text" placeholder="Fecha, hora, lugar y tema" aria-label="Next meeting" value={d.next} oninput={(e) => set('next', e.currentTarget.value)} />
      </section>

      <section class="check-list stack tight" aria-live="polite">
        {#if todo.length}
          <div class="small strong">Still missing</div>
          <ul class="small">{#each todo as t (t)}<li>{t}</li>{/each}</ul>
        {:else}
          <div class="small ok"><Icon name="Check" size={14} /> Nothing missing.</div>
        {/if}
      </section>
    </form>

    <div class="doc-col">
      <article class="acta" data-export-root lang="es">
        <header>
          <div class="kicker">{doc.title}</div>
          <h1>{heading(d)}</h1>
          <table class="meta">
            <tbody>
              <tr><th scope="row">Fecha</th><td>{longDate(d.date) || '—'}</td></tr>
              <tr><th scope="row">Hora</th><td>{timeRange(d) || '—'}</td></tr>
              <tr><th scope="row">Lugar</th><td>{d.place.trim() || '—'}</td></tr>
            </tbody>
          </table>
        </header>

        {#if present.length || absent.length}
          <section class="cols">
            {#if present.length}
              <div>
                <h2>Asistentes</h2>
                <ul class="people">{#each present as a (a.id)}<li><strong>{a.name}</strong>{#if a.role.trim()}<span class="role">{a.role}</span>{/if}</li>{/each}</ul>
              </div>
            {/if}
            {#if absent.length}
              <div>
                <h2>Ausentes</h2>
                <ul class="people">{#each absent as a (a.id)}<li><strong>{a.name}</strong>{#if a.role.trim()}<span class="role">{a.role}</span>{/if}</li>{/each}</ul>
              </div>
            {/if}
          </section>
        {/if}

        {#if agenda.length}
          <section>
            <h2>Orden del día</h2>
            <ol>{#each agenda as a (a.id)}<li>{a.text}</li>{/each}</ol>
          </section>
        {/if}

        {#if d.discussion.trim()}
          <section>
            <h2>Desarrollo de la reunión</h2>
            {#each d.discussion.trim().split(/\n\s*\n/) as p, i (i)}<p class="para">{p}</p>{/each}
          </section>
        {/if}

        {#if info.questions && questions.length}
          <section>
            <h2>Preguntas y respuestas</h2>
            <ol class="qa-list">
              {#each questions as q (q.id)}
                <li><div class="q">{q.text}</div><div class="a" class:pending={!q.answer.trim()}>{q.answer.trim() || 'Pendiente de respuesta.'}</div></li>
              {/each}
            </ol>
          </section>
        {/if}

        {#if hasReview}
          <section>
            <h2>Valoración</h2>
            <table class="review">
              <thead><tr><th></th>{#each groups as g (g.area)}<th scope="col">{g.es}</th>{/each}</tr></thead>
              <tbody>
                {#each REVIEW_KINDS as k, ki (k.kind)}
                  <tr class={k.kind}>
                    <th scope="row">{k.es}</th>
                    {#each groups as g (g.area)}
                      <td>
                        {#if g.kinds[ki].items.length}<ul>{#each g.kinds[ki].items as r (r.id)}<li>{r.text}</li>{/each}</ul>{:else}<span class="none">—</span>{/if}
                      </td>
                    {/each}
                  </tr>
                {/each}
              </tbody>
            </table>
          </section>
        {/if}

        {#if decisions.length}
          <section>
            <h2>Acuerdos</h2>
            <ol>{#each decisions as x (x.id)}<li>{x.text}</li>{/each}</ol>
          </section>
        {/if}

        {#if actions.length}
          <section>
            <h2>Acciones</h2>
            <table class="actions">
              <thead><tr><th scope="col">Acción</th><th scope="col">Responsable</th><th scope="col">Fecha límite</th><th scope="col">Estado</th></tr></thead>
              <tbody>
                {#each actions as a (a.id)}
                  <tr><td>{a.text}</td><td>{a.owner || '—'}</td><td class="nowrap">{shortDate(a.due) || '—'}</td><td class="nowrap">{a.done ? 'Hecha' : 'Pendiente'}</td></tr>
                {/each}
              </tbody>
            </table>
          </section>
        {/if}

        {#if d.next.trim()}
          <section>
            <h2>Próxima reunión</h2>
            <p class="para">{d.next}</p>
          </section>
        {/if}
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
    width: 400px;
    flex: none;
    padding: var(--sp-4);
    gap: var(--sp-5);
  }
  section.stack {
    gap: var(--sp-2);
  }
  .stack.tight {
    gap: var(--sp-1);
  }
  .grid2 {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-2);
  }
  .line {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .line.indent {
    padding-left: 22px;
  }
  .line > input[type='text'],
  .line > textarea {
    min-width: 0;
  }
  .line:has(> textarea) {
    align-items: flex-start;
  }
  .line > textarea {
    resize: none;
    overflow: hidden;
  }
  .line:has(> textarea) > :not(textarea) {
    margin-top: 4px;
  }
  .grow {
    flex: 1;
  }
  .num {
    width: 18px;
    flex: none;
    text-align: right;
    font-size: var(--fs-sm);
    color: var(--muted);
  }
  .check {
    flex: none;
    font-size: var(--fs-sm);
  }
  .add {
    align-self: flex-start;
  }
  .qa,
  .action {
    padding: var(--sp-2);
    border: 1px solid var(--line);
    border-radius: var(--r-control);
    gap: 6px;
  }
  .qa textarea {
    margin-left: 24px;
    width: calc(100% - 24px);
  }
  :global(.date-field.due) {
    width: 116px;
    flex: none;
  }
  .seg.mini button {
    height: 24px;
    padding: 0 8px;
    font-size: var(--fs-xs);
  }
  .strong {
    font-weight: 700;
  }
  .check-list ul {
    margin: 0;
    padding-left: 18px;
    color: var(--ink-2);
  }
  .ok {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--ok);
  }

  /* -------------------------------------------------------- the document */
  .doc-col {
    flex: none;
  }
  .acta {
    /* A4 proportions at 96 dpi, narrower when the window is (still side by side with the form). */
    width: clamp(640px, calc(100cqw - 472px), 794px);
    min-height: 600px;
    padding: 52px 60px 48px;
    background: var(--d-fill);
    color: var(--d-ink);
    border: 1px solid var(--line);
    border-radius: var(--r-card);
    box-shadow: var(--shadow);
    font-size: 14px;
    line-height: 1.5;
  }
  .kicker {
    font-size: var(--fs-xs);
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  h1 {
    margin: 4px 0 var(--sp-4);
    font-size: 24px;
    line-height: 1.2;
  }
  h2 {
    margin: 0 0 var(--sp-2);
    padding-bottom: 4px;
    border-bottom: 2px solid var(--d-ink);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .acta section {
    margin-top: var(--sp-5);
  }
  .cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--sp-5);
  }
  .cols:has(> :only-child) {
    grid-template-columns: 1fr;
  }
  ul,
  ol {
    margin: 0;
    padding-left: 22px;
  }
  li + li {
    margin-top: 3px;
  }
  .people {
    list-style: none;
    padding: 0;
  }
  .people li + li {
    margin-top: 6px;
  }
  .people strong,
  .people .role {
    display: block;
  }
  .people .role {
    font-size: 13px;
    line-height: 1.35;
    color: var(--ink-2);
  }
  .para + .para {
    margin-top: var(--sp-2);
  }
  .para {
    white-space: pre-wrap;
  }
  .qa-list li + li {
    margin-top: var(--sp-2);
  }
  .q {
    font-weight: 700;
  }
  .a.pending {
    font-style: italic;
    color: var(--muted);
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th,
  td {
    padding: 6px 10px;
    border: 1px solid var(--line);
    text-align: left;
    vertical-align: top;
  }
  thead th {
    background: var(--d-soft);
    font-size: 12px;
    font-weight: 700;
  }
  .meta th {
    width: 90px;
    background: var(--d-soft);
    font-weight: 700;
  }
  .review tbody th {
    width: 96px;
    font-weight: 700;
    border-left-width: 4px;
  }
  .review tr.well th {
    border-left-color: var(--tier-C);
  }
  .review tr.bad th {
    border-left-color: var(--tier-S);
  }
  .review tr.improve th {
    border-left-color: var(--tier-B);
  }
  .review td {
    width: 50%;
  }
  .review ul {
    padding-left: 18px;
  }
  .none {
    color: var(--faint);
  }
  .nowrap {
    white-space: nowrap;
  }
  .actions th:nth-child(2),
  .actions td:nth-child(2) {
    width: 150px;
  }

  .cols:has(> :only-child) .people {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px 24px;
  }
  .cols:has(> :only-child) .people li + li {
    margin-top: 0;
  }
  @container (max-width: 1112px) {
    .wrap {
      flex-direction: column;
      min-width: 0;
    }
    .acta {
      width: min(794px, 100%);
    }
  }
</style>
