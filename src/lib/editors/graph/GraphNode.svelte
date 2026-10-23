<script lang="ts" module>
  import type { GNode } from '../../model/types';
  import type { NodeTypeInfo } from '../../model/kinds';

  export type EditField = 'label' | 'attrs' | 'ops';

  export interface GraphNodeData {
    [key: string]: unknown;
    node: GNode;
    info: NodeTypeInfo;
    editing: EditField | null;
    /** Mind map: branch colour and depth. */
    color?: string;
    depth?: number;
    /** Lit up while a shape is dragged: the container it would land in. */
    lit?: boolean;
  }

  export interface GraphCtx {
    startEdit: (id: string, field: EditField) => void;
    commitEdit: (id: string, field: EditField, value: string, next?: 'child' | 'sibling') => void;
    cancelEdit: () => void;
  }

  /** "1 Validar campos" → ["1", "Validar campos"]: the number goes in the DFD band / store id cell. */
  export function splitId(label: string): [string, string] {
    const m = /^\s*([A-Za-z]{0,2}\d+(?:\.\d+)*)\s+(.*)$/s.exec(label);
    return m ? [m[1], m[2]] : ['', label];
  }

  export type WireLine = { t: 'text'; text: string } | { t: 'button'; text: string } | { t: 'field'; text: string } | { t: 'title'; text: string };

  /** Screen wireframe lines: "[Entrar]" a button, "Nombre: ___" a field, "# Título" a heading, anything else text. */
  export function wireLines(lines: string[]): WireLine[] {
    return lines.map((l) => {
      const s = l.trim();
      const b = /^\[(.+)\]$/.exec(s);
      if (b) return { t: 'button', text: b[1] };
      if (/_{3,}/.test(s)) return { t: 'field', text: s.replace(/_{3,}/, '').replace(/:\s*$/, '').trim() };
      if (s.startsWith('# ')) return { t: 'title', text: s.slice(2) };
      return { t: 'text', text: s };
    });
  }
</script>

<script lang="ts">
  import { getContext, tick } from 'svelte';
  import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/svelte';
  import Icon from '../../components/Icon.svelte';
  import { inkOn } from '../../model/colors';
  import type { Shape } from '../../model/kinds';
  import { canPaint, OWN_TINT } from './ops';

  const GLYPHS: ReadonlySet<Shape> = new Set<Shape>(['actor', 'device', 'lollipop', 'initial', 'final', 'flowFinal', 'diamond', 'relationship', 'cylinder', 'parallelogram', 'document']);

  let { id, data, selected }: NodeProps & { data: GraphNodeData } = $props();
  const ctx = getContext<GraphCtx>('graph');
  const resized = getContext<(id: string, r: { x: number; y: number; width: number; height: number }) => void>('graph-resize');

  const n = $derived(data.node);
  const info = $derived(data.info);
  const shape = $derived(info.shape);
  const resizable = $derived(!!(info.container || info.resizable));
  const stereo = $derived(n.stereotype ?? info.stereotype ?? '');
  const lines = $derived((n.label ?? '').split('\n'));
  const empty = $derived(!n.label?.trim());

  let draft = $state('');
  let editor = $state<HTMLTextAreaElement | null>(null);

  $effect(() => {
    if (data.editing) {
      draft = data.editing === 'label' ? n.label : ((data.editing === 'attrs' ? n.attrs : n.ops) ?? []).join('\n');
      // A new shape stays hidden until Svelte Flow has measured it, and hidden
      // elements can't take focus: keep trying for a moment.
      let tries = 0;
      const grab = () => {
        if (!editor || document.activeElement === editor) return;
        editor.focus();
        editor.select();
        if (document.activeElement !== editor && tries++ < 20) setTimeout(grab, 25);
      };
      void tick().then(grab);
    }
  });

  /** Single-line labels commit on Enter; multi-line ones (notes, screens, attrs) need Ctrl+Enter. */
  const multiline = $derived(data.editing !== 'label' || ['note', 'screen'].includes(shape));

  function onKey(e: KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'Escape') {
      // Esc finishes editing and keeps what was typed (Ctrl+Z undoes it).
      e.preventDefault();
      ctx.commitEdit(id, data.editing!, draft);
    } else if (e.key === 'Enter' && !multiline && e.shiftKey) {
      e.preventDefault();
      ctx.commitEdit(id, data.editing!, draft);
    } else if (e.key === 'Enter' && (!multiline || e.ctrlKey) && !e.shiftKey) {
      e.preventDefault();
      ctx.commitEdit(id, data.editing!, draft, shape === 'topic' || shape === 'central' ? 'sibling' : undefined);
    } else if (e.key === 'Tab' && (shape === 'topic' || shape === 'central')) {
      e.preventDefault();
      ctx.commitEdit(id, data.editing!, draft, 'child');
    }
  }

  function commit() {
    if (data.editing) ctx.commitEdit(id, data.editing, draft);
  }

  function dbl(field: EditField) {
    return (e: MouseEvent) => {
      e.stopPropagation();
      ctx.startEdit(id, field);
    };
  }

  const tint = $derived(n.color ?? data.color);
  /** Most shapes take a colour as a light fill and a coloured outline; a few draw it their own way. */
  const painted = $derived(!!tint && canPaint(shape) && !OWN_TINT.has(shape));
  /** Black or white text on a solid colour (the central idea). */
  const tintInk = $derived(tint ? inkOn(tint) : undefined);
  /** Shapes drawn as a glyph (stick figure, diamond, cylinder…): hover and selection glow round the glyph, not a box. */
  const glyph = $derived(GLYPHS.has(shape));
  const [num, rest] = $derived(splitId(n.label ?? ''));
