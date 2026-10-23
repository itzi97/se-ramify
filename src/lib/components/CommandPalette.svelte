<script lang="ts" module>
  import type { DiagramKind } from '../model/types';

  export interface Command {
    id: string;
    label: string;
    section: 'Actions' | 'New diagram' | 'Hand-ins' | 'Folders' | 'View';
    icon?: string;
    /** Show this kind's badge instead of an icon. */
    kind?: DiagramKind;
    /** Right-hand hint: a shortcut or a project. */
    hint?: string;
    /** Other words it is found by. */
    keywords?: string;
    run: () => unknown;
  }
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import { app } from '../stores/app.svelte';
  import { kindInfo, shortName } from '../model/kinds';
  import Icon from './Icon.svelte';
  import KindBadge from './KindBadge.svelte';
  import { focusIn } from './focus';

  let { commands, onClose }: { commands: Command[]; onClose: () => void } = $props();

  type Item = (Command & { diagram?: false }) | { id: string; label: string; section: 'Diagrams'; kind: DiagramKind; hint: string; keywords: string; run: () => unknown; diagram: true; icon?: undefined };

  let query = $state('');
  let active = $state(0);
  let listEl: HTMLElement | undefined = $state();

  const fold = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const diagrams = $derived<Item[]>(
    app.list
      .filter((m) => !m.archived || app.showArchived)
      .map((m) => ({
        id: `d:${m.path}`,
        label: m.title.trim() || 'Sin título',
        section: 'Diagrams' as const,
        kind: m.kind,
        hint: m.project || 'No project',
        keywords: `${kindInfo(m.kind).es} ${kindInfo(m.kind).label} ${shortName(m.kind)} ${m.updatedBy ?? ''}`,
        diagram: true as const,
        run: () => app.open(m.path)
      }))
  );

  const ORDER = ['Diagrams', 'Folders', 'Actions', 'Hand-ins', 'New diagram', 'View'];

  const results = $derived.by((): Item[] => {
    const q = fold(query.trim());
    if (!q) return [...diagrams.slice(0, 6), ...commands.filter((c) => c.section !== 'New diagram' && c.section !== 'Folders')];
    const words = q.split(/\s+/);
    const scored: { item: Item; score: number }[] = [];
    for (const item of [...diagrams, ...commands] as Item[]) {
      const label = fold(item.label);
      const hay = `${label} ${fold(item.keywords ?? '')} ${fold(item.hint ?? '')}`;
      if (!words.every((w) => hay.includes(w))) continue;
      const score = label.startsWith(q) ? 0 : label.split(/[\s·—/()-]+/).some((p) => p.startsWith(words[0])) ? 1 : 2;
      scored.push({ item, score });
    }
    return scored
      .sort((a, b) => a.score - b.score || ORDER.indexOf(a.item.section) - ORDER.indexOf(b.item.section))
      .slice(0, 60)
      .map((s) => s.item);
  });

  /** Results grouped under their section names, in result order. */
  const sections = $derived.by(() => {
    const out: { name: string; items: { item: Item; i: number }[] }[] = [];
    results.forEach((item, i) => {
      let s = out.find((x) => x.name === item.section);
      if (!s) out.push((s = { name: item.section, items: [] }));
      s.items.push({ item, i });
    });
    return out;
  });
  // Flattened in the order shown, so the arrows go down the screen.
  const shown = $derived(sections.flatMap((s) => s.items.map((x) => x.item)));

  $effect(() => {
    void query;
    active = 0;
  });

  async function move(by: number) {
    if (!shown.length) return;
    active = (active + by + shown.length) % shown.length;
    await tick();
    listEl?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }

  function pick(item: Item | undefined) {
    if (!item) return;
    onClose();
    void item.run();
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') (e.preventDefault(), void move(1));
    else if (e.key === 'ArrowUp') (e.preventDefault(), void move(-1));
    else if (e.key === 'Enter') (e.preventDefault(), pick(shown[active]));
    else if (e.key === 'Escape') (e.preventDefault(), e.stopPropagation(), onClose());
  }
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && (e.preventDefault(), onClose())} />

