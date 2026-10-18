<script lang="ts">
  import { tick } from 'svelte';
  import { app } from '../../stores/app.svelte';
  import Icon from '../../components/Icon.svelte';
  import Swatches from '../../components/Swatches.svelte';
  import { PALETTES, edgeTypeInfo, nodeTypeInfo } from '../../model/kinds';
  import type { CommMessage, GEdge, GNode, GraphData, GraphKind, UseCaseSpec } from '../../model/types';
  import { blankSpec } from '../../model/diagram';
  import { searchIcons } from '../../model/icons';
  import { childrenMap } from './layout';

  let {
    kind,
    nodeIds,
    edgeIds,
    focusEdgeLabel,
    selectedNode,
    onDelete,
    onAddChild,
    onAddSibling
  }: {
    kind: GraphKind;
    nodeIds: string[];
    edgeIds: string[];
    focusEdgeLabel: number;
    selectedNode: GNode | undefined;
    onDelete: () => void;
    onAddChild: (id: string) => void;
    onAddSibling: (id: string) => void;
  } = $props();

  const palette = $derived(PALETTES[kind]);
  const data = $derived(app.doc!.data as GraphData);
  const node = $derived(nodeIds.length === 1 && !edgeIds.length ? data.nodes.find((n) => n.id === nodeIds[0]) : undefined);
  const edge = $derived(edgeIds.length === 1 && !nodeIds.length ? data.edges.find((e) => e.id === edgeIds[0]) : undefined);
  const many = $derived(nodeIds.length + edgeIds.length > 1);
  const ninfo = $derived(node ? nodeTypeInfo(kind, node.type, node.icon) : null);
  const einfo = $derived(edge ? edgeTypeInfo(kind, edge.type) : null);

  let labelField = $state<HTMLTextAreaElement | null>(null);
  let iconQuery = $state('');
  let specOpen = $state(true);

  $effect(() => {
    if (focusEdgeLabel && edge) void tick().then(() => labelField?.focus());
  });

  function setNode(patch: Partial<GNode>, key?: string) {
    const id = node!.id;
    app.change((d) => {
      const n = (d.data as GraphData).nodes.find((x) => x.id === id);
      if (n) Object.assign(n, patch);
    }, key ? `n:${id}:${key}` : undefined);
  }
  function setEdge(patch: Partial<GEdge>, key?: string) {
    const id = edge!.id;
    app.change((d) => {
      const e = (d.data as GraphData).edges.find((x) => x.id === id);
      if (e) Object.assign(e, patch);
    }, key ? `e:${id}:${key}` : undefined);
  }
  function setSpec(field: keyof UseCaseSpec, value: string) {
    const id = node!.id;
    app.change((d) => {
      const n = (d.data as GraphData).nodes.find((x) => x.id === id);
      if (!n) return;
      n.spec = { ...blankSpec(), ...(n.spec ?? {}), [field]: value };
    }, `n:${id}:spec:${field}`);
  }
  const lines = (v: string) => v.split('\n').map((l) => l.trimEnd()).filter((l) => l.trim());

  /** Actors joined to this use case, for "fill from diagram". */
  function actorsOf(id: string): { primary: string; secondary: string } {
    const linked = data.edges.filter((e) => e.type === 'association' && (e.from === id || e.to === id)).map((e) => (e.from === id ? e.to : e.from));
    const names = linked.map((x) => data.nodes.find((n) => n.id === x)).filter((n) => n?.type === 'actor').map((n) => n!.label);
    return { primary: names[0] ?? '', secondary: names.slice(1).join(', ') };
  }
  function fillActors() {
    const a = actorsOf(node!.id);
    const id = node!.id;
    app.change((d) => {
      const n = (d.data as GraphData).nodes.find((x) => x.id === id);
      if (n) n.spec = { ...blankSpec(), ...(n.spec ?? {}), primaryActor: a.primary, secondaryActors: a.secondary };
    });
  }
  function nextCode(): string {
    const used = data.nodes.map((n) => /^CU-?(\d+)/i.exec(n.spec?.code ?? '')?.[1]).filter(Boolean).map(Number);
    return `CU-${String((used.length ? Math.max(...used) : 0) + 1).padStart(2, '0')}`;
  }

  function setMessages(fn: (m: CommMessage[]) => void) {
    const id = edge!.id;
    app.change((d) => {
      const e = (d.data as GraphData).edges.find((x) => x.id === id);
      if (!e) return;
      e.messages ??= [];
      fn(e.messages);
    });
  }
  function nextSeq(): string {
    const all = data.edges.flatMap((e) => e.messages ?? []).map((m) => parseInt(m.seq, 10)).filter((n) => !isNaN(n));
    return String((all.length ? Math.max(...all) : 0) + 1);
  }

  /** Mind map: everything except this idea's own branch can become its parent. */
  const parentChoices = $derived.by(() => {
    if (kind !== 'mindmap' || !node) return [];
    const kids = childrenMap(data.nodes);
    const banned = new Set<string>([node.id]);
    const walk = (id: string) => (kids.get(id) ?? []).forEach((c) => (banned.add(c.id), walk(c.id)));
    walk(node.id);
    return data.nodes.filter((n) => !banned.has(n.id) && n.type !== 'note');
  });

  function reparent(pid: string) {
    const id = node!.id;
    app.change((d) => {
      const g = d.data as GraphData;
      const n = g.nodes.find((x) => x.id === id);
      if (!n) return;
      n.parent = pid;
      const sib = g.nodes.filter((x) => x.parent === pid && x.id !== id);
      n.order = sib.length ? Math.max(...sib.map((x) => x.order ?? 0)) + 1 : 0;
    });
  }

  /* multiple selection: align / distribute */
  function align(how: 'left' | 'hcenter' | 'top' | 'vcenter' | 'hdist' | 'vdist') {
    const ids = new Set(nodeIds);
    app.change((d) => {
      const sel = (d.data as GraphData).nodes.filter((n) => ids.has(n.id));
      if (sel.length < 2) return;
      const el = (n: GNode) => document.querySelector<HTMLElement>(`.svelte-flow__node[data-id="${n.id}"]`);
      const size = (n: GNode) => ({ w: el(n)?.offsetWidth ?? n.w ?? 0, h: el(n)?.offsetHeight ?? n.h ?? 0 });
      if (how === 'left') {
        const x = Math.min(...sel.map((n) => n.x));
        sel.forEach((n) => (n.x = x));
      } else if (how === 'top') {
        const y = Math.min(...sel.map((n) => n.y));
        sel.forEach((n) => (n.y = y));
      } else if (how === 'hcenter') {
        const c = sel.reduce((s, n) => s + n.x + size(n).w / 2, 0) / sel.length;
        sel.forEach((n) => (n.x = Math.round(c - size(n).w / 2)));
      } else if (how === 'vcenter') {
        const c = sel.reduce((s, n) => s + n.y + size(n).h / 2, 0) / sel.length;
        sel.forEach((n) => (n.y = Math.round(c - size(n).h / 2)));
      } else if (how === 'hdist') {
        const s = [...sel].sort((a, b) => a.x - b.x);
        const first = s[0].x;
        const last = s[s.length - 1].x;
        s.forEach((n, i) => (n.x = Math.round(first + ((last - first) * i) / (s.length - 1))));
      } else {
        const s = [...sel].sort((a, b) => a.y - b.y);
        const first = s[0].y;
        const last = s[s.length - 1].y;
        s.forEach((n, i) => (n.y = Math.round(first + ((last - first) * i) / (s.length - 1))));
      }
    });
  }

  const hasStereo = $derived(node && ['class', 'container', 'box3d', 'artifact', 'component', 'rect', 'action', 'screen'].includes(ninfo!.shape) && node.type !== 'note');
  const colourable = $derived(node && ['zone', 'topic', 'concept', 'note', 'central'].includes(ninfo!.shape));
  const iconResults = $derived(searchIcons(iconQuery, 40));
  const typeChoices = $derived(node ? palette.nodes.filter((t) => !t.hidden && t.shape !== 'central' && !!t.container === !!ninfo!.container) : []);
