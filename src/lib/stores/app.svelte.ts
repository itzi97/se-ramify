/**
 * App state and every change to the open diagram.
 *
 * Editors mutate the diagram only through `app.change(fn, key?)`: it takes a
 * snapshot for undo, runs `fn` on the live (reactive) diagram, stamps
 * `updated` and schedules a save. Typing into one field passes a `key` so a
 * burst of keystrokes is one undo step.
 */
import { tick } from 'svelte';
import { newDiagram, nowIso, uid } from '../model/diagram';
import type { DataByKind, Diagram, DiagramKind, DiagramMeta, DiagramOf } from '../model/types';
import { isTauri, storage, type BackupMeta, type DeletedMeta, type FileKind, type FileProblem } from '../storage/diagrams';
import { splitConflict } from '../storage/team';
import { CHECK_EVERY, isNewer, latestRelease } from '../desktop/update';
import { validateDiagram, normalizeDiagram } from '../model/diagram';
import { setThemePref, startAppearance, type ThemePref } from '../desktop/appearance';
import type { ImageSource, TextExport } from '../editors/types';
import { slug } from '../model/diagram';
import { withPhys } from '../export/png';
import { kindInfo } from '../model/kinds';

const SAVE_DELAY = 500;
/** How often the folder is re-read for teammates' changes (synced folder, git pull). */
const WATCH_EVERY = 4000;
const BACKUP_EVERY = 5 * 60 * 1000;
const HISTORY = 150;
/** Keystrokes in the same field within this window are one undo step. */
const COALESCE_MS = 1200;

/** Seconds a heartbeat counts as "here": a closed laptop drops out after this. */
const PRESENCE_TTL = 60_000;
const BEAT_EVERY = 15_000;
/** An edit in the last two minutes makes "has it open" into "is editing". */
const EDITING_WINDOW = 120_000;

export interface Presence {
  client: string;
  name: string;
  id: string;
  title: string;
  at: number;
  editing: boolean;
}

export interface Notice {
  id: number;
  text: string;
  tone: 'info' | 'error';
}

class AppState {
  ready = $state(false);
  dir = $state<string | null>(null);
  list = $state<DiagramMeta[]>([]);
  doc = $state<Diagram | null>(null);
  path = $state<string | null>(null);
  saving = $state<'saved' | 'pending' | 'error'>('saved');
  notices = $state<Notice[]>([]);
  theme = $state<ThemePref>('system');
  /** Exports always on light paper, whatever the theme. */
  lightExports = $state(true);
  /** Drawer with the list of diagrams. */
  listOpen = $state(true);
  /** The name saved with every diagram this person edits, so a team sees who changed what. */
  userName = $state('');
  /** Files in the folder that couldn't be read (git conflict markers…). */
  problems = $state<FileProblem[]>([]);
  /** The `updated` stamp of the open diagram's file as this app last read or wrote it. */
  private known: string | null = null;
  /** A newer release on GitHub, if the daily check found one. */
  update = $state<{ version: string; url: string } | null>(null);
  checkUpdates = $state(true);
  /** Other people with a diagram open right now, by diagram id (from their heartbeat files). */
  presence = $state<Record<string, Presence[]>>({});
  /** This install's id, so two people with the same name stay apart. */
  private clientId = '';
  private lastBeat = 0;
  private beatKey = '';
  private lastEditAt = 0;
  private watching = false;
  private syncing = false;
  showArchived = $state(false);

  private undoStack = $state<string[]>([]);
  private redoStack = $state<string[]>([]);
  private lastKey: string | null = null;
  private lastKeyAt = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private lastBackup = 0;
  /** Undo / redo per diagram, so switching away and back keeps them (this session only). */
  private histories = new Map<string, { undo: string[]; redo: string[] }>();
  /** Diagrams that already got a backup this session. */
  private backedUp = new Set<string>();
  private imageSource: (() => ImageSource | Promise<ImageSource>) | null = null;
  private noticeSeq = 0;

  canUndo = $derived(this.undoStack.length > 0);
  canRedo = $derived(this.redoStack.length > 0);