<button class="scrim veil" aria-label="Close" tabindex="-1" onclick={onClose}></button>
<div class="palette float arrive" role="dialog" aria-modal="true" aria-label="Find a diagram or an action">
  <div class="q">
    <Icon name="Search" size={17} />
    <input
      type="text"
      bind:value={query}
      placeholder="Find a diagram or an action…"
      aria-label="Find"
      role="combobox"
      aria-expanded="true"
      aria-controls="palette-list"
      aria-activedescendant={shown[active] ? `pal-${active}` : undefined}
      use:focusIn
      onkeydown={onKey}
    />
    <kbd class="quiet">Esc</kbd>
  </div>
  <div class="results" id="palette-list" role="listbox" bind:this={listEl} aria-label="Results">
    {#each sections as s (s.name)}
      <div class="sect" role="presentation">{s.name}</div>
      {#each s.items as { item } (item.id)}
        {@const idx = shown.indexOf(item)}
        <div
          id="pal-{idx}"
          class="res"
          class:on={idx === active}
          role="option"
          aria-selected={idx === active}
          tabindex="-1"
          onpointermove={() => (active = idx)}
          onclick={() => pick(item)}
          onkeydown={(e) => e.key === 'Enter' && pick(item)}
        >
          {#if item.kind}<KindBadge kind={item.kind} size="sm" />{:else}<span class="ic"><Icon name={item.icon ?? 'Dot'} size={15} /></span>{/if}
          <span class="label" lang={item.diagram || item.section === 'New diagram' ? 'es' : undefined}>{item.label}</span>
          {#if item.hint}<span class="hint" lang={item.diagram ? 'es' : undefined}>{item.hint}</span>{/if}
        </div>
      {/each}
    {:else}
      <p class="none small muted">Nothing matches "{query}".</p>
    {/each}
  </div>
  <div class="foot tiny muted"><span><kbd class="quiet">↑</kbd><kbd class="quiet">↓</kbd> move</span><span><kbd class="quiet">Enter</kbd> open</span></div>
</div>

<style>
  .veil {
    background: var(--veil) !important;
    z-index: 90;
  }
  .palette {
    position: fixed;
    top: 12vh;
    left: 50%;
    transform: translateX(-50%);
    width: min(640px, calc(100vw - 32px));
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    z-index: 91;
    overflow: hidden;
  }
  .q {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 0 var(--sp-4);
    border-bottom: 1px solid var(--line);
    color: var(--muted);
  }
  .q input {
    flex: 1;
    height: 50px;
    padding: 0;
    border: 0 !important;
    background: transparent;
    font-size: var(--fs-lg);
    color: var(--ink);
    outline: none;
  }
  .results {
    flex: 1;
    min-height: 0;
    overflow: auto;
    padding: var(--sp-1) var(--sp-2) var(--sp-2);
  }
  .sect {
    padding: var(--sp-2) var(--sp-2) var(--sp-1);
  }
  .res {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    min-height: 34px;
    padding: 0 var(--sp-2);
    border-radius: var(--r-control);
    cursor: pointer;
  }
  .res.on {
    background: var(--selected);
  }
  .ic {
    display: inline-grid;
    place-items: center;
    width: 20px;
    color: var(--muted);
  }
  .res.on .ic {
    color: var(--accent);
  }
  .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hint {
    flex: none;
    max-width: 40%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: var(--fs-sm);
    color: var(--muted);
  }
  .none {
    padding: var(--sp-3);
  }
  .foot {
    display: flex;
    gap: var(--sp-4);
    padding: 6px var(--sp-4);
    border-top: 1px solid var(--line);
    background: var(--panel-2);
  }
</style>