</script>

{#if node || edge || many}
  <aside class="inspector float arrive" aria-label="Properties" data-no-export>
    <header class="inspector-head">
      {#if node && ninfo}
        <Icon name={ninfo.icon} size={16} />
        <strong>{ninfo.es}</strong>
        <span class="muted small">{ninfo.label}</span>
      {:else if edge && einfo}
        <Icon name="Spline" size={16} />
        <strong>{einfo.es}</strong>
        <span class="muted small">{einfo.label}</span>
      {:else}
        <strong>{nodeIds.length + edgeIds.length} selected</strong>
      {/if}
      <span class="spacer"></span>
      <button class="icon small danger" title="Delete (Del)" aria-label="Delete" onclick={onDelete} disabled={!!(node && node.type === 'central')}><Icon name="Trash2" size={15} /></button>
    </header>
    <div class="inspector-body">
      {#if node && ninfo}
        {#if typeChoices.length > 1 && kind !== 'mindmap'}
          <label class="field">Type
            <select value={node.type + (node.icon && ninfo.presetIcon ? '|' + node.icon : '')} onchange={(e) => {
              const [type, icon] = e.currentTarget.value.split('|');
              setNode({ type, ...(icon ? { icon } : {}) });
            }}>
              {#each typeChoices as t (t.label)}
                <option value={t.type + (t.presetIcon ? '|' + t.presetIcon : '')}>{t.es} · {t.label}</option>
              {/each}
            </select>
          </label>
        {/if}
        <label class="field">{ninfo.shape === 'class' ? 'Name' : 'Text'}
          <textarea rows={ninfo.shape === 'screen' || ninfo.shape === 'note' ? 6 : 2} value={node.label} oninput={(e) => setNode({ label: e.currentTarget.value }, 'label')}></textarea>
        </label>
        {#if ninfo.shape === 'screen'}
          <p class="tiny muted">First line is the window title. Then: <code>[Entrar]</code> a button, <code>Nombre: ___</code> a field, <code># Título</code> a heading, anything else plain text.</p>
        {/if}
        {#if ninfo.shape === 'process' && node.type !== 'system'}
          <p class="tiny muted">Start with the number ("1.2 Validar campos"); it goes in the top band.</p>
        {/if}
        {#if ninfo.shape === 'datastore'}
          <p class="tiny muted">Start with the id ("D1 Usuarios"); it goes in the left cell.</p>
        {/if}
        {#if hasStereo}
          <label class="field">Stereotype <input type="text" placeholder={ninfo.stereotype ?? 'e.g. entity, boundary, control'} value={node.stereotype ?? ''} oninput={(e) => setNode({ stereotype: e.currentTarget.value || undefined }, 'stereo')} /></label>
        {/if}
        {#if ninfo.shape === 'class'}
          <label class="check small"><input type="checkbox" checked={!!node.abstract} onchange={(e) => setNode({ abstract: e.currentTarget.checked })} /> Abstract (name in italics)</label>
          <label class="field">{node.type === 'enum' ? 'Literals' : 'Attributes'} — one per line
            <textarea class="mono" rows="5" value={(node.attrs ?? []).join('\n')} oninput={(e) => setNode({ attrs: lines(e.currentTarget.value) }, 'attrs')}></textarea>
          </label>
          {#if node.type !== 'enum'}
            <label class="field">Operations — one per line
              <textarea class="mono" rows="5" value={(node.ops ?? []).join('\n')} oninput={(e) => setNode({ ops: lines(e.currentTarget.value) }, 'ops')}></textarea>
            </label>
          {/if}
          <p class="tiny muted">Visibility: <code>+</code> public, <code>-</code> private, <code>#</code> protected, <code>~</code> package. Add <code>{'{static}'}</code> to underline, <code>{'{abstract}'}</code> for italics. Double-click a compartment on the canvas to edit it in place.</p>
        {/if}
        {#if ninfo.shape === 'state'}
          <label class="field">Internal activities — one per line
            <textarea class="mono" rows="3" placeholder="entry / …&#10;do / …&#10;exit / …" value={(node.attrs ?? []).join('\n')} oninput={(e) => setNode({ attrs: lines(e.currentTarget.value) }, 'attrs')}></textarea>
          </label>
        {/if}
        {#if ninfo.shape === 'device'}
          <div class="field">Icon
            <input type="search" placeholder="Search icons (server, cloud, lock…)" bind:value={iconQuery} />
            <div class="icons">
              {#each iconResults as name (name)}
                <button class="icon small" class:active={node.icon === name} title={name} aria-label={name} onclick={() => setNode({ icon: name })}><Icon {name} size={16} /></button>
              {/each}
            </div>
          </div>
        {/if}
        {#if colourable}
          <div class="field">Colour <Swatches value={node.color} onPick={(c) => setNode({ color: c })} /></div>
        {/if}
        {#if kind === 'mindmap' && node.type !== 'note'}
          <div class="row">
            <button class="secondary small" onclick={() => onAddChild(node!.id)}><Icon name="CornerDownRight" size={14} /> Add under <kbd class="quiet">Tab</kbd></button>
            {#if node.parent}<button class="secondary small" onclick={() => onAddSibling(node!.id)}><Icon name="Plus" size={14} /> Add beside <kbd class="quiet">Enter</kbd></button>{/if}
          </div>
          {#if node.parent}
            <label class="field">Hangs from
              <select value={node.parent} onchange={(e) => reparent(e.currentTarget.value)}>
                {#each parentChoices as p (p.id)}<option value={p.id}>{p.label || '(empty)'}</option>{/each}
              </select>
            </label>
          {/if}
        {/if}
        {#if node.type === 'usecase'}
          {@const spec = { ...blankSpec(), ...(node.spec ?? {}) }}
          <div class="spec">
            <button class="spec-head" onclick={() => (specOpen = !specOpen)} aria-expanded={specOpen}>
              <Icon name={specOpen ? 'ChevronDown' : 'ChevronRight'} size={15} />
              <span class="sect">Use case specification</span>
            </button>
            {#if specOpen}
              <div class="stack">
                <div class="row">
                  <label class="field code">Code <input type="text" value={spec.code} placeholder={nextCode()} oninput={(e) => setSpec('code', e.currentTarget.value)} /></label>
                  <label class="field grow">Priority <input type="text" value={spec.priority} placeholder="Alta / Media / Baja" oninput={(e) => setSpec('priority', e.currentTarget.value)} /></label>
                </div>
                <label class="field">Primary actor <input type="text" value={spec.primaryActor} oninput={(e) => setSpec('primaryActor', e.currentTarget.value)} /></label>
                <label class="field">Secondary actors <input type="text" value={spec.secondaryActors} oninput={(e) => setSpec('secondaryActors', e.currentTarget.value)} /></label>
                <button class="inline small" onclick={fillActors}>Fill actors from the lines in the diagram</button>
                <label class="field">Description <textarea rows="2" value={spec.description} oninput={(e) => setSpec('description', e.currentTarget.value)}></textarea></label>
                <label class="field">Trigger <input type="text" value={spec.trigger} oninput={(e) => setSpec('trigger', e.currentTarget.value)} /></label>
                <label class="field">Preconditions <textarea rows="2" value={spec.preconditions} oninput={(e) => setSpec('preconditions', e.currentTarget.value)}></textarea></label>
                <label class="field">Main flow — one step per line <textarea rows="6" value={spec.mainFlow} placeholder={'El socio …\nEl sistema …'} oninput={(e) => setSpec('mainFlow', e.currentTarget.value)}></textarea></label>
                <label class="field">Alternative flows — "3a. …" <textarea rows="4" value={spec.alternativeFlows} oninput={(e) => setSpec('alternativeFlows', e.currentTarget.value)}></textarea></label>
                <label class="field">Postconditions <textarea rows="2" value={spec.postconditions} oninput={(e) => setSpec('postconditions', e.currentTarget.value)}></textarea></label>
                <label class="field">Frequency <input type="text" value={spec.frequency} oninput={(e) => setSpec('frequency', e.currentTarget.value)} /></label>
                <p class="tiny muted">Export → "Use case specifications (Markdown)" gives one table per use case.</p>
              </div>
            {/if}
          </div>
        {/if}
        <label class="field">Notes (not drawn) <textarea rows="2" value={node.note ?? ''} oninput={(e) => setNode({ note: e.currentTarget.value || undefined }, 'note')}></textarea></label>
      {:else if edge && einfo}
        <label class="field">Type
          <select value={edge.type} onchange={(e) => setEdge({ type: e.currentTarget.value, ...(edgeTypeInfo(kind, e.currentTarget.value).messages ? { messages: edge!.messages ?? [] } : {}) })}>
            {#each palette.edges as t (t.type)}<option value={t.type}>{t.es} · {t.label}</option>{/each}
          </select>
        </label>
        <label class="field">{kind === 'state' ? 'Transition — evento [guarda] / acción' : kind === 'activity' || kind === 'flowchart' ? 'Guard / label — e.g. [disponible]' : kind === 'conceptmap' ? 'Linking phrase' : kind === 'dfd' ? 'Data that flows' : 'Label'}
          <textarea bind:this={labelField} rows="2" value={edge.label ?? ''} oninput={(e) => setEdge({ label: e.currentTarget.value || undefined }, 'label')}></textarea>
        </label>
        {#if einfo.ends}
          <div class="row">
            <label class="field grow">At {data.nodes.find((n) => n.id === edge!.from)?.label || 'source'}
              <input type="text" placeholder={kind === 'er' ? '1' : '1..*'} value={edge.fromLabel ?? ''} oninput={(e) => setEdge({ fromLabel: e.currentTarget.value || undefined }, 'from')} />
            </label>
            <label class="field grow">At {data.nodes.find((n) => n.id === edge!.to)?.label || 'target'}
              <input type="text" placeholder={kind === 'er' ? 'N' : '0..*'} value={edge.toLabel ?? ''} oninput={(e) => setEdge({ toLabel: e.currentTarget.value || undefined }, 'to')} />
            </label>
          </div>
          <p class="tiny muted">{kind === 'er' ? 'Cardinality at each end (1, N, M, (0,1), (1,N)…).' : 'Multiplicity or role at each end (1, 0..1, *, 1..*).'}</p>
        {/if}
        {#if einfo.messages}
          <div class="sect">Messages</div>
          {#each edge.messages ?? [] as m, i (i)}
            <div class="row msg">
              <input type="text" class="seq" value={m.seq} aria-label="Number" oninput={(e) => setMessages((ms) => (ms[i].seq = e.currentTarget.value))} />
              <input type="text" value={m.text} aria-label="Message" oninput={(e) => setMessages((ms) => (ms[i].text = e.currentTarget.value))} />
              <button class="icon small" title={m.dir === 'forward' ? 'Points to the target — click to flip' : 'Points to the source — click to flip'} aria-label="Flip direction" onclick={() => setMessages((ms) => (ms[i].dir = ms[i].dir === 'forward' ? 'back' : 'forward'))}>
                <Icon name={m.dir === 'forward' ? 'ArrowRight' : 'ArrowLeft'} size={14} />
              </button>
              <button class="icon small" aria-label="Remove message" onclick={() => setMessages((ms) => ms.splice(i, 1))}><Icon name="X" size={14} /></button>
            </div>
          {/each}
          <button class="secondary small" onclick={() => setMessages((ms) => ms.push({ seq: nextSeq(), text: 'mensaje()', dir: 'forward' }))}><Icon name="Plus" size={14} /> Add message</button>
          <p class="tiny muted">→ goes from {data.nodes.find((n) => n.id === edge!.from)?.label} to {data.nodes.find((n) => n.id === edge!.to)?.label}. Number them in order ("1", "1.1", "2").</p>
        {/if}
        <button class="secondary small" onclick={() => setEdge({ from: edge!.to, to: edge!.from, fromLabel: edge!.toLabel, toLabel: edge!.fromLabel })}><Icon name="ArrowLeftRight" size={14} /> Reverse direction</button>
      {:else}
        <p class="small muted">{nodeIds.length} shapes, {edgeIds.length} lines.</p>
        {#if nodeIds.length > 1 && kind !== 'mindmap'}
          <div class="sect">Align</div>
          <div class="row wrap">
            <button class="icon" title="Align left" aria-label="Align left" onclick={() => align('left')}><Icon name="AlignStartVertical" size={16} /></button>
            <button class="icon" title="Centre horizontally" aria-label="Centre horizontally" onclick={() => align('hcenter')}><Icon name="AlignCenterVertical" size={16} /></button>
            <button class="icon" title="Align top" aria-label="Align top" onclick={() => align('top')}><Icon name="AlignStartHorizontal" size={16} /></button>
            <button class="icon" title="Centre vertically" aria-label="Centre vertically" onclick={() => align('vcenter')}><Icon name="AlignCenterHorizontal" size={16} /></button>
            <button class="icon" title="Distribute horizontally" aria-label="Distribute horizontally" onclick={() => align('hdist')}><Icon name="AlignHorizontalSpaceAround" size={16} /></button>
            <button class="icon" title="Distribute vertically" aria-label="Distribute vertically" onclick={() => align('vdist')}><Icon name="AlignVerticalSpaceAround" size={16} /></button>
          </div>
        {/if}
      {/if}
    </div>
  </aside>
{/if}

<style>
  .mono {
    font-family: var(--mono);
    font-size: 12px;
  }
  .icons {
    display: flex;
    flex-wrap: wrap;
    gap: 2px;
    max-height: 132px;
    overflow: auto;
  }
  .spec {
    border-top: 1px solid var(--line);
    padding-top: var(--sp-2);
  }
  .spec-head {
    padding: 0;
    height: 26px;
  }
  .code {
    width: 90px;
    flex: none;
  }
  .grow {
    flex: 1;
    min-width: 0;
  }
  .msg {
    gap: 4px;
  }
  .seq {
    width: 52px !important;
    flex: none;
  }
  .wrap {
    flex-wrap: wrap;
  }
  .row > .field {
    min-width: 0;
  }
</style>
