<script lang="ts">
  /**
   * The file browser, like Jupyter's: the diagrams folder and its subfolders
   * (each folder is a project), with every file in them. Diagrams open in a
   * tab; other files open in their own app.
   */
  import { tick } from 'svelte';
  import { app } from '../stores/app.svelte';
  import { FAMILIES, GROUP_ORDER, KINDS, kindInfo, shortName, type KindInfo } from '../model/kinds';
  import type { DiagramMeta } from '../model/types';
  import type { Entry } from '../storage/diagrams';
  import { baseName, crumbs, fileIcon, joinRel, parentOf, within } from '../storage/paths';
  import { isTauri } from '../storage/diagrams';
  import { palettes } from '../stores/palette.svelte';
  import Icon from './Icon.svelte';
  import KindBadge from './KindBadge.svelte';
  import Avatar from './Avatar.svelte';
  import { exportProject } from '../export/project';
  import { editedLine } from '../storage/team';
  import { openReleasePage } from '../desktop/update';
  import { ago } from '../model/people';
  import { focusIn } from './focus';

  /** The name field takes the keyboard only when opened from the name chip, not when it shows as a prompt. */
  const focusWhen = (node: HTMLElement, on: boolean) => {
    if (on) focusIn(node, true);
  };

  type Group = KindInfo['group'];
  type Sort = 'recent' | 'az' | 'kind';
  type Row = { e: Entry; m?: DiagramMeta };

  let { onNew, onHandIns }: { onNew: () => void; onHandIns: (project: string) => void } = $props();

  /* How this person likes the list: remembered in this window only. */
  const PREF = 'se-ramify:ui:list';
  function readPref(): { sort?: Sort } {
    try {
      return JSON.parse(localStorage.getItem(PREF) ?? '{}') ?? {};
    } catch {
      return {};
    }
  }
  let query = $state('');
  let family = $state<Group | null>(null);
  /** The family under the pointer in the filter: its rows stay bright, the rest dim, before any click. */
  let peek = $state<Group | null>(null);
  let sort = $state<Sort>(readPref().sort ?? 'recent');
  let viewOpen = $state(false);
  let nameOpen = $state(false);
  let newFolder = $state<string | null>(null);
  // The palette's "New folder" lands here.
  let seenPrompt = app.folderPrompt;
  $effect(() => {
    if (app.folderPrompt !== seenPrompt) {
      seenPrompt = app.folderPrompt;
      newFolder = '';
    }
  });
  $effect(() => {
    const v = JSON.stringify({ sort });
    try {
      localStorage.setItem(PREF, v);
    } catch {
      /* storage blocked: the list just forgets */
    }
  });

  const KIND_ORDER = new Map(GROUP_ORDER.flatMap((g) => KINDS.filter((k) => k.group === g)).map((k, i) => [k.kind, i]));
  /** Lower case, no accents: "comunicacion" finds "Comunicación". */
  const fold = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const metaByPath = $derived(new Map(app.list.map((m) => [m.path, m])));
  const rootName = $derived(app.dir?.split(/[\\/]/).pop() || 'Diagrams');

  /** Searching or filtering looks through the current folder and every folder inside it. */
  const searching = $derived(!!query.trim() || !!family);
  const words = $derived(fold(query.trim()).split(/\s+/).filter(Boolean));
  const hit = (text: string) => words.every((w) => fold(text).includes(w));
  const visibleDiagram = (m: DiagramMeta) => !m.archived || app.showArchived;

  /** Diagrams in view (for the family counts): this folder, or this folder and below while searching. */
  const inView = $derived(
    app.list.filter((m) => visibleDiagram(m) && (searching ? within(m.project, app.cwd) : m.project === app.cwd) && (!words.length || hit(`${m.title} ${m.project} ${kindInfo(m.kind).label} ${kindInfo(m.kind).es} ${shortName(m.kind)} ${m.updatedBy ?? ''}`)))
  );
  const counts = $derived.by(() => {
    const c = new Map<Group, number>();
    for (const m of inView) c.set(kindInfo(m.kind).group, (c.get(kindInfo(m.kind).group) ?? 0) + 1);
    return c;
  });

  const byTitle = (a: DiagramMeta, b: DiagramMeta) => a.title.localeCompare(b.title, 'es', { numeric: true, sensitivity: 'base' });
  const cmp = $derived(sort === 'az' ? byTitle : sort === 'kind' ? (a: DiagramMeta, b: DiagramMeta) => (KIND_ORDER.get(a.kind) ?? 0) - (KIND_ORDER.get(b.kind) ?? 0) || byTitle(a, b) : (a: DiagramMeta, b: DiagramMeta) => b.updated.localeCompare(a.updated));
  const byName = (a: Entry, b: Entry) => a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' });

  /** Folders first, then diagrams (sorted as chosen), then the other files. */
  const rows = $derived.by((): Row[] => {
    const diagrams = inView.filter((m) => !family || kindInfo(m.kind).group === family).sort(cmp);
    const diagramRows = diagrams.map((m): Row => ({ e: app.entries.find((e) => e.path === m.path) ?? { type: 'diagram', rel: m.path, name: m.title, folder: m.project, path: m.path }, m }));
    if (searching) {
      const others = family ? [] : app.entries.filter((e) => e.type !== 'diagram' && within(e.folder, app.cwd) && e.rel !== app.cwd && hit(e.name)).sort(byName);
      return [...others.filter((e) => e.type === 'folder').map((e) => ({ e })), ...diagramRows, ...others.filter((e) => e.type === 'file').map((e) => ({ e }))];
    }
    const here = app.entries.filter((e) => e.folder === app.cwd && e.type !== 'diagram');
    return [...here.filter((e) => e.type === 'folder').sort(byName).map((e) => ({ e })), ...diagramRows, ...here.filter((e) => e.type === 'file').sort(byName).map((e) => ({ e }))];
  });
  /** How many diagrams a folder holds, its subfolders included. */
  const countIn = (rel: string) => app.list.filter((m) => within(m.project, rel) && visibleDiagram(m)).length;
  const folders = $derived(app.entries.filter((e) => e.type === 'folder').map((e) => e.rel).sort((a, b) => a.localeCompare(b, 'es')));
  const archivedCount = $derived(app.list.filter((m) => m.archived).length);
  const cwdHasDiagrams = $derived(app.list.some((m) => within(m.project, app.cwd)));

  // The open diagram's row stays in sight, however it was opened (home, search, a tab).
  $effect(() => {
    if (app.path) requestAnimationFrame(() => document.querySelector('.list .item.on')?.scrollIntoView({ block: 'nearest' }));
  });

  /** Someone else changed it in the last three days: their colour on the row says so. */
  const fresh = (m: DiagramMeta) => !!m.updatedBy && m.updatedBy !== app.userName && Date.now() - Date.parse(m.updated) < 3 * 86_400_000;

  /* --------------------------------------------- drag a row onto a folder */

  let drag = $state<{ r: Row; x: number; y: number; over: string | null } | null>(null);
  /** A drag ends in a click on the row it started from; that click must not open it. */
  let dragged = false;
  const label = (r: Row) => (r.m ? r.m.title.trim() || 'Sin título' : r.e.name);
  const folderOf = (r: Row) => (r.m ? r.m.project : r.e.folder);

  function dragStart(e: PointerEvent, r: Row) {
    if (e.button !== 0 || renaming || r.e.type === 'folder') return;
    const sx = e.clientX;
    const sy = e.clientY;
    let started = false;
    const move = (ev: PointerEvent) => {
      if (!started && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
      if (!started) {
        started = true;
        document.body.classList.add('dragging-row');
      }
      const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('.list [data-folder]');
      drag = { r, x: ev.clientX, y: ev.clientY, over: target ? (target.dataset.folder ?? null) : null };
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.body.classList.remove('dragging-row');
      if (!started) return;
      const to = drag?.over ?? null;
      drag = null;
      dragged = true;
      setTimeout(() => (dragged = false));
      if (to !== null && to !== folderOf(r)) void app.moveEntry(r.e, to);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }
  const dropOn = (rel: string) => drag !== null && drag.over === rel && folderOf(drag.r) !== rel;

  async function activate(r: Row, btn?: HTMLElement) {
    if (dragged) return;
    if (r.e.type === 'folder') {
      query = '';
      family = null;
      await app.cd(r.e.rel);
      await tick();
      document.querySelector<HTMLElement>('.list .item .main')?.focus();
      return;
    }
    await app.openEntry(r.e);
    // Hand the keyboard to the diagram (Del, arrows, Ctrl+A act on the canvas, not on this button).
    if (r.e.type === 'diagram') btn?.blur();
  }

  async function addFolder(name: string | null) {
    newFolder = null;
    if (name?.trim()) await app.mkdir(name);
  }

  /* ------------------------------------------------------------ row menu */

  let menu = $state<{ r: Row; x: number; y: number; move: boolean } | null>(null);
  let renaming = $state<string | null>(null);
  let newProject = $state('');

  function openMenu(r: Row, x: number, y: number) {
    menu = { r, x, y, move: false };
    newProject = '';
  }
  function fromButton(e: MouseEvent & { currentTarget: HTMLElement }, r: Row) {
    if (menu?.r.e.path === r.e.path) return void (menu = null);
    const b = e.currentTarget.getBoundingClientRect();
    openMenu(r, b.left, b.bottom + 4);
  }
  /** Keep the menu inside the window and put the keyboard on its first item. */
  function placed(node: HTMLElement, at: { x: number; y: number; move: boolean }) {
    const fit = (p: { x: number; y: number }) => {
      const b = node.getBoundingClientRect();
      node.style.left = `${Math.max(8, Math.min(p.x, window.innerWidth - b.width - 8))}px`;
      node.style.top = `${Math.max(8, Math.min(p.y, window.innerHeight - b.height - 8))}px`;
    };
    fit(at);
    node.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    return {
      update: (next: { x: number; y: number; move: boolean }) =>
        requestAnimationFrame(() => {
          fit(next);
          node.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
        })
    };
  }
  function menuKeys(e: KeyboardEvent & { currentTarget: HTMLElement }) {
    if (e.key === 'Escape') {
      e.stopPropagation();
      menu = null;
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  }
  function closeOnOutside(e: PointerEvent) {
    if (menu && !(e.target as HTMLElement).closest?.('.row-menu, .more')) menu = null;
    if (viewOpen && !(e.target as HTMLElement).closest?.('.view-pop, .view-btn')) viewOpen = false;
  }
  /** Start the action first: it reads the row from the menu, which closing clears. */
  function run(fn: () => unknown) {
    const started = fn();
    menu = null;
    void started;
  }

  async function startRename(r: Row) {
    menu = null;
    renaming = r.e.path;
    await tick();
    const input = document.querySelector<HTMLInputElement>('.rename');
    input?.focus();
    input?.select();
  }
  function endRename(r: Row, value: string | null) {
    if (renaming !== r.e.path) return;
    renaming = null;
    if (value === null) return;
    if (r.m) void app.renameFile(r.m.path, value);
    else void app.renameEntry(r.e, value);
  }

  /** Up and down move between rows; Backspace goes up a folder; F2 renames the focused one. */
  function rowKeys(e: KeyboardEvent, r: Row) {
    if (e.key === 'F2') {
      e.preventDefault();
      void startRename(r);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const all = [...document.querySelectorAll<HTMLElement>('.list .item .main')];
      const i = all.indexOf(e.currentTarget as HTMLElement);
      all[i + (e.key === 'ArrowDown' ? 1 : -1)]?.focus();
    } else if (e.key === 'Backspace' && app.cwd) {
      e.preventDefault();
      void app.cd(parentOf(app.cwd));
    } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      const b = (e.currentTarget as HTMLElement).getBoundingClientRect();
      openMenu(r, b.left + 24, b.bottom);
    }
  }
</script>

<svelte:window
  onpointerdown={closeOnOutside}
  onkeydown={(e) => {
    if (e.key === 'Escape' && (viewOpen || menu)) {
      viewOpen = false;
      menu = null;
    }
  }}
/>

<nav class="list" aria-label="Files">
  <div class="head">
    <div class="row new-row">
      <button class="primary new" onclick={onNew} title="New diagram in this folder (Ctrl+N)"><Icon name="Plus" size={16} /> New diagram</button>
      <button class="icon secondary" onclick={() => (newFolder = '')} aria-label="New folder" title="New folder here"><Icon name="FolderPlus" size={16} /></button>
      <button class="icon secondary" onclick={() => app.importDiagramFile()} aria-label="Open a diagram file" title="Add a diagram file someone sent you (.json) to this folder"><Icon name="FileInput" size={16} /></button>
    </div>
    <div class="row find">
      <span class="search">
        <Icon name="Search" size={14} />
        <input type="search" placeholder={family ? `Find ${FAMILIES[family].label} here and below` : 'Find here and below'} bind:value={query} aria-label="Find files" onkeydown={(e) => e.key === 'Escape' && query && (e.stopPropagation(), (query = ''))} />
      </span>
      <button class="icon small view-btn" class:active={viewOpen} aria-label="Sort and show" aria-expanded={viewOpen} title="Sort, show archived" onclick={() => (viewOpen = !viewOpen)}><Icon name="ArrowDownWideNarrow" size={15} /></button>
      {#if viewOpen}
        <div class="view-pop float arrive" role="dialog" aria-label="Sort and show">
          <div class="sect" id="sort-label">Sort diagrams</div>
          <div role="radiogroup" aria-labelledby="sort-label" class="sorts">
            {#each [['recent', 'Recently changed', 'Clock'], ['az', 'Title A–Z', 'ArrowDownAZ'], ['kind', 'Kind of diagram', 'Shapes']] as [v, l, ic] (v)}
              <button class="menu-row" class:picked={sort === v} role="radio" aria-checked={sort === v} onclick={() => (sort = v as Sort)}>
                <Icon name={ic} size={15} /> <span class="grow">{l}</span>{#if sort === v}<Icon name="Check" size={15} />{/if}
              </button>
            {/each}
          </div>
          <label class="check small show-arch"><input type="checkbox" bind:checked={app.showArchived} /> Show archived{archivedCount ? ` (${archivedCount})` : ''}</label>
        </div>
      {/if}
    </div>
    {#if app.list.length}
      <div class="fams" role="group" aria-label="Show one family of diagrams">
        <button class="fam all" class:on={!family} aria-pressed={!family} onclick={() => (family = null)} title="Every kind">All</button>
        {#each GROUP_ORDER as g (g)}
          {@const n = family || query.trim() ? (counts.get(g) ?? 0) : app.list.filter((m) => visibleDiagram(m) && within(m.project, app.cwd) && kindInfo(m.kind).group === g).length}
          <button
            class="fam"
            class:on={family === g}
            style:--fam={FAMILIES[g].color}
            aria-pressed={family === g}
            aria-label="{FAMILIES[g].label}: {n}"
            title="{FAMILIES[g].label} · {n} diagram{n === 1 ? '' : 's'} here and below"
            disabled={!n && family !== g}
            onpointerenter={() => (peek = g)}
            onpointerleave={() => (peek = null)}
            onclick={() => (family = family === g ? null : g)}>{n}</button
          >
        {/each}
      </div>
    {/if}
  </div>

  <!-- Where you are: every folder on the way is a button, and a place to drop files. -->
  <div class="crumbs" aria-label="Folder">
    <div class="trail">
      {#each crumbs(app.cwd) as c, i (c)}
        {#if i}<Icon name="ChevronRight" size={12} />{/if}
        <button class="crumb" class:here={c === app.cwd} class:drop={dropOn(c)} data-folder={c} aria-current={c === app.cwd ? 'location' : undefined} onclick={() => app.cd(c)} title={c ? c : `The top folder: ${app.dir ?? ''}`}>
          {#if !i}<Icon name="House" size={13} />{/if}<span>{i ? baseName(c) : rootName}</span>
        </button>
      {/each}
    </div>
    {#if cwdHasDiagrams}
      <span class="cacts">
        <button class="icon small" title="Hand-ins: what E1, E2, E3 and the final ask for, and what's missing" aria-label="Hand-in checklist for {app.cwd || 'the top folder'}" onclick={() => onHandIns(app.cwd)}><Icon name="ClipboardCheck" size={15} /></button>
        <button class="icon small" title="Export this folder as a project: every diagram as PNG plus the memoria" aria-label="Export {app.cwd || 'the top folder'}" onclick={() => exportProject(app.cwd)}><Icon name="PackageOpen" size={15} /></button>
      </span>
    {/if}
    <button class="icon small pal" title="Colours of this folder{palettes.byProject[app.cwd] ? `: ${palettes.byProject[app.cwd]!.name}` : ''} (the company's, a preset…)" aria-label="Colours of {app.cwd || 'the top folder'}" onclick={() => (palettes.editing = app.cwd)}>
      {#if palettes.byProject[app.cwd]}<span class="mini-strip">{#each palettes.byProject[app.cwd]!.colors.slice(0, 4) as s (s.hex)}<span style:background={s.hex}></span>{/each}</span>{:else}<Icon name="Palette" size={15} />{/if}
    </button>
  </div>

  <div class="scroll">
    {#if app.cwd && !searching}
      <div class="item up" class:drop={dropOn(parentOf(app.cwd))} data-folder={parentOf(app.cwd)}>
        <button class="main" onclick={() => app.cd(parentOf(app.cwd))} title="Up to {parentOf(app.cwd) ? baseName(parentOf(app.cwd)) : rootName}" aria-label="Up one folder">
          <span class="ficon"><Icon name="CornerLeftUp" size={15} /></span>
          <span class="t muted">..</span>
        </button>
      </div>
    {/if}
    {#if newFolder !== null}
      <div class="item">
        <span class="main editing-row">
          <span class="ficon folder-ic"><Icon name="Folder" size={15} /></span>
          <input
            class="rename"
            type="text"
            placeholder="Folder name"
            aria-label="New folder name"
            use:focusIn
            onkeydown={(e) => {
              if (e.key === 'Enter') void addFolder(e.currentTarget.value);
              else if (e.key === 'Escape') (e.stopPropagation(), (newFolder = null));
            }}
            onblur={(e) => void addFolder(e.currentTarget.value)}
          />
        </span>
      </div>
    {/if}
    {#each rows as r (r.e.path)}
      {@const m = r.m}
      {@const ps = m ? (app.presence[m.id] ?? []) : []}
      {@const isFolder = r.e.type === 'folder'}
      <div
        class="item"
        class:on={!!m && m.path === app.path}
        class:open-tab={!!m && m.path !== app.path && app.tabs.includes(m.path)}
        class:archived={m?.archived}
        class:dim={peek !== null && (!m || kindInfo(m.kind).group !== peek)}
        class:menu-open={menu?.r.e.path === r.e.path}
        class:drop={isFolder && dropOn(r.e.rel)}
        class:lifted={drag?.r.e.path === r.e.path}
        data-folder={isFolder ? r.e.rel : undefined}
        oncontextmenu={(e) => (e.preventDefault(), openMenu(r, e.clientX, e.clientY))}
        role="presentation"
      >
        {#if renaming === r.e.path}
          <span class="main editing-row">
            {#if m}<KindBadge kind={m.kind} size="sm" />{:else}<span class="ficon"><Icon name={isFolder ? 'Folder' : fileIcon(r.e.name)} size={15} /></span>{/if}
            <input
              class="rename"
              type="text"
              value={label(r)}
              aria-label="New name"
              lang="es"
              onkeydown={(e) => {
                if (e.key === 'Enter') endRename(r, e.currentTarget.value);
                else if (e.key === 'Escape') (e.stopPropagation(), endRename(r, null));
              }}
              onblur={(e) => endRename(r, e.currentTarget.value)}
            />
          </span>
        {:else}
          <button
            class="main"
            onpointerdown={(e) => dragStart(e, r)}
            onclick={(e) => activate(r, e.currentTarget)}
            onkeydown={(e) => rowKeys(e, r)}
            aria-current={m && m.path === app.path ? 'page' : undefined}
            title={m
              ? `${kindInfo(m.kind).es} · ${kindInfo(m.kind).label}${m.dupOf ? ' · copy of another file (made by a sync app?)' : m.conflict ? ' · conflict copy from your sync app' : ''}${m.archived ? ' · archived' : ''}\n${editedLine(m.updated, m.updatedBy)}${ps.length ? `\n${app.presenceLine(m.id)} now` : ''}`
              : isFolder
                ? `Folder ${r.e.rel}`
                : `${r.e.rel}\nOpens in the app your computer uses for it`}
          >
            {#if m}
              <KindBadge kind={m.kind} size="sm" />
            {:else}
              <span class="ficon" class:folder-ic={isFolder}><Icon name={isFolder ? 'Folder' : fileIcon(r.e.name)} size={15} /></span>
            {/if}
            <span class="names">
              <span class="t" lang="es">{label(r)}</span>
              {#if searching && folderOf(r) !== app.cwd}<span class="where tiny">{folderOf(r) || rootName}</span>{/if}
            </span>
            <span class="meta">
              {#if isFolder}
                {@const n = countIn(r.e.rel)}
                {#if n}<span class="count tiny">{n}</span>{/if}
              {:else if m}
                {#if m.dupOf || m.conflict}<span class="warn" aria-label="Copy"><Icon name="TriangleAlert" size={13} /></span>{/if}
                {#if m.archived}<Icon name="Archive" size={13} />{/if}
                {#if ps.length}
                  <span class="faces" aria-label={app.presenceLine(m.id)}>
                    {#each ps.slice(0, 2) as p (p.client)}<Avatar name={p.name} size={16} state={p.editing ? 'editing' : 'here'} title="{p.name} {p.editing ? 'is editing it' : 'has it open'}" />{/each}
                    {#if ps.length > 2}<span class="more-n">+{ps.length - 2}</span>{/if}
                  </span>
                {:else if fresh(m)}
                  <Avatar name={m.updatedBy!} size={16} title={editedLine(m.updated, m.updatedBy)} />
                {:else}
                  <span class="when tiny">{ago(m.updated)}</span>
                {/if}
              {/if}
            </span>
          </button>
          <button class="icon small more" aria-label="Actions for {label(r)}" aria-haspopup="menu" tabindex="-1" onclick={(e) => fromButton(e, r)}><Icon name="Ellipsis" size={15} /></button>
        {/if}
      </div>
    {:else}
      {#if newFolder === null}
        <div class="empty">
          {#if searching}
            <p class="small muted">Nothing matches{query ? ` "${query}"` : ''}{family ? ` in ${FAMILIES[family].label}` : ''} in {app.cwd ? baseName(app.cwd) : rootName} or its folders.</p>
            <button class="secondary small" onclick={() => ((query = ''), (family = null))}><Icon name="X" size={14} /> Clear the search</button>
          {:else if app.cwd}
            <p class="small muted">An empty folder. New diagrams you make here go in it.</p>
          {:else}
            <p class="small muted">No diagrams in this folder yet.</p>
            <button class="secondary small" onclick={async () => onHandIns(await app.loadExampleProject())}><Icon name="GraduationCap" size={14} /> Load the example project</button>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
  <div class="foot">
    {#if app.update}
      <div class="update">
        <Icon name="Sparkles" size={14} />
        <span class="small">se-ramify {app.update.version} is out</span>
        <button class="primary small" onclick={() => openReleasePage(app.update!.url)}>Download</button>
      </div>
    {/if}
    {#if app.problems.length}
      <details class="trash problems" open>
        <summary class="small"><Icon name="TriangleAlert" size={13} /> Files that need attention ({app.problems.length})</summary>
        {#each app.problems as p (p.path)}
          <div class="prob">
            <span class="t small" title={p.error}>{p.name}</span>
            {#if p.gitConflict}
              <span class="tiny muted">Git merge conflict. Keep:</span>
              <span class="row acts2">
                <button class="secondary small" onclick={() => app.resolveGitConflict(p, 'ours')} title="Your version (before the merge)">Mine</button>
                <button class="secondary small" onclick={() => app.resolveGitConflict(p, 'theirs')} title="The incoming version">Theirs</button>
                <button class="secondary small" onclick={() => app.resolveGitConflict(p, 'both')} title="Yours stays in this file; theirs becomes a new diagram">Both</button>
              </span>
            {:else}
              <span class="tiny muted">Not a readable diagram: {p.error.slice(0, 120)}</span>
            {/if}
          </div>
        {/each}
      </details>
    {/if}
    {#if app.deleted.length}
      <details class="trash">
        <summary class="small muted"><Icon name="Trash2" size={13} /> Recently deleted ({app.deleted.length})</summary>
        {#each app.deleted.slice(0, 20) as d (d.id)}
          <div class="row between del">
            <span class="t small">{d.title || 'Sin título'}</span>
            <button class="secondary small" onclick={() => app.undelete(d)}><Icon name="RotateCcw" size={14} /> Restore</button>
          </div>
        {/each}
      </details>
    {/if}
    {#if nameOpen || !app.userName}
      <label class="me-field tiny" title="Saved with every diagram you edit, so your team sees who changed what">
        <span class="muted">Your name, so your team sees who changed what</span>
        <input
          type="text"
          placeholder="e.g. Itziar"
          value={app.userName}
          use:focusWhen={nameOpen}
          onchange={(e) => app.setUserName(e.currentTarget.value)}
          onkeydown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
          }}
          onblur={() => (nameOpen = false)}
        />
      </label>
    {/if}
    <div class="row bottom">
      <button class="small folder" onclick={() => app.pickDir()} title="The shared folder: {app.dir ?? ''}&#10;Click to choose another">
        <Icon name="FolderOpen" size={14} />
        <span class="t">{app.dir?.split(/[\\/]/).pop() ?? 'Choose folder'}</span>
      </button>
      {#if app.userName && !nameOpen}
        <button class="small who" onclick={() => (nameOpen = true)} title="You appear as {app.userName} to your team. Click to change.">
          <Avatar name={app.userName} size={18} />
          <span class="t">{app.userName}</span>
        </button>
      {/if}
    </div>
  </div>
</nav>

{#if drag}
  <div class="ghost float" style:left="{drag.x + 14}px" style:top="{drag.y + 10}px" aria-hidden="true">
    {#if drag.r.m}<KindBadge kind={drag.r.m.kind} size="sm" />{:else}<Icon name={fileIcon(drag.r.e.name)} size={15} />{/if}
    <span class="t">{label(drag.r)}</span>
    {#if drag.over !== null && drag.over !== folderOf(drag.r)}<span class="to tiny">→ {drag.over ? baseName(drag.over) : rootName}</span>{/if}
  </div>
{/if}

{#if menu}
  {@const r = menu.r}
  {@const m = r.m}
  {@const isFolder = r.e.type === 'folder'}
  <div class="row-menu float arrive" role="menu" tabindex="-1" aria-label="Actions for {label(r)}" use:placed={{ x: menu.x, y: menu.y, move: menu.move }} onkeydown={menuKeys}>
    <div class="mhead">
      {#if m}<KindBadge kind={m.kind} size="sm" />{:else}<span class="ficon" class:folder-ic={isFolder}><Icon name={isFolder ? 'Folder' : fileIcon(r.e.name)} size={15} /></span>{/if}
      <span class="t small">{label(r)}</span>
    </div>
    {#if menu.move}
      <button class="menu-row" role="menuitem" onclick={() => menu && (menu.move = false)}><Icon name="ChevronLeft" size={15} /> <span class="muted">Move to…</span></button>
      <div class="sep"></div>
      {#if folderOf(r)}<button class="menu-row" role="menuitem" onclick={() => run(() => app.moveEntry(r.e, ''))}><Icon name="House" size={15} /> <span class="t">{rootName}</span></button>{/if}
      {#each folders.filter((f) => f !== folderOf(r)) as f (f)}
        <button class="menu-row" role="menuitem" onclick={() => run(() => app.moveEntry(r.e, f))}><Icon name="Folder" size={15} /> <span class="t">{f}</span></button>
      {/each}
      <form class="newp" onsubmit={(e) => (e.preventDefault(), newProject.trim() && run(() => app.moveEntry(r.e, joinRel(app.cwd, newProject))))}>
        <input type="text" placeholder="New folder here…" bind:value={newProject} aria-label="New folder" />
        <button class="primary small" disabled={!newProject.trim()}>Move</button>
      </form>
    {:else if isFolder}
      <button class="menu-row" role="menuitem" onclick={() => run(() => activate(r))}><Icon name="FolderOpen" size={15} /> Open</button>
      <button class="menu-row" role="menuitem" onclick={() => startRename(r)}><Icon name="PencilLine" size={15} /> <span class="grow">Rename</span><kbd class="quiet">F2</kbd></button>
      <button class="menu-row" role="menuitem" onclick={() => run(async () => (await app.cd(r.e.rel), onNew()))}><Icon name="Plus" size={15} /> New diagram here</button>
      {#if countIn(r.e.rel)}
        <button class="menu-row" role="menuitem" onclick={() => run(() => onHandIns(r.e.rel))}><Icon name="ClipboardCheck" size={15} /> Hand-in checklist</button>
        <button class="menu-row" role="menuitem" onclick={() => run(() => exportProject(r.e.rel))}><Icon name="PackageOpen" size={15} /> Export as a project…</button>
      {/if}
      <button class="menu-row" role="menuitem" onclick={() => run(() => (palettes.editing = r.e.rel))}><Icon name="Palette" size={15} /> Colours…</button>
      {#if isTauri}<button class="menu-row" role="menuitem" onclick={() => run(() => app.reveal(r.e.path))}><Icon name="FolderSearch" size={15} /> Show in file manager</button>{/if}
      <div class="sep"></div>
      <button class="menu-row danger" role="menuitem" disabled={app.entries.some((e) => e.folder === r.e.rel)} title={app.entries.some((e) => e.folder === r.e.rel) ? 'Only empty folders can be deleted here' : ''} onclick={() => run(() => app.removeFolder(r.e))}><Icon name="Trash2" size={15} /> Delete folder</button>
    {:else if m}
      {#if m.path !== app.path}<button class="menu-row" role="menuitem" onclick={() => run(() => app.open(m.path))}><Icon name="SquareArrowOutUpRight" size={15} /> Open</button>{/if}
      <button class="menu-row" role="menuitem" onclick={() => startRename(r)}><Icon name="PencilLine" size={15} /> <span class="grow">Rename</span><kbd class="quiet">F2</kbd></button>
      <button class="menu-row" role="menuitem" onclick={() => run(() => app.duplicateFile(m.path))}><Icon name="Copy" size={15} /> Duplicate</button>
      <button class="menu-row" role="menuitem" onclick={() => menu && (menu.move = true)}><Icon name="FolderInput" size={15} /> <span class="grow">Move to folder</span><Icon name="ChevronRight" size={14} /></button>
      <button class="menu-row" role="menuitem" onclick={() => run(() => onHandIns(m.project))}><Icon name="ClipboardCheck" size={15} /> Hand-in checklist</button>
      <button class="menu-row" role="menuitem" onclick={() => run(() => app.exportDiagramFile(m.path))}><Icon name="Send" size={15} /> Save a copy to send…</button>
      <button class="menu-row" role="menuitem" onclick={() => run(() => app.setArchived(m.path, !m.archived))}><Icon name={m.archived ? 'ArchiveRestore' : 'Archive'} size={15} /> {m.archived ? 'Unarchive' : 'Archive'}</button>
      <div class="sep"></div>
      <button class="menu-row danger" role="menuitem" onclick={() => run(() => app.deleteFile(m.path))}><Icon name="Trash2" size={15} /> Delete…</button>
    {:else}
      <button class="menu-row" role="menuitem" onclick={() => run(() => app.openEntry(r.e))}><Icon name="SquareArrowOutUpRight" size={15} /> Open in its app</button>
      <button class="menu-row" role="menuitem" onclick={() => run(() => app.reveal(r.e.path))}><Icon name="FolderSearch" size={15} /> Show in file manager</button>
      <button class="menu-row" role="menuitem" onclick={() => startRename(r)}><Icon name="PencilLine" size={15} /> <span class="grow">Rename</span><kbd class="quiet">F2</kbd></button>
      <button class="menu-row" role="menuitem" onclick={() => menu && (menu.move = true)}><Icon name="FolderInput" size={15} /> <span class="grow">Move to folder</span><Icon name="ChevronRight" size={14} /></button>
    {/if}
  </div>
{/if}

<style>
  .list {
    position: absolute;
    top: var(--top-h);
    left: 0;
    bottom: 0;
    width: var(--list-w);
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--line);
    background: var(--panel);
    z-index: 30;
  }
  .head {
    display: flex;
    flex-direction: column;
    gap: var(--sp-2);
    padding: var(--sp-3) var(--sp-3) var(--sp-2);
  }
  .new-row {
    gap: 6px;
  }
  .new {
    flex: 1;
    justify-content: center;
  }
  .find {
    position: relative;
    gap: 4px;
  }
  .search {
    flex: 1;
    position: relative;
    display: flex;
    align-items: center;
    color: var(--muted);
  }
  .search :global(.lucide) {
    position: absolute;
    left: 9px;
    pointer-events: none;
  }
  .search input {
    padding-left: 28px;
    height: 30px;
  }
  .view-btn.active {
    background: var(--press);
    color: var(--ink);
  }
  .view-pop {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    width: 220px;
    padding: var(--sp-2) var(--sp-1) var(--sp-1);
    display: flex;
    flex-direction: column;
    gap: 1px;
    z-index: 5;
  }
  .view-pop .sect {
    padding: 0 var(--sp-2) var(--sp-1);
  }
  .view-pop .picked {
    font-weight: 700;
  }
  .sorts {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .grow {
    flex: 1;
  }
  .show-arch {
    margin-top: var(--sp-1);
    padding: var(--sp-2);
    border-top: 1px solid var(--line);
  }

  /* Family filter: the counts in each family's colour, the same colours as the badges below. */
  .fams {
    display: flex;
    gap: 4px;
  }
  .fam {
    height: 24px;
    min-width: 26px;
    padding: 0 5px;
    justify-content: center;
    border-radius: 7px;
    font-size: var(--fs-xs);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--fam);
    background: color-mix(in srgb, var(--fam) 13%, var(--panel));
  }
  .fam:hover {
    color: var(--fam);
    background: color-mix(in srgb, var(--fam) 24%, var(--panel));
  }
  .fam.on,
  .fam.on:hover {
    color: var(--panel);
    background: var(--fam);
  }
  .fam:disabled {
    opacity: 0.35;
  }
  .fam.all {
    --fam: var(--ink-2);
    gap: 5px;
    padding: 0 8px;
    font-weight: 400;
    margin-right: 2px;
  }
  .fam.all.on {
    color: var(--panel);
    background: var(--ink-2);
  }

  .scroll {
    flex: 1;
    overflow: auto;
    padding: 0 var(--sp-2) var(--sp-3);
  }

  /* Rows: the kind's badge, the title, who is in it. */
  .item {
    position: relative;
    transition: opacity var(--t);
  }
  .item.dim {
    opacity: 0.3;
  }
  /* Dragging a row: it stays put, faded; the project under the pointer lights up. */
  .item.lifted {
    opacity: 0.4;
  }
  /* A folder under a dragged file lights up: drop it there to move the file in. */
  .item.drop,
  .crumb.drop {
    border-radius: var(--r-control);
    background: var(--selected);
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }
  .item.drop .main,
  .crumb.drop {
    color: var(--accent);
  }

  /* Where you are: the folders on the way, each a button. */
  .crumbs {
    display: flex;
    align-items: center;
    gap: var(--sp-1);
    margin: 0 var(--sp-2) var(--sp-1);
    padding: 2px 0 4px;
    border-bottom: 1px solid var(--line);
  }
  .trail {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 1px;
    overflow: hidden;
    color: var(--faint);
  }
  .crumb {
    min-width: 0;
    flex: 0 1 auto;
    height: 26px;
    padding: 0 5px;
    gap: 4px;
    border-radius: var(--r-control);
    font-size: var(--fs-sm);
    color: var(--muted);
  }
  .crumb span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .crumb:hover {
    color: var(--ink);
  }
  .crumb.here {
    flex-shrink: 0;
    max-width: 60%;
    color: var(--ink);
    font-weight: 700;
  }
  .pal {
    flex: none;
    color: var(--muted);
  }
  .mini-strip {
    display: flex;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    overflow: hidden;
    transform: rotate(45deg);
  }
  .mini-strip span {
    flex: 1;
  }
  .cacts {
    flex: none;
    display: flex;
    gap: 1px;
    color: var(--muted);
  }

  /* Folders and other files: an icon where diagrams have their badge. */
  .ficon {
    flex: none;
    display: inline-grid;
    place-items: center;
    width: 20px;
    color: var(--muted);
  }
  .folder-ic {
    color: var(--fam-company);
  }
  .names {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }
  .where {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--faint);
    font-weight: 400;
  }
  .count {
    padding: 0 6px;
    border-radius: var(--r-pill);
    background: var(--panel-2);
    font-variant-numeric: tabular-nums;
  }
  /* Open in a tab, not the one in front: a quiet dot. */
  .item.open-tab::before {
    content: '';
    position: absolute;
    left: -5px;
    top: 13px;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--accent);
    opacity: 0.6;
  }
  .ghost {
    position: fixed;
    z-index: 120;
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    max-width: 280px;
    padding: 5px 10px 5px 6px;
    pointer-events: none;
    font-size: var(--fs-sm);
    font-weight: 700;
  }
  .ghost .to {
    flex: none;
    color: var(--accent);
    font-weight: 400;
  }
  :global(body.dragging-row) {
    user-select: none;
    cursor: grabbing;
  }
  .main {
    width: 100%;
    min-height: 32px;
    height: auto;
    padding: 0 6px;
    gap: var(--sp-2);
    justify-content: flex-start;
    border-radius: var(--r-control);
    color: var(--ink-2);
    text-align: left;
  }
  .item.on .main {
    background: var(--selected);
    color: var(--ink);
    font-weight: 700;
  }
  .item.on::before {
    content: '';
    position: absolute;
    left: -7px;
    top: 7px;
    bottom: 7px;
    width: 3px;
    border-radius: 2px;
    background: var(--accent);
  }
  .item.archived .t {
    color: var(--muted);
    font-style: italic;
  }
  .t {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
  .main .t {
    flex: 1;
  }
  .meta {
    flex: none;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--muted);
  }
  .faces {
    display: inline-flex;
    gap: 5px;
    padding: 0 3px;
  }
  .more-n {
    font-size: var(--fs-xs);
    color: var(--muted);
  }
  .warn {
    color: var(--warn);
    display: inline-flex;
  }
  .more {
    position: absolute;
    right: 4px;
    top: 4px;
    opacity: 0;
    /* The hovered row's own colour, so the title runs under it unseen. */
    background: color-mix(in srgb, var(--ink) 7%, var(--panel));
  }
  .item.on .more {
    background: color-mix(in srgb, var(--accent) 13%, var(--panel));
  }
  .item:hover .more,
  .item.menu-open .more,
  .item:focus-within .more {
    opacity: 1;
  }
  .item:hover .meta,
  .item.menu-open .meta {
    visibility: hidden;
  }
  .more:hover {
    color: var(--ink);
    background: var(--press) !important;
  }
  .editing-row {
    display: flex;
    align-items: center;
    background: var(--selected);
  }
  .rename {
    flex: 1;
    min-width: 0;
    height: 26px;
    padding: 2px 6px;
    border-color: var(--accent) !important;
    font-weight: 700;
  }
  .empty {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--sp-2);
    padding: var(--sp-3) var(--sp-2);
  }

  /* Bottom: news, problems, the bin, the folder and who you are. */
  .foot {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--sp-2);
    padding: var(--sp-2) var(--sp-3) var(--sp-3);
    border-top: 1px solid var(--line);
  }
  .bottom {
    gap: 4px;
  }
  .folder {
    flex: 1;
    min-width: 0;
    padding: 0 8px;
  }
  .who {
    flex: none;
    max-width: 50%;
    padding: 0 8px 0 4px;
  }
  .trash summary {
    display: flex;
    align-items: center;
    gap: 5px;
    cursor: pointer;
    padding: 2px 0;
  }
  .del {
    gap: var(--sp-2);
    padding: 2px 0;
  }
  .del .t {
    flex: 1;
  }
  .update {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: var(--sp-2);
    border-radius: var(--r-card);
    background: var(--selected);
    color: var(--accent);
  }
  .update span {
    flex: 1;
    color: var(--ink);
  }
  .problems summary {
    color: var(--warn-ink);
  }
  .prob {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 4px 0;
    border-bottom: 1px solid var(--line);
  }
  .acts2 {
    gap: 4px;
  }
  .me-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .me-field input {
    height: 28px;
    font-size: var(--fs-sm);
  }

  /* The row menu floats over everything, at the pointer. */
  .row-menu {
    position: fixed;
    z-index: 70;
    width: 236px;
    padding: var(--sp-1);
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .row-menu:focus {
    outline: none;
  }
  .mhead {
    display: flex;
    align-items: center;
    gap: var(--sp-2);
    padding: 6px var(--sp-2) 8px;
    margin-bottom: 2px;
    border-bottom: 1px solid var(--line);
    font-weight: 700;
  }
  .sep {
    height: 1px;
    margin: 3px var(--sp-2);
    background: var(--line);
  }
  .newp {
    display: flex;
    gap: 4px;
    padding: 6px var(--sp-1) 2px;
  }
  .newp input {
    height: 26px;
    font-size: var(--fs-sm);
  }
</style>
