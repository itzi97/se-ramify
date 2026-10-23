<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from './lib/stores/app.svelte';
  import { GROUP_ORDER, KINDS, familyOf, kindInfo, shortName } from './lib/model/kinds';
  import type { DiagramKind } from './lib/model/types';
  import type { DeliverableId } from './lib/model/deliverables';
  import { moduleFor } from './lib/editors/registry';
  import type { BackupMeta } from './lib/storage/diagrams';
  import { isTauri, storage } from './lib/storage/diagrams';
  import type { TextExport } from './lib/editors/types';
  import Icon from './lib/components/Icon.svelte';
  import Panel from './lib/components/Panel.svelte';
  import DiagramList from './lib/components/DiagramList.svelte';
  import Tabs from './lib/components/Tabs.svelte';
  import PaletteDialog from './lib/components/PaletteDialog.svelte';
  import { palettes } from './lib/stores/palette.svelte';
  import NewDiagram from './lib/components/NewDiagram.svelte';
  import Deliverables from './lib/components/Deliverables.svelte';
  import { editedLine } from './lib/storage/team';
  import Notices from './lib/components/Notices.svelte';
  import ExportFormats from './lib/components/ExportFormats.svelte';
  import Home from './lib/components/Home.svelte';
  import KindBadge from './lib/components/KindBadge.svelte';
  import Avatar from './lib/components/Avatar.svelte';
  import CommandPalette, { type Command } from './lib/components/CommandPalette.svelte';
  import { exportProject } from './lib/export/project';
  import { focusIn } from './lib/components/focus';
  import { ago } from './lib/model/people';

  type Menu = 'export' | 'more' | null;
  type Side = 'notes' | 'versions' | 'help' | null;

  let menu = $state<Menu>(null);
  let side = $state<Side>(null);
  /** The new-diagram dialog, with a kind already picked when it came from the home screen or the palette. */
  let newOpen = $state<{ kind?: DiagramKind } | null>(null);
  let handIns = $state<{ project: string; tab?: DeliverableId } | null>(null);
  let paletteOpen = $state(false);
  let backups = $state<BackupMeta[]>([]);

  onMount(() => void app.init());

  // The window (taskbar, Alt+Tab) is named after the open diagram.
  $effect(() => {
    const title = app.doc ? `${app.doc.title.trim() || 'Sin título'} — se-ramify` : 'se-ramify';
    document.title = title;
    if (isTauri)
      void import('@tauri-apps/api/window')
        .then(({ getCurrentWindow }) => getCurrentWindow().setTitle(title))
        .catch(() => {});
  });

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

  const projects = $derived([...new Set(app.list.map((m) => m.project))].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'es'))));
  // The colours of the project in front (the open diagram's folder, else the one the list shows).
  $effect(() => {
    for (const p of new Set([palettes.project, app.cwd])) if (app.dir && !(p in palettes.byProject)) void palettes.load(p);
  });
  const topName = $derived(app.dir?.split(/[\\/]/).pop() || 'Top folder');
  const showHandIns = (project: string, tab?: DeliverableId) => (handIns = { project, tab });

  /** Everything the palette (Ctrl+K) can do, besides opening diagrams. */
  const commands = $derived.by((): Command[] => {
    const out: Command[] = [{ id: 'new', label: 'New diagram…', section: 'Actions', icon: 'Plus', hint: 'Ctrl+N', keywords: 'crear nuevo', run: () => (newOpen = {}) }];
    const doc = app.doc;
    if (doc) {
      out.push(
        { id: 'png', label: 'Export as PNG image', section: 'Actions', icon: 'Image', keywords: 'exportar imagen descargar download', run: () => app.exportImage('png') },
        { id: 'svg', label: 'Export as SVG image', section: 'Actions', icon: 'FileImage', keywords: 'exportar vector', run: () => app.exportImage('svg') },
        { id: 'copy', label: 'Copy as image', section: 'Actions', icon: 'ClipboardCopy', hint: 'Ctrl+Shift+C', keywords: 'copiar pegar paste clipboard', run: () => app.copyImage() },
        { id: 'docx', label: 'Export as Word document (.docx)', section: 'Actions', icon: 'FileText', keywords: 'word documento', run: () => app.exportDocx() },
        { id: 'pptx', label: 'Export as PowerPoint slide (.pptx)', section: 'Actions', icon: 'Presentation', keywords: 'powerpoint diapositiva slides', run: () => app.exportSlide() },
        { id: 'latex', label: 'Copy LaTeX figure', section: 'Actions', icon: 'Sigma', keywords: 'latex tex figura overleaf', run: () => app.copyLatexFigure() },
        ...textExports.map((x): Command => ({ id: `tx:${x.label}`, label: `Export ${x.label}`, section: 'Actions', icon: 'FileText', keywords: x.ext, run: () => app.exportText(x) })),
        { id: 'notes', label: 'Notes of this diagram', section: 'Actions', icon: 'NotebookPen', keywords: 'notas', run: () => (side = 'notes') },
        { id: 'versions', label: 'Previous versions', section: 'Actions', icon: 'History', keywords: 'restaurar historial backup restore', run: openVersions },
        { id: 'dup', label: 'Duplicate this diagram', section: 'Actions', icon: 'Copy', keywords: 'duplicar copia', run: () => app.duplicate() },
        { id: 'send', label: 'Save a copy to send…', section: 'Actions', icon: 'Send', keywords: 'enviar compartir share', run: () => app.exportDiagramFile() },
        { id: 'archive', label: doc.archived ? 'Unarchive this diagram' : 'Archive this diagram', section: 'Actions', icon: 'Archive', keywords: 'archivar', run: () => app.toggleArchive() },
        { id: 'delete', label: 'Delete this diagram…', section: 'Actions', icon: 'Trash2', keywords: 'borrar eliminar', run: () => app.remove() },
        { id: 'home', label: 'Home', section: 'View', icon: 'House', keywords: 'inicio recientes recent close cerrar', run: () => app.close() }
      );
      if (mod?.importText) out.push({ id: 'import-text', label: `${mod.importText.label}…`, section: 'Actions', icon: 'FileInput', keywords: 'importar', run: importText });
    }
    for (const f of app.entries.filter((e) => e.type === 'folder'))
      out.push({ id: `cd:${f.rel}`, label: f.rel, section: 'Folders', icon: 'Folder', keywords: 'carpeta ir go folder proyecto', run: () => app.showFolder(f.rel) });
    for (const p of projects) {
      out.push(
        { id: `hi:${p}`, label: `Hand-in checklist: ${p || topName}`, section: 'Hand-ins', icon: 'ClipboardCheck', keywords: 'entregas entrega e1 e2 e3 final checklist rubric', run: () => showHandIns(p) },
        { id: `ex:${p}`, label: `Export project: ${p || topName}`, section: 'Hand-ins', icon: 'PackageOpen', keywords: 'memoria exportar zip', run: () => exportProject(p) }
      );
    }
    for (const g of GROUP_ORDER)
      for (const k of KINDS.filter((k) => k.group === g))
        out.push({ id: `new:${k.kind}`, label: k.es, section: 'New diagram', kind: k.kind, hint: 'New', keywords: `${k.label} ${shortName(k.kind)} nuevo new crear`, run: () => (newOpen = { kind: k.kind }) });
    out.push(
      { id: 'example', label: 'Load the example project', section: 'Actions', icon: 'GraduationCap', keywords: 'ejemplo biblioya sample', run: async () => showHandIns(await app.loadExampleProject()) },
      { id: 'palette', label: 'Colours of this folder (company palette)…', section: 'Actions', icon: 'Palette', keywords: 'colores paleta marca empresa brand logo', run: () => (palettes.editing = palettes.project) },
      { id: 'mkdir', label: 'New folder…', section: 'Actions', icon: 'FolderPlus', keywords: 'carpeta nueva crear proyecto mkdir', run: async () => { if (!app.listOpen) await app.toggleList(); app.folderPrompt++; } },
      { id: 'import', label: 'Open a diagram file…', section: 'Actions', icon: 'FileInput', keywords: 'importar abrir json', run: () => app.importDiagramFile() },
      { id: 'folder', label: 'Use another folder…', section: 'Actions', icon: 'FolderOpen', keywords: 'carpeta directorio', run: () => app.pickDir() },
      { id: 'update', label: 'Check for a new version', section: 'Actions', icon: 'Sparkles', keywords: 'actualizar update', run: () => app.lookForUpdate(true) },
      { id: 'list', label: app.listOpen ? 'Hide the diagram list' : 'Show the diagram list', section: 'View', icon: 'PanelLeft', keywords: 'lista sidebar', run: () => app.toggleList() },
      { id: 'archived', label: app.showArchived ? 'Hide archived diagrams' : 'Show archived diagrams', section: 'View', icon: 'Archive', keywords: 'archivados', run: () => (app.showArchived = !app.showArchived) },
      { id: 'light', label: 'Light theme', section: 'View', icon: 'Sun', keywords: 'claro tema', run: () => app.setTheme('light') },
      { id: 'dark', label: 'Dark theme', section: 'View', icon: 'Moon', keywords: 'oscuro tema', run: () => app.setTheme('dark') },
      { id: 'system', label: 'Theme like the desktop', section: 'View', icon: 'Monitor', keywords: 'sistema tema', run: () => app.setTheme('system') },
      { id: 'help', label: 'Help and shortcuts', section: 'View', icon: 'CircleHelp', keywords: 'ayuda atajos', run: () => (side = 'help') }
    );
    return out;
  });

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
    if (!(await s.confirm(`Replace "${app.doc.title}" with ${file.name}? Undo (Ctrl+Z) brings the current version back.`, 'Import'))) return;
    try {
      const data = (imp.parse as (t: string, c: unknown) => unknown)(file.text, $state.snapshot(app.doc.data));
      app.change((d) => {
        (d as { data: unknown }).data = data;
      });
      const warn = imp.warnings?.(file.text) ?? [];
      if (warn.length) app.notify(`Imported ${file.name}; ${warn.length} line${warn.length === 1 ? '' : 's'} skipped or changed — ${warn.slice(0, 3).join('; ')}${warn.length > 3 ? '…' : ''}. The Text tab lists them all.`, 'error');
      else app.notify(`Imported ${file.name}.`);
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
      newOpen = {};
      return;
    }
    if (mod && e.key.toLowerCase() === 'k' && app.dir) {
      e.preventDefault();
      menu = null;
      paletteOpen = !paletteOpen;
      return;
    }
    if (mod && e.shiftKey && e.key.toLowerCase() === 'c' && app.doc) {
      e.preventDefault();
      void app.copyImage();
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

<div class="shell" class:has-list={app.listOpen && !!app.dir} class:has-tabs={!!app.dir && app.tabs.some((p) => app.list.some((m) => m.path === p))}>
  <header class="top">
    <button class="icon" onclick={() => app.toggleList()} aria-label="Diagram list" title="Diagram list" aria-pressed={app.listOpen} disabled={!app.dir}>
      <Icon name="PanelLeft" />
    </button>
    {#if app.doc && info}
      <button class="icon" onclick={() => app.close()} aria-label="Home" title="Home: recent diagrams, hand-ins, new diagrams"><Icon name="House" /></button>
      <span class="kind" style:--fam={familyOf(app.doc.kind).color} title="{info.es} · {info.label}&#10;In the course: {info.course}">
        <KindBadge kind={app.doc.kind} />
        <span class="kind-name" lang="es">{shortName(app.doc.kind)}</span>
      </span>
      <input
        class="ghost-input title"
        type="text"
        aria-label="Title"
        value={app.doc.title}
        oninput={(e) => app.change((d) => (d.title = e.currentTarget.value), 'title')}
        onblur={(e) => {
          if (!e.currentTarget.value.trim()) app.change((d) => (d.title = 'Sin título'));
        }}
        lang="es"
      />
      <span class="proj-pill" title="The folder this diagram is in: its diagrams share one hand-in checklist">
        <button class="folder-go small" onclick={() => app.showFolder(app.doc?.project ?? '')} title="Show this folder in the file list"><Icon name="Folder" size={14} /><span class="t" lang="es">{app.doc.project ? app.doc.project.split('/').pop() : (app.dir?.split(/[\\/]/).pop() ?? 'Top folder')}</span></button>
        <button class="icon small" aria-label="Hand-in checklist for this folder" title="Hand-in checklist: what E1, E2, E3 and the final ask for" onclick={() => app.doc && showHandIns(app.doc.project)}><Icon name="ClipboardCheck" size={15} /></button>
      </span>
      <div class="spacer"></div>
      {#if app.doc && app.presence[app.doc.id]?.length}
        {@const ps = app.presence[app.doc.id]}
        {@const editing = ps.some((p) => p.editing)}
        <span class="here-chip tiny" class:editing role="status" title={editing ? 'If you both change it, both versions are kept — agree who edits what.' : 'They have it open; nobody else is changing it right now.'}>
          <span class="faces">{#each ps.slice(0, 3) as p (p.client)}<Avatar name={p.name} size={18} state={p.editing ? 'editing' : 'here'} />{/each}</span>
          <span class="here-text">{app.presenceLine(app.doc.id).replace(/^./, (c) => c.toUpperCase())}</span>
        </span>
      {/if}
      <button
        class="status small"
        class:failed={app.saving === 'error'}
        class:pending={app.saving === 'pending'}
        aria-live="polite"
        title="{app.doc ? editedLine(app.doc.updated, app.doc.updatedBy) : ''}&#10;{app.saving === 'error' ? 'Click to try saving again' : 'Click for previous versions'}"
        onclick={() => (app.saving === 'error' ? app.flush() : openVersions())}
      >
        <Icon name={app.saving === 'error' ? 'CircleAlert' : app.saving === 'pending' ? 'LoaderCircle' : 'Check'} size={14} class={app.saving === 'pending' ? 'spin' : ''} />
        {app.saving === 'pending' ? 'Saving…' : app.saving === 'error' ? 'Not saved' : 'Saved'}
      </button>
      <button class="icon" onclick={() => app.undo()} disabled={!app.canUndo} aria-label="Undo" title="Undo (Ctrl+Z)"><Icon name="Undo2" /></button>
      <button class="icon" onclick={() => app.redo()} disabled={!app.canRedo} aria-label="Redo" title="Redo (Ctrl+Shift+Z)"><Icon name="Redo2" /></button>
      <button class="icon" onclick={() => ((menu = null), (paletteOpen = true))} aria-label="Find" title="Find a diagram or an action (Ctrl+K)"><Icon name="Search" /></button>
      <div class="menu-anchor">
        <button class:active={menu === 'export'} onclick={() => { void app.loadExportPrefs(); toggle('export'); }} aria-haspopup="menu" aria-expanded={menu === 'export'}><Icon name="Download" size={16} /> Export</button>
        {#if menu === 'export'}
          <button class="scrim" aria-label="Close menu" tabindex="-1" onclick={() => (menu = null)}></button>
          <div class="menu float arrive" role="menu">
            <div class="sect pad-s">Image</div>
            <button class="menu-row" role="menuitem" onclick={() => { menu = null; void app.exportImage('png'); }}><Icon name="Image" size={16} /> PNG image</button>
            <button class="menu-row" role="menuitem" onclick={() => { menu = null; void app.exportImage('svg'); }}><Icon name="FileImage" size={16} /> SVG image</button>
            <button class="menu-row" role="menuitem" onclick={() => { menu = null; void app.copyImage(); }}><Icon name="ClipboardCopy" size={16} /> Copy as image <kbd class="quiet">Ctrl+Shift+C</kbd></button>
            <div class="sect pad-s">Into a document</div>
            <button class="menu-row" role="menuitem" onclick={() => { menu = null; void app.exportDocx(); }}><Icon name="FileText" size={16} /> Word document (.docx)</button>
            <button class="menu-row" role="menuitem" onclick={() => { menu = null; void app.exportSlide(); }}><Icon name="Presentation" size={16} /> PowerPoint slide (.pptx)</button>
            <button class="menu-row" role="menuitem" onclick={() => { menu = null; void app.copyLatexFigure(); }}><Icon name="Sigma" size={16} /> Copy LaTeX figure</button>
            <div class="opts">
            <label class="check small muted pad"><input type="checkbox" checked={app.lightExports} onchange={(e) => app.setLightExports(e.currentTarget.checked)} /> White background</label>
            <div class="row pad size-row">
              <span class="small muted">Image size</span>
              <div class="seg" role="radiogroup" aria-label="Image size">
                {#each [[2, 'Normal'], [3, 'High'], [4, 'Print']] as [v, l] (v)}
                  <button class:active={app.imageScale === v} role="radio" aria-checked={app.imageScale === v} title="{v}× the screen resolution" onclick={() => app.setImageScale(v as 2)}>{l}</button>
                {/each}
              </div>
            </div>
            </div>
            {#if textExports.length}
              <div class="sect pad-s">As text</div>
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
            <button class="menu-row" role="menuitem" onclick={() => { menu = null; showHandIns(app.doc?.project ?? ''); }}><Icon name="ClipboardCheck" size={16} /> Hand-in checklist…</button>
            <button class="menu-row" role="menuitem" onclick={() => { menu = null; void app.duplicate(); }}><Icon name="Copy" size={16} /> Duplicate</button>
            <button class="menu-row" role="menuitem" onclick={() => { menu = null; void app.exportDiagramFile(); }}><Icon name="Send" size={16} /> Save a copy to send…</button>
            <button class="menu-row" role="menuitem" onclick={() => { menu = null; void app.toggleArchive(); }}><Icon name="Archive" size={16} /> {app.doc.archived ? 'Unarchive' : 'Archive'}</button>
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
      <span class="brand"><img src="/favicon.svg" alt="" width="20" height="20" /> se-ramify</span>
      <div class="spacer"></div>
      {#if app.dir}<button class="icon" onclick={() => (paletteOpen = true)} aria-label="Find" title="Find a diagram or an action (Ctrl+K)"><Icon name="Search" /></button>{/if}
    {/if}
    <button class="icon" onclick={() => (side = side === 'help' ? null : 'help')} aria-label="Help" title="Help"><Icon name="CircleHelp" /></button>
  </header>

  {#if app.ready && !app.dir}
    <main class="welcome">
      <div class="stack card float">
        <div class="marks" aria-hidden="true">
          {#each GROUP_ORDER as g (g)}{#each KINDS.filter((k) => k.group === g).slice(0, 2) as k (k.kind)}<KindBadge kind={k.kind} />{/each}{/each}
        </div>
        <h1><img src="/favicon.svg" alt="" width="36" height="36" /> se-ramify</h1>
        <p>Every diagram of Software Engineering — use cases, classes, sequences, stakeholder maps, design thinking boards, story maps, Kanban and Gantt — in one app, checked against the course's hand-ins.</p>
        <ol class="steps small">
          <li><strong>Choose a folder.</strong> Each diagram is a plain file in it, yours to back up or put in git.</li>
          <li><strong>Share that folder with your group</strong> (Google Drive, OneDrive, Dropbox or a git repo). Everyone sees the others' changes within seconds.</li>
        </ol>
        <button class="primary" onclick={() => app.pickDir()}><Icon name="FolderOpen" size={16} /> Choose a folder for diagrams</button>
      </div>
    </main>
  {:else if app.ready}
    {#if app.listOpen}<DiagramList onNew={() => (newOpen = {})} onHandIns={(p) => showHandIns(p)} />{/if}
    <Tabs />
    <main class="editor-area" lang="es">
      {#if app.doc && Editor}
        {#key app.doc.id}
          <Editor />
        {/key}
        {@const openMeta = app.list.find((m) => m.path === app.path)}
        {#if openMeta && (openMeta.dupOf || openMeta.conflict)}
          <div class="copy-banner float row" role="status">
            <Icon name="TriangleAlert" size={16} />
            <span class="small">{openMeta.conflict ? 'This is a conflict copy your sync app made: two people saved at once.' : 'This file is a copy of another diagram in the folder (same id), probably made by your sync app.'} Compare it with the original, then keep it or delete it.</span>
            {#if openMeta.dupOf}<button class="secondary small" onclick={() => app.open(openMeta.dupOf!)}><Icon name="SquareArrowOutUpRight" size={14} /> Open the original</button>{/if}
            <button class="secondary small" onclick={() => app.keepAsSeparate(openMeta)}><Icon name="CopyPlus" size={14} /> Keep as its own diagram</button>
            <button class="secondary small" onclick={() => app.removeFile(openMeta)}><Icon name="Trash2" size={14} /> Delete this copy</button>
          </div>
        {/if}
      {:else}
        <Home onNew={(kind) => (newOpen = { kind })} onHandIns={showHandIns} onPalette={() => (paletteOpen = true)} />
      {/if}
    </main>
  {/if}

  {#if side === 'notes' && app.doc}
    <Panel title="Notes" onClose={() => (side = null)}>
      <p class="tiny muted">About the whole diagram: decisions, sources, what's left to do. Saved with it, never drawn.</p>
      <textarea rows="16" use:focusIn value={app.doc.notes} oninput={(e) => app.change((d) => (d.notes = e.currentTarget.value), 'notes')}></textarea>
    </Panel>
  {:else if side === 'versions'}
    <Panel title="Previous versions" onClose={() => (side = null)}>
      <p class="tiny muted">A copy is kept every five minutes while you edit, and before a delete or a restore. Restoring keeps the current version as a copy too; <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes it.</p>
      {#if backups.length}
        <ol class="versions">
          {#each backups as b (b.path)}
            <li class="ver">
              <span class="when">
                <strong class="small">{new Date(b.when).toLocaleString(undefined, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</strong>
                <span class="tiny muted">{ago(b.when)}</span>
              </span>
              <button class="secondary small" onclick={() => app.restore(b)}><Icon name="RotateCcw" size={14} /> Restore</button>
            </li>
          {/each}
        </ol>
      {:else}
        <p class="small muted">No copies yet: the first one is kept after your first change.</p>
      {/if}
    </Panel>
  {:else if side === 'help'}
    <Panel title="Help" onClose={() => (side = null)}>
      <div class="stack small help">
        <p>Every change saves itself within half a second. <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> redoes, <kbd>Ctrl</kbd>+<kbd>N</kbd> starts a new diagram and <kbd>Ctrl</kbd>+<kbd>K</kbd> finds any diagram or action by typing. Inside a text box <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes your typing there; click outside it to undo whole steps.</p>
        <div class="sect">Files and folders</div>
        <ul>
          <li>The list works like a file browser: each folder is a project, with its diagrams and any other files (PDFs, slides, images). Click a folder to go in; the path above the list, <kbd>..</kbd> or <kbd>Backspace</kbd> go back up. Diagrams open here; other files open in the app your computer uses for them.</li>
          <li>The folder button next to <em>New diagram</em> makes a folder; new diagrams go in the folder you are looking at. Drag a file onto a folder, <kbd>..</kbd> or a folder in the path to move it there.</li>
          <li>Every diagram you open gets a tab above the canvas. <kbd>Ctrl</kbd>+<kbd>Tab</kbd> goes to the next one, <kbd>Ctrl</kbd>+<kbd>W</kbd> or a middle-click closes it. The folder pill in the top bar shows the open diagram's folder in the list.</li>
          <li>The coloured numbers at the top show one family of diagrams (company, UML, requirements, design thinking, planning, infrastructure); the badge of each diagram has its family's colour.</li>
          <li>Right-click a diagram (or its <kbd>⋯</kbd>) to rename, duplicate, move it to another folder, archive or delete it. <kbd>F2</kbd> renames the focused one, the arrows move between them.</li>
          <li>Searching or filtering looks in the folder you are in and every folder inside it. The sort button next to the search orders by date, title or kind, and shows archived diagrams.</li>
          <li>The house in the top bar goes back home: recent diagrams, how far each hand-in is, and every kind of diagram.</li>
        </ul>
        <div class="sect">One model across diagrams</div>
        <ul>
          <li>The diagrams in a folder are one project: a sequence diagram knows the classes and operations of the folder's class diagrams. It suggests them as you type, adds a class or actor as a participant in one click, and marks a message the class can't receive, with a fix (use the operation it meant, or add it to the class).</li>
          <li>Use case, class, activity, state and communication diagrams are checked for what a teacher marks down (the pill at the bottom left of the canvas). Click a check to go to the shape.</li>
          <li>Class and use case diagrams can be typed as PlantUML: <em>Text</em> in the toolbar. The drawing follows; shapes that already exist keep their place.</li>
        </ul>
        <div class="sect">Colours</div>
        <p>Each folder can have its own colours: the palette button above the list (or a folder's <kbd>⋯</kbd> → Colours) starts from a preset, the hex codes of the company's brand guide or its logo. Every colour picker offers them, and right-click on the canvas → <em>Colour by kind</em> paints each kind of shape in its colour. They are saved in the folder, so the whole group uses the same ones.</p>
        <div class="sect">Canvas diagrams (UML, maps, DFD, E/R…)</div>
        <ul>
          <li>Click a shape in the toolbar to drop it in the middle, or drag it onto the canvas.</li>
          <li>Drag from the small dot on a hovered shape to another shape to connect them; the toolbar's relation menu picks the kind of line.</li>
          <li>Double-click a shape or a line to edit its text; the panel on the right edits everything else.</li>
          <li><kbd>Del</kbd> deletes, <kbd>Ctrl</kbd>+<kbd>C</kbd> / <kbd>X</kbd> / <kbd>V</kbd> copy, cut and paste shapes (also between diagrams of the same kind), <kbd>Ctrl</kbd>+<kbd>D</kbd> duplicates, arrows nudge, <kbd>Ctrl</kbd>+<kbd>A</kbd> selects all, Shift+drag selects an area.</li>
          <li>Tidy lays the diagram out for you; containers (system, swimlanes, packages, nodes, zones) carry whatever is inside them, and light up when a shape you drag will land in them.</li>
          <li>Right-click a shape, a line or the empty canvas (or press <kbd>Shift</kbd>+<kbd>F10</kbd> / the Menu key) for what you can do there: rename, colour, duplicate, bring to front, change a line's type or direction, add a shape right where you clicked, paste there.</li>
          <li>Any shape or line can take a colour (right-click, or the Colour row in the side panel); exports keep it, on white paper.</li>
          <li>The map button under the zoom controls shows a mini map: drag it to move around, scroll on it to zoom.</li>
        </ul>
        <div class="sect">Mind maps</div>
        <ul>
          <li><kbd>Tab</kbd> adds an idea under the selected one, <kbd>Enter</kbd> one beside it, <kbd>F2</kbd> renames.</li>
        </ul>
        <div class="sect">Working as a team</div>
        <p>Everyone points the app at the same shared folder (Google Drive / OneDrive / Dropbox, or a git repo) and writes their name at the bottom of the list. Changes from others appear within a few seconds. Nobody's work is overwritten: if someone saved a diagram while you were editing it, theirs opens and yours is kept as a copy. ⋯ → <em>Save a copy to send…</em> and the file button next to <em>New diagram</em> pass single diagrams around.</p>
        <div class="sect">Hand-ins</div>
        <p>The checklist icon above the list (or a folder's ⋯ → Hand-in checklist) shows what E1, E2, E3 and the final hand-in ask for, which diagrams cover each part, what is still missing inside them, and exports just that hand-in; the home screen shows how far each one is. <em>Edit checklist</em> adapts it when the teacher asks for something different (shared with your group). The example project has every hand-in done for an invented library app.</p>
        <p><button class="secondary small" onclick={async () => { side = null; showHandIns(await app.loadExampleProject()); }}><Icon name="GraduationCap" size={14} /> Load the example project</button></p>
        <div class="sect">Exports</div>
        <p><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> copies the diagram as an image to paste into Word, Google Docs or PowerPoint. The Export menu also makes a Word document or a PowerPoint slide of the diagram, and copies a LaTeX figure for its PNG; <em>Image size</em> sets how sharp images are (they keep their on-screen size in documents).</p>
        <p>The box icon above the list exports the folder you are in as a project — every diagram as a PNG plus the memoria with the specifications and stories, as Markdown and, if you tick them, Word, LaTeX and a PowerPoint deck for the presentation.</p>
        <p>PNG and SVG for every diagram (on white by default). UML diagrams also export PlantUML; the Gantt exports Mermaid; specifications, stories and maps export Markdown; stories export Gherkin <code>.feature</code> files.</p>
        <div class="row upd">
          <label class="check small"><input type="checkbox" checked={app.checkUpdates} onchange={(e) => app.setCheckUpdates(e.currentTarget.checked)} /> Tell me when a new version is out</label>
          <button class="secondary small" onclick={() => app.lookForUpdate(true)}><Icon name="RefreshCw" size={14} /> Check now</button>
        </div>
        <p class="tiny muted">Asks GitHub once a day which version is the latest; nothing else is sent, nothing is installed. se-ramify {__APP_VERSION__}</p>
      </div>
    </Panel>
  {/if}

  {#if newOpen}<NewDiagram initialKind={newOpen.kind} onClose={() => (newOpen = null)} />{/if}
  {#if handIns}
    {#key `${handIns.project}|${handIns.tab}`}<Deliverables project={handIns.project} initialTab={handIns.tab} onClose={() => (handIns = null)} />{/key}
  {/if}
  {#if paletteOpen}<CommandPalette {commands} onClose={() => (paletteOpen = false)} />{/if}
  <ExportFormats />
  {#if palettes.editing !== null}<PaletteDialog />{/if}
  <Notices />
</div>

<style>
  .upd {
    gap: var(--sp-3);
    flex-wrap: wrap;
  }
  .here-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    max-width: 340px;
    height: 28px;
    padding: 0 10px 0 5px;
    border-radius: var(--r-pill);
    border: 1px solid color-mix(in srgb, var(--ok) 55%, var(--line));
    background: color-mix(in srgb, var(--ok) 8%, var(--panel));
    color: var(--ink-2);
  }
  .here-chip.editing {
    border-color: color-mix(in srgb, var(--warn) 60%, var(--line));
    background: color-mix(in srgb, var(--warn) 12%, var(--panel));
  }
  .here-chip .faces {
    display: inline-flex;
    gap: 6px;
    padding-left: 3px;
  }
  .here-text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .copy-banner {
    position: absolute;
    left: 50%;
    bottom: var(--sp-4);
    transform: translateX(-50%);
    z-index: 40;
    gap: var(--sp-2);
    max-width: min(900px, calc(100% - 32px));
    padding: var(--sp-2) var(--sp-3);
    border-left: 3px solid var(--warn, #c98a12);
    flex-wrap: wrap;
  }
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
    display: inline-flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 0 var(--sp-2);
    font-weight: 700;
  }
  .brand img {
    border-radius: 5px;
  }
  .kind {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 0 var(--sp-2) 0 var(--sp-1);
    color: var(--fam);
    font-size: var(--fs-sm);
    font-weight: 700;
    white-space: nowrap;
  }
  .title {
    font-weight: 700;
    width: auto;
    min-width: 120px;
    max-width: 340px;
    field-sizing: content;
    text-overflow: ellipsis;
  }
  /* The folder, as a pill: shows it in the file list; the checklist beside it. */
  .proj-pill {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    height: 30px;
    margin-left: var(--sp-1);
    padding: 0 3px;
    border-radius: var(--r-pill);
    background: var(--panel-2);
    color: var(--muted);
  }
  .proj-pill:hover {
    box-shadow: inset 0 0 0 1px var(--line);
  }
  .folder-go {
    height: 26px;
    max-width: 220px;
    padding: 0 8px;
    gap: 5px;
    color: var(--ink-2);
    font-weight: 400;
  }
  .folder-go :global(.lucide) {
    flex: none;
    color: var(--fam-company);
  }
  .folder-go .t {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .proj-pill button {
    border-radius: var(--r-pill);
  }
  .proj-pill button:hover {
    color: var(--accent);
    background: var(--selected);
  }
  .status {
    gap: 5px;
    padding: 0 10px;
    color: var(--muted);
  }
  .status :global(.lucide) {
    color: var(--ok);
  }
  .status.pending :global(.lucide) {
    color: var(--muted);
  }
  .status.failed,
  .status.failed :global(.lucide) {
    color: var(--danger);
  }
  :global(.spin) {
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
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
  /* A section label inside a menu: sits close to the rows it names. */
  .pad-s {
    padding: var(--sp-2) var(--sp-2) 2px;
  }
  .pad-s:not(:first-child) {
    margin-top: var(--sp-1);
    border-top: 1px solid var(--line);
    padding-top: var(--sp-3);
  }
  .opts {
    margin: var(--sp-1) 0;
    padding-top: var(--sp-1);
    border-top: 1px solid var(--line);
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
    max-width: 520px;
    padding: var(--sp-5) 28px 28px;
  }
  .welcome h1 {
    display: flex;
    align-items: center;
    gap: var(--sp-3);
    margin: 0;
    font-size: 24px;
  }
  .welcome h1 img {
    border-radius: 9px;
  }
  .welcome button {
    align-self: flex-start;
  }
  .marks {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding-bottom: var(--sp-1);
  }
  .steps {
    margin: 0;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    color: var(--ink-2);
  }
  /* Previous versions: newest first, on a line through time. */
  .versions {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .ver {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--sp-3);
    padding: 7px 0 7px 20px;
  }
  .ver::before {
    content: '';
    position: absolute;
    left: 4px;
    top: 0;
    bottom: 0;
    width: 2px;
    background: var(--line);
  }
  .ver:first-child::before {
    top: 50%;
  }
  .ver:last-child::before {
    bottom: 50%;
  }
  .ver::after {
    content: '';
    position: absolute;
    left: 0;
    top: 50%;
    width: 10px;
    height: 10px;
    margin-top: -5px;
    border-radius: 50%;
    background: var(--panel);
    box-shadow: inset 0 0 0 2px var(--muted);
  }
  .ver:first-child::after {
    box-shadow: inset 0 0 0 2px var(--accent);
  }
  .when {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .help ul {
    margin: 0;
    padding-left: 18px;
  }
  .help li + li {
    margin-top: 4px;
  }
  @media (max-width: 1100px) {
    .here-text {
      display: none;
    }
  }
  @media (max-width: 900px) {
    .kind-name,
    .proj-pill {
      display: none;
    }
  }
  .size-row {
    justify-content: space-between;
    gap: var(--sp-3);
    white-space: nowrap;
    padding-top: var(--sp-1);
    padding-bottom: var(--sp-1);
  }
</style>
