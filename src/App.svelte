<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from './lib/stores/app.svelte';
  import { kindInfo } from './lib/model/kinds';
  import { moduleFor } from './lib/editors/registry';
  import type { BackupMeta } from './lib/storage/diagrams';
  import { storage } from './lib/storage/diagrams';
  import type { TextExport } from './lib/editors/types';
  import Icon from './lib/components/Icon.svelte';
  import Panel from './lib/components/Panel.svelte';
  import DiagramList from './lib/components/DiagramList.svelte';
  import NewDiagram from './lib/components/NewDiagram.svelte';
  import Notices from './lib/components/Notices.svelte';

  type Menu = 'export' | 'more' | null;
  type Side = 'notes' | 'versions' | 'help' | null;

  let menu = $state<Menu>(null);
  let side = $state<Side>(null);
  let newOpen = $state(false);
  let backups = $state<BackupMeta[]>([]);

  onMount(() => void app.init());

  const info = $derived(app.doc ? kindInfo(app.doc.kind) : null);
  const mod = $derived(app.doc ? moduleFor(app.doc.kind) : null);
  const Editor = $derived(mod?.component);
  const textExports = $derived.by((): TextExport[] => {
    if (!app.doc || !mod) return [];
    try {
      return (mod.exports as (d: typeof app.doc) => TextExport[])(app.doc);
    } catch {
      return [];
    }
  });

  function toggle(m: Exclude<Menu, null>) {
    menu = menu === m ? null : m;
  }

  async function openVersions() {
    menu = null;
    side = 'versions';
    backups = await app.listBackups();
  }

  async function importText() {
    menu = null;
    if (!app.doc || !mod?.importText) return;
    const imp = mod.importText;
    const s = await storage();
    const file = await s.importText({ name: imp.label, extensions: imp.extensions, mime: 'text/plain' });
    if (!file) return;
    try {
      const data = (imp.parse as (t: string, c: unknown) => unknown)(file.text, $state.snapshot(app.doc.data));
      app.change((d) => {
        (d as { data: unknown }).data = data;
      });
      app.notify(`Imported ${file.name}.`);
    } catch (err) {
      app.notify(`Couldn't import: ${err instanceof Error ? err.message : err}`, 'error');
    }
  }

  function typing(e: KeyboardEvent): boolean {
    const t = e.target as HTMLElement | null;
    return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  }

  function onKey(e: KeyboardEvent) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 's') {
      e.preventDefault();
      void app.flush();
      return;
    }
    if (mod && e.key.toLowerCase() === 'n' && app.dir) {
      e.preventDefault();
      newOpen = true;
      return;
    }
    if (typing(e)) return;
    if (mod && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (e.shiftKey) app.redo();
      else app.undo();
    } else if (mod && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      app.redo();
    } else if (e.key === 'Escape' && (menu || side)) {
      menu = null;
      side = null;
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="shell" class:has-list={app.listOpen && !!app.dir}>
  <header class="top">
    <button class="icon" onclick={() => app.toggleList()} aria-label="Diagram list" title="Diagram list" aria-pressed={app.listOpen} disabled={!app.dir}>
      <Icon name="PanelLeft" />
    </button>
    {#if app.doc && info}
      <span class="kind" title="{info.label} · {info.course}"><Icon name={info.icon} size={16} /> <span class="kind-name">{info.es}</span></span>
      <input
        class="ghost-input title"
        type="text"
        aria-label="Title"
        value={app.doc.title}
        oninput={(e) => app.change((d) => (d.title = e.currentTarget.value), 'title')}
      />
      <input
        class="ghost-input project"
        type="text"
        aria-label="Project"
        placeholder="Project"
        value={app.doc.project}
        oninput={(e) => app.change((d) => (d.project = e.currentTarget.value), 'project')}
      />
      <div class="spacer"></div>
      <span class="status tiny muted" class:failed={app.saving === 'error'} aria-live="polite">
        {app.saving === 'pending' ? 'Saving…' : app.saving === 'error' ? 'Not saved' : 'Saved'}
      </span>
      <button class="icon" onclick={() => app.undo()} disabled={!app.canUndo} aria-label="Undo" title="Undo (Ctrl+Z)"><Icon name="Undo2" /></button>
      <button class="icon" onclick={() => app.redo()} disabled={!app.canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><Icon name="Redo2" /></button>
      <div class="menu-anchor">
        <button class:active={menu === 'export'} onclick={() => toggle('export')} aria-haspopup="menu" aria-expanded={menu === 'export'}><Icon name="Download" size={16} /> Export</button>
        {#if menu === 'export'}
          <button class="scrim" aria-label="Close menu" tabindex="-1" onclick={() => (menu = null)}></button>
          <div class="menu float arrive" role="menu">
            <button class="menu-row" role="menuitem" onclick={() => { menu = null; void app.exportImage('png'); }}><Icon name="Image" size={16} /> PNG image</button>
            <button class="menu-row" role="menuitem" onclick={() => { menu = null; void app.exportImage('svg'); }}><Icon name="FileImage" size={16} /> SVG image</button>
            <label class="check small muted pad"><input type="checkbox" checked={app.lightExports} onchange={(e) => app.setLightExports(e.currentTarget.checked)} /> White background</label>
            {#if textExports.length}
              <div class="sect pad">As text</div>
              {#each textExports as x (x.label)}
                <div class="row text-row">
                  <button class="menu-row" role="menuitem" onclick={() => { menu = null; void app.exportText(x); }}><Icon name="FileText" size={16} /> {x.label}</button>
                  <button class="icon small" title="Copy to the clipboard" aria-label="Copy {x.label}" onclick={() => { menu = null; void app.copyText(x); }}><Icon name="Copy" size={14} /></button>
                </div>
              {/each}
            {/if}
          </div>
        {/if}
      </div>
      <div class="menu-anchor">
        <button class="icon" class:active={menu === 'more'} onclick={() => toggle('more')} aria-label="More" title="More" aria-haspopup="menu" aria-expanded={menu === 'more'}><Icon name="Ellipsis" /></button>
        {#if menu === 'more'}
          <button class="scrim" aria-label="Close menu" tabindex="-1" onclick={() => (menu = null)}></button>
          <div class="menu float arrive right" role="menu">
            <button class="menu-row" role="menuitem" onclick={() => { menu = null; side = 'notes'; }}><Icon name="NotebookPen" size={16} /> Notes…</button>
            {#if mod?.importText}
              <button class="menu-row" role="menuitem" onclick={importText}><Icon name="FileInput" size={16} /> {mod.importText.label}…</button>
            {/if}
            <button class="menu-row" role="menuitem" onclick={() => { menu = null; void app.duplicate(); }}><Icon name="Copy" size={16} /> Duplicate</button>
            <button class="menu-row" role="menuitem" onclick={() => { menu = null; app.change((d) => (d.archived = !d.archived)); }}><Icon name="Archive" size={16} /> {app.doc.archived ? 'Unarchive' : 'Archive'}</button>
            <button class="menu-row" role="menuitem" onclick={openVersions}><Icon name="History" size={16} /> Previous versions…</button>
            <button class="menu-row danger" role="menuitem" onclick={() => { menu = null; void app.remove(); }}><Icon name="Trash2" size={16} /> Delete…</button>
            <div class="sect pad">Theme</div>
            <div class="pad">
              <div class="seg" role="radiogroup" aria-label="Theme">
                {#each [['system', 'Desktop'], ['light', 'Light'], ['dark', 'Dark']] as [v, l] (v)}
                  <button class:active={app.theme === v} role="radio" aria-checked={app.theme === v} onclick={() => app.setTheme(v as 'system')}>{l}</button>
                {/each}
              </div>
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <strong class="brand">se-ramify</strong>
      <div class="spacer"></div>
    {/if}
    <button class="icon" onclick={() => (side = side === 'help' ? null : 'help')} aria-label="Help" title="Help"><Icon name="CircleHelp" /></button>
  </header>

  {#if app.ready && !app.dir}
    <main class="welcome">
      <div class="stack card float">
        <h1>se-ramify</h1>
        <p>The diagrams of Software Engineering — UML, system and use case diagrams, stakeholder maps, design thinking boards, story maps, Kanban and Gantt — in one local app.</p>
        <p class="muted small">Each diagram is a plain JSON file in a folder you choose, so it's yours to sync, back up or put in git.</p>
        <button class="primary" onclick={() => app.pickDir()}><Icon name="FolderOpen" size={16} /> Choose a folder for diagrams</button>
      </div>
    </main>
  {:else if app.ready}
    {#if app.listOpen}<DiagramList onNew={() => (newOpen = true)} />{/if}
    <main class="editor-area">
      {#if app.doc && Editor}
        {#key app.doc.id}
          <Editor />
        {/key}
      {:else}
        <div class="empty-hint">
          <div class="stack">
            <p>{app.list.length ? 'Pick a diagram on the left, or make a new one.' : 'No diagrams yet.'}</p>
            <p><button class="primary" style="pointer-events:auto" onclick={() => (newOpen = true)}><Icon name="Plus" size={16} /> New diagram</button></p>
          </div>
        </div>
      {/if}
    </main>
  {/if}

  {#if side === 'notes' && app.doc}
    <Panel title="Notes" onClose={() => (side = null)}>
      <p class="tiny muted">About the whole diagram: decisions, sources, what's left to do. Saved with it, never drawn.</p>
      <textarea rows="16" value={app.doc.notes} oninput={(e) => app.change((d) => (d.notes = e.currentTarget.value), 'notes')}></textarea>
    </Panel>
  {:else if side === 'versions'}
    <Panel title="Previous versions" onClose={() => (side = null)}>
      <p class="tiny muted">A copy is kept every five minutes while you edit, and before a delete or a restore.</p>
      {#each backups as b (b.path)}
        <div class="row between">
          <span class="small">{new Date(b.when).toLocaleString()}</span>
          <button class="secondary small" onclick={() => app.restore(b)}>Restore</button>
        </div>
      {:else}
        <p class="small muted">No copies yet.</p>
      {/each}
    </Panel>
  {:else if side === 'help'}
    <Panel title="Help" onClose={() => (side = null)}>
      <div class="stack small help">
        <p>Every change saves itself within half a second. <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> redoes, <kbd>Ctrl</kbd>+<kbd>N</kbd> starts a new diagram.</p>
        <div class="sect">Canvas diagrams (UML, maps, DFD, E/R…)</div>
        <ul>
          <li>Click a shape in the toolbar to drop it in the middle, or drag it onto the canvas.</li>
          <li>Drag from the small dot on a hovered shape to another shape to connect them; the toolbar's relation menu picks the kind of line.</li>
          <li>Double-click a shape or a line to edit its text; the panel on the right edits everything else.</li>
          <li><kbd>Del</kbd> deletes, <kbd>Ctrl</kbd>+<kbd>D</kbd> duplicates, arrows nudge, <kbd>Ctrl</kbd>+<kbd>A</kbd> selects all, Shift+drag selects an area.</li>
          <li>Tidy lays the diagram out for you; containers (system, swimlanes, packages, nodes, zones) carry whatever is inside them.</li>
        </ul>
        <div class="sect">Mind maps</div>
        <ul>
          <li><kbd>Tab</kbd> adds an idea under the selected one, <kbd>Enter</kbd> one beside it, <kbd>F2</kbd> renames.</li>
        </ul>
        <div class="sect">Exports</div>
        <p>PNG and SVG for every diagram (on white by default). UML diagrams also export PlantUML; the Gantt exports Mermaid; specifications, stories and maps export Markdown; stories export Gherkin <code>.feature</code> files.</p>
        <p class="tiny muted">se-ramify {__APP_VERSION__}</p>
      </div>
    </Panel>
  {/if}

  {#if newOpen}<NewDiagram onClose={() => (newOpen = false)} />{/if}
  <Notices />
</div>

<style>
  .shell {
    position: relative;
    height: 100%;
  }
  .top {
    position: absolute;
    inset: 0 0 auto 0;
    height: var(--top-h);
    display: flex;
    align-items: center;
    gap: var(--sp-1);
    padding: 0 var(--sp-2);
    border-bottom: 1px solid var(--line);
    background: var(--panel);
    z-index: 40;
  }
  .brand {
    padding: 0 var(--sp-2);
  }
  .kind {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 var(--sp-2);
    color: var(--muted);
    font-size: var(--fs-sm);
    white-space: nowrap;
  }
  .title {
    font-weight: 700;
    width: auto;
    min-width: 120px;
    max-width: 340px;
    field-sizing: content;
  }
  .project {
    width: auto;
    min-width: 80px;
    max-width: 220px;
    color: var(--muted);
    field-sizing: content;
  }
  .status {
    padding: 0 var(--sp-2);
  }
  .menu-anchor {
    position: relative;
  }
  .menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    min-width: 240px;
    padding: var(--sp-1);
    display: flex;
    flex-direction: column;
    gap: 1px;
    z-index: 60;
  }
  .pad {
    padding: var(--sp-2);
  }
  .text-row {
    gap: 0;
  }
  .text-row .menu-row {
    flex: 1;
  }
  .welcome {
    position: absolute;
    inset: var(--top-h) 0 0 0;
    display: grid;
    place-items: center;
    padding: var(--sp-4);
  }
  .welcome .card {
    max-width: 480px;
    padding: var(--sp-5);
  }
  .welcome h1 {
    margin: 0;
    font-size: 22px;
  }
  .welcome button {
    align-self: flex-start;
  }
  .help ul {
    margin: 0;
    padding-left: 18px;
  }
  .help li + li {
    margin-top: 4px;
  }
  @media (max-width: 900px) {
    .kind-name,
    .project {
      display: none;
    }
  }
</style>
