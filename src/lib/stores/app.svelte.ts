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
import { storage, type BackupMeta, type FileKind } from '../storage/diagrams';
import { setThemePref, startAppearance, type ThemePref } from '../desktop/appearance';
import type { ImageSource, TextExport } from '../editors/types';
import { slug } from '../model/diagram';

const SAVE_DELAY = 500;
const BACKUP_EVERY = 5 * 60 * 1000;
const HISTORY = 150;
/** Keystrokes in the same field within this window are one undo step. */
const COALESCE_MS = 1200;

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
  showArchived = $state(false);

  private undoStack = $state<string[]>([]);
  private redoStack = $state<string[]>([]);
  private lastKey: string | null = null;
  private lastKeyAt = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private lastBackup = 0;
  private imageSource: (() => ImageSource | Promise<ImageSource>) | null = null;
  private noticeSeq = 0;

  canUndo = $derived(this.undoStack.length > 0);
  canRedo = $derived(this.redoStack.length > 0);

  async init() {
    const s = await storage();
    this.theme = (await s.getSetting<ThemePref>('theme')) ?? 'system';
    this.lightExports = (await s.getSetting<boolean>('lightExports')) ?? true;
    this.listOpen = (await s.getSetting<boolean>('listOpen')) ?? true;
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
    window.addEventListener('beforeunload', () => void this.flush());
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
      this.imageSource = null;
      this.doc = d;
      this.path = path;
      this.undoStack = [];
      this.redoStack = [];
      this.lastKey = null;
      this.lastBackup = Date.now();
      await s.setSetting('lastPath', path);
    } catch (err) {
      this.notify(`Couldn't open that diagram: ${err instanceof Error ? err.message : err}`, 'error');
    }
  }

  async create<K extends DiagramKind>(kind: K, title: string, project: string, data?: DataByKind[K]) {
    await this.flush();
    const d = newDiagram(kind, title, project, data);
    const s = await storage();
    const path = await s.save(d);
    await this.refresh();
    this.path = null;
    await this.open(path);
  }

  close() {
    void this.flush();
    this.doc = null;
    this.path = null;
    this.imageSource = null;
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
    if (!(await s.confirm(`Delete "${this.doc.title}"? A copy stays under Previous versions.`, 'Delete diagram'))) return;
    await s.backup($state.snapshot(this.doc) as Diagram);
    const path = this.path;
    this.doc = null;
    this.path = null;
    await s.remove(path);
    await this.refresh();
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
    const s = await storage();
    const snap = $state.snapshot(this.doc) as Diagram;
    try {
      await s.save(snap, this.path);
      this.saving = 'saved';
      const meta = this.list.find((m) => m.path === this.path);
      if (meta) Object.assign(meta, { title: snap.title, project: snap.project, updated: snap.updated, archived: snap.archived });
      if (Date.now() - this.lastBackup > BACKUP_EVERY) {
        this.lastBackup = Date.now();
        await s.backup(snap);
      }
    } catch (err) {
      this.saving = 'error';
      this.notify(`Couldn't save: ${err instanceof Error ? err.message : err}`, 'error');
    }
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

  async exportImage(format: 'png' | 'svg') {
    if (!this.doc) return;
    const root = document.documentElement;
    const prevTheme = root.dataset.theme;
    const flip = this.lightExports && prevTheme !== 'light';
    let restoreSvg: (() => void) | null = null;
    try {
      // No transitions while the theme flips, or the capture catches colours halfway.
      root.classList.add('no-motion');
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
      const { toPng, toSvg } = await import('html-to-image');
      const opts = {
        backgroundColor: this.lightExports ? '#ffffff' : bg,
        width: Math.ceil(src.width),
        height: Math.ceil(src.height),
        pixelRatio: 2,
        style: { ...(src.style ?? {}) },
        filter: (n: Node) =>
          !(n instanceof Element && (('dataset' in n && (n as HTMLElement).dataset.noExport !== undefined) || n.classList.contains('svelte-flow__handle') || n.classList.contains('svelte-flow__resize-control')))
      };
      const dataUrl = format === 'png' ? await toPng(src.el, opts) : await toSvg(src.el, opts);
      restoreSvg();
      restoreSvg = null;
      if (flip) {
        if (prevTheme) root.dataset.theme = prevTheme;
        else delete root.dataset.theme;
        await tick();
      }
      const s = await storage();
      const bytes =
        format === 'png'
          ? Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0))
          : new TextEncoder().encode(decodeURIComponent(dataUrl.slice(dataUrl.indexOf(',') + 1)));
      const kind: FileKind = format === 'png' ? { name: 'PNG image', extensions: ['png'], mime: 'image/png' } : { name: 'SVG image', extensions: ['svg'], mime: 'image/svg+xml' };
      if (await s.exportFile(`${this.fileBase()}.${format}`, bytes, kind)) this.notify(`Exported ${format.toUpperCase()}.`);
    } catch (err) {
      this.notify(`Export failed: ${err instanceof Error ? err.message : err}`, 'error');
    } finally {
      restoreSvg?.();
      requestAnimationFrame(() => root.classList.remove('no-motion'));
      if (flip && root.dataset.theme !== prevTheme) {
        if (prevTheme) root.dataset.theme = prevTheme;
        else delete root.dataset.theme;
      }
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
      await navigator.clipboard.writeText(x.build());
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