  async init() {
    const s = await storage();
    this.theme = (await s.getSetting<ThemePref>('theme')) ?? 'system';
    this.lightExports = (await s.getSetting<boolean>('lightExports')) ?? true;
    this.listOpen = (await s.getSetting<boolean>('listOpen')) ?? true;
    this.userName = (await s.getSetting<string>('userName')) ?? '';
    // One id per install on the desktop; in a browser every window counts as its own person (tabs share storage).
    this.clientId = isTauri ? ((await s.getSetting<string>('clientId')) ?? '') : uid();
    if (!this.clientId) await s.setSetting('clientId', (this.clientId = uid()));
    await startAppearance(this.theme);
    this.dir = await s.getDir();
    if (this.dir) {
      try {
        await this.refresh();
        const last = await s.getSetting<string>('lastPath');
        if (last && this.list.some((m) => m.path === last)) await this.open(last);
      } catch (err) {
        // A folder the app may no longer read (moved, unmounted, outside the allowed scope): say so, let them pick again.
        this.notify(`Couldn't read ${this.dir}: ${err instanceof Error ? err.message : err}. Choose the folder again from the list.`, 'error');
      }
    }
    this.ready = true;
    window.addEventListener('beforeunload', () => {
      void this.flush();
      void this.leave();
    });
    this.watch();
    this.checkUpdates = (await s.getSetting<boolean>('checkUpdates')) ?? true;
    void this.lookForUpdate();
  }

  async pickDir() {
    const s = await storage();
    const dir = await s.pickDir();
    if (!dir) return;
    await this.flush();
    this.dir = dir;
    this.doc = null;
    this.path = null;
    await this.refresh();
  }

  async refresh() {
    const s = await storage();
    this.list = await s.list();
    this.problems = s.problems();
    void this.refreshDeleted().catch(() => {});
  }

  /* --------------------------------------------------------------- team */

  /** Re-read the folder every few seconds and when the window gets focus: teammates' saves, a git pull. */
  private watch() {
    if (this.watching || typeof window === 'undefined') return;
    this.watching = true;
    setInterval(() => {
      if (document.visibilityState === 'visible') void this.sync();
    }, WATCH_EVERY);
    window.addEventListener('focus', () => void this.sync());
  }

  /** Pick up changes made outside this window. */
  async sync() {
    if (this.syncing || !this.dir) return;
    this.syncing = true;
    try {
      const s = await storage();
      const next = await s.list();
      const sig = (l: DiagramMeta[]) => l.map((m) => `${m.path}|${m.updated}|${m.dupOf ?? ''}`).join('\n');
      if (sig(next) !== sig(this.list)) this.list = next;
      const probs = s.problems();
      if (probs.map((p) => p.path).join() !== this.problems.map((p) => p.path).join()) this.problems = probs;
      await this.beat();
      await this.readPresence();
      if (!this.doc || !this.path) return;
      const mine = next.find((m) => m.path === this.path);
      // Someone else saved the open diagram and there's nothing of ours waiting: show theirs.
      if (mine && this.known !== null && mine.updated !== this.known && this.saving !== 'pending') {
        const fresh = await s.load(this.path);
        // An edit may have started while the file was being read: then the save will sort it out.
        if ((this.saving as string) === 'pending') return;
        this.doc = fresh;
        this.known = fresh.updated;
        this.undoStack = [];
        this.redoStack = [];
        this.lastKey = null;
        this.notify(`"${fresh.title}" was updated${fresh.updatedBy ? ` by ${fresh.updatedBy}` : ' outside the app'}.`);
      }
    } catch (err) {
      console.warn('sync', err);
    } finally {
      this.syncing = false;
    }
  }

  /** Once a day at most: is there a newer release than this one? */
  async lookForUpdate(force = false) {
    if (!this.checkUpdates && !force) return;
    const s = await storage();
    const last = (await s.getSetting<number>('updateCheckedAt')) ?? 0;
    if (!force && Date.now() - last < CHECK_EVERY) {
      // Between checks, remember what the last one found.
      const known = await s.getSetting<{ version: string; url: string }>('updateFound');
      if (known && isNewer(known.version, __APP_VERSION__)) this.update = known;
      return;
    }
    const latest = await latestRelease();
    await s.setSetting('updateCheckedAt', Date.now());
    await s.setSetting('updateFound', latest);
    this.update = latest && isNewer(latest.version, __APP_VERSION__) ? latest : null;
    if (force) this.notify(this.update ? `se-ramify ${this.update.version} is available.` : latest ? `You have the latest version (${__APP_VERSION__}).` : "Couldn't reach GitHub to check.");
  }

  async setCheckUpdates(v: boolean) {
    this.checkUpdates = v;
    await (await storage()).setSetting('checkUpdates', v);
    if (!v) this.update = null;
  }

