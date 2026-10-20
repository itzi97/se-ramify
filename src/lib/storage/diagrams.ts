/**
 * Persistence: one JSON file per diagram in a folder the person chooses.
 *
 * Inside Tauri this uses the fs / dialog / store plugins. In a plain browser
 * (`npm run dev` without Tauri) it falls back to localStorage so the UI can
 * be worked on without the desktop shell.
 */
import { metaOf, normalizeDiagram, slug, validateDiagram } from '../model/diagram';
import type { Diagram, DiagramMeta } from '../model/types';
import { hasConflictMarkers, isConflictCopy, markDuplicates } from './team';

export { isConflictCopy };

/** A file in the folder that isn't a readable diagram (git conflict markers, a half-synced file…). */
export interface FileProblem {
  path: string;
  name: string;
  error: string;
  /** It still has git's <<<<<<< ======= >>>>>>> markers: the app can split it. */
  gitConflict: boolean;
}

export interface FileKind {
  name: string;
  extensions: string[];
  mime: string;
}

export interface Storage {
  /** Where diagrams live, or null until a folder is picked. */
  getDir(): Promise<string | null>;
  /** Ask for a folder; null if cancelled. */
  pickDir(): Promise<string | null>;
  list(): Promise<DiagramMeta[]>;
  /** Files the last `list()` couldn't read. */
  problems(): FileProblem[];
  load(path: string): Promise<Diagram>;
  /** The version on disk right now (its `updated` stamp), or null if the file is gone. Cheap: no parsing of the data. */
  peek(path: string): Promise<{ updated: string; updatedBy?: string } | null>;
  /** Raw text of a file in the folder, and writing it back (resolving git conflicts). */
  readRaw(path: string): Promise<string>;
  writeRaw(path: string, text: string): Promise<void>;
  /**
   * Small shared files next to the diagrams, in `se-ramify-config/` (hand-in
   * checklist changes, who is editing what), so the whole team sees them.
   * Names may contain one `/` for a subfolder ("presence/ana.json").
   */
  readConfig(name: string): Promise<string | null>;
  writeConfig(name: string, text: string): Promise<void>;
  /** Every config file under a subfolder ("presence"), with its text. */
  listConfig(sub: string): Promise<{ name: string; text: string }[]>;
  removeConfig(name: string): Promise<void>;
  /** Saves and returns the path the diagram now lives at. */
  save(d: Diagram, path?: string): Promise<string>;
  remove(path: string): Promise<void>;
  getSetting<T>(key: string): Promise<T | null>;
  setSetting<T>(key: string, value: T): Promise<void>;
  /** Save a text or binary file the person names. Resolves false if they cancel. */
  exportFile(suggestedName: string, content: string | Uint8Array, kind: FileKind): Promise<boolean>;
  /** Read a file the person picks (import). Null if cancelled. */
  importText(kind: FileKind): Promise<{ name: string; text: string } | null>;
  confirm(message: string, title?: string): Promise<boolean>;
  /** Clipboard: a PNG image, or text. */
  copyImage(png: Uint8Array): Promise<void>;
  copyText(text: string): Promise<void>;
  /** Ask for a folder to export into (null if cancelled); then write files into it by name. */
  pickExportDir(title: string): Promise<string | null>;
  writeInto(dir: string, name: string, content: string | Uint8Array): Promise<void>;
  /** Keep a dated copy outside the diagrams folder; old copies past `keep` are dropped. */
  backup(d: Diagram, keep?: number): Promise<void>;
  listBackups(id: string): Promise<BackupMeta[]>;
  /** The newest backup of every diagram that has backups (the shell filters out the ones still in the list). */
  listBackedUp(): Promise<DeletedMeta[]>;
  loadBackup(path: string): Promise<Diagram>;
}

export interface DeletedMeta {
  id: string;
  title: string;
  kind: string;
  when: string;
  /** The newest backup. */
  path: string;
}

export interface BackupMeta {
  path: string;
  when: string;
  title: string;
}

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

