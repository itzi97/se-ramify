<script lang="ts">
  import { tick } from 'svelte';
  import { app } from '../stores/app.svelte';
  import { FAMILIES, GROUP_ORDER, KINDS, kindInfo, shortName, type KindInfo } from '../model/kinds';
  import type { DiagramMeta } from '../model/types';
  import Icon from './Icon.svelte';
  import KindBadge from './KindBadge.svelte';
  import Avatar from './Avatar.svelte';
  import { exportProject } from '../export/project';
  import { editedLine } from '../storage/team';
  import { openReleasePage } from '../desktop/update';
  import { focusIn } from './focus';

  /** The name field takes the keyboard only when opened from the name chip, not when it shows as a prompt. */
  const focusWhen = (node: HTMLElement, on: boolean) => {
    if (on) focusIn(node, true);
  };

  type Group = KindInfo['group'];
  type Sort = 'recent' | 'az' | 'kind';

  let { onNew, onHandIns }: { onNew: () => void; onHandIns: (project: string) => void } = $props();

  /* How this person likes the list (sort, folded projects): remembered in this window only. */
  const PREF = 'se-ramify:ui:list';
  function readPref(): { sort?: Sort; collapsed?: string[] } {
    try {
      return JSON.parse(localStorage.getItem(PREF) ?? '{}') ?? {};
    } catch {
      return {};
    }
  }
  const pref = readPref();
  let query = $state('');
  let family = $state<Group | null>(null);
  /** The family under the pointer in the filter: its rows stay bright, the rest dim, before any click. */
  let peek = $state<Group | null>(null);
  let sort = $state<Sort>(pref.sort ?? 'recent');
  let collapsed = $state<string[]>(pref.collapsed ?? []);
  let viewOpen = $state(false);
  let nameOpen = $state(false);
  $effect(() => {
    const v = JSON.stringify({ sort, collapsed });
    try {
      localStorage.setItem(PREF, v);
    } catch {
      /* storage blocked: the list just forgets */
    }
  });

  const KIND_ORDER = new Map(GROUP_ORDER.flatMap((g) => KINDS.filter((k) => k.group === g)).map((k, i) => [k.kind, i]));
  /** Lower case, no accents: "comunicacion" finds "Comunicación". */
  const fold = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  const base = $derived.by(() => {
    const words = fold(query.trim()).split(/\s+/).filter(Boolean);
    return app.list.filter((m) => {
      if (m.archived && !app.showArchived) return false;
      if (!words.length) return true;
      const k = kindInfo(m.kind);
      const hay = fold(`${m.title} ${m.project} ${k.label} ${k.es} ${shortName(m.kind)} ${m.updatedBy ?? ''}`);
      return words.every((w) => hay.includes(w));
    });
  });
  const counts = $derived.by(() => {
    const c = new Map<Group, number>();
    for (const m of base) c.set(kindInfo(m.kind).group, (c.get(kindInfo(m.kind).group) ?? 0) + 1);
    return c;
  });
  const shown = $derived(family ? base.filter((m) => kindInfo(m.kind).group === family) : base);

  const byTitle = (a: DiagramMeta, b: DiagramMeta) => a.title.localeCompare(b.title, 'es', { numeric: true, sensitivity: 'base' });
  /** Diagrams grouped by project (A–Z, "No project" last), sorted inside each as chosen. */
  const groups = $derived.by(() => {
    const cmp =
      sort === 'az' ? byTitle : sort === 'kind' ? (a: DiagramMeta, b: DiagramMeta) => (KIND_ORDER.get(a.kind) ?? 0) - (KIND_ORDER.get(b.kind) ?? 0) || byTitle(a, b) : (a: DiagramMeta, b: DiagramMeta) => b.updated.localeCompare(a.updated);
    const map = new Map<string, DiagramMeta[]>();
    for (const m of shown) {
      const key = m.project || '';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return [...map.entries()].map(([p, items]) => [p, items.sort(cmp)] as const).sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, 'es')));
  });
  const projects = $derived([...new Set(app.list.map((m) => m.project).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es')));
  const archivedCount = $derived(app.list.filter((m) => m.archived).length);
  const folded = (p: string) => !query.trim() && collapsed.includes(p);
  const toggleGroup = (p: string) => (collapsed = collapsed.includes(p) ? collapsed.filter((x) => x !== p) : [...collapsed, p]);

  // The open diagram's row stays in sight, however it was opened (home, search, a link in a plan).
  $effect(() => {
    if (app.path) requestAnimationFrame(() => document.querySelector('.list .item.on')?.scrollIntoView({ block: 'nearest' }));
  });

  /** Someone else changed it in the last three days: their colour on the row says so. */
  const fresh = (m: DiagramMeta) => !!m.updatedBy && m.updatedBy !== app.userName && Date.now() - Date.parse(m.updated) < 3 * 86_400_000;

  /* ---------------------------------------------- drag a row to another project */

  let drag = $state<{ m: DiagramMeta; x: number; y: number; over: string | null } | null>(null);
  /** A drag ends in a click on the row it started from; that click must not open it. */
  let dragged = false;

  function dragStart(e: PointerEvent, m: DiagramMeta) {
    if (e.button !== 0 || renaming) return;
    const sx = e.clientX;
    const sy = e.clientY;
    let started = false;
    const move = (ev: PointerEvent) => {
      if (!started && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 6) return;
      if (!started) {
        started = true;
        document.body.classList.add('dragging-row');
      }
      const target = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>('.list [data-project]');
      drag = { m, x: ev.clientX, y: ev.clientY, over: target ? (target.dataset.project ?? null) : null };
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
      if (to !== null && to !== (m.project || '')) void app.moveToProject(m.path, to);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }
  const dropOn = (p: string) => drag !== null && drag.over === p && (drag.m.project || '') !== p;

  async function open(m: DiagramMeta, btn?: HTMLElement) {
    if (dragged) return;
    await app.open(m.path);
    // Hand the keyboard to the diagram (Del, arrows, Ctrl+A act on the canvas, not on this button).
    btn?.blur();
  }

  /* ------------------------------------------------------------ row menu */

  let menu = $state<{ m: DiagramMeta; x: number; y: number; move: boolean } | null>(null);
  let renaming = $state<string | null>(null);
  let newProject = $state('');

  function openMenu(m: DiagramMeta, x: number, y: number) {
    menu = { m, x, y, move: false };
    newProject = '';
  }
  function fromButton(e: MouseEvent & { currentTarget: HTMLElement }, m: DiagramMeta) {
    if (menu?.m.path === m.path) return void (menu = null);
    const r = e.currentTarget.getBoundingClientRect();
    openMenu(m, r.left, r.bottom + 4);
  }
  /** Keep the menu inside the window and put the keyboard on its first item. */
  function placed(node: HTMLElement, at: { x: number; y: number; move: boolean }) {
    const fit = (p: { x: number; y: number }) => {
      const r = node.getBoundingClientRect();
      node.style.left = `${Math.max(8, Math.min(p.x, window.innerWidth - r.width - 8))}px`;
      node.style.top = `${Math.max(8, Math.min(p.y, window.innerHeight - r.height - 8))}px`;
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

  async function startRename(m: DiagramMeta) {
    menu = null;
    renaming = m.path;
    await tick();
    const input = document.querySelector<HTMLInputElement>('.rename');
    input?.focus();
    input?.select();
  }
  function endRename(m: DiagramMeta, value: string | null) {
    if (renaming !== m.path) return;
    renaming = null;
    if (value !== null) void app.renameFile(m.path, value);
  }

  /** Up and down move between rows; F2 renames the focused one. */
  function rowKeys(e: KeyboardEvent, m: DiagramMeta) {
    if (e.key === 'F2') {
      e.preventDefault();
      void startRename(m);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const rows = [...document.querySelectorAll<HTMLElement>('.list .item .main')];
      const i = rows.indexOf(e.currentTarget as HTMLElement);
      rows[i + (e.key === 'ArrowDown' ? 1 : -1)]?.focus();
    } else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
      e.preventDefault();
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      openMenu(m, r.left + 24, r.bottom);
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

<nav class="list" aria-label="Diagrams">
  <div class="head">
    <div class="row new-row">
      <button class="primary new" onclick={onNew} title="New diagram (Ctrl+N)"><Icon name="Plus" size={16} /> New diagram</button>
      <button class="icon secondary" onclick={() => app.importDiagramFile()} aria-label="Open a diagram file" title="Open a diagram file someone sent you (.json)"><Icon name="FileInput" size={16} /></button>
    </div>
    <div class="row find">
      <span class="search">
        <Icon name="Search" size={14} />
        <input type="search" placeholder={family ? `Filter ${FAMILIES[family].label}` : 'Filter'} bind:value={query} aria-label="Filter diagrams" onkeydown={(e) => e.key === 'Escape' && query && (e.stopPropagation(), (query = ''))} />
      </span>
      <button class="icon small view-btn" class:active={viewOpen} aria-label="Sort and show" aria-expanded={viewOpen} title="Sort, show archived" onclick={() => (viewOpen = !viewOpen)}><Icon name="ArrowDownWideNarrow" size={15} /></button>
      {#if viewOpen}
        <div class="view-pop float arrive" role="dialog" aria-label="Sort and show">
          <div class="sect" id="sort-label">Sort</div>
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
        <button class="fam all" class:on={!family} aria-pressed={!family} onclick={() => (family = null)} title="Every kind">All <span class="n">{base.length}</span></button>
        {#each GROUP_ORDER as g (g)}
          {@const n = counts.get(g) ?? 0}
          <button
            class="fam"
            class:on={family === g}
            style:--fam={FAMILIES[g].color}
            aria-pressed={family === g}
            aria-label="{FAMILIES[g].label}: {n}"
            title="{FAMILIES[g].label} · {n} diagram{n === 1 ? '' : 's'}"
            disabled={!n && family !== g}
            onpointerenter={() => (peek = g)}
            onpointerleave={() => (peek = null)}
            onclick={() => (family = family === g ? null : g)}>{n}</button
          >
        {/each}
      </div>
    {/if}
  </div>

  <div class="scroll">
    {#each groups as [project, items] (project)}
      {@const shut = folded(project)}
      {@const visible = shut ? items.filter((m) => m.path === app.path) : items}
      <div class="ghead" class:shut class:drop={dropOn(project)} data-project={project}>
        <button class="gtoggle" aria-expanded={!shut} onclick={() => toggleGroup(project)} title={shut ? 'Show its diagrams' : 'Fold'}>
          <span class="chev"><Icon name="ChevronDown" size={14} /></span>
          <span class="gname">{project || 'No project'}</span>
          <span class="gcount">{items.length}</span>
        </button>
        <span class="gacts">
          <button class="icon small" title="Hand-ins: what E1, E2, E3 and the final ask for, and what's missing" aria-label="Hand-in checklist for {project || 'No project'}" onclick={() => onHandIns(project)}><Icon name="ClipboardCheck" size={15} /></button>
          <button class="icon small" title="Export this project: every diagram as PNG plus the memoria" aria-label="Export project {project || 'No project'}" onclick={() => exportProject(project)}><Icon name="PackageOpen" size={15} /></button>
        </span>
      </div>
      {#each visible as m (m.path)}
        {@const ps = app.presence[m.id] ?? []}
        <div class="item" class:on={m.path === app.path} class:archived={m.archived} class:dim={peek !== null && kindInfo(m.kind).group !== peek} class:menu-open={menu?.m.path === m.path} class:drop={dropOn(project)} class:lifted={drag?.m.path === m.path} data-project={project} oncontextmenu={(e) => (e.preventDefault(), openMenu(m, e.clientX, e.clientY))} role="presentation">
          {#if renaming === m.path}
            <span class="main editing-row">
              <KindBadge kind={m.kind} size="sm" />
              <!-- svelte-ignore a11y_autofocus -->
              <input
                class="rename"
                type="text"
                value={m.title}
                aria-label="New title"
                lang="es"
                onkeydown={(e) => {
                  if (e.key === 'Enter') endRename(m, e.currentTarget.value);
                  else if (e.key === 'Escape') (e.stopPropagation(), endRename(m, null));
                }}
                onblur={(e) => endRename(m, e.currentTarget.value)}
              />
            </span>
          {:else}
            <button
              class="main"
              onpointerdown={(e) => dragStart(e, m)}
              onclick={(e) => open(m, e.currentTarget)}
              onkeydown={(e) => rowKeys(e, m)}
              aria-current={m.path === app.path ? 'page' : undefined}
              title="{kindInfo(m.kind).es} · {kindInfo(m.kind).label}{m.dupOf ? ' · copy of another file (made by a sync app?)' : m.conflict ? ' · conflict copy from your sync app' : ''}{m.archived ? ' · archived' : ''}&#10;{editedLine(m.updated, m.updatedBy)}{ps.length ? `\n${app.presenceLine(m.id)} now` : ''}"
            >
              <KindBadge kind={m.kind} size="sm" />
              <span class="t" lang="es">{m.title.trim() || 'Sin título'}</span>
              <span class="meta">
                {#if m.dupOf || m.conflict}<span class="warn" aria-label="Copy"><Icon name="TriangleAlert" size={13} /></span>{/if}
                {#if m.archived}<Icon name="Archive" size={13} />{/if}
                {#if ps.length}
                  <span class="faces" aria-label={app.presenceLine(m.id)}>
                    {#each ps.slice(0, 2) as p (p.client)}<Avatar name={p.name} size={16} state={p.editing ? 'editing' : 'here'} title="{p.name} {p.editing ? 'is editing it' : 'has it open'}" />{/each}
                    {#if ps.length > 2}<span class="more-n">+{ps.length - 2}</span>{/if}
                  </span>
                {:else if fresh(m)}
                  <Avatar name={m.updatedBy!} size={16} title={editedLine(m.updated, m.updatedBy)} />
                {/if}
              </span>
            </button>
            <button class="icon small more" aria-label="Actions for {m.title}" aria-haspopup="menu" tabindex="-1" onclick={(e) => fromButton(e, m)}><Icon name="Ellipsis" size={15} /></button>
          {/if}
        </div>
      {/each}
    {:else}
      <div class="empty">
        {#if app.list.length}
          <p class="small muted">Nothing matches{query ? ` "${query}"` : ''}{family ? ` in ${FAMILIES[family].label}` : ''}.</p>
          <button class="secondary small" onclick={() => ((query = ''), (family = null))}>Show everything</button>
        {:else}
          <p class="small muted">No diagrams in this folder yet.</p>
          <button class="secondary small" onclick={async () => onHandIns(await app.loadExampleProject())}><Icon name="GraduationCap" size={14} /> Load the example project</button>
        {/if}
      </div>
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
    <KindBadge kind={drag.m.kind} size="sm" />
    <span class="t">{drag.m.title}</span>
    {#if drag.over !== null && drag.over !== (drag.m.project || '')}<span class="to tiny">→ {drag.over || 'No project'}</span>{/if}
  </div>
{/if}

{#if menu}
  {@const m = menu.m}
  <div class="row-menu float arrive" role="menu" tabindex="-1" aria-label="Actions for {m.title}" use:placed={{ x: menu.x, y: menu.y, move: menu.move }} onkeydown={menuKeys}>
    <div class="mhead"><KindBadge kind={m.kind} size="sm" /><span class="t small">{m.title}</span></div>
    {#if !menu.move}
      {#if m.path !== app.path}<button class="menu-row" role="menuitem" onclick={() => run(() => app.open(m.path))}><Icon name="SquareArrowOutUpRight" size={15} /> Open</button>{/if}
      <button class="menu-row" role="menuitem" onclick={() => startRename(m)}><Icon name="PencilLine" size={15} /> <span class="grow">Rename</span><kbd class="quiet">F2</kbd></button>
      <button class="menu-row" role="menuitem" onclick={() => run(() => app.duplicateFile(m.path))}><Icon name="Copy" size={15} /> Duplicate</button>
      <button class="menu-row" role="menuitem" onclick={() => menu && (menu.move = true)}><Icon name="FolderInput" size={15} /> <span class="grow">Move to project</span><Icon name="ChevronRight" size={14} /></button>
      <button class="menu-row" role="menuitem" onclick={() => run(() => onHandIns(m.project))}><Icon name="ClipboardCheck" size={15} /> Hand-in checklist</button>
      <button class="menu-row" role="menuitem" onclick={() => run(() => app.exportDiagramFile(m.path))}><Icon name="Send" size={15} /> Save a copy to send…</button>
      <button class="menu-row" role="menuitem" onclick={() => run(() => app.setArchived(m.path, !m.archived))}><Icon name={m.archived ? 'ArchiveRestore' : 'Archive'} size={15} /> {m.archived ? 'Unarchive' : 'Archive'}</button>
      <div class="sep"></div>
      <button class="menu-row danger" role="menuitem" onclick={() => run(() => app.deleteFile(m.path))}><Icon name="Trash2" size={15} /> Delete…</button>
    {:else}
      <button class="menu-row" role="menuitem" onclick={() => menu && (menu.move = false)}><Icon name="ChevronLeft" size={15} /> <span class="muted">Move to…</span></button>
      <div class="sep"></div>
      {#each projects.filter((p) => p !== m.project) as p (p)}
        <button class="menu-row" role="menuitem" onclick={() => run(() => app.moveToProject(m.path, p))}><Icon name="Folder" size={15} /> <span class="t">{p}</span></button>
      {/each}
      {#if m.project}<button class="menu-row" role="menuitem" onclick={() => run(() => app.moveToProject(m.path, ''))}><Icon name="FolderX" size={15} /> <span class="muted">No project</span></button>{/if}
      <form class="newp" onsubmit={(e) => (e.preventDefault(), newProject.trim() && run(() => app.moveToProject(m.path, newProject)))}>
        <input type="text" placeholder="New project…" bind:value={newProject} aria-label="New project" />
        <button class="primary small" disabled={!newProject.trim()}>Move</button>
      </form>
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
  .fam.all .n {
    font-weight: 700;
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

  /* Project headers fold their diagrams away. */
  .ghead {
    display: flex;
    align-items: center;
    margin-top: var(--sp-2);
    padding-right: 2px;
  }
  .gtoggle {
    flex: 1;
    min-width: 0;
    height: 28px;
    padding: 0 6px 0 4px;
    gap: 4px;
    border-radius: var(--r-control);
    font-size: var(--fs-sm);
    font-weight: 700;
    color: var(--muted);
  }
  .gtoggle:hover {
    color: var(--ink);
  }
  .chev {
    display: inline-flex;
    transition: transform var(--t);
  }
  .shut .chev {
    transform: rotate(-90deg);
  }
  .gname {
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .gcount {
    flex: none;
    margin-left: 2px;
    padding: 0 6px;
    border-radius: var(--r-pill);
    background: var(--panel-2);
    font-size: var(--fs-xs);
    font-variant-numeric: tabular-nums;
  }
  .gacts {
    display: flex;
    gap: 1px;
  }
  .gacts button {
    color: var(--faint);
  }
  .ghead:hover .gacts button,
  .gacts button:focus-visible {
    color: var(--muted);
  }
  .gacts button:hover {
    color: var(--accent);
    background: var(--selected);
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
  .ghead.drop {
    border-radius: var(--r-control);
    background: var(--selected);
    box-shadow: inset 0 0 0 1.5px var(--accent);
  }
  .ghead.drop .gtoggle,
  .ghead.drop .gtoggle:hover {
    color: var(--accent);
    background: transparent;
  }
  .item.drop {
    background: color-mix(in srgb, var(--accent) 6%, transparent);
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
    height: 32px;
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