  /** Tell the others which diagram is open here (and whether it's being edited). */
  private async beat(force = false) {
    if (!this.clientId) return;
    const s = await storage();
    const editing = Date.now() - this.lastEditAt < EDITING_WINDOW;
    const key = `${this.doc?.id ?? ''}|${editing}|${this.userName}`;
    if (!force && key === this.beatKey && Date.now() - this.lastBeat < BEAT_EVERY) return;
    this.beatKey = key;
    this.lastBeat = Date.now();
    const name = `presence/${this.clientId}.json`;
    try {
      if (!this.doc) await s.removeConfig(name);
      else {
        const me: Presence = { client: this.clientId, name: this.userName || 'Someone', id: this.doc.id, title: this.doc.title, at: Date.now(), editing };
        await s.writeConfig(name, JSON.stringify(me));
      }
    } catch (err) {
      console.warn('presence', err);
    }
  }

  private async leave() {
    if (!this.clientId) return;
    try {
      await (await storage()).removeConfig(`presence/${this.clientId}.json`);
    } catch {
      /* the folder may be gone */
    }
  }

  private async readPresence() {
    const s = await storage();
    const now = Date.now();
    const next: Record<string, Presence[]> = {};
    for (const f of await s.listConfig('presence')) {
      try {
        const p = JSON.parse(f.text) as Presence;
        if (!p.client || p.client === this.clientId || !p.id || now - p.at > PRESENCE_TTL) continue;
        (next[p.id] ??= []).push(p);
      } catch {
        /* half-synced */
      }
    }
    if (JSON.stringify(next) !== JSON.stringify(this.presence)) this.presence = next;
  }