function fileNameFor(d: Diagram): string {
  return `${d.kind}-${slug(d.title) || 'diagram'}-${d.id.slice(0, 6)}.json`;
}

function parse(text: string, path: string): Diagram {
  const raw = JSON.parse(text);
  const problems = validateDiagram(raw);
  if (problems.length) throw new Error(`${path}: ${problems.join('; ')}`);
  return normalizeDiagram(raw as Diagram);
}

function stamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
function stampToIso(name: string): string {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z/.exec(name);
  return m ? `${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z` : name;
}

/** Parse just enough of a file to know its version, without validating the data. */
function peekText(text: string): { updated: string; updatedBy?: string } {
  const m = /"updated"\s*:\s*"([^"]*)"/.exec(text);
  const b = /"updatedBy"\s*:\s*"([^"]*)"/.exec(text);
  return { updated: m?.[1] ?? '', updatedBy: b?.[1] };
}

/** Shared settings folder inside the diagrams folder. */
export const CONFIG = 'se-ramify-config';

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Same JSON layout everywhere (2 spaces, final newline): smaller, cleaner git diffs. */
const serialize = (d: Diagram) => JSON.stringify(d, null, 2) + '\n';

/* ------------------------------------------------------------------ Tauri */

async function tauriStorage(): Promise<Storage> {
  const fs = await import('@tauri-apps/plugin-fs');
  const { open, save: saveDialog, ask } = await import('@tauri-apps/plugin-dialog');
  const { appDataDir } = await import('@tauri-apps/api/path');
  const { load } = await import('@tauri-apps/plugin-store');
  const settings = await load('settings.json', { autoSave: true, defaults: {} });
  const join = (dir: string, name: string) => (dir.endsWith('/') || dir.endsWith('\\') ? dir + name : `${dir}/${name}`);
  const getDir = async () => (await settings.get<string>('dir')) ?? null;
  let problems: FileProblem[] = [];
  const cache = new Map<string, { mtime: number; meta: DiagramMeta }>();

  return {
    getDir,
    async pickDir() {
      const dir = await open({ directory: true, multiple: false, title: 'Choose where se-ramify keeps your diagrams' });
      if (typeof dir !== 'string') return null;
      await settings.set('dir', dir);
      return dir;
    },
    async list() {
      const dir = await getDir();
      problems = [];
      if (!dir || !(await fs.exists(dir))) return [];
      const out: DiagramMeta[] = [];
      const seen = new Set<string>();
      for (const e of await fs.readDir(dir)) {
        if (!e.isFile || !e.name.endsWith('.json') || e.name.endsWith('.tmp.json')) continue;
        const path = join(dir, e.name);
        seen.add(path);
        try {
          // Only files whose modification time changed are read again (the folder is re-listed every few seconds).
          const mtime = (await fs.stat(path)).mtime?.getTime() ?? 0;
          const hit = cache.get(path);
          let meta: DiagramMeta;
          if (hit && hit.mtime === mtime && mtime) meta = { ...hit.meta };
          else {
            const text = await fs.readTextFile(path);
            try {
              meta = metaOf(parse(text, path), path);
            } catch (err) {
              problems.push({ path, name: e.name, error: errText(err), gitConflict: hasConflictMarkers(text) });
              cache.delete(path);
              continue;
            }
            cache.set(path, { mtime, meta: { ...meta } });
          }
          if (isConflictCopy(e.name)) meta.conflict = true;
          out.push(meta);
        } catch (err) {
          problems.push({ path, name: e.name, error: errText(err), gitConflict: false });
        }
      }
      for (const p of [...cache.keys()]) if (!seen.has(p)) cache.delete(p);
      return markDuplicates(out).sort((a, b) => b.updated.localeCompare(a.updated));
    },
    problems: () => problems,
    async peek(path) {
      if (!(await fs.exists(path))) return null;
      return peekText(await fs.readTextFile(path));
    },
    readRaw: (path) => fs.readTextFile(path),
    async writeRaw(path, text) {
      await fs.writeTextFile(path, text);
      cache.delete(path);
    },
    async readConfig(name) {
      const dir = await getDir();
      if (!dir) return null;
      const p = join(join(dir, CONFIG), name);
      return (await fs.exists(p)) ? fs.readTextFile(p) : null;
    },
    async writeConfig(name, text) {
      const dir = await getDir();
      if (!dir) return;
      const root = join(dir, CONFIG);
      const sub = name.includes('/') ? join(root, name.slice(0, name.lastIndexOf('/'))) : root;
      if (!(await fs.exists(sub))) {
        await fs.mkdir(sub, { recursive: true });
        // Presence is live state, not history: keep it out of a team's git repository.
        if (sub.endsWith('presence')) await fs.writeTextFile(join(sub, '.gitignore'), '*\n');
      }
      await fs.writeTextFile(join(root, name), text);
    },
    async listConfig(sub) {
      const dir = await getDir();
      if (!dir) return [];
      const d = join(join(dir, CONFIG), sub);
      if (!(await fs.exists(d))) return [];
      const out: { name: string; text: string }[] = [];
      for (const e of await fs.readDir(d)) {
        if (!e.isFile || !e.name.endsWith('.json')) continue;
        try {
          out.push({ name: e.name, text: await fs.readTextFile(join(d, e.name)) });
        } catch {
          /* half-synced: next time */
        }
      }
      return out;
    },
    async removeConfig(name) {
      const dir = await getDir();
      if (!dir) return;
      const p = join(join(dir, CONFIG), name);
      if (await fs.exists(p)) await fs.remove(p);
    },
    async load(path) {
      return parse(await fs.readTextFile(path), path);
    },
    async save(d, path) {
      const dir = await getDir();
      if (!dir) throw new Error('No folder chosen');
      if (!(await fs.exists(dir))) await fs.mkdir(dir, { recursive: true });
      let target = path ?? join(dir, fileNameFor(d));
      // A new file never replaces another one (an imported copy of a diagram already in the folder).
      if (!path) for (let i = 2; await fs.exists(target); i++) target = join(dir, fileNameFor(d).replace(/\.json$/, `-${i}.json`));
      const tmp = target.replace(/\.json$/, '.tmp.json');
      await fs.writeTextFile(tmp, serialize(d));
      await fs.rename(tmp, target);
      cache.delete(target);
      return target;
    },
    async remove(path) {
      await fs.remove(path);
    },
    async getSetting<T>(key: string) {
      return (await settings.get<T>(key)) ?? null;
    },
    async setSetting<T>(key: string, value: T) {
      await settings.set(key, value);
    },
    async exportFile(name, content, kind) {
      const dir = (await settings.get<string>('exportDir')) ?? (await getDir());
      const target = await saveDialog({ defaultPath: dir ? join(dir, name) : name, filters: [{ name: kind.name, extensions: kind.extensions }] });
      if (!target) return false;
      if (typeof content === 'string') await fs.writeTextFile(target, content);
      else await fs.writeFile(target, content);
      const sep = Math.max(target.lastIndexOf('/'), target.lastIndexOf('\\'));
      if (sep > 0) await settings.set('exportDir', target.slice(0, sep));
      return true;
    },
    async importText(kind) {
      const picked = await open({ multiple: false, directory: false, filters: [{ name: kind.name, extensions: kind.extensions }] });
      if (typeof picked !== 'string') return null;
      const sep = Math.max(picked.lastIndexOf('/'), picked.lastIndexOf('\\'));
      return { name: picked.slice(sep + 1), text: await fs.readTextFile(picked) };
    },
    async confirm(message, title = 'se-ramify') {
      return ask(message, { title, kind: 'warning', okLabel: 'Yes', cancelLabel: 'No' });
    },
    async copyImage(png) {
      const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
      await writeImage(png);
    },
    async copyText(text) {
      const { writeText } = await import('@tauri-apps/plugin-clipboard-manager');
      await writeText(text);
    },
    async pickExportDir(title) {
      const dir = await open({ directory: true, multiple: false, title, defaultPath: (await settings.get<string>('exportDir')) ?? undefined });
      if (typeof dir !== 'string') return null;
      await settings.set('exportDir', dir);
      return dir;
    },
    async writeInto(dir, name, content) {
      if (!(await fs.exists(dir))) await fs.mkdir(dir, { recursive: true });
      if (typeof content === 'string') await fs.writeTextFile(join(dir, name), content);
      else await fs.writeFile(join(dir, name), content);
    },
    async backup(d, keep = 30) {
      const dir = join(join(await appDataDir(), 'backups'), d.id);
      if (!(await fs.exists(dir))) await fs.mkdir(dir, { recursive: true });
      await fs.writeTextFile(join(dir, `${stamp()}.json`), JSON.stringify(d));
      const names = (await fs.readDir(dir)).filter((e) => e.isFile && e.name.endsWith('.json')).map((e) => e.name).sort();
      for (const old of names.slice(0, Math.max(0, names.length - keep))) await fs.remove(join(dir, old)).catch(() => {});
    },
    async listBackups(id) {
      const dir = join(join(await appDataDir(), 'backups'), id);
      if (!(await fs.exists(dir))) return [];
      const out: BackupMeta[] = [];
      for (const e of await fs.readDir(dir)) {
        if (!e.isFile || !e.name.endsWith('.json')) continue;
        try {
          const d = JSON.parse(await fs.readTextFile(join(dir, e.name))) as Diagram;
          out.push({ path: join(dir, e.name), when: stampToIso(e.name), title: d.title });
        } catch {
          /* a broken copy is skipped */
        }
      }
      return out.sort((a, b) => b.when.localeCompare(a.when));
    },
    async loadBackup(path) {
      return parse(await fs.readTextFile(path), path);
    },
    async listBackedUp() {
      const root = join(await appDataDir(), 'backups');
      if (!(await fs.exists(root))) return [];
      const out: DeletedMeta[] = [];
      for (const e of await fs.readDir(root)) {
        if (!e.isDirectory) continue;
        const dir = join(root, e.name);
        const names = (await fs.readDir(dir)).filter((f) => f.isFile && f.name.endsWith('.json')).map((f) => f.name).sort();
        const newest = names[names.length - 1];
        if (!newest) continue;
        try {
          const d = JSON.parse(await fs.readTextFile(join(dir, newest))) as Diagram;
          out.push({ id: d.id, title: d.title, kind: d.kind, when: stampToIso(newest), path: join(dir, newest) });
        } catch {
          /* skip */
        }
      }
      return out.sort((a, b) => b.when.localeCompare(a.when));
    }
  };
}

