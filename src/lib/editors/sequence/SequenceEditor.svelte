<script lang="ts">
  import { tick } from 'svelte';
  import { app } from '../../stores/app.svelte';
  import { uid } from '../../model/diagram';
  import type { DiagramOf, MessageStyle, ParticipantKind, SeqItem, SequenceData } from '../../model/types';
  import Icon from '../../components/Icon.svelte';
  import SequenceDiagram from './SequenceDiagram.svelte';
  import { layoutSequence } from './layout';
  import { parsePlantUml, SeqParseError, toPlantUml } from './text';

  const doc = $derived(app.docOf('sequence'));
  const data = $derived(doc.data);
  const layout = $derived(layoutSequence(data));

  let selected = $state<string | null>(null);
  let tab = $state<'items' | 'text'>('items');
  let panelOpen = $state(true);

  const KIND_LABELS: [ParticipantKind, string][] = [
    ['actor', 'Actor'],
    ['object', 'Object'],
    ['boundary', 'Boundary'],
    ['control', 'Control'],
    ['entity', 'Entity'],
    ['database', 'Database']
  ];
  const STYLE_LABELS: [MessageStyle, string][] = [
    ['sync', '→ call (sync)'],
    ['async', '⇀ async'],
    ['reply', '⇠ reply'],
    ['create', '«create»'],
    ['destroy', '«destroy»']
  ];
  const OPS = ['alt', 'opt', 'loop', 'par', 'break', 'critical', 'ref'] as const;

  function edit(fn: (s: SequenceData) => void, key?: string) {
    app.change((d) => fn((d as DiagramOf<'sequence'>).data), key);
  }

  /* --------------------------------------------------------- participants */

  function addParticipant(kind: ParticipantKind = 'object') {
    const n = data.participants.length + 1;
    const id = uid();
    edit((s) => s.participants.push({ id, name: kind === 'actor' ? `Actor${n}` : `:Objeto${n}`, kind }));
  }
  function moveParticipant(i: number, by: number) {
    const j = i + by;
    if (j < 0 || j >= data.participants.length) return;
    edit((s) => {
      const [p] = s.participants.splice(i, 1);
      s.participants.splice(j, 0, p);
    });
  }
  async function removeParticipant(i: number) {
    const p = data.participants[i];
    const uses = data.items.filter((it) => (it.t === 'msg' && (it.from === p.id || it.to === p.id)) || (it.t === 'note' && it.over.includes(p.id))).length;
    if (uses && !window.confirm(`"${p.name}" is used by ${uses} message${uses === 1 ? '' : 's'} or note${uses === 1 ? '' : 's'}. Delete it and its messages?`)) return;
    edit((s) => {
      s.participants.splice(i, 1);
      s.items = s.items.filter((it) => !(it.t === 'msg' && (it.from === p.id || it.to === p.id)));
      for (const it of s.items) if (it.t === 'note') it.over = it.over.filter((o) => o !== p.id);
    });
  }

  /* ---------------------------------------------------------------- items */

  const indexOf = (id: string | null) => (id ? data.items.findIndex((it) => it.id === id) : -1);
  const insertAt = () => {
    const i = indexOf(selected);
    return i < 0 ? data.items.length : i + 1;
  };

  /** Indent level of each row, for the list. */
  const depths = $derived.by(() => {
    let d = 0;
    return data.items.map((it) => {
      if (it.t === 'close') d = Math.max(0, d - 1);
      const shown = it.t === 'else' ? Math.max(0, d - 1) : d;
      if (it.t === 'open') d++;
      return shown;
    });
  });

  function lastMessage(before: number): Extract<SeqItem, { t: 'msg' }> | undefined {
    for (let i = before - 1; i >= 0; i--) {
      const it = data.items[i];
      if (it.t === 'msg') return it;
    }
    return undefined;
  }

  async function addMessage() {
    if (data.participants.length === 0) {
      app.notify('Add a participant first.');
      return;
    }
    const at = insertAt();
    const prev = lastMessage(at);
    const parts = data.participants;
    const from = prev ? prev.to : parts[0].id;
    const fi = parts.findIndex((p) => p.id === from);
    const to = parts[Math.min(parts.length - 1, fi + 1)]?.id ?? from;
    const item: SeqItem = { id: uid(), t: 'msg', from, to: to === from && parts.length > 1 ? parts[0].id : to, text: 'mensaje()', style: 'sync' };
    edit((s) => s.items.splice(at, 0, item));
    selected = item.id;
    await focusText(item.id);
  }

  async function addFragment(op: (typeof OPS)[number] = 'alt') {
    const at = insertAt();
    const open: SeqItem = { id: uid(), t: 'open', op, guard: op === 'loop' ? 'para cada ejemplar' : op === 'ref' ? 'Iniciar sesión' : 'condición' };
    const close: SeqItem = { id: uid(), t: 'close' };
    edit((s) => s.items.splice(at, 0, open, close));
    selected = open.id;
    await focusText(open.id);
  }

  async function addElse() {
    const at = insertAt();
    const item: SeqItem = { id: uid(), t: 'else', guard: 'si no' };
    edit((s) => s.items.splice(at, 0, item));
    selected = item.id;
    await focusText(item.id);
  }

  async function addNote() {
    if (data.participants.length === 0) {
      app.notify('Add a participant first.');
      return;
    }
    const at = insertAt();
    const prev = lastMessage(at);
    const item: SeqItem = { id: uid(), t: 'note', over: prev ? [...new Set([prev.from, prev.to])] : [data.participants[0].id], text: 'Nota' };
    edit((s) => s.items.splice(at, 0, item));
    selected = item.id;
    await focusText(item.id);
  }

  function moveItem(i: number, by: number) {
    const j = i + by;
    if (j < 0 || j >= data.items.length) return;
    edit((s) => {
      const [it] = s.items.splice(i, 1);
      s.items.splice(j, 0, it);
    });
  }

  /** Deleting a fragment's open or end removes its markers (open, else, end) but keeps what was inside. */
  function removeItem(i: number) {
    const it = data.items[i];
    const drop = new Set<number>([i]);
    if (it.t === 'open' || it.t === 'close') {
      const items = data.items;
      let start = i;
      if (it.t === 'close') {
        let d = 0;
        for (let k = i - 1; k >= 0; k--) {
          if (items[k].t === 'close') d++;
          else if (items[k].t === 'open') {
            if (d === 0) {
              start = k;
              break;
            }
            d--;
          }
        }
      }
      drop.add(start);
      let d = 0;
      for (let k = start + 1; k < items.length; k++) {
        const t = items[k].t;
        if (t === 'open') d++;
        else if (t === 'else' && d === 0) drop.add(k);
        else if (t === 'close') {
          if (d === 0) {
            drop.add(k);
            break;
          }
          d--;
        }
      }
    }
    const next = data.items.find((_, k) => k > i && !drop.has(k)) ?? [...data.items].reverse().find((it2) => indexOf(it2.id) < i && !drop.has(indexOf(it2.id)));
    edit((s) => (s.items = s.items.filter((_, k) => !drop.has(k))));
    selected = next?.id ?? null;
  }

  async function focusText(id: string) {
    panelOpen = true;
    tab = 'items';
    await tick();
    const el = document.getElementById(`seq-field-${id}`) as HTMLInputElement | HTMLTextAreaElement | null;
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    el?.focus();
    el?.select?.();
  }

  function selectFromDiagram(id: string | null) {
    selected = id;
    if (id) document.getElementById(`seq-row-${id}`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /* ----------------------------------------------------------------- text */

  let text = $state('');
  let textErrors = $state<{ line: number; message: string }[]>([]);
  let textFocused = $state(false);
  $effect(() => {
    // Follow the diagram (undo, list edits) while the text box isn't being typed in.
    const t = toPlantUml(data);
    if (!textFocused) {
      text = t;
      textErrors = [];
    }
  });

  function onText(value: string) {
    text = value;
    try {
      const parsed = parsePlantUml(value, $state.snapshot(data) as SequenceData);
      textErrors = [];
      edit((s) => {
        s.participants = parsed.participants;
        s.items = parsed.items;
        s.activations = parsed.activations;
        s.autonumber = parsed.autonumber;
      }, 'seq-text');
    } catch (err) {
      textErrors = err instanceof SeqParseError ? err.problems : [{ line: 0, message: String(err) }];
    }
  }

  /* ----------------------------------------------------------------- keys */

  function typing(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }

  function onKey(e: KeyboardEvent) {
    if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const i = indexOf(selected);
    if ((e.key === 'Delete' || e.key === 'Backspace') && i >= 0) {
      e.preventDefault();
      removeItem(i);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!data.items.length) return;
      e.preventDefault();
      const j = i < 0 ? 0 : Math.max(0, Math.min(data.items.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
      selectFromDiagram(data.items[j].id);
    } else if (e.key === 'F2' && i >= 0) {
      e.preventDefault();
      void focusText(data.items[i].id);
    } else if (e.key === 'Escape') {
      selected = null;
    }
  }

  const nameOf = (id: string) => data.participants.find((p) => p.id === id)?.name ?? '?';
  /** Which fragment an `end` closes, for its label. */
  function closesOp(i: number): string {
    let d = 0;
    for (let k = i - 1; k >= 0; k--) {
      const it = data.items[k];
      if (it.t === 'close') d++;
      else if (it.t === 'open') {
        if (d === 0) return it.op;
        d--;
      }
    }
    return '?';
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="scroll-canvas">
  <div class="page" class:panel={panelOpen}>
    {#if data.participants.length === 0 && data.items.length === 0}
      <div class="empty-hint" style:padding-right={panelOpen ? 'calc(var(--panel-w) + 2 * var(--edge))' : undefined}>
        <div class="stack">
          <p>An empty sequence diagram.</p>
          <p class="small">Add participants and messages in the panel, or type them in its <strong>Text</strong> tab:</p>
          <pre>actor Socio
participant ":Sistema" as S
Socio -> S: prestar(libro)
S --> Socio: ok</pre>
        </div>
      </div>
    {:else}
      <div class="export" data-export-root style:width="{layout.width}px" style:height="{layout.height}px">
        <SequenceDiagram {layout} {selected} onSelect={selectFromDiagram} onEdit={(id) => { selected = id; void focusText(id); }} />
      </div>
    {/if}
  </div>
</div>

{#if !panelOpen}
  <button class="secondary reopen" onclick={() => (panelOpen = true)}><Icon name="PanelRight" size={16} /> Edit</button>
{:else}
  <aside class="inspector float" aria-label="Sequence editor">
    <div class="inspector-head">
      <div class="seg" role="tablist" aria-label="Edit as">
        <button role="tab" aria-selected={tab === 'items'} class:active={tab === 'items'} onclick={() => (tab = 'items')}><Icon name="ListOrdered" size={14} /> Items</button>
        <button role="tab" aria-selected={tab === 'text'} class:active={tab === 'text'} onclick={() => (tab = 'text')}><Icon name="Code" size={14} /> Text</button>
      </div>
      <div class="spacer"></div>
      <button class="icon" aria-label="Hide panel" title="Hide panel" onclick={() => (panelOpen = false)}><Icon name="PanelRightClose" /></button>
    </div>

    {#if tab === 'items'}
      <div class="inspector-body">
        {#if layout.problems.length}
          <ul class="problems small">
            {#each layout.problems as p, i (i)}<li>{p}</li>{/each}
          </ul>
        {/if}

        <section class="stack tight">
          <div class="row between">
            <span class="sect">Participants</span>
            <button class="small" onclick={() => addParticipant('object')}><Icon name="Plus" size={14} /> Add</button>
          </div>
          {#each data.participants as p, i (p.id)}
            <div class="prow">
              <select aria-label="Kind" value={p.kind} onchange={(e) => edit((s) => (s.participants[i].kind = e.currentTarget.value as ParticipantKind))}>
                {#each KIND_LABELS as [k, l] (k)}<option value={k}>{l}</option>{/each}
              </select>
              <input type="text" aria-label="Name" value={p.name} oninput={(e) => edit((s) => (s.participants[i].name = e.currentTarget.value), `p-name-${p.id}`)} />
              <button class="icon small" aria-label="Move left" title="Move left" disabled={i === 0} onclick={() => moveParticipant(i, -1)}><Icon name="ArrowLeft" size={14} /></button>
              <button class="icon small" aria-label="Move right" title="Move right" disabled={i === data.participants.length - 1} onclick={() => moveParticipant(i, 1)}><Icon name="ArrowRight" size={14} /></button>
              <button class="icon small danger" aria-label="Delete participant" title="Delete" onclick={() => removeParticipant(i)}><Icon name="Trash2" size={14} /></button>
            </div>
          {:else}
            <p class="small muted">None yet. An actor starts the interaction; objects are written <code>:Clase</code> or <code>nombre:Clase</code>.</p>
          {/each}
        </section>

        <section class="row options">
          <label class="check small"><input type="checkbox" checked={data.autonumber} onchange={(e) => edit((s) => (s.autonumber = e.currentTarget.checked))} /> Number messages</label>
          <label class="check small"><input type="checkbox" checked={data.activations} onchange={(e) => edit((s) => (s.activations = e.currentTarget.checked))} /> Activation bars</label>
        </section>

        <section class="stack tight">
          <span class="sect">Messages and fragments</span>
          {#each data.items as it, i (it.id)}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div id="seq-row-{it.id}" class="item" class:sel={selected === it.id} style:margin-left="{depths[i] * 14}px" class:nested={depths[i] > 0} onclick={() => (selected = it.id)}>
              {#if it.t === 'msg'}
                <div class="mrow">
                  <select aria-label="From" value={it.from} onchange={(e) => edit((s) => ((s.items[i] as typeof it).from = e.currentTarget.value))}>
                    {#each data.participants as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
                  </select>
                  <select aria-label="Kind of message" class="style" value={it.style} onchange={(e) => edit((s) => ((s.items[i] as typeof it).style = e.currentTarget.value as MessageStyle))}>
                    {#each STYLE_LABELS as [v, l] (v)}<option value={v}>{l}</option>{/each}
                  </select>
                  <select aria-label="To" value={it.to} onchange={(e) => edit((s) => ((s.items[i] as typeof it).to = e.currentTarget.value))}>
                    {#each data.participants as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
                  </select>
                </div>
                <div class="mrow">
                  <input id="seq-field-{it.id}" type="text" aria-label="Message text" placeholder="operación(parámetros)" value={it.text} oninput={(e) => edit((s) => ((s.items[i] as typeof it).text = e.currentTarget.value), `m-${it.id}`)} />
                  {@render actions(i)}
                </div>
              {:else if it.t === 'open'}
                <div class="mrow">
                  <select aria-label="Fragment" class="op" value={it.op} onchange={(e) => edit((s) => ((s.items[i] as typeof it).op = e.currentTarget.value as typeof it.op))}>
                    {#each OPS as o (o)}<option value={o}>{o}</option>{/each}
                  </select>
                  <input id="seq-field-{it.id}" type="text" aria-label={it.op === 'ref' ? 'Referenced interaction' : 'Guard'} placeholder={it.op === 'ref' ? 'interacción referida' : 'guarda'} value={it.guard} oninput={(e) => edit((s) => ((s.items[i] as typeof it).guard = e.currentTarget.value), `g-${it.id}`)} />
                  {@render actions(i)}
                </div>
              {:else if it.t === 'else'}
                <div class="mrow">
                  <span class="kw">else</span>
                  <input id="seq-field-{it.id}" type="text" aria-label="Guard" placeholder="guarda" value={it.guard} oninput={(e) => edit((s) => ((s.items[i] as typeof it).guard = e.currentTarget.value), `g-${it.id}`)} />
                  {@render actions(i)}
                </div>
              {:else if it.t === 'close'}
                <div class="mrow">
                  <span class="kw">end <span class="muted">{closesOp(i)}</span></span>
                  <div class="spacer"></div>
                  {@render actions(i)}
                </div>
              {:else if it.t === 'note'}
                <div class="mrow chips">
                  <span class="kw">note over</span>
                  {#each data.participants as p (p.id)}
                    {@const on = it.over.includes(p.id)}
                    <button
                      class="chip small"
                      class:on
                      aria-pressed={on}
                      onclick={(e) => {
                        e.stopPropagation();
                        edit((s) => {
                          const n = s.items[i] as typeof it;
                          n.over = on ? n.over.filter((o) => o !== p.id) : data.participants.map((q) => q.id).filter((q) => q === p.id || n.over.includes(q));
                        });
                      }}>{p.name}</button>
                  {/each}
                </div>
                <div class="mrow">
                  <textarea id="seq-field-{it.id}" rows="2" aria-label="Note text" value={it.text} oninput={(e) => edit((s) => ((s.items[i] as typeof it).text = e.currentTarget.value), `n-${it.id}`)}></textarea>
                  {@render actions(i)}
                </div>
              {/if}
            </div>
          {:else}
            <p class="small muted">No messages yet.</p>
          {/each}
          <div class="row adds">
            <button class="secondary small" onclick={addMessage}><Icon name="ArrowRight" size={14} /> Message</button>
            <button class="secondary small" onclick={() => addFragment('alt')}><Icon name="SquareDashed" size={14} /> Fragment</button>
            <button class="secondary small" onclick={addElse}>else</button>
            <button class="secondary small" onclick={addNote}><Icon name="StickyNote" size={14} /> Note</button>
          </div>
          <p class="tiny muted">New items go after the selected one. <kbd>↑</kbd> <kbd>↓</kbd> select, <kbd>F2</kbd> edits, <kbd>Del</kbd> deletes. Double-click a message on the diagram to edit it.</p>
        </section>
      </div>
    {:else}
      <div class="inspector-body">
        <p class="tiny muted">PlantUML syntax. Changes apply as you type; the diagram only changes while the text reads correctly.</p>
        <textarea
          class="code"
          spellcheck="false"
          aria-label="Sequence diagram as text"
          value={text}
          onfocus={() => (textFocused = true)}
          onblur={() => {
            textFocused = false;
            if (!textErrors.length) text = toPlantUml(data);
          }}
          oninput={(e) => onText(e.currentTarget.value)}
        ></textarea>
        {#if textErrors.length}
          <ul class="problems small" aria-live="polite">
            {#each textErrors as p, i (i)}<li>{p.line ? `Line ${p.line}: ` : ''}{p.message}</li>{/each}
          </ul>
        {/if}
        <details class="small">
          <summary>Syntax</summary>
          <pre>actor Socio
boundary ":Pantalla" as P
control ":Control" as C
entity ":Libro" as L
database BD
autonumber
autoactivate on

Socio -> P: prestar(isbn)     ' llamada
P ->> C: registrar()          ' asíncrono
C --> P: ok                   ' respuesta
create L
C -> L: new()
alt disponible
  C -> BD: guardar()
else no disponible
  C --> P: error
end
loop cada ejemplar … end
opt … end · par … and … end
ref over P, C: Iniciar sesión
note over P, C: texto
destroy L   ' tras un mensaje a L</pre>
        </details>
      </div>
    {/if}
  </aside>
{/if}

{#snippet actions(i: number)}
  <span class="acts">
    <button class="icon small" aria-label="Move up" title="Move up" disabled={i === 0} onclick={(e) => { e.stopPropagation(); moveItem(i, -1); }}><Icon name="ArrowUp" size={14} /></button>
    <button class="icon small" aria-label="Move down" title="Move down" disabled={i === data.items.length - 1} onclick={(e) => { e.stopPropagation(); moveItem(i, 1); }}><Icon name="ArrowDown" size={14} /></button>
    <button class="icon small danger" aria-label="Delete" title="Delete" onclick={(e) => { e.stopPropagation(); removeItem(i); }}><Icon name="Trash2" size={14} /></button>
  </span>
{/snippet}

<style>
  .page {
    padding: var(--sp-5);
    min-width: max-content;
    min-height: 100%;
  }
  .page.panel {
    padding-right: calc(var(--panel-w) + var(--edge) * 2 + var(--sp-3));
  }
  .export {
    background: var(--d-fill);
    border-radius: var(--r-card);
    box-shadow: var(--shadow);
  }
  .reopen {
    position: absolute;
    top: var(--edge);
    right: var(--edge);
    z-index: 20;
  }
  .tight {
    gap: var(--sp-2);
  }
  .prow,
  .mrow {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .prow select {
    width: 112px;
    flex: none;
  }
  .prow input,
  .mrow input,
  .mrow textarea {
    flex: 1;
    min-width: 0;
  }
  select,
  input[type='text'] {
    padding: 4px 6px;
    font-size: var(--fs-sm);
  }
  .mrow select {
    flex: 1;
    min-width: 0;
  }
  .mrow select.style {
    flex: 0 0 96px;
  }
  .mrow select.op {
    flex: 0 0 80px;
  }
  .item {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 6px;
    border: 1px solid transparent;
    border-radius: var(--r-control);
  }
  .item.nested {
    border-left: 2px solid var(--line);
    border-radius: 0 var(--r-control) var(--r-control) 0;
  }
  .item:hover {
    background: var(--hover);
  }
  .item.sel {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 7%, transparent);
  }
  .kw {
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--ink-2);
    white-space: nowrap;
    padding: 0 4px;
  }
  .acts {
    display: inline-flex;
    flex: none;
  }
  .chips {
    flex-wrap: wrap;
  }
  .chip {
    height: 22px;
    padding: 0 8px;
    border: 1px solid var(--line);
    font-size: var(--fs-xs);
  }
  .chip.on {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 15%, transparent);
    color: var(--ink);
  }
  .options {
    flex-wrap: wrap;
    gap: var(--sp-3);
  }
  .adds {
    flex-wrap: wrap;
    gap: 6px;
  }
  .problems {
    margin: 0;
    padding: var(--sp-2) var(--sp-2) var(--sp-2) 24px;
    border-radius: var(--r-control);
    background: color-mix(in srgb, var(--danger) 10%, transparent);
    color: var(--danger);
  }
  .code {
    flex: 1;
    min-height: 320px;
    font-family: var(--mono);
    font-size: 12px;
    line-height: 1.5;
    white-space: pre;
    resize: none;
  }
  details pre {
    margin-top: var(--sp-2);
  }
  summary {
    cursor: pointer;
    color: var(--muted);
  }
  .empty-hint pre {
    text-align: left;
  }
</style>