  /** Others on a diagram: "Bruno is editing", "Bruno and Carla have it open". */
  presenceLine(id: string): string {
    const ps = this.presence[id] ?? [];
    if (!ps.length) return '';
    const editing = ps.filter((p) => p.editing).map((p) => p.name);
    const viewing = ps.filter((p) => !p.editing).map((p) => p.name);
    const join = (n: string[]) => (n.length < 2 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n.at(-1)}`);
    return [editing.length ? `${join(editing)} ${editing.length > 1 ? 'are' : 'is'} editing it` : '', viewing.length ? `${join(viewing)} ${viewing.length > 1 ? 'have' : 'has'} it open` : '']
      .filter(Boolean)
      .join('; ');
  }

  async setUserName(name: string) {
    this.userName = name.trim();
    await (await storage()).setSetting('userName', this.userName);
    void this.beat(true);
  }

  /** Save the open diagram as a single file to send to someone (chat, e-mail). */
  async exportDiagramFile() {
    if (!this.doc) return;
    await this.flush();
    const s = await storage();
    const d = $state.snapshot(this.doc) as Diagram;
    await s.exportFile(`${slug(d.title) || d.kind}.se-ramify.json`, JSON.stringify(d, null, 2) + '\n', { name: 'se-ramify diagram', extensions: ['json'], mime: 'application/json' });
  }

  /** Bring a diagram file someone sent into the folder. Same diagram already here: replace it or keep both. */
  async importDiagramFile() {
    const s = await storage();
    const file = await s.importText({ name: 'se-ramify diagram', extensions: ['json'], mime: 'application/json' });
    if (!file) return;
    let d: Diagram;
    try {
      const raw = JSON.parse(file.text);
      const problems = validateDiagram(raw);
      if (problems.length) throw new Error(problems.join('; '));
      d = normalizeDiagram(raw as Diagram);
    } catch (err) {
      this.notify(`${file.name} isn't a se-ramify diagram: ${err instanceof Error ? err.message : err}`, 'error');
      return;
    }
    await this.flush();
    const same = this.list.find((m) => m.id === d.id && !m.dupOf);
    let path: string;
    if (same) {
      const newer = d.updated > same.updated;
      const replace = await s.confirm(
        `"${same.title}" is already in your folder (${newer ? 'the file you opened is newer' : 'yours is newer or the same'}). Replace yours with the file? Choose No to keep both.`,
        'Diagram already here'
      );
      if (replace) {
        await s.backup(await s.load(same.path));
        path = await s.save(d, same.path);
        if (this.path === same.path) this.path = null;
      } else path = await s.save({ ...d, id: uid(), title: `${d.title} (copia)` });
    } else path = await s.save(d);
    await this.refresh();
    await this.open(path);
    this.notify(`Added "${d.title}"${d.project ? ` to ${d.project}` : ''}.`);
  }

  /** A file that shares its id with another (a sync app's copy): keep it as a diagram of its own. */
  async keepAsSeparate(meta: DiagramMeta) {
    const s = await storage();
    const d = await s.load(meta.path);
    const copy = { ...d, id: uid(), title: `${d.title} (copia)`, updated: nowIso(), updatedBy: this.userName || undefined };
    await s.save(copy, meta.path);
    if (this.path === meta.path) this.path = null;
    await this.refresh();
    await this.open(meta.path);
  }

  /** Delete one file of the folder (a duplicate or conflict copy) after asking; a backup is kept. */
  async removeFile(meta: DiagramMeta) {
    const s = await storage();
    if (!(await s.confirm(`Delete the file of "${meta.title}"${meta.dupOf ? ' (the copy)' : ''}? A backup is kept in "Recently deleted".`, 'Delete file'))) return;
    try {
      await s.backup(await s.load(meta.path));
    } catch {
      /* unreadable: nothing to back up */
    }
    if (this.path === meta.path) this.close();
    await s.remove(meta.path);
    await this.refresh();
  }

  /** A file left with git conflict markers: keep one side, or both as separate diagrams. */
  async resolveGitConflict(p: FileProblem, keep: 'ours' | 'theirs' | 'both') {
    const s = await storage();
    const sides = splitConflict(await s.readRaw(p.path));
    if (!sides) return this.notify(`${p.name}: couldn't find both versions in it.`, 'error');
    const parse = (t: string) => {
      const raw = JSON.parse(t);
      if (validateDiagram(raw).length) throw new Error('not a diagram');
      return normalizeDiagram(raw as Diagram);
    };
    try {
      const ours = parse(sides.ours);
      const theirs = parse(sides.theirs);
      await s.writeRaw(p.path, JSON.stringify(keep === 'theirs' ? theirs : ours, null, 2) + '\n');
      if (keep === 'both') await s.save({ ...theirs, id: uid(), title: `${theirs.title} (${sides.theirsLabel || 'la otra versión'})` });
      await this.refresh();
      this.notify(keep === 'both' ? 'Kept both versions as separate diagrams.' : `Kept ${keep === 'ours' ? 'your' : 'the incoming'} version. Commit the file to finish the merge.`);
    } catch (err) {
      this.notify(`${p.name}: one side isn't a valid diagram (${err instanceof Error ? err.message : err}). Fix it by hand or with git.`, 'error');
    }
  }

  /** The open diagram, narrowed to a kind (editors use this). */
  docOf<K extends DiagramKind>(kind: K): DiagramOf<K> {
    if (!this.doc || this.doc.kind !== kind) throw new Error(`open diagram is not a ${kind}`);
    return this.doc as DiagramOf<K>;
  }

  /* ---------------------------------------------------------- lifecycle */

  async open(path: string) {
    if (path === this.path) return;
    await this.flush();
    const s = await storage();
    try {
      const d = await s.load(path);
      if (this.doc) this.histories.set(this.doc.id, { undo: this.undoStack, redo: this.redoStack });
      this.imageSource = null;
      this.doc = d;
      this.path = path;
      this.known = d.updated;
      this.lastEditAt = 0;
      void this.beat(true);
      const h = this.histories.get(d.id);
      this.undoStack = h?.undo ?? [];
      this.redoStack = h?.redo ?? [];
      this.lastKey = null;
      // The first save after opening keeps a copy (once per session), then every five minutes.
      this.lastBackup = this.backedUp.has(d.id) ? Date.now() : 0;
      await s.setSetting('lastPath', path);
    } catch (err) {
      this.notify(`Couldn't open that diagram: ${err instanceof Error ? err.message : err}`, 'error');
    }
  }

  async create<K extends DiagramKind>(kind: K, title: string, project: string, data?: DataByKind[K]) {
    await this.flush();
    const d = newDiagram(kind, title, project, data);
    if (this.userName) d.createdBy = d.updatedBy = this.userName;
    const s = await storage();
    const path = await s.save(d);
    await this.refresh();
    this.path = null;
    await this.open(path);
  }

  close() {
    void this.flush();
    setTimeout(() => void this.beat(true));
    if (this.doc) this.histories.set(this.doc.id, { undo: this.undoStack, redo: this.redoStack });
    this.doc = null;
    this.path = null;
    this.imageSource = null;
  }

  /**
   * Add the example project (every hand-in done for an invented product) to
   * the folder, under its own project name, and open its hand-in checklist
   * source: the first diagram. Loaded lazily so its text stays out of the
   * main bundle.
   */
  async loadExampleProject(): Promise<string> {
    await this.flush();
    const { exampleProject, EXAMPLE_PROJECT } = await import('../examples/project');
    // A second copy gets its own name rather than mixing with the first.
    let name = EXAMPLE_PROJECT;
    for (let i = 2; this.list.some((m) => m.project === name); i++) name = `${EXAMPLE_PROJECT} (${i})`;
    const s = await storage();
    let first: string | null = null;
    for (const d of exampleProject(name)) {
      const path = await s.save(d);
      first ??= path;
    }
    await this.refresh();
    if (first) await this.open(first);
    this.notify(`Added the example project "${name}": every hand-in, done for an invented library app.`);
    return name;
  }

  async duplicate() {
    if (!this.doc) return;
    await this.flush();
    const copy = { ...$state.snapshot(this.doc), id: uid(), title: `${this.doc.title} (copia)`, created: nowIso(), updated: nowIso() } as Diagram;
    const s = await storage();
    const path = await s.save(copy);
    await this.refresh();
    await this.open(path);
  }

  async remove() {
    if (!this.doc || !this.path) return;
    const s = await storage();
    if (!(await s.confirm(`Delete "${this.doc.title}"? You can bring it back from "Recently deleted" at the bottom of the list.`, 'Delete diagram'))) return;
    await s.backup($state.snapshot(this.doc) as Diagram);
    const path = this.path;
    this.doc = null;
    this.path = null;
    await s.remove(path);
    await this.refresh();
    await this.refreshDeleted();
  }

  /** Archive closes the diagram (it leaves the list); unarchive keeps it open. */
  async toggleArchive() {
    if (!this.doc) return;
    const archiving = !this.doc.archived;
    this.change((d) => (d.archived = archiving));
    if (archiving && !this.showArchived) {
      await this.flush();
      this.close();
      this.notify('Archived. Tick "Show archived" at the bottom of the list to see it again.');
    }
  }

  deleted = $state<DeletedMeta[]>([]);

  async refreshDeleted() {
    const s = await storage();
    const live = new Set(this.list.map((m) => m.id));
    this.deleted = (await s.listBackedUp()).filter((b) => !live.has(b.id));
  }

  /** Bring a deleted diagram back from its newest backup. */
  async undelete(b: DeletedMeta) {
    const s = await storage();
    const d = await s.loadBackup(b.path);
    const path = await s.save({ ...d, updated: nowIso() });
    await this.refresh();
    await this.refreshDeleted();
    await this.open(path);
    this.notify(`Restored "${d.title}".`);
  }

  /* ------------------------------------------------------------- changes */

  /** Change the open diagram. `key` merges a burst of edits to one field into one undo step. */
  change(fn: (d: Diagram) => void, key?: string) {
    if (!this.doc) return;
    const now = Date.now();
    const merge = key !== undefined && key === this.lastKey && now - this.lastKeyAt < COALESCE_MS;
    if (!merge) {
      this.undoStack.push(JSON.stringify($state.snapshot(this.doc)));
      if (this.undoStack.length > HISTORY) this.undoStack.shift();
    }
    this.redoStack = [];
    this.lastKey = key ?? null;
    this.lastKeyAt = now;
    fn(this.doc);
    this.touch();
    // The first edit after a while tells the others right away.
    const wasIdle = now - this.lastEditAt > EDITING_WINDOW;
    this.lastEditAt = now;
    if (wasIdle) void this.beat(true);
  }

  undo() {
    const prev = this.undoStack.pop();
    if (!prev || !this.doc) return;
    this.redoStack.push(JSON.stringify($state.snapshot(this.doc)));
    this.doc = JSON.parse(prev);
    this.lastKey = null;
    this.touch();
  }

  redo() {
    const next = this.redoStack.pop();
    if (!next || !this.doc) return;
    this.undoStack.push(JSON.stringify($state.snapshot(this.doc)));
    this.doc = JSON.parse(next);
    this.lastKey = null;
    this.touch();
  }

  /** Restore a previous version (keeps the current one as a backup first). */
  async restore(b: BackupMeta) {
    if (!this.doc) return;
    const s = await storage();
    await s.backup($state.snapshot(this.doc) as Diagram);
    const old = await s.loadBackup(b.path);
    this.change((d) => Object.assign(d, { ...old, id: d.id, updated: nowIso() }));
    this.notify(`Restored the version from ${new Date(b.when).toLocaleString()}.`);
  }

  private touch() {
    if (!this.doc) return;
    this.doc.updated = nowIso();
    this.saving = 'pending';
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.flush(), SAVE_DELAY);
  }

  /** Write any pending change now. */
  async flush() {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (!this.doc || !this.path || this.saving !== 'pending') return;
    // Take the diagram and its path now: closing or switching may happen while this saves.
    const path = this.path;
    const known = this.known;
    const snap = $state.snapshot(this.doc) as Diagram;
    if (this.userName) snap.updatedBy = this.userName;
    const s = await storage();
    const still = () => this.path === path;
    try {
      // Someone else saved this file since we read it: never write over their work.
      const disk = await s.peek(path);
      if (disk && known !== null && disk.updated !== known) return await this.conflict(snap, disk.updatedBy, path);
      await s.save(snap, path);
      if (still()) {
        this.known = snap.updated;
        if (this.doc && this.userName) this.doc.updatedBy = this.userName;
        this.saving = 'saved';
      }
      const meta = this.list.find((m) => m.path === path);
      if (meta) Object.assign(meta, { title: snap.title, project: snap.project, updated: snap.updated, archived: snap.archived, updatedBy: snap.updatedBy });
      if (Date.now() - this.lastBackup > BACKUP_EVERY) {
        this.lastBackup = Date.now();
        this.backedUp.add(snap.id);
        await s.backup(snap);
      }
    } catch (err) {
      this.saving = 'error';
      this.notify(`Couldn't save: ${err instanceof Error ? err.message : err}`, 'error');
    }
  }

  /**
   * Both of us changed the same diagram: their version (already on disk)
   * opens, ours is saved next to it as a copy, and both names are said.
   */
  private async conflict(mine: Diagram, by: string | undefined, path: string) {
    const s = await storage();
    const who = this.userName || 'tu versión';
    const copy = { ...mine, id: uid(), title: `${mine.title} (${this.userName ? `versión de ${who}` : who})`, created: nowIso() };
    await s.save(copy);
    const theirs = await s.load(path);
    if (this.path !== path) {
      // Closed or switched meanwhile: nothing to swap on screen.
      await this.refresh();
      return this.notify(`${by ?? 'Someone'} saved "${theirs.title}" while you were editing it; yours is kept as "${copy.title}".`, 'error');
    }
    this.saving = 'saved';
    this.doc = theirs;
    this.known = theirs.updated;
    this.undoStack = [];
    this.redoStack = [];
    this.lastKey = null;
    await this.refresh();
    this.notify(`${by ?? 'Someone'} saved "${theirs.title}" while you were editing it. Their version is open; yours is kept as "${copy.title}".`, 'error');
  }

  /* ------------------------------------------------------------- settings */

  async setTheme(t: ThemePref) {
    this.theme = t;
    setThemePref(t);
    await (await storage()).setSetting('theme', t);
  }

  async setLightExports(v: boolean) {
    this.lightExports = v;
    await (await storage()).setSetting('lightExports', v);
  }

  /** Pixels per CSS pixel in exported images: 2 normal, 3 high, 4 print. */
  imageScale = $state<2 | 3 | 4>(2);
  private exportPrefsLoaded = false;

  async loadExportPrefs() {
    if (this.exportPrefsLoaded) return;
    this.exportPrefsLoaded = true;
    const v = await (await storage()).getSetting<number>('imageScale');
    if (v === 2 || v === 3 || v === 4) this.imageScale = v;
  }

  async setImageScale(v: 2 | 3 | 4) {
    this.imageScale = v;
    this.exportPrefsLoaded = true;
    await (await storage()).setSetting('imageScale', v);
  }

  async toggleList() {
    this.listOpen = !this.listOpen;
    await (await storage()).setSetting('listOpen', this.listOpen);
  }

  /* -------------------------------------------------------------- notices */

  notify(text: string, tone: Notice['tone'] = 'info') {
    const id = ++this.noticeSeq;
    this.notices.push({ id, text, tone });
    setTimeout(() => this.dismiss(id), tone === 'error' ? 9000 : 4500);
  }

  dismiss(id: number) {
    this.notices = this.notices.filter((n) => n.id !== id);
  }

  /* -------------------------------------------------------------- exports */

  /** The graph editor frames its own viewport; others mark `[data-export-root]`. */
  setImageSource(fn: (() => ImageSource | Promise<ImageSource>) | null) {
    this.imageSource = fn;
  }

  fileBase(): string {
    if (!this.doc) return 'diagram';
    return slug(`${this.doc.kind}-${this.doc.title}`, 60) || 'diagram';
  }

  /**
   * Render the open diagram to PNG or SVG bytes (on white paper when that's
   * the setting). Used by Export, Copy as image and the project export.
   */
  async renderImage(format: 'png' | 'svg'): Promise<Uint8Array> {
    await this.loadExportPrefs();
    const root = document.documentElement;
    const prevTheme = root.dataset.theme;
    const flip = this.lightExports && prevTheme !== 'light';
    let restoreSvg: (() => void) | null = null;
    const restoreTheme = () => {
      if (flip && root.dataset.theme !== prevTheme) {
        if (prevTheme) root.dataset.theme = prevTheme;
        else delete root.dataset.theme;
      }
    };
    try {
      // No transitions while the theme flips, or the capture catches colours halfway;
      // editors hide selection rings, today lines and the like under `.exporting`.
      root.classList.add('no-motion', 'exporting');
      if (this.lightExports) root.style.setProperty('--paper', '#ffffff');
      if (flip) {
        root.dataset.theme = 'light';
        await tick();
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      }
      const src = await this.currentImageSource();
      if (!src) throw new Error('nothing to export');
      // html-to-image copies <svg> children without their computed styles: bake them in for the capture.
      restoreSvg = inlineSvgStyles(src.el);
      const bg = getComputedStyle(root).getPropertyValue('--paper').trim() || '#ffffff';
      const { toPng } = await import('html-to-image');
      const opts = {
        backgroundColor: this.lightExports ? '#ffffff' : bg,
        width: Math.ceil(src.width),
        height: Math.ceil(src.height),
        pixelRatio: this.imageScale,
        style: { ...(src.style ?? {}) },
        filter: (n: Node) =>
          !(n instanceof Element && (('dataset' in n && (n as HTMLElement).dataset.noExport !== undefined) || n.classList.contains('svelte-flow__handle') || n.classList.contains('svelte-flow__resize-control')))
      };
      if (format === 'png') {
        const dataUrl = await toPng(src.el, opts);
        // pHYs: the PNG says it is `scale` × 96 dpi, so documents insert it at its on-screen size.
        return withPhys(Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0)), this.imageScale);
      }
      // An SVG made of HTML (foreignObject) only renders in browsers; Typst, LaTeX, Inkscape and Word
      // show it blank. Wrap a sharp PNG instead (at least 3×): it scales cleanly and opens everywhere.
      const png = await toPng(src.el, { ...opts, pixelRatio: Math.max(3, this.imageScale) });
      const w = Math.ceil(src.width);
      const h = Math.ceil(src.height);
      return new TextEncoder().encode(
        `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><image width="${w}" height="${h}" xlink:href="${png}" href="${png}"/></svg>\n`
      );
    } finally {
      restoreSvg?.();
      restoreTheme();
      root.style.removeProperty('--paper');
      root.classList.remove('exporting');
      requestAnimationFrame(() => root.classList.remove('no-motion'));
    }
  }

  async exportImage(format: 'png' | 'svg') {
    if (!this.doc) return;
    try {
      const bytes = await this.renderImage(format);
      const s = await storage();
      const kind: FileKind = format === 'png' ? { name: 'PNG image', extensions: ['png'], mime: 'image/png' } : { name: 'SVG image', extensions: ['svg'], mime: 'image/svg+xml' };
      if (await s.exportFile(`${this.fileBase()}.${format}`, bytes, kind)) this.notify(`Exported ${format.toUpperCase()}.`);
    } catch (err) {
      this.notify(`Export failed: ${err instanceof Error ? err.message : err}`, 'error');
    }
  }

  /** Put a PNG of the diagram on the clipboard, to paste into Docs, Word, Slides… */
  async copyImage() {
    if (!this.doc) return;
    try {
      const bytes = await this.renderImage('png');
      await (await storage()).copyImage(bytes);
      this.notify('Copied the diagram as an image — paste it anywhere.');
    } catch (err) {
      this.notify(`Couldn't copy the image: ${err instanceof Error ? err.message : err}`, 'error');
    }
  }

  /** The open diagram as a Word document: title, image, notes and its Markdown exports (specifications, tables…). */
  async exportDocx() {
    if (!this.doc) return;
    try {
      const doc = this.doc;
      const png = await this.renderImage('png');
      const image = `${this.fileBase()}.png`;
      const { moduleFor } = await import('../editors/registry');
      const exports = (moduleFor(doc.kind).exports as (d: Diagram) => TextExport[])(doc);
      const md = [
        `# ${doc.title}`,
        '',
        `*${kindInfo(doc.kind).es}*`,
        '',
        `![${doc.title}](${image})`,
        '',
        doc.notes.trim(),
        '',
        ...exports.filter((x) => x.ext === 'md').map((x) => x.build().replace(/^# .*\n+/, ''))
      ].join('\n');
      const { memoriaDocx } = await import('../export/docx');
      const bytes = await memoriaDocx(md, new Map([[image, png]]), doc.title);
      const kind: FileKind = { name: 'Word document', extensions: ['docx'], mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
      if (await (await storage()).exportFile(`${this.fileBase()}.docx`, bytes, kind)) this.notify('Exported a Word document.');
    } catch (err) {
      this.notify(`Export failed: ${err instanceof Error ? err.message : err}`, 'error');
    }
  }

  /** The open diagram as a one-slide PowerPoint deck (16:9, image fitted, kind in the footer). */
  async exportSlide() {
    if (!this.doc) return;
    try {
      const doc = this.doc;
      const png = await this.renderImage('png');
      const { buildDeck } = await import('../export/pptx');
      const bytes = await buildDeck({ title: doc.title, subtitle: doc.project, agenda: [], slides: [{ title: doc.title, kind: kindInfo(doc.kind).es, notes: doc.notes, png }] });
      const kind: FileKind = { name: 'PowerPoint presentation', extensions: ['pptx'], mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' };
      if (await (await storage()).exportFile(`${this.fileBase()}.pptx`, bytes, kind)) this.notify('Exported a PowerPoint slide.');
    } catch (err) {
      this.notify(`Export failed: ${err instanceof Error ? err.message : err}`, 'error');
    }
  }

  /** A LaTeX figure for the PNG that Export → PNG suggests, on the clipboard. */
  async copyLatexFigure() {
    if (!this.doc) return;
    try {
      const { figureSnippet } = await import('../export/latex');
      await (await storage()).copyText(figureSnippet(`${this.fileBase()}.png`, this.doc.title));
      this.notify('Copied a LaTeX figure — export the PNG with the same name next to your .tex.');
    } catch (err) {
      this.notify(`Couldn't copy: ${err instanceof Error ? err.message : err}`, 'error');
    }
  }

  private async currentImageSource(): Promise<ImageSource | null> {
    if (this.imageSource) return this.imageSource();
    const el = document.querySelector<HTMLElement>('.editor-area [data-export-root]');
    if (!el) return null;
    return { el, width: el.scrollWidth, height: el.scrollHeight };
  }

  async exportText(x: TextExport) {
    try {
      const s = await storage();
      if (await s.exportFile(`${this.fileBase()}.${x.ext}`, x.build(), { name: x.label, extensions: [x.ext], mime: x.mime })) this.notify(`Exported ${x.label}.`);
    } catch (err) {
      this.notify(`Export failed: ${err instanceof Error ? err.message : err}`, 'error');
    }
  }

  async copyText(x: TextExport) {
    try {
      await (await storage()).copyText(x.build());
      this.notify(`Copied ${x.label} to the clipboard.`);
    } catch (err) {
      this.notify(`Couldn't copy: ${err instanceof Error ? err.message : err}`, 'error');
    }
  }

  async listBackups(): Promise<BackupMeta[]> {
    if (!this.doc) return [];
    return (await storage()).listBackups(this.doc.id);
  }
}

/** Presentation properties that SVG drawn with CSS needs once its stylesheet is gone. */
const SVG_PROPS = ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin', 'opacity', 'fill-opacity', 'stroke-opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'text-decoration', 'paint-order', 'visibility', 'display'];

/** Write the computed style of every SVG element under `root` into its style attribute; returns an undo. */
function inlineSvgStyles(root: HTMLElement): () => void {
  const saved: [Element, string | null][] = [];
  for (const el of root.querySelectorAll('svg, svg *')) {
    const cs = getComputedStyle(el);
    saved.push([el, el.getAttribute('style')]);
    const decl = SVG_PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';');
    el.setAttribute('style', `${el.getAttribute('style') ?? ''};${decl}`);
  }
  return () => {
    for (const [el, s] of saved) {
      if (s === null) el.removeAttribute('style');
      else el.setAttribute('style', s);
    }
  };
}

export const app = new AppState();