/* ---------------------------------------------------------------- Browser */

function browserStorage(): Storage {
  let problems: FileProblem[] = [];
  const CONF = 'se-ramify:config:';
  const PREFIX = 'se-ramify:diagram:';
  const BACKUP = 'se-ramify:backup:';
  const DIR = 'se-ramify:dir';
  return {
    async getDir() {
      return localStorage.getItem(DIR);
    },
    async pickDir() {
      localStorage.setItem(DIR, 'browser-localStorage');
      return 'browser-localStorage';
    },
    async list() {
      const out: DiagramMeta[] = [];
      problems = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        if (!key.startsWith(PREFIX)) continue;
        const text = localStorage.getItem(key)!;
        try {
          out.push(metaOf(parse(text, key), key));
        } catch (err) {
          problems.push({ path: key, name: key.slice(PREFIX.length), error: errText(err), gitConflict: hasConflictMarkers(text) });
        }
      }
      return markDuplicates(out).sort((a, b) => b.updated.localeCompare(a.updated));
    },
    problems: () => problems,
    async peek(path) {
      const text = localStorage.getItem(path);
      return text === null ? null : peekText(text);
    },
    async readRaw(path) {
      return localStorage.getItem(path) ?? '';
    },
    async writeRaw(path, text) {
      localStorage.setItem(path, text);
    },
    async readConfig(name) {
      return localStorage.getItem(CONF + name);
    },
    async writeConfig(name, text) {
      localStorage.setItem(CONF + name, text);
    },
    async listConfig(sub) {
      return Object.keys(localStorage)
        .filter((k) => k.startsWith(`${CONF}${sub}/`))
        .map((k) => ({ name: k.slice(CONF.length + sub.length + 1), text: localStorage.getItem(k) ?? '' }));
    },
    async removeConfig(name) {
      localStorage.removeItem(CONF + name);
    },
    async load(path) {
      const text = localStorage.getItem(path);
      if (!text) throw new Error(`missing ${path}`);
      return parse(text, path);
    },
    async save(d, path) {
      // A new diagram whose id is already taken (an imported copy) gets its own key.
      let key = path ?? PREFIX + d.id;
      if (!path) for (let i = 2; localStorage.getItem(key) !== null; i++) key = `${PREFIX}${d.id}-${i}`;
      localStorage.setItem(key, serialize(d));
      return key;
    },
    async remove(path) {
      localStorage.removeItem(path);
    },
    async getSetting<T>(key: string) {
      const raw = localStorage.getItem('se-ramify:setting:' + key);
      return raw === null ? null : (JSON.parse(raw) as T);
    },
    async setSetting<T>(key: string, value: T) {
      localStorage.setItem('se-ramify:setting:' + key, JSON.stringify(value));
    },
    async exportFile(name, content, kind) {
      const blob = new Blob([content as BlobPart], { type: kind.mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    },
    async importText(kind) {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = kind.extensions.map((e) => '.' + e).join(',');
        input.onchange = async () => {
          const f = input.files?.[0];
          resolve(f ? { name: f.name, text: await f.text() } : null);
        };
        input.oncancel = () => resolve(null);
        input.click();
      });
    },
    async confirm(message) {
      return window.confirm(message);
    },
    async copyImage(png) {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': new Blob([png as BlobPart], { type: 'image/png' }) })]);
    },
    async copyText(text) {
      await navigator.clipboard.writeText(text);
    },
    async pickExportDir() {
      // No folders in a browser: files download one by one.
      return 'downloads';
    },
    async writeInto(_dir, name, content) {
      const blob = new Blob([content as BlobPart]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    async backup(d, keep = 10) {
      localStorage.setItem(`${BACKUP}${d.id}:${stamp()}`, JSON.stringify(d));
      const mine = Object.keys(localStorage).filter((k) => k.startsWith(`${BACKUP}${d.id}:`)).sort();
      for (const old of mine.slice(0, Math.max(0, mine.length - keep))) localStorage.removeItem(old);
    },
    async listBackups(id) {
      const out: BackupMeta[] = [];
      for (const k of Object.keys(localStorage)) {
        if (!k.startsWith(`${BACKUP}${id}:`)) continue;
        try {
          const d = JSON.parse(localStorage.getItem(k)!) as Diagram;
          out.push({ path: k, when: stampToIso(k.slice(BACKUP.length + id.length + 1)), title: d.title });
        } catch {
          /* skip */
        }
      }
      return out.sort((a, b) => b.when.localeCompare(a.when));
    },
    async loadBackup(path) {
      const text = localStorage.getItem(path);
      if (!text) throw new Error(`missing ${path}`);
      return parse(text, path);
    },
    async listBackedUp() {
      const newest = new Map<string, string>();
      for (const k of Object.keys(localStorage)) {
        if (!k.startsWith(BACKUP)) continue;
        const id = k.slice(BACKUP.length).split(':')[0];
        if (!newest.has(id) || newest.get(id)! < k) newest.set(id, k);
      }
      const out: DeletedMeta[] = [];
      for (const [id, k] of newest) {
        try {
          const d = JSON.parse(localStorage.getItem(k)!) as Diagram;
          out.push({ id, title: d.title, kind: d.kind, when: stampToIso(k.slice(BACKUP.length + id.length + 1)), path: k });
        } catch {
          /* skip */
        }
      }
      return out.sort((a, b) => b.when.localeCompare(a.when));
    }
  };
}

let instance: Promise<Storage> | null = null;
export function storage(): Promise<Storage> {
  return (instance ??= isTauri ? tauriStorage() : Promise.resolve(browserStorage()));
}