</script>

{#snippet text(cls = '')}
  {#if data.editing === 'label'}
    <textarea
      bind:this={editor}
      bind:value={draft}
      class="nodrag nopan inline-edit {cls}"
      rows={Math.max(1, draft.split('\n').length)}
      onkeydown={onKey}
      onblur={commit}
      aria-label="Text"
    ></textarea>
    {#if multiline}<span class="edit-hint nodrag" data-no-export>Ctrl+Enter or Esc to finish</span>{/if}
  {:else}
    <span class="label {cls}" class:placeholder={empty}>{n.label}</span>
  {/if}
{/snippet}

{#snippet list(field: 'attrs' | 'ops', items: string[] | undefined)}
  {#if data.editing === field}
    <textarea bind:this={editor} bind:value={draft} class="nodrag nopan inline-edit list-edit" rows={Math.max(2, draft.split('\n').length + 1)} onkeydown={onKey} onblur={commit} aria-label={field === 'attrs' ? 'Attributes' : 'Operations'}></textarea>
  {:else}
    <div class="compartment" role="list" ondblclick={dbl(field)}>
      {#each items ?? [] as line, i (i)}
        <div class="member" class:static={line.includes('{static}') || line.startsWith('_')} class:abstract={line.includes('{abstract}')} role="listitem">{line.replace('{static}', '').replace('{abstract}', '').replace(/^_/, '').trim()}</div>
      {/each}
    </div>
  {/if}
{/snippet}

{#if resizable && selected}
  <NodeResizer minWidth={shape === 'bar' ? 30 : 80} minHeight={shape === 'bar' ? 4 : 40} lineClass="resize-line" handleClass="resize-handle" onResizeEnd={(_e, r) => resized(id, r)} />
{/if}

<div
  class="gnode s-{shape} t-{n.type}"
  class:selected
  class:lit={data.lit}
  class:glyph
  class:tinted={!!tint}
  class:painted
  class:fill-size={resizable}
  style:--tint={tint}
  style:--tint-ink={tintInk}
  ondblclick={dbl('label')}
  role="presentation"
>
  {#if shape === 'actor'}
    <svg class="figure" viewBox="0 0 32 56" width="32" height="56" aria-hidden="true">
      <circle cx="16" cy="8" r="7" />
      <path d="M16 15 V36 M3 22 H29 M16 36 L5 54 M16 36 L27 54" />
    </svg>
    {@render text('below')}
  {:else if shape === 'ellipse'}
    {@render text()}
  {:else if shape === 'container' || shape === 'swimlane' || shape === 'zone'}
    <div class="c-head">
      {#if stereo}<span class="stereo">«{stereo}»</span>{/if}
      {@render text()}
    </div>
  {:else if shape === 'package'}
    <div class="tab">{@render text()}</div>
    <div class="pkg-body"></div>
  {:else if shape === 'note'}
    {@render text('note-text')}
  {:else if shape === 'class'}
    <div class="c-name" class:abstract={n.abstract}>
      {#if stereo}<span class="stereo">«{stereo}»</span>{/if}
      {@render text()}
    </div>
    {#if n.type !== 'interface' || (n.attrs?.length ?? 0) > 0 || data.editing === 'attrs'}
      {@render list('attrs', n.attrs)}
    {/if}
    {#if n.type !== 'enum' || (n.ops?.length ?? 0) > 0 || data.editing === 'ops'}
      {@render list('ops', n.ops)}
    {/if}
  {:else if shape === 'initial'}
    <span class="dot" aria-label="Initial"></span>
  {:else if shape === 'final'}
    <span class="bull" aria-label="Final"><span></span></span>
  {:else if shape === 'flowFinal'}
    <svg class="ff" viewBox="0 0 26 26" width="26" height="26" aria-label="Flow final"><circle cx="13" cy="13" r="11.5" class="o" /><path d="M5 5 L21 21 M21 5 L5 21" class="o" /></svg>
  {:else if shape === 'history'}
    <span class="hist">{n.label || 'H'}</span>
  {:else if shape === 'diamond' || shape === 'relationship'}
    <svg class="dia-bg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <polygon points="50,1 99,50 50,99 1,50" />
      {#if n.type === 'identifying'}<polygon points="50,9 91,50 50,91 9,50" />{/if}
    </svg>
    {#if !empty || data.editing}{@render text()}{/if}
  {:else if shape === 'bar'}
    <span class="bar-fill"></span>
  {:else if shape === 'state'}
    <div class="st-name">{@render text()}</div>
    {#if (n.attrs?.length ?? 0) > 0 || data.editing === 'attrs'}
      {@render list('attrs', n.attrs)}
    {/if}
  {:else if shape === 'object'}
    {@render text('underline')}
  {:else if shape === 'box3d'}
    <div class="b3-top"></div>
    <div class="b3-side"></div>
    <svg class="box3d" aria-hidden="true">
      <line x1="0" y1="12" x2="12" y2="0" />
      <line x1="12" y1="0" x2="100%" y2="0" />
      <line x1="100%" y1="0" x2="100%" y2="100%" />
      <svg x="100%" y="0" overflow="visible"><line x1="0" y1="0" x2="-12" y2="12" /></svg>
      <svg x="100%" y="100%" overflow="visible"><line x1="0" y1="0" x2="-12" y2="12" /></svg>
    </svg>
    <div class="b3-face">
      <div class="c-head left">
        {#if stereo}<span class="stereo">«{stereo}»</span>{/if}
        {@render text()}
      </div>
    </div>
  {:else if shape === 'artifact' || shape === 'component'}
    <span class="corner-icon"><Icon name={shape === 'artifact' ? 'File' : 'Component'} size={14} /></span>
    {#if stereo}<span class="stereo">«{stereo}»</span>{/if}
    {@render text()}
  {:else if shape === 'cylinder'}
    <svg class="cyl" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path d="M1,10 A49,9 0 0 1 99,10 V90 A49,9 0 0 1 1,90 Z" />
      <path class="rim" d="M1,10 A49,9 0 0 0 99,10" />
    </svg>
    {@render text()}
  {:else if shape === 'lollipop'}
    <span class="lolly"></span>
    {@render text('below')}
  {:else if shape === 'device'}
    <span class="dev-icon"><Icon name={n.icon || info.presetIcon || 'Server'} size={30} /></span>
    {@render text('below')}
  {:else if shape === 'terminator'}
    {@render text()}
  {:else if shape === 'parallelogram'}
    <svg class="para" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="12,1 99,1 88,99 1,99" /></svg>
    {@render text()}
  {:else if shape === 'document'}
    <svg class="doc" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M1,1 H99 V86 C75,72 60,104 30,94 C18,90 10,88 1,92 Z" /></svg>
    {@render text()}
  {:else if shape === 'subprocess'}
    {@render text()}
  {:else if shape === 'central' || shape === 'topic' || shape === 'concept'}
    {@render text()}
  {:else if shape === 'entity' || shape === 'weakEntity'}
    {@render text()}
  {:else if shape === 'attribute'}
    {@render text(n.type === 'key' ? 'underline' : '')}
  {:else if shape === 'process'}
    {#if n.type === 'system'}
      {@render text()}
    {:else}
      <div class="band">{num || '·'}</div>
      {#if data.editing === 'label'}{@render text()}{:else}<span class="label">{rest}</span>{/if}
    {/if}
  {:else if shape === 'external'}
    {@render text()}
  {:else if shape === 'datastore'}
    <span class="ds-id">{num || 'D'}</span>
    {#if data.editing === 'label'}{@render text()}{:else}<span class="label ds-name">{rest}</span>{/if}
  {:else if shape === 'screen'}
    <div class="win-bar">
      <span class="dots"><i></i><i></i><i></i></span>
      {#if stereo}<span class="stereo">{stereo}</span>{/if}
      <span class="win-title">{lines[0]}</span>
    </div>
    <div class="win-body">
      {#if data.editing === 'label'}
        {@render text()}
      {:else}
        {#each wireLines(lines.slice(1)) as l, i (i)}
          {#if l.t === 'button'}<span class="w-btn">{l.text}</span>
          {:else if l.t === 'field'}<span class="w-field"><span>{l.text}</span><span class="w-input"></span></span>
          {:else if l.t === 'title'}<strong class="w-title">{l.text}</strong>
          {:else}<span class="w-text">{l.text}</span>{/if}
        {/each}
      {/if}
    </div>
  {:else if shape === 'role'}
    <div class="r-head">{@render text()}</div>
    {#if n.person}<div class="r-person">{n.person}</div>{/if}
    {#if (n.attrs?.length ?? 0) > 0 || data.editing === 'attrs'}
      {@render list('attrs', n.attrs)}
    {/if}
  {:else if shape === 'trace'}
    <span class="trace-icon"><Icon name={info.icon} size={13} /></span>
    {@render text()}
  {:else}
    {@render text()}
  {/if}

  <Handle type="source" position={Position.Right} class="connect-dot" />
  <Handle type="target" position={Position.Left} class="target-dot" />
</div>

<style>
  .gnode {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--d-ink);
    font-size: 13px;
    line-height: 1.3;
    text-align: center;
  }
  .fill-size {
    width: 100%;
    height: 100%;
  }
  .label {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .placeholder {
    min-width: 1px;
  }
  .stereo {
    font-size: 11px;
    color: var(--d-line);
    white-space: nowrap;
  }
  .underline {
    text-decoration: underline;
    text-underline-offset: 2px;
  }
  .inline-edit {
    font: inherit;
    text-align: inherit;
    color: var(--ink);
    background: var(--panel);
    border: 1px solid var(--accent);
    border-radius: 4px;
    padding: 1px 4px;
    min-width: 80px;
    width: 100%;
    resize: none;
    field-sizing: content;
    outline: none;
  }
  .edit-hint {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--ink);
    color: var(--paper);
    font-size: 11px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 5;
  }
  .list-edit {
    text-align: left;
    font-size: 12px;
    min-height: 40px;
  }

  /* Interaction states. Boxes get an outline that follows their corners;
     glyphs (stick figure, diamond, cylinder…) a glow round the glyph. Hover is
     a light accent, selection the full accent. None of it reaches an exported
     image: app.css drops outlines and filters while capturing. */
  :global(.svelte-flow__node:hover) .gnode:not(.glyph):not(.selected) {
    outline: 1.5px solid var(--selected-line);
    outline-offset: 2px;
  }
  /* A container is hovered whenever the pointer is anywhere inside it: keep that quiet. */
  :global(.svelte-flow__node.is-container:hover) .gnode:not(.selected) {
    outline-color: color-mix(in srgb, var(--accent) 28%, transparent);
  }
  :global(.svelte-flow__node:hover) .glyph:not(.selected) :is(.figure, .dev-icon, .lolly, .dot, .bull, .ff, .dia-bg, .cyl, .para, .doc) {
    filter: drop-shadow(0 0 1px var(--selected-line)) drop-shadow(0 0 2px var(--selected-line));
  }
  .gnode.selected:not(.glyph) {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }
  .selected :is(.figure, .dev-icon, .lolly, .dot, .bull, .ff, .dia-bg, .cyl, .para, .doc) {
    filter: drop-shadow(0 0 0.5px var(--accent)) drop-shadow(0 0 2px var(--accent));
  }
  /* While a shape is dragged: the container it will land in. */
  .gnode.lit {
    outline: 2px dashed var(--accent);
    outline-offset: 3px;
    box-shadow: inset 0 0 0 100vmax var(--selected);
  }
  /* While a line is drawn: where it can end (dashed), and where it will end (solid). */
  :global(.svelte-flow__node.can-target) .gnode {
    outline: 1.5px dashed var(--selected-line);
    outline-offset: 4px;
  }
  :global(.svelte-flow__node.is-container.can-target) .gnode {
    outline-color: color-mix(in srgb, var(--accent) 30%, transparent);
  }
  :global(.svelte-flow__node.can-target:hover) .gnode {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
  }

  /* A colour the person picked: a light fill and a coloured outline; the text stays ink.
     The mix is with the panel colour, so it reads on light and dark paper (and in exports, which are light). */
  .gnode.painted {
    --d-fill: color-mix(in srgb, var(--tint) 18%, var(--panel));
    --d-soft: color-mix(in srgb, var(--tint) 32%, var(--panel));
    --d-ink: color-mix(in srgb, var(--tint) 82%, var(--ink));
    color: var(--ink);
  }
  .painted .corner-icon,
  .painted .dev-icon {
    color: var(--d-ink);
  }
  .painted .dev-icon {
    border-color: var(--d-ink);
  }

  /* actor, device, lollipop: a glyph with the name under it */
  .s-actor,
  .s-device,
  .s-lollipop {
    gap: 4px;
    min-width: 64px;
    padding: 2px 4px;
  }
  .figure {
    fill: var(--d-fill);
    stroke: var(--d-ink);
    stroke-width: 1.6;
    stroke-linecap: round;
  }
  .below {
    max-width: 140px;
  }
  .dev-icon {
    display: grid;
    place-items: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    border: 1.5px solid var(--d-line);
    background: var(--d-fill);
  }
  .lolly {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    border: 1.6px solid var(--d-ink);
    background: var(--d-fill);
  }

  .s-ellipse,
  .s-attribute {
    min-width: 120px;
    min-height: 54px;
    padding: 14px 26px;
    border: 1.5px solid var(--d-ink);
    border-radius: 50%;
    background: var(--d-fill);
  }
  .s-attribute {
    min-width: 80px;
    min-height: 36px;
    padding: 8px 18px;
  }
  .s-attribute:has(.underline) {
    font-weight: 700;
  }
  .s-attribute.t-multivalued {
    box-shadow: inset 0 0 0 3px var(--d-fill), inset 0 0 0 4.5px var(--d-ink);
  }
  .s-attribute.t-derived {
    border-style: dashed;
  }

  /* containers: boundary, composite state, swimlane, zone */
  .s-container,
  .s-swimlane,
  .s-zone {
    justify-content: flex-start;
    border: 1.5px solid var(--d-ink);
    background: color-mix(in srgb, var(--d-fill) 55%, transparent);
  }
  .s-container .c-head {
    padding: 8px 12px;
    font-weight: 700;
  }
  .s-swimlane .c-head {
    align-self: stretch;
    padding: 6px 10px;
    border-bottom: 1.5px solid var(--d-ink);
    font-weight: 700;
  }
  .s-zone {
    align-items: flex-start;
    border: 1.5px dashed var(--tint, var(--d-line));
    border-radius: 14px;
    background: color-mix(in srgb, var(--tint, var(--d-line)) 9%, transparent);
  }
  .s-zone .c-head {
    padding: 8px 12px;
    font-weight: 700;
    color: color-mix(in srgb, var(--tint, var(--d-ink)) 70%, var(--d-ink));
  }
  .c-head {
    display: flex;
    flex-direction: column;
  }
  .c-head.left {
    align-items: flex-start;
    text-align: left;
  }
  :global(.svelte-flow__node:has(.s-composite)) .s-container,
  .s-container:has(.c-head) {
    border-radius: 4px;
  }

  /* package */
  .s-package {
    align-items: stretch;
    justify-content: flex-start;
  }
  .tab {
    align-self: flex-start;
    padding: 2px 12px;
    border: 1.5px solid var(--d-ink);
    border-bottom: 0;
    background: var(--d-fill);
    font-weight: 700;
  }
  .pkg-body {
    flex: 1;
    border: 1.5px solid var(--d-ink);
    background: color-mix(in srgb, var(--d-fill) 55%, transparent);
  }

  /* note: folded corner. The paper is drawn behind the text and clipped to its
     corner on its own, so the clip doesn't also cut off the connection dot and the frames. */
  .s-note {
    align-items: flex-start;
    justify-content: flex-start;
    padding: 8px 18px 8px 10px;
    text-align: left;
    font-size: 12px;
  }
  .s-note::before {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    background: linear-gradient(225deg, transparent 10px, color-mix(in srgb, var(--tint, #e2c044) 22%, var(--d-fill)) 0);
    border-left: 1px solid var(--d-line);
    border-bottom: 1px solid var(--d-line);
    clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 0 100%);
  }

  /* org chart role */
  .s-role {
    align-items: stretch;
    min-width: 170px;
    max-width: 260px;
    border: 1.5px solid var(--d-ink);
    border-top: 4px solid var(--d-ink);
    border-radius: 6px;
    background: var(--d-fill);
  }
  .r-head {
    padding: 6px 12px 2px;
    font-weight: 700;
    text-align: center;
  }
  .r-person {
    padding: 0 12px 6px;
    text-align: center;
    font-size: 12px;
    opacity: 0.8;
  }
  .s-role .compartment {
    border-top-width: 1px;
  }
  .s-role .member {
    white-space: normal;
    padding-left: 10px;
    text-indent: -10px;
  }
  .s-role .member::before {
    content: '· ';
  }

  /* class */
  .s-class {
    align-items: stretch;
    min-width: 150px;
    border: 1.5px solid var(--d-ink);
    background: var(--d-fill);
  }
  .c-name {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 12px;
    font-weight: 700;
  }
  .c-name.abstract .label {
    font-style: italic;
  }
  .compartment {
    min-height: 14px;
    padding: 4px 8px;
    border-top: 1.5px solid var(--d-ink);
    text-align: left;
    font-size: 12px;
  }
  .member {
    white-space: pre;
  }
  .member.static {
    text-decoration: underline;
  }
  .member.abstract {
    font-style: italic;
  }

  /* activity / state pseudo-nodes */
  .dot {
    display: block;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: var(--d-ink);
  }
  .bull {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    border: 1.6px solid var(--d-ink);
  }
  .bull span {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--d-ink);
  }
  .o {
    fill: none;
    stroke: var(--d-ink);
    stroke-width: 1.6;
  }
  .hist {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1.5px solid var(--d-ink);
    background: var(--d-fill);
    font-weight: 700;
  }
  .s-diamond,
  .s-relationship {
    min-width: 36px;
    min-height: 36px;
    padding: 16px 30px;
  }
  .s-diamond:has(.label),
  .s-relationship {
    min-width: 110px;
    min-height: 62px;
  }
  .dia-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .dia-bg polygon {
    fill: var(--d-fill);
    stroke: var(--d-ink);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  .s-diamond > :not(svg),
  .s-relationship > :not(svg),
  .s-cylinder > :not(svg),
  .s-parallelogram > :not(svg),
  .s-document > :not(svg) {
    position: relative;
  }
  .bar-fill {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 4px;
    border-radius: 2px;
    background: var(--d-ink);
  }
  .s-action,
  .s-state {
    min-width: 110px;
    min-height: 40px;
    padding: 8px 16px;
    border: 1.5px solid var(--d-ink);
    border-radius: 14px;
    background: var(--d-fill);
  }
  .s-state {
    padding: 0;
    align-items: stretch;
    border-radius: 12px;
    /* no overflow: hidden — it would clip the connection dot */
  }
  .st-name {
    padding: 8px 16px;
    font-weight: 700;
  }
  .s-state .compartment {
    padding: 4px 10px 6px;
  }
  .s-rect,
  .s-object,
  .s-entity,
  .s-external,
  .s-trace {
    min-width: 100px;
    min-height: 40px;
    padding: 8px 14px;
    border: 1.5px solid var(--d-ink);
    background: var(--d-fill);
  }
  .s-entity {
    font-weight: 700;
    min-height: 44px;
  }
  .s-weakEntity {
    min-width: 110px;
    min-height: 48px;
    padding: 9px 16px;
    border: 1.5px solid var(--d-ink);
    background: var(--d-fill);
    box-shadow: inset 0 0 0 3px var(--d-fill), inset 0 0 0 4.5px var(--d-ink);
    font-weight: 700;
  }
  .s-external {
    box-shadow: 5px 5px 0 -1.5px var(--d-fill), 5px 5px 0 0 var(--d-ink);
    font-weight: 700;
  }

  /* deployment */
  .s-box3d {
    align-items: stretch;
    justify-content: stretch;
  }
  .box3d {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: calc(100% - 12px);
    overflow: visible;
    pointer-events: none;
  }
  .box3d line {
    stroke: var(--d-ink);
    stroke-width: 1.5;
  }
  .b3-face {
    position: absolute;
    left: 0;
    top: 12px;
    right: 12px;
    bottom: 0;
    border: 1.5px solid var(--d-ink);
    background: color-mix(in srgb, var(--d-fill) 70%, transparent);
  }
  .b3-top {
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    height: 12px;
    background: var(--d-soft);
    clip-path: polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%);
  }
  .b3-side {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: 12px;
    background: var(--d-soft);
    clip-path: polygon(0 12px, 100% 0, 100% calc(100% - 12px), 0 100%);
  }
  .b3-face .c-head {
    padding: 6px 10px;
    font-weight: 700;
  }
  .s-artifact,
  .s-component {
    min-width: 120px;
    min-height: 48px;
    padding: 10px 26px 10px 14px;
    border: 1.5px solid var(--d-ink);
    background: var(--d-fill);
  }
  .corner-icon {
    position: absolute;
    top: 4px;
    right: 5px;
    color: var(--d-line);
  }
  .s-cylinder {
    min-width: 90px;
    min-height: 64px;
    padding: 16px 14px 10px;
  }
  .cyl {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .cyl path {
    fill: var(--d-fill);
    stroke: var(--d-ink);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  .cyl .rim {
    fill: none;
  }

  /* flowchart */
  .s-terminator {
    min-width: 100px;
    min-height: 38px;
    padding: 8px 20px;
    border: 1.5px solid var(--d-ink);
    border-radius: 999px;
    background: var(--d-fill);
  }
  .s-parallelogram,
  .s-document {
    min-width: 120px;
    min-height: 46px;
    padding: 10px 24px;
  }
  .s-document {
    padding-bottom: 16px;
  }
  .para,
  .doc {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
  }
  .para polygon,
  .doc path {
    fill: var(--d-fill);
    stroke: var(--d-ink);
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }
  .s-subprocess {
    min-width: 120px;
    min-height: 42px;
    padding: 8px 22px;
    border: 1.5px solid var(--d-ink);
    background: var(--d-fill);
    box-shadow: inset 8px 0 0 -6.5px var(--d-ink), inset -8px 0 0 -6.5px var(--d-ink);
  }

  /* maps */
  .s-central {
    min-width: 120px;
    padding: 12px 22px;
    border-radius: 999px;
    background: var(--d-ink);
    color: var(--d-fill);
    font-size: 16px;
    font-weight: 700;
  }
  .s-central.tinted {
    background: var(--tint);
    color: var(--tint-ink);
  }
  .s-topic {
    padding: 5px 12px;
    border-radius: 999px;
    border: 2px solid var(--tint, var(--d-line));
    background: color-mix(in srgb, var(--tint, var(--d-line)) 12%, var(--d-fill));
  }
  .s-concept {
    min-width: 90px;
    padding: 8px 14px;
    border: 1.5px solid var(--tint, var(--d-ink));
    border-radius: 10px;
    background: color-mix(in srgb, var(--tint, transparent) 12%, var(--d-fill));
  }

  /* DFD (Gane–Sarson) */
  .s-process {
    min-width: 110px;
    min-height: 64px;
    align-items: stretch;
    justify-content: flex-start;
    border: 1.5px solid var(--d-ink);
    border-radius: 10px;
    background: var(--d-fill);
    /* no overflow: hidden — it would clip the connection dot */
  }
  .s-process > .label,
  .s-process > .inline-edit {
    padding: 6px 12px 10px;
    margin: auto 0;
  }
  .band {
    padding: 2px 8px;
    border-bottom: 1.5px solid var(--d-ink);
    font-size: 11px;
    font-weight: 700;
  }
  .s-process:not(:has(.band)) {
    justify-content: center;
    border-radius: 50%;
    min-width: 140px;
    min-height: 90px;
    padding: 16px;
    font-weight: 700;
  }
  .s-datastore {
    flex-direction: row;
    align-items: stretch;
    min-width: 150px;
    min-height: 34px;
    border-top: 1.5px solid var(--d-ink);
    border-bottom: 1.5px solid var(--d-ink);
    border-left: 1.5px solid var(--d-ink);
    background: var(--d-fill);
  }
  .ds-id {
    display: grid;
    place-items: center;
    padding: 0 8px;
    border-right: 1.5px solid var(--d-ink);
    font-weight: 700;
    font-size: 12px;
  }
  .ds-name {
    padding: 6px 14px 6px 10px;
    align-self: center;
  }

  /* screens */
  .s-screen {
    align-items: stretch;
    justify-content: flex-start;
    border: 1.5px solid var(--d-ink);
    border-radius: 6px;
    background: var(--d-fill);
    /* no overflow: hidden — it would clip the connection dot */
    text-align: left;
    font-size: 12px;
  }
  .win-bar {
    border-radius: 5px 5px 0 0;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    border-bottom: 1.5px solid var(--d-ink);
    background: var(--d-soft);
    font-weight: 700;
  }
  .dots {
    display: inline-flex;
    gap: 3px;
  }
  .dots i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    border: 1px solid var(--d-line);
  }
  .win-title {
    overflow-wrap: anywhere;
  }
  .win-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 8px 10px;
  }
  .w-btn {
    align-self: center;
    padding: 2px 14px;
    border: 1.2px solid var(--d-ink);
    border-radius: 4px;
    background: var(--d-soft);
  }
  .w-field {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
  }
  .w-input {
    flex: 1;
    height: 16px;
    border: 1px solid var(--d-line);
    border-radius: 2px;
    background: var(--d-fill);
  }
  .w-title {
    align-self: center;
  }
  .w-text {
    white-space: pre-wrap;
  }

  /* traceability */
  .s-trace {
    flex-direction: row;
    gap: 6px;
    min-width: 76px;
    min-height: 32px;
    padding: 5px 10px;
    font-weight: 700;
  }
  .s-trace.tinted {
    border-color: color-mix(in srgb, var(--tint) 82%, var(--ink));
    background: color-mix(in srgb, var(--tint) 16%, var(--d-fill));
  }
  .trace-icon {
    color: var(--d-line);
  }
  .tinted .trace-icon {
    color: color-mix(in srgb, var(--tint) 82%, var(--ink));
  }

  /* connection handles: a dot to drag from, shown on hover */
  .gnode :global(.connect-dot) {
    width: 10px;
    height: 10px;
    min-width: 10px;
    min-height: 10px;
    right: -14px;
    border: 2px solid var(--panel);
    border-radius: 50%;
    background: var(--accent);
    opacity: 0;
    pointer-events: all;
    cursor: crosshair;
    transition: opacity var(--t), transform var(--t), box-shadow var(--t);
  }
  /* The dot grows under the pointer: "drag from here". */
  .gnode :global(.connect-dot:hover) {
    transform: translate(50%, -50%) scale(1.4);
    box-shadow: 0 0 0 3px var(--selected);
  }
  :global(.svelte-flow__node:hover) .gnode :global(.connect-dot),
  .gnode.selected :global(.connect-dot) {
    opacity: 1;
  }
  .gnode :global(.target-dot) {
    left: 50%;
    top: 50%;
    opacity: 0;
    pointer-events: none;
  }
  :global(.resize-line) {
    border-color: var(--accent) !important;
  }
  :global(.resize-handle) {
    width: 9px !important;
    height: 9px !important;
    border-radius: 2px !important;
    background: var(--panel) !important;
    border: 1.5px solid var(--accent) !important;
  }
</style>
